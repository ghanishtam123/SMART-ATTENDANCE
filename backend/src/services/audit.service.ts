import type { Request } from 'express';
import { Types } from 'mongoose';

import logger from '../config/logger';
import AuditLogModel from '../models/AuditLog.model';

export interface AuditContext {
  actorUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface AuditLogInput extends AuditContext {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

const toObjectIdOrNull = (value?: string | null): Types.ObjectId | null => {
  if (!value || !Types.ObjectId.isValid(value)) {
    return null;
  }

  return new Types.ObjectId(value);
};

const compactMetadata = (
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  if (!metadata) {
    return undefined;
  }

  const filteredEntries = Object.entries(metadata).filter(
    ([, value]) => value !== undefined,
  );

  return filteredEntries.length > 0 ? Object.fromEntries(filteredEntries) : undefined;
};

export const buildAuditContext = (req: Request): AuditContext => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ipAddress =
    typeof forwardedFor === 'string'
      ? forwardedFor.split(',')[0].trim()
      : req.ip || null;

  return {
    actorUserId: req.user?.userId ?? null,
    ipAddress: ipAddress || null,
    userAgent: req.get('user-agent')?.trim() || null,
  };
};

export const auditService = {
  logAction: async (input: AuditLogInput): Promise<void> => {
    try {
      await AuditLogModel.create({
        actorUserId: toObjectIdOrNull(input.actorUserId),
        action: input.action.trim(),
        entityType: input.entityType.trim(),
        entityId: input.entityId?.trim() || null,
        metadata: compactMetadata(input.metadata),
        ipAddress: input.ipAddress?.trim() || null,
        userAgent: input.userAgent?.trim() || null,
        timestamp: input.timestamp ?? new Date(),
      });
    } catch (error) {
      logger.error(
        {
          err: error,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
        },
        'Failed to persist audit log entry.',
      );
    }
  },
};
