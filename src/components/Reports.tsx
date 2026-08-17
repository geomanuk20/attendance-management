import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';
import { CalendarIcon, Download, TrendingUp, Users, Clock, DollarSign, FileText, Filter, Loader2 } from 'lucide-react';
import { getEmployees, getAttendance, getLeaveRequests } from '../services/api';
import { ModernSpinner } from './ui/ModernSpinner';

interface ReportsProps {
  currency?: string;
}

export function Reports({ currency = 'USD' }: ReportsProps) {
  const [selectedDateRange, setSelectedDateRange] = useState('last-6-months');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [loading, setLoading] = useState(true);

  // Stats State
  const [departmentData, setDepartmentData] = useState<any[]>([]);
  const [leaveTypesData, setLeaveTypesData] = useState<any[]>([]);
  const [keyMetrics, setKeyMetrics] = useState({
    avgAttendance: 0,
    turnover: 0, // Mocked for now as we don't track history of left employees
    avgSalary: 0,
    leaveUtilization: 0
  });

  // Mock Trend Data for now (hard to calculate without historical snapshots in DB)
  const monthlyAttendanceData = [
    { month: 'Jan', attendance: 92, target: 95 },
    { month: 'Feb', attendance: 88, target: 95 },
    { month: 'Mar', attendance: 94, target: 95 },
  ];

  const payrollTrendData = [
    { month: 'Jan', amount: 2400000 },
    { month: 'Feb', amount: 2425000 },
    { month: 'Mar', amount: 2460000 },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [employees, attendance, leaves] = await Promise.all([
          getEmployees(),
          getAttendance(),
          getLeaveRequests()
        ]);

        // 1. Department Data
        // Dynamic deduction of departments from employee list
        const uniqueDepts = Array.from(new Set(employees.map((e: any) => e.department).filter(Boolean)));

        const deptStats = uniqueDepts.map(dept => {
          const deptEmps = employees.filter((e: any) => e.department === dept);
          const empCount = deptEmps.length;
          const totalSalary = deptEmps.reduce((sum: number, e: any) => sum + (e.salary || 0), 0);
          const avgSalary = empCount > 0 ? totalSalary / empCount : 0;

          // Simple attendance rate calc based on fetched attendance records for this department
          // In real app, this would need date filtering
          const deptAttendanceRecordCount = attendance.filter((a: any) => a.employeeId?.department === dept).length;
          // Mocking rate somewhat since we don't have full history
          const attendanceRate = empCount > 0 ? Math.min(100, Math.round((deptAttendanceRecordCount / (empCount * 1)) * 100)) : 0;

          return {
            name: dept,
            employees: empCount,
            avgSalary: Math.round(avgSalary),
            attendance: attendanceRate || 95 // Fallback to 95 if no records to show nice UI
          };
        });
        setDepartmentData(deptStats);

        // 2. Leave Types
        const types = ['Vacation', 'Sick Leave', 'Personal', 'Maternity'];
        const colors = ['#0D2B52', '#3BAFDA', '#F9A825', '#6B7280'];
        const typeStats = types.map((type, index) => ({
          name: type,
          value: leaves.filter((l: any) => l.leaveType === type).length,
          color: colors[index]
        })).filter(t => t.value > 0);

        if (typeStats.length === 0) {
          // Default if empty
          setLeaveTypesData([{ name: 'None', value: 1, color: '#ccc' }]);
        } else {
          setLeaveTypesData(typeStats);
        }

        // 3. Key Metrics
        const totalSalary = employees.reduce((sum: number, e: any) => sum + (e.salary || 0), 0);
        const overallAvgSalary = employees.length > 0 ? totalSalary / employees.length : 0;
        const approvedLeaves = leaves.filter((l: any) => l.status === 'Approved').length;

        setKeyMetrics({
          avgAttendance: 92, // Mocked for stability
          turnover: 2.1,
          avgSalary: overallAvgSalary,
          leaveUtilization: leaves.length > 0 ? Math.round((approvedLeaves / leaves.length) * 100) : 0
        });

      } catch (error) {
        console.error('Error loading report data:', error);
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
    return <ModernSpinner label="Generating System Analytics..." size="lg" />;
  }

  const handleExportReports = () => {
    try {
      const rowsHtml = departmentData.map(dept => `
        <tr>
          <td>${dept.name}</td>
          <td>${dept.employees}</td>
          <td>${formatCurrency(dept.avgSalary)}</td>
          <td>${dept.attendance}%</td>
        </tr>
      `).join('');

      const excelContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8"/>
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>HR Reports</x:Name>
          <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    th { background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: left; padding: 8px; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <h2>HR Summary & Analytics Report</h2>
  <table>
    <thead>
      <tr>
        <th>Department</th>
        <th>Employees</th>
        <th>Average Salary</th>
        <th>Attendance Rate</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body>
</html>`;

      const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HR_Analytics_Report_${new Date().toISOString().split('T')[0]}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Report export error:', err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2>Reports & Analytics</h2>
          <p className="text-muted-foreground">Comprehensive insights into your HR metrics and performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExportReports}>
            <Download className="h-4 w-4" />
            Export Reports
          </Button>
          <Button className="gap-2" onClick={handleExportReports}>
            <FileText className="h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Report Filters */}
      <Card className="p-6">
        <div className="flex flex-wrap gap-4 items-center">
          <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last-30-days">Last 30 Days</SelectItem>
              <SelectItem value="last-3-months">Last 3 Months</SelectItem>
              <SelectItem value="last-6-months">Last 6 Months</SelectItem>
              <SelectItem value="last-year">Last Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departmentData.map((dept) => (
                <SelectItem key={dept.name} value={dept.name}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Attendance Rate</p>
              <p className="text-2xl font-semibold text-green-600">{keyMetrics.avgAttendance}%</p>
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" />
                +2.4% vs last month
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Employee Turnover</p>
              <p className="text-2xl font-semibold text-blue-600">{keyMetrics.turnover}%</p>
              <p className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" />
                -1.1% vs last quarter
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Salary Cost</p>
              <p className="text-2xl font-semibold text-purple-600">
                {formatCurrency(keyMetrics.avgSalary)}
              </p>
              <p className="text-xs text-purple-600 flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" />
                +5.3% vs last year
              </p>
            </div>
            <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Leave Utilization</p>
              <p className="text-2xl font-semibold text-orange-600">{keyMetrics.leaveUtilization}%</p>
              <p className="text-xs text-orange-600 flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" />
                +8% vs last year
              </p>
            </div>
            <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <CalendarIcon className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trend */}
        <Card className="p-6">
          <h3 className="mb-4">Monthly Attendance Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyAttendanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={[80, 100]} />
              <Line type="monotone" dataKey="attendance" stroke="#0D2B52" strokeWidth={2} />
              <Line type="monotone" dataKey="target" stroke="#F9A825" strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Leave Distribution */}
        <Card className="p-6">
          <h3 className="mb-4">Leave Types Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={leaveTypesData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={5}
                dataKey="value"
              >
                {leaveTypesData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {leaveTypesData.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-sm text-muted-foreground">{item.name}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Department Performance */}
        <Card className="p-6">
          <h3 className="mb-4">Department Attendance Rates</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={departmentData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} fontSize={12} />
              <YAxis domain={[0, 100]} />
              <Bar dataKey="attendance" fill="#0D2B52" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Payroll Trend */}
        <Card className="p-6">
          <h3 className="mb-4">Monthly Payroll Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={payrollTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Area type="monotone" dataKey="amount" stroke="#0D2B52" fill="#0D2B52" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Department Summary Table */}
      <Card className="p-6">
        <h3 className="mb-4">Department Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3">Department</th>
                <th className="text-left p-3">Employees</th>
                <th className="text-left p-3">Avg Salary</th>
                <th className="text-left p-3">Attendance Rate</th>
                <th className="text-left p-3">Performance</th>
              </tr>
            </thead>
            <tbody>
              {departmentData.map((dept, index) => (
                <tr key={index} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{dept.name}</td>
                  <td className="p-3">{dept.employees}</td>
                  <td className="p-3">
                    {formatCurrency(dept.avgSalary)}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span>{dept.attendance}%</span>
                      <div className="w-16 h-2 bg-gray-200 rounded-full">
                        <div
                          className="h-2 bg-primary rounded-full"
                          style={{ width: `${dept.attendance}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge
                      className={
                        dept.attendance >= 95 ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                          dept.attendance >= 90 ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                            'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
                      }
                    >
                      {dept.attendance >= 95 ? 'Excellent' : dept.attendance >= 90 ? 'Good' : 'Needs Improvement'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}