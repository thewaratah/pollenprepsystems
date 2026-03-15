export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: DocumentSource[];
  createdAt: Date;
}

export interface DocumentSource {
  id: string;
  filename: string;
  category: string;
  chunk: string;
  similarity: number;
}

export interface ChatSession {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}
