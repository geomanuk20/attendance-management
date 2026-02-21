import mongoose from 'mongoose';

const attendanceSchema = mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Employee',
    },
    date: {
        type: String, // Storing as YYYY-MM-DD for simpler querying
        required: true,
    },
    clockIn: {
        type: String, // Storing time string e.g., "09:00 AM" or ISO timestamp
    },
    clockOut: {
        type: String,
    },
    status: {
        type: String,
        enum: ['Present', 'Absent', 'Late', 'Half Day'],
        default: 'Absent',
    },
    workHours: {
        type: Number,
        default: 0,
    }
}, {
    timestamps: true,
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
