import { HydratedDocument, Schema, Types, model, models } from 'mongoose';

export interface UnknownFaceAlert {
  sessionId: Types.ObjectId;
  cameraId: string;
  detectedAt: Date;
  confidence: number;
  snapshotRef: string | null;
  reviewed: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UnknownFaceAlertDocument = HydratedDocument<UnknownFaceAlert>;

const unknownFaceAlertSchema = new Schema<UnknownFaceAlert>(
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
    detectedAt: {
      type: Date,
      required: true,
      index: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    snapshotRef: {
      type: String,
      trim: true,
      default: null,
    },
    reviewed: {
      type: Boolean,
      default: false,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret.__v;
        ret.sessionId = ret.sessionId ? String(ret.sessionId) : null;
        return ret;
      },
    },
  },
);

unknownFaceAlertSchema.index({ sessionId: 1, detectedAt: -1 });
unknownFaceAlertSchema.index({ sessionId: 1, reviewed: 1, detectedAt: -1 });
unknownFaceAlertSchema.index({ cameraId: 1, detectedAt: -1 });
unknownFaceAlertSchema.index({ reviewed: 1, detectedAt: -1 });

const UnknownFaceAlertModel =
  models.UnknownFaceAlert ||
  model<UnknownFaceAlert>('UnknownFaceAlert', unknownFaceAlertSchema);

export default UnknownFaceAlertModel;
