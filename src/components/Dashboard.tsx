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
          'Week Off': '#0284C7',
          'Sick Leave': '#10B981',
          'Annual Leave': '#F59E0B',
          'Emergency Leave': '#E11D48',
          'Vacation': '#3BAFDA',
          'Personal': '#8B5CF6',
          'Maternity': '#EC4899',
          'Other': '#64748B',
        };
        const totalLeaves = Object.values(leaveTypes).reduce((a, b) => a + b, 0) || 1;
        const distData = Object.entries(leaveTypes).map(([name, value]) => ({
          name,
          value,
          percentage: Math.round((value / totalLeaves) * 100),
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
    <div className="p-6 sm:p-8 lg:p-10 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Dashboard Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">Welcome back! Real-time workforce management & attendance insights.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="flex items-center gap-2 px-3 py-1.5 font-medium border border-border shadow-xs">
            <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
            <span>System Online</span>
          </Badge>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2 mb-2">
        <Card className="p-6 border border-border/80 border-t-4 border-t-sky-500 shadow-xs hover:shadow-lg transition-all duration-300 rounded-2xl bg-card">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Employees</p>
              <p className="text-3xl font-extrabold text-foreground leading-none">{stats.totalEmployees}</p>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                <TrendingUp className="h-3 w-3" />
                <span>Real-time database</span>
              </div>
            </div>
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs" style={{ backgroundColor: '#0284C718', color: '#0284C7' }}>
              <Users className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="p-6 border border-border/80 border-t-4 border-t-emerald-500 shadow-xs hover:shadow-lg transition-all duration-300 rounded-2xl bg-card">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Present Today</p>
              <p className="text-3xl font-extrabold text-foreground leading-none">{stats.presentToday}</p>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                <Clock className="h-3 w-3" />
                <span>{stats.totalEmployees > 0 ? Math.round((stats.presentToday / stats.totalEmployees) * 100) : 0}% Attendance</span>
              </div>
            </div>
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs" style={{ backgroundColor: '#10B98118', color: '#10B981' }}>
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="p-6 border border-border/80 border-t-4 border-t-purple-500 shadow-xs hover:shadow-lg transition-all duration-300 rounded-2xl bg-card">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly Payroll</p>
              <p className="text-3xl font-extrabold text-foreground leading-none">{formatCurrency(stats.monthlyPayroll)}</p>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                <DollarSign className="h-3 w-3" />
                <span>Active compensation</span>
              </div>
            </div>
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs" style={{ backgroundColor: '#8B5CF618', color: '#8B5CF6' }}>
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="p-6 border border-border/80 border-t-4 border-t-amber-500 shadow-xs hover:shadow-lg transition-all duration-300 rounded-2xl bg-card">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Requests</p>
              <p className="text-3xl font-extrabold text-foreground leading-none">{stats.pendingRequests}</p>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                <AlertCircle className="h-3 w-3" />
                <span>Needs HR review</span>
              </div>
            </div>
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs" style={{ backgroundColor: '#F59E0B18', color: '#F59E0B' }}>
              <Calendar className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        {/* Weekly Attendance Bar Chart */}
        <Card className="p-6 sm:p-7 border border-border/80 shadow-xs rounded-2xl bg-card">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-border/40">
            <div>
              <h3 className="text-base font-bold text-foreground">Weekly Attendance Trend</h3>
              <p className="text-xs text-muted-foreground">Daily headcount breakdown for the current week</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
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
              <BarChart data={weeklyData} margin={{ top: 10, right: 15, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                <XAxis dataKey="name" fontSize={12} stroke="#64748b" />
                <YAxis fontSize={12} stroke="#64748b" allowDecimals={false} />
                <Tooltip
                  formatter={(value: any, name: any) => [`${value} employees`, name]}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '10px', border: '1px solid #334155', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.4)' }}
                  labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                  itemStyle={{ color: '#f8fafc', fontWeight: '500' }}
                />
                <Bar dataKey="Present" fill="#10B981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Absent" fill="#F9A825" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
              No attendance data recorded for this week yet
            </div>
          )}
        </Card>

        {/* Leave Distribution Pie Chart */}
        <Card className="p-6 sm:p-7 border border-border/80 shadow-xs rounded-2xl bg-card overflow-hidden">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-border/40">
            <div>
              <h3 className="text-base font-bold text-foreground">Leave Distribution</h3>
              <p className="text-xs text-muted-foreground">Categorical distribution of all requested time off</p>
            </div>
            <Badge variant="outline" className="text-xs font-bold">
              {leaveDistribution.reduce((sum, item) => sum + (item.value || 0), 0)} Total Requests
            </Badge>
          </div>
          {leaveDistribution.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-6">
              <div className="flex items-center justify-center min-h-[220px]">
                <PieChart width={220} height={220}>
                  <Pie
                    data={leaveDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={88}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {leaveDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [`${value} requests`, name]}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '10px', border: '1px solid #334155', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.4)' }}
                    labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                    itemStyle={{ color: '#f8fafc', fontWeight: '500' }}
                  />
                </PieChart>
              </div>
              <div className="flex flex-col gap-2.5 bg-muted/40 p-4 rounded-xl border border-border/40 w-full">
                {leaveDistribution.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-muted-foreground font-semibold truncate max-w-[120px]">{item.name}</span>
                      </div>
                      <span className="font-bold text-foreground">{item.value}</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${item.percentage || 10}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
              No leave requests found in database
            </div>
          )}
        </Card>
      </div>

      {/* Recent Activities */}
      <div className="pt-4 sm:pt-6">
        <Card className="p-6 sm:p-7 border border-border/80 shadow-xs rounded-2xl bg-card">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-border/40">
            <div>
              <h3 className="text-base font-bold text-foreground">Recent Activities</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Real-time biometric attendance and leave workflow updates</p>
            </div>
            <Badge variant="outline" className="text-xs font-semibold px-3 py-1 bg-muted/30">
              {recentActivities.length} Recent Logs
            </Badge>
          </div>
          <div className="space-y-2">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl hover:bg-muted/50 transition-all border border-border/20 hover:border-border/60"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs"
                      style={{
                        backgroundColor: activity.type === 'attendance' ? '#0D2B52' : '#F9A825',
                      }}
                    >
                      {activity.user.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{activity.user}</p>
                      <p className="text-xs text-muted-foreground truncate">{activity.action}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap ml-4 shrink-0 bg-muted/60 px-3 py-1.5 rounded-lg border border-border/40">
                    {activity.time}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No recent activities found.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}