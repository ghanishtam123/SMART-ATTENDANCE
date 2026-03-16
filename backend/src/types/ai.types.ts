export interface RecognitionBoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RecognitionEventPayload {
  studentId: string | null;
  isUnknown: boolean;
  confidence: number;
  timestamp: string;
  boundingBox?: RecognitionBoundingBox;
  metadata?: Record<string, unknown>;
}

export interface RecognitionBatchPayload {
  sessionId: string;
  cameraId: string;
  events: RecognitionEventPayload[];
}
