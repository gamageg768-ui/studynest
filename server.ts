import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server, Socket } from "socket.io";
import { getDb, userCanAccess } from "./lib/db";
import { getUserFromToken } from "./lib/auth";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// In-memory room state
const _sessions: Record<string, Record<string, { id: number; display_name: string }>> = {};
const _studyRooms: Record<string, { card_index: number; sids: Record<string, { id: number; display_name: string }> }> = {};
const _flowchartRooms: Record<string, Record<string, { id: number; display_name: string }>> = {};

function recentMessages(notebookId: number, limit = 50) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, user_id, display_name, message, created_at
       FROM chat_messages WHERE notebook_id = ?
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(notebookId, limit) as any[];
  return rows.reverse();
}

function removeSidFromAll(
  io: Server,
  sid: string
): void {
  // notebook sessions
  for (const [room, participants] of Object.entries(_sessions)) {
    if (sid in participants) {
      const user = participants[sid];
      delete participants[sid];
      const stillHere = Object.values(participants).some((p) => p.id === user.id);
      if (!stillHere) io.to(room).emit("user_left", { user });
      if (Object.keys(participants).length === 0) delete _sessions[room];
      break;
    }
  }

  // study rooms
  for (const [room, state] of Object.entries(_studyRooms)) {
    if (sid in state.sids) {
      const user = state.sids[sid];
      delete state.sids[sid];
      const stillHere = Object.values(state.sids).some((p) => p.id === user.id);
      if (!stillHere) io.to(room).emit("study_user_left", { user });
      if (Object.keys(state.sids).length === 0) delete _studyRooms[room];
      break;
    }
  }

  // flowchart rooms
  for (const [room, participants] of Object.entries(_flowchartRooms)) {
    if (sid in participants) {
      const user = participants[sid];
      delete participants[sid];
      const stillHere = Object.values(participants).some((p) => p.id === user.id);
      if (!stillHere) io.to(room).emit("fc_user_left", { user });
      if (Object.keys(participants).length === 0) delete _flowchartRooms[room];
      break;
    }
  }
}

