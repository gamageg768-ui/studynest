# StudyNest — Codebase Reference

## Dev Command
```
npm run dev   →   tsx server.ts   (NOT next dev — custom server combines Next.js + Socket.IO on same port)
```
- Database: `database.db` (SQLite, auto-created on first run, WAL mode)
- AI: Ollama must be running locally on port 11434 with `llama3` model

---

## Tech Stack
- Next.js 14 App Router, pure CSS (no Tailwind), React Context for global state
- `better-sqlite3` v11 (sync SQLite), Socket.IO v4.7.5
- Token-based auth: Bearer token in `localStorage` as `studynest_token`
- `jszip` for ZIP exports, `mermaid` for flowcharts, `bcryptjs` for passwords

---

## Critical Architecture Gotchas
- `next.config.mjs` — NOT `.ts` (Next.js 14 doesn't support `.ts` config files)
- `better-sqlite3` must be in `experimental.serverComponentsExternalPackages` in `next.config.mjs`
- `tsconfig.json` excludes `frontend/` dir (legacy Vite code uses `import.meta.env`)
- Dark mode: `[data-theme="dark"]` attr on `<html>`. Flash-prevention inline `<script>` in `<head>` of `app/layout.tsx` reads localStorage before first render
- Route groups: `(app)` = protected routes with Sidebar; `(auth)` = login/register
- `app/(app)/layout.tsx` is the auth guard — redirects to `/login` if no valid token
- Check `user?.is_guest` to block destructive operations for guest users
- ZIP export: use `buffer as unknown as BodyInit` cast — Next.js type mismatch with Uint8Array
- SM-2 SRS algorithm: quality ≥ 3 advances interval (1 → 6 → round(prev × ease)), quality < 3 resets interval to 0
- DB migrations: `try { db.exec("ALTER TABLE...") } catch {}` pattern after schema init in `getDb()`
- New DB tables: always add `CREATE TABLE IF NOT EXISTS` to the SCHEMA string in `lib/db.ts`

---

## Key Files & Purpose
```
server.ts                         Custom HTTP server: Next.js + Socket.IO on same port
lib/db.ts                         SQLite schema + getDb() + userCanAccess()
lib/auth.ts                       requireAuth(req), getUserFromToken(token), generateToken()
lib/api-utils.ts                  auth(req), ok(data), err(msg, status), isResponse(v)
lib/client.ts                     Axios instance + all typed API client namespaces
lib/ollama.ts                     Ollama local AI integration
lib/socket.ts                     Socket.IO client setup
types/index.ts                    All TypeScript interfaces for domain models
app/providers.tsx                 ThemeProvider > AuthProvider > SessionProvider
app/layout.tsx                    Root layout: flash-prevention script, service worker reg
app/(app)/layout.tsx              Auth guard + Sidebar + ChatFAB + keyboard shortcuts wiring
app/(app)/dashboard/page.tsx      Stats grid + pinned/owned/shared notebooks
app/(app)/settings/page.tsx       Profile (display name) + password change
app/(app)/review/page.tsx         SRS review: flip card UI, Again/Hard/Good/Easy buttons
contexts/AuthContext.tsx          useAuth(): { user, loading, login, register, logout, loginAsGuest, updateUser }
contexts/ThemeContext.tsx         useTheme(): { theme, toggleTheme } — persists to localStorage
contexts/SessionContext.tsx       Study session state (active notebook context)
hooks/useKeyboardShortcuts.ts     useKeyboardShortcuts(map, enabled?) — ignores INPUT/TEXTAREA
components/Sidebar.tsx            NotificationBell (30s poll) + review badge + dark toggle + /settings link
components/NotebookCard.tsx       onPin prop, pin button on hover (owner only)
components/AIPanel.tsx            InteractiveQuiz: MCQ form → score → save to /api/quiz-attempts
components/PomodoroTimer.tsx      Floating SVG timer, logs to /api/study-sessions, plays /sounds/ding.mp3
components/KeyboardShortcuts.tsx  Shortcuts help modal (? key to open)
```

---

## Database Schema (16 tables)
```
users            id, username, password_hash, display_name, is_guest, created_at
sessions         token, user_id, created_at
notebooks        id, owner_id, title, description, color, icon, is_pinned, created_at, updated_at
pages            id, notebook_id, title, content, created_at, updated_at
shares           id, notebook_id, shared_with_user_id, permission(read|edit), created_at
chat_messages    id, notebook_id, user_id, display_name, message, created_at
attachments      id, notebook_id, uploader_id, original_name, stored_name, mime_type, file_size, created_at
flashcard_sets   id, notebook_id, title, created_at
flashcards       id, set_id, front, back, position, next_review, ease_factor, interval_days, repetitions
flowcharts       id, notebook_id, title, source, created_at, updated_at
page_versions    id, page_id, title, content, saved_by, saved_at
notifications    id, user_id, type, title, body, data(JSON), is_read, created_at
study_sessions   id, user_id, notebook_id, duration_seconds, created_at
quiz_attempts    id, user_id, notebook_id, score, total, created_at
tags             id, user_id, name, color(hex), UNIQUE(user_id, name)
page_tags        page_id, tag_id  (junction table, composite PK)
```
ALTER TABLE migrations for `flashcards` (next_review, ease_factor, interval_days, repetitions) and `notebooks` (is_pinned) run via try/catch after SCHEMA init in `getDb()`.

---

## Auth Pattern (every API route)
```typescript
import { auth, ok, err, isResponse } from "@/lib/api-utils";
import { getDb, userCanAccess } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);            // Returns SessionUser or NextResponse(401)
  if (isResponse(user)) return user; // Early-return on 401
  // user.id, user.username, user.display_name, user.is_guest available
  const db = getDb();
  const { canAccess, permission } = userCanAccess(notebookId, user.id);
  // permission: "owner" | "edit" | "read"
}
```

---

## API Route Map
```
Auth:
  POST   /api/auth/login             POST   /api/auth/register
  POST   /api/auth/logout            GET    /api/auth/me
  POST   /api/auth/guest             PATCH  /api/auth/profile     (display_name)
  PATCH  /api/auth/password          (verifies current pwd, blocks guests)

Notebooks:
  GET/POST              /api/notebooks
  GET/PATCH/DELETE      /api/notebooks/[id]
  PATCH                 /api/notebooks/[id]/pin        (toggle is_pinned, owner only)
  GET                   /api/notebooks/[id]/export     (ZIP of all pages as .md)
  GET/POST              /api/notebooks/[id]/shares
  DELETE                /api/notebooks/[id]/shares/[shareId]

Pages:
  POST                  /api/notebooks/[id]/pages
  GET/PATCH/DELETE      /api/pages/[id]                (PATCH snapshots to page_versions first)
  GET                   /api/pages/[id]/export         (.md download)
  GET                   /api/pages/[id]/versions
  GET                   /api/pages/[id]/versions/[vId]
  POST                  /api/pages/[id]/versions/[vId]/restore
  GET/POST              /api/pages/[id]/tags
  DELETE                /api/pages/[id]/tags/[tagId]

Tags:
  GET/POST              /api/tags
  PATCH/DELETE          /api/tags/[id]

Flashcards:
  GET/POST              /api/notebooks/[id]/flashcard-sets
  GET/PATCH/DELETE      /api/flashcard-sets/[id]
  POST                  /api/flashcard-sets/[id]/cards
  GET                   /api/flashcard-sets/[id]/export     (CSV: front,back)
  PATCH/DELETE          /api/flashcards/[id]
  POST                  /api/flashcards/[id]/review          (SM-2: { quality: 0|1|2|3|4|5 })

SRS Review:
  GET  /api/review     (cards where next_review <= now, across all accessible notebooks)

Flowcharts:
  GET/POST              /api/notebooks/[id]/flowcharts
  GET/PATCH/DELETE      /api/flowcharts/[id]

Files:
  GET/POST              /api/notebooks/[id]/files
  GET/DELETE            /api/files/[id]

AI:
  GET   /api/ai/health
  POST  /api/ai/summarize       { page_id }
  POST  /api/ai/quiz            { page_id, count } → { questions: QuizQuestion[], notebook_id }
  POST  /api/ai/explain         { page_id, question }
  POST  /api/ai/study-guide     { notebook_id }
  POST  /api/ai/flashcards      { page_id?, notebook_id?, count? }
  POST  /api/ai/flowchart       { page_id?, description?, notebook_id? }

Notifications:
  GET   /api/notifications              (unread first, limit 20, + unread_count)
  PATCH /api/notifications/[id]/read
  PATCH /api/notifications/read-all

Stats & Sessions:
  GET   /api/stats              → { total_study_seconds, today_study_seconds, cards_due, quiz_avg_score, streak_days }
  POST  /api/study-sessions     { duration_seconds, notebook_id? }
  GET   /api/quiz-attempts      ?notebook_id=X   (last 20)
  POST  /api/quiz-attempts      { notebook_id, score, total }  (blocks guests)

Search:
  GET   /api/search?q=...&tag=...
```

---

## CSS & Theming
- All styles in `app/globals.css` using CSS custom properties on `:root`
- Dark mode overrides on `[data-theme="dark"]`
- Key vars: `--bg`, `--surface`, `--surface-soft`, `--border`, `--border-strong`, `--text`, `--text-muted`, `--accent`, `--accent-hover`, `--accent-soft`, `--shadow-sm`, `--shadow`
- Light accent: `#6366f1` | Dark accent: `#818cf8`
- Notable CSS classes: `.stats-grid`, `.stat-card`, `.notebook-card-pinned`, `.pin-btn`, `.notif-bell-wrap`, `.notif-dropdown`, `.history-panel`, `.version-item`, `.tag-chip`, `.tags-row`, `.tag-dropdown`, `.pomodoro-widget`, `.quiz-question`, `.review-wrap`, `.shortcut-table`, `.shortcut-key`

---

## Socket.IO Events (server.ts)
In-memory state: `_sessions` (notebook presence), `_studyRooms` (flashcard study), `_flowchartRooms`

```
Client → Server:  join_notebook, leave_notebook, send_message
                  join_study, leave_study, sync_card_index
                  join_flowchart, leave_flowchart, update_flowchart

Server → Client:  room_users, recent_messages, new_message
                  study_users, card_index_update
                  flowchart_users, flowchart_updated
```
Chat notifications are inserted to DB for users NOT currently in the Socket.IO room.

---

## Keyboard Shortcuts (wired in `app/(app)/layout.tsx`)
```
?  /  Shift+?      open shortcuts modal
Ctrl+B             navigate to /dashboard
Ctrl+Shift+N       dispatch 'studynest:new-notebook' custom event (dashboard listens)
Ctrl+Shift+F       toggle dark/light theme
Ctrl+K             focus .sidebar-search input
Escape             close shortcuts modal
```

---

## Client API Namespaces (`lib/client.ts`)
```typescript
authApi        — login, register, logout, me, guestLogin
notebookApi    — list, get, create, update, remove, pin
pageApi        — create, get, update, remove, search
shareApi       — list, add, remove
fileApi        — list, upload, remove, url
aiApi          — health, summarize, quiz, explain, studyGuide, generateFlashcards, generateFlowchart
flashcardApi   — listSets, createSet, getSet, updateSet, deleteSet, addCard, updateCard, deleteCard
tagApi         — list, create, update, remove, getPageTags, addToPage, removeFromPage
versionApi     — list, get, restore
notifApi       — list, markRead, markAllRead
studySessionApi — log(duration_seconds, notebook_id?)
quizApi        — save(notebook_id, score, total), history(notebook_id)
reviewApi      — getDue(), submitReview(cardId, quality)
statsApi       — get()
flowchartApi   — list, create, get, update, remove
```

---

## Authenticated File Download Pattern
Auth token is in localStorage (not cookies), so fetch must set the header manually:
```typescript
async function exportBlob(url: string, filename: string) {
  const token = localStorage.getItem("studynest_token");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
```
