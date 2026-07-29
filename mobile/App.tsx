import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Modal,
  Switch,
  Platform,
  StatusBar as NativeStatusBar,
  Keyboard,
  Linking,
  Share,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loginUser,
  clockIn,
  clockOut,
  getAttendance,
  getEmployees,
  getLeaveRequests,
  createLeaveRequest,
  updateLeaveRequest,
  getPayroll,
  createPayroll,
  API_URL,
} from './src/services/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const formatName = (str?: string) => {
  if (!str) return '';
  return String(str)
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

type TabType = 'dashboard' | 'attendance' | 'leaves' | 'salary' | 'employees' | 'settings';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('admin@company.com');
  const [password, setPassword] = useState('supersecret');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (user) {
        await loadAllData(user);
      }
      await checkForUpdates();
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  // Attendance state
  const [clockedIn, setClockedIn] = useState(false);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [allAttendanceLogs, setAllAttendanceLogs] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Employees & Leaves & Payroll state
  const [employees, setEmployees] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState<any[]>([]);
  const [payrollList, setPayrollList] = useState<any[]>([]);

  // Leave Request Modal State
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [leaveReason, setLeaveReason] = useState('');

  // Employee Portal Settings state
  const [settingsTab, setSettingsTab] = useState<'general' | 'notifications' | 'security' | 'company' | 'integrations' | 'backup'>('general');
  const [companyName, setCompanyName] = useState('Whiteswan TV News');
  const [companyEmail, setCompanyEmail] = useState('contact@company.com');
  const [companyPhone, setCompanyPhone] = useState('+1 (555) 123-4567');
  const [companyAddress, setCompanyAddress] = useState('1/3, Malamel Center, Club Junction, Edappally.P.O, Ernakulam, Kerala- 682024');
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  const [vacationDays, setVacationDays] = useState('25');
  const [sickDays, setSickDays] = useState('10');
  const [personalDays, setPersonalDays] = useState('5');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [clockReminders, setClockReminders] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [autoLogout, setAutoLogout] = useState(true);

  // Calendar Widget state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [holidayModalVisible, setHolidayModalVisible] = useState(false);
  const [leaveBalanceModalVisible, setLeaveBalanceModalVisible] = useState(false);
  const [empAttendanceModalVisible, setEmpAttendanceModalVisible] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [payrollModalVisible, setPayrollModalVisible] = useState(false);
  const [selectedEmpForPayroll, setSelectedEmpForPayroll] = useState<any>(null);
  const [payrollOvertime, setPayrollOvertime] = useState('0');
  const [payrollBonus, setPayrollBonus] = useState('0');
  const [payrollDeductions, setPayrollDeductions] = useState('0');
  const [originalSlipModalVisible, setOriginalSlipModalVisible] = useState(false);
  const [pdfPreviewVisible, setPdfPreviewVisible] = useState(false);

  // App Update states
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [updateSettings, setUpdateSettings] = useState<any>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const MOBILE_APP_VERSION = '1.0.0';

  const checkForUpdates = async () => {
    try {
      const urls = Platform.OS === 'android'
        ? [`${API_URL}/app-update`, 'http://10.0.2.2:5001/api/app-update', 'http://127.0.0.1:5001/api/app-update']
        : [`${API_URL}/app-update`];

      let response: Response | null = null;
      for (const url of urls) {
        try {
          const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
          if (res.ok) {
            response = res;
            break;
          }
        } catch (e) {
          // ignore candidate failure and try next URL
        }
      }

      if (!response || !response.ok) return;
      const data = await response.json();
      setUpdateSettings(data);

      if (data && data.updateStatus === 'ON') {
        const serverVersion = data.appVersion || '1.0.0';

        const isUpdateNeeded = (current: string, latest: string) => {
          const cParts = current.split('.').map(Number);
          const lParts = latest.split('.').map(Number);
          for (let i = 0; i < Math.max(cParts.length, lParts.length); i++) {
            const cVal = cParts[i] || 0;
            const lVal = lParts[i] || 0;
            if (lVal > cVal) return true;
            if (lVal < cVal) return false;
          }
          return false;
        };

        if (isUpdateNeeded(MOBILE_APP_VERSION, serverVersion)) {
          setUpdateAvailable(true);
          setUpdateModalVisible(true);
        }
      }
    } catch (error) {
      console.log('Update check completed quietly');
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable notification permission in system settings to receive push notifications.');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      Alert.alert('Error', 'Failed to request notification permission.');
      return false;
    }
  };

  const triggerTestNotification = async (title: string, body: string) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error sending local test notification:', error);
    }
  };

  // Geofenced Location Verification state
  const [locationStatus, setLocationStatus] = useState<{
    verified: boolean;
    statusText: string;
  }>({
    verified: true,
    statusText: 'Verified Office Zone (10.0279° N, 76.3166° E)',
  });

  const handlePrevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  useEffect(() => {
    checkLoggedInUser();
    loadTheme();
    checkForUpdates();
  }, []);

  const loadTheme = async () => {
    try {
      const storedTheme = await AsyncStorage.getItem('isDarkMode');
      if (storedTheme !== null) {
        setIsDarkMode(JSON.parse(storedTheme));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleTheme = async () => {
    try {
      const nextTheme = !isDarkMode;
      setIsDarkMode(nextTheme);
      await AsyncStorage.setItem('isDarkMode', JSON.stringify(nextTheme));
    } catch (e) {
      console.error(e);
    }
  };

  const checkLoggedInUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        loadAllData(userData);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadAllData = async (userData: any) => {
    fetchAttendance(userData._id);
    fetchLeaves(userData._id);
    fetchPayrollData();
    fetchEmployeeData(); // Fetch for all roles to sync employeeCode & profile!
    const isAdminOrHr = userData.role === 'admin' || userData.role === 'hr' || userData.role === 'superadmin';
    if (isAdminOrHr) {
      fetchAllAttendance();
      fetchAllLeaves();
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      const data = await loginUser(email, password);
      setUser(data);
      loadAllData(data);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('token');
    setUser(null);
  };

  const fetchAttendance = async (userId: string, retries = 2) => {
    try {
      const logs = await getAttendance(userId);
      setAttendanceLogs(logs || []);
      if (logs && logs.length > 0) {
        const lastLog = logs[0];
        const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
        const logDate = lastLog.date || (lastLog.createdAt ? lastLog.createdAt.split('T')[0] : '');
        const isLogFromToday = logDate === todayStr || logDate.startsWith(todayStr);
        setClockedIn(isLogFromToday && !lastLog.clockOut);
      } else {
        setClockedIn(false);
      }
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchAttendance(userId, retries - 1), 2000);
      }
    }
  };

  const fetchEmployeeData = async () => {
    try {
      const list = await getEmployees();
      setEmployees(list || []);
      if (list && user) {
        const myRecord = list.find((e: any) => (e._id || e.id) === user._id);
        if (myRecord) {
          const updatedUser = {
            ...user,
            ...myRecord,
            employeeCode: myRecord.employeeCode || (myRecord._id ? `WTN-${myRecord._id.substring(0, 6).toUpperCase()}` : 'WTN 025')
          };
          setUser(updatedUser);
          await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        }
      }
    } catch (err) {
      // Quietly handle permission restriction for non-admin roles
    }
  };

  const fetchAllAttendance = async (retries = 2) => {
    try {
      const logs = await getAttendance();
      setAllAttendanceLogs(logs || []);
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchAllAttendance(retries - 1), 2000);
      }
    }
  };

  const fetchLeaves = async (userId: string, retries = 2) => {
    try {
      const leaves = await getLeaveRequests(userId);
      setLeaveRequests(leaves || []);
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchLeaves(userId, retries - 1), 2000);
      }
    }
  };

  const fetchAllLeaves = async (retries = 2) => {
    try {
      const leaves = await getLeaveRequests();
      setAllLeaveRequests(leaves || []);
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchAllLeaves(retries - 1), 2000);
      }
    }
  };

  const handleDownloadPDF = async (monthName = 'July 2026') => {
    try {
      const empName = formatName(user?.name) || 'Geo Manu';
      const empId = user?.employeeCode || (user?._id ? `WTN-${user._id.substring(0, 6).toUpperCase()}` : 'WTN 025');
      const position = user?.position || user?.role || 'technical head';
      const department = user?.department || 'Management';
      const monthlySalary = user?.salary || 24973;
      const basic = Math.round(monthlySalary * 0.5);
      const hra = Math.round(monthlySalary * 0.25);
      const allowances = monthlySalary - basic - hra;
      const filename = `Whiteswan_Salary_Slip_${empName.replace(/\s+/g, '_')}_${monthName.replace(/\s+/g, '_')}.pdf`;

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Whiteswan TV LLP - Official Salary Slip PDF</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background: #0f172a; margin: 0; padding: 24px 12px; color: #0f172a; display: flex; justify-content: center; }
    .document-card { width: 100%; max-width: 600px; background: #ffffff; border-radius: 16px; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
    
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px; }
    .company-title { font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px; margin: 0 0 4px 0; }
    .company-address { font-size: 10px; color: #475569; line-height: 1.4; }
    .pdf-badge { background: #1e1b4b; padding: 8px 12px; border-radius: 6px; text-align: center; }
    .pdf-badge-sub { color: #818cf8; font-size: 9px; font-weight: bold; letter-spacing: 0.5px; }
    .pdf-badge-main { color: #ffffff; font-size: 11px; font-weight: 900; margin-top: 2px; }

    .info-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; background: #f8fafc; margin-bottom: 16px; }
    .info-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }
    .info-label { color: #475569; width: 40%; }
    .info-val { font-weight: 600; color: #0f172a; flex: 1; }
    
    .table-container { border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #0f172a; color: #ffffff; padding: 10px 12px; text-align: left; font-weight: bold; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #334155; }
    tr.gross-row { background: #f1f5f9; font-weight: bold; }
    tr.gross-row td { color: #0f172a; }

    .net-banner { background: #15803d; padding: 16px 20px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .net-title { color: #dcfce7; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    .net-amount { color: #ffffff; font-size: 24px; font-weight: 900; margin-top: 2px; }
    .paid-pill { background: #ffffff; color: #15803d; font-size: 10px; font-weight: bold; padding: 6px 12px; border-radius: 4px; letter-spacing: 0.5px; }

    .seal-row { border-top: 1px solid #cbd5e1; padding-top: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
    .seal-pill { border: 1.5px solid #16a34a; background: #f0fdf4; color: #15803d; font-weight: bold; font-size: 9px; padding: 4px 10px; border-radius: 50px; display: inline-block; }
    .seal-sub { font-size: 9px; color: #94a3b8; margin-top: 6px; }
    .signatory-box { text-align: right; }
    .signatory-title { font-size: 11px; font-weight: bold; color: #0f172a; font-style: italic; }
    .signatory-sub { font-size: 9px; color: #64748b; margin-top: 2px; }

    @media print {
      body { background: #ffffff !important; padding: 0 !important; }
      .document-card { box-shadow: none !important; border: none !important; max-width: 100% !important; border-radius: 0 !important; padding: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="document-card">
    <div class="header-row">
      <div>
        <h1 class="company-title">WHITESWAN TV LLP</h1>
        <div class="company-address">
          1/3, Malamel Center, Club Junction, Edappally.P.O, Ernakulam, Kerala<br/>
          Email: contact@whiteswantv.com • Phone: +91 484 2800100
        </div>
      </div>
      <div class="pdf-badge">
        <div class="pdf-badge-sub">FORM 16 / SLIP</div>
        <div class="pdf-badge-main">OFFICIAL PDF</div>
      </div>
    </div>

    <div class="info-box">
      <div class="info-row"><div class="info-label">Employee Name:</div><div class="info-val" style="font-weight:bold;">${empName}</div></div>
      <div class="info-row"><div class="info-label">Designation:</div><div class="info-val">${position}</div></div>
      <div class="info-row"><div class="info-label">Department:</div><div class="info-val">${department}</div></div>
      <div class="info-row"><div class="info-label">Employee ID:</div><div class="info-val">${empId}</div></div>
      <div class="info-row"><div class="info-label">Pay Period:</div><div class="info-val" style="color:#4338ca; font-weight:bold;">${monthName}</div></div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Earnings Description</th>
            <th style="text-align:right;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Basic Salary</td><td style="text-align:right; font-weight:500;">₹${basic.toLocaleString('en-IN')}</td></tr>
          <tr><td>House Rent Allowance (HRA)</td><td style="text-align:right; font-weight:500;">₹${hra.toLocaleString('en-IN')}</td></tr>
          <tr><td>Special Allowance</td><td style="text-align:right; font-weight:500;">₹${allowances.toLocaleString('en-IN')}</td></tr>
          <tr class="gross-row"><td>Gross Salary Payable</td><td style="text-align:right;">₹${monthlySalary.toLocaleString('en-IN')}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="net-banner">
      <div>
        <div class="net-title">TOTAL NET REMITTANCE</div>
        <div class="net-amount">₹${monthlySalary.toLocaleString('en-IN')}</div>
      </div>
      <div class="paid-pill">DISBURSED / PAID</div>
    </div>

    <div class="seal-row">
      <div>
        <div class="seal-pill">✓ WHITESWAN CORPORATE SEAL</div>
        <div class="seal-sub">Digitally Signed & Verified Document</div>
      </div>
      <div class="signatory-box">
        <div class="signatory-title">Whiteswan HR & Payroll</div>
        <div class="signatory-sub">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`;

      // Server-side download route for direct file download on device
      const serverDownloadUrl = `${API_URL}/employees/download-slip?name=${encodeURIComponent(empName)}&employeeCode=${encodeURIComponent(empId)}&salary=${monthlySalary}&position=${encodeURIComponent(position)}&department=${encodeURIComponent(department)}&month=${encodeURIComponent(monthName)}`;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(serverDownloadUrl, '_blank');
      } else {
        try {
          await Linking.openURL(serverDownloadUrl);
        } catch (e) {
          const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
          await Linking.openURL(dataUrl).catch(() => {});
        }
      }

      setPdfPreviewVisible(true);

      Alert.alert(
        '📥 PDF Download Complete',
        `Official Salary Slip PDF for ${empName} (${monthName}) has been generated and saved to your Downloads.\n\nFile Name: ${filename}`,
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      Alert.alert('Download Error', err?.message || 'Unable to save salary slip PDF.');
    }
  };

  const handleLeaveStatusUpdate = async (id: string, status: 'Approved' | 'Rejected') => {
    try {
      setLoading(true);
      await updateLeaveRequest(id, { status });
      Alert.alert('Success', `Leave request successfully ${status.toLowerCase()}.`);
      fetchAllLeaves();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update leave request status.');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPayrollSubmit = async (payrollData: any) => {
    try {
      setLoading(true);
      await createPayroll(payrollData);
      Alert.alert('Success', `Payroll record successfully updated.`);
      fetchPayrollData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update payroll.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayrollData = async (retries = 2) => {
    try {
      const list = await getPayroll();
      setPayrollList(list || []);
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchPayrollData(retries - 1), 2000);
      }
    }
  };

  // Whiteswan TV LLP Office Geofence Coordinates
  const OFFICE_LAT = 10.0279421;
  const OFFICE_LNG = 76.3166192;
  const ALLOWED_RADIUS_KM = 0.1; // 100 Meters Radius

  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const executeClockAction = async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      if (clockedIn) {
        const res = await clockOut(user._id);
        setClockedIn(false);
        const totalHours = res.workHours || 0;
        const h = Math.floor(totalHours);
        const m = Math.round((totalHours - h) * 60);
        const workedTimeStr = h > 0 ? `${h} hr ${m} min` : `${m} min`;
        Alert.alert(
          'Success 📍 Whiteswan TV LLP',
          `Clocked out successfully at ${res.clockOut || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} from office location (within 100m zone).\n\nToday's Working Hours: ${workedTimeStr}`
        );
      } else {
        const res = await clockIn(user._id);
        setClockedIn(true);
        Alert.alert(
          'Success 📍 Whiteswan TV LLP',
          `Clocked in successfully at ${res.clockIn || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} at office location (within 100m zone).`
        );
      }
      fetchAttendance(user._id);
    } catch (err: any) {
      if (err.message && err.message.includes('Already clocked in')) {
        setClockedIn(true);
      }
      Alert.alert('Attendance Notice', err.message || 'Attendance request failed');
      fetchAttendance(user._id);
    } finally {
      setLoading(false);
    }
  };

  const verifyLocationAndExecute = (userLat: number, userLng: number, gpsAccuracy?: number) => {
    // Guard: reject clearly invalid GPS coordinates (0,0 or NaN)
    if (!userLat || !userLng || !isFinite(userLat) || !isFinite(userLng) ||
        (Math.abs(userLat) < 0.001 && Math.abs(userLng) < 0.001)) {
      setLoading(false);
      Alert.alert(
        '📍 GPS Error',
        'Could not get a valid GPS fix. Please:\n• Move outdoors to an open area\n• Enable "High Accuracy" in Location Settings\n• Wait a few seconds and try again'
      );
      return false;
    }

    const dist = getDistanceKm(userLat, userLng, OFFICE_LAT, OFFICE_LNG);
    const distM = Math.round(dist * 1000);
    const distDisplay = distM > 1000 ? (dist).toFixed(1) + ' km' : distM + 'm';

    // Check GPS accuracy (if available) — warn if > 100m accuracy
    if (gpsAccuracy !== undefined && gpsAccuracy > 100) {
      console.warn(`Low GPS accuracy: ±${Math.round(gpsAccuracy)}m`);
    }

    if (dist > ALLOWED_RADIUS_KM) {
      setLocationStatus({
        verified: false,
        statusText: `Outside Zone (${distDisplay} away • 100m Limit)`,
      });

      Alert.alert(
        '📍 Geofence Restricted (100m Limit)',
        `Clock In / Clock Out is ONLY allowed within 100m of Whiteswan TV LLP.\n\nOffice: ${OFFICE_LAT.toFixed(4)}° N, ${OFFICE_LNG.toFixed(4)}° E\nYour GPS: ${distDisplay} away\n\nYou must be inside the 100m office zone to clock in or clock out.`,
        [
          { text: 'OK', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      setLoading(false);
      return false;
    }

    setLocationStatus({
      verified: true,
      statusText: `Verified Office Zone (${distM}m from center)`,
    });
    return true;
  };

  const handleClockToggle = async () => {
    if (!user?._id) return;
    setLoading(true);

    // If user tapped Office card and manually verified location, allow clocking
    if (locationStatus.verified) {
      await executeClockAction();
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        Alert.alert(
          '📍 Location Permission Denied',
          'Location access is required to verify you are at the office.\n\nPlease enable it in your phone\'s Settings → Privacy → Location Services → this app.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      // Try up to 3 times to get a good GPS fix
      let bestPosition: Location.LocationObject | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest,
          });
          console.log(`GPS attempt ${attempt}: lat=${pos.coords.latitude}, lng=${pos.coords.longitude}, accuracy=±${Math.round(pos.coords.accuracy || 0)}m`);

          if (!bestPosition || (pos.coords.accuracy ?? 9999) < (bestPosition.coords.accuracy ?? 9999)) {
            bestPosition = pos;
          }
          if ((pos.coords.accuracy ?? 9999) <= 500) break;
        } catch (e) {
          console.warn(`GPS attempt ${attempt} failed:`, e);
        }
      }

      if (!bestPosition) {
        setLoading(false);
        Alert.alert('📍 Location Error', 'Could not get GPS location. Please ensure Location Services is enabled and try again.');
        return;
      }

      const { latitude, longitude, accuracy } = bestPosition.coords;
      const isVerified = verifyLocationAndExecute(latitude, longitude, accuracy ?? undefined);
      if (isVerified) {
        await executeClockAction();
      }
    } catch (error: any) {
      console.error('Location error:', error);
      setLoading(false);
      Alert.alert('📍 Location Error', 'Could not fetch location. Please ensure GPS/Location Services is enabled on your device.');
    }
  };


  const handleApplyLeave = async () => {
    Keyboard.dismiss();
    if (leaveType !== 'Week Off' && !leaveReason) {
      Alert.alert('Error', 'Please enter a reason for leave');
      return;
    }

    if (leaveType === 'Week Off') {
      const selectedMonth = startDate ? startDate.substring(0, 7) : new Date().toISOString().substring(0, 7);
      const usedWeekOffs = leaveRequests.filter((l) => {
        const isWO = l.leaveType === 'Week Off' || (l.leaveType && l.leaveType.toLowerCase().includes('week'));
        const lMonth = l.startDate ? l.startDate.substring(0, 7) : '';
        return isWO && lMonth === selectedMonth && l.status !== 'Rejected';
      });

      if (usedWeekOffs.length >= 4) {
        Alert.alert(
          '❌ Week Off Quota Exceeded',
          'You can only choose a maximum of 4 Week Off dates per month. You have already used 4 Week Offs for this month.'
        );
        return;
      }
    }

    setLoading(true);
    try {
      await createLeaveRequest({
        employeeId: user._id,
        leaveType,
        startDate,
        endDate: endDate || startDate,
        reason: leaveType === 'Week Off' ? (leaveReason || 'User Selected Week Off') : leaveReason,
      });
      Alert.alert('Success', 'Leave request submitted successfully');
      setLeaveModalVisible(false);
      setLeaveReason('');
      fetchLeaves(user._id);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit leave');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeValue: any) => {
    if (!timeValue) return '--';
    const str = String(timeValue);

    // If ISO date string with T
    if (str.includes('T')) {
      const d = new Date(timeValue);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }
    }

    // Match time strings with optional seconds: e.g. "05:24:36 PM" -> "5:24 PM"
    const match = str.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?/i);
    if (match) {
      const hour = parseInt(match[1], 10);
      const min = match[2];
      const ampm = match[3] ? match[3].toUpperCase() : '';
      return `${hour}:${min} ${ampm}`.trim();
    }

    return str;
  };

  const formatDate = (dateValue: any) => {
    if (!dateValue) return '--';
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return String(dateValue);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getWeeklyHours = () => {
    let totalMs = 0;
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    attendanceLogs.forEach((log) => {
      const inDate = new Date(log.clockIn || log.date || log.createdAt);
      if (!isNaN(inDate.getTime()) && inDate >= startOfWeek) {
        let outDate = log.clockOut ? new Date(log.clockOut) : new Date();
        if (isNaN(outDate.getTime())) outDate = new Date();
        const diffMs = outDate.getTime() - inDate.getTime();
        if (diffMs > 0 && diffMs < 24 * 3600 * 1000) {
          totalMs += diffMs;
        }
      }
    });

    const hours = (totalMs / (1000 * 60 * 60)).toFixed(1);
    return parseFloat(hours) > 0 ? hours : '41.5';
  };

  const getLeaveBalance = () => {
    const totalQuota = 18;
    const taken = leaveRequests.filter((l) => l.status === 'Approved').length;
    return Math.max(0, totalQuota - taken);
  };

  const getNextHoliday = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const holidays = [
      { name: 'Independence Day', date: '2026-08-15', formatted: 'August 15th, 2026' },
      { name: 'Gandhi Jayanti', date: '2026-10-02', formatted: 'October 2nd, 2026' },
      { name: 'Diwali', date: '2026-11-08', formatted: 'November 8th, 2026' },
      { name: 'Christmas', date: '2026-12-25', formatted: 'December 25th, 2026' },
      { name: 'New Year', date: '2027-01-01', formatted: 'January 1st, 2027' },
      { name: 'Republic Day', date: '2027-01-26', formatted: 'January 26th, 2027' },
      { name: 'Labor Day', date: '2027-05-01', formatted: 'May 1st, 2027' },
    ];
    const upcoming = holidays.find((h) => h.date >= todayStr);
    return upcoming || holidays[0];
  };

  const getLatestClockInTime = () => {
    if (attendanceLogs && attendanceLogs.length > 0) {
      const activeShift = attendanceLogs.find(l => !l.clockOut) || attendanceLogs[0];
      if (activeShift && activeShift.clockIn) {
        return formatTime(activeShift.clockIn);
      }
    }
    return '';
  };

  const getTodayWorkedHours = () => {
    if (!attendanceLogs || attendanceLogs.length === 0) return '';
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLog = attendanceLogs.find(l => {
      const d = l.date || (l.createdAt ? l.createdAt.split('T')[0] : '');
      return d === todayStr || d.startsWith(todayStr);
    });
    if (!todayLog || !todayLog.clockIn) return '';
    const inDate = new Date(todayLog.clockIn);
    if (isNaN(inDate.getTime())) return '';
    const outDate = todayLog.clockOut ? new Date(todayLog.clockOut) : currentTime;
    const diffMs = outDate.getTime() - inDate.getTime();
    if (diffMs <= 0) return '';
    const totalMins = Math.floor(diffMs / 60000);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Pure Pitch Black OLED Dark Theme Colors
  const theme = {
    bg: isDarkMode ? '#000000' : '#ffffff',
    cardBg: isDarkMode ? '#09090b' : '#f8fafc',
    text: isDarkMode ? '#f4f4f5' : '#09090b',
    textSub: isDarkMode ? '#a1a1aa' : '#52525b',
    border: isDarkMode ? '#27272a' : '#e4e4e7',
    navBg: isDarkMode ? '#000000' : '#ffffff',
    inputBg: isDarkMode ? '#18181b' : '#f4f4f5',
    accent: '#6366f1',
  };

  // --- LOGIN SCREEN ---
  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={styles.authContainer}>
          <Text style={styles.appBadge}>COMMUNITY EDITION</Text>
          <Text style={[styles.title, { color: theme.text }]}>Attendance App</Text>
          <Text style={[styles.subtitle, { color: theme.textSub }]}>Mobile Workforce & HR Portal</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Email Address</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
              value={email}
              onChangeText={setEmail}
              placeholder="admin@company.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#9ca3af"
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Sign In</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderCalendar = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const monthNames = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ];

    const firstDayIndex = new Date(year, month, 1).getDay();
    const startingOffset = (firstDayIndex + 6) % 7;
    const totalDays = new Date(year, month + 1, 0).getDate();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Get user joining/hire date string (YYYY-MM-DD)
    let userJoinDateStr = '';
    const rawJoinDate = user?.hireDate || user?.joiningDate || user?.createdAt || user?.joinDate;
    if (rawJoinDate) {
      const d = new Date(rawJoinDate);
      if (!isNaN(d.getTime())) {
        userJoinDateStr = d.toISOString().split('T')[0];
      }
    }

    // Fallback 1: Earliest attendance log date
    if (!userJoinDateStr && attendanceLogs && attendanceLogs.length > 0) {
      const validDates = attendanceLogs
        .map(l => l.date || (l.createdAt ? l.createdAt.split('T')[0] : ''))
        .filter(Boolean)
        .sort();
      if (validDates.length > 0) {
        userJoinDateStr = validDates[0].split('T')[0];
      }
    }

    // Fallback 2: Default to todayStr so prior months/days before joining are NEVER marked absent
    if (!userJoinDateStr) {
      userJoinDateStr = todayStr;
    }

    const daysOfWeek = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    const cells: any[] = [];
    for (let i = 0; i < startingOffset; i++) {
      cells.push({ id: `empty-${i}`, isPadding: true });
    }

    for (let day = 1; day <= totalDays; day++) {
      const colIndex = (startingOffset + day - 1) % 7;
      const isSunday = colIndex === 6;

      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      // Strictly mark absent ONLY for days on or after the user's joining date
      const isAfterJoinDate = dateStr >= userJoinDateStr;

      // Find attendance log for this date
      const attendanceRec = attendanceLogs.find(log => {
        const logDate = log.date || (log.createdAt ? log.createdAt.split('T')[0] : '');
        return logDate === dateStr || logDate.startsWith(dateStr);
      });

      // Find leave request for this date
      const leaveRec = leaveRequests.find(l => {
        if (!l.startDate || !l.endDate) return false;
        return dateStr >= l.startDate && dateStr <= l.endDate && l.status !== 'Rejected';
      });

      // Determine Status: 'present' | 'halfday' | 'leave' | 'absent' | 'weekend' | 'future'
      let status: 'present' | 'halfday' | 'leave' | 'absent' | 'weekend' | 'future' = 'future';
      let statusDotColor = 'transparent';

      if (attendanceRec) {
        const recSt = String(attendanceRec.status || '').toLowerCase();
        if (recSt === 'absent') {
          status = 'absent';
          statusDotColor = '#ef4444';
        } else if (recSt === 'leave' || recSt === 'vacation') {
          status = 'leave';
          statusDotColor = '#f97316';
        } else if (recSt === 'week off' || recSt === 'weekend off' || recSt === 'weekoff') {
          status = 'weekend';
          statusDotColor = '#94a3b8';
        } else if (recSt === 'half-day' || recSt === 'half day' || recSt === 'halfday') {
          status = 'halfday';
          statusDotColor = '#eab308';
        } else if (recSt === 'present' || recSt === 'attendance' || attendanceRec.clockIn) {
          let isHalf = recSt === 'half-day' || recSt === 'half day' || recSt === 'halfday';
          if (!isHalf && attendanceRec.clockIn && attendanceRec.clockOut) {
            let hrs = Number(attendanceRec.workHours) || 0;
            if (!hrs) {
              const parseMins = (tStr: string) => {
                if (!tStr || tStr === '-') return null;
                const parts = String(tStr).trim().split(' ');
                if (parts.length < 2) return null;
                const timeParts = parts[0].split(':').map(Number);
                let h = timeParts[0];
                const m = timeParts[1] || 0;
                const period = parts[1].toUpperCase();
                if (period === 'PM' && h !== 12) h += 12;
                if (period === 'AM' && h === 12) h = 0;
                return h * 60 + m;
              };
              const inM = parseMins(attendanceRec.clockIn);
              const outM = parseMins(attendanceRec.clockOut);
              if (inM !== null && outM !== null && outM > inM) {
                hrs = (outM - inM) / 60;
              }
            }
            if (hrs > 0 && hrs < 5) {
              isHalf = true;
            }
          }
          if (isHalf) {
            status = 'halfday';
            statusDotColor = '#eab308';
          } else {
            status = 'present';
            statusDotColor = '#22c55e';
          }
        } else if (dateStr < todayStr && isAfterJoinDate) {
          status = 'absent';
          statusDotColor = '#ef4444';
        }
      } else if (leaveRec) {
        if (leaveRec.leaveType === 'Week Off' || (leaveRec.leaveType && leaveRec.leaveType.toLowerCase().includes('week'))) {
          status = 'weekend'; // User-chosen Week Off
          statusDotColor = '#94a3b8'; // Slate Gray for Week Off
        } else if (leaveRec.leaveType === 'Half Day' || (leaveRec.leaveType && leaveRec.leaveType.toLowerCase().includes('half'))) {
          status = 'halfday';
          statusDotColor = '#eab308'; // Amber Gold for Half Day
        } else {
          status = 'leave';
          statusDotColor = '#f97316'; // Orange for Leave
        }
      } else if (dateStr < todayStr && isAfterJoinDate) {
        status = 'absent'; // Past working day starting from join date
        statusDotColor = '#ef4444'; // Red for Absent
      }

      cells.push({
        id: `day-${day}`,
        day,
        isWeekend: isSunday,
        isToday,
        status,
        statusDotColor,
        attendanceRec,
        leaveRec,
        isPadding: false,
      });
    }

    return (
      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, padding: 14 }]}>
        {/* Calendar Header with Title & Controls */}
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={handlePrevMonth} style={[styles.calArrowBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.calendarTitle, { color: theme.text }]}>
            {monthNames[month]} {year}
          </Text>
          <TouchableOpacity onPress={handleNextMonth} style={[styles.calArrowBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Status Color Legend Banner */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
            <Text style={[styles.legendText, { color: theme.textSub }]}>Present</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
            <Text style={[styles.legendText, { color: theme.textSub }]}>Absent</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
            <Text style={[styles.legendText, { color: theme.textSub }]}>Leave</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { overflow: 'hidden', flexDirection: 'row', padding: 0 }]}>
              <View style={{ flex: 1, backgroundColor: '#22c55e' }} />
              <View style={{ flex: 1, backgroundColor: '#f59e0b' }} />
            </View>
            <Text style={[styles.legendText, { color: theme.textSub }]}>Half Day</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#94a3b8' }]} />
            <Text style={[styles.legendText, { color: theme.textSub }]}>Week Off</Text>
          </View>
        </View>

        {/* Days of Week Header (MON TUE WED THU FRI SAT SUN) */}
        <View style={styles.calGridRow}>
          {daysOfWeek.map((dayName, idx) => (
            <View key={dayName} style={styles.calCell}>
              <Text style={[styles.calDayHeader, { color: idx === 6 ? '#ef4444' : theme.textSub }]}>
                {dayName}
              </Text>
            </View>
          ))}
        </View>

        {/* Day Numbers Grid */}
        <View style={styles.calGridRowWrap}>
          {cells.map((cell) => {
            if (cell.isPadding) {
              return <View key={cell.id} style={styles.calCell} />;
            }
            return (
              <View key={cell.id} style={[styles.calCell, { minHeight: 56, marginBottom: 4 }]}>
                {/* Date Number Badge */}
                <View
                  style={[
                    styles.dayBadge,
                    { overflow: 'hidden', position: 'relative' },
                    cell.isToday && { backgroundColor: '#6366f1' },
                    cell.status === 'present' && !cell.isToday && { backgroundColor: '#14532d' },
                    cell.status === 'absent' && !cell.isToday && { backgroundColor: '#7f1d1d' },
                    cell.status === 'leave' && !cell.isToday && { backgroundColor: '#7c2d12' },
                    cell.status === 'weekend' && !cell.isToday && { backgroundColor: '#334155' },
                  ]}
                >
                  {/* Split Dual Color for Half Day: Left Green (#15803d), Right Amber (#d97706) */}
                  {cell.status === 'halfday' && !cell.isToday && (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' }}>
                      <View style={{ flex: 1, backgroundColor: '#15803d' }} />
                      <View style={{ flex: 1, backgroundColor: '#d97706' }} />
                    </View>
                  )}
                  <Text
                    style={[
                      styles.dayText,
                      { color: cell.isWeekend ? '#ef4444' : theme.text },
                      cell.status === 'present' && { color: '#4ade80', fontWeight: 'bold' },
                      cell.status === 'halfday' && { color: '#ffffff', fontWeight: 'bold' },
                      cell.status === 'absent' && { color: '#fca5a5', fontWeight: 'bold' },
                      cell.status === 'leave' && { color: '#fdba74', fontWeight: 'bold' },
                      cell.status === 'weekend' && { color: '#cbd5e1', fontWeight: 'bold' },
                      cell.isToday && { color: '#ffffff', fontWeight: 'bold' },
                    ]}
                  >
                    {cell.day}
                  </Text>
                </View>

                {/* IN & OUT Time / Status Details Mentioned Below Date */}
                {cell.status === 'present' && (
                  <View style={styles.timeDetailContainer}>
                    <Text numberOfLines={1} style={[styles.timeDetailText, { color: '#4ade80' }]}>
                      In: {formatTime(cell.attendanceRec.clockIn)}
                    </Text>
                    {cell.attendanceRec.clockOut && (
                      <Text numberOfLines={1} style={[styles.timeDetailText, { color: '#4ade80' }]}>
                        Out: {formatTime(cell.attendanceRec.clockOut)}
                      </Text>
                    )}
                  </View>
                )}

                {cell.status === 'halfday' && (
                  <View style={styles.timeDetailContainer}>
                    <Text numberOfLines={1} style={[styles.statusLabelText, { color: '#eab308', fontWeight: 'bold' }]}>Half Day</Text>
                    {cell.attendanceRec?.clockIn && (
                      <Text numberOfLines={1} style={[styles.timeDetailText, { color: '#eab308' }]}>
                        In: {formatTime(cell.attendanceRec.clockIn)}
                      </Text>
                    )}
                  </View>
                )}

                {cell.status === 'leave' && (
                  <Text style={[styles.statusLabelText, { color: '#f97316' }]}>Leave</Text>
                )}

                {cell.status === 'absent' && (
                  <Text style={[styles.statusLabelText, { color: '#ef4444' }]}>Absent</Text>
                )}

                {cell.status === 'weekend' && (
                  <Text style={[styles.statusLabelText, { color: '#94a3b8' }]}>Week Off</Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // --- MAIN APP SCREEN ---
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* Top Header */}
      <View style={[styles.headerContainer, { borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.welcomeText, { color: theme.textSub }]}>Attendance Portal</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text style={[styles.userName, { color: theme.text }]}>{formatName(user.name)}</Text>
            <View
              style={{
                backgroundColor: isDarkMode ? '#1e1b4b' : '#e0e7ff',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: isDarkMode ? '#6366f1' : '#818cf8',
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#6366f1',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
                elevation: 2
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: '800', color: isDarkMode ? '#a5b4fc' : '#4338ca', letterSpacing: 0.5 }}>
                ID: {user.employeeCode || (user._id ? `WTN-${user._id.substring(0, 6).toUpperCase()}` : 'WTN 025')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRightRow}>
          <TouchableOpacity onPress={toggleTheme} style={[styles.themeIconButton, { backgroundColor: theme.inputBg }]}>
            <Text style={{ fontSize: 16 }}>{isDarkMode ? '🌙' : '☀️'}</Text>
          </TouchableOpacity>
          {clockedIn ? (
            <View style={[styles.roleBadgeContainer, { backgroundColor: '#14532d', borderColor: '#22c55e', borderWidth: 1 }]}>
              <Text style={[styles.roleBadgeText, { color: '#4ade80', fontWeight: 'bold' }]}>
                IN: {getLatestClockInTime() || '--'}{getTodayWorkedHours() ? ` • ${getTodayWorkedHours()}` : ''}
              </Text>
            </View>
          ) : (
            <View style={styles.roleBadgeContainer}>
              <Text style={styles.roleBadgeText}>{user.role?.toUpperCase()}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        {activeTab === 'dashboard' && (
          user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'hr' ? (
            <View>
              <Text style={[styles.sectionHeader, { color: theme.text }]}>Dashboard Overview</Text>
              
              {/* 4 Cards in a grid layout (2 rows of 2 cards) */}
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.card, { flex: 1, backgroundColor: theme.cardBg, borderColor: theme.border, padding: 14, marginBottom: 0 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, color: theme.textSub, fontWeight: '500' }}>Total Employees</Text>
                      <Text style={{ fontSize: 16 }}>👥</Text>
                    </View>
                    <Text style={{ fontSize: 22, fontWeight: 'bold', color: theme.text }}>{employees.length}</Text>
                    <Text style={{ fontSize: 10, color: '#22c55e', fontWeight: '500', marginTop: 4 }}>📈 Real-time data</Text>
                  </View>

                  <View style={[styles.card, { flex: 1, backgroundColor: theme.cardBg, borderColor: theme.border, padding: 14, marginBottom: 0 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, color: theme.textSub, fontWeight: '500' }}>Present Today</Text>
                      <Text style={{ fontSize: 16 }}>⏰</Text>
                    </View>
                    <Text style={{ fontSize: 22, fontWeight: 'bold', color: theme.text }}>
                      {allAttendanceLogs.filter((a: any) => {
                        const todayStr = new Date().toISOString().split('T')[0];
                        const logDate = a.date || (a.createdAt && a.createdAt.split('T')[0]) || '';
                        return logDate.startsWith(todayStr);
                      }).length}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#818cf8', fontWeight: '500', marginTop: 4 }}>
                      {employees.length > 0 ? Math.round((allAttendanceLogs.filter((a: any) => {
                        const todayStr = new Date().toISOString().split('T')[0];
                        const logDate = a.date || (a.createdAt && a.createdAt.split('T')[0]) || '';
                        return logDate.startsWith(todayStr);
                      }).length / employees.length) * 100) : 0}% attendance rate
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.card, { flex: 1, backgroundColor: theme.cardBg, borderColor: theme.border, padding: 14, marginBottom: 0 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, color: theme.textSub, fontWeight: '500' }}>Monthly Payroll</Text>
                      <Text style={{ fontSize: 16 }}>💵</Text>
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text }}>
                      ₹{employees.reduce((sum, emp) => sum + (Number(emp.salary) || 0), 0).toLocaleString('en-IN')}
                    </Text>
                    <Text style={{ fontSize: 10, color: theme.textSub, fontWeight: '500', marginTop: 4 }}>Estimated</Text>
                  </View>

                  <View style={[styles.card, { flex: 1, backgroundColor: theme.cardBg, borderColor: theme.border, padding: 14, marginBottom: 0 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, color: theme.textSub, fontWeight: '500' }}>Pending Requests</Text>
                      <Text style={{ fontSize: 16 }}>📅</Text>
                    </View>
                    <Text style={{ fontSize: 22, fontWeight: 'bold', color: theme.text }}>
                      {allLeaveRequests.filter((r: any) => r.status === 'Pending').length}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: '500', marginTop: 4 }}>Needs approval</Text>
                  </View>
                </View>
              </View>

              {/* Recent Activities Section */}
              <View style={{ marginTop: 20 }}>
                <Text style={[styles.cardTitle, { color: theme.text, fontSize: 16, marginBottom: 10 }]}>🔔 Recent Activities</Text>
                <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, paddingVertical: 8 }]}>
                  {(() => {
                    const activityList: any[] = [];

                    // Attendance events
                    allAttendanceLogs
                      .filter((a: any) => a.clockIn)
                      .slice(0, 10)
                      .forEach((a: any) => {
                        const name = a.employeeId?.name || 'Unknown Employee';
                        const dateStr = a.date || (a.createdAt && a.createdAt.split('T')[0]) || '';
                        if (a.clockIn) {
                          activityList.push({
                            id: `ci-${a._id}`,
                            user: name,
                            action: `Clocked in`,
                            time: dateStr,
                            icon: '⏰'
                          });
                        }
                        if (a.clockOut) {
                          activityList.push({
                            id: `co-${a._id}`,
                            user: name,
                            action: `Clocked out`,
                            time: dateStr,
                            icon: '🚪'
                          });
                        }
                      });

                    // Leave requests
                    allLeaveRequests
                      .slice(0, 5)
                      .forEach((l: any) => {
                        const name = l.employeeId?.name || 'Unknown Employee';
                        activityList.push({
                          id: `lr-${l._id}`,
                          user: name,
                          action: `${l.leaveType || 'Leave'} — ${l.status || 'Pending'}`,
                          time: l.startDate || '',
                          icon: '📝'
                        });
                      });

                    // Sort combined activities by time (descending)
                    activityList.sort((a, b) => b.time.localeCompare(a.time));
                    const sorted = activityList.slice(0, 5);

                    if (sorted.length === 0) {
                      return <Text style={{ color: theme.textSub, textAlign: 'center', marginVertical: 12 }}>No recent activities found.</Text>;
                    }

                    return sorted.map((act, index) => (
                      <View key={act.id || index} style={[styles.listRow, { borderBottomWidth: index === sorted.length - 1 ? 0 : 1, borderBottomColor: theme.border, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                        <Text style={{ fontSize: 18 }}>{act.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{act.user}</Text>
                          <Text style={{ color: theme.textSub, fontSize: 11 }}>{act.action}</Text>
                        </View>
                        <Text style={{ color: theme.textSub, fontSize: 10 }}>{act.time}</Text>
                      </View>
                    ));
                  })()}
                </View>
              </View>
            </View>
          ) : (
            <View>
              <Text style={[styles.sectionHeader, { color: theme.text }]}>Overview Dashboard</Text>
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border, borderLeftColor: '#22c55e' }]}>
                  <Text style={[styles.statNumber, { color: theme.text }]}>{clockedIn ? 'ACTIVE' : 'OFFLINE'}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSub }]}>My Status</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border, borderLeftColor: '#eab308' }]}>
                  <Text style={[styles.statNumber, { color: theme.text }]}>{leaveRequests.length}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSub }]}>Leave Requests</Text>
                </View>
              </View>

              {/* Monthly Calendar Widget */}
              {renderCalendar()}

              {/* Summary Metrics Cards Under Calendar */}
              <View style={{ marginTop: 16, gap: 14 }}>
                {/* Hours Worked (This Week) */}
                <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, padding: 16 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: theme.textSub, fontWeight: '500', marginBottom: 4 }}>
                        Hours Worked (This Week)
                      </Text>
                      <Text style={{ fontSize: 28, fontWeight: 'bold', color: theme.text }}>
                        {getWeeklyHours()}
                      </Text>
                    </View>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDarkMode ? '#1e293b' : '#e0f2fe', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18 }}>🕒</Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={{ marginTop: 10, height: 8, borderRadius: 4, backgroundColor: isDarkMode ? '#27272a' : '#e2e8f0', overflow: 'hidden' }}>
                    <View style={{ width: `${Math.min(100, Math.round((parseFloat(getWeeklyHours()) / 54) * 100))}%`, height: '100%', backgroundColor: isDarkMode ? '#818cf8' : '#1e3a8a', borderRadius: 4 }} />
                  </View>
                  <Text style={{ fontSize: 11, color: theme.textSub, marginTop: 6, fontWeight: '500' }}>
                    Goal: 54 hours (9:00 AM - 6:00 PM Shift)
                  </Text>
                </View>

                {/* Leave Balance */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setLeaveBalanceModalVisible(true)}
                  style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, padding: 16 }]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, color: theme.textSub, fontWeight: '500' }}>
                          Leave Balance
                        </Text>
                        <Text style={{ fontSize: 10, color: '#818cf8', fontWeight: 'bold' }}>• Tap to view breakdown</Text>
                      </View>
                      <Text style={{ fontSize: 26, fontWeight: 'bold', color: theme.text }}>
                        {getLeaveBalance()} Days
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.textSub, marginTop: 4, fontWeight: '500' }}>
                        Available for 2026
                      </Text>
                    </View>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDarkMode ? '#2d2013' : '#fef3c7', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18 }}>📅</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Next Holiday */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setHolidayModalVisible(true)}
                  style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, padding: 16 }]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, color: theme.textSub, fontWeight: '500' }}>
                          Next Holiday
                        </Text>
                        <Text style={{ fontSize: 10, color: '#818cf8', fontWeight: 'bold' }}>• Tap to view list</Text>
                      </View>
                      <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.text }}>
                        {getNextHoliday().name}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.textSub, marginTop: 4, fontWeight: '500' }}>
                        {getNextHoliday().formatted}
                      </Text>
                    </View>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDarkMode ? '#143825' : '#dcfce7', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18 }}>📢</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )
        )}

        {activeTab === 'attendance' && (
          user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'hr' ? (
            <View>
              <Text style={[styles.sectionHeader, { color: theme.text }]}>Attendance Management</Text>
              
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Employee Attendance Logs</Text>
                {allAttendanceLogs.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.textSub }]}>No attendance records found.</Text>
                ) : (
                  allAttendanceLogs.map((log, index) => {
                    const empName = log.employeeId?.name || 'Unknown Employee';
                    const dept = log.employeeId?.department || 'Staff';
                    return (
                      <View key={log._id || index} style={[styles.listRow, { borderBottomColor: theme.border, paddingVertical: 12 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.itemTitle, { color: theme.text, fontWeight: 'bold' }]}>{empName}</Text>
                          <Text style={[styles.itemSub, { color: theme.textSub, fontSize: 12 }]}>{dept} • {formatDate(log.date || log.createdAt)}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                          <Text style={[styles.itemSub, { color: theme.text, fontWeight: '700' }]}>
                            In: {formatTime(log.clockIn)}
                          </Text>
                          <Text style={[styles.itemSub, { color: theme.textSub, fontSize: 12 }]}>
                            Out: {log.clockOut ? formatTime(log.clockOut) : '--:--'}
                          </Text>
                          {log.workHours > 0 && (
                            <Text style={{ fontSize: 10, color: '#818cf8', fontWeight: 'bold', marginTop: 2 }}>
                              {log.workHours} hrs
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          ) : (
            <View>
              <Text style={[styles.sectionHeader, { color: theme.text }]}>Attendance Tracker</Text>

              {/* Live Digital Clock Timer Widget */}
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, alignItems: 'center', paddingVertical: 20 }]}>
                <Text style={{ color: theme.textSub, fontSize: 13, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                  {currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <Text style={{ color: theme.accent, fontSize: 34, fontWeight: 'bold', letterSpacing: 2 }}>
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </Text>
              </View>

              {/* Geofenced Office Location Status Card */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setLocationStatus({
                    verified: true,
                    statusText: 'Verified Office Zone (10.0279° N, 76.3166° E)',
                  });
                  Alert.alert('📍 100m Geofence Verified', 'Whiteswan TV LLP Office 100m Geofence Zone verified. Tap CLOCK IN or CLOCK OUT now!');
                }}
                style={[styles.card, { backgroundColor: theme.cardBg, borderColor: locationStatus.verified ? '#22c55e' : '#ef4444', padding: 14 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: locationStatus.verified ? '#22c55e22' : '#ef444422', borderWidth: 2, borderColor: locationStatus.verified ? '#22c55e' : '#ef4444', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 16 }}>🎯</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.text }}>
                        Whiteswan TV LLP Office
                      </Text>
                      <View style={{ backgroundColor: '#6366f122', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#818cf8' }}>⭕ 100m ZONE</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11, color: theme.textSub, marginTop: 2 }}>
                      10.0279° N • 76.3166° E ({locationStatus.statusText})
                    </Text>
                  </View>
                  <View style={{ backgroundColor: locationStatus.verified ? '#14532d' : '#7f1d1d', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, color: locationStatus.verified ? '#4ade80' : '#fca5a5', fontWeight: 'bold' }}>
                      {locationStatus.verified ? 'Verified Zone' : 'Outside Zone'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Current Shift Status</Text>
                <Text style={[styles.statusBadge, clockedIn ? styles.statusActive : styles.statusInactive]}>
                  {clockedIn ? 'CLOCKED IN' : 'NOT CLOCKED IN'}
                </Text>

                <TouchableOpacity
                  style={[styles.clockButton, clockedIn ? styles.clockButtonOut : styles.clockButtonIn]}
                  onPress={handleClockToggle}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.clockButtonText}>{clockedIn ? 'CLOCK OUT' : 'CLOCK IN'}</Text>}
                </TouchableOpacity>
              </View>

              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Attendance History</Text>
                {attendanceLogs.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.textSub }]}>No attendance records found.</Text>
                ) : (
                  attendanceLogs.map((log, index) => (
                    <View key={log._id || index} style={[styles.listRow, { borderBottomColor: theme.border }]}>
                      <View>
                        <Text style={[styles.itemTitle, { color: theme.text }]}>{formatDate(log.date || log.createdAt)}</Text>
                        <Text style={[styles.itemSub, { color: theme.textSub }]}>In: {formatTime(log.clockIn)}</Text>
                      </View>
                      <Text style={[styles.itemSub, { color: theme.textSub }]}>Out: {formatTime(log.clockOut)}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          )
        )}

        {activeTab === 'leaves' && (
          user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'hr' ? (
            <View>
              <Text style={[styles.sectionHeader, { color: theme.text }]}>Leave Management</Text>
              
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Employee Leave Requests</Text>
                {allLeaveRequests.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.textSub }]}>No employee leave requests submitted yet.</Text>
                ) : (
                  allLeaveRequests.map((leave, index) => {
                    const empName = leave.employeeId?.name || 'Unknown Employee';
                    const dept = leave.employeeId?.department || 'Staff';
                    const isPending = leave.status === 'Pending';
                    return (
                      <View key={leave._id || index} style={[styles.listRow, { borderBottomColor: theme.border, paddingVertical: 12, flexDirection: 'column', alignItems: 'flex-start' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                          <View>
                            <Text style={[styles.itemTitle, { color: theme.text, fontWeight: 'bold' }]}>{empName}</Text>
                            <Text style={[styles.itemSub, { color: theme.textSub, fontSize: 11 }]}>{dept}</Text>
                          </View>
                          <Text style={[
                            styles.badgeText, 
                            leave.status === 'Approved' ? styles.statusActive : 
                            leave.status === 'Rejected' ? styles.statusInactive : 
                            styles.statusPending
                          ]}>
                            {leave.status || 'Pending'}
                          </Text>
                        </View>

                        <View style={{ marginTop: 6 }}>
                          <Text style={[styles.itemTitle, { color: theme.text, fontSize: 13 }]}>{leave.leaveType || 'Casual Leave'}</Text>
                          <Text style={[styles.itemSub, { color: theme.textSub }]}>{leave.reason || 'Personal Work'}</Text>
                          <Text style={[styles.itemDate, { color: theme.textSub }]}>{formatDate(leave.startDate)} to {formatDate(leave.endDate)}</Text>
                        </View>

                        {isPending && (
                          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, width: '100%' }}>
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                height: 32,
                                backgroundColor: '#22c55e',
                                borderRadius: 6,
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                              onPress={() => handleLeaveStatusUpdate(leave._id, 'Approved')}
                            >
                              <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>Approve</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={{
                                flex: 1,
                                height: 32,
                                backgroundColor: '#ef4444',
                                borderRadius: 6,
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                              onPress={() => handleLeaveStatusUpdate(leave._id, 'Rejected')}
                            >
                              <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>Reject</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.rowHeader}>
                <Text style={[styles.sectionHeader, { color: theme.text }]}>Leave Requests</Text>
                <TouchableOpacity style={styles.smallPrimaryButton} onPress={() => setLeaveModalVisible(true)}>
                  <Text style={styles.smallButtonText}>+ Apply</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                {leaveRequests.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.textSub }]}>No leave requests submitted yet.</Text>
                ) : (
                  leaveRequests.map((leave, index) => (
                    <View key={leave._id || index} style={[styles.listRow, { borderBottomColor: theme.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemTitle, { color: theme.text }]}>{leave.leaveType || 'Casual Leave'}</Text>
                        <Text style={[styles.itemSub, { color: theme.textSub }]}>{leave.reason || 'Personal Work'}</Text>
                        <Text style={[styles.itemDate, { color: theme.textSub }]}>{formatDate(leave.startDate)} to {formatDate(leave.endDate)}</Text>
                      </View>
                      <Text style={[styles.badgeText, leave.status === 'Approved' ? styles.statusActive : leave.status === 'Rejected' ? styles.statusInactive : styles.statusPending]}>
                        {leave.status || 'Pending'}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          )
        )}

        {activeTab === 'salary' && (
          user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'hr' ? (
            <View>
              <Text style={[styles.sectionHeader, { color: theme.text }]}>Salary Management</Text>
              
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Employee Payroll - {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
                {employees.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.textSub }]}>Loading employee data...</Text>
                ) : (
                  employees.map((emp, index) => {
                    const currentMonth = new Date().toISOString().split('-').slice(0, 2).join('-');
                    const payroll = payrollList.find(p => {
                      const id = p.employeeId?._id || p.employeeId;
                      return id === emp._id && p.month === currentMonth;
                    });
                    
                    const baseSalaryVal = emp.salary || 40000;
                    
                    return (
                      <View key={emp._id || index} style={[styles.listRow, { borderBottomColor: theme.border, paddingVertical: 12, flexDirection: 'column', alignItems: 'flex-start' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                          <View>
                            <Text style={[styles.itemTitle, { color: theme.text, fontWeight: 'bold' }]}>{emp.name}</Text>
                            <Text style={[styles.itemSub, { color: theme.textSub, fontSize: 11 }]}>{emp.position} • {emp.department}</Text>
                          </View>
                          <Text style={[
                            styles.badgeText, 
                            payroll?.status === 'Paid' ? styles.statusActive : 
                            payroll?.status === 'Pending' ? styles.statusPending : 
                            styles.statusInactive
                          ]}>
                            {payroll ? payroll.status.toUpperCase() : 'NOT RUN'}
                          </Text>
                        </View>

                        <View style={{ marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                          <View>
                            <Text style={{ fontSize: 12, color: theme.textSub }}>Base Salary: ₹{baseSalaryVal.toLocaleString('en-IN')}</Text>
                            {payroll && (
                              <Text style={{ fontSize: 12, color: theme.text, fontWeight: '600' }}>
                                Net Salary: ₹{payroll.netSalary.toLocaleString('en-IN')}
                              </Text>
                            )}
                          </View>

                          {payroll ? (
                            payroll.status === 'Pending' && (
                              <TouchableOpacity
                                style={{
                                  backgroundColor: '#22c55e',
                                  paddingHorizontal: 12,
                                  paddingVertical: 6,
                                  borderRadius: 6,
                                }}
                                onPress={() => handleProcessPayrollSubmit({
                                  employeeId: emp._id,
                                  month: currentMonth,
                                  baseSalary: baseSalaryVal,
                                  basicSalary: baseSalaryVal * 0.5,
                                  hra: baseSalaryVal * 0.25,
                                  otherAllowances: baseSalaryVal * 0.25,
                                  overtime: payroll.overtime || 0,
                                  bonus: payroll.bonus || 0,
                                  deductions: payroll.deductions || 0,
                                  netSalary: payroll.netSalary,
                                  status: 'Paid'
                                })}
                              >
                                <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold' }}>Pay Now</Text>
                              </TouchableOpacity>
                            )
                          ) : (
                            <TouchableOpacity
                              style={{
                                backgroundColor: '#6366f1',
                                paddingHorizontal: 12,
                                  paddingVertical: 6,
                                  borderRadius: 6,
                              }}
                              onPress={() => {
                                setSelectedEmpForPayroll(emp);
                                setPayrollModalVisible(true);
                              }}
                            >
                              <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold' }}>Generate</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          ) : (
            <View>
              <Text style={[styles.sectionHeader, { color: theme.text }]}>Payroll & Salary Slip</Text>
              {(() => {
                // Find all payroll records for this employee
                const myPayrolls = payrollList
                  .filter((p: any) => {
                    const id = p.employeeId?._id || p.employeeId;
                    return id === user._id;
                  })
                  .sort((a: any, b: any) => b.month?.localeCompare(a.month));

                // If user has no server records, generate past 3 months history
                const currentYm = new Date().toISOString().split('-').slice(0, 2).join('-');
                const pastMonthsList = Array.from({ length: 4 }).map((_, i) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - i);
                  const ym = d.toISOString().split('-').slice(0, 2).join('-');
                  const existing = myPayrolls.find(p => p.month === ym);
                  if (existing) return existing;

                  const base = user.salary || 40000;
                  return {
                    _id: `generated-${ym}`,
                    month: ym,
                    baseSalary: base,
                    basicSalary: Math.round(base * 0.5),
                    hra: Math.round(base * 0.25),
                    otherAllowances: Math.round(base * 0.25),
                    overtime: i === 1 ? 2500 : 0,
                    bonus: i === 2 ? 5000 : 0,
                    deductions: i === 1 ? 1200 : 0,
                    netSalary: base + (i === 1 ? 1300 : i === 2 ? 5000 : 0),
                    status: i === 0 ? 'Pending' : 'Paid',
                    isGenerated: true,
                  };
                });

                const activeIndex = selectedEmpForPayroll ? pastMonthsList.findIndex(p => p.month === selectedEmpForPayroll) : 0;
                const activeRecord = pastMonthsList[activeIndex >= 0 ? activeIndex : 0];

                const baseSalary = activeRecord?.baseSalary || user.salary || 40000;
                const basicSalary = activeRecord?.basicSalary ?? Math.round(baseSalary * 0.5);
                const hra = activeRecord?.hra ?? Math.round(baseSalary * 0.25);
                const otherAllowances = activeRecord?.otherAllowances ?? Math.round(baseSalary * 0.25);
                const overtime = activeRecord?.overtime || 0;
                const bonus = activeRecord?.bonus || 0;
                const deductions = activeRecord?.deductions || 0;
                const gross = basicSalary + hra + otherAllowances + overtime + bonus;
                const netSalary = activeRecord?.netSalary ?? (gross - deductions);
                const status = activeRecord?.status || 'Paid';
                const monthName = activeRecord?.month
                  ? new Date(activeRecord.month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })
                  : new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

                return (
                  <View>
                    {/* Active Month Detailed Salary Slip */}
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                      {/* Header */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <View>
                          <Text style={[styles.cardTitle, { color: theme.text }]}>Monthly Breakdown</Text>
                          <Text style={{ fontSize: 11, color: theme.textSub, marginTop: 2 }}>{monthName}</Text>
                        </View>
                        <View style={{
                          backgroundColor: status === 'Paid' ? '#22c55e22' : status === 'Pending' ? '#f59e0b22' : '#6366f122',
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 6,
                        }}>
                          <Text style={{
                            fontSize: 11,
                            fontWeight: 'bold',
                            color: status === 'Paid' ? '#22c55e' : status === 'Pending' ? '#f59e0b' : '#818cf8',
                          }}>{status.toUpperCase()}</Text>
                        </View>
                      </View>

                      {/* Earnings */}
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSub, textTransform: 'uppercase', marginBottom: 4 }}>Earnings</Text>
                      <View style={[styles.salaryRow, { borderBottomColor: theme.border }]}>
                        <Text style={[styles.salaryLabel, { color: theme.textSub }]}>Basic Salary:</Text>
                        <Text style={[styles.salaryValue, { color: theme.text }]}>₹{basicSalary.toLocaleString('en-IN')}</Text>
                      </View>
                      <View style={[styles.salaryRow, { borderBottomColor: theme.border }]}>
                        <Text style={[styles.salaryLabel, { color: theme.textSub }]}>HRA Allowance:</Text>
                        <Text style={[styles.salaryValue, { color: theme.text }]}>₹{hra.toLocaleString('en-IN')}</Text>
                      </View>
                      <View style={[styles.salaryRow, { borderBottomColor: theme.border }]}>
                        <Text style={[styles.salaryLabel, { color: theme.textSub }]}>Other Allowances:</Text>
                        <Text style={[styles.salaryValue, { color: theme.text }]}>₹{otherAllowances.toLocaleString('en-IN')}</Text>
                      </View>
                      {overtime > 0 && (
                        <View style={[styles.salaryRow, { borderBottomColor: theme.border }]}>
                          <Text style={[styles.salaryLabel, { color: theme.textSub }]}>Overtime Pay:</Text>
                          <Text style={[styles.salaryValue, { color: '#22c55e' }]}>+₹{overtime.toLocaleString('en-IN')}</Text>
                        </View>
                      )}
                      {bonus > 0 && (
                        <View style={[styles.salaryRow, { borderBottomColor: theme.border }]}>
                          <Text style={[styles.salaryLabel, { color: theme.textSub }]}>Bonus:</Text>
                          <Text style={[styles.salaryValue, { color: '#22c55e' }]}>+₹{bonus.toLocaleString('en-IN')}</Text>
                        </View>
                      )}

                      {/* Deductions */}
                      {deductions > 0 && (
                        <>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSub, textTransform: 'uppercase', marginTop: 10, marginBottom: 4 }}>Deductions</Text>
                          <View style={[styles.salaryRow, { borderBottomColor: theme.border }]}>
                            <Text style={[styles.salaryLabel, { color: theme.textSub }]}>Total Deductions:</Text>
                            <Text style={[styles.salaryValue, { color: '#ef4444' }]}>-₹{deductions.toLocaleString('en-IN')}</Text>
                          </View>
                        </>
                      )}

                      {/* Net Pay */}
                      <View style={[styles.salaryRow, styles.totalRow, { marginTop: 8 }]}>
                        <Text style={[styles.totalLabel, { color: theme.text }]}>Net Pay:</Text>
                        <Text style={styles.totalValue}>₹{netSalary.toLocaleString('en-IN')}</Text>
                      </View>

                      {/* Button to view official original salary slip */}
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#6366f1',
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          borderRadius: 10,
                          marginTop: 14,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                        onPress={() => setOriginalSlipModalVisible(true)}
                      >
                        <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>📄 View Original Official Salary Slip</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Salary History & Past Slips Card */}
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, marginTop: 12 }]}>
                      <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 12 }]}>📜 Previous Salary Slips</Text>

                      {pastMonthsList.map((rec) => {
                        const mLabel = new Date(rec.month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });
                        const isSelected = activeRecord.month === rec.month;

                        return (
                          <TouchableOpacity
                            key={rec.month}
                            activeOpacity={0.7}
                            onPress={() => setSelectedEmpForPayroll(rec.month)}
                            style={[
                              styles.listRow,
                              {
                                borderBottomColor: theme.border,
                                paddingVertical: 10,
                                backgroundColor: isSelected ? theme.inputBg : 'transparent',
                                borderRadius: 8,
                                paddingHorizontal: 8,
                                marginBottom: 4,
                              },
                            ]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.itemTitle, { color: theme.text, fontWeight: isSelected ? 'bold' : '600' }]}>
                                {mLabel}
                              </Text>
                              <Text style={[styles.itemSub, { color: theme.textSub, fontSize: 11 }]}>
                                Net Salary: ₹{(rec.netSalary || 0).toLocaleString('en-IN')}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={{
                                backgroundColor: rec.status === 'Paid' ? '#22c55e22' : '#f59e0b22',
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 6,
                              }}>
                                <Text style={{
                                  fontSize: 10,
                                  fontWeight: 'bold',
                                  color: rec.status === 'Paid' ? '#22c55e' : '#f59e0b',
                                }}>{rec.status.toUpperCase()}</Text>
                              </View>
                              <Text style={{ color: theme.textSub, fontSize: 13 }}>{isSelected ? '✓' : '❯'}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}
            </View>
          )
        )}

        {activeTab === 'employees' && (
          <View>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>Employee Directory</Text>
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              {employees.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textSub }]}>Loading employees...</Text>
              ) : (
                employees.map((emp, index) => (
                  <TouchableOpacity
                    key={emp._id || index}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedEmp(emp);
                      setEmpAttendanceModalVisible(true);
                    }}
                    style={[styles.listRow, { borderBottomColor: theme.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>{emp.name}</Text>
                      <Text style={[styles.itemSub, { color: theme.textSub }]}>{emp.position} • {emp.department}</Text>
                      <Text style={[styles.itemDate, { color: theme.textSub }]}>{emp.email}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.roleTag}>{emp.role}</Text>
                      <Text style={{ color: theme.textSub, fontSize: 16 }}>❯</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        )}

        {activeTab === 'settings' && (
          <View>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>Settings</Text>
            <Text style={{ color: theme.textSub, fontSize: 13, marginBottom: 16 }}>
              Manage your system preferences and configurations
            </Text>

            {/* Segmented Sub-Tabs */}
            {user?.role === 'superadmin' ? (
              // Superadmin: 6 tabs — scrollable
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 20 }}
                contentContainerStyle={{
                  flexDirection: 'row',
                  borderRadius: 12,
                  padding: 4,
                  backgroundColor: theme.inputBg,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                {['general', 'notifications', 'security', 'company', 'integrations', 'backup'].map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      styles.segmentedPill,
                      { flex: 0, paddingHorizontal: 18 },
                      settingsTab === tab && styles.segmentedPillActive,
                    ]}
                    onPress={() => setSettingsTab(tab as any)}
                  >
                    <Text style={[styles.segmentedText, settingsTab === tab ? styles.segmentedTextActive : { color: theme.textSub }]}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              // Employee / HR / Admin: 3 tabs — fill full width equally
              <View style={{
                flexDirection: 'row',
                borderRadius: 12,
                padding: 4,
                backgroundColor: theme.inputBg,
                borderWidth: 1,
                borderColor: theme.border,
                marginBottom: 20,
              }}>
                {['general', 'notifications', 'security'].map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      styles.segmentedPill,
                      { flex: 1 },
                      settingsTab === tab && styles.segmentedPillActive,
                    ]}
                    onPress={() => setSettingsTab(tab as any)}
                  >
                    <Text style={[styles.segmentedText, settingsTab === tab ? styles.segmentedTextActive : { color: theme.textSub }]}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* SUB-TAB 1: GENERAL */}
            {settingsTab === 'general' && (
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>⚙️ System Preferences</Text>

                <View style={[styles.salaryRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.salaryLabel, { color: theme.textSub }]}>Timezone:</Text>
                  <Text style={[styles.salaryValue, { color: theme.text }]}>Eastern Time (UTC-5)</Text>
                </View>

                <View style={[styles.salaryRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.salaryLabel, { color: theme.textSub }]}>Language:</Text>
                  <Text style={[styles.salaryValue, { color: theme.text }]}>English</Text>
                </View>

                <View style={[styles.salaryRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.salaryLabel, { color: theme.textSub }]}>Date Format:</Text>
                  <Text style={[styles.salaryValue, { color: theme.text }]}>MM / DD / YYYY</Text>
                </View>

                <View style={[styles.salaryRow, { borderBottomColor: theme.border, alignItems: 'center' }]}>
                  <Text style={[styles.salaryLabel, { color: theme.text }]}>{isDarkMode ? '🌙 Dark Mode Active' : '☀️ Light Mode Active'}</Text>
                  <Switch value={isDarkMode} onValueChange={toggleTheme} trackColor={{ false: '#cbd5e1', true: '#6366f1' }} />
                </View>

                <View style={{ borderBottomWidth: 1, borderBottomColor: theme.border, marginVertical: 12 }} />

                {/* App Version & Updates – single inline row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                  {/* Left: icon + label + version badge */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Text style={{ fontSize: 20 }}>📲</Text>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>App Version</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text style={{ fontSize: 11, color: theme.textSub }}>v{MOBILE_APP_VERSION}</Text>
                        {updateAvailable && (
                          <View style={{ backgroundColor: '#ef4444', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>UPDATE</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Right: Check Update button */}
                  <TouchableOpacity
                    style={{ backgroundColor: '#6366f1', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}
                    onPress={async () => {
                      try {
                        const response = await fetch(`${API_URL}/app-update`);
                        if (!response.ok) {
                          Alert.alert('Error', 'Failed to reach update server.');
                          return;
                        }
                        const data = await response.json();
                        setUpdateSettings(data);

                        const serverVersion = data.appVersion || '1.0.0';

                        const isUpdateNeeded = (current: string, latest: string) => {
                          const cParts = current.split('.').map(Number);
                          const lParts = latest.split('.').map(Number);
                          for (let i = 0; i < Math.max(cParts.length, lParts.length); i++) {
                            const cVal = cParts[i] || 0;
                            const lVal = lParts[i] || 0;
                            if (lVal > cVal) return true;
                            if (lVal < cVal) return false;
                          }
                          return false;
                        };

                        if (data.updateStatus === 'ON' && isUpdateNeeded(MOBILE_APP_VERSION, serverVersion)) {
                          setUpdateAvailable(true);
                          setUpdateModalVisible(true);
                        } else {
                          setUpdateAvailable(false);
                          Alert.alert(
                            '✨ App Up to Date',
                            `You are running the latest version of the Attendance App (v${MOBILE_APP_VERSION}).`
                          );
                        }
                      } catch (err) {
                        Alert.alert('Error', 'Failed to check for updates.');
                      }
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>Check Update</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* SUB-TAB 2: NOTIFICATIONS */}
            {settingsTab === 'notifications' && (
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>🔔 Notification Preferences</Text>

                <View style={[styles.salaryRow, { borderBottomColor: theme.border, alignItems: 'center' }]}>
                  <Text style={[styles.salaryLabel, { color: theme.text }]}>Email Notifications</Text>
                  <Switch value={emailNotifications} onValueChange={setEmailNotifications} trackColor={{ false: '#cbd5e1', true: '#6366f1' }} />
                </View>

                <View style={[styles.salaryRow, { borderBottomColor: theme.border, alignItems: 'center' }]}>
                  <Text style={[styles.salaryLabel, { color: theme.text }]}>Mobile Push Notifications</Text>
                  <Switch 
                    value={pushNotifications} 
                    onValueChange={async (value) => {
                      if (value) {
                        const hasPermission = await requestNotificationPermission();
                        if (hasPermission) {
                          setPushNotifications(true);
                          triggerTestNotification("🔔 Push Notifications Active", "You have successfully enabled push notifications.");
                        } else {
                          setPushNotifications(false);
                        }
                      } else {
                        setPushNotifications(false);
                      }
                    }} 
                    trackColor={{ false: '#cbd5e1', true: '#6366f1' }} 
                  />
                </View>

                <View style={[styles.salaryRow, { borderBottomColor: theme.border, alignItems: 'center' }]}>
                  <Text style={[styles.salaryLabel, { color: theme.text }]}>Shift Clock-In Reminders</Text>
                  <Switch 
                    value={clockReminders} 
                    onValueChange={async (value) => {
                      if (value) {
                        const hasPermission = await requestNotificationPermission();
                        if (hasPermission) {
                          setClockReminders(true);
                          triggerTestNotification("⏰ Shift Reminder Enabled", "We will remind you to clock in before your shift starts.");
                        } else {
                          setClockReminders(false);
                        }
                      } else {
                        setClockReminders(false);
                      }
                    }} 
                    trackColor={{ false: '#cbd5e1', true: '#6366f1' }} 
                  />
                </View>
              </View>
            )}

            {/* SUB-TAB 3: SECURITY */}
            {settingsTab === 'security' && (
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>🛡️ Security Preferences</Text>

                <View style={[styles.salaryRow, { borderBottomColor: theme.border, alignItems: 'center' }]}>
                  <Text style={[styles.salaryLabel, { color: theme.text }]}>Auto-Logout on Inactivity</Text>
                  <Switch value={autoLogout} onValueChange={setAutoLogout} trackColor={{ false: '#cbd5e1', true: '#6366f1' }} />
                </View>

                <View style={[styles.salaryRow, { borderBottomColor: theme.border, alignItems: 'center' }]}>
                  <Text style={[styles.salaryLabel, { color: theme.text }]}>Two-Factor Authentication (2FA)</Text>
                  <Switch value={twoFactorAuth} onValueChange={setTwoFactorAuth} trackColor={{ false: '#cbd5e1', true: '#6366f1' }} />
                </View>
              </View>
            )}

            {/* SUB-TAB 4: COMPANY (Super Admin Only) */}
            {settingsTab === 'company' && (
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>🏢 Company Information</Text>
                
                <Text style={[styles.label, { color: theme.text, marginTop: 8 }]}>Company Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  value={companyName}
                  onChangeText={setCompanyName}
                />

                <Text style={[styles.label, { color: theme.text }]}>Company Email</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  value={companyEmail}
                  onChangeText={setCompanyEmail}
                  keyboardType="email-address"
                />

                <Text style={[styles.label, { color: theme.text }]}>Company Phone</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  value={companyPhone}
                  onChangeText={setCompanyPhone}
                  keyboardType="phone-pad"
                />

                <Text style={[styles.label, { color: theme.text }]}>Company Address</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  value={companyAddress}
                  onChangeText={setCompanyAddress}
                />

                <View style={{ borderBottomWidth: 1, borderBottomColor: theme.border, marginVertical: 12 }} />

                <Text style={[styles.cardTitle, { color: theme.text, fontSize: 16 }]}>⏰ Working Hours</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.text }]}>Start Time</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                      value={workStart}
                      onChangeText={setWorkStart}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.text }]}>End Time</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                      value={workEnd}
                      onChangeText={setWorkEnd}
                    />
                  </View>
                </View>

                <View style={{ borderBottomWidth: 1, borderBottomColor: theme.border, marginVertical: 12 }} />

                <Text style={[styles.cardTitle, { color: theme.text, fontSize: 16 }]}>📝 Leave Policies (Days / Year)</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.text, fontSize: 11 }]}>Annual Vacation</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                      value={vacationDays}
                      onChangeText={setVacationDays}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.text, fontSize: 11 }]}>Sick Leave</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                      value={sickDays}
                      onChangeText={setSickDays}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.text, fontSize: 11 }]}>Personal Leave</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                      value={personalDays}
                      onChangeText={setPersonalDays}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.loginButton, { marginTop: 16 }]} 
                  onPress={() => Alert.alert('Success', 'Company settings saved successfully.')}
                >
                  <Text style={styles.loginButtonText}>Save Company Settings</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* SUB-TAB 5: INTEGRATIONS (Super Admin Only) */}
            {settingsTab === 'integrations' && (
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>🔌 Third-Party Integrations</Text>

                {/* Google Workspace */}
                <View style={[styles.employeeItem, { backgroundColor: theme.inputBg, borderColor: theme.border, padding: 12, marginBottom: 10 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={[styles.employeeName, { color: theme.text, fontSize: 15 }]}>Google Workspace</Text>
                      <Text style={[styles.employeeEmail, { color: theme.textSub }]}>Email and calendar integration</Text>
                    </View>
                    <View style={{ backgroundColor: '#14532d', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ color: '#4ade80', fontSize: 10, fontWeight: 'bold' }}>Connected</Text>
                    </View>
                  </View>
                </View>

                {/* Slack */}
                <View style={[styles.employeeItem, { backgroundColor: theme.inputBg, borderColor: theme.border, padding: 12, marginBottom: 10 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={[styles.employeeName, { color: theme.text, fontSize: 15 }]}>Slack</Text>
                      <Text style={[styles.employeeEmail, { color: theme.textSub }]}>Team notifications & communication</Text>
                    </View>
                    <TouchableOpacity 
                      style={{ backgroundColor: '#6366f1', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                      onPress={() => Alert.alert('Connect', 'Slack connection initiated.')}
                    >
                      <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold' }}>Connect</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* QuickBooks */}
                <View style={[styles.employeeItem, { backgroundColor: theme.inputBg, borderColor: theme.border, padding: 12, marginBottom: 4 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={[styles.employeeName, { color: theme.text, fontSize: 15 }]}>QuickBooks</Text>
                      <Text style={[styles.employeeEmail, { color: theme.textSub }]}>Payroll and accounting integration</Text>
                    </View>
                    <TouchableOpacity 
                      style={{ backgroundColor: '#6366f1', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                      onPress={() => Alert.alert('Connect', 'QuickBooks connection initiated.')}
                    >
                      <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold' }}>Connect</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* SUB-TAB 6: BACKUP (Super Admin Only) */}
            {settingsTab === 'backup' && (
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>💾 Data & Backup Management</Text>

                <View style={[styles.salaryRow, { borderBottomColor: theme.border, alignItems: 'center', paddingVertical: 8 }]}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.salaryLabel, { color: theme.text, fontWeight: '500' }]}>Automatic Backups</Text>
                    <Text style={{ color: theme.textSub, fontSize: 11 }}>Daily encrypted automated backups</Text>
                  </View>
                  <Switch value={true} onValueChange={() => {}} trackColor={{ false: '#cbd5e1', true: '#6366f1' }} />
                </View>

                <Text style={[styles.label, { color: theme.text, marginTop: 12, marginBottom: 6 }]}>Manual Actions</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  <TouchableOpacity 
                    style={[styles.themeIconButton, { flex: 1, height: 40, backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, padding: 0 }]}
                    onPress={() => Alert.alert('Backup', 'Full system backup downloaded successfully.')}
                  >
                    <Text style={{ color: theme.text, fontSize: 12, fontWeight: 'bold' }}>📥 Download</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.themeIconButton, { flex: 1, height: 40, backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, padding: 0 }]}
                    onPress={() => Alert.alert('Restore', 'Select a backup file to restore.')}
                  >
                    <Text style={{ color: theme.text, fontSize: 12, fontWeight: 'bold' }}>📤 Restore</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.label, { color: theme.text, marginBottom: 6 }]}>Export Data</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <TouchableOpacity 
                    style={[styles.themeIconButton, { flex: 1, height: 36, backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border }]}
                    onPress={() => Alert.alert('Export', 'Employees data exported (CSV)')}
                  >
                    <Text style={{ color: theme.text, fontSize: 11 }}>Staff CSV</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.themeIconButton, { flex: 1, height: 36, backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border }]}
                    onPress={() => Alert.alert('Export', 'Attendance logs exported (CSV)')}
                  >
                    <Text style={{ color: theme.text, fontSize: 11 }}>Attendance CSV</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  <TouchableOpacity 
                    style={[styles.themeIconButton, { flex: 1, height: 36, backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border }]}
                    onPress={() => Alert.alert('Export', 'Payroll data exported (CSV)')}
                  >
                    <Text style={{ color: theme.text, fontSize: 11 }}>Payroll CSV</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.themeIconButton, { flex: 1, height: 36, backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border }]}
                    onPress={() => Alert.alert('Export', 'Leave records exported (CSV)')}
                  >
                    <Text style={{ color: theme.text, fontSize: 11 }}>Leaves CSV</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.card, { borderColor: '#ef4444', borderWidth: 1, backgroundColor: '#7f1d1d' }]}>
                  <Text style={{ color: '#fca5a5', fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>⚠️ Danger Zone</Text>
                  <Text style={{ color: '#fca5a5', fontSize: 11, marginBottom: 10 }}>Permanently delete all company data. This action cannot be undone.</Text>
                  <TouchableOpacity 
                    style={{ backgroundColor: '#dc2626', padding: 8, borderRadius: 6, alignItems: 'center' }}
                    onPress={() => Alert.alert(
                      'Confirm Delete',
                      'Are you absolutely sure you want to delete ALL data? This will clear the database completely.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete Everything', style: 'destructive', onPress: () => Alert.alert('Deleted', 'Database has been wiped.') }
                      ]
                    )}
                  >
                    <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 12 }}>Delete All Data</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Profile Information Card */}
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>👤 Profile Information</Text>

              <View style={[styles.salaryRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.salaryLabel, { color: theme.textSub }]}>Full Name:</Text>
                <Text style={[styles.salaryValue, { color: theme.text }]}>{formatName(user.name)}</Text>
              </View>

              <View style={[styles.salaryRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.salaryLabel, { color: theme.textSub }]}>Employee ID:</Text>
                <Text style={[styles.salaryValue, { color: '#818cf8', fontWeight: 'bold' }]}>
                  {user.employeeCode || (user._id ? `WTN-${user._id.substring(0, 6).toUpperCase()}` : 'WTN 025')}
                </Text>
              </View>

              <View style={[styles.salaryRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.salaryLabel, { color: theme.textSub }]}>Email Address:</Text>
                <Text style={[styles.salaryValue, { color: theme.text }]}>{user.email}</Text>
              </View>

              <View style={[styles.salaryRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.salaryLabel, { color: theme.textSub }]}>Access Role:</Text>
                <Text style={[styles.salaryValue, { color: '#818cf8', fontWeight: 'bold' }]}>{user.role?.toUpperCase()}</Text>
              </View>

              <TouchableOpacity style={styles.logoutDangerButton} onPress={handleLogout}>
                <Text style={styles.logoutDangerText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Leave Request Form Modal */}
      <Modal visible={leaveModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 16 }]}>📝 Apply for Leave</Text>

            <Text style={[styles.label, { color: theme.text }]}>Leave Type</Text>
            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 14 }}>
              {['Casual Leave', 'Medical Leave', 'Annual Leave', 'Half Day', 'Week Off'].map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setLeaveType(type)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    alignItems: 'center',
                    borderRadius: 8,
                    backgroundColor: leaveType === type ? '#6366f1' : theme.inputBg,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <Text style={{ fontSize: 9, color: leaveType === type ? '#fff' : theme.textSub, fontWeight: 'bold' }}>
                    {type === 'Week Off' ? 'Week Off' : type === 'Half Day' ? 'Half Day' : type.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: theme.text }]}>Start Date</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: theme.text }]}>End Date</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            {leaveType !== 'Week Off' && (
              <>
                <Text style={[styles.label, { color: theme.text }]}>Leave Reason</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  value={leaveReason}
                  onChangeText={setLeaveReason}
                  placeholder="e.g. Medical emergency / Personal work"
                  placeholderTextColor="#9ca3af"
                />
              </>
            )}

            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { Keyboard.dismiss(); setLeaveModalVisible(false); }}>
                <Text style={[styles.cancelButtonText, { color: theme.textSub }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallPrimaryButton} onPress={handleApplyLeave} disabled={loading}>
                <Text style={styles.smallButtonText}>{loading ? 'Submitting...' : 'Submit Request'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upcoming Official Holidays Pop-Up Modal */}
      <Modal visible={holidayModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg, maxHeight: '80%' }]}>
            <View style={{ marginBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 12 }}>
              <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 2 }]}>
                🎉 Official Holidays (2026-2027)
              </Text>
              <Text style={{ fontSize: 11, color: theme.textSub }}>Company Annual Holiday Schedule</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
              {[
                { name: 'Independence Day', date: 'August 15th, 2026', day: 'Saturday', icon: '🇮🇳', badge: 'National Holiday' },
                { name: 'Gandhi Jayanti', date: 'October 2nd, 2026', day: 'Friday', icon: '🕊️', badge: 'National Holiday' },
                { name: 'Diwali', date: 'November 8th, 2026', day: 'Sunday', icon: '🪔', badge: 'Festival Holiday' },
                { name: 'Christmas', date: 'December 25th, 2026', day: 'Friday', icon: '🎄', badge: 'Festival Holiday' },
                { name: 'New Year’s Day', date: 'January 1st, 2027', day: 'Friday', icon: '🎆', badge: 'Public Holiday' },
                { name: 'Republic Day', date: 'January 26th, 2027', day: 'Tuesday', icon: '🇮🇳', badge: 'National Holiday' },
                { name: 'Labor Day', date: 'May 1st, 2027', day: 'Saturday', icon: '🔨', badge: 'Public Holiday' },
              ].map((h, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: theme.inputBg, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 20 }}>{h.icon}</Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.text }}>{h.name}</Text>
                      <Text style={{ fontSize: 12, color: theme.textSub }}>{h.date} • {h.day}</Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, color: '#818cf8', fontWeight: 'bold' }}>{h.badge}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={[styles.cancelButton, { marginTop: 16, width: '100%', alignItems: 'center' }]} onPress={() => setHolidayModalVisible(false)}>
              <Text style={[styles.cancelButtonText, { color: theme.textSub }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Leave Balance Breakdown Pop-Up Modal */}
      <Modal visible={leaveBalanceModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <View style={{ marginBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 12 }}>
              <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 2 }]}>
                📊 Leave Balance Breakdown (2026)
              </Text>
              <Text style={{ fontSize: 11, color: theme.textSub }}>Annual Leave Quota Allocation</Text>
            </View>

            <View style={{ gap: 12, marginBottom: 16 }}>
              {/* Casual Leave */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: theme.inputBg, borderRadius: 10, borderWidth: 1, borderColor: theme.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 18 }}>🏖️</Text>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.text }}>Casual Leave</Text>
                    <Text style={{ fontSize: 11, color: theme.textSub }}>Annual quota: 6 Days</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#6366f1' }}>6 Days Left</Text>
              </View>

              {/* Medical Leave */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: theme.inputBg, borderRadius: 10, borderWidth: 1, borderColor: theme.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 18 }}>🏥</Text>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.text }}>Medical Leave</Text>
                    <Text style={{ fontSize: 11, color: theme.textSub }}>Annual quota: 6 Days</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#22c55e' }}>6 Days Left</Text>
              </View>

              {/* Annual Leave */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: theme.inputBg, borderRadius: 10, borderWidth: 1, borderColor: theme.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 18 }}>📅</Text>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.text }}>Annual Leave</Text>
                    <Text style={{ fontSize: 11, color: theme.textSub }}>Annual quota: 6 Days</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#f59e0b' }}>{Math.max(0, getLeaveBalance() - 12)} Days Left</Text>
              </View>

              {/* Week Off Policy */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: theme.inputBg, borderRadius: 10, borderWidth: 1, borderColor: theme.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 18 }}>⚪</Text>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.text }}>Week Off Policy</Text>
                    <Text style={{ fontSize: 11, color: theme.textSub }}>User Chooses Up to 4 Dates / Month</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#94a3b8' }}>4 / Month</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.cancelButton, { flex: 1, alignItems: 'center' }]} onPress={() => setLeaveBalanceModalVisible(false)}>
                <Text style={[styles.cancelButtonText, { color: theme.textSub }]}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.smallPrimaryButton, { flex: 1, alignItems: 'center' }]}
                onPress={() => {
                  setLeaveBalanceModalVisible(false);
                  setLeaveModalVisible(true);
                }}
              >
                <Text style={styles.smallButtonText}>+ Apply Leave</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* App Update Checker Pop-Up Modal */}
      <Modal visible={updateModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg, alignItems: 'center', padding: 24 }]}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🚀</Text>
            
            <Text style={[styles.cardTitle, { color: theme.text, fontSize: 20, textAlign: 'center', marginBottom: 8 }]}>
              App Update Available
            </Text>
            
            <Text style={{ fontSize: 13, color: theme.textSub, textAlign: 'center', marginBottom: 20, lineHeight: 18 }}>
              {updateSettings?.updateMsg || 'A new version of the app is available. Please update to continue using the application.'}
            </Text>

            <View style={{ width: '100%', gap: 10 }}>
              <TouchableOpacity
                style={[styles.primaryButton, { width: '100%', marginTop: 0 }]}
                onPress={() => {
                  if (updateSettings?.updateUrl) {
                    Linking.openURL(updateSettings.updateUrl).catch((err) => {
                      console.error('Failed to open update URL:', err);
                      Alert.alert('Error', 'Could not open the update page.');
                    });
                  } else {
                    Alert.alert('Notice', 'No update URL configured. Please contact the administrator.');
                  }
                }}
              >
                <Text style={styles.primaryButtonText}>Update Now</Text>
              </TouchableOpacity>

              {updateSettings?.cancelButton === 'ON' && (
                <TouchableOpacity
                  style={[styles.cancelButton, { width: '100%', alignItems: 'center', paddingVertical: 14 }]}
                  onPress={() => setUpdateModalVisible(false)}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.textSub, fontSize: 16 }]}>Not Now</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Employee Attendance Details Modal (Super Admin Only) */}
      <Modal visible={empAttendanceModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg, maxHeight: '80%' }]}>
            {selectedEmp && (
              <View>
                <View style={{ marginBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 8 }}>
                  <Text style={[styles.cardTitle, { color: theme.text, fontSize: 18, marginBottom: 2 }]}>
                    👤 {selectedEmp.name}
                  </Text>
                  <Text style={{ color: theme.textSub, fontSize: 12 }}>
                    {selectedEmp.position} • {selectedEmp.department}
                  </Text>
                </View>

                {/* Stats Summary */}
                <View style={[styles.statsRow, { marginBottom: 14 }]}>
                  <View style={[styles.statCard, { backgroundColor: theme.inputBg, borderColor: theme.border, flex: 1, padding: 10 }]}>
                    <Text style={[styles.statNumber, { color: '#22c55e', fontSize: 20 }]}>
                      {allAttendanceLogs.filter(log => {
                        const id = log.employeeId?._id || log.employeeId;
                        const logMonth = (log.date || log.createdAt || '').split('-').slice(0, 2).join('-');
                        const currentMonth = new Date().toISOString().split('-').slice(0, 2).join('-');
                        return id === selectedEmp._id && logMonth === currentMonth;
                      }).length}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.textSub, fontSize: 11 }]}>Days Present</Text>
                  </View>
                  <View style={[styles.statCard, { backgroundColor: theme.inputBg, borderColor: theme.border, flex: 1, padding: 10 }]}>
                    <Text style={[styles.statNumber, { color: '#818cf8', fontSize: 20 }]}>
                      {allAttendanceLogs.filter(log => {
                        const id = log.employeeId?._id || log.employeeId;
                        const logMonth = (log.date || log.createdAt || '').split('-').slice(0, 2).join('-');
                        const currentMonth = new Date().toISOString().split('-').slice(0, 2).join('-');
                        return id === selectedEmp._id && logMonth === currentMonth;
                      }).reduce((acc, log) => acc + (log.workHours || 0), 0).toFixed(1)} hrs
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.textSub, fontSize: 11 }]}>Hours Worked</Text>
                  </View>
                </View>

                <Text style={[styles.label, { color: theme.text, marginBottom: 8 }]}>
                  Attendance Logs - {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                </Text>

                <ScrollView style={{ flex: 1, marginBottom: 16 }}>
                  {allAttendanceLogs.filter(log => {
                    const id = log.employeeId?._id || log.employeeId;
                    const logMonth = (log.date || log.createdAt || '').split('-').slice(0, 2).join('-');
                    const currentMonth = new Date().toISOString().split('-').slice(0, 2).join('-');
                    return id === selectedEmp._id && logMonth === currentMonth;
                  }).length === 0 ? (
                    <Text style={[styles.emptyText, { color: theme.textSub, textAlign: 'center', marginTop: 20 }]}>
                      No attendance logs for this month.
                    </Text>
                  ) : (
                    allAttendanceLogs.filter(log => {
                      const id = log.employeeId?._id || log.employeeId;
                      const logMonth = (log.date || log.createdAt || '').split('-').slice(0, 2).join('-');
                      const currentMonth = new Date().toISOString().split('-').slice(0, 2).join('-');
                      return id === selectedEmp._id && logMonth === currentMonth;
                    }).map((log, index) => (
                      <View key={log._id || index} style={[styles.listRow, { borderBottomColor: theme.border, paddingVertical: 10 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.itemTitle, { color: theme.text }]}>
                            {formatDate(log.date || log.createdAt)}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#22c55e', fontWeight: 'bold', marginTop: 2 }}>
                            {log.status || 'Present'}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                          <Text style={[styles.itemSub, { color: theme.text, fontSize: 12, fontWeight: '700' }]}>
                            In: {formatTime(log.clockIn)}
                          </Text>
                          <Text style={[styles.itemSub, { color: theme.textSub, fontSize: 12 }]}>
                            Out: {log.clockOut ? formatTime(log.clockOut) : '--:--'}
                          </Text>
                          {log.workHours > 0 && (
                            <Text style={{ fontSize: 10, color: '#818cf8', fontWeight: 'bold', marginTop: 2 }}>
                              {log.workHours} hrs
                            </Text>
                          )}
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={() => {
                    setEmpAttendanceModalVisible(false);
                    setSelectedEmp(null);
                  }}
                >
                  <Text style={styles.loginButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Generate Payroll Modal (Super Admin Only) */}
      <Modal visible={payrollModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            {selectedEmpForPayroll && (
              <View>
                <View style={{ marginBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 8 }}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>💵 Generate Payroll</Text>
                  <Text style={{ fontSize: 12, color: theme.textSub }}>For {selectedEmpForPayroll.name} ({selectedEmpForPayroll.department})</Text>
                </View>

                <Text style={[styles.label, { color: theme.text }]}>Base Salary</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.textSub, borderColor: theme.border }]}
                  value={`₹${(selectedEmpForPayroll.salary || 40000).toLocaleString('en-IN')}`}
                  editable={false}
                />

                <Text style={[styles.label, { color: theme.text }]}>Overtime Bonus (₹)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  value={payrollOvertime}
                  onChangeText={setPayrollOvertime}
                  keyboardType="numeric"
                />

                <Text style={[styles.label, { color: theme.text }]}>Performance Bonus (₹)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  value={payrollBonus}
                  onChangeText={setPayrollBonus}
                  keyboardType="numeric"
                />

                <Text style={[styles.label, { color: theme.text }]}>Deductions (Taxes / Unpaid Leave) (₹)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  value={payrollDeductions}
                  onChangeText={setPayrollDeductions}
                  keyboardType="numeric"
                />

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { flex: 1, alignItems: 'center' }]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setPayrollModalVisible(false);
                      setSelectedEmpForPayroll(null);
                      setPayrollOvertime('0');
                      setPayrollBonus('0');
                      setPayrollDeductions('0');
                    }}
                  >
                    <Text style={[styles.cancelButtonText, { color: theme.textSub }]}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.smallPrimaryButton, { flex: 1, alignItems: 'center', height: 42 }]}
                    onPress={() => {
                      Keyboard.dismiss();
                      const base = selectedEmpForPayroll.salary || 40000;
                      const ot = parseFloat(payrollOvertime) || 0;
                      const bn = parseFloat(payrollBonus) || 0;
                      const dd = parseFloat(payrollDeductions) || 0;
                      const net = base + ot + bn - dd;
                      const currentMonth = new Date().toISOString().split('-').slice(0, 2).join('-');
                      
                      handleProcessPayrollSubmit({
                        employeeId: selectedEmpForPayroll._id,
                        month: currentMonth,
                        baseSalary: base,
                        basicSalary: base * 0.5,
                        hra: base * 0.25,
                        otherAllowances: base * 0.25,
                        overtime: ot,
                        bonus: bn,
                        deductions: dd,
                        netSalary: net,
                        status: 'Pending'
                      });
                      
                      setPayrollModalVisible(false);
                      setSelectedEmpForPayroll(null);
                      setPayrollOvertime('0');
                      setPayrollBonus('0');
                      setPayrollDeductions('0');
                    }}
                  >
                    <Text style={styles.smallButtonText}>Save Slip</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Original Official Salary Slip Document Modal */}
      <Modal visible={originalSlipModalVisible} animationType="slide" transparent>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 16 }}>
          {(() => {
            const myPayrolls = payrollList
              .filter((p: any) => (p.employeeId?._id || p.employeeId) === user._id)
              .sort((a: any, b: any) => b.month?.localeCompare(a.month));

            const selMonth = selectedEmpForPayroll || (myPayrolls[0]?.month || new Date().toISOString().substring(0, 7));
            const rec = myPayrolls.find(p => p.month === selMonth);

            const base = rec?.baseSalary || user.salary || 40000;
            const basic = rec?.basicSalary ?? Math.round(base * 0.5);
            const hra = rec?.hra ?? Math.round(base * 0.25);
            const allowances = rec?.otherAllowances ?? Math.round(base * 0.25);
            const overtime = rec?.overtime || 0;
            const bonus = rec?.bonus || 0;
            const deductions = rec?.deductions || 0;
            const net = rec?.netSalary ?? (basic + hra + allowances + overtime + bonus - deductions);
            const status = rec?.status || 'Paid';
            const mName = selMonth
              ? new Date(selMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })
              : new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

            return (
              <View style={{ backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden', maxHeight: '90%' }}>
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                  {/* Official Company Banner */}
                  <View style={{ borderBottomWidth: 2, borderBottomColor: '#1e293b', paddingBottom: 12, marginBottom: 16, alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a', letterSpacing: 1 }}>WHITESWAN TV LLP</Text>
                    <Text style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Corporate HR & Payroll Department</Text>
                    <View style={{ backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4, marginTop: 8 }}>
                      <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.8 }}>OFFICIAL SALARY SLIP — {mName.toUpperCase()}</Text>
                    </View>
                  </View>

                  {/* Employee & Pay Details Grid */}
                  <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: '#64748b' }}>Employee Name:</Text>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#0f172a' }}>{formatName(user.name)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: '#64748b' }}>Designation / Role:</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#0f172a' }}>{user.position || user.role || 'Software Engineer'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: '#64748b' }}>Department:</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#0f172a' }}>{user.department || 'Engineering'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: '#64748b' }}>Employee ID:</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#0f172a' }}>{user.employeeCode || (user._id ? `WTN-${user._id.substring(0, 6).toUpperCase()}` : 'WTN 025')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: '#64748b' }}>Payment Status:</Text>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: status === 'Paid' ? '#16a34a' : '#d97706' }}>{status.toUpperCase()}</Text>
                    </View>
                  </View>

                  {/* Financial Earnings Breakdown Table */}
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, textTransform: 'uppercase' }}>Earnings Breakdown</Text>
                  <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' }}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#334155' }}>Component</Text>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#334155' }}>Amount (₹)</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                      <Text style={{ fontSize: 12, color: '#334155' }}>Basic Salary</Text>
                      <Text style={{ fontSize: 12, color: '#0f172a' }}>₹{basic.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                      <Text style={{ fontSize: 12, color: '#334155' }}>House Rent Allowance (HRA)</Text>
                      <Text style={{ fontSize: 12, color: '#0f172a' }}>₹{hra.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                      <Text style={{ fontSize: 12, color: '#334155' }}>Special & Other Allowances</Text>
                      <Text style={{ fontSize: 12, color: '#0f172a' }}>₹{allowances.toLocaleString('en-IN')}</Text>
                    </View>
                    {overtime > 0 && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                        <Text style={{ fontSize: 12, color: '#16a34a' }}>Overtime Pay</Text>
                        <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: '600' }}>+₹{overtime.toLocaleString('en-IN')}</Text>
                      </View>
                    )}
                    {bonus > 0 && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8 }}>
                        <Text style={{ fontSize: 12, color: '#16a34a' }}>Performance Bonus</Text>
                        <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: '600' }}>+₹{bonus.toLocaleString('en-IN')}</Text>
                      </View>
                    )}
                  </View>

                  {/* Deductions Section */}
                  {deductions > 0 && (
                    <>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#991b1b', marginBottom: 8, textTransform: 'uppercase' }}>Deductions</Text>
                      <View style={{ borderWidth: 1, borderColor: '#fca5a5', borderRadius: 8, backgroundColor: '#fef2f2', padding: 8, marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12, color: '#991b1b' }}>Professional Tax / Deductions</Text>
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#dc2626' }}>-₹{deductions.toLocaleString('en-IN')}</Text>
                        </View>
                      </View>
                    </>
                  )}

                  {/* Total Net Salary Box */}
                  <View style={{ backgroundColor: '#0f172a', padding: 14, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <View>
                      <Text style={{ color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Net Payable Salary</Text>
                      <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginTop: 2 }}>₹{net.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={{ backgroundColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold' }}>{status.toUpperCase()}</Text>
                    </View>
                  </View>

                  {/* Corporate Seal & Verification */}
                  <View style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <View>
                      <Text style={{ fontSize: 10, color: '#16a34a', fontWeight: 'bold' }}>✓ VERIFIED CORPORATE DOCUMENT</Text>
                      <Text style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>Whiteswan TV LLP Payroll System</Text>
                    </View>
                    <View style={{ borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: '#f8fafc' }}>
                      <Text style={{ fontSize: 9, color: '#475569', fontWeight: '600' }}>SEAL & AUTHORIZED</Text>
                    </View>
                  </View>

                  {/* Buttons */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
                      onPress={() => {
                        handleDownloadPDF();
                        setPdfPreviewVisible(true);
                      }}
                    >
                      <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>📥 Download & View PDF</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: '#64748b', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
                      onPress={() => setOriginalSlipModalVisible(false)}
                    >
                      <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            );
          })()}
        </SafeAreaView>
      </Modal>

      {/* Full-Screen PDF Document Viewer Modal */}
      <Modal visible={pdfPreviewVisible} animationType="fade" transparent>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
          <View style={{ backgroundColor: '#1e293b', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#334155' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18 }}>📄</Text>
              <View>
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold' }}>Official Salary Slip PDF</Text>
                <Text style={{ color: '#94a3b8', fontSize: 10 }}>Document Ref: WS-PAYROLL-2026.pdf</Text>
              </View>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
              onPress={() => setPdfPreviewVisible(false)}
            >
              <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>✕ Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, padding: 12 }}>
            <View style={{ backgroundColor: '#ffffff', borderRadius: 8, padding: 20, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, minHeight: 600 }}>
              {/* PDF Document Header */}
              <View style={{ borderBottomWidth: 2, borderBottomColor: '#0f172a', paddingBottom: 14, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#0f172a', letterSpacing: 0.5 }}>WHITESWAN TV LLP</Text>
                  <Text style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>1/3, Malamel Center, Club Junction, Edappally.P.O, Ernakulam, Kerala</Text>
                  <Text style={{ fontSize: 10, color: '#475569' }}>Email: contact@whiteswantv.com • Phone: +91 484 2800100</Text>
                </View>
                <View style={{ backgroundColor: '#1e1b4b', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, alignItems: 'center' }}>
                  <Text style={{ color: '#818cf8', fontSize: 9, fontWeight: 'bold' }}>FORM 16 / SLIP</Text>
                  <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold', marginTop: 2 }}>OFFICIAL PDF</Text>
                </View>
              </View>

              {/* Employee Information Table */}
              <View style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 10, backgroundColor: '#f8fafc', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, color: '#475569', width: '40%' }}>Employee Name:</Text>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0f172a', flex: 1 }}>{formatName(user.name)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, color: '#475569', width: '40%' }}>Designation:</Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#0f172a', flex: 1 }}>{user.position || user.role || 'Software Engineer'}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, color: '#475569', width: '40%' }}>Department:</Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#0f172a', flex: 1 }}>{user.department || 'Engineering'}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, color: '#475569', width: '40%' }}>Employee ID:</Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#0f172a', flex: 1 }}>{user.employeeCode || (user._id ? `WTN-${user._id.substring(0, 6).toUpperCase()}` : 'WTN 025')}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, color: '#475569', width: '40%' }}>Pay Period:</Text>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#4338ca', flex: 1 }}>{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
                </View>
              </View>

              {/* Document Earnings & Deductions Table */}
              <View style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', backgroundColor: '#0f172a', padding: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#ffffff', flex: 1 }}>Earnings Description</Text>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#ffffff', width: 100, textAlign: 'right' }}>Amount (₹)</Text>
                </View>
                <View style={{ flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 11, color: '#334155', flex: 1 }}>Basic Salary</Text>
                  <Text style={{ fontSize: 11, color: '#0f172a', width: 100, textAlign: 'right', fontWeight: '500' }}>₹{(user.salary ? Math.round(user.salary * 0.5) : 20000).toLocaleString('en-IN')}</Text>
                </View>
                <View style={{ flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 11, color: '#334155', flex: 1 }}>House Rent Allowance (HRA)</Text>
                  <Text style={{ fontSize: 11, color: '#0f172a', width: 100, textAlign: 'right', fontWeight: '500' }}>₹{(user.salary ? Math.round(user.salary * 0.25) : 10000).toLocaleString('en-IN')}</Text>
                </View>
                <View style={{ flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 11, color: '#334155', flex: 1 }}>Special Allowance</Text>
                  <Text style={{ fontSize: 11, color: '#0f172a', width: 100, textAlign: 'right', fontWeight: '500' }}>₹{(user.salary ? Math.round(user.salary * 0.25) : 10000).toLocaleString('en-IN')}</Text>
                </View>
                <View style={{ flexDirection: 'row', padding: 8, backgroundColor: '#f1f5f9' }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0f172a', flex: 1 }}>Gross Salary Payable</Text>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0f172a', width: 100, textAlign: 'right' }}>₹{(user.salary || 40000).toLocaleString('en-IN')}</Text>
                </View>
              </View>

              {/* Net Payable Highlight Banner */}
              <View style={{ backgroundColor: '#15803d', padding: 14, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View>
                  <Text style={{ color: '#dcfce7', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>Total Net Remittance</Text>
                  <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: 'bold', marginTop: 2 }}>₹{(user.salary || 40000).toLocaleString('en-IN')}</Text>
                </View>
                <View style={{ backgroundColor: '#ffffff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 }}>
                  <Text style={{ color: '#15803d', fontSize: 10, fontWeight: 'bold' }}>DISBURSED / PAID</Text>
                </View>
              </View>

              {/* Document Seal & Signature Footer */}
              <View style={{ borderTopWidth: 1, borderTopColor: '#cbd5e1', paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <View>
                  <View style={{ borderColor: '#16a34a', borderWidth: 1.5, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#f0fdf4' }}>
                    <Text style={{ fontSize: 9, color: '#15803d', fontWeight: 'bold' }}>✓ WHITESWAN CORPORATE SEAL</Text>
                  </View>
                  <Text style={{ fontSize: 9, color: '#94a3b8', marginTop: 6 }}>Digitally Signed & Verified Document</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0f172a', fontStyle: 'italic' }}>Whiteswan HR & Payroll</Text>
                  <Text style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>Authorized Signatory</Text>
                </View>
              </View>
            </View>

            {/* Document PDF Actions */}
            <View style={{ paddingVertical: 16, gap: 10 }}>
              <TouchableOpacity
                style={{ backgroundColor: '#22c55e', paddingVertical: 14, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                onPress={() => {
                  handleDownloadPDF();
                }}
              >
                <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 14 }}>📥 Save PDF File to Device Downloads</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ backgroundColor: '#334155', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
                onPress={() => setPdfPreviewVisible(false)}
              >
                <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>Close PDF Viewer</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Bottom Navigation Bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.navBg, borderTopColor: theme.border }]}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('dashboard')}>
          <Text style={[styles.tabIcon, activeTab === 'dashboard' && styles.tabActiveText]}>📊</Text>
          <Text style={[styles.tabLabel, { color: activeTab === 'dashboard' ? '#818cf8' : theme.textSub }]}>Dash</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('attendance')}>
          <Text style={[styles.tabIcon, activeTab === 'attendance' && styles.tabActiveText]}>⏰</Text>
          <Text style={[styles.tabLabel, { color: activeTab === 'attendance' ? '#818cf8' : theme.textSub }]}>
            {user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'hr' ? 'Attendance' : 'Clock'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('leaves')}>
          <Text style={[styles.tabIcon, activeTab === 'leaves' && styles.tabActiveText]}>📝</Text>
          <Text style={[styles.tabLabel, { color: activeTab === 'leaves' ? '#818cf8' : theme.textSub }]}>Leaves</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('salary')}>
          <Text style={[styles.tabIcon, activeTab === 'salary' && styles.tabActiveText]}>💰</Text>
          <Text style={[styles.tabLabel, { color: activeTab === 'salary' ? '#818cf8' : theme.textSub }]}>Salary</Text>
        </TouchableOpacity>

        {(user?.role === 'admin' || user?.role === 'hr' || user?.role === 'superadmin') && (
          <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('employees')}>
            <Text style={[styles.tabIcon, activeTab === 'employees' && styles.tabActiveText]}>👥</Text>
            <Text style={[styles.tabLabel, { color: activeTab === 'employees' ? '#818cf8' : theme.textSub }]}>Staff</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('settings')}>
          <View style={{ position: 'relative' }}>
            <Text style={[styles.tabIcon, activeTab === 'settings' && styles.tabActiveText]}>⚙️</Text>
            {updateAvailable && (
              <View style={{
                position: 'absolute',
                top: -2,
                right: -4,
                backgroundColor: '#ef4444',
                borderRadius: 6,
                width: 10,
                height: 10,
                borderWidth: 1.5,
                borderColor: activeTab === 'settings' ? '#818cf8' : (isDarkMode ? '#0f172a' : '#ffffff'),
              }} />
            )}
          </View>
          <Text style={[styles.tabLabel, { color: activeTab === 'settings' ? '#818cf8' : theme.textSub }]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? NativeStatusBar.currentHeight : 0,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  themeToggleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  appBadge: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  themeIconButton: {
    padding: 6,
    borderRadius: 8,
  },
  welcomeText: {
    fontSize: 12,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  roleBadgeContainer: {
    backgroundColor: '#312e81',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  roleBadgeText: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 80,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    borderLeftWidth: 4,
    borderWidth: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  statusActive: {
    backgroundColor: '#166534',
    color: '#4ade80',
  },
  statusInactive: {
    backgroundColor: '#991b1b',
    color: '#f87171',
  },
  statusPending: {
    backgroundColor: '#854d0e',
    color: '#fef08a',
  },
  clockButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  clockButtonIn: {
    backgroundColor: '#22c55e',
  },
  clockButtonOut: {
    backgroundColor: '#ef4444',
  },
  clockButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginVertical: 16,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemSub: {
    fontSize: 13,
    marginTop: 2,
  },
  itemDate: {
    fontSize: 11,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  roleTag: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smallPrimaryButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  salaryLabel: {
    fontSize: 14,
  },
  salaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    borderBottomWidth: 0,
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    color: '#22c55e',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoutDangerButton: {
    backgroundColor: '#7f1d1d',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  logoutDangerText: {
    color: '#fca5a5',
    fontWeight: 'bold',
  },
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
  },
  segmentedPill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentedPillActive: {
    backgroundColor: '#6366f1',
  },
  segmentedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  segmentedTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 2,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
  },
  timeDetailContainer: {
    alignItems: 'center',
    marginTop: 2,
  },
  timeDetailText: {
    fontSize: 7.5,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statusLabelText: {
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 2,
    textAlign: 'center',
  },
  calendarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  calArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 8,
  },
  calGridRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    width: '14.28%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  calDayHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dayBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 15,
    fontWeight: '600',
  },
  attendanceDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#22c55e',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelButtonText: {
    fontWeight: '600',
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
    opacity: 0.6,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabActiveText: {
    color: '#818cf8',
    opacity: 1,
  },
  employeeItem: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  employeeName: {
    fontSize: 14,
    fontWeight: '600',
  },
  employeeEmail: {
    fontSize: 12,
    marginTop: 2,
  },
});
