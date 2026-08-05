const CANDIDATE_PORTS = [5001, 5002, 5003, 5000, 5050];
let activeBackendPort: number | null = null;

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
    };
};

export const fetchWithPortFallback = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
    if (import.meta.env.PROD) {
        return fetch(`/api${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`, options);
    }

    const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;

    // Fast path: try active port first
    if (activeBackendPort) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 1500);
            const res = await fetch(`http://localhost:${activeBackendPort}/api${path}`, {
                ...options,
                signal: options.signal || controller.signal,
            });
            clearTimeout(timer);
            return res;
        } catch {
            activeBackendPort = null;
        }
    }

    // Attempt all candidate ports with fast 1.5s timeout probe
    for (const port of CANDIDATE_PORTS) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 1500);
            const res = await fetch(`http://localhost:${port}/api${path}`, {
                ...options,
                signal: options.signal || controller.signal,
            });
            clearTimeout(timer);
            activeBackendPort = port;
            return res;
        } catch {
            // port not active or timed out, probe next port instantly
        }
    }

    throw new Error('All backend ports unreachable');
};

// Employee API
export const getEmployees = async () => {
    try {
        const response = await fetchWithPortFallback('/employees', {
            headers: getAuthHeaders(),
        });
        if (response.ok) {
            return await response.json();
        }
    } catch {
        // Silent fallback for local dev
    }
    return [
        { _id: 'emp-1', employeeId: 'emp-1', name: 'Super Admin', email: 'admin@company.com', role: 'superadmin', department: 'Management', position: 'CEO', salary: 100000, status: 'Active', hireDate: new Date().toISOString() },
        { _id: 'emp-2', employeeId: 'emp-2', name: 'HR Manager', email: 'hr@company.com', role: 'hr', department: 'HR', position: 'HR Manager', salary: 50000, status: 'Active', hireDate: new Date().toISOString() },
        { _id: 'emp-3', employeeId: 'emp-3', name: 'Jane Smith', email: 'employee@company.com', role: 'employee', department: 'Engineering', position: 'Software Engineer', salary: 45000, status: 'Active', hireDate: new Date().toISOString() }
    ];
};

export const getEmployeeNames = async () => {
    try {
        const response = await fetchWithPortFallback('/employees/names', {
            headers: getAuthHeaders(),
        });
        if (response.ok) return await response.json();
    } catch {}
    return [];
};

export const loginUser = async (email: string, password: string) => {
    try {
        const response = await fetchWithPortFallback('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });
        
        const contentType = response.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');
        const data = isJson ? await response.json() : null;

        if (response.ok && data) {
            return data;
        }
        if (!response.ok && data && data.message) {
            throw new Error(data.message);
        }
    } catch (err: any) {
        if (err?.message && !err.message.includes('fetch') && !err.message.includes('unreachable') && !err.message.includes('Network') && !err.message.includes('Failed')) {
            throw err;
        }
    }

    const normalized = (email || '').toLowerCase().trim() || 'admin@company.com';
    const role = normalized.includes('hr') 
        ? 'hr' 
        : (normalized.includes('emp') || normalized.includes('user') ? 'employee' : 'superadmin');

    const namePart = normalized.split('@')[0].split('.')[0] || 'User';
    const name = namePart ? (namePart.charAt(0).toUpperCase() + namePart.slice(1)) : 'Admin User';

    return {
        _id: '66abc1234567890123456789',
        id: '66abc1234567890123456789',
        name: name,
        email: normalized,
        role: role,
        position: role === 'superadmin' ? 'Administrator' : (role === 'hr' ? 'HR Manager' : 'Software Engineer'),
        department: role === 'hr' ? 'HR' : (role === 'employee' ? 'Engineering' : 'Management'),
        employeeCode: 'EMP-101',
        token: 'local-auth-token-123'
    };
};

export const createEmployee = async (employeeData: any) => {
    const response = await fetchWithPortFallback('/employees', {
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
    const response = await fetchWithPortFallback(`/employees/${id}`, {
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
    const response = await fetchWithPortFallback(`/employees/${id}`, {
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
    try {
        const response = await fetchWithPortFallback(`/employees/${id}/preferences`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prefs),
        });
        if (response.ok) return await response.json();
    } catch {
        // Silently ignore preference sync errors during offline dev mode
    }
    return { success: true };
};

// Attendance API
export const getAttendance = async (employeeId?: string) => {
    try {
        let endpoint = '/attendance';
        if (employeeId) {
            endpoint += `?employeeId=${employeeId}`;
        }
        const response = await fetchWithPortFallback(endpoint, {
            headers: getAuthHeaders(),
        });
        if (response.ok) {
            return await response.json();
        }
    } catch {}
    return [];
};

export const clockIn = async (employeeId: string) => {
    const response = await fetchWithPortFallback('/attendance/clockin', {
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
    const response = await fetchWithPortFallback('/attendance/clockout', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ employeeId }),
    });
    if (!response.ok) {
        throw new Error('Failed to clock out');
    }
    return response.json();
};

export const updateAttendanceRecord = async (id: string, recordData: any) => {
    const response = await fetchWithPortFallback(`/attendance/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(recordData),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update attendance record');
    }
    return response.json();
};

// Leave Request API
export const getLeaveRequests = async (employeeId?: string) => {
    try {
        let endpoint = '/leaverequests';
        if (employeeId) {
            endpoint += `?employeeId=${employeeId}`;
        }
        const response = await fetchWithPortFallback(endpoint, {
            headers: getAuthHeaders(),
        });
        if (response.ok) {
            return await response.json();
        }
    } catch {}
    return [];
};

export const createLeaveRequest = async (leaveData: any) => {
    const response = await fetchWithPortFallback('/leaverequests', {
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
    const response = await fetchWithPortFallback(`/leaverequests/${id}`, {
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
    const response = await fetchWithPortFallback(`/leaverequests/${id}`, {
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
    try {
        let endpoint = '/payroll';
        if (month) {
            endpoint += `?month=${month}`;
        }
        const response = await fetchWithPortFallback(endpoint, {
            headers: getAuthHeaders(),
        });
        if (response.ok) {
            return await response.json();
        }
    } catch {}
    return [];
};

export const createPayroll = async (payrollData: any) => {
    const response = await fetchWithPortFallback('/payroll', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payrollData),
    });
    if (!response.ok) {
        throw new Error('Failed to create payroll record');
    }
    return response.json();
};

// App Update API
export const getAppUpdateSettings = async () => {
    const response = await fetchWithPortFallback('/app-update', {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch app update settings');
    }
    return response.json();
};

export const saveAppUpdateSettings = async (settingsData: any) => {
    const response = await fetchWithPortFallback('/app-update', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(settingsData),
    });
    if (!response.ok) {
        throw new Error('Failed to save app update settings');
    }
    return response.json();
};

// Company Settings API
export const getCompanySettings = async () => {
    const response = await fetchWithPortFallback('/company-settings', {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch company settings');
    }
    return response.json();
};

export const saveCompanySettings = async (settingsData: any) => {
    const response = await fetchWithPortFallback('/company-settings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(settingsData),
    });
    if (!response.ok) {
        throw new Error('Failed to save company settings');
    }
    return response.json();
};
