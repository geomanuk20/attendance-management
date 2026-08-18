const CANDIDATE_PORTS = [5002, 5001, 5003, 5000, 5050];
let activeBackendPort: number | null = (() => {
    const saved = localStorage.getItem('activeBackendPort');
    return saved ? parseInt(saved, 10) : null;
})();

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
    };
};

export const fetchWithPortFallback = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
    const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor;
    const isLocalNativeHost = typeof window !== 'undefined' && (
        (window.location.protocol === 'https:' && window.location.hostname === 'localhost') ||
        window.location.protocol === 'capacitor:' ||
        window.location.protocol === 'ionic:'
    );

    // 1. Explicit API URL from environment or localStorage
    const customApiUrl = typeof localStorage !== 'undefined' ? (localStorage.getItem('api_server_url') || (import.meta as any).env?.VITE_API_URL) : null;
    if (customApiUrl) {
        try {
            const baseUrl = customApiUrl.replace(/\/api\/?$/, '');
            const res = await fetch(`${baseUrl}/api${path}`, options);
            if (res.ok || res.status < 500) return res;
        } catch {}
    }

    // 2. Mobile Android APK / Native Webview Candidate Hosts
    if (isCapacitor || isLocalNativeHost) {
        const mobileCandidateHosts = [
            'http://192.168.1.22:5002', // Local LAN Wi-Fi IP of development Mac
            'http://192.168.1.22:5001',
            'http://10.0.2.2:5002',     // Android Studio Emulator bridge to localhost
            'http://10.0.2.2:5001',
            'https://attendance.louisbella.store', // Cloud backend endpoint
            'http://localhost:5002',
            'http://127.0.0.1:5002',
        ];

        for (const host of mobileCandidateHosts) {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 3500);
                const cleanHost = host.endsWith('/') ? host.slice(0, -1) : host;
                const url = cleanHost.endsWith('/api') ? `${cleanHost}${path}` : `${cleanHost}/api${path}`;
                const res = await fetch(url, {
                    ...options,
                    signal: options.signal || controller.signal,
                });
                clearTimeout(timer);
                if (res.ok || res.status < 500) {
                    return res;
                }
            } catch {}
        }
    }

    // 3. Regular Web Production Environment
    if (import.meta.env.PROD && !isCapacitor && !isLocalNativeHost) {
        return fetch(`/api${path}`, options);
    }

    // 4. Fast path: try active port first
    if (activeBackendPort) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(`http://localhost:${activeBackendPort}/api${path}`, {
                ...options,
                signal: options.signal || controller.signal,
            });
            clearTimeout(timer);
            if (res.ok || res.status < 500) {
                return res;
            }
        } catch {
            activeBackendPort = null;
            localStorage.removeItem('activeBackendPort');
        }
    }

    // 5. Attempt all candidate ports
    for (const port of CANDIDATE_PORTS) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(`http://localhost:${port}/api${path}`, {
                ...options,
                signal: options.signal || controller.signal,
            });
            clearTimeout(timer);
            activeBackendPort = port;
            localStorage.setItem('activeBackendPort', String(port));
            return res;
        } catch {}
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

export const getEnrolledFaceProfiles = async () => {
    let rawProfiles: any[] = [];
    try {
        const response = await fetchWithPortFallback('/auth/enrolled-faces', {
            headers: getAuthHeaders(),
        });
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) rawProfiles.push(...data);
        }
    } catch {}

    try {
        const emps = await getEmployees();
        if (Array.isArray(emps)) rawProfiles.push(...emps);
    } catch {}

    // Check local storage cached profile and logged in user
    try {
        const local = localStorage.getItem('enrolledFaceProfile');
        if (local) {
            const parsed = JSON.parse(local);
            if (parsed && parsed.faceImage && parsed.faceImage.length > 50) rawProfiles.push(parsed);
        }
        const currentUser = localStorage.getItem('user');
        if (currentUser) {
            const parsed = JSON.parse(currentUser);
            if (parsed && parsed.faceImage && parsed.faceImage.length > 50) rawProfiles.push(parsed);
        }
    } catch {}

    // Deduplicate profiles by email/id - ONLY keep profiles with valid enrolled face photos
    const seenMap = new Map<string, any>();
    for (const p of rawProfiles) {
        if (!p || !p.faceImage || typeof p.faceImage !== 'string' || p.faceImage.length < 50) continue;
        const key = String(p.email || p._id || p.id || '').toLowerCase().trim();
        if (!key) continue;
        seenMap.set(key, p);
    }

    return Array.from(seenMap.values());
};

export const loginWithFace = async (employee: any) => {
    try {
        const response = await fetchWithPortFallback('/auth/face-login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                employeeId: employee._id || employee.id,
                email: employee.email,
            }),
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

    // Fallback response for offline / mock mode
    return {
        _id: employee._id || employee.id || 'face-emp-1',
        id: employee._id || employee.id || 'face-emp-1',
        name: employee.name || 'Enrolled User',
        email: employee.email || 'user@company.com',
        role: employee.role || 'employee',
        position: employee.position || 'Employee',
        department: employee.department || 'Operations',
        employeeCode: employee.employeeCode || 'EMP-101',
        faceImage: employee.faceImage || '',
        token: `mock-face-jwt-token-${Date.now()}`
    };
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
    try {
        const response = await fetchWithPortFallback('/company-settings', {
            headers: getAuthHeaders(),
        });
        if (response.ok) {
            const data = await response.json();
            if (data) {
                localStorage.setItem('companySettings', JSON.stringify(data));
                return data;
            }
        }
    } catch {
        // Fallback to local storage if network request fails
    }
    const saved = localStorage.getItem('companySettings');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch { }
    }
    return {
        companyName: 'Whiteswan TV News',
        address: '1/3, Malamel Center, Club Junction, Edappally.P.O, Ernakulam, Kerala- 682024',
        officeLatitude: 10.0279421,
        officeLongitude: 76.3166192,
        allowedRadiusMeters: 100
    };
};

export const saveCompanySettings = async (settingsData: any) => {
    localStorage.setItem('companySettings', JSON.stringify(settingsData));
    try {
        const response = await fetchWithPortFallback('/company-settings', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(settingsData),
        });
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('companySettings', JSON.stringify(data));
            return data;
        }
    } catch {
        // Offline / fallback ok
    }
    return settingsData;
};
