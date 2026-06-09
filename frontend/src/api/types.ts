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
