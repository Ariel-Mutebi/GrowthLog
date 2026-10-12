export interface HistoryReport {
  canUndo: boolean;
  canRedo: boolean;
}

export interface ImageUploaded {
  src: string;
  width?: number;
  height?: number;
}
