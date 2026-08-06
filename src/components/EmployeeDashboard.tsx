import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Clock, Calendar, AlertCircle, LogIn, LogOut, Loader2, ShieldCheck } from 'lucide-react';
import { getAttendance, clockIn, clockOut, getEmployees } from '../services/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FaceRecognitionModal } from './FaceRecognitionModal';

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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Face Recognition Modal State
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [pendingClockAction, setPendingClockAction] = useState<'Clock In' | 'Clock Out'>('Clock In');

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
      // Localhost / development override for testing
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        resolve(true);
        return;
      }

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
            toast.error(`Outside 100m office zone (${distDisplay} away). Clock In/Out is restricted to office location.`);
            resolve(false);
          } else {
            resolve(true);
          }
        },
        (err) => {
          console.warn('Geolocation error:', err);
          toast.error('Location permission required to verify 100m office zone.');
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  const handleClockIn = () => {
    setPendingClockAction('Clock In');
    setIsFaceModalOpen(true);
  };

  const handleClockOut = () => {
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">My Dashboard</h2>
          <p className="text-muted-foreground">Welcome back, {user?.name?.split(' ')[0] || 'Employee'}! Here's your overview.</p>
        </div>
      </div>

      {/* Main Face Scan Clock Card */}
      <Card className="p-8 flex flex-col items-center justify-center space-y-6 bg-card text-card-foreground border border-border shadow-lg">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{format(currentTime, 'EEEE, MMMM do, yyyy')}</h3>
          <p className="text-slate-600 dark:text-slate-400 text-xl font-semibold font-mono tracking-wider">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
        </div>

        {status === 'Checked Out' && (
          <Button
            size="lg"
            className="h-32 w-32 rounded-full text-base font-bold shadow-xl transition-all duration-200 active:scale-95 bg-emerald-600 hover:bg-emerald-700 text-white flex flex-col items-center justify-center gap-1 p-2 text-center cursor-pointer"
            onClick={handleClockIn}
          >
            <ShieldCheck className="h-6 w-6 text-white" />
            <span>Face Scan</span>
            <span className="text-xs font-semibold opacity-90">Clock In</span>
          </Button>
        )}

        {status === 'Checked In' && (
          <Button
            size="lg"
            className="h-32 w-32 rounded-full text-base font-bold shadow-xl transition-all duration-200 active:scale-95 bg-rose-600 hover:bg-rose-700 text-white flex flex-col items-center justify-center gap-1 p-2 text-center cursor-pointer"
            onClick={handleClockOut}
          >
            <ShieldCheck className="h-6 w-6 text-white" />
            <span>Face Scan</span>
            <span className="text-xs font-semibold opacity-90">Clock Out</span>
          </Button>
        )}

        {status === 'Completed' && (
          <Button
            size="lg"
            disabled
            className="h-32 w-32 rounded-full text-lg font-bold shadow-lg transition-all duration-300 bg-slate-400 text-white"
          >
            Done
          </Button>
        )}

        <div className="grid grid-cols-3 gap-6 sm:gap-12 text-center w-full max-w-md pt-4 border-t border-border/60">
          <div className="flex flex-col items-center space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Check In</span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{todayRecord?.clockIn || '--:--'}</span>
          </div>
          <div className="flex flex-col items-center space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Check Out</span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{todayRecord?.clockOut || '--:--'}</span>
          </div>
          <div className="flex flex-col items-center space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</span>
            <Badge variant={status === 'Checked In' ? 'default' : status === 'Completed' ? 'secondary' : 'outline'} className="whitespace-nowrap font-bold px-3 py-1 text-slate-900 dark:text-slate-100">
              {status}
            </Badge>
          </div>
        </div>
      </Card>

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

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Leave Balance</p>
              <p className="text-2xl font-semibold">12 Days</p>
              <p className="text-xs text-muted-foreground mt-1">Available for 2024</p>
            </div>
            <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F9A82520' }}>
              <Calendar className="h-6 w-6" style={{ color: '#F9A825' }} />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Next Holiday</p>
              <p className="text-2xl font-semibold">Labor Day</p>
              <p className="text-xs text-muted-foreground mt-1">May 1st, 2024</p>
            </div>
            <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#10B98120' }}>
              <AlertCircle className="h-6 w-6" style={{ color: '#10B981' }} />
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
    </div>
  );
}
