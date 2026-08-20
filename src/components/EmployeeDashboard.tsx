import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { Clock, Calendar, AlertCircle, LogIn, LogOut, Loader2, ShieldCheck, MapPin } from 'lucide-react';
import { getAttendance, clockIn, clockOut, getEmployees, getLeaveRequests, getCompanySettings } from '../services/api';
import { getCurrentLocation, getDistanceMeters } from '../services/geolocation';
import { toast } from 'sonner';
import { FaceRecognitionModal } from './FaceRecognitionModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

const myAttendanceData = [
  { name: 'Mon', hours: 8.5 },
  { name: 'Tue', hours: 8.0 },
  { name: 'Wed', hours: 9.0 },
  { name: 'Thu', hours: 8.5 },
  { name: 'Fri', hours: 7.5 },
  { name: 'Sat', hours: 0 },
  { name: 'Sun', hours: 0 },
];

const myRecentActivities = [
  { id: 1, action: 'Clocked in', time: '9:00 AM', date: 'Today' },
  { id: 2, action: 'Leave request approved', time: '2:00 PM', date: 'Yesterday' },
  { id: 3, action: 'Clocked out', time: '6:00 PM', date: 'Yesterday' },
];

const COMPANY_HOLIDAYS = [
  { id: '1', name: 'Independence Day', date: '2026-08-15', day: 'Saturday', type: 'National Holiday', icon: '🇮🇳' },
  { id: '2', name: 'Thiruvonam (Onam)', date: '2026-08-27', day: 'Thursday', type: 'Festival Holiday', icon: '🌾' },
  { id: '3', name: 'Sree Krishna Jayanthi', date: '2026-09-04', day: 'Friday', type: 'Festival Holiday', icon: '🪈' },
  { id: '4', name: 'Milad-un-Nabi (Id-e-Milad)', date: '2026-09-15', day: 'Tuesday', type: 'Festival Holiday', icon: '🌙' },
  { id: '5', name: 'Gandhi Jayanti', date: '2026-10-02', day: 'Friday', type: 'National Holiday', icon: '🕊️' },
  { id: '6', name: 'Mahanavami / Dussehra', date: '2026-10-20', day: 'Tuesday', type: 'Festival Holiday', icon: '✨' },
  { id: '7', name: 'Deepavali (Diwali)', date: '2026-11-08', day: 'Sunday', type: 'Festival Holiday', icon: '🪔' },
  { id: '8', name: 'Christmas', date: '2026-12-25', day: 'Friday', type: 'Festival Holiday', icon: '🎄' },
  { id: '9', name: 'New Year’s Day', date: '2027-01-01', day: 'Friday', type: 'Public Holiday', icon: '🎆' },
  { id: '10', name: 'Republic Day', date: '2027-01-26', day: 'Tuesday', type: 'National Holiday', icon: '🇮🇳' },
  { id: '11', name: 'Maha Shivratri', date: '2027-03-06', day: 'Saturday', type: 'Festival Holiday', icon: '🔱' },
  { id: '12', name: 'Eid al-Fitr (Ramzan)', date: '2027-03-10', day: 'Wednesday', type: 'Festival Holiday', icon: '🌙' },
  { id: '13', name: 'Vishu / Good Friday', date: '2027-04-14', day: 'Wednesday', type: 'Festival Holiday', icon: '🌿' },
  { id: '14', name: 'May Day (Labor Day)', date: '2027-05-01', day: 'Saturday', type: 'Public Holiday', icon: '🔨' },
];

interface EmployeeDashboardProps {
  currency?: string;
  onNavigate?: (view: string) => void;
}

