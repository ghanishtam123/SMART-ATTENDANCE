import { FilterQuery } from 'mongoose';

import { HTTP_STATUS } from '../constants/http';
import UnknownFaceAlertModel, {
  UnknownFaceAlert,
} from '../models/UnknownFaceAlert.model';
import { PaginatedResult, RequestAuditContext } from '../types/common.types';
import { AppError } from '../utils/AppError';
import {
  buildPaginationMeta,
  getPaginationOptions,
} from '../utils/pagination';
import { auditService } from './audit.service';

interface UnknownFaceAlertListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sessionId?: string;
  cameraId?: string;
  reviewed?: boolean;
}

interface ReviewUnknownFaceAlertPayload {
  notes?: string;
}

const getUnknownFaceAlertOrThrow = async (id: string) => {
  const alert = await UnknownFaceAlertModel.findById(id);

  if (!alert) {
    throw new AppError('Unknown face alert not found.', HTTP_STATUS.NOT_FOUND);
  }

  return alert;
};

export const alertService = {
  listUnknownFaceAlerts: async (
    query: UnknownFaceAlertListQuery,
  ): Promise<PaginatedResult<unknown>> => {
    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);
    const filter: FilterQuery<UnknownFaceAlert> = {};

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { cameraId: searchRegex },
        { snapshotRef: searchRegex },
        { notes: searchRegex },
      ];
    }

    if (query.sessionId) {
      filter.sessionId = query.sessionId;
    }

    if (query.cameraId) {
      filter.cameraId = query.cameraId;
    }

    if (query.reviewed !== undefined) {
      filter.reviewed = query.reviewed;
    }

    const [alerts, totalItems] = await Promise.all([
      UnknownFaceAlertModel.find(filter)
        .sort({ reviewed: 1, detectedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      UnknownFaceAlertModel.countDocuments(filter),
    ]);

    return {
      items: alerts.map((alert) => alert.toJSON()),
      meta: buildPaginationMeta(totalItems, page, limit),
    };
  },

  markUnknownFaceAlertReviewed: async (
    id: string,
    payload: ReviewUnknownFaceAlertPayload,
    auditContext?: RequestAuditContext,
  ): Promise<unknown> => {
    const alert = await getUnknownFaceAlertOrThrow(id);

    alert.reviewed = true;

    if (payload.notes !== undefined) {
      alert.notes = payload.notes.trim() || null;
    }

    await alert.save();
    await auditService.logAction({
      ...auditContext,
      action: 'alert.review',
      entityType: 'unknown_face_alert',
      entityId: alert.id,
      metadata: {
        sessionId: String(alert.sessionId),
        cameraId: alert.cameraId,
        reviewed: alert.reviewed,
      },
    });

    return alert.toJSON();
  },
};
