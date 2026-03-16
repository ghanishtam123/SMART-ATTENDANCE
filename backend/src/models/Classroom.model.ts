import { HydratedDocument, Schema, model, models } from 'mongoose';

export interface Classroom {
  name: string;
  code: string;
  building: string;
  floor: string;
  capacity: number;
  cameraIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ClassroomDocument = HydratedDocument<Classroom>;

const classroomSchema = new Schema<Classroom>(
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
    building: {
      type: String,
      required: true,
      trim: true,
    },
    floor: {
      type: String,
      required: true,
      trim: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    cameraIds: {
      type: [String],
      default: [],
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

classroomSchema.index({ building: 1, isActive: 1 });
classroomSchema.index({ cameraIds: 1 });

const ClassroomModel =
  models.Classroom || model<Classroom>('Classroom', classroomSchema);

export default ClassroomModel;
