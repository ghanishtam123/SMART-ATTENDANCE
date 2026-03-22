import { Router } from 'express';

import aiRoutes from './ai.routes';
import alertRoutes from './alert.routes';
import analyticsRoutes from './analytics.routes';
import attendanceRoutes from './attendance.routes';
import authRoutes from './auth.routes';
import classGroupRoutes from './classGroup.routes';
import classroomRoutes from './classroom.routes';
import faceProfileRoutes from './faceProfile.routes';
import liveRoutes from './live.routes';
import sessionRoutes from './session.routes';
import studentRoutes from './student.routes';
import studentPortalRoutes from './studentPortal.routes';
import subjectRoutes from './subject.routes';
import teacherRoutes from './teacher.routes';
import timetableRoutes from './timetable.routes';
import userRoutes from './user.routes';
import { ApiResponse } from '../utils/ApiResponse';

const router = Router();

router.get('/', (_req, res) => {
  return ApiResponse.success(res, {
    message: 'Smart attendance API foundation is available.',
    data: {
      version: 'v1',
      status: 'ready',
    },
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/ai', aiRoutes);
router.use('/alerts', alertRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/live', liveRoutes);
router.use('/students', studentRoutes);
router.use('/student-portal', studentPortalRoutes);
router.use('/face-profiles', faceProfileRoutes);
router.use('/teachers', teacherRoutes);
router.use('/classrooms', classroomRoutes);
router.use('/class-groups', classGroupRoutes);
router.use('/subjects', subjectRoutes);
router.use('/sessions', sessionRoutes);
router.use('/timetable', timetableRoutes);

export default router;
