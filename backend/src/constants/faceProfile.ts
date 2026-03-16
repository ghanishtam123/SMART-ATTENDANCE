export enum FaceRegistrationStatus {
  PENDING = 'pending',
  REGISTERED = 'registered',
  FAILED = 'failed',
}

export const FACE_REGISTRATION_STATUS_VALUES = Object.values(
  FaceRegistrationStatus,
);
