import StudentModel from '../models/Student.model';
import FaceProfileModel from '../models/FaceProfile.model';
import { HTTP_STATUS } from '../constants/http';
import { FaceRegistrationStatus } from '../constants/faceProfile';
import { AppError } from '../utils/AppError';

interface UpsertFaceProfilePayload {
  studentId: string;
  embeddingVersion: string;
  embeddingCount: number;
  registrationStatus: FaceRegistrationStatus;
  registeredAt?: Date | null;
  lastUpdatedAt?: Date | null;
  notes?: string | null;
}

export const faceProfileService = {
  getFaceProfileByStudentId: async (studentId: string): Promise<unknown> => {
    const faceProfile = await FaceProfileModel.findOne({ studentId });

    if (!faceProfile) {
      throw new AppError('Face profile not found.', HTTP_STATUS.NOT_FOUND);
    }

    return faceProfile.toJSON();
  },

  upsertFaceProfile: async (payload: UpsertFaceProfilePayload): Promise<unknown> => {
    const student = await StudentModel.findById(payload.studentId);

    if (!student) {
      throw new AppError('Student not found.', HTTP_STATUS.NOT_FOUND);
    }

    const faceProfile = await FaceProfileModel.findOneAndUpdate(
      { studentId: payload.studentId },
      {
        $set: {
          embeddingVersion: payload.embeddingVersion.trim(),
          embeddingCount: payload.embeddingCount,
          registrationStatus: payload.registrationStatus,
          registeredAt:
            payload.registrationStatus === FaceRegistrationStatus.REGISTERED
              ? payload.registeredAt ?? new Date()
              : payload.registeredAt ?? null,
          lastUpdatedAt: payload.lastUpdatedAt ?? new Date(),
          notes: payload.notes ?? null,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    student.faceProfileId = faceProfile._id;
    await student.save();

    return faceProfile.toJSON();
  },
};
