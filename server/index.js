import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';

dotenv.config();

connectDB();

const app = express();

import employeeRoutes from './routes/employeeRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import leaveRequestRoutes from './routes/leaveRequestRoutes.js';
import payrollRoutes from './routes/payrollRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import authRoutes from './routes/authRoutes.js';

app.use(cors());
app.use(express.json());

app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaverequests', leaveRequestRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.send('API is running...');
});

import { notFound, errorHandler } from './middleware/errorMiddleware.js';

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
