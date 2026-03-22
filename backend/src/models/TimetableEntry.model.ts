import { HydratedDocument, Schema, Types, model, models } from 'mongoose';

import {
  TIMETABLE_DAY_OF_WEEK_VALUES,
  TimetableDayOfWeek,
} from '../constants/timetable';

export interface TimetableEntry {
  classGroupId: Types.ObjectId;
  subjectId: Types.ObjectId;
  teacherId: Types.ObjectId;
  classroomId: Types.ObjectId;
  dayOfWeek: TimetableDayOfWeek;
  startTime: string;
  endTime: string;
  cameraIds: string[];
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type TimetableEntryDocument = HydratedDocument<TimetableEntry>;

const timetableEntrySchema = new Schema<TimetableEntry>(
  {
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
    dayOfWeek: {
      type: String,
      enum: TIMETABLE_DAY_OF_WEEK_VALUES,
      required: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    cameraIds: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
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
        ret.classGroupId = ret.classGroupId ? String(ret.classGroupId) : null;
        ret.subjectId = ret.subjectId ? String(ret.subjectId) : null;
        ret.teacherId = ret.teacherId ? String(ret.teacherId) : null;
        ret.classroomId = ret.classroomId ? String(ret.classroomId) : null;
        return ret;
      },
    },
  },
);

timetableEntrySchema.index({ dayOfWeek: 1, startTime: 1, isActive: 1 });
timetableEntrySchema.index({ classGroupId: 1, dayOfWeek: 1, startTime: 1 });
timetableEntrySchema.index({ teacherId: 1, dayOfWeek: 1, startTime: 1 });
timetableEntrySchema.index({ classroomId: 1, dayOfWeek: 1, startTime: 1 });

const TimetableEntryModel =
  models.TimetableEntry ||
  model<TimetableEntry>('TimetableEntry', timetableEntrySchema);

export default TimetableEntryModel;
