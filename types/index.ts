export interface User {
  id: number;
  username: string;
  display_name: string;
  is_guest?: boolean;
}

export interface Notebook {
  id: number;
  owner_id: number;
  title: string;
  description: string;
  color: string;
  icon: string;
  is_pinned?: 0 | 1;
  created_at: string;
  updated_at: string;
  permission?: "owner" | "edit" | "read";
  owner_name?: string;
  pages?: PageSummary[];
}

export interface PageSummary {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Page {
  id: number;
  notebook_id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  permission?: "owner" | "edit" | "read";
  tags?: Tag[];
}

export interface Share {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  permission: "read" | "edit";
}

export interface Attachment {
  id: number;
  notebook_id: number;
  original_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

export interface FlashcardSet {
  id: number;
  notebook_id: number;
  title: string;
  card_count: number;
  created_at: string;
}

export interface Flashcard {
  id: number;
  set_id: number;
  front: string;
  back: string;
  position: number;
  next_review?: string | null;
  ease_factor?: number;
  interval_days?: number;
  repetitions?: number;
}

export interface FlashcardSetWithCards extends FlashcardSet {
  cards: Flashcard[];
}

export interface Flowchart {
  id: number;
  notebook_id: number;
  title: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  id: number;
  title: string;
  notebook_id: number;
  preview: string;
  updated_at: string;
  notebook_title: string;
  notebook_icon: string;
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  usage_count?: number;
}

export interface PageVersion {
  id: number;
  saved_at: string;
  title: string;
  saved_by_name: string;
  word_count: number;
}

export interface PageVersionFull extends PageVersion {
  content: string;
}

export interface Notification {
  id: number;
  type: "share" | "chat" | string;
  title: string;
  body: string;
  data: string;
  is_read: 0 | 1;
  created_at: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

export interface QuizAttempt {
  id: number;
  notebook_id: number;
  score: number;
  total: number;
  created_at: string;
}

export interface ReviewCard extends Flashcard {
  set_title: string;
  notebook_id: number;
}

export interface StudyStats {
  total_study_seconds: number;
  today_study_seconds: number;
  cards_due: number;
  quiz_avg_score: number | null;
  streak_days: number;
}
