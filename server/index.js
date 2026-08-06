import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
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
import appUpdateRoutes from './routes/appUpdateRoutes.js';
import companySettingsRoutes from './routes/companySettingsRoutes.js';

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaverequests', leaveRequestRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/auth', authRoutes);
app.use('/public', express.static(path.join(__dirname, '../public')));

app.get('/download/apk', (req, res) => {
    const apkPath = path.join(__dirname, '../public/app-release.apk');
    if (fs.existsSync(apkPath)) {
        res.download(apkPath, 'attendance-app.apk');
    } else {
        const rootApk = path.join(__dirname, '../attendance-app.apk');
        if (fs.existsSync(rootApk)) {
            res.download(rootApk, 'attendance-app.apk');
        } else {
            res.status(404).json({ message: 'APK file not found on server' });
        }
    }
});

const buildPath = path.join(__dirname, '../build');
if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));

    app.get(/^(?!\/api).*/, (req, res) =>
        res.sendFile(path.resolve(buildPath, 'index.html'))
    );
} else {
    app.get('/', (req, res) => {
        res.send('API is running...');
    });
}

import { notFound, errorHandler } from './middleware/errorMiddleware.js';

app.use(notFound);
app.use(errorHandler);

const startServer = (port) => {
    const server = app.listen(port, () => {
        console.log(`🚀 Backend Server running successfully on port ${port}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} is in use, auto-switching to port ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error(`Server Error on port ${port}:`, err.message);
        }
    });
};

const initialPort = parseInt(process.env.PORT || '5001', 10);
startServer(initialPort);
