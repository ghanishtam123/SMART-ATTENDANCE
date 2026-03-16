import logger from '../config/logger';
import { HTTP_STATUS } from '../constants/http';
import { SessionStatus } from '../constants/session';
import AttendanceEventModel from '../models/AttendanceEvent.model';
import SessionModel from '../models/Session.model';
import StudentModel from '../models/Student.model';
import UnknownFaceAlertModel from '../models/UnknownFaceAlert.model';
import { RecognitionBatchPayload } from '../types/ai.types';
import { AppError } from '../utils/AppError';

interface IngestionSummary {
  sessionId: string;
  cameraId: string;
  totalEvents: number;
  recognizedEvents: number;
  unknownEvents: number;
  acceptedAt: string;
  note: string;
}

export const aiRecognitionService = {
  ingestRecognitionEvents: async (
    payload: RecognitionBatchPayload,
  ): Promise<IngestionSummary> => {
    const session = (await SessionModel.findById(payload.sessionId)
      .select('_id status cameraIds')
      .lean()) as {
      _id: unknown;
      status: SessionStatus;
      cameraIds: string[];
    } | null;

    if (!session) {
      throw new AppError('Session not found.', HTTP_STATUS.NOT_FOUND);
    }

    if (
      session.status === SessionStatus.COMPLETED ||
      session.status === SessionStatus.ARCHIVED
    ) {
      throw new AppError(
        'Cannot ingest recognition events for a completed or archived session.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (
      session.cameraIds.length > 0 &&
      !session.cameraIds.includes(payload.cameraId)
    ) {
      throw new AppError(
        'cameraId is not assigned to the given session.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const recognizedStudentIds = [
      ...new Set(
        payload.events
          .filter((event) => !event.isUnknown && event.studentId !== null)
          .map((event) => event.studentId as string),
      ),
    ];

    if (recognizedStudentIds.length > 0) {
      const studentCount = await StudentModel.countDocuments({
        _id: { $in: recognizedStudentIds },
      });

      if (studentCount !== recognizedStudentIds.length) {
        throw new AppError(
          'One or more studentId values are invalid.',
          HTTP_STATUS.BAD_REQUEST,
        );
      }
    }

    const recognizedEvents = payload.events.filter(
      (event) => !event.isUnknown,
    ).length;
    const unknownEvents = payload.events.length - recognizedEvents;

    await AttendanceEventModel.insertMany(
      payload.events.map((event) => ({
        sessionId: payload.sessionId,
        cameraId: payload.cameraId,
        studentId: event.studentId,
        isUnknown: event.isUnknown,
        confidence: event.confidence,
        eventTimestamp: new Date(event.timestamp),
        boundingBox: event.boundingBox ?? undefined,
        source: 'ai_service' as const,
        processed: false,
        metadata: event.metadata,
      })),
    );

    if (unknownEvents > 0) {
      await UnknownFaceAlertModel.insertMany(
        payload.events
          .filter((event) => event.isUnknown)
          .map((event) => ({
            sessionId: payload.sessionId,
            cameraId: payload.cameraId,
            detectedAt: new Date(event.timestamp),
            confidence: event.confidence,
            snapshotRef: null,
            reviewed: false,
            notes: null,
          })),
      );
    }

    logger.info(
      {
        sessionId: payload.sessionId,
      cameraId: payload.cameraId,
      totalEvents: payload.events.length,
      recognizedEvents,
      unknownEvents,
      storedAttendanceEvents: payload.events.length,
      createdUnknownFaceAlerts: unknownEvents,
      },
      'AI recognition event batch received.',
    );

    return {
      sessionId: payload.sessionId,
      cameraId: payload.cameraId,
      totalEvents: payload.events.length,
      recognizedEvents,
      unknownEvents,
      acceptedAt: new Date().toISOString(),
      note: 'Recognition events validated and stored successfully. Unknown detections were logged as reviewable alerts.',
    };
  },
};
