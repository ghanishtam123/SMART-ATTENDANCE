import { HydratedDocument, Schema, Types, model, models } from 'mongoose';

export interface TeacherProfile {
  userId: Types.ObjectId;
  employeeId: string;
  department: string;
  designation: string;
  subjectsTaught: Types.ObjectId[];
  assignedClassGroups: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export type TeacherProfileDocument = HydratedDocument<TeacherProfile>;

const teacherProfileSchema = new Schema<TeacherProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    subjectsTaught: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Subject',
      },
    ],
    assignedClassGroups: [
      {
        type: Schema.Types.ObjectId,
        ref: 'ClassGroup',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret.__v;
        ret.userId = ret.userId ? String(ret.userId) : null;
        return ret;
      },
    },
  },
);

teacherProfileSchema.index({ department: 1, designation: 1 });
teacherProfileSchema.index({ subjectsTaught: 1 });
teacherProfileSchema.index({ assignedClassGroups: 1 });

const TeacherProfileModel =
  models.TeacherProfile ||
  model<TeacherProfile>('TeacherProfile', teacherProfileSchema);

export default TeacherProfileModel;
