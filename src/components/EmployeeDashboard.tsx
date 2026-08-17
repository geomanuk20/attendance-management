import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { Clock, Calendar, AlertCircle, LogIn, LogOut, Loader2 } from 'lucide-react';
import { getAttendance, clockIn, clockOut, getEmployees } from '../services/api';
import { toast } from 'sonner';
import { FaceRecognitionModal } from './FaceRecognitionModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

const myAttendanceData = [
  { name: 'Mon', hours: 8.5 },
  { name: 'Tue', hours: 8.0 },
  { name: 'Wed', hours: 9.0 },
  { name: 'Thu', hours: 8.5 },
  { name: 'Fri', hours: 7.5 },
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

  const [allEmployees, setAllEmployees] = useState<any[]>([]);

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
      fetchTodayAttendance(parsedUser.id || parsedUser._id);
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
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        const dayMap: { [key: string]: number } = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 };

        data.forEach((rec: any) => {
          const d = new Date(rec.date);
          if (d >= monday) {
            const h = rec.workHours || 0;
            sumHours += h;
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            if (dayMap[dayName] !== undefined) {
              dayMap[dayName] += Number(h.toFixed(1));
            }
          }
        });

        if (sumHours > 0) {
          setWeeklyHours(Number(sumHours.toFixed(1)));
          setWeeklyAttendanceChart(days.map((day) => ({ name: day, hours: dayMap[day] || 0 })));
        }

        // Recent activity feed
        const sorted = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
        const acts = sorted.map((rec, idx) => ({
          id: rec._id || idx,
          action: rec.clockOut ? `Clocked out (${rec.workHours ? rec.workHours.toFixed(1) + 'h' : 'Done'})` : 'Clocked in',
          time: rec.clockOut || rec.clockIn || '9:00 AM',
          date: String(rec.date).split('T')[0] === today ? 'Today' : String(rec.date).split('T')[0],
        }));
        setUserActivities(acts);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

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
    setPendingClockAction('Clock In');
    setIsFaceModalOpen(true);
  };

  const handleClockOut = async () => {
    setPendingClockAction('Clock Out');
    setIsFaceModalOpen(true);
  };

  const executeVerifiedClockAction = async (matchedUser?: any) => {
    const userId = matchedUser?._id || matchedUser?.id || user?.id || user?._id;
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
              style={{ backgroundColor: '#16a34a', color: '#ffffff' }}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              <span className="font-bold text-white">Clock In</span>
            </Button>
          )}
          {status === 'Checked In' && (
            <Button
              onClick={handleClockOut}
              disabled={loading}
              style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
              className="gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              <span className="font-bold text-white">Clock Out</span>
            </Button>
          )}

          <Badge variant="secondary" className={`flex items-center gap-2 px-3 py-1.5 font-medium ${status === 'Checked In' ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400' :
            status === 'Checked Out' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
              'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
            }`}>
            <div className={`h-2 w-2 rounded-full ${status === 'Checked In' ? 'bg-green-500 animate-pulse' :
              status === 'Checked Out' ? 'bg-slate-400' :
                'bg-blue-500'
              }`}></div>
            {status === 'Checked In' ? 'Working Now' : status === 'Checked Out' ? 'Not Checked In' : 'Completed Today'}
          </Badge>
        </div>
      </div>

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
              <p className="text-2xl font-semibold">14 Days</p>
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
              <Tooltip />
              <Bar dataKey="hours" fill="#3BAFDA" />
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
        enrolledEmployees={allEmployees}
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
            {/* Casual Leave */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/70 hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏖️</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Casual Leave (CL)</p>
                  <p className="text-xs text-muted-foreground">Annual quota: 6 Days</p>
                </div>
              </div>
              <span className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/20 whitespace-nowrap">
                6 Days Left
              </span>
            </div>

            {/* Sick Leave */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/70 hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💊</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Sick Leave (SL)</p>
                  <p className="text-xs text-muted-foreground">Annual quota: 6 Days</p>
                </div>
              </div>
              <span className="px-3.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs border border-blue-500/20 whitespace-nowrap">
                6 Days Left
              </span>
            </div>

            {/* Annual Leave */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/70 hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Annual Leave</p>
                  <p className="text-xs text-muted-foreground">Annual quota: 6 Days</p>
                </div>
              </div>
              <span className="px-3.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs border border-amber-500/20 whitespace-nowrap">
                2 Days Left
              </span>
            </div>

            {/* Week Off Policy */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/70 hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚪</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Week Off Policy</p>
                  <p className="text-xs text-muted-foreground">User Chooses Up to 4 Dates / Month</p>
                </div>
              </div>
              <span className="px-3.5 py-1.5 rounded-lg bg-slate-500/10 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-500/20 whitespace-nowrap">
                4 / Month
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
              <span>🎉</span> Official Holidays (2026-2027)
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Company Annual Holiday Schedule & Observances
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 pt-2">
            {COMPANY_HOLIDAYS.map((holiday) => {
              const isNext = holiday.id === nextHoliday?.id;
              const isPast = holiday.date < todayDateStr;

              return (
                <div
                  key={holiday.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isNext
                      ? 'bg-emerald-500/10 border-emerald-500/40 shadow-xs'
                      : isPast
                      ? 'bg-muted/20 border-border/40 opacity-60'
                      : 'bg-muted/40 border-border/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{holiday.icon}</span>
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
                        {formatHolidayDate(holiday.date)} • {holiday.day}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      holiday.type === 'National Holiday'
                        ? 'text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10'
                        : holiday.type === 'Festival Holiday'
                        ? 'text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10'
                        : 'text-cyan-600 dark:text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
                    }`}
                  >
                    {holiday.type}
                  </Badge>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
