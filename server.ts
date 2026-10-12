import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server, Socket } from "socket.io";
import { sql, userCanAccess } from "./lib/db";
import { getUserFromToken } from "./lib/auth";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// In-memory room state
const _sessions: Record<string, Record<string, { id: number; display_name: string }>> = {};
const _studyRooms: Record<string, { card_index: number; sids: Record<string, { id: number; display_name: string }>; raceActive: boolean; raceScores: Record<number, { display_name: string; correct: number; total: number }> }> = {};
const _flowchartRooms: Record<string, Record<string, { id: number; display_name: string }>> = {};
const _typingUsers: Record<string, Record<number, { display_name: string; timer: ReturnType<typeof setTimeout> }>> = {};
type QuizBattleState = {
  questions: { question: string; options: string[]; correct: number }[];
  currentQ: number;
  scores: Record<number, { display_name: string; points: number }>;
  sids: Record<string, { id: number; display_name: string }>;
  hostId: number;
  active: boolean;
};
const _quizBattles: Record<string, QuizBattleState> = {};

async function recentMessages(notebookId: number, limit = 50) {
  const rows = await sql`
    SELECT id, user_id, display_name, message, created_at
    FROM chat_messages WHERE notebook_id = ${notebookId}
    ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows.reverse();
}

function removeSidFromAll(io: Server, sid: string): void {
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
  for (const [room, state] of Object.entries(_quizBattles)) {
    if (sid in state.sids) {
      const user = state.sids[sid];
      delete state.sids[sid];
      io.to(room).emit("qb_user_left", { user_id: user.id });
      if (Object.keys(state.sids).length === 0) delete _quizBattles[room];
      break;
    }
  }
}

app.prepare().then(() => {
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

    socket.on("join_session", async (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const notebookId: number = data.notebook_id;
      if (!notebookId) return;
      const user = await getUserFromToken(token);
      if (!user) return;
      const { canAccess } = await userCanAccess(notebookId, user.id);
      if (!canAccess) return;

      const room = `notebook_${notebookId}`;
      socket.join(room);
      if (!_sessions[room]) _sessions[room] = {};
      const alreadyPresent = Object.values(_sessions[room]).some((p) => p.id === user.id);
      _sessions[room][socket.id] = { id: user.id, display_name: user.display_name };

      socket.emit("session_state", {
        participants: Object.values(_sessions[room]),
        messages: await recentMessages(notebookId),
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

    socket.on("page_update", async (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const notebookId: number = data.notebook_id;
      if (!notebookId) return;
      const user = await getUserFromToken(token);
      if (!user) return;
      const room = `notebook_${notebookId}`;
      socket.to(room).emit("page_updated", {
        page_id: data.page_id,
        title: data.title,
        content: data.content,
        updated_by: user.display_name,
      });
    });

    socket.on("send_message", async (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const notebookId: number = data.notebook_id;
      const text: string = (data.message || "").trim();
      if (!notebookId || !text) return;
      const user = await getUserFromToken(token);
      if (!user) return;
      const { canAccess } = await userCanAccess(notebookId, user.id);
      if (!canAccess) return;

      const [inserted] = await sql`
        INSERT INTO chat_messages (notebook_id, user_id, display_name, message)
        VALUES (${notebookId}, ${user.id}, ${user.display_name}, ${text})
        RETURNING id, created_at
      `;

      const room = `notebook_${notebookId}`;
      io.to(room).emit("new_message", {
        id: inserted.id,
        user_id: user.id,
        display_name: user.display_name,
        message: text,
        created_at: inserted.created_at,
        reactions: {},
      });

      const mentionPattern = /@(\w+)/g;
      let match;
      const mentionedUsernames = new Set<string>();
      while ((match = mentionPattern.exec(text)) !== null) {
        mentionedUsernames.add(match[1].toLowerCase());
      }

      try {
        const [nb] = await sql`SELECT title, owner_id FROM notebooks WHERE id = ${notebookId}`;
        if (nb) {
          const accessors = await sql`
            SELECT DISTINCT u.id, u.username FROM users u WHERE u.id = ${nb.owner_id}
            UNION
            SELECT u.id, u.username FROM users u
            JOIN shares s ON s.shared_with_user_id = u.id WHERE s.notebook_id = ${notebookId}
          `;

          const activeSessions = _sessions[room] ?? {};
          const activeUserIds = new Set(Object.values(activeSessions).map((p: any) => p.id));

          for (const accessor of accessors) {
            if (accessor.id === user.id) continue;
            const isMentioned = mentionedUsernames.has((accessor.username || "").toLowerCase());
            if (isMentioned) {
              await sql`
                INSERT INTO notifications (user_id, type, title, body, data)
                VALUES (${accessor.id}, 'mention', ${`${user.display_name} mentioned you`},
                  ${`In ${nb.title}: ${text.slice(0, 80)}`},
                  ${JSON.stringify({ notebook_id: notebookId })})
              `;
            } else if (!activeUserIds.has(accessor.id)) {
              await sql`
                INSERT INTO notifications (user_id, type, title, body, data)
                VALUES (${accessor.id}, 'chat', ${`New message in ${nb.title}`},
                  ${`${user.display_name}: ${text.slice(0, 60)}`},
                  ${JSON.stringify({ notebook_id: notebookId })})
              `;
            }
          }
        }
      } catch {}
    });

    // ── Typing indicators ──────────────────────────────────────────

    socket.on("typing_start", async (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const notebookId: number = data.notebook_id;
      if (!notebookId) return;
      const user = await getUserFromToken(token);
      if (!user) return;
      const room = `notebook_${notebookId}`;
      if (!_typingUsers[room]) _typingUsers[room] = {};
      if (_typingUsers[room][user.id]) clearTimeout(_typingUsers[room][user.id].timer);
      const timer = setTimeout(() => {
        delete _typingUsers[room]?.[user.id];
        socket.to(room).emit("typing_clear", { user_id: user.id });
      }, 4000);
      _typingUsers[room][user.id] = { display_name: user.display_name, timer };
      socket.to(room).emit("typing_user", { user_id: user.id, display_name: user.display_name });
    });

    socket.on("typing_stop", async (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const notebookId: number = data.notebook_id;
      if (!notebookId) return;
      const user = await getUserFromToken(token);
      if (!user) return;
      const room = `notebook_${notebookId}`;
      if (_typingUsers[room]?.[user.id]) {
        clearTimeout(_typingUsers[room][user.id].timer);
        delete _typingUsers[room][user.id];
      }
      socket.to(room).emit("typing_clear", { user_id: user.id });
    });

    // ── Emoji reactions ────────────────────────────────────────────

    socket.on("add_reaction", async (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const messageId: number = data.message_id;
      const emoji: string = (data.emoji || "").trim();
      if (!messageId || !emoji) return;
      const user = await getUserFromToken(token);
      if (!user) return;
      const [msg] = await sql`SELECT notebook_id FROM chat_messages WHERE id = ${messageId}`;
      if (!msg) return;
      const { canAccess } = await userCanAccess(msg.notebook_id, user.id);
      if (!canAccess) return;
      try {
        await sql`
          INSERT INTO message_reactions (message_id, user_id, emoji)
          VALUES (${messageId}, ${user.id}, ${emoji})
          ON CONFLICT DO NOTHING
        `;
        const room = `notebook_${msg.notebook_id}`;
        io.to(room).emit("reaction_added", { message_id: messageId, emoji, user_id: user.id, display_name: user.display_name });
      } catch {}
    });

    socket.on("remove_reaction", async (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const messageId: number = data.message_id;
      const emoji: string = (data.emoji || "").trim();
      if (!messageId || !emoji) return;
      const user = await getUserFromToken(token);
      if (!user) return;
      const [msg] = await sql`SELECT notebook_id FROM chat_messages WHERE id = ${messageId}`;
      if (!msg) return;
      await sql`DELETE FROM message_reactions WHERE message_id = ${messageId} AND user_id = ${user.id} AND emoji = ${emoji}`;
      const room = `notebook_${msg.notebook_id}`;
      io.to(room).emit("reaction_removed", { message_id: messageId, emoji, user_id: user.id });
    });

    // ── Live Quiz Battle ───────────────────────────────────────────

    socket.on("join_quiz_battle", async (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const notebookId: number = data.notebook_id;
      if (!notebookId) return;
      const user = await getUserFromToken(token);
      if (!user) return;
      const { canAccess } = await userCanAccess(notebookId, user.id);
      if (!canAccess) return;
      const room = `qb_${notebookId}`;
      socket.join(room);
      if (!_quizBattles[room]) {
        _quizBattles[room] = { questions: [], currentQ: -1, scores: {}, sids: {}, hostId: user.id, active: false };
      }
      const state = _quizBattles[room];
      state.sids[socket.id] = { id: user.id, display_name: user.display_name };
      if (!state.scores[user.id]) state.scores[user.id] = { display_name: user.display_name, points: 0 };
      socket.emit("qb_state", { active: state.active, currentQ: state.currentQ, scores: state.scores, participants: Object.values(state.sids), hostId: state.hostId, question: state.active && state.currentQ >= 0 ? { ...state.questions[state.currentQ], correct: -1 } : null });
      socket.to(room).emit("qb_user_joined", { user: { id: user.id, display_name: user.display_name } });
    });

    socket.on("leave_quiz_battle", (data: any) => {
      data = data || {};
      const notebookId: number = data.notebook_id;
      if (!notebookId) return;
      const room = `qb_${notebookId}`;
      socket.leave(room);
      const state = _quizBattles[room];
      if (state && socket.id in state.sids) {
        const user = state.sids[socket.id];
        delete state.sids[socket.id];
        if (Object.keys(state.sids).length === 0) delete _quizBattles[room];
        else io.to(room).emit("qb_user_left", { user_id: user.id });
      }
    });

    socket.on("qb_start", async (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const notebookId: number = data.notebook_id;
      const questions = data.questions;
      if (!notebookId || !Array.isArray(questions) || questions.length === 0) return;
      const user = await getUserFromToken(token);
      if (!user) return;
      const room = `qb_${notebookId}`;
      const state = _quizBattles[room];
      if (!state || state.hostId !== user.id) return;
      state.questions = questions;
      state.currentQ = 0;
      state.active = true;
      for (const uid of Object.keys(state.scores)) state.scores[Number(uid)].points = 0;
      const q = { ...state.questions[0], correct: -1 };
      io.to(room).emit("qb_question", { question: q, index: 0, total: questions.length, scores: state.scores });
    });

    socket.on("qb_answer", async (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const notebookId: number = data.notebook_id;
      const answer: number = data.answer;
      if (!notebookId || answer == null) return;
      const user = await getUserFromToken(token);
      if (!user) return;
      const room = `qb_${notebookId}`;
      const state = _quizBattles[room];
      if (!state || !state.active || state.currentQ < 0) return;
      const q = state.questions[state.currentQ];
      const correct = answer === q.correct;
      if (correct && state.scores[user.id]) state.scores[user.id].points += 1;
      io.to(room).emit("qb_scores", { scores: state.scores });
    });

    socket.on("qb_next", async (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const notebookId: number = data.notebook_id;
      if (!notebookId) return;
      const user = await getUserFromToken(token);
      if (!user) return;
      const room = `qb_${notebookId}`;
      const state = _quizBattles[room];
      if (!state || state.hostId !== user.id || !state.active) return;
      state.currentQ += 1;
      if (state.currentQ >= state.questions.length) {
        state.active = false;
        io.to(room).emit("qb_ended", { scores: state.scores });
      } else {
        const q = { ...state.questions[state.currentQ], correct: -1 };
        io.to(room).emit("qb_question", { question: q, index: state.currentQ, total: state.questions.length, scores: state.scores });
      }
    });

    // ── Flashcard Race Mode ────────────────────────────────────────

    socket.on("race_start", async (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const setId: number = data.set_id;
      if (!setId) return;
      const user = await getUserFromToken(token);
      if (!user) return;
      const room = `study_${setId}`;
      const state = _studyRooms[room];
      if (!state) return;
      state.raceActive = true;
      state.raceScores = {};
      for (const p of Object.values(state.sids)) {
        state.raceScores[p.id] = { display_name: p.display_name, correct: 0, total: 0 };
      }
      io.to(room).emit("race_started", { scores: state.raceScores });
    });

    socket.on("race_answer", async (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const setId: number = data.set_id;
      const correct: boolean = data.correct;
      if (!setId || correct == null) return;
      const user = await getUserFromToken(token);
      if (!user) return;
      const room = `study_${setId}`;
      const state = _studyRooms[room];
      if (!state || !state.raceActive) return;
      if (!state.raceScores[user.id]) state.raceScores[user.id] = { display_name: user.display_name, correct: 0, total: 0 };
      state.raceScores[user.id].total += 1;
      if (correct) state.raceScores[user.id].correct += 1;
      io.to(room).emit("race_scores", { scores: state.raceScores });
    });

    socket.on("race_end", (data: any) => {
      data = data || {};
      const setId: number = data.set_id;
      if (!setId) return;
      const room = `study_${setId}`;
      const state = _studyRooms[room];
      if (!state) return;
      state.raceActive = false;
      io.to(room).emit("race_ended", { scores: state.raceScores });
    });

    // ── Flashcard group study ──────────────────────────────────────

    socket.on("join_study", async (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const setId: number = data.set_id;
      if (!setId) return;
      const user = await getUserFromToken(token);
      if (!user) return;
      const [s] = await sql`SELECT notebook_id FROM flashcard_sets WHERE id = ${setId}`;
      if (!s) return;
      const { canAccess } = await userCanAccess(s.notebook_id, user.id);
      if (!canAccess) return;

      const room = `study_${setId}`;
      socket.join(room);
      if (!_studyRooms[room]) _studyRooms[room] = { card_index: 0, sids: {}, raceActive: false, raceScores: {} };
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

    socket.on("study_goto", async (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const setId: number = data.set_id;
      const index: number = data.index;
      if (setId == null || index == null) return;
      const user = await getUserFromToken(token);
      if (!user) return;
      const room = `study_${setId}`;
      const state = _studyRooms[room];
      if (state) state.card_index = index;
      socket.to(room).emit("study_navigate", { index, by: user.display_name });
    });

    // ── Flowchart collaboration ────────────────────────────────────

    socket.on("join_flowchart", async (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const chartId: number = data.chart_id;
      if (!chartId) return;
      const user = await getUserFromToken(token);
      if (!user) return;
      const [c] = await sql`SELECT notebook_id FROM flowcharts WHERE id = ${chartId}`;
      if (!c) return;
      const { canAccess } = await userCanAccess(c.notebook_id, user.id);
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

    socket.on("flowchart_save", async (data: any) => {
      data = data || {};
      const token: string = data.token || "";
      const chartId: number = data.chart_id;
      const source: string = data.source || "";
      if (!chartId) return;
      const user = await getUserFromToken(token);
      if (!user) return;
      const [c] = await sql`SELECT notebook_id FROM flowcharts WHERE id = ${chartId}`;
      if (!c) return;
      const { canAccess, permission } = await userCanAccess(c.notebook_id, user.id);
      if (!canAccess || permission === "read") return;

      await sql`UPDATE flowcharts SET source = ${source}, updated_at = NOW() WHERE id = ${chartId}`;

      const room = `fc_${chartId}`;
      socket.to(room).emit("fc_updated", { source, updated_by: user.display_name });
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} [${dev ? "dev" : "production"}]`);
  });
});
