import express from 'express';
import asyncHandler from 'express-async-handler';
import Employee from '../models/employeeModel.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Get all employees
// @route   GET /api/employees
// @access  Public
const getEmployees = asyncHandler(async (req, res) => {
    const employees = await Employee.find({});
    res.json(employees);
});

// @desc    Create a new employee
// @route   POST /api/employees
// @access  Public
const createEmployee = asyncHandler(async (req, res) => {
    const { name, email, password, phone, department, position, role, salary, hireDate, address, emergencyContact, ctc, basicSalary, hra, otherAllowances } = req.body;

    const employeeExists = await Employee.findOne({ email });

    if (employeeExists) {
        res.status(400);
        throw new Error('Employee already exists');
    }

    try {
        const employee = await Employee.create({
            name,
            email,
            password,
            phone,
            department,
            position,
            role,
            salary,
            hireDate: new Date(hireDate), // Ensure valid date
            address,
            emergencyContact,
            ctc,
            basicSalary,
            hra,
            otherAllowances
        });

        res.status(201).json(employee);
    } catch (error) {
        console.error('Error creating employee:', error);
        res.status(400);
        throw new Error(error.message || 'Invalid employee data');
    }
});

// @desc    Update an employee
// @route   PUT /api/employees/:id
// @access  Public
const updateEmployee = asyncHandler(async (req, res) => {
    const employee = await Employee.findById(req.params.id);

    if (employee) {
        employee.name = req.body.name || employee.name;
        employee.email = req.body.email || employee.email;
        employee.phone = req.body.phone || employee.phone;
        employee.department = req.body.department || employee.department;
        employee.position = req.body.position || employee.position;
        employee.role = req.body.role || employee.role;
        employee.salary = req.body.salary || employee.salary;
        employee.status = req.body.status || employee.status; // Allow status update
        employee.hireDate = req.body.hireDate || employee.hireDate;
        employee.address = req.body.address || employee.address;
        employee.emergencyContact = req.body.emergencyContact || employee.emergencyContact;
        employee.ctc = req.body.ctc || employee.ctc;
        employee.basicSalary = req.body.basicSalary || employee.basicSalary;
        employee.hra = req.body.hra || employee.hra;
        employee.otherAllowances = req.body.otherAllowances || employee.otherAllowances;

        const updatedEmployee = await employee.save();
        res.json(updatedEmployee);
    } else {
        res.status(404);
        throw new Error('Employee not found');
    }
});

// @desc    Delete an employee
// @route   DELETE /api/employees/:id
// @access  Public
const deleteEmployee = asyncHandler(async (req, res) => {
    const employee = await Employee.findById(req.params.id);

    if (employee) {
        await employee.deleteOne();
        res.json({ message: 'Employee removed' });
    } else {
        res.status(404);
        throw new Error('Employee not found');
    }
});

const updatePreferences = asyncHandler(async (req, res) => {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
        res.status(404);
        throw new Error('Employee not found');
    }
    const { darkMode, currency } = req.body;
    if (typeof darkMode === 'boolean') {
        employee.darkMode = darkMode;
    }
    if (typeof currency === 'string') {
        employee.currency = currency;
    }
    await employee.save();
    res.json({ darkMode: employee.darkMode, currency: employee.currency });
});

// @desc    Get all employee names/ids (for dropdowns)
// @route   GET /api/employees/names
// @access  Any logged-in user
const getEmployeeNames = asyncHandler(async (req, res) => {
    const employees = await Employee.find({}).select('_id name department').sort({ name: 1 });
    res.json(employees);
});

router.route('/').get(protect, admin, getEmployees).post(protect, admin, createEmployee);
router.route('/names').get(protect, getEmployeeNames);
router.route('/:id').put(protect, admin, updateEmployee).delete(protect, admin, deleteEmployee);
router.route('/:id/preferences').patch(updatePreferences);

export default router;
