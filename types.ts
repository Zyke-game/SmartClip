export interface Clip {
  id: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  title: string;
  description: string;
  reasoning: string;
}

export interface AnalysisResult {
  clips: Clip[];
  markdownSummary: string;
  videoTitle: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  READING_FILE = 'READING_FILE',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  name: string;
  url: string;
}