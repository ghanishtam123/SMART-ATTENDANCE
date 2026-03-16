import { HydratedDocument, Schema, Types, model, models } from 'mongoose';

import {
  ATTENDANCE_STATUS_VALUES,
  AttendanceStatus,
} from '../constants/attendance';

export interface AttendanceRecord {
  sessionId: Types.ObjectId;
  studentId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectId: Types.ObjectId;
  teacherId: Types.ObjectId;
  status: AttendanceStatus;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  totalPresenceMinutes: number;
  attendancePercentageInSession: number;
  confidenceAverage: number | null;
  eventCount: number;
  remarks: string | null;
  finalizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AttendanceRecordDocument = HydratedDocument<AttendanceRecord>;

const attendanceRecordSchema = new Schema<AttendanceRecord>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
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
    status: {
      type: String,
      enum: ATTENDANCE_STATUS_VALUES,
      required: true,
      index: true,
    },
    firstSeenAt: {
      type: Date,
      default: null,
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
    totalPresenceMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    attendancePercentageInSession: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    confidenceAverage: {
      type: Number,
      default: null,
      min: 0,
      max: 1,
    },
    eventCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    remarks: {
      type: String,
      trim: true,
      default: null,
    },
    finalizedAt: {
      type: Date,
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
        ret.studentId = ret.studentId ? String(ret.studentId) : null;
        ret.classGroupId = ret.classGroupId ? String(ret.classGroupId) : null;
        ret.subjectId = ret.subjectId ? String(ret.subjectId) : null;
        ret.teacherId = ret.teacherId ? String(ret.teacherId) : null;
        return ret;
      },
    },
  },
);

attendanceRecordSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });
attendanceRecordSchema.index({ sessionId: 1, status: 1 });
attendanceRecordSchema.index({ studentId: 1, finalizedAt: -1 });
attendanceRecordSchema.index({ teacherId: 1, finalizedAt: -1 });
attendanceRecordSchema.index({ classGroupId: 1, finalizedAt: -1 });
attendanceRecordSchema.index({ subjectId: 1, finalizedAt: -1 });

const AttendanceRecordModel =
  models.AttendanceRecord ||
  model<AttendanceRecord>('AttendanceRecord', attendanceRecordSchema);

export default AttendanceRecordModel;
