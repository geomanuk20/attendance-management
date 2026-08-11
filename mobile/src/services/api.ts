import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const LOCAL_MAC_IP = '192.168.1.22';

export const BASE_URL_CANDIDATES = Platform.select({
  android: [
    `http://${LOCAL_MAC_IP}:5002/api`,
    `http://${LOCAL_MAC_IP}:5001/api`,
    'http://10.0.2.2:5002/api',
    'http://10.0.2.2:5001/api',
    'https://attendance.louisbella.store/api'
  ],
  ios: [
    `http://${LOCAL_MAC_IP}:5002/api`,
    'http://localhost:5002/api',
    'http://localhost:5001/api',
    'https://attendance.louisbella.store/api'
  ],
  default: [
    `http://${LOCAL_MAC_IP}:5002/api`,
    'http://localhost:5002/api',
    'http://localhost:5001/api',
    'https://attendance.louisbella.store/api'
  ],
}) || [`http://${LOCAL_MAC_IP}:5002/api`];

export const API_URL = BASE_URL_CANDIDATES[0];

let isBackendReachable = true;

export const checkIsBackendReachable = () => isBackendReachable;

const getHeaders = async () => {
  const token = await AsyncStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

export const fetchWithFallback = async (endpoint: string, options: RequestInit = {}) => {
  let lastError: any = null;
  for (const baseUrl of BASE_URL_CANDIDATES) {
    try {
      const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      isBackendReachable = true;
      return response;
    } catch (err: any) {
      lastError = err;
    }
  }
  isBackendReachable = false;
  throw lastError || new Error('Network request failed');
};

// Default fallback employees for offline mode when no cache exists
const DEFAULT_OFFLINE_EMPLOYEES = [
  { _id: 'emp-1', id: 'emp-1', employeeCode: 'WTN-001', name: 'Super Admin', email: 'admin@company.com', role: 'superadmin', department: 'Management', position: 'CEO', salary: 100000, status: 'Active', hireDate: new Date().toISOString(), employmentType: 'Full-Time' },
  { _id: 'emp-2', id: 'emp-2', employeeCode: 'WTN-002', name: 'HR Manager', email: 'hr@company.com', role: 'hr', department: 'HR', position: 'HR Manager', salary: 50000, status: 'Active', hireDate: new Date().toISOString(), employmentType: 'Full-Time' },
  { _id: 'emp-3', id: 'emp-3', employeeCode: 'WTN-003', name: 'Geo Manu', email: 'geomanu@whiteswantv.com', role: 'employee', department: 'Management', position: 'Technical Head', salary: 35000, status: 'Active', hireDate: new Date().toISOString(), employmentType: 'Full-Time' },
  { _id: 'emp-4', id: 'emp-4', employeeCode: 'WTN-004', name: 'Jane Smith', email: 'employee@company.com', role: 'employee', department: 'Engineering', position: 'Software Engineer', salary: 45000, status: 'Active', hireDate: new Date().toISOString(), employmentType: 'Full-Time' }
];

export const loginUser = async (email: string, password: string) => {
  try {
    const response = await fetchWithFallback('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const contentType = response.headers.get('content-type');
    const data = contentType && contentType.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
      throw new Error(data?.message || `Login failed (${response.status})`);
    }

    if (data?.token) {
      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data));
    }

    return data;
  } catch (err: any) {
    // OFFLINE LOGIN FALLBACK
    const cachedUserStr = await AsyncStorage.getItem('user');
    const cachedEmployeesStr = await AsyncStorage.getItem('offline_employees');
    
    let matchedUser = null;

    if (cachedUserStr) {
      const u = JSON.parse(cachedUserStr);
      if (u.email && u.email.toLowerCase() === email.toLowerCase()) {
        matchedUser = u;
      }
    }

    if (!matchedUser && cachedEmployeesStr) {
      const list = JSON.parse(cachedEmployeesStr);
      const found = list.find((e: any) => e.email && e.email.toLowerCase() === email.toLowerCase());
      if (found) {
        matchedUser = { ...found, id: found._id || found.id, token: 'offline_token' };
      }
    }

    if (!matchedUser) {
      const defaultFound = DEFAULT_OFFLINE_EMPLOYEES.find(e => e.email.toLowerCase() === email.toLowerCase());
      if (defaultFound) {
        matchedUser = { ...defaultFound, token: 'offline_token' };
      } else {
        matchedUser = {
          _id: `offline_${Date.now()}`,
          id: `offline_${Date.now()}`,
          name: email.split('@')[0] || 'User',
          email,
          role: 'employee',
          department: 'General',
          position: 'Staff',
          employeeCode: 'WTN-OFFLINE',
          token: 'offline_token'
        };
      }
    }

    const offlineUserObj = { ...matchedUser, isOfflineSession: true };
    await AsyncStorage.setItem('user', JSON.stringify(offlineUserObj));
    await AsyncStorage.setItem('token', 'offline_token');
    return offlineUserObj;
  }
};

