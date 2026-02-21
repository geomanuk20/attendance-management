const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:5001/api';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
    };
};

// Employee API
export const getEmployees = async () => {
    const response = await fetch(`${API_URL}/employees`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch employees');
    }
    return response.json();
};

export const getEmployeeNames = async () => {
    const response = await fetch(`${API_URL}/employees/names`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch employee names');
    }
    return response.json();
};

// Auth API
export const loginUser = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
    }
    return response.json();
};

export const createEmployee = async (employeeData: any) => {
    const response = await fetch(`${API_URL}/employees`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(employeeData),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create employee');
    }
    return response.json();
};

export const updateEmployee = async (id: string, employeeData: any) => {
    const response = await fetch(`${API_URL}/employees/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(employeeData),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update employee');
    }
    return response.json();
};

export const deleteEmployee = async (id: string) => {
    const response = await fetch(`${API_URL}/employees/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete employee');
    }
    return response.json();
};

export const updatePreferences = async (id: string, prefs: { darkMode?: boolean; currency?: string }) => {
    const response = await fetch(`${API_URL}/employees/${id}/preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
    });
    if (!response.ok) throw new Error('Failed to save preferences');
    return response.json();
};

// Attendance API
export const getAttendance = async (employeeId?: string) => {
    let url = `${API_URL}/attendance`;
    if (employeeId) {
        url += `?employeeId=${employeeId}`;
    }
    const response = await fetch(url, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch attendance');
    }
    return response.json();
};

export const clockIn = async (employeeId: string) => {
    const response = await fetch(`${API_URL}/attendance/clockin`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ employeeId }),
    });
    if (!response.ok) {
        throw new Error('Failed to clock in');
    }
    return response.json();
};

export const clockOut = async (employeeId: string) => {
    const response = await fetch(`${API_URL}/attendance/clockout`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ employeeId }),
    });
    if (!response.ok) {
        throw new Error('Failed to clock out');
    }
    return response.json();
};

// Leave Request API
export const getLeaveRequests = async (employeeId?: string) => {
    let url = `${API_URL}/leaverequests`;
    if (employeeId) {
        url += `?employeeId=${employeeId}`;
    }
    const response = await fetch(url, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch leave requests');
    }
    return response.json();
};

export const createLeaveRequest = async (leaveData: any) => {
    const response = await fetch(`${API_URL}/leaverequests`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(leaveData),
    });
    if (!response.ok) {
        throw new Error('Failed to create leave request');
    }
    return response.json();
};

export const updateLeaveRequest = async (id: string, updateData: any) => {
    const response = await fetch(`${API_URL}/leaverequests/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData),
    });
    if (!response.ok) {
        throw new Error('Failed to update leave request');
    }
    return response.json();
};

export const deleteLeaveRequest = async (id: string) => {
    const response = await fetch(`${API_URL}/leaverequests/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete leave request');
    }
    return response.json();
};

// Payroll API
export const getPayroll = async (month?: string) => {
    let url = `${API_URL}/payroll`;
    if (month) {
        url += `?month=${month}`;
    }
    const response = await fetch(url, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch payroll');
    }
    return response.json();
};

export const createPayroll = async (payrollData: any) => {
    const response = await fetch(`${API_URL}/payroll`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payrollData),
    });
    if (!response.ok) {
        throw new Error('Failed to create payroll record');
    }
    return response.json();
};
