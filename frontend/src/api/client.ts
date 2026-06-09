import axios, { AxiosError } from "axios";
import type { Notebook, Page, Share, User, SearchResult, Attachment, FlashcardSet, FlashcardSetWithCards, Flashcard, Flowchart } from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("studynest_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("studynest_token");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error || err.message || "Something went wrong";
  }
  return err instanceof Error ? err.message : "Something went wrong";
}

/* ---------- Auth ---------- */
export const authApi = {
  login: (username: string, password: string) =>
    api
      .post<{ token: string; user: User }>("/auth/login", { username, password })
      .then((r) => r.data),
  register: (username: string, password: string, display_name: string) =>
    api
      .post<{ token: string; user: User }>("/auth/register", {
        username,
        password,
        display_name,
      })
      .then((r) => r.data),
  logout: () => api.post("/auth/logout"),
  me: () => api.get<{ user: User }>("/auth/me").then((r) => r.data.user),
  guestLogin: () =>
    api
      .post<{ token: string; user: User }>("/auth/guest")
      .then((r) => r.data),
};

/* ---------- Notebooks ---------- */
export const notebookApi = {
  list: () =>
    api
      .get<{ owned: Notebook[]; shared: Notebook[] }>("/notebooks")
      .then((r) => r.data),
  get: (id: number) =>
    api.get<Notebook>(`/notebooks/${id}`).then((r) => r.data),
  create: (data: Partial<Notebook>) =>
    api.post<Notebook>("/notebooks", data).then((r) => r.data),
  update: (id: number, data: Partial<Notebook>) =>
    api.patch<Notebook>(`/notebooks/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/notebooks/${id}`),
};

/* ---------- Pages ---------- */
export const pageApi = {
  create: (notebookId: number, data: { title?: string; content?: string }) =>
    api
      .post<Page>(`/notebooks/${notebookId}/pages`, data)
      .then((r) => r.data),
  get: (id: number) => api.get<Page>(`/pages/${id}`).then((r) => r.data),
  update: (id: number, data: Partial<Page>) =>
    api.patch<Page>(`/pages/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/pages/${id}`),
  search: (q: string) =>
    api
      .get<{ results: SearchResult[] }>("/search", { params: { q } })
      .then((r) => r.data.results),
};

/* ---------- Shares ---------- */
export const shareApi = {
  list: (notebookId: number) =>
    api
      .get<{ shares: Share[] }>(`/notebooks/${notebookId}/shares`)
      .then((r) => r.data.shares),
  add: (notebookId: number, username: string, permission: "read" | "edit") =>
    api
      .post(`/notebooks/${notebookId}/shares`, { username, permission })
      .then((r) => r.data),
  remove: (notebookId: number, shareId: number) =>
    api.delete(`/notebooks/${notebookId}/shares/${shareId}`),
};

/* ---------- Files ---------- */
export const fileApi = {
  list: (notebookId: number) =>
    api
      .get<{ files: Attachment[] }>(`/notebooks/${notebookId}/files`)
      .then((r) => r.data.files),

  upload: (
    notebookId: number,
    file: File,
    onProgress?: (pct: number) => void
  ) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<Attachment>(`/notebooks/${notebookId}/files`, form, {
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded * 100) / e.total));
          }
        },
      })
      .then((r) => r.data);
  },

  remove: (fileId: number) => api.delete(`/files/${fileId}`),

  url: (fileId: number) => `/api/files/${fileId}`,
};

/* ---------- AI ---------- */
export const aiApi = {
  health: () => api.get("/ai/health").then((r) => r.data),
  summarize: (page_id: number) =>
    api
      .post<{ summary: string }>("/ai/summarize", { page_id })
      .then((r) => r.data.summary),
  quiz: (page_id: number, count = 5) =>
    api
      .post<{ quiz: string }>("/ai/quiz", { page_id, count })
      .then((r) => r.data.quiz),
  explain: (page_id: number, question: string) =>
    api
      .post<{ answer: string }>("/ai/explain", { page_id, question })
      .then((r) => r.data.answer),
  studyGuide: (notebook_id: number) =>
    api
      .post<{ guide: string }>("/ai/study-guide", { notebook_id })
      .then((r) => r.data.guide),
  generateFlashcards: (params: { page_id?: number; notebook_id?: number; count?: number }) =>
    api
      .post<{ cards: { front: string; back: string }[]; suggested_title: string; notebook_id: number }>(
        "/ai/flashcards",
        params
      )
      .then((r) => r.data),
  generateFlowchart: (params: { page_id?: number; description?: string; notebook_id?: number }) =>
    api
      .post<{ source: string; suggested_title: string; notebook_id: number }>(
        "/ai/flowchart",
        params
      )
      .then((r) => r.data),
};

/* ---------- Flashcards ---------- */
export const flashcardApi = {
  listSets: (notebookId: number) =>
    api
      .get<{ sets: FlashcardSet[] }>(`/notebooks/${notebookId}/flashcard-sets`)
      .then((r) => r.data.sets),
  createSet: (notebookId: number, title: string, cards: { front: string; back: string }[]) =>
    api
      .post<FlashcardSet>(`/notebooks/${notebookId}/flashcard-sets`, { title, cards })
      .then((r) => r.data),
  getSet: (setId: number) =>
    api.get<FlashcardSetWithCards>(`/flashcard-sets/${setId}`).then((r) => r.data),
  updateSet: (setId: number, title: string) =>
    api.patch<FlashcardSet>(`/flashcard-sets/${setId}`, { title }).then((r) => r.data),
  deleteSet: (setId: number) => api.delete(`/flashcard-sets/${setId}`),
  addCard: (setId: number, front: string, back: string) =>
    api.post<Flashcard>(`/flashcard-sets/${setId}/cards`, { front, back }).then((r) => r.data),
  updateCard: (cardId: number, front: string, back: string) =>
    api.patch<Flashcard>(`/flashcards/${cardId}`, { front, back }).then((r) => r.data),
  deleteCard: (cardId: number) => api.delete(`/flashcards/${cardId}`),
};

/* ---------- Flowcharts ---------- */
export const flowchartApi = {
  list: (notebookId: number) =>
    api
      .get<{ flowcharts: Flowchart[] }>(`/notebooks/${notebookId}/flowcharts`)
      .then((r) => r.data.flowcharts),
  create: (notebookId: number, title: string, source: string) =>
    api
      .post<Flowchart>(`/notebooks/${notebookId}/flowcharts`, { title, source })
      .then((r) => r.data),
  get: (chartId: number) =>
    api.get<Flowchart>(`/flowcharts/${chartId}`).then((r) => r.data),
  update: (chartId: number, data: { title?: string; source?: string }) =>
    api.patch<Flowchart>(`/flowcharts/${chartId}`, data).then((r) => r.data),
  remove: (chartId: number) => api.delete(`/flowcharts/${chartId}`),
};
