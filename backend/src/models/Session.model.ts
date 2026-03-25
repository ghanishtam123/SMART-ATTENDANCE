import { HydratedDocument, Schema, Types, model, models } from 'mongoose';

import {
  SESSION_STATUS_VALUES,
  SessionStatus,
} from '../constants/session';

export interface Session {
  title: string | null;
  timetableEntryId?: Types.ObjectId | null;
  classGroupId: Types.ObjectId;
  subjectId: Types.ObjectId;
  teacherId: Types.ObjectId;
  classroomId: Types.ObjectId;
  cameraIds: string[];
  scheduledDate: Date;
  scheduledStartTime: string;
  scheduledEndTime: string;
  actualStartTime: Date | null;
  actualEndTime: Date | null;
  graceMinutesForLate: number;
  minimumPresenceMinutes: number;
  minimumPresencePercentage: number;
  status: SessionStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SessionDocument = HydratedDocument<Session>;

const sessionSchema = new Schema<Session>(
  {
    title: {
      type: String,
      trim: true,
      default: null,
    },
    timetableEntryId: {
      type: Schema.Types.ObjectId,
      ref: 'TimetableEntry',
      default: null,
      index: true,
    },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'ClassGroup',
      required: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'TeacherProfile',
      required: true,
      index: true,
    },
    classroomId: {
      type: Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true,
      index: true,
    },
    cameraIds: {
      type: [String],
      default: [],
    },
    scheduledDate: {
      type: Date,
      required: true,
      index: true,
    },
    scheduledStartTime: {
      type: String,
      required: true,
      trim: true,
    },
    scheduledEndTime: {
      type: String,
      required: true,
      trim: true,
    },
    actualStartTime: {
      type: Date,
      default: null,
    },
    actualEndTime: {
      type: Date,
      default: null,
    },
    graceMinutesForLate: {
      type: Number,
      required: true,
      min: 0,
    },
    minimumPresenceMinutes: {
      type: Number,
      required: true,
      min: 0,
    },
    minimumPresencePercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: SESSION_STATUS_VALUES,
      default: SessionStatus.CREATED,
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
        ret.timetableEntryId = ret.timetableEntryId
          ? String(ret.timetableEntryId)
          : null;
        ret.classGroupId = ret.classGroupId ? String(ret.classGroupId) : null;
        ret.subjectId = ret.subjectId ? String(ret.subjectId) : null;
        ret.teacherId = ret.teacherId ? String(ret.teacherId) : null;
        ret.classroomId = ret.classroomId ? String(ret.classroomId) : null;
        return ret;
      },
    },
  },
);

sessionSchema.index({ scheduledDate: 1, status: 1 });
sessionSchema.index({ teacherId: 1, scheduledDate: 1 });
sessionSchema.index({ classGroupId: 1, scheduledDate: 1 });
sessionSchema.index({ subjectId: 1, scheduledDate: 1 });
sessionSchema.index({ classroomId: 1, status: 1 });
sessionSchema.index({ cameraIds: 1 });
sessionSchema.index({ timetableEntryId: 1, scheduledDate: 1 });

const SessionModel = models.Session || model<Session>('Session', sessionSchema);

export default SessionModel;
