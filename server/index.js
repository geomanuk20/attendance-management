import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from './config/db.js';

dotenv.config();

connectDB();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import employeeRoutes from './routes/employeeRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import leaveRequestRoutes from './routes/leaveRequestRoutes.js';
import payrollRoutes from './routes/payrollRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import authRoutes from './routes/authRoutes.js';

app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaverequests', leaveRequestRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/auth', authRoutes);

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../build')));

    app.get(/^(?!\/api).*/, (req, res) =>
        res.sendFile(path.resolve(__dirname, '../', 'build', 'index.html'))
    );
} else {
    app.get('/', (req, res) => {
        res.send('API is running...');
    });
}

import { notFound, errorHandler } from './middleware/errorMiddleware.js';

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (accessible on local network at http://192.168.1.5:${PORT})`);
});

server.on('error', (err) => {
    console.error(`Server Error on port ${PORT}:`, err.message);
});
