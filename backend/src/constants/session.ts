export enum SessionStatus {
  CREATED = 'created',
  STARTED = 'started',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export const SESSION_STATUS_VALUES = Object.values(SessionStatus);

export const ACTIVE_SESSION_STATUSES: SessionStatus[] = [
  SessionStatus.STARTED,
  SessionStatus.ACTIVE,
];
