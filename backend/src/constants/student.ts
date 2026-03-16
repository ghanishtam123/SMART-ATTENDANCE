export enum StudentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum StudentGender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export const STUDENT_STATUS_VALUES = Object.values(StudentStatus);
export const STUDENT_GENDER_VALUES = Object.values(StudentGender);
