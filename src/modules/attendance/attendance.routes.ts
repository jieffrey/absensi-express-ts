import { Router } from 'express';
import { clockIn, clockOut, myAttendance } from './attendance.controller';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();
router.post('/clock-in', authenticate, clockIn);
router.post('/clock-out', authenticate, clockOut);
router.get('/me', authenticate, myAttendance);

export default router;