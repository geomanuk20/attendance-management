import Employee from '../models/employeeModel.js';
import Attendance from '../models/attendanceModel.js';
import LeaveRequest from '../models/leaveRequestModel.js';
import Payroll from '../models/payrollModel.js';

export const ensureSeedData = async () => {
    try {
        const empCount = await Employee.countDocuments();
        if (empCount === 0) {
            console.log('🌱 No employees found in DB. Auto-seeding full demo database...');
            
            const seedEmployees = [
                {
                    name: 'Super Admin',
                    email: 'admin@company.com',
                    password: 'supersecret',
                    role: 'superadmin',
                    phone: '0000000000',
                    department: 'Management',
                    position: 'CEO',
                    employeeCode: 'WTN 001',
                    salary: 100000,
                    ctc: 1200000,
                    basicSalary: 60000,
                    hra: 24000,
                    otherAllowances: 16000,
                    hireDate: new Date('2024-01-01'),
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
                    employeeCode: 'WTN 002',
                    salary: 50000,
                    ctc: 600000,
                    basicSalary: 30000,
                    hra: 12000,
                    otherAllowances: 8000,
                    hireDate: new Date('2024-02-15'),
                    status: 'Active'
                },
                {
                    name: 'Akhil',
                    email: 'akhil@company.com',
                    password: 'employee123',
                    role: 'employee',
                    phone: '9876543210',
                    department: 'Engineering',
                    position: 'Lead Software Engineer',
                    employeeCode: 'WTN 003',
                    salary: 75000,
                    ctc: 900000,
                    basicSalary: 45000,
                    hra: 18000,
                    otherAllowances: 12000,
                    hireDate: new Date('2024-03-01'),
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
                    employeeCode: 'WTN 004',
                    salary: 45000,
                    ctc: 540000,
                    basicSalary: 27000,
                    hra: 10800,
                    otherAllowances: 7200,
                    hireDate: new Date('2024-04-10'),
                    status: 'Active'
                },
                {
                    name: 'John Doe',
                    email: 'john@company.com',
                    password: 'employee123',
                    role: 'employee',
                    phone: '9876501234',
                    department: 'Design',
                    position: 'UI/UX Designer',
                    employeeCode: 'WTN 005',
                    salary: 40000,
                    ctc: 480000,
                    basicSalary: 24000,
                    hra: 9600,
                    otherAllowances: 6400,
                    hireDate: new Date('2024-05-01'),
                    status: 'Active'
                }
            ];

            const createdEmps = await Employee.create(seedEmployees);
            console.log(`✅ ${createdEmps.length} Employees seeded successfully.`);

            // Seed Attendance for today
            const today = new Date().toISOString().split('T')[0];
            const attendanceRecords = createdEmps.map(emp => ({
                employeeId: emp._id,
                date: today,
                clockIn: '09:00:00 AM',
                clockOut: '06:00:00 PM',
                status: 'Present',
                workHours: 9.0
            }));

            await Attendance.create(attendanceRecords);
            console.log('✅ Seed attendance records created.');

            // Seed Payroll records
            const currentMonth = new Date().toISOString().slice(0, 7);
            const payrollRecords = createdEmps.map(emp => ({
                employeeId: emp._id,
                month: currentMonth,
                baseSalary: emp.salary || 50000,
                basicSalary: emp.basicSalary || 30000,
                hra: emp.hra || 12000,
                otherAllowances: emp.otherAllowances || 8000,
                overtime: 0,
                bonus: 2000,
                deductions: 1000,
                advance: 0,
                netSalary: (emp.salary || 50000) + 1000,
                status: 'Paid'
            }));

            await Payroll.create(payrollRecords);
            console.log('✅ Seed payroll records created.');
        } else {
            console.log(`📊 Database connected with ${empCount} employees ready.`);
        }
    } catch (err) {
        console.error('Auto-seed failed:', err.message);
    }
};
