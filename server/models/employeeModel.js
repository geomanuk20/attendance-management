import mongoose from 'mongoose';

const employeeSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    phone: {
        type: String,
        required: true,
    },
    department: {
        type: String,
        required: true,
    },
    position: {
        type: String,
        required: true,
    },
    salary: {
        type: Number,
        required: true,
    },
    ctc: {
        type: Number,
        required: true,
        default: 0
    },
    basicSalary: {
        type: Number,
        required: true,
        default: 0
    },
    hra: {
        type: Number,
        required: true,
        default: 0
    },
    otherAllowances: {
        type: Number,
        required: true,
        default: 0
    },
    status: {
        type: String,
        required: true,
        default: 'Active',
    },
    hireDate: {
        type: Date,
        required: true,
    },
    address: {
        type: String,
    },
    emergencyContact: {
        type: String,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        required: true,
        default: 'employee',
        enum: ['superadmin', 'hr', 'employee', 'admin']
    },
    darkMode: {
        type: Boolean,
        default: false,
    },
    currency: {
        type: String,
        default: 'USD',
    }
}, {
    timestamps: true,
});

import bcrypt from 'bcryptjs';

employeeSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

employeeSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const Employee = mongoose.model('Employee', employeeSchema);

export default Employee;
