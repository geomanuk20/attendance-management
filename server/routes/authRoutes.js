import express from 'express';
import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import Employee from '../models/employeeModel.js';

const router = express.Router();

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const employee = await Employee.findOne({ email });

    if (employee && (await employee.matchPassword(password))) {
        res.json({
            _id: employee._id,
            name: employee.name,
            email: employee.email,
            role: employee.role,
            position: employee.position,
            darkMode: employee.darkMode,
            token: generateToken(employee._id),
        });
    } else {
        res.status(401);
        throw new Error('Invalid email or password');
    }
}));

export default router;
