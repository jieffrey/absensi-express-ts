import express from 'express';
import authRoutes from './src/modules/auth/auth.routes';
import employeeRoutes from './src/modules/employee/employee.routes'
import departmentRoutes from './src/modules/department/department.routes';
import positionRoutes from './src/modules/position/position.routes';

const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/positions', positionRoutes);


export default app;