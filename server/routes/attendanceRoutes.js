import express from 'express';
import asyncHandler from 'express-async-handler';
import Attendance from '../models/attendanceModel.js';

const router = express.Router();

// @desc    Get all attendance records (optionally filter by employeeId or date)
// @route   GET /api/attendance
// @access  Public
const getAttendance = asyncHandler(async (req, res) => {
    const { employeeId, date } = req.query;
    let query = {};

    if (employeeId) {
        query.employeeId = employeeId;
    }
    if (date) {
        query.date = date; // Expects simplified date string "YYYY-MM-DD"
    }

    const attendance = await Attendance.find(query).populate('employeeId', 'name department');
    res.json(attendance);
});

// @desc    Clock In
// @route   POST /api/attendance/clockin
// @access  Public
const clockIn = asyncHandler(async (req, res) => {
    const { employeeId } = req.body;
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if already clocked in for today
    const existingRecord = await Attendance.findOne({ employeeId, date });
    if (existingRecord) {
        res.status(400);
        throw new Error('Already clocked in for today');
    }

    const attendance = await Attendance.create({
        employeeId,
        date,
        clockIn: new Date().toLocaleTimeString(),
        status: 'Present',
    });

    res.status(201).json(attendance);
});

// @desc    Clock Out
// @route   POST /api/attendance/clockout
// @access  Public
const clockOut = asyncHandler(async (req, res) => {
    const { employeeId } = req.body;
    const date = new Date().toISOString().split('T')[0];

    const attendance = await Attendance.findOne({ employeeId, date });

    if (attendance) {
        const clockOutTime = new Date().toLocaleTimeString();
        attendance.clockOut = clockOutTime;

        // Calculate work hours from clockIn and clockOut
        try {
            const toMinutes = (timeStr) => {
                const [time, period] = timeStr.split(' ');
                let [h, m, s] = time.split(':').map(Number);
                if (period === 'PM' && h !== 12) h += 12;
                if (period === 'AM' && h === 12) h = 0;
                return h * 60 + m;
            };
            const inMins = toMinutes(attendance.clockIn);
            const outMins = toMinutes(clockOutTime);
            const diffMins = outMins - inMins;
            attendance.workHours = diffMins > 0 ? parseFloat((diffMins / 60).toFixed(2)) : 0;
        } catch (e) {
            attendance.workHours = 0;
        }

        await attendance.save();
        res.json(attendance);
    } else {
        res.status(404);
        throw new Error('No clock-in record found for today');
    }
});

router.route('/').get(getAttendance);
router.post('/clockin', clockIn);
router.post('/clockout', clockOut);

export default router;
