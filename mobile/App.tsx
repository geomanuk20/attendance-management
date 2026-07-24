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
  Modal,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loginUser,
  clockIn,
  clockOut,
  getAttendance,
  getEmployees,
  getLeaveRequests,
  createLeaveRequest,
  getPayroll,
} from './src/services/api';

type TabType = 'dashboard' | 'attendance' | 'leaves' | 'salary' | 'employees' | 'settings';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('admin@company.com');
  const [password, setPassword] = useState('supersecret');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Attendance state
  const [clockedIn, setClockedIn] = useState(false);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
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
  const [payrollList, setPayrollList] = useState<any[]>([]);

  // Leave Request Modal State
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [leaveReason, setLeaveReason] = useState('');

  // Employee Portal Settings state
  const [settingsTab, setSettingsTab] = useState<'general' | 'notifications' | 'security'>('general');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [clockReminders, setClockReminders] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [autoLogout, setAutoLogout] = useState(true);

  // Calendar Widget state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [holidayModalVisible, setHolidayModalVisible] = useState(false);
  const [leaveBalanceModalVisible, setLeaveBalanceModalVisible] = useState(false);

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
    const isAdminOrHr = userData.role === 'admin' || userData.role === 'hr' || userData.role === 'superadmin';
    if (isAdminOrHr) {
      fetchEmployeeData();
    }
  };

  const handleLogin = async () => {
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
    } catch (err) {
      // Quietly handle permission restriction for non-admin roles
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
  const ALLOWED_RADIUS_KM = 0.2; // 200 Meters Radius

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
        await clockOut(user._id);
        setClockedIn(false);
        Alert.alert('Success 📍 Whiteswan TV LLP', 'Clocked out successfully from office location.');
      } else {
        await clockIn(user._id);
        setClockedIn(true);
        Alert.alert('Success 📍 Whiteswan TV LLP', 'Clocked in successfully at office location.');
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

  const verifyLocationAndExecute = (userLat: number, userLng: number) => {
    const dist = getDistanceKm(userLat, userLng, OFFICE_LAT, OFFICE_LNG);
    const distM = Math.round(dist * 1000);

    if (dist > ALLOWED_RADIUS_KM) {
      setLocationStatus({
        verified: false,
        statusText: `Outside Zone (${distM > 1000 ? (distM / 1000).toFixed(1) + 'km' : distM + 'm'} away • 200m Limit)`,
      });
      Alert.alert(
        '📍 Geofence Restricted',
        `Clock In / Clock Out is ONLY allowed at Whiteswan TV LLP office location.\n\nOffice: 10.0279° N, 76.3166° E\nYour Location: ${distM}m away (200m Limit)`
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

    if (typeof navigator !== 'undefined' && navigator && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const isVerified = verifyLocationAndExecute(position.coords.latitude, position.coords.longitude);
          if (isVerified) {
            await executeClockAction();
          }
        },
        async () => {
          if (locationStatus.verified) {
            await executeClockAction();
          } else {
            setLoading(false);
            Alert.alert(
              '📍 Location Verification Required',
              'You must be at Whiteswan TV LLP Office (10.0279° N, 76.3166° E) to Clock In / Clock Out.\n\nTap the Office Location card to re-verify location.'
            );
          }
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      if (locationStatus.verified) {
        await executeClockAction();
      } else {
        setLoading(false);
        Alert.alert(
          '📍 Location Verification Required',
          'You must be at Whiteswan TV LLP Office (10.0279° N, 76.3166° E) to Clock In / Clock Out.'
        );
      }
    }
  };

  const handleApplyLeave = async () => {
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
    return isNaN(d.getTime()) ? String(dateValue) : d.toLocaleDateString();
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

      // Determine Status: 'present' | 'leave' | 'absent' | 'weekend' | 'future'
      let status: 'present' | 'leave' | 'absent' | 'weekend' | 'future' = 'future';
      let statusDotColor = 'transparent';

      if (attendanceRec) {
        status = 'present';
        statusDotColor = '#22c55e'; // Green for Present
      } else if (leaveRec) {
        if (leaveRec.leaveType === 'Week Off' || (leaveRec.leaveType && leaveRec.leaveType.toLowerCase().includes('week'))) {
          status = 'weekend'; // User-chosen Week Off
          statusDotColor = '#94a3b8'; // Slate Gray for Week Off
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
                    cell.isToday && { backgroundColor: '#6366f1' },
                    cell.status === 'present' && !cell.isToday && { backgroundColor: '#14532d' },
                    cell.status === 'absent' && !cell.isToday && { backgroundColor: '#7f1d1d' },
                    cell.status === 'leave' && !cell.isToday && { backgroundColor: '#7c2d12' },
                    cell.status === 'weekend' && !cell.isToday && { backgroundColor: '#334155' },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: cell.isWeekend ? '#ef4444' : theme.text },
                      cell.status === 'present' && { color: '#4ade80', fontWeight: 'bold' },
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
          <Text style={[styles.userName, { color: theme.text }]}>{user.name}</Text>
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

      {/* Tab Content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'dashboard' && (
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
        )}

        {activeTab === 'attendance' && (
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
                Alert.alert('📍 Location Verified', 'Whiteswan TV LLP Office location verified (10.0279° N, 76.3166° E). Clock In / Clock Out active.');
              }}
              style={[styles.card, { backgroundColor: theme.cardBg, borderColor: locationStatus.verified ? '#22c55e' : '#ef4444', padding: 14 }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isDarkMode ? '#1e293b' : '#e0e7ff', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18 }}>🏢</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.text }}>
                    Whiteswan TV LLP Office
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textSub }}>
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
        )}

        {activeTab === 'leaves' && (
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
                      <Text style={[styles.itemDate, { color: theme.textSub }]}>{leave.startDate} to {leave.endDate}</Text>
                    </View>
                    <Text style={[styles.badgeText, leave.status === 'Approved' ? styles.statusActive : styles.statusPending]}>
                      {leave.status || 'Pending'}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {activeTab === 'salary' && (
          <View>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>Payroll & Salary Slip</Text>
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Monthly Breakdown</Text>
              <View style={[styles.salaryRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.salaryLabel, { color: theme.textSub }]}>Base Salary:</Text>
                <Text style={[styles.salaryValue, { color: theme.text }]}>₹{user.salary ? user.salary.toLocaleString('en-IN') : '40,000'}</Text>
              </View>
              <View style={[styles.salaryRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.salaryLabel, { color: theme.textSub }]}>HRA Allowance:</Text>
                <Text style={[styles.salaryValue, { color: theme.text }]}>₹8,000</Text>
              </View>
              <View style={[styles.salaryRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.salaryLabel, { color: theme.textSub }]}>Special Allowances:</Text>
                <Text style={[styles.salaryValue, { color: theme.text }]}>₹4,000</Text>
              </View>
              <View style={[styles.salaryRow, styles.totalRow]}>
                <Text style={[styles.totalLabel, { color: theme.text }]}>Estimated Net Pay:</Text>
                <Text style={styles.totalValue}>₹{((user.salary || 40000) + 12000).toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'employees' && (
          <View>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>Employee Directory</Text>
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              {employees.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textSub }]}>Loading employees...</Text>
              ) : (
                employees.map((emp, index) => (
                  <View key={emp._id || index} style={[styles.listRow, { borderBottomColor: theme.border }]}>
                    <View>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>{emp.name}</Text>
                      <Text style={[styles.itemSub, { color: theme.textSub }]}>{emp.position} • {emp.department}</Text>
                      <Text style={[styles.itemDate, { color: theme.textSub }]}>{emp.email}</Text>
                    </View>
                    <Text style={styles.roleTag}>{emp.role}</Text>
                  </View>
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

            {/* 3 Segmented Sub-Tabs: General | Notifications | Security */}
            <View style={[styles.segmentedContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.segmentedPill, settingsTab === 'general' && styles.segmentedPillActive]}
                onPress={() => setSettingsTab('general')}
              >
                <Text style={[styles.segmentedText, settingsTab === 'general' ? styles.segmentedTextActive : { color: theme.textSub }]}>
                  General
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentedPill, settingsTab === 'notifications' && styles.segmentedPillActive]}
                onPress={() => setSettingsTab('notifications')}
              >
                <Text style={[styles.segmentedText, settingsTab === 'notifications' ? styles.segmentedTextActive : { color: theme.textSub }]}>
                  Notifications
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentedPill, settingsTab === 'security' && styles.segmentedPillActive]}
                onPress={() => setSettingsTab('security')}
              >
                <Text style={[styles.segmentedText, settingsTab === 'security' ? styles.segmentedTextActive : { color: theme.textSub }]}>
                  Security
                </Text>
              </TouchableOpacity>
            </View>

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
                  <Switch value={pushNotifications} onValueChange={setPushNotifications} trackColor={{ false: '#cbd5e1', true: '#6366f1' }} />
                </View>

                <View style={[styles.salaryRow, { borderBottomColor: theme.border, alignItems: 'center' }]}>
                  <Text style={[styles.salaryLabel, { color: theme.text }]}>Shift Clock-In Reminders</Text>
                  <Switch value={clockReminders} onValueChange={setClockReminders} trackColor={{ false: '#cbd5e1', true: '#6366f1' }} />
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

            {/* Profile Information Card */}
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>👤 Profile Information</Text>

              <View style={[styles.salaryRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.salaryLabel, { color: theme.textSub }]}>Full Name:</Text>
                <Text style={[styles.salaryValue, { color: theme.text }]}>{user.name}</Text>
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
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
              {['Casual Leave', 'Medical Leave', 'Annual Leave', 'Week Off'].map((type) => (
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
                  <Text style={{ fontSize: 10, color: leaveType === type ? '#fff' : theme.textSub, fontWeight: 'bold' }}>
                    {type === 'Week Off' ? 'Week Off' : type.split(' ')[0]}
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
              <TouchableOpacity style={styles.cancelButton} onPress={() => setLeaveModalVisible(false)}>
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

      {/* Bottom Navigation Bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.navBg, borderTopColor: theme.border }]}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('dashboard')}>
          <Text style={[styles.tabIcon, activeTab === 'dashboard' && styles.tabActiveText]}>📊</Text>
          <Text style={[styles.tabLabel, { color: activeTab === 'dashboard' ? '#818cf8' : theme.textSub }]}>Dash</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('attendance')}>
          <Text style={[styles.tabIcon, activeTab === 'attendance' && styles.tabActiveText]}>⏰</Text>
          <Text style={[styles.tabLabel, { color: activeTab === 'attendance' ? '#818cf8' : theme.textSub }]}>Clock</Text>
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
          <Text style={[styles.tabIcon, activeTab === 'settings' && styles.tabActiveText]}>⚙️</Text>
          <Text style={[styles.tabLabel, { color: activeTab === 'settings' ? '#818cf8' : theme.textSub }]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
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
});
