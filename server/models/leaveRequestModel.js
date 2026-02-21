import mongoose from 'mongoose';

const leaveRequestSchema = mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Employee',
    },
    leaveType: {
        type: String,
        required: true,
    },
    startDate: {
        type: Date,
        required: true,
    },
    endDate: {
        type: Date,
        required: true,
    },
    reason: {
        type: String,
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending',
    }
}, {
    timestamps: true,
});

const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);

export default LeaveRequest;
