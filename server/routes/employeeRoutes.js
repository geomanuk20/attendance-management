import express from 'express';
import asyncHandler from 'express-async-handler';
import Employee from '../models/employeeModel.js';
import { ensureSeedData } from '../config/seedData.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Get all employees
// @route   GET /api/employees
// @access  Public
const getEmployees = asyncHandler(async (req, res) => {
    let employees = await Employee.find({});
    if (!employees || employees.length === 0) {
        await ensureSeedData();
        employees = await Employee.find({});
    }
    res.json(employees);
});

// @desc    Create a new employee
// @route   POST /api/employees
// @access  Public
const createEmployee = asyncHandler(async (req, res) => {
    const { name, email, password, phone, department, position, role, employeeCode, salary, hireDate, address, emergencyContact, ctc, basicSalary, hra, otherAllowances, faceImage, faceEmbedding, employmentType } = req.body;

    const employeeExists = await Employee.findOne({ email });

    if (employeeExists) {
        res.status(400);
        throw new Error('Employee already exists');
    }

    try {
        const parsedHireDate = hireDate && !isNaN(new Date(hireDate).getTime()) ? new Date(hireDate) : new Date();

        const employee = await Employee.create({
            name,
            email,
            password: password || 'welcome123',
            phone: phone || '',
            department: department || 'Management',
            position: position || 'Employee',
            role: role || 'employee',
            employeeCode: employeeCode || `WTN ${Math.floor(100 + Math.random() * 900)}`,
            salary: salary || 0,
            hireDate: parsedHireDate,
            address: address || '',
            emergencyContact: emergencyContact || '',
            ctc: ctc || 0,
            basicSalary: basicSalary || 0,
            hra: hra || 0,
            otherAllowances: otherAllowances || 0,
            faceImage: faceImage || '',
            faceEmbedding: faceEmbedding || [],
            employmentType: employmentType || 'Full-Time'
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

    if (!employee) {
        res.status(404);
        throw new Error('Employee not found');
    }

    const userId = req.user ? (req.user._id ? String(req.user._id) : (req.user.id ? String(req.user.id) : '')) : '';
    const isSelf = Boolean(userId && userId === String(req.params.id));
    const isAdminOrHr = !req.user || (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.role === 'hr'));

    // Save face biometric photo & embedding if provided
    if (req.body.faceImage !== undefined) {
        employee.faceImage = req.body.faceImage;
    }
    if (req.body.faceEmbedding !== undefined) {
        employee.faceEmbedding = req.body.faceEmbedding;
    }
    if (req.body.phone !== undefined) employee.phone = req.body.phone;
    if (req.body.address !== undefined) employee.address = req.body.address;
    if (req.body.emergencyContact !== undefined) employee.emergencyContact = req.body.emergencyContact;

    // Update all employee details if Admin/HR or unauthenticated request
    if (isAdminOrHr) {
        if (req.body.name) employee.name = req.body.name;
        if (req.body.email) employee.email = req.body.email;
        if (req.body.department) employee.department = req.body.department;
        if (req.body.position) employee.position = req.body.position;
        if (req.body.role) employee.role = req.body.role;
        if (req.body.employmentType !== undefined) employee.employmentType = req.body.employmentType;
        if (req.body.employeeCode !== undefined) employee.employeeCode = req.body.employeeCode;
        if (req.body.salary !== undefined) employee.salary = req.body.salary;
        if (req.body.status) employee.status = req.body.status;
        if (req.body.hireDate) {
            const parsedDate = new Date(req.body.hireDate);
            if (!isNaN(parsedDate.getTime())) {
                employee.hireDate = parsedDate;
            }
        }
        if (req.body.ctc !== undefined) employee.ctc = req.body.ctc;
        if (req.body.basicSalary !== undefined) employee.basicSalary = req.body.basicSalary;
        if (req.body.hra !== undefined) employee.hra = req.body.hra;
        if (req.body.otherAllowances !== undefined) employee.otherAllowances = req.body.otherAllowances;
    }

    const updatedEmployee = await employee.save();
    res.json(updatedEmployee);
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

// @desc    Download Official Salary Slip Document
// @route   GET /api/employees/download-slip
// @access  Public
const downloadSalarySlip = asyncHandler(async (req, res) => {
    const name = req.query.name || 'Employee';
    const employeeCode = req.query.employeeCode || 'WTN 025';
    const position = req.query.position || 'Technical Head';
    const department = req.query.department || 'Management';
    const employmentType = req.query.employmentType || 'Full-Time';
    const salary = parseInt(req.query.salary || '35000', 10);
    const month = req.query.month || 'July 2026';

    const basic = Math.round(salary * 0.5);
    const hra = Math.round(salary * 0.25);
    const allowances = salary - basic - hra;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Whiteswan TV LLP - Official Salary Slip Document</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background: #0f172a; margin: 0; padding: 24px 12px; color: #0f172a; display: flex; justify-content: center; }
    .document-card { width: 100%; max-width: 600px; background: #ffffff; border-radius: 16px; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px; }
    .company-title { font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px; margin: 0 0 4px 0; }
    .company-address { font-size: 10px; color: #475569; line-height: 1.4; }
    .pdf-badge { background: #1e1b4b; padding: 8px 12px; border-radius: 6px; text-align: center; }
    .pdf-badge-sub { color: #818cf8; font-size: 9px; font-weight: bold; letter-spacing: 0.5px; }
    .pdf-badge-main { color: #ffffff; font-size: 11px; font-weight: 900; margin-top: 2px; }
    .info-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; background: #f8fafc; margin-bottom: 16px; }
    .info-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }
    .info-label { color: #475569; width: 40%; }
    .info-val { font-weight: 600; color: #0f172a; flex: 1; }
    .table-container { border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #0f172a; color: #ffffff; padding: 10px 12px; text-align: left; font-weight: bold; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #334155; }
    tr.gross-row { background: #f1f5f9; font-weight: bold; }
    tr.gross-row td { color: #0f172a; }
    .net-banner { background: #15803d; padding: 16px 20px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .net-title { color: #dcfce7; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    .net-amount { color: #ffffff; font-size: 24px; font-weight: 900; margin-top: 2px; }
    .paid-pill { background: #ffffff; color: #15803d; font-size: 10px; font-weight: bold; padding: 6px 12px; border-radius: 4px; letter-spacing: 0.5px; }
    .seal-row { border-top: 1px solid #cbd5e1; padding-top: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
    .seal-pill { border: 1.5px solid #16a34a; background: #f0fdf4; color: #15803d; font-weight: bold; font-size: 9px; padding: 4px 10px; border-radius: 50px; display: inline-block; }
    .seal-sub { font-size: 9px; color: #94a3b8; margin-top: 6px; }
    .signatory-box { text-align: right; }
    .signatory-title { font-size: 11px; font-weight: bold; color: #0f172a; font-style: italic; }
    .signatory-sub { font-size: 9px; color: #64748b; margin-top: 2px; }
    @media print {
      body { background: #ffffff !important; padding: 0 !important; }
      .document-card { box-shadow: none !important; border: none !important; max-width: 100% !important; border-radius: 0 !important; padding: 0 !important; }
    }
  </style>
</head>
<body onload="window.print()">
  <div class="document-card">
    <div class="header-row">
      <div>
        <h1 class="company-title">WHITESWAN TV LLP</h1>
        <div class="company-address">
          1/3, Malamel Center, Club Junction, Edappally.P.O, Ernakulam, Kerala<br/>
          Email: contact@whiteswantv.com • Phone: +91 484 2800100
        </div>
      </div>
      <div class="pdf-badge">
        <div class="pdf-badge-sub">FORM 16 / SLIP</div>
        <div class="pdf-badge-main">OFFICIAL PDF</div>
      </div>
    </div>
    <div class="info-box">
      <div class="info-row"><div class="info-label">Employee Name:</div><div class="info-val" style="font-weight:bold;">${name}</div></div>
      <div class="info-row"><div class="info-label">Designation:</div><div class="info-val">${position}</div></div>
      <div class="info-row"><div class="info-label">Department:</div><div class="info-val">${department}</div></div>
      <div class="info-row"><div class="info-label">Employment Type:</div><div class="info-val" style="color:#059669; font-weight:bold;">${employmentType}</div></div>
      <div class="info-row"><div class="info-label">Employee ID:</div><div class="info-val">${employeeCode}</div></div>
      <div class="info-row"><div class="info-label">Pay Period:</div><div class="info-val" style="color:#4338ca; font-weight:bold;">${month}</div></div>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Earnings Description</th>
            <th style="text-align:right;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Basic Salary</td><td style="text-align:right; font-weight:500;">₹${basic.toLocaleString('en-IN')}</td></tr>
          <tr><td>House Rent Allowance (HRA)</td><td style="text-align:right; font-weight:500;">₹${hra.toLocaleString('en-IN')}</td></tr>
          <tr><td>Special Allowance</td><td style="text-align:right; font-weight:500;">₹${allowances.toLocaleString('en-IN')}</td></tr>
          <tr class="gross-row"><td>Gross Salary Payable</td><td style="text-align:right;">₹${salary.toLocaleString('en-IN')}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="net-banner">
      <div>
        <div class="net-title">TOTAL NET REMITTANCE</div>
        <div class="net-amount">₹${salary.toLocaleString('en-IN')}</div>
      </div>
      <div class="paid-pill">DISBURSED / PAID</div>
    </div>
    <div class="seal-row">
      <div>
        <div class="seal-pill">✓ WHITESWAN CORPORATE SEAL</div>
        <div class="seal-sub">Digitally Signed & Verified Document</div>
      </div>
      <div class="signatory-box">
        <div class="signatory-title">Whiteswan HR & Payroll</div>
        <div class="signatory-sub">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const sanitizeName = name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Whiteswan_Salary_Slip_${sanitizeName}_${month.replace(/[^a-zA-Z0-9]/g, '_')}.html`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(html);
});

router.route('/').get(getEmployees).post(protect, admin, createEmployee);
router.route('/download-slip').get(downloadSalarySlip);
router.route('/names').get(protect, getEmployeeNames);
router.route('/:id').put(protect, updateEmployee).delete(protect, admin, deleteEmployee);
router.route('/:id/preferences').patch(updatePreferences);

export default router;
