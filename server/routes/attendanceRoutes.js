import express from 'express';
import asyncHandler from 'express-async-handler';
import Attendance from '../models/attendanceModel.js';

const router = express.Router();

// @desc    Get all attendance records (optionally filter by employeeId or date)
// @route   GET /api/attendance
// @access  Public
const getTodayDateStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const getAttendance = asyncHandler(async (req, res) => {
    const { employeeId, date } = req.query;
    let query = {};

    if (employeeId) {
        query.employeeId = employeeId;
    }
    if (date) {
        query.date = date; // Expects simplified date string "YYYY-MM-DD"
    }

    const attendance = await Attendance.find(query).sort({ date: -1, createdAt: -1 }).populate('employeeId', 'name department employeeCode role position');
    res.json(attendance);
});

// @desc    Clock In
// @route   POST /api/attendance/clockin
// @access  Public
const clockIn = asyncHandler(async (req, res) => {
    const { employeeId } = req.body;
    const date = getTodayDateStr();

    // Check if already clocked in for today
    const existingRecord = await Attendance.findOne({ employeeId, date });
    if (existingRecord) {
        res.status(400);
        throw new Error('Already clocked in for today');
    }

    const attendance = await Attendance.create({
        employeeId,
        date,
        clockIn: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
        status: 'Present',
    });

    const populated = await Attendance.findById(attendance._id).populate('employeeId', 'name department employeeCode role position');
    res.status(201).json(populated || attendance);
});

// @desc    Clock Out
// @route   POST /api/attendance/clockout
// @access  Public
const clockOut = asyncHandler(async (req, res) => {
    const { employeeId } = req.body;
    const date = getTodayDateStr();

    const attendance = await Attendance.findOne({ employeeId, date });

    if (attendance) {
        const clockOutTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
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
            const hrs = diffMins > 0 ? parseFloat((diffMins / 60).toFixed(2)) : 0;
            attendance.workHours = hrs;
            if (hrs > 0 && hrs < 5) {
                attendance.status = 'Half-Day';
            }
        } catch (e) {
            attendance.workHours = 0;
        }

        await attendance.save();
        const populated = await Attendance.findById(attendance._id).populate('employeeId', 'name department employeeCode role position');
        res.json(populated || attendance);
    } else {
        res.status(404);
        throw new Error('No clock-in record found for today');
    }
});

// @desc    Update attendance record (Admin)
// @route   PUT /api/attendance/:id
// @access  Public
const updateAttendance = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { clockIn, clockOut, status, workHours, date, employeeId } = req.body;

    let attendance = null;
    if (id && !id.startsWith('gen_')) {
        try {
            attendance = await Attendance.findById(id);
        } catch (e) {
            attendance = null;
        }
    }

    if (!attendance && employeeId && date) {
        attendance = await Attendance.findOne({ employeeId, date });
    }

    if (!attendance && employeeId && date) {
        attendance = new Attendance({
            employeeId,
            date,
            status: status || 'Present'
        });
    }

    if (!attendance) {
        res.status(400);
        throw new Error('Attendance record not found');
    }

    if (status !== undefined) attendance.status = status;
    if (clockIn !== undefined) attendance.clockIn = clockIn;
    if (clockOut !== undefined) attendance.clockOut = clockOut;

    if (attendance.clockIn && attendance.clockOut && attendance.clockOut !== '-') {
        try {
            const toMinutes = (timeStr) => {
                if (!timeStr || timeStr === '-') return null;
                const parts = timeStr.trim().split(' ');
                if (parts.length < 2) return null;
                let [h, m] = parts[0].split(':').map(Number);
                const period = parts[1].toUpperCase();
                if (period === 'PM' && h !== 12) h += 12;
                if (period === 'AM' && h === 12) h = 0;
                return h * 60 + m;
            };
            const inMins = toMinutes(attendance.clockIn);
            const outMins = toMinutes(attendance.clockOut);
            if (inMins !== null && outMins !== null && outMins > inMins) {
                const diffMins = outMins - inMins;
                const hrs = parseFloat((diffMins / 60).toFixed(2));
                attendance.workHours = hrs;
                if (hrs > 0 && hrs < 5 && (!status || status === 'Present' || status === 'Attendance')) {
                    attendance.status = 'Half-Day';
                }
            }
        } catch (e) {}
    }

    await attendance.save();
    const populated = await Attendance.findById(attendance._id).populate('employeeId', 'name department employeeCode role position');
    res.json(populated || attendance);
});

router.route('/').get(getAttendance);
router.post('/clockin', clockIn);
router.post('/clockout', clockOut);
router.put('/:id', updateAttendance);
router.post('/update', updateAttendance);

export default router;
