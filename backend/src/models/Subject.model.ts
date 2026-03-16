import { HydratedDocument, Schema, Types, model, models } from 'mongoose';

export interface Subject {
  name: string;
  code: string;
  description: string;
  creditHours: number | null;
  assignedTeacherIds: Types.ObjectId[];
  classGroupIds: Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type SubjectDocument = HydratedDocument<Subject>;

const subjectSchema = new Schema<Subject>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    creditHours: {
      type: Number,
      min: 0,
      default: null,
    },
    assignedTeacherIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'TeacherProfile',
      },
    ],
    classGroupIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'ClassGroup',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret.__v;
        return ret;
      },
    },
  },
);

subjectSchema.index({ name: 1, isActive: 1 });
subjectSchema.index({ assignedTeacherIds: 1 });
subjectSchema.index({ classGroupIds: 1 });

const SubjectModel = models.Subject || model<Subject>('Subject', subjectSchema);

export default SubjectModel;