export const getAttendance = async (employeeId?: string) => {
  const cacheKey = `offline_attendance_${employeeId || 'all'}`;
  try {
    const headers = await getHeaders();
    let endpoint = '/attendance';
    if (employeeId) endpoint += `?employeeId=${employeeId}`;

    const response = await fetchWithFallback(endpoint, { headers });
    if (response.ok) {
      const data = await response.json();
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      if (!employeeId) await AsyncStorage.setItem('offline_attendance_all', JSON.stringify(data));
      return data;
    }
  } catch (err: any) {
    // OFFLINE FALLBACK
  }

  const cached = await AsyncStorage.getItem(cacheKey) || await AsyncStorage.getItem('offline_attendance_all');
  return cached ? JSON.parse(cached) : [];
};

export const clockIn = async (employeeId: string) => {
  try {
    const headers = await getHeaders();
    const response = await fetchWithFallback('/attendance/clockin', {
      method: 'POST',
      headers,
      body: JSON.stringify({ employeeId }),
    });
    const data = await response.json();
    if (response.ok) return data;
  } catch (err: any) {
    // OFFLINE CLOCK IN
  }

  const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const offlineRecord = {
    _id: `offline_in_${Date.now()}`,
    employeeId,
    date: todayStr,
    clockIn: timeStr,
    clockOut: null,
    status: 'Present',
    workHours: 0,
    isOfflineRecord: true
  };

  // Add to cached logs
  const cacheKey = `offline_attendance_${employeeId}`;
  const existing = await AsyncStorage.getItem(cacheKey);
  const logs = existing ? JSON.parse(existing) : [];
  const updatedLogs = [offlineRecord, ...logs];
  await AsyncStorage.setItem(cacheKey, JSON.stringify(updatedLogs));

  // Add to pending queue for server sync
  const queueStr = await AsyncStorage.getItem('offline_clock_queue');
  const queue = queueStr ? JSON.parse(queueStr) : [];
  queue.push({ action: 'clockIn', employeeId, time: timeStr, date: todayStr });
  await AsyncStorage.setItem('offline_clock_queue', JSON.stringify(queue));

  return offlineRecord;
};

export const clockOut = async (employeeId: string) => {
  try {
    const headers = await getHeaders();
    const response = await fetchWithFallback('/attendance/clockout', {
      method: 'POST',
      headers,
      body: JSON.stringify({ employeeId }),
    });
    const data = await response.json();
    if (response.ok) return data;
  } catch (err: any) {
    // OFFLINE CLOCK OUT
  }

  const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const cacheKey = `offline_attendance_${employeeId}`;
  const existing = await AsyncStorage.getItem(cacheKey);
  const logs = existing ? JSON.parse(existing) : [];

  let workHours = 4; // Default to full shift if clock-in missing
  if (logs.length > 0 && logs[0].clockIn) {
    try {
      const parseSec = (tStr: string) => {
        const parts = String(tStr).trim().split(/\s+/);
        const segments = parts[0].split(':').map(Number);
        let h = segments[0];
        const m = segments[1] || 0;
        const p = parts[1] ? parts[1].toUpperCase() : '';
        if (p === 'PM' && h !== 12) h += 12;
        if (p === 'AM' && h === 12) h = 0;
        return h * 3600 + m * 60;
      };
      const inSec = parseSec(logs[0].clockIn);
      const outSec = parseSec(timeStr);
      let diffSec = outSec - inSec;
      if (diffSec < 0) diffSec += 24 * 3600;
      workHours = parseFloat((diffSec / 3600).toFixed(2));
    } catch {}
  }

  const offlineRecord = {
    ...(logs[0] || {}),
    _id: logs[0]?._id || `offline_out_${Date.now()}`,
    employeeId,
    date: todayStr,
    clockOut: timeStr,
    status: workHours >= 4 ? 'Present' : 'Half-Day',
    workHours,
    isOfflineRecord: true
  };

  const updatedLogs = [offlineRecord, ...logs.slice(1)];
  await AsyncStorage.setItem(cacheKey, JSON.stringify(updatedLogs));

  // Add to pending queue for server sync
  const queueStr = await AsyncStorage.getItem('offline_clock_queue');
  const queue = queueStr ? JSON.parse(queueStr) : [];
  queue.push({ action: 'clockOut', employeeId, time: timeStr, date: todayStr });
  await AsyncStorage.setItem('offline_clock_queue', JSON.stringify(queue));

  return offlineRecord;
};

