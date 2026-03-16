import { HydratedDocument, Schema, Types, model, models } from 'mongoose';

export interface AttendanceEvent {
  sessionId: Types.ObjectId;
  cameraId: string;
  studentId: Types.ObjectId | null;
  isUnknown: boolean;
  confidence: number;
  eventTimestamp: Date;
  boundingBox?: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
  source: 'ai_service';
  processed: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type AttendanceEventDocument = HydratedDocument<AttendanceEvent>;

const attendanceEventSchema = new Schema<AttendanceEvent>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    cameraId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
      index: true,
    },
    isUnknown: {
      type: Boolean,
      required: true,
      index: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    eventTimestamp: {
      type: Date,
      required: true,
      index: true,
    },
    boundingBox: {
      x: { type: Number, required: false },
      y: { type: Number, required: false },
      w: { type: Number, required: false },
      h: { type: Number, required: false },
    },
    source: {
      type: String,
      required: true,
      default: 'ai_service',
      enum: ['ai_service'],
    },
    processed: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret.__v;
        ret.sessionId = ret.sessionId ? String(ret.sessionId) : null;
        ret.studentId = ret.studentId ? String(ret.studentId) : null;
        return ret;
      },
    },
  },
);

attendanceEventSchema.index({ sessionId: 1, eventTimestamp: -1 });
attendanceEventSchema.index({ sessionId: 1, studentId: 1, eventTimestamp: -1 });
attendanceEventSchema.index({ cameraId: 1, eventTimestamp: -1 });
attendanceEventSchema.index({ processed: 1, eventTimestamp: 1 });

const AttendanceEventModel =
  models.AttendanceEvent ||
  model<AttendanceEvent>('AttendanceEvent', attendanceEventSchema);

export default AttendanceEventModel;
