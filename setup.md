# Setup Guide

## Prerequisites
- Node.js 18+
- Python 3.10+
- Ollama installed (https://ollama.com)
- Git

## 1. Clone the Project
1. `git clone <repo-url>` (or unzip the project)
2. `cd studynest`

## 2. Frontend Setup
1. `cd frontend`
2. `npm install`
3. `npm run dev`
   - Runs on: http://localhost:5173

## 3. Backend Setup
1. Open a new terminal and `cd backend`
2. `python -m venv venv`
3. Activate virtualenv:
   - macOS/Linux: `source venv/bin/activate`
   - Windows: `venv\Scripts\activate`
4. `pip install -r requirements.txt`
5. (Optional) Copy environment file:
   - `cp .env.example .env`
   - Edit `.env` to change the Ollama model or DB path
6. `python app.py`
   - Runs on: http://localhost:5000

## 4. Ollama Setup
1. Install Ollama from https://ollama.com/download
2. Pull a model:
   - Recommended: `ollama pull llama3`
   - Lighter alternative: `ollama pull llama3.2:3b`
3. Start Ollama: `ollama serve`
   - Runs on: http://localhost:11434
4. Verify the AI is reachable from the backend:
   - Visit: http://localhost:5000/api/ai/health

## 5. Database
- SQLite database auto-created on first backend run
- File location: `backend/database.db`
- Tables: users, sessions, notebooks, pages, shares

## 6. First Run
1. Open http://localhost:5173 in your browser
2. Click "Create an account"
3. Pick a username (3-30 chars), display name, and password (6+ chars)
4. Click **+ New notebook** on the dashboard to get started
5. Open the notebook → click **+ New page** → start writing markdown
6. Use the AI panel on the right to summarize, quiz yourself, or ask questions
7. To share with friends, open a notebook → click **👥 Share** → enter their username

## 7. Sharing With Classmates
- Each friend signs up for their own StudyNest account
- The notebook owner clicks **Share** → enters the friend's username → picks Read or Edit
- Friends see shared notebooks under "Shared with me"
- Edit permission lets friends create, edit, and delete pages within that notebook

## 8. Troubleshooting
- Frontend can't reach backend:
  - Check the backend is running on port 5000
  - Vite proxies `/api/*` to `http://localhost:5000` automatically
- AI features show "Could not reach Ollama":
  - Run `ollama serve` in a separate terminal
  - Confirm `ollama list` shows your model
  - Visit http://localhost:5000/api/ai/health
- AI responses are slow on the first call:
  - The model loads into memory the first time — subsequent calls are faster
- Database issues:
  - Delete `backend/database.db` and restart the backend to reset
- Port already in use:
  - Change `FLASK_PORT` in `backend/.env`
  - Or change Vite's port in `frontend/vite.config.ts`
