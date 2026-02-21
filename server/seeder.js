import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import Employee from './models/employeeModel.js';

dotenv.config();

connectDB();

const importData = async () => {
    try {
        await Employee.deleteMany();

        const superAdmin = {
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
        };

        const hrUser = {
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
        };

        const sampleEmployee = {
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
        };

        await Employee.create(superAdmin);
        await Employee.create(hrUser);
        await Employee.create(sampleEmployee);

        console.log('Data Imported!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

const destroyData = async () => {
    try {
        await Employee.deleteMany();

        console.log('Data Destroyed!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

if (process.argv[2] === '-d') {
    destroyData();
} else {
    importData();
}
