import express from 'express';
import asyncHandler from 'express-async-handler';
import nodemailer from 'nodemailer';
import Employee from '../models/employeeModel.js';

const router = express.Router();

// @desc    Send payslip via email
// @route   POST /api/email/send-payslip
// @access  Public (should be protected in prod)
const sendPayslip = asyncHandler(async (req, res) => {
    const { employeeId, month, salaryDetails } = req.body;

    // Validate request
    if (!employeeId || !month || !salaryDetails) {
        res.status(400);
        throw new Error('Missing required fields');
    }

    // Fetch employee email
    const employee = await Employee.findById(employeeId);
    if (!employee || !employee.email) {
        res.status(404);
        throw new Error('Employee not found or email missing');
    }

    // Configure transporter (Mock or Real based on env)
    // In a real app, these should be in .env
    const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    // Check if credentials exist, else warn
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('Email credentials missing in .env. Email will not be sent.');
        return res.status(200).json({ message: 'Email simulation successful (Credentials missing)' });
    }

    // Verify connection configuration
    try {
        await transporter.verify();
        console.log("SMTP Connection verified");
    } catch (error) {
        console.error("SMTP Connection Error:", error);
        res.status(500);
        throw new Error(`Email Server Connection Failed: ${error.message}`);
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: employee.email,
        subject: `Payslip for ${new Date(month).toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Payslip for ${new Date(month).toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                <p>Hello ${employee.name},</p>
                <p>Here is your salary breakdown for this month:</p>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Basic Salary</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${salaryDetails.basicSalary}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>HRA</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${salaryDetails.hra}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Allowances</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${salaryDetails.otherAllowances}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Overtime</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${salaryDetails.overtime}</td>
                    </tr>
                     <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Bonus</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${salaryDetails.bonus}</td>
                    </tr>
                    <tr style="background-color: #fee;">
                         <td style="padding: 10px; border: 1px solid #ddd;"><strong>Deductions</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">-${salaryDetails.deductions}</td>
                    </tr>
                    <tr style="background-color: #333; color: white;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Net Pay</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>${salaryDetails.netSalary}</strong></td>
                    </tr>
                </table>

                <p style="margin-top: 20px;">Regards,<br/>HR Department</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Payslip sent successfully' });
    } catch (error) {
        console.error('Email send error:', error);
        res.status(500);
        throw new Error('Failed to send email');
    }
});

router.post('/send-payslip', sendPayslip);

export default router;
