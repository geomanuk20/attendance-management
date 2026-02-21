import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const attendanceSchema = mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    date: { type: String },
    status: { type: String }
});
const Attendance = mongoose.model('Attendance', attendanceSchema);

async function checkDates() {
    await mongoose.connect(process.env.MONGO_URI);
    const records = await Attendance.find().limit(5);
    console.log("DATES:");
    records.forEach(r => console.log(JSON.stringify(r.date)));
    process.exit(0);
}
checkDates();
