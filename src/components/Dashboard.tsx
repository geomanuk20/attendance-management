import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Clock, Users, DollarSign, Calendar, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { getEmployees, getAttendance, getLeaveRequests } from '../services/api';
import { toast } from 'sonner';
import { format, subDays, startOfDay } from 'date-fns';
import { ModernSpinner } from './ui/ModernSpinner';

interface DashboardProps {
  currency?: string;
}

export function Dashboard({ currency = 'USD' }: DashboardProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    monthlyPayroll: 0,
    pendingRequests: 0,
  });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [leaveDistribution, setLeaveDistribution] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [employees, attendance, leaveRequests] = await Promise.all([
          getEmployees(),
          getAttendance(),
          getLeaveRequests(),
        ]);

        const totalEmployees = employees.length;
        const monthlyPayroll = employees.reduce((sum: number, emp: any) => sum + (Number(emp.salary) || 0), 0);

        // --- Present Today ---
        const today = new Date().toISOString().split('T')[0];
        const presentToday = attendance.filter((a: any) => {
          const d = a.date ? String(a.date).split('T')[0] : '';
          return d === today;
        }).length;

        // --- Pending Leave Requests ---
        const pendingRequests = leaveRequests.filter((r: any) => r.status === 'Pending').length;

        setStats({ totalEmployees, presentToday, monthlyPayroll, pendingRequests });

        // --- Weekly Attendance Chart (last 7 days) ---
        const weekly = Array.from({ length: 7 }, (_, i) => {
          const day = subDays(startOfDay(new Date()), 6 - i);
          const dayLabel = format(day, 'EEE'); // Mon, Tue, ...

          let presentCount = 0;
          // Count unique employees present on this day
          const presentEmployees = new Set();

          attendance.forEach((a: any) => {
            if (a.date && (a.status === 'Present' || a.status === 'Attendance' || a.status === 'Half-Day' || a.status === 'Half Day')) {
              const recordDate = new Date(a.date);
              recordDate.setHours(0, 0, 0, 0);
              const compareDay = new Date(day);
              compareDay.setHours(0, 0, 0, 0);

              if (recordDate.getTime() === compareDay.getTime()) {
                const empId = a.employeeId?._id || a.employeeId;
                if (empId) presentEmployees.add(empId.toString());
              }
            }
          });

          presentCount = presentEmployees.size;
          const absent = Math.max(0, totalEmployees - presentCount);
          return { name: dayLabel, Present: presentCount, Absent: absent };
        });
        setWeeklyData(weekly);

        // --- Leave Distribution (from all leave requests) ---
        const leaveTypes: Record<string, number> = {};
        leaveRequests.forEach((r: any) => {
          const type = r.leaveType || 'Other';
          leaveTypes[type] = (leaveTypes[type] || 0) + 1;
        });
        const leaveColors: Record<string, string> = {
          Vacation: '#3BAFDA',
          'Sick Leave': '#F9A825',
          Personal: '#8B5CF6',
          Maternity: '#EC4899',
          Other: '#6B7280',
        };
        const distData = Object.entries(leaveTypes).map(([name, value]) => ({
          name,
          value,
          color: leaveColors[name] || '#6B7280',
        }));
        setLeaveDistribution(distData);

        // --- Recent Activities (from attendance clock-ins/outs + leave requests) ---
        const activityList: any[] = [];

        // Attendance events (most recent 10)
        attendance
          .filter((a: any) => a.clockIn)
          .sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
          .slice(0, 8)
          .forEach((a: any) => {
            const name = a.employeeId?.name || 'Unknown';
            const dateStr = a.date ? String(a.date).split('T')[0] : 'Unknown date';
            if (a.clockIn) {
              activityList.push({
                id: `ci-${a._id}`,
                type: 'attendance',
                user: name,
                action: `Clocked in at ${a.clockIn}`,
                time: dateStr,
              });
            }
            if (a.clockOut) {
              activityList.push({
                id: `co-${a._id}`,
                type: 'attendance',
                user: name,
                action: `Clocked out at ${a.clockOut}`,
                time: dateStr,
              });
            }
          });

        // Leave request events (most recent 5)
        leaveRequests
          .sort((a: any, b: any) => new Date(b.createdAt || b.startDate).getTime() - new Date(a.createdAt || a.startDate).getTime())
          .slice(0, 5)
          .forEach((l: any) => {
            const name = l.employeeId?.name || 'Unknown';
            activityList.push({
              id: `lr-${l._id}`,
              type: 'leave',
              user: name,
              action: `${l.leaveType} request — ${l.status}`,
              time: l.startDate ? String(l.startDate).split('T')[0] : 'Unknown date',
            });
          });

        // Sort combined list by recency
        activityList.sort((a, b) => b.time.localeCompare(a.time));
        setRecentActivities(activityList.slice(0, 8));

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatCurrency = (amount: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
    } catch {
      return `${currency} ${amount.toLocaleString()}`;
    }
  };

  if (loading) {
    return <ModernSpinner label="Loading Executive Dashboard..." size="lg" />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>Dashboard Overview</h2>
          <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
          System Online
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Employees</p>
              <p className="text-2xl font-semibold">{stats.totalEmployees}</p>
              <p className="text-xs flex items-center gap-1 mt-1" style={{ color: '#10B981' }}>
                <TrendingUp className="h-3 w-3" /> Real-time data
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3BAFDA20' }}>
              <Users className="h-6 w-6" style={{ color: '#3BAFDA' }} />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Present Today</p>
              <p className="text-2xl font-semibold">{stats.presentToday}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalEmployees > 0 ? Math.round((stats.presentToday / stats.totalEmployees) * 100) : 0}% attendance rate
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#10B98120' }}>
              <Clock className="h-6 w-6" style={{ color: '#10B981' }} />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Monthly Payroll</p>
              <p className="text-2xl font-semibold">{formatCurrency(stats.monthlyPayroll)}</p>
              <p className="text-xs text-muted-foreground mt-1">Estimated</p>
            </div>
            <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F9A82520' }}>
              <DollarSign className="h-6 w-6" style={{ color: '#F9A825' }} />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Requests</p>
              <p className="text-2xl font-semibold">{stats.pendingRequests}</p>
              <p className="text-xs flex items-center gap-1 mt-1" style={{ color: '#F9A825' }}>
                <AlertCircle className="h-3 w-3" /> Needs approval
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F9A82520' }}>
              <Calendar className="h-6 w-6" style={{ color: '#F9A825' }} />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Attendance Bar Chart */}
        <Card className="p-6">
          <h3 className="mb-4">Weekly Attendance</h3>
          {weeklyData.some(d => d.Present > 0 || d.Absent > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Present" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Absent" fill="#F9A825" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
              No attendance data for this week yet
            </div>
          )}
        </Card>

        {/* Leave Distribution Pie Chart */}
        <Card className="p-6">
          <h3 className="mb-4">Leave Distribution</h3>
          {leaveDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={leaveDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {leaveDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => [`${value} requests`, '']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
              No leave requests found
            </div>
          )}
        </Card>
      </div>

      {/* Leave Balance Breakdown & Official Holidays */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leave Balance Breakdown (2026) */}
        <Card className="p-6 space-y-4 border border-border bg-card text-card-foreground shadow-sm">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
              <span>📊</span> Leave Balance Breakdown (2026)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Annual Leave Quota Allocation</p>
          </div>

          <div className="space-y-3">
            {/* Casual Leave */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/70 hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xl">🏖️</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Casual Leave</p>
                  <p className="text-xs text-muted-foreground">Annual quota: 6 Days</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs border border-indigo-500/20 whitespace-nowrap">
                6 Days Left
              </span>
            </div>

            {/* Medical Leave */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/70 hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xl">🏥</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Medical Leave</p>
                  <p className="text-xs text-muted-foreground">Annual quota: 6 Days</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/20 whitespace-nowrap">
                6 Days Left
              </span>
            </div>

            {/* Annual Leave */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/70 hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xl">📅</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Annual Leave</p>
                  <p className="text-xs text-muted-foreground">Annual quota: 6 Days</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs border border-amber-500/20 whitespace-nowrap">
                2 Days Left
              </span>
            </div>

            {/* Week Off Policy */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/70 hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚪</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Week Off Policy</p>
                  <p className="text-xs text-muted-foreground">User Chooses Up to 4 Dates / Month</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-slate-500/10 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-500/20 whitespace-nowrap">
                4 / Month
              </span>
            </div>
          </div>
        </Card>

        {/* Official Holidays (2026-2027) */}
        <Card className="p-6 space-y-4 border border-border bg-card text-card-foreground shadow-sm">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
              <span>🎉</span> Official Holidays (2026-2027)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Company Annual Holiday Schedule</p>
          </div>

          <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="flex items-center gap-3">
                <span className="text-lg">🇮🇳</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Independence Day</p>
                  <p className="text-xs text-muted-foreground">August 15th, 2026 • Saturday</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10">National Holiday</Badge>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="flex items-center gap-3">
                <span className="text-lg">🕊️</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Gandhi Jayanti</p>
                  <p className="text-xs text-muted-foreground">October 2nd, 2026 • Friday</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10">National Holiday</Badge>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="flex items-center gap-3">
                <span className="text-lg">🪔</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Diwali</p>
                  <p className="text-xs text-muted-foreground">November 8th, 2026 • Sunday</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10">Festival Holiday</Badge>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="flex items-center gap-3">
                <span className="text-lg">🎄</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Christmas</p>
                  <p className="text-xs text-muted-foreground">December 25th, 2026 • Friday</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10">Festival Holiday</Badge>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="flex items-center gap-3">
                <span className="text-lg">🎆</span>
                <div>
                  <p className="text-sm font-medium text-foreground">New Year’s Day</p>
                  <p className="text-xs text-muted-foreground">January 1st, 2027 • Friday</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs text-cyan-600 dark:text-cyan-400 border-cyan-500/30 bg-cyan-500/10">Public Holiday</Badge>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="flex items-center gap-3">
                <span className="text-lg">🇮🇳</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Republic Day</p>
                  <p className="text-xs text-muted-foreground">January 26th, 2027 • Tuesday</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10">National Holiday</Badge>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="text-lg">🔨</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Labor Day</p>
                  <p className="text-xs text-muted-foreground">May 1st, 2027 • Saturday</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs text-cyan-600 dark:text-cyan-400 border-cyan-500/30 bg-cyan-500/10">Public Holiday</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activities */}
      <Card className="p-6">
        <h3 className="mb-4">Recent Activities</h3>
        <div className="space-y-3">
          {recentActivities.length > 0 ? (
            recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                    style={{ backgroundColor: activity.type === 'attendance' ? '#3BAFDA' : '#F9A825' }}
                  >
                    {activity.user.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{activity.user}</p>
                    <p className="text-xs text-muted-foreground">{activity.action}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">{activity.time}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No recent activities found.</p>
          )}
        </div>
      </Card>
    </div>
  );
}