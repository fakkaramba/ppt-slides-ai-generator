export interface Slide {
  title: string;
  content: string[];
  speakerNotes: string;
  imageUrl?: string;
}

export enum ViewMode {
  EDITOR = 'EDITOR',
  PLAYER = 'PLAYER',
}