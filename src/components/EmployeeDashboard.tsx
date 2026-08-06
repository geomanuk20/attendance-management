import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
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

interface EmployeeDashboardProps {
  currency?: string;
}

export function EmployeeDashboard({ currency = 'USD' }: EmployeeDashboardProps) {
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

  const [allEmployees, setAllEmployees] = useState<any[]>([]);

  useEffect(() => {
    getEmployees().then(setAllEmployees).catch(() => {});
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchTodayAttendance(parsedUser.id || parsedUser._id);
    } else {
      setLoading(false);
    }
  }, []);

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

  const executeVerifiedClockAction = async () => {
    const userId = user?.id || user?._id;
    if (!userId) return;

    try {
      setLoading(true);
      if (pendingClockAction === 'Clock In') {
        const res = await clockIn(userId);
        toast.success(`Face Verified! Clocked in successfully at ${res.clockIn || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      } else {
        const res = await clockOut(userId);
        const totalHours = res.workHours || 0;
        const h = Math.floor(totalHours);
        const m = Math.round((totalHours - h) * 60);
        const duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
        toast.success(`Face Verified! Clocked out successfully at ${res.clockOut || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Today's working hours: ${duration}`);
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>My Dashboard</h2>
          <p className="text-muted-foreground">Welcome back, {user?.name?.split(' ')[0] || 'Employee'}! Here's your overview.</p>
        </div>
        <div className="flex items-center gap-4">
          {status === 'Checked Out' && (
            <Button onClick={handleClockIn} disabled={loading} className="gap-2 bg-green-600 hover:bg-green-700 text-black dark:text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Clock In
            </Button>
          )}
          {status === 'Checked In' && (
            <Button onClick={handleClockOut} disabled={loading} className="gap-2 bg-red-600 hover:bg-red-700 text-black dark:text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Clock Out
            </Button>
          )}

          <Badge variant="secondary" className={`flex items-center gap-2 px-3 py-1 ${status === 'Checked In' ? 'bg-green-100 text-green-700' :
            status === 'Checked Out' ? 'bg-slate-100 text-slate-700' :
              'bg-blue-100 text-blue-700'
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Hours Worked (This Week)</p>
              <p className="text-2xl font-semibold">41.5</p>
              <Progress value={92} className="h-2 mt-2 w-full" />
              <p className="text-xs text-muted-foreground mt-1">Goal: 45 hours</p>
            </div>
            <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3BAFDA20' }}>
              <Clock className="h-6 w-6" style={{ color: '#3BAFDA' }} />
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
              <p className="text-2xl font-semibold">Labor Day</p>
              <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1 font-medium">
                <span>May 1st, 2027 • Click to view all</span>
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
            <BarChart data={myAttendanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Bar dataKey="hours" fill="#0D2B52" name="Hours" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {myRecentActivities.map((activity) => (
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
              Annual Leave Quota Allocation & Available Balances
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {/* Casual Leave */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/70 hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏖️</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Casual Leave</p>
                  <p className="text-xs text-muted-foreground">Annual quota: 6 Days</p>
                </div>
              </div>
              <span className="px-3.5 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs border border-indigo-500/20 whitespace-nowrap">
                6 Days Left
              </span>
            </div>

            {/* Medical Leave */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/70 hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏥</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Medical Leave</p>
                  <p className="text-xs text-muted-foreground">Annual quota: 6 Days</p>
                </div>
              </div>
              <span className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/20 whitespace-nowrap">
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
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/70">
              <div className="flex items-center gap-3">
                <span className="text-xl">🇮🇳</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Independence Day</p>
                  <p className="text-xs text-muted-foreground">August 15th, 2026 • Saturday</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10">National Holiday</Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/70">
              <div className="flex items-center gap-3">
                <span className="text-xl">🕊️</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Gandhi Jayanti</p>
                  <p className="text-xs text-muted-foreground">October 2nd, 2026 • Friday</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10">National Holiday</Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/70">
              <div className="flex items-center gap-3">
                <span className="text-xl">🪔</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Diwali</p>
                  <p className="text-xs text-muted-foreground">November 8th, 2026 • Sunday</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10">Festival Holiday</Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/70">
              <div className="flex items-center gap-3">
                <span className="text-xl">🎄</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Christmas</p>
                  <p className="text-xs text-muted-foreground">December 25th, 2026 • Friday</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10">Festival Holiday</Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/70">
              <div className="flex items-center gap-3">
                <span className="text-xl">🎆</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">New Year’s Day</p>
                  <p className="text-xs text-muted-foreground">January 1st, 2027 • Friday</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs text-cyan-600 dark:text-cyan-400 border-cyan-500/30 bg-cyan-500/10">Public Holiday</Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/70">
              <div className="flex items-center gap-3">
                <span className="text-xl">🇮🇳</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Republic Day</p>
                  <p className="text-xs text-muted-foreground">January 26th, 2027 • Tuesday</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10">National Holiday</Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/70">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔨</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Labor Day</p>
                  <p className="text-xs text-muted-foreground">May 1st, 2027 • Saturday</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs text-cyan-600 dark:text-cyan-400 border-cyan-500/30 bg-cyan-500/10">Public Holiday</Badge>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