app.prepare().then(() => {
  // Initialize DB on startup
  getDb();

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: "*" },
    transports: ["polling", "websocket"],
  });

  io.on("connection", (socket: Socket) => {
    socket.on("disconnect", () => {
      removeSidFromAll(io, socket.id);
    });

    // ── Notebook presence ──────────────────────────────────────────

    socket.on("join_session", (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const notebookId: number = data.notebook_id;
      if (!notebookId) return;
      const user = getUserFromToken(token);
      if (!user) return;
      const { canAccess } = userCanAccess(notebookId, user.id);
      if (!canAccess) return;

      const room = `notebook_${notebookId}`;
      socket.join(room);
      if (!_sessions[room]) _sessions[room] = {};
      const alreadyPresent = Object.values(_sessions[room]).some((p) => p.id === user.id);
      _sessions[room][socket.id] = { id: user.id, display_name: user.display_name };

      socket.emit("session_state", {
        participants: Object.values(_sessions[room]),
        messages: recentMessages(notebookId),
      });

      if (!alreadyPresent) {
        socket.to(room).emit("user_joined", {
          user: { id: user.id, display_name: user.display_name },
        });
      }
    });

    socket.on("leave_session", (data: any) => {
      data = data || {};
      const notebookId: number = data.notebook_id;
      if (!notebookId) return;
      const room = `notebook_${notebookId}`;
      socket.leave(room);
      const participants = _sessions[room] || {};
      if (socket.id in participants) {
        const user = participants[socket.id];
        delete participants[socket.id];
        const stillHere = Object.values(participants).some((p) => p.id === user.id);
        if (!stillHere) io.to(room).emit("user_left", { user });
        if (Object.keys(participants).length === 0) delete _sessions[room];
      }
    });

    socket.on("page_update", (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const notebookId: number = data.notebook_id;
      if (!notebookId) return;
      const user = getUserFromToken(token);
      if (!user) return;
      const room = `notebook_${notebookId}`;
      socket.to(room).emit("page_updated", {
        page_id: data.page_id,
        title: data.title,
        content: data.content,
        updated_by: user.display_name,
      });
    });

    socket.on("send_message", (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const notebookId: number = data.notebook_id;
      const text: string = (data.message || "").trim();
      if (!notebookId || !text) return;
      const user = getUserFromToken(token);
      if (!user) return;
      const { canAccess } = userCanAccess(notebookId, user.id);
      if (!canAccess) return;

      const createdAt = new Date().toISOString().replace("T", " ").slice(0, 19);
      const db = getDb();
      const result = db
        .prepare(
          `INSERT INTO chat_messages (notebook_id, user_id, display_name, message, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(notebookId, user.id, user.display_name, text, createdAt);

      const room = `notebook_${notebookId}`;
      io.to(room).emit("new_message", {
        id: result.lastInsertRowid,
        user_id: user.id,
        display_name: user.display_name,
        message: text,
        created_at: createdAt,
      });

      // Notify notebook accessors who are NOT currently in the room
      try {
        const nb = db.prepare("SELECT title, owner_id FROM notebooks WHERE id = ?").get(notebookId) as any;
        if (nb) {
          const accessors = db.prepare(
            `SELECT DISTINCT u.id FROM users u
             WHERE u.id = ?
             UNION
             SELECT s.shared_with_user_id FROM shares s WHERE s.notebook_id = ?`
          ).all(nb.owner_id, notebookId) as any[];

          const roomSockets = io.sockets.adapter.rooms.get(room) ?? new Set<string>();
          const activeSessions = _sessions[room] ?? {};
          const activeUserIds = new Set(Object.values(activeSessions).map((p: any) => p.id));

          for (const accessor of accessors) {
            if (accessor.id !== user.id && !activeUserIds.has(accessor.id)) {
              db.prepare(
                `INSERT INTO notifications (user_id, type, title, body, data)
                 VALUES (?, 'chat', ?, ?, ?)`
              ).run(
                accessor.id,
                `New message in ${nb.title}`,
                `${user.display_name}: ${text.slice(0, 60)}`,
                JSON.stringify({ notebook_id: notebookId })
              );
            }
          }
        }
      } catch {}
    });

    // ── Flashcard group study ──────────────────────────────────────

    socket.on("join_study", (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const setId: number = data.set_id;
      if (!setId) return;
      const user = getUserFromToken(token);
      if (!user) return;
      const db = getDb();
      const s = db.prepare("SELECT notebook_id FROM flashcard_sets WHERE id = ?").get(setId) as any;
      if (!s) return;
      const { canAccess } = userCanAccess(s.notebook_id, user.id);
      if (!canAccess) return;

      const room = `study_${setId}`;
      socket.join(room);
      if (!_studyRooms[room]) _studyRooms[room] = { card_index: 0, sids: {} };
      const state = _studyRooms[room];
      const alreadyPresent = Object.values(state.sids).some((p) => p.id === user.id);
      state.sids[socket.id] = { id: user.id, display_name: user.display_name };

      socket.emit("study_state", {
        card_index: state.card_index,
        participants: Object.values(state.sids),
      });

      if (!alreadyPresent) {
        socket.to(room).emit("study_user_joined", {
          user: { id: user.id, display_name: user.display_name },
        });
      }
    });

    socket.on("leave_study", (data: any) => {
      data = data || {};
      const setId: number = data.set_id;
      if (!setId) return;
      const room = `study_${setId}`;
      socket.leave(room);
      const state = _studyRooms[room];
      if (!state) return;
      if (socket.id in state.sids) {
        const user = state.sids[socket.id];
        delete state.sids[socket.id];
        const stillHere = Object.values(state.sids).some((p) => p.id === user.id);
        if (!stillHere) io.to(room).emit("study_user_left", { user });
        if (Object.keys(state.sids).length === 0) delete _studyRooms[room];
      }
    });

    socket.on("study_goto", (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const setId: number = data.set_id;
      const index: number = data.index;
      if (setId == null || index == null) return;
      const user = getUserFromToken(token);
      if (!user) return;
      const room = `study_${setId}`;
      const state = _studyRooms[room];
      if (state) state.card_index = index;
      socket.to(room).emit("study_navigate", { index, by: user.display_name });
    });

    // ── Flowchart collaboration ────────────────────────────────────

    socket.on("join_flowchart", (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const chartId: number = data.chart_id;
      if (!chartId) return;
      const user = getUserFromToken(token);
      if (!user) return;
      const db = getDb();
      const c = db.prepare("SELECT notebook_id FROM flowcharts WHERE id = ?").get(chartId) as any;
      if (!c) return;
      const { canAccess } = userCanAccess(c.notebook_id, user.id);
      if (!canAccess) return;

      const room = `fc_${chartId}`;
      socket.join(room);
      if (!_flowchartRooms[room]) _flowchartRooms[room] = {};
      const alreadyPresent = Object.values(_flowchartRooms[room]).some((p) => p.id === user.id);
      _flowchartRooms[room][socket.id] = { id: user.id, display_name: user.display_name };

      socket.emit("fc_state", { participants: Object.values(_flowchartRooms[room]) });

      if (!alreadyPresent) {
        socket.to(room).emit("fc_user_joined", {
          user: { id: user.id, display_name: user.display_name },
        });
      }
    });

    socket.on("leave_flowchart", (data: any) => {
      data = data || {};
      const chartId: number = data.chart_id;
      if (!chartId) return;
      const room = `fc_${chartId}`;
      socket.leave(room);
      const participants = _flowchartRooms[room] || {};
      if (socket.id in participants) {
        const user = participants[socket.id];
        delete participants[socket.id];
        const stillHere = Object.values(participants).some((p) => p.id === user.id);
        if (!stillHere) io.to(room).emit("fc_user_left", { user });
        if (Object.keys(participants).length === 0) delete _flowchartRooms[room];
      }
    });

    socket.on("flowchart_save", (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const chartId: number = data.chart_id;
      const source: string = data.source || "";
      if (!chartId) return;
      const user = getUserFromToken(token);
      if (!user) return;
      const db = getDb();
      const c = db.prepare("SELECT notebook_id FROM flowcharts WHERE id = ?").get(chartId) as any;
      if (!c) return;
      const { canAccess, permission } = userCanAccess(c.notebook_id, user.id);
      if (!canAccess || permission === "read") return;

      db.prepare(
        "UPDATE flowcharts SET source = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(source, chartId);

      const room = `fc_${chartId}`;
      socket.to(room).emit("fc_updated", { source, updated_by: user.display_name });
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} [${dev ? "dev" : "production"}]`);
  });
});