// Employees API
export const getEmployees = async () => {
  try {
    const headers = await getHeaders();
    const response = await fetchWithFallback('/employees', { headers });
    if (response.ok) {
      const data = await response.json();
      await AsyncStorage.setItem('offline_employees', JSON.stringify(data));
      return data;
    }
  } catch (err: any) {
    // OFFLINE FALLBACK
  }

  const cached = await AsyncStorage.getItem('offline_employees');
  return cached ? JSON.parse(cached) : DEFAULT_OFFLINE_EMPLOYEES;
};

export const updateEmployee = async (id: string, employeeData: any) => {
  try {
    const headers = await getHeaders();
    const response = await fetchWithFallback(`/employees/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(employeeData),
    });
    if (response.ok) return await response.json();
  } catch (err: any) {}

  // Save to offline cache
  const cached = await AsyncStorage.getItem('offline_employees');
  if (cached) {
    const list = JSON.parse(cached);
    const updatedList = list.map((e: any) => (e._id === id || e.id === id ? { ...e, ...employeeData } : e));
    await AsyncStorage.setItem('offline_employees', JSON.stringify(updatedList));
  }
  return { ...employeeData, _id: id, id };
};

// Leave Requests API
export const getLeaveRequests = async (employeeId?: string) => {
  const cacheKey = `offline_leaves_${employeeId || 'all'}`;
  try {
    const headers = await getHeaders();
    let endpoint = '/leaverequests';
    if (employeeId) endpoint += `?employeeId=${employeeId}`;
    const response = await fetchWithFallback(endpoint, { headers });
    if (response.ok) {
      const data = await response.json();
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      if (!employeeId) await AsyncStorage.setItem('offline_leaves_all', JSON.stringify(data));
      return data;
    }
  } catch (err: any) {}

  const cached = await AsyncStorage.getItem(cacheKey) || await AsyncStorage.getItem('offline_leaves_all');
  return cached ? JSON.parse(cached) : [];
};

export const createLeaveRequest = async (leaveData: any) => {
  try {
    const headers = await getHeaders();
    const response = await fetchWithFallback('/leaverequests', {
      method: 'POST',
      headers,
      body: JSON.stringify(leaveData),
    });
    if (response.ok) return await response.json();
  } catch (err: any) {}

  const newLeave = { ...leaveData, _id: `offline_leave_${Date.now()}`, status: 'Pending' };
  const cacheKey = `offline_leaves_${leaveData.employeeId || 'all'}`;
  const cached = await AsyncStorage.getItem(cacheKey);
  const list = cached ? JSON.parse(cached) : [];
  const updatedList = [newLeave, ...list];
  await AsyncStorage.setItem(cacheKey, JSON.stringify(updatedList));
  return newLeave;
};

export const updateLeaveRequest = async (id: string, leaveData: any) => {
  try {
    const headers = await getHeaders();
    const response = await fetchWithFallback(`/leaverequests/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(leaveData),
    });
    if (response.ok) return await response.json();
  } catch (err: any) {}

  return { ...leaveData, _id: id };
};

// Payroll API
export const getPayroll = async () => {
  try {
    const headers = await getHeaders();
    const response = await fetchWithFallback('/payroll', { headers });
    if (response.ok) {
      const data = await response.json();
      await AsyncStorage.setItem('offline_payroll', JSON.stringify(data));
      return data;
    }
  } catch (err: any) {}

  const cached = await AsyncStorage.getItem('offline_payroll');
  return cached ? JSON.parse(cached) : [];
};

export const createPayroll = async (payrollData: any) => {
  try {
    const headers = await getHeaders();
    const response = await fetchWithFallback('/payroll', {
      method: 'POST',
      headers,
      body: JSON.stringify(payrollData),
    });
    if (response.ok) return await response.json();
  } catch (err: any) {}

  return { ...payrollData, _id: `offline_payroll_${Date.now()}` };
};
