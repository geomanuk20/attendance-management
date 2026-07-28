import express from 'express';
import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Employee from '../models/employeeModel.js';

const router = express.Router();

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
        expiresIn: '30d',
    });
};

const ensureSeedUsers = async () => {
    try {
        const count = await Employee.countDocuments();
        if (count === 0) {
            console.log('No employees found in DB. Auto-seeding initial users...');
            await Employee.create([
                {
                    name: 'Super Admin',
                    email: 'admin@company.com',
                    password: 'supersecret',
                    role: 'superadmin',
                    phone: '0000000000',
                    department: 'Management',
                    position: 'CEO',
                    salary: 100000,
                    hireDate: new Date(),
                    status: 'Active'
                },
                {
                    name: 'HR Manager',
                    email: 'hr@company.com',
                    password: 'hr123',
                    role: 'hr',
                    phone: '1234567890',
                    department: 'HR',
                    position: 'HR Manager',
                    salary: 50000,
                    hireDate: new Date(),
                    status: 'Active'
                },
                {
                    name: 'Jane Smith',
                    email: 'employee@company.com',
                    password: 'employee123',
                    role: 'employee',
                    phone: '0987654321',
                    department: 'Engineering',
                    position: 'Software Engineer',
                    salary: 4000,
                    hireDate: new Date(),
                    status: 'Active'
                }
            ]);
            console.log('Default users auto-seeded successfully!');
        }
    } catch (err) {
        console.error('Auto-seed failed:', err.message);
    }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (mongoose.connection.readyState !== 1) {
        res.status(503);
        throw new Error('Database is not connected. Please fix MONGO_URI in .env or start local MongoDB.');
    }

    await ensureSeedUsers();

    const normalizedEmail = (email || '').toLowerCase().trim();
    const employee = await Employee.findOne({ email: new RegExp(`^${normalizedEmail}$`, 'i') });

    if (employee && (await employee.matchPassword(password))) {
        const empCode = employee.employeeCode || (employee._id ? `EMP-${employee._id.toString().substring(0, 6).toUpperCase()}` : 'EMP-101');
        res.json({
            _id: employee._id,
            name: employee.name,
            email: employee.email,
            role: employee.role,
            position: employee.position,
            department: employee.department,
            employeeCode: empCode,
            salary: employee.salary,
            hireDate: employee.hireDate || employee.createdAt,
            darkMode: employee.darkMode,
            token: generateToken(employee._id),
        });
    } else {
        res.status(401);
        throw new Error('Invalid email or password');
    }
}));

export default router;
