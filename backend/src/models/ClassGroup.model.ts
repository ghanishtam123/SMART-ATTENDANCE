import { HydratedDocument, Schema, model, models } from 'mongoose';

export interface ClassGroup {
  name: string;
  code: string;
  department: string;
  semester: number;
  section: string;
  academicYear: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ClassGroupDocument = HydratedDocument<ClassGroup>;

const classGroupSchema = new Schema<ClassGroup>(
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
    department: {
      type: String,
      required: true,
      trim: true,
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
    },
    section: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    academicYear: {
      type: String,
      required: true,
      trim: true,
    },
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

classGroupSchema.index({
  department: 1,
  semester: 1,
  section: 1,
  academicYear: 1,
});
classGroupSchema.index({
  isActive: 1,
  department: 1,
  semester: 1,
  academicYear: 1,
});

const ClassGroupModel =
  models.ClassGroup ||
  model<ClassGroup>('ClassGroup', classGroupSchema);

export default ClassGroupModel;
