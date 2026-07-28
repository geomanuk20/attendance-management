import mongoose from 'mongoose';

const appUpdateSchema = mongoose.Schema({
    appVersion: {
        type: String,
        default: '1.0.0',
    },
    updateStatus: {
        type: String,
        enum: ['ON', 'OFF'],
        default: 'OFF',
    },
    updateMsg: {
        type: String,
        default: 'A new version is available. Please update for the best experience.',
    },
    updateUrl: {
        type: String,
        default: '',
    },
    cancelButton: {
        type: String,
        enum: ['ON', 'OFF'],
        default: 'ON',
    }
}, {
    timestamps: true,
});

const AppUpdate = mongoose.model('AppUpdate', appUpdateSchema);

export default AppUpdate;
