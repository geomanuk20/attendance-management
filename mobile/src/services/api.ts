import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const debuggerHost =
  Constants.expoConfig?.hostUri ||
  (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
  (Constants as any).manifest?.debuggerHost;

const detectedHostIp = debuggerHost ? debuggerHost.split(':')[0] : '192.168.1.22';

export const BASE_URL_CANDIDATES = Platform.select({
  android: [
    `http://${detectedHostIp}:5002/api`,
    `http://${detectedHostIp}:5001/api`,
    'http://10.0.2.2:5002/api',
    'http://10.0.2.2:5001/api',
    'https://attendance.louisbella.store/api'
  ],
  ios: [
    `http://${detectedHostIp}:5002/api`,
    'http://localhost:5002/api',
    'http://localhost:5001/api',
    'https://attendance.louisbella.store/api'
  ],
  default: [
    `http://${detectedHostIp}:5002/api`,
    'http://localhost:5002/api',
    'https://attendance.louisbella.store/api'
  ],
}) || [`http://${detectedHostIp}:5002/api`];

export const API_URL = BASE_URL_CANDIDATES[0];

let isBackendReachable = true;
let activeWorkingBaseUrl: string | null = null;

export const checkIsBackendReachable = () => isBackendReachable;

const getHeaders = async () => {
  const token = await AsyncStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

export const fetchWithFallback = async (endpoint: string, options: RequestInit = {}) => {
  const candidates = activeWorkingBaseUrl
    ? [activeWorkingBaseUrl, ...BASE_URL_CANDIDATES.filter(u => u !== activeWorkingBaseUrl)]
    : BASE_URL_CANDIDATES;

  let lastError: any = null;
  for (const baseUrl of candidates) {
    try {
      const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second fast timeout per candidate
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      isBackendReachable = true;
      activeWorkingBaseUrl = baseUrl; // Lock onto active working backend URL
      return response;
    } catch (err: any) {
      lastError = err;
    }
  }
  isBackendReachable = false;
  throw new Error('Network Connection Error: Please connect to the internet and ensure the Attendance Server is online.');
};

// --- STRICT LIVE ONLINE AUTHENTICATION ---
export const loginUser = async (email: string, password: string) => {
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
};

export const getEnrolledFaceProfiles = async () => {
  let rawProfiles: any[] = [];
  try {
    const headers = await getHeaders();
    const response = await fetchWithFallback('/auth/enrolled-faces', { headers });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) rawProfiles.push(...data);
    }
  } catch {}

  try {
    const emps = await getEmployees();
    if (Array.isArray(emps)) rawProfiles.push(...emps);
  } catch {}

  try {
    const localProf = await AsyncStorage.getItem('enrolledFaceProfile');
    if (localProf) {
      const parsed = JSON.parse(localProf);
      if (parsed && parsed.faceImage) rawProfiles.push(parsed);
    }
    const currentUser = await AsyncStorage.getItem('user');
    if (currentUser) {
      const parsed = JSON.parse(currentUser);
      if (parsed && parsed.faceImage) rawProfiles.push(parsed);
    }
  } catch {}

  const seenMap = new Map<string, any>();
  for (const p of rawProfiles) {
    if (!p) continue;
    const key = String(p.email || p._id || p.id || '').toLowerCase().trim();
    if (!key) continue;

    if (p.faceImage && typeof p.faceImage === 'string' && p.faceImage.length > 20) {
      seenMap.set(key, p);
    } else if (!seenMap.has(key)) {
      seenMap.set(key, p);
    }
  }

  return Array.from(seenMap.values()).filter(p => p && p.faceImage && typeof p.faceImage === 'string' && p.faceImage.length > 20);
};

export const loginWithFace = async (employee: any) => {
  const response = await fetchWithFallback('/auth/face-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employeeId: employee._id || employee.id,
      email: employee.email
    }),
  });

  const contentType = response.headers.get('content-type');
  const data = contentType && contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.message || 'Biometric Face Login failed');
  }

  if (data?.token) {
    await AsyncStorage.setItem('token', data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data));
  }

  return data;
};

