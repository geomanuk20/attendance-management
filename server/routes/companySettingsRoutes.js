import express from 'express';
import asyncHandler from 'express-async-handler';
import CompanySettings from '../models/companySettingsModel.js';

const router = express.Router();

// @desc    Get company settings
// @route   GET /api/company-settings
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
    let settings = await CompanySettings.findOne();
    if (!settings) {
        settings = await CompanySettings.create({});
    }
    res.json(settings);
}));

// @desc    Update company settings
// @route   POST /api/company-settings
// @access  Public
router.post('/', asyncHandler(async (req, res) => {
    const {
        companyName, companyEmail, companyPhone, website, address,
        officeLatitude, officeLongitude, allowedRadiusMeters,
        workStartTime, workEndTime,
        annualVacationDays, sickLeaveDays, personalDays,
        quickFaceScanLoginEnabled
    } = req.body;

    let settings = await CompanySettings.findOne();

    if (settings) {
        if (companyName !== undefined) settings.companyName = companyName;
        if (companyEmail !== undefined) settings.companyEmail = companyEmail;
        if (companyPhone !== undefined) settings.companyPhone = companyPhone;
        if (website !== undefined) settings.website = website;
        if (address !== undefined) settings.address = address;
        if (officeLatitude !== undefined) settings.officeLatitude = officeLatitude;
        if (officeLongitude !== undefined) settings.officeLongitude = officeLongitude;
        if (allowedRadiusMeters !== undefined) settings.allowedRadiusMeters = allowedRadiusMeters;
        if (workStartTime !== undefined) settings.workStartTime = workStartTime;
        if (workEndTime !== undefined) settings.workEndTime = workEndTime;
        if (annualVacationDays !== undefined) settings.annualVacationDays = annualVacationDays;
        if (sickLeaveDays !== undefined) settings.sickLeaveDays = sickLeaveDays;
        if (personalDays !== undefined) settings.personalDays = personalDays;
        if (quickFaceScanLoginEnabled !== undefined) settings.quickFaceScanLoginEnabled = quickFaceScanLoginEnabled;
        await settings.save();
    } else {
        settings = await CompanySettings.create(req.body);
    }

    res.json(settings);
}));

export default router;
