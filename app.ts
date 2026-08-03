import express from 'express';
import authRoutes from './src/modules/auth/auth.routes';
import employeeRoutes from './src/modules/employee/employee.routes'

const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/employees', employeeRoutes);


export default app;