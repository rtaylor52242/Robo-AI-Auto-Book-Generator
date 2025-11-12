export interface Chapter {
  title: string;
  content: string;
  status: 'pending' | 'generating' | 'done';
}

export type BookType = 'fiction' | 'non-fiction';

export interface BookHistoryEntry {
    id: string;
    title: string;
    assembledContent: string;
    timestamp: number;
    frontCoverImage?: string;
    backCoverImage?: string;
}