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
    const normalizedEmail = (email || '').toLowerCase().trim();

    if (!normalizedEmail || !password) {
        res.status(400);
        throw new Error('Please enter email and password');
    }

    if (mongoose.connection.readyState === 1) {
        await ensureSeedUsers();

        const employee = await Employee.findOne({ email: new RegExp(`^${normalizedEmail}$`, 'i') });

        if (employee) {
            const isMatch = await employee.matchPassword(password);
            if (!isMatch) {
                res.status(401);
                throw new Error('Invalid email or password');
            }

            const empCode = employee.employeeCode || (employee._id ? `EMP-${employee._id.toString().substring(0, 6).toUpperCase()}` : 'EMP-101');
            return res.json({
                _id: employee._id.toString(),
                id: employee._id.toString(),
                name: employee.name,
                email: employee.email,
                role: employee.role,
                position: employee.position,
                department: employee.department,
                employeeCode: empCode,
                salary: employee.salary,
                faceImage: employee.faceImage || '',
                hireDate: employee.hireDate || employee.createdAt,
                darkMode: employee.darkMode || false,
                token: generateToken(employee._id),
            });
        }
    }

    res.status(401);
    throw new Error('Invalid email or password');
}));

// @desc    Get all employees with enrolled face profiles for Quick Face ID Login
// @route   GET /api/auth/enrolled-faces
// @access  Public
router.get('/enrolled-faces', asyncHandler(async (req, res) => {
    if (mongoose.connection.readyState === 1) {
        await ensureSeedUsers();
        const employees = await Employee.find({ faceImage: { $exists: true, $ne: '' } })
            .select('_id name email role position department employeeCode faceImage faceEmbedding')
            .lean();
        return res.json(employees);
    }
    res.json([]);
}));

// @desc    Auth user via biometric face login
// @route   POST /api/auth/face-login
// @access  Public
router.post('/face-login', asyncHandler(async (req, res) => {
    const { employeeId, email } = req.body;

    if (!employeeId && !email) {
        res.status(400);
        throw new Error('Employee identifier required for Face Login');
    }

    if (mongoose.connection.readyState === 1) {
        let employee = null;
        if (employeeId && mongoose.Types.ObjectId.isValid(employeeId)) {
            employee = await Employee.findById(employeeId);
        }
        if (!employee && email) {
            employee = await Employee.findOne({ email: new RegExp(`^${email.trim()}$`, 'i') });
        }

        if (employee) {
            const empCode = employee.employeeCode || (employee._id ? `EMP-${employee._id.toString().substring(0, 6).toUpperCase()}` : 'EMP-101');
            return res.json({
                _id: employee._id.toString(),
                id: employee._id.toString(),
                name: employee.name,
                email: employee.email,
                role: employee.role,
                position: employee.position,
                department: employee.department,
                employeeCode: empCode,
                salary: employee.salary,
                faceImage: employee.faceImage || '',
                hireDate: employee.hireDate || employee.createdAt,
                darkMode: employee.darkMode || false,
                token: generateToken(employee._id),
            });
        }
    }

    res.status(404);
    throw new Error('Enrolled employee profile not found');
}));

export default router;
