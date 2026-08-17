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
          getEmployees().catch(() => []),
          getAttendance().catch(() => []),
          getLeaveRequests().catch(() => []),
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
          const presentEmployees = new Set();

          attendance.forEach((a: any) => {
            if (a.date && (a.status === 'Present' || a.status === 'Attendance' || a.status === 'Half-Day' || a.status === 'Half Day' || a.status === 'On Time' || a.status === 'Late')) {
              const recordDate = new Date(a.date);
              recordDate.setHours(0, 0, 0, 0);
              const compareDay = new Date(day);
              compareDay.setHours(0, 0, 0, 0);

              if (recordDate.getTime() === compareDay.getTime()) {
                const empId = a.employeeId?._id || a.employeeId?.id || a.employeeId;
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
          const type = r.leaveType || 'Casual Leave';
          leaveTypes[type] = (leaveTypes[type] || 0) + 1;
        });
        const leaveColors: Record<string, string> = {
          'Casual Leave': '#0D2B52',
          'Sick Leave': '#3BAFDA',
          'Annual Leave': '#F9A825',
          'Emergency Leave': '#E11D48',
          'Vacation': '#3BAFDA',
          'Personal': '#8B5CF6',
          'Maternity': '#EC4899',
          'Other': '#64748B',
        };
        const distData = Object.entries(leaveTypes).map(([name, value]) => ({
          name,
          value,
          color: leaveColors[name] || '#64748B',
        }));
        setLeaveDistribution(distData);

        // --- Recent Activities ---
        const activityList: any[] = [];

        // Attendance events
        attendance
          .filter((a: any) => a.clockIn)
          .sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
          .slice(0, 8)
          .forEach((a: any) => {
            const name = a.employeeId?.name || 'Employee';
            const dateStr = a.date ? String(a.date).split('T')[0] : 'Today';
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

        // Leave request events
        leaveRequests
          .sort((a: any, b: any) => new Date(b.createdAt || b.startDate).getTime() - new Date(a.createdAt || a.startDate).getTime())
          .slice(0, 5)
          .forEach((l: any) => {
            const name = l.employeeId?.name || 'Employee';
            activityList.push({
              id: `lr-${l._id}`,
              type: 'leave',
              user: name,
              action: `Requested ${l.leaveType || 'Leave'} (${l.days || 1} day${(l.days || 1) > 1 ? 's' : ''})`,
              time: l.startDate ? String(l.startDate).split('T')[0] : 'Pending',
            });
          });

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
    const locales: { [key: string]: string } = {
      'USD': 'en-US',
      'INR': 'en-IN',
      'EUR': 'de-DE',
      'GBP': 'en-GB',
      'AED': 'en-AE',
      'SAR': 'en-SA',
      'EGP': 'en-EG',
      'CAD': 'en-CA',
      'AUD': 'en-AU',
      'SGD': 'en-SG',
      'JPY': 'ja-JP'
    };
    try {
      return new Intl.NumberFormat(locales[currency] || 'en-US', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 0
      }).format(amount || 0);
    } catch {
      return `${currency} ${(amount || 0).toLocaleString()}`;
    }
  };

  if (loading) {
    return <ModernSpinner label="Loading Executive Dashboard..." size="lg" />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Dashboard Overview</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Welcome back! Real-time workforce management & attendance insights.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="flex items-center gap-2 px-3 py-1.5 font-medium border border-border shadow-xs">
            <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
            <span>System Online</span>
          </Badge>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <Card className="p-5 border border-border shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Employees</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 leading-tight">{stats.totalEmployees}</p>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1.5">
                <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                <span>Real-time database</span>
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">
              <Users className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="p-5 border border-border shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Present Today</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 leading-tight">{stats.presentToday}</p>
              <p className="text-xs font-medium text-muted-foreground mt-1.5">
                {stats.totalEmployees > 0 ? Math.round((stats.presentToday / stats.totalEmployees) * 100) : 0}% attendance rate
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="p-5 border border-border shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly Payroll</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 leading-tight">{formatCurrency(stats.monthlyPayroll)}</p>
              <p className="text-xs font-medium text-muted-foreground mt-1.5">
                Active compensation sum
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="p-5 border border-border shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Requests</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 leading-tight">{stats.pendingRequests}</p>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Needs HR review</span>
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 text-purple-600 dark:text-purple-400">
              <Calendar className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Attendance Bar Chart */}
        <Card className="p-5 sm:p-6 border border-border shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-foreground">Weekly Attendance Trend</h3>
            <div className="flex items-center gap-3 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                <span className="text-muted-foreground">Present</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-[#F9A825]" />
                <span className="text-muted-foreground">Absent</span>
              </div>
            </div>
          </div>
          {weeklyData.some(d => d.Present > 0 || d.Absent > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                <XAxis dataKey="name" fontSize={12} stroke="#64748b" />
                <YAxis fontSize={12} stroke="#64748b" allowDecimals={false} />
                <Tooltip
                  formatter={(value: any, name: any) => [`${value} employees`, name]}
                  contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '12px' }}
                />
                <Bar dataKey="Present" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Absent" fill="#F9A825" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
              No attendance data recorded for this week yet
            </div>
          )}
        </Card>

        {/* Leave Distribution Pie Chart */}
        <Card className="p-5 sm:p-6 border border-border shadow-xs">
          <h3 className="text-base font-bold text-foreground mb-4">Leave Distribution</h3>
          {leaveDistribution.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={leaveDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {leaveDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [`${value} requests`, name]}
                    contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 shrink-0 sm:min-w-[150px]">
                {leaveDistribution.map((item, index) => (
                  <div key={index} className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-md shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-muted-foreground font-medium truncate">{item.name}</span>
                    </div>
                    <span className="font-bold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
              No leave requests found in database
            </div>
          )}
        </Card>
      </div>

      {/* Recent Activities */}
      <Card className="p-5 sm:p-6 border border-border shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Recent Activities</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Real-time biometric attendance and leave workflow updates</p>
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            {recentActivities.length} Recent Logs
          </Badge>
        </div>
        <div className="space-y-1.5">
          {recentActivities.length > 0 ? (
            recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/40 transition-colors border-b border-border/40 last:border-0"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs"
                    style={{
                      width: '36px',
                      height: '36px',
                      minWidth: '36px',
                      minHeight: '36px',
                      borderRadius: '9999px',
                      aspectRatio: '1/1',
                      backgroundColor: activity.type === 'attendance' ? '#0D2B52' : '#F9A825',
                    }}
                  >
                    {activity.user.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{activity.user}</p>
                    <p className="text-xs text-muted-foreground truncate">{activity.action}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap ml-4 shrink-0 bg-muted/60 px-2.5 py-1 rounded-lg">
                  {activity.time}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No recent activities found.</p>
          )}
        </div>
      </Card>
    </div>
  );
}