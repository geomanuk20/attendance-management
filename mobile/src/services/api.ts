import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const LOCAL_MAC_IP = '192.168.1.5';

export const BASE_URL_CANDIDATES = __DEV__
  ? Platform.select({
      android: [
        'http://10.0.2.2:5002/api',       // Android Emulator host loopback (5002)
        'http://10.0.2.2:5001/api',
        `http://${LOCAL_MAC_IP}:5002/api`, // Local Wi-Fi network IP
        `http://${LOCAL_MAC_IP}:5001/api`,
        'http://127.0.0.1:5002/api',
      ],
      ios: [
        'http://localhost:5002/api',
        'http://localhost:5001/api',
        `http://${LOCAL_MAC_IP}:5002/api`,
      ],
      default: [
        'http://localhost:5002/api',
        'http://localhost:5001/api',
      ],
    }) || ['http://localhost:5002/api']
  : ['https://attendance.louisbella.store/api'];

export const API_URL = BASE_URL_CANDIDATES[0];

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
      const response = await fetch(url, options);
      return response;
    } catch (err: any) {
      lastError = err;
      // Continue to next candidate URL
    }
  }
  throw lastError || new Error('Network request failed');
};

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
    if (err.message === 'Network request failed') {
      throw new Error(`Cannot connect to backend server at ${API_URL}. Please ensure your backend server is running!`);
    }
    throw err;
  }
};

export const getAttendance = async (employeeId?: string) => {
  try {
    const headers = await getHeaders();
    let endpoint = '/attendance';
    if (employeeId) endpoint += `?employeeId=${employeeId}`;

    const response = await fetchWithFallback(endpoint, { headers });
    if (!response.ok) throw new Error('Failed to fetch attendance');
    return await response.json();
  } catch (err: any) {
    if (err.message === 'Network request failed') {
      throw new Error(`Cannot connect to backend server. Please run 'npm run dev' in terminal.`);
    }
    throw err;
  }
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
    if (!response.ok) throw new Error(data?.message || 'Failed to clock in');
    return data;
  } catch (err: any) {
    if (err.message === 'Network request failed') {
      throw new Error(`Cannot connect to backend server on port 5001. Please run 'npm run dev' in terminal.`);
    }
    throw err;
  }
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
    if (!response.ok) throw new Error(data?.message || 'Failed to clock out');
    return data;
  } catch (err: any) {
    if (err.message === 'Network request failed') {
      throw new Error(`Cannot connect to backend server on port 5001. Please run 'npm run dev' in terminal.`);
    }
    throw err;
  }
};

// Employees
export const getEmployees = async () => {
  try {
    const headers = await getHeaders();
    const response = await fetchWithFallback('/employees', { headers });
    if (!response.ok) throw new Error('Failed to fetch employees');
    return await response.json();
  } catch (err: any) {
    if (err.message === 'Network request failed') {
      throw new Error(`Cannot connect to backend server on port 5001.`);
    }
    throw err;
  }
};

export const updateEmployee = async (id: string, employeeData: any) => {
  try {
    const headers = await getHeaders();
    const response = await fetchWithFallback(`/employees/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(employeeData),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Failed to update employee profile');
    return data;
  } catch (err: any) {
    if (err.message === 'Network request failed') {
      throw new Error(`Cannot connect to backend server.`);
    }
    throw err;
  }
};

// Leave Requests
export const getLeaveRequests = async (employeeId?: string) => {
  try {
    const headers = await getHeaders();
    let endpoint = '/leaverequests';
    if (employeeId) endpoint += `?employeeId=${employeeId}`;
    const response = await fetchWithFallback(endpoint, { headers });
    if (!response.ok) throw new Error('Failed to fetch leave requests');
    return await response.json();
  } catch (err: any) {
    if (err.message === 'Network request failed') {
      throw new Error(`Cannot connect to backend server on port 5001.`);
    }
    throw err;
  }
};

export const createLeaveRequest = async (leaveData: any) => {
  try {
    const headers = await getHeaders();
    const response = await fetchWithFallback('/leaverequests', {
      method: 'POST',
      headers,
      body: JSON.stringify(leaveData),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Failed to submit leave request');
    return data;
  } catch (err: any) {
    if (err.message === 'Network request failed') {
      throw new Error(`Cannot connect to backend server. Please run 'npm run dev' in terminal.`);
    }
    throw err;
  }
};

export const updateLeaveRequest = async (id: string, leaveData: any) => {
  try {
    const headers = await getHeaders();
    const response = await fetchWithFallback(`/leaverequests/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(leaveData),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Failed to update leave request');
    return data;
  } catch (err: any) {
    if (err.message === 'Network request failed') {
      throw new Error(`Cannot connect to backend server. Please run 'npm run dev' in terminal.`);
    }
    throw err;
  }
};

// Payroll / Salary
export const getPayroll = async () => {
  try {
    const headers = await getHeaders();
    const response = await fetchWithFallback('/payroll', { headers });
    if (!response.ok) throw new Error('Failed to fetch payroll');
    return await response.json();
  } catch (err: any) {
    if (err.message === 'Network request failed') {
      throw new Error(`Cannot connect to backend server on port 5001.`);
    }
    throw err;
  }
};

export const createPayroll = async (payrollData: any) => {
  try {
    const headers = await getHeaders();
    const response = await fetchWithFallback('/payroll', {
      method: 'POST',
      headers,
      body: JSON.stringify(payrollData),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Failed to process payroll');
    return data;
  } catch (err: any) {
    if (err.message === 'Network request failed') {
      throw new Error(`Cannot connect to backend server. Please run 'npm run dev' in terminal.`);
    }
    throw err;
  }
};