// --- STRICT LIVE ONLINE ATTENDANCE ---
export const getAttendance = async (employeeId?: string) => {
  const headers = await getHeaders();
  let endpoint = '/attendance';
  if (employeeId) endpoint += `?employeeId=${employeeId}`;

  const response = await fetchWithFallback(endpoint, { headers });
  const contentType = response.headers.get('content-type');
  const data = contentType && contentType.includes('application/json') ? await response.json() : [];

  if (!response.ok) {
    throw new Error(data?.message || 'Could not fetch attendance records');
  }

  return data;
};

export const clockIn = async (employeeId: string) => {
  const headers = await getHeaders();
  const response = await fetchWithFallback('/attendance/clockin', {
    method: 'POST',
    headers,
    body: JSON.stringify({ employeeId }),
  });

  const contentType = response.headers.get('content-type');
  const data = contentType && contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.message || 'Clock In failed');
  }

  return data;
};

export const clockOut = async (employeeId: string) => {
  const headers = await getHeaders();
  const response = await fetchWithFallback('/attendance/clockout', {
    method: 'POST',
    headers,
    body: JSON.stringify({ employeeId }),
  });

  const contentType = response.headers.get('content-type');
  const data = contentType && contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.message || 'Clock Out failed');
  }

  return data;
};

// --- STRICT LIVE ONLINE EMPLOYEES ---
export const getEmployees = async () => {
  const headers = await getHeaders();
  const response = await fetchWithFallback('/employees', { headers });
  const contentType = response.headers.get('content-type');
  const data = contentType && contentType.includes('application/json') ? await response.json() : [];

  if (!response.ok) {
    throw new Error(data?.message || 'Could not fetch employee list');
  }

  return data;
};

export const updateEmployee = async (id: string, employeeData: any) => {
  const headers = await getHeaders();
  const response = await fetchWithFallback(`/employees/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(employeeData),
  });

  const contentType = response.headers.get('content-type');
  const data = contentType && contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.message || 'Could not update employee details');
  }

  return data;
};

// --- STRICT LIVE ONLINE LEAVE REQUESTS ---
export const getLeaveRequests = async (employeeId?: string) => {
  const headers = await getHeaders();
  let endpoint = '/leaverequests';
  if (employeeId) endpoint += `?employeeId=${employeeId}`;

  const response = await fetchWithFallback(endpoint, { headers });
  const contentType = response.headers.get('content-type');
  const data = contentType && contentType.includes('application/json') ? await response.json() : [];

  if (!response.ok) {
    throw new Error(data?.message || 'Could not fetch leave requests');
  }

  return data;
};

export const createLeaveRequest = async (leaveData: any) => {
  const headers = await getHeaders();
  const response = await fetchWithFallback('/leaverequests', {
    method: 'POST',
    headers,
    body: JSON.stringify(leaveData),
  });

  const contentType = response.headers.get('content-type');
  const data = contentType && contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.message || 'Could not create leave request');
  }

  return data;
};

export const updateLeaveRequest = async (id: string, leaveData: any) => {
  const headers = await getHeaders();
  const response = await fetchWithFallback(`/leaverequests/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(leaveData),
  });

  const contentType = response.headers.get('content-type');
  const data = contentType && contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.message || 'Could not update leave request');
  }

  return data;
};

// --- STRICT LIVE ONLINE PAYROLL ---
export const getPayroll = async () => {
  const headers = await getHeaders();
  const response = await fetchWithFallback('/payroll', { headers });
  const contentType = response.headers.get('content-type');
  const data = contentType && contentType.includes('application/json') ? await response.json() : [];

  if (!response.ok) {
    throw new Error(data?.message || 'Could not fetch payroll records');
  }

  return data;
};

export const createPayroll = async (payrollData: any) => {
  const headers = await getHeaders();
  const response = await fetchWithFallback('/payroll', {
    method: 'POST',
    headers,
    body: JSON.stringify(payrollData),
  });

  const contentType = response.headers.get('content-type');
  const data = contentType && contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.message || 'Could not generate payroll');
  }

  return data;
};
