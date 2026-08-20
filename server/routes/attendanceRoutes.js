import express from 'express';
import asyncHandler from 'express-async-handler';
import Attendance from '../models/attendanceModel.js';
import CompanySettings from '../models/companySettingsModel.js';

const router = express.Router();

// Helper to get company timezone or request timezone (defaults to Asia/Kolkata)
const resolveTimezone = async (reqTimezone) => {
    if (reqTimezone && typeof reqTimezone === 'string' && reqTimezone.trim()) {
        try {
            // Verify if valid timezone
            Intl.DateTimeFormat(undefined, { timeZone: reqTimezone.trim() });
            return reqTimezone.trim();
        } catch {}
    }
    try {
        const settings = await CompanySettings.findOne();
        if (settings && settings.timezone) {
            return settings.timezone;
        }
    } catch {}
    return 'Asia/Kolkata';
};

const getTodayDateStr = (timeZone = 'Asia/Kolkata') => {
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        return formatter.format(new Date()); // Formats as YYYY-MM-DD
    } catch {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
};

const getNowTimeStr = (timeZone = 'Asia/Kolkata') => {
    try {
        return new Date().toLocaleTimeString('en-US', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    } catch {
        return new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    }
};

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

    const attendance = await Attendance.find(query).sort({ date: -1, createdAt: -1 }).populate('employeeId', 'name department employeeCode role position');
    res.json(attendance);
});

// @desc    Clock In
// @route   POST /api/attendance/clockin
// @access  Public
const clockIn = asyncHandler(async (req, res) => {
    const { employeeId, timezone: reqTimezone, date: reqDate, clockInTime, clockIn: clientClockIn } = req.body;
    const clientTimezone = reqTimezone || req.headers['x-timezone'];
    const timeZone = await resolveTimezone(clientTimezone);
    const date = reqDate || getTodayDateStr(timeZone);

    // Check if already clocked in for today
    const existingRecord = await Attendance.findOne({ employeeId, date });
    if (existingRecord) {
        res.status(400);
        throw new Error('Already clocked in for today');
    }

    const clockInVal = clientClockIn || clockInTime || getNowTimeStr(timeZone);

    const attendance = await Attendance.create({
        employeeId,
        date,
        clockIn: clockInVal,
        status: 'Present',
    });

    const populated = await Attendance.findById(attendance._id).populate('employeeId', 'name department employeeCode role position');
    res.status(201).json(populated || attendance);
});

// @desc    Clock Out
// @route   POST /api/attendance/clockout
// @access  Public
const clockOut = asyncHandler(async (req, res) => {
    const { employeeId, timezone: reqTimezone, date: reqDate, clockOutTime, clockOut: clientClockOut } = req.body;
    const clientTimezone = reqTimezone || req.headers['x-timezone'];
    const timeZone = await resolveTimezone(clientTimezone);
    const date = reqDate || getTodayDateStr(timeZone);

    let attendance = await Attendance.findOne({ employeeId, date });
    if (!attendance) {
        // Fallback: check for any open attendance log for this employee
        attendance = await Attendance.findOne({
            employeeId,
            $or: [{ clockOut: null }, { clockOut: '' }, { clockOut: '-' }, { clockOut: { $exists: false } }]
        }).sort({ date: -1, createdAt: -1 });
    }

    if (attendance) {
        const clockOutVal = clientClockOut || clockOutTime || getNowTimeStr(timeZone);
        attendance.clockOut = clockOutVal;

        // Calculate work hours from clockIn and clockOut
        try {
            const toSeconds = (timeStr) => {
                if (!timeStr || timeStr === '-' || timeStr === 'In progress') return null;
                const parts = String(timeStr).trim().split(/\s+/);
                if (parts.length < 1) return null;
                const timeSegments = parts[0].split(':').map(Number);
                if (timeSegments.some(isNaN)) return null;
                let h = timeSegments[0];
                const m = timeSegments[1] || 0;
                const s = timeSegments[2] || 0;
                const period = parts.length > 1 ? parts[1].toUpperCase() : null;
                if (period === 'PM' && h !== 12) h += 12;
                if (period === 'AM' && h === 12) h = 0;
                return h * 3600 + m * 60 + s;
            };

            // First check if createdAt is available to get exact elapsed time
            let calculatedHrs = null;
            if (attendance.createdAt) {
                const startMs = new Date(attendance.createdAt).getTime();
                const endMs = Date.now();
                if (!isNaN(startMs) && endMs > startMs) {
                    const diffSec = (endMs - startMs) / 1000;
                    if (diffSec > 0 && diffSec < 24 * 3600) {
                        calculatedHrs = parseFloat((diffSec / 3600).toFixed(4));
                    }
                }
            }

            if (calculatedHrs === null) {
                const inSec = toSeconds(attendance.clockIn);
                const outSec = toSeconds(clockOutVal);
                if (inSec !== null && outSec !== null) {
                    let diffSec = outSec - inSec;
                    if (diffSec < 0) diffSec += 24 * 3600; // Handle overnight / cross-midnight shift
                    calculatedHrs = parseFloat((diffSec / 3600).toFixed(4));
                }
            }

            attendance.workHours = calculatedHrs !== null ? calculatedHrs : 0;
            const hrs = attendance.workHours;

                // Lookup employee employmentType for Part-Time 4-hour rule
                const populatedEmp = await Attendance.findById(attendance._id).populate('employeeId', 'employmentType');
                const isPartTime = populatedEmp?.employeeId?.employmentType === 'Part-Time';
                const halfDayCutoff = isPartTime ? 2 : 4;

                if (hrs >= 4) {
                    attendance.status = 'Present'; // 4 hours complete is Full Day Present for all (including Part-Time)
                } else if (hrs >= halfDayCutoff && hrs < 4) {
                    attendance.status = 'Half-Day';
                } else if (hrs > 0 && hrs < halfDayCutoff) {
                    attendance.status = 'Half-Day';
                }
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
            const toSeconds = (timeStr) => {
                if (!timeStr || timeStr === '-' || timeStr === 'In progress') return null;
                const parts = String(timeStr).trim().split(/\s+/);
                if (parts.length < 1) return null;
                const timeSegments = parts[0].split(':').map(Number);
                if (timeSegments.some(isNaN)) return null;
                let h = timeSegments[0];
                const m = timeSegments[1] || 0;
                const s = timeSegments[2] || 0;
                const period = parts.length > 1 ? parts[1].toUpperCase() : null;
                if (period === 'PM' && h !== 12) h += 12;
                if (period === 'AM' && h === 12) h = 0;
                return h * 3600 + m * 60 + s;
            };
            const inSec = toSeconds(attendance.clockIn);
            const outSec = toSeconds(attendance.clockOut);
            if (inSec !== null && outSec !== null) {
                let diffSec = outSec - inSec;
                if (diffSec < 0) diffSec += 24 * 3600; // Handle overnight / cross-midnight shift
                const hrs = parseFloat((diffSec / 3600).toFixed(4));
                attendance.workHours = hrs;
                if (hrs > 0 && hrs < 4 && (!status || status === 'Present' || status === 'Attendance')) {
                    attendance.status = 'Half-Day';
                } else if (hrs >= 4 && (!status || status === 'Half-Day' || status === 'Half Day')) {
                    attendance.status = 'Present';
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
