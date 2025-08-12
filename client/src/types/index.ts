export interface Message {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{type: string, text?: string, image_data?: string}>;
  model: 'gpt-4o' | 'gpt-4o-mini' | 'llama-4-maverick';
  timestamp: string;
  loading?: boolean;
}

export type ModelType = 'gpt-4o' | 'gpt-4o-mini' | 'llama-4-maverick';

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  title: string;
  url: string;
  description?: string;
  source?: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface DocumentMetadata {
  filename: string;
  fileType: string;
  fileSize: number;
  pageCount?: number;
  wordCount?: number;
}

export interface DocumentProcessingResult {
  success: boolean;
  content?: string;
  metadata?: DocumentMetadata;
  error?: string;
}