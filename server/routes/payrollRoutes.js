import express from 'express';
import asyncHandler from 'express-async-handler';
import Payroll from '../models/payrollModel.js';
import Employee from '../models/employeeModel.js';

const router = express.Router();

// @desc    Get all payroll records or filter by month
// @route   GET /api/payroll
// @access  Public
const getPayroll = asyncHandler(async (req, res) => {
    const { month } = req.query;
    let query = {};
    if (month) {
        query.month = month;
    }
    const payrolls = await Payroll.find(query).populate('employeeId', 'name department position');
    res.json(payrolls);
});

// @desc    Create/Process payroll record
// @route   POST /api/payroll
// @access  Public
const createPayroll = asyncHandler(async (req, res) => {
    const { employeeId, month, baseSalary, overtime, bonus, deductions, netSalary, status, basicSalary, hra, otherAllowances } = req.body;

    // Check if payroll already exists for this employee and month
    const existingPayroll = await Payroll.findOne({ employeeId, month });

    if (existingPayroll) {
        existingPayroll.baseSalary = baseSalary;
        existingPayroll.basicSalary = basicSalary;
        existingPayroll.hra = hra;
        existingPayroll.otherAllowances = otherAllowances;
        existingPayroll.overtime = overtime;
        existingPayroll.bonus = bonus;
        existingPayroll.deductions = deductions;
        existingPayroll.netSalary = netSalary;
        existingPayroll.status = status;
        if (status === 'Paid') {
            existingPayroll.paymentDate = Date.now();
        }

        const updatedPayroll = await existingPayroll.save();
        res.json(updatedPayroll);
    } else {
        const payroll = await Payroll.create({
            employeeId,
            month,
            baseSalary,
            basicSalary,
            hra,
            otherAllowances,
            overtime,
            bonus,
            deductions,
            netSalary,
            status,
            paymentDate: status === 'Paid' ? Date.now() : undefined,
        });
        res.status(201).json(payroll);
    }
});

router.route('/').get(getPayroll).post(createPayroll);

export default router;