export function EmployeeDashboard({ currency = 'USD', onNavigate }: EmployeeDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'Checked In' | 'Checked Out' | 'Completed'>('Checked Out');
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  // Face Recognition Modal State
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [pendingClockAction, setPendingClockAction] = useState<'Clock In' | 'Clock Out'>('Clock In');
  const [isLeaveBalanceModalOpen, setIsLeaveBalanceModalOpen] = useState(false);
  const [isHolidaysModalOpen, setIsHolidaysModalOpen] = useState(false);

  const [leaveStats, setLeaveStats] = useState({
    casualQuota: 6,
    casualUsed: 0,
    casualLeft: 6,
    sickQuota: 6,
    sickUsed: 0,
    sickLeft: 6,
    annualQuota: 6,
    annualUsed: 2,
    annualLeft: 4,
    totalBalance: 16
  });

  const toLocalDateStr = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const todayDateStr = toLocalDateStr(new Date());
  const upcomingHolidays = COMPANY_HOLIDAYS.filter(h => h.date >= todayDateStr);
  const nextHoliday = upcomingHolidays.length > 0 ? upcomingHolidays[0] : COMPANY_HOLIDAYS[COMPANY_HOLIDAYS.length - 1];

  const formatHolidayDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const getDaysUntilText = (dateStr: string) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parts = dateStr.split('-');
      if (parts.length !== 3) return '';
      const target = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      target.setHours(0, 0, 0, 0);
      const diffTime = target.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return 'Passed';
      if (diffDays === 0) return 'Today 🎉';
      if (diffDays === 1) return 'Tomorrow';
      return `${diffDays} Days Left`;
    } catch {
      return '';
    }
  };

  const getAccurateWorkHours = (record: any): number => {
    if (!record) return 0;
    if (record.createdAt && record.updatedAt && record.clockOut && record.clockOut !== '-' && record.clockOut !== 'In progress') {
      const startMs = new Date(record.createdAt).getTime();
      const endMs = new Date(record.updatedAt).getTime();
      if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
        const diffSec = (endMs - startMs) / 1000;
        if (diffSec > 0 && diffSec < 24 * 3600) {
          return parseFloat((diffSec / 3600).toFixed(4));
        }
      }
    }
    return typeof record.workHours === 'number' ? record.workHours : 0;
  };

  const [allEmployees, setAllEmployees] = useState<any[]>([]);

  const [isTodayWeekOff, setIsTodayWeekOff] = useState(false);
  const [monthlyWeekOffCount, setMonthlyWeekOffCount] = useState(0);

  const fetchLeaveStats = async (employeeId?: string, userEmail?: string) => {
    try {
      const leaves = await getLeaveRequests(employeeId);
      if (Array.isArray(leaves)) {
        const myApprovedLeaves = leaves.filter((l: any) => {
          const isMe = !employeeId || (employeeId && (l.employeeId?._id === employeeId || l.employeeId === employeeId)) ||
            (userEmail && l.employeeId?.email?.toLowerCase() === userEmail.toLowerCase());
          const isApproved = l.status === 'Approved' || l.status === 'approved';
          return isMe && isApproved;
        });

        let casualUsed = 0;
        let sickUsed = 0;
        let annualUsed = 2;
        let weekOffCount = 0;

        const currentMonthStr = todayDateStr.substring(0, 7);
        let offToday = false;

        myApprovedLeaves.forEach((l: any) => {
          const type = (l.type || l.leaveType || '').toLowerCase();
          const days = Number(l.days || l.duration || 1);
          const sDate = String(l.startDate || l.date || '').split('T')[0];
          const eDate = String(l.endDate || l.startDate || l.date || '').split('T')[0];

          if (type.includes('casual')) {
            casualUsed += days;
          } else if (type.includes('sick') || type.includes('medical')) {
            sickUsed += days;
          } else if (type.includes('week')) {
            if (sDate.startsWith(currentMonthStr)) {
              weekOffCount += days;
            }
            if (todayDateStr >= sDate && todayDateStr <= eDate) {
              offToday = true;
            }
          } else {
            annualUsed += days;
          }
        });

        setIsTodayWeekOff(offToday);
        setMonthlyWeekOffCount(weekOffCount);

        const casualLeft = Math.max(0, 6 - casualUsed);
        const sickLeft = Math.max(0, 6 - sickUsed);
        const annualLeft = Math.max(0, 6 - annualUsed);
        const totalBalance = casualLeft + sickLeft + annualLeft;

        setLeaveStats({
          casualQuota: 6,
          casualUsed,
          casualLeft,
          sickQuota: 6,
          sickUsed,
          sickLeft,
          annualQuota: 6,
          annualUsed,
          annualLeft,
          totalBalance
        });
      }
    } catch (e) {
      console.warn('Error fetching leave stats:', e);
    }
  };

  useEffect(() => {
    getEmployees().then(emps => {
      setAllEmployees(emps);
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        const match = emps.find((e: any) =>
          (e._id && e._id === (parsed._id || parsed.id)) ||
          (e.email && e.email.toLowerCase() === parsed.email?.toLowerCase()) ||
          (e.name && e.name.toLowerCase() === parsed.name?.toLowerCase())
        );
        if (match && match.faceImage) {
          setUser({ ...parsed, faceImage: match.faceImage });
        }
      }
    }).catch(() => {});

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      const empId = parsedUser.id || parsedUser._id;
      fetchTodayAttendance(empId);
      fetchLeaveStats(empId, parsedUser.email);
    } else {
      setLoading(false);
    }
  }, []);

  const [weeklyHours, setWeeklyHours] = useState(41.5);
  const [weeklyAttendanceChart, setWeeklyAttendanceChart] = useState<any[]>(myAttendanceData);
  const [userActivities, setUserActivities] = useState<any[]>(myRecentActivities);

  const fetchTodayAttendance = async (employeeId: string) => {
    if (!employeeId) return;
    try {
      const today = toLocalDateStr(new Date());
      const data = await getAttendance(employeeId);
      // Filter for today's record
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

      // Compute weekly stats dynamically from real attendance logs
      if (Array.isArray(data) && data.length > 0) {
        const now = new Date();
        const currentDay = now.getDay();
        const diffToMon = (currentDay === 0 ? -6 : 1 - currentDay);
        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMon);
        monday.setHours(0, 0, 0, 0);

        let sumHours = 0;
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const dayMap: { [key: string]: number } = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };

        data.forEach((rec: any) => {
          const d = new Date(rec.date);
          if (d >= monday) {
            const h = getAccurateWorkHours(rec);
            sumHours += h;
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            if (dayMap[dayName] !== undefined) {
              dayMap[dayName] += Number(h.toFixed(1));
            }
          }
        });

        setWeeklyHours(Number(sumHours.toFixed(1)));
        setWeeklyAttendanceChart(days.map((day) => ({ name: day, hours: dayMap[day] || 0 })));

        // Recent activity feed
        const sorted = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
        const acts = sorted.map((rec, idx) => {
          const effH = getAccurateWorkHours(rec);
          return {
            id: rec._id || idx,
            action: rec.clockOut ? `Clocked out (${effH > 0 ? (effH < 1 ? Math.round(effH * 60) + 'm' : effH.toFixed(1) + 'h') : 'Done'})` : 'Clocked in',
            time: rec.clockOut
              ? (rec.updatedAt ? new Date(rec.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : rec.clockOut)
              : rec.clockIn
              ? (rec.createdAt ? new Date(rec.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : rec.clockIn)
              : '9:00 AM',
            date: String(rec.date).split('T')[0] === today ? 'Today' : String(rec.date).split('T')[0],
          };
        });
        setUserActivities(acts);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic Company Geofence Location
  const [companyLocation, setCompanyLocation] = useState<{
    officeLatitude: number;
    officeLongitude: number;
    allowedRadiusMeters: number;
    companyName: string;
  }>({
    officeLatitude: 10.0279421,
    officeLongitude: 76.3166192,
    allowedRadiusMeters: 100,
    companyName: 'Whiteswan TV Office'
  });

  useEffect(() => {
    getCompanySettings().then(data => {
      if (data) {
        setCompanyLocation({
          officeLatitude: Number(data.officeLatitude) || 10.0279421,
          officeLongitude: Number(data.officeLongitude) || 76.3166192,
          allowedRadiusMeters: Number(data.allowedRadiusMeters) || 100,
          companyName: data.companyName || 'Whiteswan TV Office'
        });
      }
    }).catch(() => {});
  }, []);

  // Precise Haversine formula calculation returning exact distance in meters
  const verifyLocation = async (): Promise<boolean> => {
    // Check latest settings from state or localStorage
    let officeLat = companyLocation.officeLatitude || 10.0279421;
    let officeLng = companyLocation.officeLongitude || 76.3166192;
    let maxRadius = companyLocation.allowedRadiusMeters || 100;
    let compName = companyLocation.companyName || 'Whiteswan TV Office';

    try {
      const stored = localStorage.getItem('companySettings');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.officeLatitude !== undefined) officeLat = Number(parsed.officeLatitude);
        if (parsed.officeLongitude !== undefined) officeLng = Number(parsed.officeLongitude);
        if (parsed.allowedRadiusMeters !== undefined) maxRadius = Number(parsed.allowedRadiusMeters);
        if (parsed.companyName) compName = parsed.companyName;
      }
    } catch {}

    toast.loading(`Detecting location for ${compName} (${maxRadius}m zone)...`, { id: 'loc-check' });

    try {
      const pos = await getCurrentLocation();
      const distMeters = getDistanceMeters(pos.latitude, pos.longitude, officeLat, officeLng);

      if (distMeters > maxRadius) {
        const distDisplay = distMeters >= 1000 ? `${(distMeters / 1000).toFixed(2)}km` : `${Math.round(distMeters)}m`;
        toast.error(`❌ Restricted: You are ${distDisplay} away. Clock In/Out is only allowed within ${maxRadius} meters of ${compName}.`, { id: 'loc-check', duration: 5000 });
        return false;
      } else {
        const distDisplay = Math.round(distMeters);
        toast.success(`✓ Geofence Verified: ${distDisplay}m from ${compName} (allowed: ${maxRadius}m)`, { id: 'loc-check' });
        return true;
      }
    } catch (err: any) {
      console.warn('Geolocation error:', err);
      toast.error(err.message || `Location permission required to verify ${maxRadius}m ${compName} geofence zone.`, { id: 'loc-check', duration: 7000 });
      return false;
    }
  };

  const handleClockIn = async () => {
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

  const executeVerifiedClockAction = async (matchedUser?: any) => {
    const userId = user?._id || user?.id || matchedUser?._id || matchedUser?.id;
    if (!userId) {
      toast.error('Could not identify employee profile for attendance logging.');
      return;
    }

    try {
      setLoading(true);
      if (pendingClockAction === 'Clock In') {
        const res = await clockIn(userId);
        const timeStr = res.clockIn || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        toast.success(`✓ Biometric Face Verified! Clocked In at ${timeStr}`);
      } else {
        const res = await clockOut(userId);
        const timeStr = res.clockOut || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const totalHours = res.workHours || 0;
        const h = Math.floor(totalHours);
        const m = Math.round((totalHours - h) * 60);
        const duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
        toast.success(`✓ Biometric Face Verified! Clocked Out at ${timeStr}. Today's Hours: ${duration}`);
      }
      fetchTodayAttendance(userId);
    } catch (error: any) {
      console.error('Clock action error:', error);
      if (error?.message && error.message.includes('Already clocked in')) {
        setStatus('Checked In');
        fetchTodayAttendance(userId);
        toast.info('You are already clocked in for today.');
        return;
      }
      toast.error(error.message || `Failed to ${pendingClockAction.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !user) { // Only show full loader if user not loaded yet
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">My Dashboard</h2>
          <p className="text-sm text-muted-foreground">Welcome back, {user?.name?.split(' ')[0] || 'Employee'}! Here's your overview.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">

          {status === 'Checked Out' && (
            <Button
              onClick={handleClockIn}
              disabled={loading}
              style={{ backgroundColor: '#0D2B52', color: '#ffffff' }}
              className="gap-2 bg-[#0D2B52] hover:bg-[#081d38] text-white font-bold px-5 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 text-white" />}
              <span className="font-bold text-white text-sm">Face Scan Clock In</span>
            </Button>
          )}
          {status === 'Checked In' && (
            <Button
              onClick={handleClockOut}
              disabled={loading}
              style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
              className="gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-5 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 text-white" />}
              <span className="font-bold text-white text-sm">Face Scan Clock Out</span>
            </Button>
          )}

          <Badge variant="secondary" className={`flex items-center gap-2 px-3 py-1.5 font-medium ${isTodayWeekOff ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700' :
            status === 'Checked In' ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400' :
            status === 'Checked Out' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
              'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
            }`}>
            <div className={`h-2 w-2 rounded-full ${isTodayWeekOff ? 'bg-slate-500' :
              status === 'Checked In' ? 'bg-green-500 animate-pulse' :
              status === 'Checked Out' ? 'bg-slate-400' :
                'bg-blue-500'
              }`}></div>
            {isTodayWeekOff ? '🏖️ Week Off (Today)' : status === 'Checked In' ? 'Working Now' : status === 'Checked Out' ? 'Not Checked In' : 'Completed Today'}
          </Badge>
        </div>
      </div>

      {/* Week Off Alert Banner */}
      {isTodayWeekOff && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-500/10 via-indigo-500/10 to-slate-500/10 border border-slate-500/30 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-500/20 flex items-center justify-center text-xl shrink-0">
              🏖️
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Today is your Scheduled Week Off</p>
              <p className="text-xs text-muted-foreground">Enjoy your rest day! You are not required to clock in today.</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/30 text-xs font-bold shrink-0">
            Off Duty
          </Badge>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Hours Worked (This Week)</p>
              <p className="text-2xl font-semibold">{weeklyHours}</p>
              <Progress value={Math.min(100, Math.round((weeklyHours / 45) * 100))} className="h-2 mt-2 w-full" />
              <p className="text-xs text-muted-foreground mt-1">Goal: 45 hours</p>
            </div>
            <div className="h-12 w-12 rounded-lg flex items-center justify-center bg-cyan-500/10">
              <Clock className="h-6 w-6 text-cyan-500" />
            </div>
          </div>
        </Card>

        <Card
          className="p-6 cursor-pointer hover:border-amber-500/50 hover:shadow-lg transition-all"
          onClick={() => setIsLeaveBalanceModalOpen(true)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Leave Balance</p>
              <p className="text-2xl font-semibold">{leaveStats.totalBalance} Days</p>
              <p className="text-xs text-amber-500 mt-1 flex items-center gap-1 font-medium">
                <span>Click to view breakdown</span>
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg flex items-center justify-center bg-amber-500/10 hover:bg-amber-500/20 transition-colors">
              <Calendar className="h-6 w-6 text-amber-500" />
            </div>
          </div>
        </Card>

        <Card
          className="p-6 cursor-pointer hover:border-emerald-500/50 hover:shadow-lg transition-all"
          onClick={() => setIsHolidaysModalOpen(true)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Next Holiday</p>
              <p className="text-2xl font-semibold">{nextHoliday?.name || 'Thiruvonam (Onam)'}</p>
              <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1 font-medium">
                <span>{nextHoliday ? `${formatHolidayDate(nextHoliday.date)} • Click to view all` : 'Click to view all'}</span>
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
              <AlertCircle className="h-6 w-6 text-emerald-500" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="mb-4">My Attendance (Hours)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyAttendanceChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value: any) => [`${value} hrs`, 'Work Hours']}
                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '10px', border: '1px solid #334155', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.4)' }}
                labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                itemStyle={{ color: '#38bdf8', fontWeight: '500' }}
              />
              <Bar dataKey="hours" fill="#3BAFDA" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {userActivities.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.date}</p>
                </div>
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <FaceRecognitionModal
        isOpen={isFaceModalOpen}
        onClose={() => setIsFaceModalOpen(false)}
        onVerified={executeVerifiedClockAction}
        userName={user?.name || 'Employee'}
        actionType={pendingClockAction}
        enrolledFaceImage={user?.faceImage}
      />

      {/* Leave Balance Breakdown Dialog Modal */}
      <Dialog open={isLeaveBalanceModalOpen} onOpenChange={setIsLeaveBalanceModalOpen}>
        <DialogContent className="max-w-lg w-full p-6 rounded-2xl border border-border bg-card text-card-foreground shadow-2xl space-y-4">
          <DialogHeader className="p-0 space-y-1">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <span>📊</span> Leave Balance Breakdown (2026)
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Annual allotted quotas and remaining leave balance
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {/* Total Balance Banner */}
            <div className="p-4 rounded-xl leave-banner-amber flex items-center justify-between">
              <div>
                <p className="text-xs font-bold leave-banner-title">Total Available Leave Balance</p>
                <p className="text-2xl font-bold text-foreground mt-0.5">{leaveStats.totalBalance} Days</p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setIsLeaveBalanceModalOpen(false);
                  if (onNavigate) {
                    onNavigate('leave');
                  }
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-3 rounded-lg cursor-pointer shrink-0"
              >
                Apply Leave
              </Button>
            </div>

            {/* Casual Leave */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/70 hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏖️</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Casual Leave (CL)</p>
                  <p className="text-xs text-muted-foreground">Annual quota: {leaveStats.casualQuota} Days • Used: {leaveStats.casualUsed} Days</p>
                </div>
              </div>
              <span className="px-3.5 py-1.5 rounded-lg leave-pill-emerald font-bold text-xs whitespace-nowrap">
                {leaveStats.casualLeft} Days Left
              </span>
            </div>

            {/* Sick Leave */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/70 hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💊</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Sick Leave (SL)</p>
                  <p className="text-xs text-muted-foreground">Annual quota: {leaveStats.sickQuota} Days • Used: {leaveStats.sickUsed} Days</p>
                </div>
              </div>
              <span className="px-3.5 py-1.5 rounded-lg leave-pill-blue font-bold text-xs whitespace-nowrap">
                {leaveStats.sickLeft} Days Left
              </span>
            </div>

            {/* Annual Leave */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/70 hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Annual Leave (AL)</p>
                  <p className="text-xs text-muted-foreground">Annual quota: {leaveStats.annualQuota} Days • Used: {leaveStats.annualUsed} Days</p>
                </div>
              </div>
              <span className="px-3.5 py-1.5 rounded-lg leave-pill-amber font-bold text-xs whitespace-nowrap">
                {leaveStats.annualLeft} Days Left
              </span>
            </div>

            {/* Week Off Policy */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/70 hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏖️</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Week Off Policy</p>
                  <p className="text-xs text-muted-foreground">
                    {monthlyWeekOffCount} of 4 Scheduled This Month • {isTodayWeekOff ? '🏖️ Today is Week Off' : '💼 Regular Work Day'}
                  </p>
                </div>
              </div>
              <span className={`px-3.5 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap ${
                isTodayWeekOff ? 'leave-pill-indigo' : 'leave-pill-slate'
              }`}>
                {Math.max(0, 4 - monthlyWeekOffCount)} Left
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Official Holidays Dialog Modal */}
      <Dialog open={isHolidaysModalOpen} onOpenChange={setIsHolidaysModalOpen}>
        <DialogContent className="max-w-lg w-full p-6 rounded-2xl border border-border bg-card text-card-foreground shadow-2xl space-y-4">
          <DialogHeader className="p-0 space-y-1">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <span>🎉</span> Upcoming Holidays (2026 - 2027)
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Annual company holiday schedule and festival observances
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {/* Next Holiday Top Banner */}
            {nextHoliday && (
              <div className="p-4 rounded-xl holiday-banner-emerald flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold holiday-banner-title flex items-center gap-1">
                    <span>🌟 Next Upcoming Holiday</span>
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-0.5">{nextHoliday.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatHolidayDate(nextHoliday.date)} • {nextHoliday.day}
                  </p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-xs whitespace-nowrap">
                  {getDaysUntilText(nextHoliday.date)}
                </div>
              </div>
            )}

            {/* List of Holiday items */}
            <div className="max-h-[380px] overflow-y-auto space-y-3 pr-1 pt-1">
              {COMPANY_HOLIDAYS.map((holiday) => {
                const isNext = holiday.id === nextHoliday?.id;
                const isPast = holiday.date < todayDateStr;
                const daysText = getDaysUntilText(holiday.date);

                return (
                  <div
                    key={holiday.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                      isNext
                        ? 'bg-emerald-500/10 border-emerald-500/40 hover:bg-emerald-500/15'
                        : isPast
                        ? 'bg-muted/20 border-border/40 opacity-60 hover:opacity-80'
                        : 'bg-muted/40 border-border/70 hover:bg-muted/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{holiday.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{holiday.name}</p>
                          {isNext && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500 text-white leading-none">
                              Next
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatHolidayDate(holiday.date)} • {holiday.day} • {holiday.type}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-3.5 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap ${
                        isNext
                          ? 'leave-pill-emerald'
                          : isPast
                          ? 'leave-pill-slate'
                          : holiday.date.startsWith('2026')
                          ? 'leave-pill-blue'
                          : 'leave-pill-amber'
                      }`}
                    >
                      {daysText}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
