import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Mac's Local Wi-Fi IP for physical Android phone connection
const LOCAL_MAC_IP = '192.168.1.5';

export const API_URL = Platform.select({
  android: `http://${LOCAL_MAC_IP}:5001/api`,
  ios: `http://${LOCAL_MAC_IP}:5001/api`,
  default: `http://${LOCAL_MAC_IP}:5001/api`,
});

const getHeaders = async () => {
  const token = await AsyncStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

export const loginUser = async (email: string, password: string) => {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
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
    let url = `${API_URL}/attendance`;
    if (employeeId) url += `?employeeId=${employeeId}`;

    const response = await fetch(url, { headers });
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
    const response = await fetch(`${API_URL}/attendance/clockin`, {
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
    const response = await fetch(`${API_URL}/attendance/clockout`, {
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
    const response = await fetch(`${API_URL}/employees`, { headers });
    if (!response.ok) throw new Error('Failed to fetch employees');
    return await response.json();
  } catch (err: any) {
    if (err.message === 'Network request failed') {
      throw new Error(`Cannot connect to backend server on port 5001.`);
    }
    throw err;
  }
};

// Leave Requests
export const getLeaveRequests = async (employeeId?: string) => {
  try {
    const headers = await getHeaders();
    let url = `${API_URL}/leaverequests`;
    if (employeeId) url += `?employeeId=${employeeId}`;
    const response = await fetch(url, { headers });
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
    const response = await fetch(`${API_URL}/leaverequests`, {
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

// Payroll / Salary
export const getPayroll = async () => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_URL}/payroll`, { headers });
    if (!response.ok) throw new Error('Failed to fetch payroll');
    return await response.json();
  } catch (err: any) {
    if (err.message === 'Network request failed') {
      throw new Error(`Cannot connect to backend server on port 5001.`);
    }
    throw err;
  }
};
