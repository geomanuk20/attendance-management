import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mtor_attendance';
        const conn = await mongoose.connect(mongoUri);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        
        // Attempt fallback to local MongoDB if remote connection fails
        if (process.env.MONGO_URI && !process.env.MONGO_URI.includes('127.0.0.1') && !process.env.MONGO_URI.includes('localhost')) {
            console.log('Attempting connection to local MongoDB fallback (mongodb://127.0.0.1:27017/mtor_attendance)...');
            try {
                const conn = await mongoose.connect('mongodb://127.0.0.1:27017/mtor_attendance');
                console.log(`Connected to local MongoDB: ${conn.connection.host}`);
                return;
            } catch (fallbackError) {
                console.error(`Local MongoDB Connection Error: ${fallbackError.message}`);
            }
        }
        
        console.warn('⚠️ Server is running on port 5001, but database features will fail until MONGO_URI in .env is fixed.');
    }
};

export default connectDB;
