import { HydratedDocument, Schema, Types, model, models } from 'mongoose';

import {
  FACE_REGISTRATION_STATUS_VALUES,
  FaceRegistrationStatus,
} from '../constants/faceProfile';

export interface FaceProfile {
  studentId: Types.ObjectId;
  embeddingVersion: string;
  embeddingCount: number;
  registrationStatus: FaceRegistrationStatus;
  registeredAt: Date | null;
  lastUpdatedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type FaceProfileDocument = HydratedDocument<FaceProfile>;

const faceProfileSchema = new Schema<FaceProfile>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      unique: true,
    },
    embeddingVersion: {
      type: String,
      required: true,
      trim: true,
    },
    embeddingCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    registrationStatus: {
      type: String,
      enum: FACE_REGISTRATION_STATUS_VALUES,
      default: FaceRegistrationStatus.PENDING,
      index: true,
    },
    registeredAt: {
      type: Date,
      default: null,
    },
    lastUpdatedAt: {
      type: Date,
      default: null,
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
        ret.studentId = ret.studentId ? String(ret.studentId) : null;
        return ret;
      },
    },
  },
);

faceProfileSchema.index({ registrationStatus: 1, updatedAt: -1 });
faceProfileSchema.index({ embeddingVersion: 1 });

const FaceProfileModel =
  models.FaceProfile || model<FaceProfile>('FaceProfile', faceProfileSchema);

export default FaceProfileModel;
