import express from 'express';
import asyncHandler from 'express-async-handler';
import AppUpdate from '../models/appUpdateModel.js';

const router = express.Router();

// @desc    Get app update settings
// @route   GET /api/app-update
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
    let settings = await AppUpdate.findOne();
    if (!settings) {
        settings = await AppUpdate.create({
            appVersion: '1.0.0',
            updateStatus: 'OFF',
            updateMsg: 'A new version is available. Please update for the best experience.',
            updateUrl: '',
            cancelButton: 'ON'
        });
    }
    res.json(settings);
}));

// @desc    Update app update settings
// @route   POST /api/app-update
// @access  Public
router.post('/', asyncHandler(async (req, res) => {
    const { appVersion, updateStatus, updateMsg, updateUrl, cancelButton } = req.body;

    let settings = await AppUpdate.findOne();
    if (settings) {
        settings.appVersion = appVersion !== undefined ? appVersion : settings.appVersion;
        settings.updateStatus = updateStatus !== undefined ? updateStatus : settings.updateStatus;
        settings.updateMsg = updateMsg !== undefined ? updateMsg : settings.updateMsg;
        settings.updateUrl = updateUrl !== undefined ? updateUrl : settings.updateUrl;
        settings.cancelButton = cancelButton !== undefined ? cancelButton : settings.cancelButton;
        await settings.save();
    } else {
        settings = await AppUpdate.create({
            appVersion,
            updateStatus,
            updateMsg,
            updateUrl,
            cancelButton
        });
    }
    res.json(settings);
}));

export default router;
