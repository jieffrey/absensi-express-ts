import express from 'express';
import authRoutes from './src/modules/auth/auth.routes';
import employeeRoutes from './src/modules/employee/employee.routes'
import departmentRoutes from './src/modules/department/department.routes';
import positionRoutes from './src/modules/position/position.routes';
import shiftRoutes from './src/modules/shift/shift.routes';
import locationRoutes from './src/modules/location/location.routes';
import workingDayPatternRoutes from './src/modules/schedule/workingDayPattern.routes';
import employeeScheduleRoutes from './src/modules/schedule/employeeSchedule.routes';
import attendanceRoutes from './src/modules/attendance/attendance.routes';


const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/positions', positionRoutes);
app.use('/api/v1/shifts', shiftRoutes);
app.use('/api/v1/locations', locationRoutes);
app.use('/api/v1/working-day-patterns', workingDayPatternRoutes);
app.use('/api/v1/schedules', employeeScheduleRoutes);
app.use('/api/v1/attendance', attendanceRoutes);


export default app;