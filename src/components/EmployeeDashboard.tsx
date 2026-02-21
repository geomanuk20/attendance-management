import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Clock, Calendar, AlertCircle, LogIn, LogOut, Loader2 } from 'lucide-react';
import { getAttendance, clockIn, clockOut } from '../services/api';
import { toast } from 'sonner';

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

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchTodayAttendance(parsedUser.id);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchTodayAttendance = async (employeeId: string) => {
    if (!employeeId) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await getAttendance(employeeId);
      // Filter for today's record
      const todayRec = data.find((record: any) => record.date.split('T')[0] === today);

      setTodayRecord(todayRec);

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

  const handleClockIn = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      await clockIn(user.id);
      toast.success('Clocked in successfully');
      fetchTodayAttendance(user.id);
    } catch (error: any) {
      console.error('Clock in error:', error);
      toast.error(error.message || 'Failed to clock in');
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      await clockOut(user.id);
      toast.success('Clocked out successfully');
      fetchTodayAttendance(user.id);
    } catch (error: any) {
      console.error('Clock out error:', error);
      toast.error(error.message || 'Failed to clock out');
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
    </div>
  );
}
