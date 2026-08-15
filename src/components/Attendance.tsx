import { useState, useEffect, useMemo } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Clock, CalendarIcon, Search, Loader2, ChevronsUpDown, Check, Download, Pencil, ShieldCheck, Camera, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { getAttendance, clockIn, clockOut, getEmployees, getEmployeeNames, getLeaveRequests, updateAttendanceRecord, updateEmployee } from '../services/api';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { format, subDays, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { FaceRecognitionModal } from './FaceRecognitionModal';
import { FaceCameraEnrollModal } from './FaceCameraEnrollModal';
import { ModernSpinner } from './ui/ModernSpinner';

interface AttendanceProps {
  userRole?: 'admin' | 'employee' | 'superadmin' | 'hr';
}

const parseTimeToSeconds = (tStr: string | null | undefined): number | null => {
  if (!tStr || tStr === '-' || tStr === 'In progress') return null;
  const parts = String(tStr).trim().split(/\s+/);
  if (parts.length < 1) return null;
  const timeSegments = parts[0].split(':').map(Number);
  if (timeSegments.some(isNaN)) return null;
  let h = timeSegments[0];
  const m = timeSegments[1] || 0;
  const s = timeSegments[2] || 0;
  const period = parts.length > 1 ? parts[1].toUpperCase() : null;
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 3600 + m * 60 + s;
};

const calculateWorkHoursFromTimes = (clockInStr: string | null | undefined, clockOutStr: string | null | undefined): number => {
  const inSec = parseTimeToSeconds(clockInStr);
  const outSec = parseTimeToSeconds(clockOutStr);
  if (inSec === null || outSec === null) return 0;
  let diffSec = outSec - inSec;
  if (diffSec < 0) diffSec += 24 * 3600; // Handle overnight / cross-midnight shift
  return parseFloat((diffSec / 3600).toFixed(4));
};

const formatWorkHours = (hours: number | null | undefined, clockInStr?: string, clockOutStr?: string) => {
  let effHours = typeof hours === 'number' ? hours : 0;
  if ((!effHours || effHours <= 0) && clockInStr && clockOutStr && clockOutStr !== '-') {
    effHours = calculateWorkHoursFromTimes(clockInStr, clockOutStr);
  }

  if (!effHours || effHours <= 0) return null;

  const totalSeconds = Math.round(effHours * 3600);
  if (totalSeconds <= 0) return null;

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const totalMinutes = Math.round(totalSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export function Attendance({ userRole = 'admin' }: AttendanceProps) {
  // Common state
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'date' | 'month' | 'range'>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [dateDropOpen, setDateDropOpen] = useState(false);
  const [fromDropOpen, setFromDropOpen] = useState(false);
  const [toDropOpen, setToDropOpen] = useState(false);
  const [calPickYear, setCalPickYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [employeeList, setEmployeeList] = useState<any[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [empDropOpen, setEmpDropOpen] = useState(false);

  // Admin Edit Attendance State
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [editStatus, setEditStatus] = useState('Present');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleOpenEditModal = (record: any) => {
    setEditingRecord(record);
    setEditClockIn(record.clockIn && record.clockIn !== '-' ? record.clockIn : '');
    setEditClockOut(record.clockOut && record.clockOut !== '-' ? record.clockOut : '');
    setEditStatus(record.status || 'Present');
  };

  const handleSaveAttendanceEdit = async () => {
    if (!editingRecord) return;
    setIsUpdating(true);
    try {
      const empId = typeof editingRecord.employeeId === 'object' ? editingRecord.employeeId._id : editingRecord.employeeId;
      await updateAttendanceRecord(editingRecord._id, {
        employeeId: empId,
        date: editingRecord.date,
        clockIn: editClockIn.trim() || undefined,
        clockOut: editClockOut.trim() || undefined,
        status: editStatus,
      });
      toast.success(`Attendance status updated to ${editStatus} for ${editingRecord.employeeId?.name || 'Employee'}`);
      setEditingRecord(null);
      await fetchAttendance();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update attendance');
    } finally {
      setIsUpdating(false);
    }
  };

  // Employee specific state
  const [user, setUser] = useState<any>(null);
  const [status, setStatus] = useState<'Checked In' | 'Checked Out' | 'Completed'>('Checked Out');
  const [todayRecord, setTodayRecord] = useState<any>(null);

  // Face Recognition Modal State
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [pendingClockAction, setPendingClockAction] = useState<'Clock In' | 'Clock Out'>('Clock In');
  // Face photo camera capture state
  const [isCameraEnrollOpen, setIsCameraEnrollOpen] = useState(false);
  const [isFaceUploading, setIsFaceUploading] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    today: 0,
    vacation: 0,
    halfDay: 0,
    rate: 0
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchAttendance = async (employeeId?: string) => {
    try {
      setLoading(true);
      const data = await getAttendance(employeeId);
      // Sort by date descending
      const sortedData = data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAttendanceRecords(sortedData);

      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      const todayRecords = data.filter((r: any) => r.date === today);

      setStats({
        today: todayRecords.length,
        vacation: data.filter((r: any) => r.status === 'Vacation').length,
        halfDay: data.filter((r: any) => r.status === 'Half-Day').length,
        rate: data.length > 0 ? Math.round((todayRecords.length / 50) * 100) : 0
      });

    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error('Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayStatus = async (employeeId?: string) => {
    if (!employeeId) return;
    try {
      const today = toLocalDateStr(new Date());
      const data = await getAttendance(employeeId);
      const todayRec = data.find((record: any) => {
        const rDate = String(record.date).split('T')[0];
        return rDate === today;
      });
      setTodayRecord(todayRec || null);

      if (todayRec) {
        if (todayRec.clockOut) {
          setStatus('Completed');
        } else {
          setStatus('Checked In');
        }
      } else {
        setStatus('Checked Out');
      }
    } catch (error) {
      console.error('Error fetching today status:', error);
    }
  };

  const fetchAttendanceSilent = async (employeeId?: string) => {
    try {
      const data = await getAttendance(employeeId);
      const sortedData = data.sort((a: any, b: any) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
      setAttendanceRecords(sortedData);
    } catch (e) {
      // Silent background poll
    }
  };

  const fetchLeaveData = async () => {
    try {
      const data = await getLeaveRequests();
      setLeaveRequests(data || []);
    } catch (e) {
      console.error('Error fetching leave requests:', e);
    }
  };

  const fetchFreshUserProfile = async (empId?: string, email?: string) => {
    try {
      const allEmps = await getEmployees();
      if (Array.isArray(allEmps) && allEmps.length > 0) {
        const fresh = allEmps.find((e: any) =>
          (empId && (String(e._id) === String(empId) || String(e.id) === String(empId))) ||
          (email && e.email && e.email.toLowerCase() === email.toLowerCase())
        );
        if (fresh) {
          setUser((prev: any) => {
            const updated = {
              ...(prev || {}),
              ...fresh,
              id: fresh._id || fresh.id || prev?.id,
              _id: fresh._id || fresh.id || prev?._id,
              faceImage: fresh.faceImage !== undefined ? fresh.faceImage : (prev?.faceImage || '')
            };
            localStorage.setItem('user', JSON.stringify(updated));
            return updated;
          });
        }
      }
    } catch (e) {
      console.warn('Error fetching fresh user profile:', e);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    let targetEmpId: string | undefined = undefined;
    let userEmail: string | undefined = undefined;
    const isAdmin = userRole === 'admin' || userRole === 'hr' || userRole === 'superadmin';

    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      targetEmpId = parsedUser.id || parsedUser._id;
      userEmail = parsedUser.email;
      fetchTodayStatus(targetEmpId);
    }

    const empIdToFetch = isAdmin ? undefined : targetEmpId;
    fetchAttendance(empIdToFetch);
    fetchLeaveData();
    fetchFreshUserProfile(targetEmpId, userEmail);
    getEmployeeNames().then(setEmployeeList).catch(() => {});

    // Auto-polling every 5 seconds so mobile & employee clock-ins update live on admin dashboard
    const pollInterval = setInterval(() => {
      fetchAttendanceSilent(empIdToFetch);
      fetchLeaveData();
      fetchFreshUserProfile(targetEmpId, userEmail);
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [userRole]);

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

  const verifyLocation = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast.error('Geolocation is not supported by your browser');
        resolve(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = getDistanceKm(pos.coords.latitude, pos.coords.longitude, OFFICE_LAT, OFFICE_LNG);
          if (dist > ALLOWED_RADIUS_KM) {
            const distDisplay = dist > 1 ? `${dist.toFixed(1)}km` : `${Math.round(dist * 1000)}m`;
            toast.error(`❌ Restricted: You are ${distDisplay} away. Clock In/Out is only allowed within 100 meters of Whiteswan TV Office.`);
            resolve(false);
          } else {
            resolve(true);
          }
        },
        (err) => {
          console.warn('Geolocation error:', err);
          toast.error('Location permission required to verify 100m Whiteswan TV office zone.');
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  const handleClockIn = async () => {
    // Check face enrolled before allowing clock-in
    if (!isValidFaceImage(user?.faceImage)) {
      toast.error('Please upload your face photo first before clocking in.');
      return;
    }

    const isOk = await verifyLocation();
    if (!isOk) return;

    setPendingClockAction('Clock In');
    setIsFaceModalOpen(true);
  };

  const handleClockOut = async () => {
    const isOk = await verifyLocation();
    if (!isOk) return;

    setPendingClockAction('Clock Out');
    setIsFaceModalOpen(true);
  };

  // Check if a face image is a valid uploaded photo
  const isValidFaceImage = (img: string | undefined | null): boolean => {
    if (!img || typeof img !== 'string') return false;
    const clean = img.trim();
    if (clean.length < 5) return false;
    // Accept real http/https/file URIs
    if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('file://')) return clean.length > 10;
    // Accept any real base64 data URI or string
    if (clean.startsWith('data:image')) return clean.length > 50;
    return clean.length > 20;
  };

  const handleCapturedCameraPhoto = async (capturedDataUrl: string) => {
    const empId = user?.id || user?._id;
    if (!empId) {
      toast.error('Session error. Please logout and login again.');
      return;
    }
    setIsFaceUploading(true);
    try {
      await updateEmployee(empId, { faceImage: capturedDataUrl });
      const updatedUser = { ...user, faceImage: capturedDataUrl };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      toast.success('✅ Face photo captured & enrolled successfully! Face ID is now Active.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save face photo');
    } finally {
      setIsFaceUploading(false);
    }
  };

  const executeVerifiedClockAction = async (matchedUser?: any) => {
    const userId = matchedUser?._id || matchedUser?.id || user?.id || user?._id;
    if (!userId) {
      toast.error('Session invalid. Please logout and login again.');
      return;
    }

    try {
      if (pendingClockAction === 'Clock In') {
        const res = await clockIn(userId);
        const timeStr = res.clockIn || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        toast.success(`✓ Biometric Face Verified! Clocked In at ${timeStr}`);
        fetchTodayStatus(userId);
      } else {
        const res = await clockOut(userId);
        const timeStr = res.clockOut || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const totalHours = res.workHours || 0;
        const h = Math.floor(totalHours);
        const m = Math.round((totalHours - h) * 60);
        const duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
        toast.success(`✓ Biometric Face Verified! Clocked Out at ${timeStr}. Today's Hours: ${duration}`);
        fetchTodayStatus(userId);
      }
    } catch (error: any) {
      if (error?.message && error.message.includes('Already clocked in')) {
        setStatus('Checked In');
        fetchTodayStatus(userId);
        toast.info('You are already clocked in for today.');
        return;
      }
      toast.error(error.message || `Failed to ${pendingClockAction.toLowerCase()}`);
    }
  };

  const formatName = (str?: string) => {
    if (!str) return '';
    return String(str)
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const toLocalDateStr = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const cleanStr = String(dateStr).split('T')[0];
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date(dateStr);
  };

  // Keep month picker year synchronized when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setCalPickYear(selectedDate.getFullYear());
    }
  }, [selectedDate]);

  // Build employee list from loaded attendance records (always available) + API fetch
  const derivedEmployeeList = Array.from(
    new Map(
      attendanceRecords
        .filter(r => r.employeeId?._id)
        .map(r => [r.employeeId._id, { _id: r.employeeId._id, name: r.employeeId.name, employeeCode: r.employeeId.employeeCode, department: r.employeeId.department }])
    ).values()
  ).sort((a: any, b: any) => a.name.localeCompare(b.name));

  // Merge: use API list if loaded, otherwise fall back to derived list
  const mergedEmployeeList = employeeList.length > 0 ? employeeList : derivedEmployeeList;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Present':
      case 'Attendance':
        return <Badge style={{ backgroundColor: '#10B981', color: '#ffffff' }} className="hover:bg-emerald-600 px-4 py-1 font-semibold text-center min-w-[72px] inline-flex items-center justify-center">Present</Badge>;
      case 'Vacation':
      case 'Leave':
        return <Badge style={{ backgroundColor: '#F9A825', color: '#ffffff' }} className="hover:bg-yellow-600 px-4 py-1 font-semibold text-center min-w-[72px] inline-flex items-center justify-center">Leave</Badge>;
      case 'Half-Day':
      case 'Half Day':
        return <Badge style={{ backgroundColor: '#3BAFDA', color: '#ffffff' }} className="hover:bg-blue-600 px-4 py-1 font-semibold text-center min-w-[72px] inline-flex items-center justify-center">Half-Day</Badge>;
      case 'Week Off':
      case 'Weekend Off':
        return <Badge style={{ backgroundColor: '#64748B', color: '#ffffff' }} className="hover:bg-slate-600 px-4 py-1 font-semibold text-center min-w-[72px] inline-flex items-center justify-center">Week Off</Badge>;
      case 'Absent':
        return <Badge style={{ backgroundColor: '#EF4444', color: '#ffffff' }} className="hover:bg-red-600 px-4 py-1 font-semibold text-center min-w-[72px] inline-flex items-center justify-center">Absent</Badge>;
      default:
        return <Badge variant="secondary" className="px-4 py-1 font-semibold text-center min-w-[72px] inline-flex items-center justify-center">{status}</Badge>;
    }
  };

  // Map approved/pending leave requests by `${employeeId}_${dateStr}` and `${employeeName}_${dateStr}`
  const approvedLeaveMap = useMemo(() => {
    const map = new Map<string, any>();
    leaveRequests.forEach(lr => {
      const statusLower = String(lr.status || '').toLowerCase();
      if (statusLower === 'approved' || statusLower === 'pending' || !lr.status) {
        const empObj = (typeof lr.employeeId === 'object' && lr.employeeId) ? lr.employeeId : null;
        const empIdKey = String(empObj?._id || lr.employeeId || '');
        const empNameKey = formatName(empObj?.name || lr.employeeName || lr.name || '');

        const startD = parseLocalDate(lr.startDate);
        const endD = parseLocalDate(lr.endDate);
        startD.setHours(0, 0, 0, 0);
        endD.setHours(0, 0, 0, 0);

        const maxDays = (typeof lr.daysCount === 'number' && lr.daysCount > 0) ? lr.daysCount : (typeof lr.totalDays === 'number' && lr.totalDays > 0) ? lr.totalDays : 999;

        let count = 0;
        const cur = new Date(startD);
        while (cur <= endD && count < maxDays) {
          const dStr = toLocalDateStr(cur);
          if (empIdKey) map.set(`${empIdKey}_${dStr}`, lr);
          if (empNameKey) map.set(`${empNameKey}_${dStr}`, lr);
          cur.setDate(cur.getDate() + 1);
          count++;
        }
      }
    });
    return map;
  }, [leaveRequests]);

  // Generate complete attendance records including Absent, Week Off, and Vacation for dates without clock-in
  const fullCalendarRecords = useMemo(() => {
    if (!attendanceRecords) return [];

    // Map existing attendance by `${employeeId}_${dateStr}` & `${name}_${dateStr}`
    const existingMap = new Map();
    attendanceRecords.forEach(r => {
      const empObj = typeof r.employeeId === 'object' && r.employeeId ? r.employeeId : null;
      const empIdStr1 = String(empObj?._id || empObj?.id || r.employeeId || '');
      const empIdStr2 = String(empObj?.id || empObj?._id || '');
      const empName = String(empObj?.name || r.name || r.employeeName || '').toLowerCase().trim();
      const dateStr = r.date ? String(r.date).split('T')[0] : '';

      if (empIdStr1 && dateStr) existingMap.set(`${empIdStr1}_${dateStr}`, r);
      if (empIdStr2 && dateStr) existingMap.set(`${empIdStr2}_${dateStr}`, r);
      if (empName && dateStr) {
        existingMap.set(`${empName}_${dateStr}`, r);
        existingMap.set(`${formatName(empName)}_${dateStr}`, r);
      }
    });

    // Target employees to show
    const empsToShow = mergedEmployeeList.length > 0 ? mergedEmployeeList : [
      { _id: 'emp_1', name: 'Geo Manu', employeeCode: 'WTN 025', department: 'Management' }
    ];

    // Determine range of dates to generate:
    let startDate: Date;
    let endDate: Date;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateFilterMode === 'range') {
      if (dateFrom && dateTo) {
        startDate = new Date(dateFrom);
        endDate = new Date(dateTo);
      } else if (dateFrom) {
        startDate = new Date(dateFrom);
        endDate = new Date(today);
      } else if (dateTo) {
        startDate = new Date(dateTo.getFullYear(), dateTo.getMonth(), 1);
        endDate = new Date(dateTo);
      } else {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today);
      }
    } else if (dateFilterMode === 'month' || dateFilterMode === 'date') {
      const y = selectedDate.getFullYear();
      const m = selectedDate.getMonth();
      startDate = new Date(y, m, 1);
      const lastDay = new Date(y, m + 1, 0).getDate();
      endDate = new Date(y, m, lastDay);
    } else {
      if (attendanceRecords.length > 0) {
        const dates = attendanceRecords.map(r => parseLocalDate(r.date).getTime()).filter(t => !isNaN(t));
        const minTime = Math.min(...dates);
        const maxTime = Math.max(...dates, today.getTime());
        startDate = new Date(minTime);
        endDate = new Date(maxTime);
      } else {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today);
      }
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const records: any[] = [];
    const curDate = new Date(startDate);

    while (curDate <= endDate) {
      const dStr = toLocalDateStr(curDate);

      empsToShow.forEach(emp => {
        const empIdKey1 = String(emp._id || emp.id || '');
        const empIdKey2 = String(emp.id || emp._id || '');
        const empNameClean = String(emp.name || '').toLowerCase().trim();
        const empNameFormatted = formatName(emp.name);
        const empObj: any = { _id: empIdKey1, name: emp.name, employeeCode: emp.employeeCode, department: emp.department, employmentType: (emp as any)?.employmentType };

        const existing = existingMap.get(`${empIdKey1}_${dStr}`) ||
                         existingMap.get(`${empIdKey2}_${dStr}`) ||
                         existingMap.get(`${empNameClean}_${dStr}`) ||
                         existingMap.get(`${empNameFormatted}_${dStr}`);
        const leaveRec = approvedLeaveMap.get(`${empIdKey1}_${dStr}`) ||
                         approvedLeaveMap.get(`${empIdKey2}_${dStr}`) ||
                         approvedLeaveMap.get(`${empNameClean}_${dStr}`) ||
                         approvedLeaveMap.get(`${empNameFormatted}_${dStr}`);

        if (leaveRec && (!existing || !existing.clockIn)) {
          const lType = String(leaveRec.leaveType || '').toLowerCase();
          let derivedStatus = 'Leave';
          if (lType.includes('week')) {
            derivedStatus = 'Week Off';
          } else if (lType.includes('half')) {
            derivedStatus = 'Half-Day';
          } else {
            derivedStatus = 'Leave';
          }

          records.push({
            ...(existing || {}),
            _id: existing?._id || `gen_leave_${empIdKey1}_${dStr}`,
            employeeId: empObj,
            name: emp.name,
            employeeCode: emp.employeeCode,
            department: emp.department,
            date: dStr,
            clockIn: existing?.clockIn || null,
            clockOut: existing?.clockOut || null,
            workHours: existing?.workHours || 0,
            status: derivedStatus,
            isGenerated: true
          });
        } else if (existing) {
          let effStatus = existing.status || 'Present';
          if (existing.clockIn && effStatus === 'Absent') {
            effStatus = 'Present';
          }
          let hrs = Number(existing.workHours) || 0;
          if (!hrs && existing.clockIn && existing.clockOut) {
            hrs = calculateWorkHoursFromTimes(existing.clockIn, existing.clockOut);
          }
          const empType = (emp as any)?.employmentType || (empObj as any)?.employmentType || 'Full-Time';
          const isPartTime = empType === 'Part-Time';
          const halfDayCutoff = isPartTime ? 2 : 4;

          if (hrs >= 4 && (effStatus === 'Half-Day' || effStatus === 'Half Day' || effStatus === 'Attendance')) {
            effStatus = 'Present';
          } else if (hrs > 0 && hrs < halfDayCutoff && (effStatus === 'Present' || effStatus === 'Attendance')) {
            effStatus = 'Half-Day';
          }
          records.push({ ...existing, employeeId: empObj, status: effStatus, workHours: hrs || existing.workHours });
        } else {
          records.push({
            _id: `gen_${empIdKey1}_${dStr}`,
            employeeId: empObj,
            name: emp.name,
            employeeCode: emp.employeeCode,
            department: emp.department,
            date: dStr,
            clockIn: null,
            clockOut: null,
            workHours: 0,
            status: 'Absent',
            isGenerated: true
          });
        }
      });

      curDate.setDate(curDate.getDate() + 1);
    }

    return records.sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
  }, [attendanceRecords, mergedEmployeeList, selectedDate, dateFilterMode, dateFrom, dateTo, approvedLeaveMap]);

  const filteredRecords = fullCalendarRecords.filter(record => {
    const employeeObj = (typeof record.employeeId === 'object' && record.employeeId) ? record.employeeId : null;
    const employeeName = employeeObj?.name || record.employeeName || record.name || '';
    const employeeIdStr = String(employeeObj?._id || record.employeeId || '');

    const matchesSearch = !searchTerm || employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = selectedDepartment === 'all' || (employeeObj?.department === selectedDepartment || record.department === selectedDepartment);
    const matchesStatus = selectedStatus === 'all' || (
      selectedStatus === 'Present' && (record.status === 'Present' || record.status === 'Attendance') ||
      selectedStatus === 'Absent' && record.status === 'Absent' ||
      selectedStatus === 'Leave' && (record.status === 'Leave' || record.status === 'Vacation') ||
      selectedStatus === 'Half-Day' && (record.status === 'Half-Day' || record.status === 'Half Day') ||
      selectedStatus === 'Week Off' && (record.status === 'Week Off' || record.status === 'Weekend Off') ||
      record.status === selectedStatus
    );
    const matchesEmployee = selectedEmployee === 'all'
      || employeeIdStr === selectedEmployee
      || (employeeObj?._id && String(employeeObj._id) === selectedEmployee)
      || (employeeName && employeeName.toLowerCase() === selectedEmployee.toLowerCase());

    const recordDateStr = record.date ? String(record.date).split('T')[0] : '';
    const recordDate = parseLocalDate(record.date);
    recordDate.setHours(0, 0, 0, 0);

    if (dateFilterMode === 'date') {
      return matchesSearch && matchesDepartment && matchesStatus && matchesEmployee && recordDateStr === toLocalDateStr(selectedDate);
    }
    if (dateFilterMode === 'range') {
      let fromDate: Date | null = null;
      let toDate: Date | null = null;

      if (dateFrom) {
        fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
      }
      if (dateTo) {
        toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
      }

      return matchesSearch && matchesDepartment && matchesStatus && matchesEmployee
        && (!fromDate || recordDate >= fromDate)
        && (!toDate || recordDate <= toDate);
    }
    if (dateFilterMode === 'month') {
      const selectedMonthStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
      return matchesSearch && matchesDepartment && matchesStatus && matchesEmployee && recordDateStr.startsWith(selectedMonthStr);
    }
    return matchesSearch && matchesDepartment && matchesStatus && matchesEmployee;
  });



  const exportToExcel = async () => {
    try {
      const recordsToExport = filteredRecords && filteredRecords.length > 0 ? filteredRecords : attendanceRecords;

      if (!recordsToExport || recordsToExport.length === 0) {
        toast.error('No attendance records found for the selected filters');
        return;
      }

      // Build employee lookup map
      const empLookup: { [key: string]: any } = {};
      mergedEmployeeList.forEach(e => {
        if (e._id) empLookup[e._id] = e;
        if (e.id) empLookup[e.id] = e;
      });

      // Distinct employees in this export
      // Determine list of employees to include in export based on selected filters
      let exportEmployees: any[] = [];

      if (userRole === 'employee') {
        const empObj = mergedEmployeeList.find(e => String(e._id) === String(user?.id) || String(e.id) === String(user?.id)) || user;
        if (empObj) exportEmployees = [empObj];
      } else if (selectedEmployee !== 'all') {
        const found = mergedEmployeeList.find(e =>
          String(e._id) === String(selectedEmployee) ||
          String(e.id) === String(selectedEmployee) ||
          formatName(e.name).toLowerCase() === String(selectedEmployee).toLowerCase()
        );
        if (found) {
          exportEmployees = [found];
        } else if (recordsToExport.length > 0) {
          const firstRecEmp = recordsToExport[0]?.employeeId;
          if (typeof firstRecEmp === 'object' && firstRecEmp) exportEmployees = [firstRecEmp];
        }
      } else if (selectedDepartment !== 'all') {
        exportEmployees = mergedEmployeeList.filter(e => e.department === selectedDepartment);
      } else {
        const empSet = new Map();
        recordsToExport.forEach(r => {
          const empObj = (typeof r.employeeId === 'object' && r.employeeId) ? r.employeeId : (empLookup[r.employeeId] || r.user);
          if (empObj) {
            const key = empObj._id || empObj.id || empObj.name;
            if (!empSet.has(key)) empSet.set(key, empObj);
          }
        });
        exportEmployees = Array.from(empSet.values());
        if (exportEmployees.length === 0) exportEmployees = mergedEmployeeList;
      }

      const mainEmp = exportEmployees[0] || {};
      const individualName = formatName(mainEmp.name || user?.name || 'Geo Manu');
      const getEmpCode = (empObj: any, index: number) => {
        const name = formatName(empObj?.name || '');
        if (name.includes('Geo')) return 'WTN 025';
        if (name.includes('Leo')) return 'LMT 002';
        if (name.includes('Sony')) return 'SK 003';
        if (name.includes('Jane')) return 'WTN 004';
        if (name.includes('Super') || name.includes('Admin')) return 'WTN 001';
        if (name.includes('Hr') || name.includes('Manager')) return 'WTN 002';
        return empObj?.employeeCode && !empObj.employeeCode.startsWith('WTN-6A60AD') ? empObj.employeeCode : `WTN ${String(index + 1).padStart(3, '0')}`;
      };
      const individualCode = getEmpCode(mainEmp, 0);
      const individualDept = mainEmp.department || 'Management';

      // Calculate date list dynamically based on dateFilterMode
      const monthDates: Date[] = [];
      const monthDateStrings: string[] = [];
      let periodLabelStr = '';

      if (dateFilterMode === 'range') {
        let startD = dateFrom ? new Date(dateFrom) : (recordsToExport.length > 0 ? parseLocalDate(recordsToExport[recordsToExport.length - 1].date) : new Date());
        let endD = dateTo ? new Date(dateTo) : new Date();
        startD.setHours(0, 0, 0, 0);
        endD.setHours(0, 0, 0, 0);

        if (startD > endD) {
          const tmp = startD; startD = endD; endD = tmp;
        }

        const cur = new Date(startD);
        while (cur <= endD) {
          monthDates.push(new Date(cur));
          monthDateStrings.push(toLocalDateStr(cur));
          cur.setDate(cur.getDate() + 1);
        }
        periodLabelStr = `${toLocalDateStr(startD)}_to_${toLocalDateStr(endD)}`;
      } else if (dateFilterMode === 'date') {
        const dObj = new Date(selectedDate);
        monthDates.push(dObj);
        monthDateStrings.push(toLocalDateStr(dObj));
        periodLabelStr = toLocalDateStr(dObj);
      } else {
        const y = selectedDate.getFullYear();
        const m = selectedDate.getMonth();
        const totalDays = new Date(y, m + 1, 0).getDate();
        for (let day = 1; day <= totalDays; day++) {
          const dObj = new Date(y, m, day);
          monthDates.push(dObj);
          monthDateStrings.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        }
        periodLabelStr = format(selectedDate, 'MMM_yyyy');
      }

      const totalDaysInPeriod = monthDates.length;
      const monthNameStr = dateFilterMode === 'month'
        ? format(selectedDate, 'MMMM yyyy')
        : dateFilterMode === 'range' && monthDates.length > 0
          ? `${format(monthDates[0], 'dd/MM/yyyy')} to ${format(monthDates[monthDates.length - 1], 'dd/MM/yyyy')}`
          : format(selectedDate, 'dd/MM/yyyy');

      // Map records by `${employeeId}_${dateStr}` for O(1) lookup
      const recordMap = new Map();
      recordsToExport.forEach(r => {
        const empObj = (typeof r.employeeId === 'object' && r.employeeId) ? r.employeeId : (empLookup[r.employeeId] || r.user);
        const empIdKey = String(empObj?._id || r.employeeId || '');
        const dStr = r.date ? String(r.date).split('T')[0] : '';
        if (empIdKey && dStr) {
          recordMap.set(`${empIdKey}_${dStr}`, r);
        }
        if (empObj?.name && dStr) {
          recordMap.set(`${formatName(empObj.name)}_${dStr}`, r);
        }
      });

      // ── SECTION 1: MONTHLY MATRIX
      const matrixHeaderDaysHtml = monthDates.map(d => {
        const label = dateFilterMode === 'month' ? `${d.getDate()}` : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        return `<th style="background-color:#0f172a; color:#ffffff; text-align:center; min-width:36px;">${label}</th>`;
      }).join('');

      const matrixRowsHtml = exportEmployees.map((emp, empIdx) => {
        const empName = formatName(emp.name);
        const empCode = getEmpCode(emp, empIdx);
        const dept = emp.department || 'Management';
        const empKey = String(emp._id || emp.id || '');

        let totalPresent = 0;
        let totalAbsent = 0;
        let totalHalfDay = 0;
        let totalLeave = 0;
        let totalWeekOff = 0;
        let totalHoursNum = 0;

        const dayCellsHtml = monthDateStrings.map((dStr, idx) => {
          const rec = recordMap.get(`${empKey}_${dStr}`) || recordMap.get(`${empName}_${dStr}`);
          const leaveRec = approvedLeaveMap.get(`${empKey}_${dStr}`) || approvedLeaveMap.get(`${empName}_${dStr}`);

          // Priority 1: Record from database / admin edit (rec)
          if (rec) {
            const st = String(rec.status || '').toLowerCase();
            if (st === 'present' || st === 'attendance' || rec.clockIn || rec.workHours > 0) {
              totalPresent++;
              totalHoursNum += (rec.workHours || 0);
              return `<td style="text-align:center; font-weight:bold; background-color:#dcfce7; color:#15803d;">P</td>`;
            } else if (st === 'half-day' || st === 'half day' || st === 'halfday') {
              totalHalfDay++;
              totalHoursNum += (rec.workHours || 0);
              return `<td style="text-align:center; font-weight:bold; background-color:#fef3c7; color:#b45309;">HD</td>`;
            } else if (st === 'leave' || st === 'vacation') {
              totalLeave++;
              return `<td style="text-align:center; font-weight:bold; background-color:#e0f2fe; color:#0369a1;">L</td>`;
            } else if (st === 'week off' || st === 'weekend off' || st === 'weekoff') {
              totalWeekOff++;
              return `<td style="text-align:center; color:#64748b; background-color:#f8fafc;">WO</td>`;
            } else if (st === 'absent') {
              totalAbsent++;
              return `<td style="text-align:center; color:#dc2626; background-color:#fef2f2;">A</td>`;
            }
          }

          // Priority 2: Approved leave request (leaveRec)
          if (leaveRec) {
            const lType = String(leaveRec.leaveType || '').toLowerCase();
            if (lType.includes('week')) {
              totalWeekOff++;
              return `<td style="text-align:center; color:#64748b; background-color:#f8fafc;">WO</td>`;
            } else if (lType.includes('half')) {
              totalHalfDay++;
              return `<td style="text-align:center; font-weight:bold; background-color:#fef3c7; color:#b45309;">HD</td>`;
            } else {
              totalLeave++;
              return `<td style="text-align:center; font-weight:bold; background-color:#e0f2fe; color:#0369a1;">L</td>`;
            }
          }

          // Priority 3: Default unlogged day => ABSENT (A)
          totalAbsent++;
          return `<td style="text-align:center; color:#dc2626; background-color:#fef2f2;">A</td>`;
        }).join('');

        const formattedTotalHours = formatWorkHours(totalHoursNum) || (totalHoursNum > 0 ? `${Math.round(totalHoursNum)}h` : '0h');

        return `<tr>
          <td style="font-weight:bold; color:#0f172a;">${empName}</td>
          <td style="font-weight:bold; color:#1e3a8a;">${empCode}</td>
          <td>${dept}</td>
          ${dayCellsHtml}
          <td style="font-weight:bold; text-align:center; background-color:#dcfce7; color:#15803d;">${totalPresent} Days</td>
          <td style="font-weight:bold; text-align:center; background-color:#fef2f2; color:#dc2626;">${totalAbsent} Days</td>
          <td style="font-weight:bold; text-align:center; background-color:#fef3c7; color:#b45309;">${totalHalfDay} Days</td>
          <td style="font-weight:bold; text-align:center; background-color:#e0f2fe; color:#0369a1;">${totalLeave} Days</td>
          <td style="font-weight:bold; text-align:center; background-color:#f8fafc; color:#64748b;">${totalWeekOff} Days</td>
          <td style="font-weight:bold; text-align:center; background-color:#f1f5f9; color:#0f172a;">${formattedTotalHours}</td>
        </tr>`;
      }).join('');

      const isIndividual = exportEmployees.length === 1;
      const titleHeader = isIndividual
        ? `WHITESWAN TV LLP — INDIVIDUAL ATTENDANCE REPORT (${individualName.toUpperCase()} • ID: ${individualCode})`
        : `WHITESWAN TV LLP — MONTHLY ATTENDANCE REPORT (${monthNameStr.toUpperCase()})`;

      if (!periodLabelStr) {
        periodLabelStr = monthNameStr.replace(/\s+/g, '_');
      }

      const excelTemplate = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8"/>
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Monthly Attendance Matrix</x:Name>
          <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    th { background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; padding: 10px; border: 1px solid #0f172a; }
    td { padding: 8px; border: 1px solid #cbd5e1; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; }
  </style>
</head>
<body>
  <h2 style="font-family:sans-serif; color:#0f172a; margin-bottom:5px;">${titleHeader}</h2>
  <p style="font-family:sans-serif; color:#475569; margin-bottom:15px; font-weight:bold;">
    Month / Pay Period: ${monthNameStr} | Total Days: ${totalDaysInPeriod} Days | Status: Complete Calendar Period Sheet
  </p>

  <table border="1" style="border-collapse:collapse;">
    <thead>
      <tr>
        <th style="background-color:#0f172a; color:#ffffff; text-align:left;">Employee Name</th>
        <th style="background-color:#0f172a; color:#ffffff; text-align:left;">Employee ID</th>
        <th style="background-color:#0f172a; color:#ffffff; text-align:left;">Department</th>
        ${matrixHeaderDaysHtml}
        <th style="background-color:#0f172a; color:#ffffff;">Total Present</th>
        <th style="background-color:#0f172a; color:#ffffff;">Total Absent</th>
        <th style="background-color:#0f172a; color:#ffffff;">Total Half-Day</th>
        <th style="background-color:#0f172a; color:#ffffff;">Total Leave</th>
        <th style="background-color:#0f172a; color:#ffffff;">Total Week Off</th>
        <th style="background-color:#0f172a; color:#ffffff;">Total Hours</th>
      </tr>
    </thead>
    <tbody>
      ${matrixRowsHtml}
    </tbody>
  </table>
</body>
</html>`;

      const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filePrefix = isIndividual ? `Whiteswan_Attendance_${individualName.replace(/\s+/g, '_')}` : `Whiteswan_Month_AllDates`;
      const filename = `${filePrefix}_${periodLabelStr}_${format(new Date(), 'yyyy-MM-dd')}.xls`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported complete ${totalDaysInPeriod}-day sheet for ${monthNameStr} to Excel!`);
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error('Failed to export complete month attendance records to Excel');
    }
  };

  const formatTimeDisplay = (timeValue: any) => {
    if (!timeValue) return '--:--';
    const is24h = localStorage.getItem('timeFormat') === '24h';
    let d: Date;
    if (timeValue instanceof Date) {
      d = timeValue;
    } else {
      d = new Date(timeValue);
    }
    if (isNaN(d.getTime())) return String(timeValue);
    if (is24h) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    }
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  };

  if (loading) {
    return <ModernSpinner label="Loading Attendance Records..." size="lg" />;
  }

  if (userRole === 'employee') {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2>My Attendance</h2>
            <p className="text-muted-foreground">Manage your daily attendance</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={exportToExcel}>
              <Download className="h-4 w-4" />
              Export History
            </Button>
          </div>
        </div>

        {/* Face ID Status Banner */}
        {!isValidFaceImage(user?.faceImage) ? (
          <Card
            className="border-2 border-amber-300 dark:border-amber-700"
            style={{ backgroundColor: 'rgba(254, 243, 199, 0.6)' }}
          >
            <div className="p-5 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d' }}
                >
                  <Camera className="h-6 w-6" style={{ color: '#d97706' }} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#d97706' }} />
                    <p className="font-bold text-sm" style={{ color: '#92400e' }}>
                      Face ID Not Enrolled
                    </p>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>
                    Open camera to scan & capture your face photo for biometric attendance.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => setIsCameraEnrollOpen(true)}
                disabled={isFaceUploading}
                style={{
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
                  whiteSpace: 'nowrap',
                  lineHeight: '1.2',
                }}
              >
                <Camera className="h-4 w-4" /> Open Camera & Capture Face
              </Button>
            </div>
          </Card>
        ) : (
          <Card
            className="border border-emerald-300 dark:border-emerald-800"
            style={{ backgroundColor: 'rgba(209, 250, 229, 0.5)' }}
          >
            <div className="p-4 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="h-12 w-12 rounded-full overflow-hidden border-2 flex-shrink-0"
                  style={{ borderColor: '#10b981', backgroundColor: '#a7f3d0' }}
                >
                  <img src={user?.faceImage} alt="Face ID" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 flex-shrink-0" style={{ color: '#059669' }} />
                    <p className="font-bold text-sm" style={{ color: '#065f46' }}>
                      Face ID Active — Biometric Ready
                    </p>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#047857' }}>
                    Your face is enrolled. Face scan is required to clock in/out.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => setIsCameraEnrollOpen(true)}
                disabled={isFaceUploading}
                style={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)',
                  whiteSpace: 'nowrap',
                }}
              >
                <Camera className="h-3.5 w-3.5" /> Recapture Face
              </Button>
            </div>
          </Card>
        )}

        {/* Face Camera Enroll Modal */}
        <FaceCameraEnrollModal
          isOpen={isCameraEnrollOpen}
          onClose={() => setIsCameraEnrollOpen(false)}
          onCapture={handleCapturedCameraPhoto}
          userName={user?.name || 'Employee'}
        />


        <Card className="p-8 flex flex-col items-center justify-center space-y-6 bg-gradient-to-br from-background to-secondary/20">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold">{format(currentTime, 'EEEE, MMMM do, yyyy')}</h3>
            <p className="text-muted-foreground text-lg font-mono">{formatTimeDisplay(currentTime)}</p>
          </div>

          {status === 'Checked Out' && (
            <Button
              size="lg"
              className="h-32 w-32 rounded-full text-base font-bold shadow-xl transition-all duration-200 active:scale-95 bg-primary hover:bg-primary/90 text-primary-foreground flex flex-col items-center justify-center gap-1 p-2 text-center cursor-pointer"
              onClick={handleClockIn}
            >
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
              <span>Face Scan</span>
              <span className="text-xs font-semibold opacity-90">Clock In</span>
            </Button>
          )}

          {status === 'Checked In' && (
            <Button
              size="lg"
              className="h-32 w-32 rounded-full text-base font-bold shadow-xl transition-all duration-200 active:scale-95 bg-destructive hover:bg-destructive/90 text-destructive-foreground flex flex-col items-center justify-center gap-1 p-2 text-center cursor-pointer"
              onClick={handleClockOut}
            >
              <ShieldCheck className="h-6 w-6 text-white" />
              <span>Face Scan</span>
              <span className="text-xs font-semibold opacity-90">Clock Out</span>
            </Button>
          )}

          {status === 'Completed' && (
            <div className="px-6 py-3 rounded-md shadow-md bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-center gap-3 border-2 border-emerald-500 min-w-[190px] select-none animate-in fade-in zoom-in-95">
              <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-white font-extrabold text-sm tracking-wide leading-none">Shift Done</span>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mt-1">Completed</span>
              </div>
            </div>
          )}
          <div className="flex gap-8 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Check In</p>
              <p className="font-semibold">{todayRecord?.clockIn || '--:--'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Check Out</p>
              <p className="font-semibold text-muted-foreground">{todayRecord?.clockOut || '--:--'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-semibold text-muted-foreground">{status}</p>
            </div>
          </div>
        </Card>

        {/* Employee Personal History */}
        <Card>
          <div className="p-6">
            <h3 className="mb-4">Recent Activity</h3>
            {attendanceRecords.length > 0 ? (
              <div className="space-y-4">
                {attendanceRecords.slice(0, 5).map((record) => (
                  <div key={record._id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{format(new Date(record.date), 'EEEE, MMM d, yyyy')}</p>
                      <p className="text-xs text-muted-foreground">{record.status}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">In: {record.clockIn || '-'}</p>
                      <p className="text-xs text-muted-foreground">Out: {record.clockOut || '-'}</p>
                      <p className="text-xs text-muted-foreground">
                        {record.workHours > 0 ? `${formatWorkHours(record.workHours)} worked` : record.clockIn && !record.clockOut ? 'In progress' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                No personal attendance records found
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2>Attendance Management</h2>
          <p className="text-muted-foreground">Track and manage employee attendance records</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={exportToExcel}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Quick Stats — reactive to active filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-semibold" style={{ color: '#10B981' }}>
              {filteredRecords.filter(r => r.status === 'Present' || r.status === 'Attendance').length}
            </p>
            <p className="text-sm text-muted-foreground">
              {dateFilterMode === 'date' ? `Present on ${format(selectedDate, 'MMM d')}` : dateFilterMode === 'month' ? `Present in ${format(selectedDate, 'MMM yyyy')}` : 'Total Present'}
            </p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-semibold" style={{ color: '#F9A825' }}>
              {filteredRecords.filter(r => r.status === 'Vacation' || r.status === 'Leave').length}
            </p>
            <p className="text-sm text-muted-foreground">On Leave</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-semibold" style={{ color: '#3BAFDA' }}>
              {filteredRecords.filter(r => r.status === 'Half-Day' || r.status === 'Half Day').length}
            </p>
            <p className="text-sm text-muted-foreground">Half-Day</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-semibold text-blue-600">
              {filteredRecords.length > 0
                ? Math.round((filteredRecords.filter(r => r.status === 'Present' || r.status === 'Attendance').length / filteredRecords.length) * 100)
                : 0}%
            </p>
            <p className="text-sm text-muted-foreground">Attendance Rate</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex items-center flex-1 sm:flex-initial min-w-[200px] sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full"
            />
          </div>

          {/* ── Date filter: Select mode + conditional calendar Popover ──────── */}
          <Select value={dateFilterMode} onValueChange={(v) => {
            setDateFilterMode(v as 'all' | 'date' | 'month' | 'range');
            // When switching back to all, reset display
          }}>
            <SelectTrigger className="w-36">
              <CalendarIcon className="h-4 w-4 mr-1 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="date">By Date</SelectItem>
              <SelectItem value="month">By Month</SelectItem>
              <SelectItem value="range">By Range</SelectItem>
            </SelectContent>
          </Select>

          {/* Calendar picker — date / month mode */}
          {/* Native date picker for By Date mode */}
          {dateFilterMode === 'date' && (
            <div className="flex items-center gap-1.5 bg-background border border-input rounded-md px-3 py-1.5 shadow-sm h-9">
              <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="date"
                value={toLocalDateStr(selectedDate)}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(parseLocalDate(e.target.value));
                  }
                }}
                className="bg-transparent text-xs font-medium outline-none cursor-pointer border-0 p-0 focus:ring-0 text-foreground"
              />
            </div>
          )}

          {/* Month picker for By Month mode */}
          {dateFilterMode === 'month' && (
            <Popover open={dateDropOpen} onOpenChange={setDateDropOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 text-xs h-9">
                  <CalendarIcon className="h-4 w-4" />
                  {format(selectedDate, 'MMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3">
                  <div className="flex items-center justify-between mb-3">
                    <Button variant="ghost" size="sm" onClick={() => setCalPickYear(y => y - 1)}>‹</Button>
                    <span className="text-sm font-semibold">{calPickYear}</span>
                    <Button variant="ghost" size="sm" onClick={() => setCalPickYear(y => y + 1)}>›</Button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => {
                      const active = selectedDate.getFullYear() === calPickYear && selectedDate.getMonth() === i;
                      return (
                        <Button key={m} variant={active ? 'default' : 'ghost'} size="sm"
                          onClick={() => { setSelectedDate(new Date(calPickYear, i, 1)); setDateDropOpen(false); }}
                        >{m}</Button>
                      );
                    })}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Range picker — two date selectors (From / To) */}
          {dateFilterMode === 'range' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-background border border-input rounded-md px-2 py-1 shadow-sm">
                <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground font-medium shrink-0">From:</span>
                <input
                  type="date"
                  value={dateFrom ? toLocalDateStr(dateFrom) : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDateFrom(parseLocalDate(e.target.value));
                    } else {
                      setDateFrom(undefined);
                    }
                  }}
                  className="bg-transparent text-xs outline-none cursor-pointer border-0 p-0 focus:ring-0 text-foreground"
                />
              </div>
              <span className="text-muted-foreground text-sm font-medium">–</span>
              <div className="flex items-center gap-1.5 bg-background border border-input rounded-md px-2 py-1 shadow-sm">
                <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground font-medium shrink-0">To:</span>
                <input
                  type="date"
                  value={dateTo ? toLocalDateStr(dateTo) : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDateTo(parseLocalDate(e.target.value));
                    } else {
                      setDateTo(undefined);
                    }
                  }}
                  className="bg-transparent text-xs outline-none cursor-pointer border-0 p-0 focus:ring-0 text-foreground"
                />
              </div>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground px-2 h-8"
                  onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                  Clear
                </Button>
              )}
            </div>
          )}

          {/* Employee dropdown filter */}
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="all">All Employees</SelectItem>
              {mergedEmployeeList.map((emp: any) => {
                const empIdValue = String(emp._id || emp.id || emp.name);
                const empCodeStr = emp.employeeCode ? ` (${emp.employeeCode})` : '';
                return (
                  <SelectItem key={empIdValue} value={empIdValue}>
                    {formatName(emp.name)}{empCodeStr}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="Engineering">Engineering</SelectItem>
              <SelectItem value="Design">Design</SelectItem>
              <SelectItem value="Marketing">Marketing</SelectItem>
              <SelectItem value="Sales">Sales</SelectItem>
              <SelectItem value="HR">HR</SelectItem>
              <SelectItem value="Finance">Finance</SelectItem>
              <SelectItem value="Logistics and Fulfillment">Logistics and Fulfillment</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Present">Present</SelectItem>
              <SelectItem value="Absent">Absent</SelectItem>
              <SelectItem value="Leave">Leave</SelectItem>
              <SelectItem value="Half-Day">Half-Day</SelectItem>
              <SelectItem value="Week Off">Week Off</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Attendance Table */}
      <Card>
        <div className="p-6">
          <h3 className="mb-4">Attendance Records</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <TableRow key={record._id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                          <span className="text-primary-foreground text-xs">
                            {record.employeeId?.name.split(' ').map((n: string) => n[0]).join('') || 'U'}
                          </span>
                        </div>
                        {record.employeeId?.name || 'Unknown User'}
                      </div>
                    </TableCell>
                    <TableCell>{record.employeeId?.department || '-'}</TableCell>
                    <TableCell>{record.date}</TableCell>
                    <TableCell>{record.clockIn || '-'}</TableCell>
                    <TableCell>{record.clockOut || '-'}</TableCell>
                    <TableCell>
                      {formatWorkHours(record.workHours, record.clockIn, record.clockOut) ||
                        (record.clockIn && (!record.clockOut || record.clockOut === '-') ? 'In progress' : '-')}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs gap-1.5 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                        onClick={() => handleOpenEditModal(record)}
                        title="Edit Clock In/Out & Status"
                      >
                        <Pencil className="h-3.5 w-3.5 text-primary" />
                        <span>Edit</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No attendance records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Admin Edit Attendance Status & Times Modal - High Precision SaaS Design */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent className="sm:max-w-[480px] p-0 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white overflow-hidden">
          {/* Header Banner */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-800/40">
                <Pencil className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">Update Attendance Record</DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Modify attendance status & time stamps
                </DialogDescription>
              </div>
            </div>
          </div>

          {editingRecord && (
            <div className="p-6 space-y-5">
              {/* Employee & Date Information Card */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    {(editingRecord.employeeId?.name || 'EM').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight">
                      {editingRecord.employeeId?.name || 'Employee'}
                    </p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      {editingRecord.employeeId?.department || 'General Staff'}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs font-mono font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
                  📅 {editingRecord.date}
                </Badge>
              </div>

              {/* Status Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="editStatus" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Attendance Status
                </Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger id="editStatus" className="h-11 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 shadow-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-slate-400">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl bg-white dark:bg-slate-800">
                    <SelectItem value="Present" className="font-semibold text-emerald-600 dark:text-emerald-400">● Present</SelectItem>
                    <SelectItem value="Absent" className="font-semibold text-rose-600 dark:text-rose-400">● Absent</SelectItem>
                    <SelectItem value="Leave" className="font-semibold text-amber-600 dark:text-amber-400">● Leave</SelectItem>
                    <SelectItem value="Half-Day" className="font-semibold text-blue-600 dark:text-blue-400">● Half-Day</SelectItem>
                    <SelectItem value="Week Off" className="font-semibold text-slate-600 dark:text-slate-400">● Week Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clock In and Clock Out Grid */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="editClockIn" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Clock In Time
                  </Label>
                  <div className="relative">
                    <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                      id="editClockIn"
                      placeholder="09:30:00 AM"
                      value={editClockIn}
                      onChange={(e) => setEditClockIn(e.target.value)}
                      className="h-11 pl-10 pr-3 font-mono text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editClockOut" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Clock Out Time
                  </Label>
                  <div className="relative">
                    <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                      id="editClockOut"
                      placeholder="06:30:00 PM"
                      value={editClockOut}
                      onChange={(e) => setEditClockOut(e.target.value)}
                      className="h-11 pl-10 pr-3 font-mono text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingRecord(null)}
              className="h-10 px-5 rounded-xl font-semibold text-xs border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveAttendanceEdit}
              disabled={isUpdating}
              className="h-10 px-6 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <FaceRecognitionModal
        isOpen={isFaceModalOpen}
        onClose={() => setIsFaceModalOpen(false)}
        onVerified={executeVerifiedClockAction}
        userName={user?.name || 'Employee'}
        actionType={pendingClockAction}
        enrolledFaceImage={user?.faceImage}
        enrolledEmployees={employeeList}
      />
    </div>
  );
}