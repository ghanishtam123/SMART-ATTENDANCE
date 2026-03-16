import { HydratedDocument, Schema, Types, model, models } from 'mongoose';

import {
  STUDENT_GENDER_VALUES,
  STUDENT_STATUS_VALUES,
  StudentGender,
  StudentStatus,
} from '../constants/student';

export interface Student {
  firstName: string;
  lastName: string;
  rollNumber: string;
  email: string | null;
  phone: string | null;
  gender: StudentGender | null;
  classGroupId: Types.ObjectId;
  status: StudentStatus;
  faceProfileId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type StudentDocument = HydratedDocument<Student>;

const studentSchema = new Schema<Student>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    rollNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    gender: {
      type: String,
      enum: STUDENT_GENDER_VALUES,
      default: null,
    },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'ClassGroup',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: STUDENT_STATUS_VALUES,
      default: StudentStatus.ACTIVE,
      index: true,
    },
    faceProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'FaceProfile',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret.__v;
        ret.classGroupId = ret.classGroupId ? String(ret.classGroupId) : null;
        ret.faceProfileId = ret.faceProfileId ? String(ret.faceProfileId) : null;
        return ret;
      },
    },
  },
);

studentSchema.index({ classGroupId: 1, status: 1 });

const StudentModel = models.Student || model<Student>('Student', studentSchema);

export default StudentModel;
