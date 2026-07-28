import mongoose from 'mongoose';

const companySettingsSchema = mongoose.Schema({
    companyName: { type: String, default: 'Whiteswan TV News' },
    companyEmail: { type: String, default: 'contact@company.com' },
    companyPhone: { type: String, default: '+1 (555) 123-4567' },
    website: { type: String, default: 'https://www.mtor.com' },
    address: { type: String, default: '1/3, Malamel Center, Club Junction, Edappally.P.O, Ernakulam, Kerala- 682024' },
    officeLatitude: { type: Number, default: 10.0279421 },
    officeLongitude: { type: Number, default: 76.3166192 },
    allowedRadiusMeters: { type: Number, default: 100 },
    workStartTime: { type: String, default: '09:00' },
    workEndTime: { type: String, default: '17:00' },
    annualVacationDays: { type: Number, default: 25 },
    sickLeaveDays: { type: Number, default: 10 },
    personalDays: { type: Number, default: 5 },
}, {
    timestamps: true,
});

const CompanySettings = mongoose.model('CompanySettings', companySettingsSchema);

export default CompanySettings;
