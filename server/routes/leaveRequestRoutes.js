import express from 'express';
import asyncHandler from 'express-async-handler';
import LeaveRequest from '../models/leaveRequestModel.js';
import Employee from '../models/employeeModel.js';

const router = express.Router();

// @desc    Get all leave requests
// @route   GET /api/leaverequests
// @access  Public
const getLeaveRequests = asyncHandler(async (req, res) => {
    // Optionally filter by employeeId if provided in query
    const { employeeId } = req.query;
    let query = {};
    if (employeeId) {
        query = { employeeId };
    }

    const leaveRequests = await LeaveRequest.find(query).populate('employeeId', 'name position department');
    res.json(leaveRequests);
});

// @desc    Create a new leave request
// @route   POST /api/leaverequests
// @access  Public
const createLeaveRequest = asyncHandler(async (req, res) => {
    const { employeeId, leaveType, startDate, endDate, reason } = req.body;

    const employee = await Employee.findById(employeeId);

    if (!employee) {
        res.status(404);
        throw new Error('Employee not found');
    }

    const leaveRequest = await LeaveRequest.create({
        employeeId,
        leaveType,
        startDate,
        endDate,
        reason,
        status: 'Pending'
    });

    if (leaveRequest) {
        res.status(201).json(leaveRequest);
    } else {
        res.status(400);
        throw new Error('Invalid leave request data');
    }
});

// @desc    Update leave request status
// @route   PUT /api/leaverequests/:id
// @access  Public
const updateLeaveRequest = asyncHandler(async (req, res) => {
    const leaveRequest = await LeaveRequest.findById(req.params.id);

    if (leaveRequest) {
        leaveRequest.status = req.body.status || leaveRequest.status;

        // Also allow updating other fields if needed, but primary use case is status update by admin
        if (req.body.leaveType) leaveRequest.leaveType = req.body.leaveType;
        if (req.body.startDate) leaveRequest.startDate = req.body.startDate;
        if (req.body.endDate) leaveRequest.endDate = req.body.endDate;
        if (req.body.reason) leaveRequest.reason = req.body.reason;

        const updatedLeaveRequest = await leaveRequest.save();
        res.json(updatedLeaveRequest);
    } else {
        res.status(404);
        throw new Error('Leave request not found');
    }
});

// @desc    Delete a leave request
// @route   DELETE /api/leaverequests/:id
// @access  Public
const deleteLeaveRequest = asyncHandler(async (req, res) => {
    const leaveRequest = await LeaveRequest.findById(req.params.id);

    if (leaveRequest) {
        await leaveRequest.deleteOne();
        res.json({ message: 'Leave request removed' });
    } else {
        res.status(404);
        throw new Error('Leave request not found');
    }
});

router.route('/').get(getLeaveRequests).post(createLeaveRequest);
router.route('/:id').put(updateLeaveRequest).delete(deleteLeaveRequest);

export default router;
