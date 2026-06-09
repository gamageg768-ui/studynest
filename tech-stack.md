# Tech Stack

## Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite 5
- **Routing**: react-router-dom v6
- **HTTP Client**: Axios
- **Markdown Rendering**: react-markdown
- **Styling**: Plain CSS with CSS variables (light-mode design system)
- **State**: React hooks + Context (AuthContext)

## Backend
- **Language**: Python 3.10+
- **Framework**: Flask 3
- **CORS**: flask-cors
- **Environment**: python-dotenv
- **Password Hashing**: Werkzeug (PBKDF2-SHA256)
- **HTTP Client (for Ollama)**: requests
- **Routing**: Flask Blueprints (auth, notebooks, pages, sharing, ai)
- **Auth**: Bearer-token sessions stored in SQLite

## Database
- **Engine**: SQLite (stdlib `sqlite3`)
- **File**: `backend/database.db`
- **Schema management**: Auto-created via raw SQL on startup (`init_db()` in `db.py`)
- **Tables**:
  - users (id, username, password_hash, display_name)
  - sessions (token, user_id)
  - notebooks (id, owner_id, title, description, color, icon)
  - pages (id, notebook_id, title, content)
  - shares (id, notebook_id, shared_with_user_id, permission)
- **Foreign keys**: Enabled with `PRAGMA foreign_keys = ON`
- **Cascade deletes**: Notebooks → pages, notebooks → shares, users → sessions

## AI / LLM
- **Runtime**: Ollama (local)
- **Default Model**: llama3 (configurable via `OLLAMA_MODEL` env var)
- **Integration**: REST API at `http://localhost:11434/api/generate`
- **Endpoints**:
  - `/api/ai/summarize` — generate a bullet-point summary of a page
  - `/api/ai/quiz` — generate quiz questions with answers from a page
  - `/api/ai/explain` — answer a student's question using their notes as context
  - `/api/ai/study-guide` — build a full study guide from all pages in a notebook
  - `/api/ai/health` — verify Ollama reachability and model availability

## Dev Tools
- **Package Manager (frontend)**: npm
- **Package Manager (backend)**: pip + virtualenv
- **Version Control**: Git
- **Dev Proxy**: Vite proxies `/api/*` to Flask at `http://localhost:5000`

## App Features
- **Auth**: Username + password registration, login, logout
- **Notebooks**: Create, edit, delete, customize with icon + color
- **Pages**: Markdown content with live split preview, autosave (800ms debounce)
- **Search**: Full-text search across all owned + shared pages
- **Sharing**: Invite friends/classmates by username with read or edit permission
- **AI Study Assistant**: Per-page summarize / quiz / explain + per-notebook study guides
- **UI Mode**: Light mode only — soft pastel notebooks, white surfaces, indigo accent
