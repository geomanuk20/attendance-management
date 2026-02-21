import mongoose from 'mongoose';

const payrollSchema = mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Employee',
    },
    month: {
        type: String, // e.g., "2023-10" or "October 2023"
        required: true,
    },
    baseSalary: {
        type: Number,
        required: true,
    },
    basicSalary: {
        type: Number,
        default: 0
    },
    hra: {
        type: Number,
        default: 0
    },
    otherAllowances: {
        type: Number,
        default: 0
    },
    overtime: {
        type: Number,
        default: 0,
    },
    bonus: {
        type: Number,
        default: 0,
    },
    deductions: {
        type: Number,
        default: 0,
    },
    netSalary: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['Pending', 'Paid'],
        default: 'Pending',
    },
    paymentDate: {
        type: Date,
    }
}, {
    timestamps: true,
});

const Payroll = mongoose.model('Payroll', payrollSchema);

export default Payroll;
