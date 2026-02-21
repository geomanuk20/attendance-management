import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Clock, CalendarIcon, Search, Loader2, ChevronsUpDown, Check, Download } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { format, subDays, endOfMonth } from 'date-fns';
import { getAttendance, clockIn, clockOut, getEmployeeNames } from '../services/api';
import { toast } from 'sonner';

interface AttendanceProps {
  userRole?: 'admin' | 'employee' | 'superadmin' | 'hr';
}

export function Attendance({ userRole = 'admin' }: AttendanceProps) {
  // Common state
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
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

  // Employee specific state
  const [user, setUser] = useState<any>(null);
  const [status, setStatus] = useState<'Checked In' | 'Checked Out' | 'Completed'>('Checked Out');
  const [todayRecord, setTodayRecord] = useState<any>(null);

  // Stats
  const [stats, setStats] = useState({
    today: 0,
    vacation: 0,
    halfDay: 0,
    rate: 0
  });

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

  const fetchTodayStatus = async (employeeId: string) => {
    if (!employeeId) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await getAttendance(employeeId);
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
      console.error('Error fetching today status:', error);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      if (userRole === 'employee') {
        fetchTodayStatus(parsedUser.id);
        fetchAttendance(parsedUser.id);
      } else {
        fetchAttendance();
        // Load employee list for dropdown filter
        getEmployeeNames().then(setEmployeeList).catch(() => toast.error('Could not load employee list'));
      }
    } else {
      fetchAttendance();
      getEmployeeNames().then(setEmployeeList).catch(() => toast.error('Could not load employee list'));
    }
  }, [userRole]);

  const handleClockIn = async () => {
    if (!user?.id) {
      toast.error('Session invalid. Please logout and login again.');
      return;
    }
    try {
      await clockIn(user.id);
      toast.success('Clocked in successfully');
      fetchTodayStatus(user.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to clock in');
    }
  };

  const handleClockOut = async () => {
    if (!user?.id) {
      toast.error('Session invalid. Please logout and login again.');
      return;
    }
    try {
      await clockOut(user.id);
      toast.success('Clocked out successfully');
      fetchTodayStatus(user.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to clock out');
    }
  };

  const toLocalDateStr = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Build employee list from loaded attendance records (always available) + API fetch (catches employees with no records)
  const derivedEmployeeList = Array.from(
    new Map(
      attendanceRecords
        .filter(r => r.employeeId?._id)
        .map(r => [r.employeeId._id, { _id: r.employeeId._id, name: r.employeeId.name }])
    ).values()
  ).sort((a: any, b: any) => a.name.localeCompare(b.name));

  // Merge: use API list if loaded, otherwise fall back to derived list
  const mergedEmployeeList = employeeList.length > 0 ? employeeList : derivedEmployeeList;

  const filteredRecords = attendanceRecords.filter(record => {
    const employeeName = record.employeeId?.name || 'Unknown';
    const matchesSearch = employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = selectedDepartment === 'all' || (record.employeeId?.department === selectedDepartment);
    const matchesStatus = selectedStatus === 'all' || record.status === selectedStatus;
    const matchesEmployee = selectedEmployee === 'all' || String(record.employeeId?._id || record.employeeId) === selectedEmployee;
    // record.date is stored as 'YYYY-MM-DD' string
    const recordDateStr = record.date ? String(record.date).split('T')[0] : '';
    if (dateFilterMode === 'date') {
      return matchesSearch && matchesDepartment && matchesStatus && matchesEmployee && recordDateStr === toLocalDateStr(selectedDate);
    }
    if (dateFilterMode === 'range') {
      if (!dateFrom && !dateTo) return matchesSearch && matchesDepartment && matchesStatus && matchesEmployee;

      const recordDate = new Date(record.date);
      // Strip time from recordDate to ensure fair comparison
      recordDate.setHours(0, 0, 0, 0);

      // Same strip for from/to
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Present':
      case 'Attendance':
        return <Badge style={{ backgroundColor: '#10B981', color: '#ffffff' }} className="hover:bg-green-600">Present</Badge>;
      case 'Vacation':
        return <Badge style={{ backgroundColor: '#F9A825', color: '#ffffff' }} className="hover:bg-yellow-600">Vacation</Badge>;
      case 'Half-Day':
        return <Badge style={{ backgroundColor: '#3BAFDA', color: '#ffffff' }} className="hover:bg-blue-600">Half-Day</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatWorkHours = (hours: number) => {
    if (!hours || hours <= 0) return null;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export History
            </Button>
          </div>
        </div>

        {/* Clock In/Out Section */}
        <Card className="p-8 flex flex-col items-center justify-center space-y-6 bg-gradient-to-br from-background to-secondary/20">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold">{format(new Date(), 'EEEE, MMMM do, yyyy')}</h3>
            <p className="text-muted-foreground text-lg">{format(new Date(), 'h:mm a')}</p>
          </div>

          {status === 'Checked Out' && (
            <Button
              size="lg"
              className="h-32 w-32 rounded-full text-lg font-bold shadow-lg transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleClockIn}
            >
              Clock In
            </Button>
          )}

          {status === 'Checked In' && (
            <Button
              size="lg"
              className="h-32 w-32 rounded-full text-lg font-bold shadow-lg transition-all duration-300 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleClockOut}
            >
              Clock Out
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
      <div className="flex items-center justify-between">
        <div>
          <h2>Attendance Management</h2>
          <p className="text-muted-foreground">Track and manage employee attendance records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          {/* Admin generally doesn't clock in here, but maybe for testing */}
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
              {filteredRecords.filter(r => r.status === 'Vacation').length}
            </p>
            <p className="text-sm text-muted-foreground">On Vacation</p>
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
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
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
          {(dateFilterMode === 'date' || dateFilterMode === 'month') && (
            <Popover open={dateDropOpen} onOpenChange={setDateDropOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 text-xs">
                  <CalendarIcon className="h-4 w-4" />
                  {dateFilterMode === 'month'
                    ? format(selectedDate, 'MMM yyyy')
                    : format(selectedDate, 'MMM dd, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                {dateFilterMode === 'date' && (
                  <Calendar
                    mode="single"
                    captionLayout="dropdown-buttons"
                    fromYear={2000}
                    toYear={new Date().getFullYear() + 5}
                    selected={selectedDate}
                    onSelect={(d) => { if (d) { setSelectedDate(d); setDateDropOpen(false); } }}
                    initialFocus
                  />
                )}
                {dateFilterMode === 'month' && (
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
                )}
              </PopoverContent>
            </Popover>
          )}

          {/* Range picker — two date selectors (From / To) */}
          {dateFilterMode === 'range' && (
            <div className="flex items-center gap-2">
              <Popover open={fromDropOpen} onOpenChange={setFromDropOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2 text-xs">
                    <CalendarIcon className="h-4 w-4" />
                    {dateFrom ? format(dateFrom, 'MMM dd, yyyy') : 'From date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    captionLayout="dropdown-buttons"
                    fromYear={2000}
                    toYear={new Date().getFullYear() + 5}
                    selected={dateFrom}
                    onSelect={(d) => { if (d) { setDateFrom(d); setFromDropOpen(false); } }}
                    disabled={(d) => dateTo ? d > dateTo : false}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-sm">–</span>
              <Popover open={toDropOpen} onOpenChange={setToDropOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2 text-xs">
                    <CalendarIcon className="h-4 w-4" />
                    {dateTo ? format(dateTo, 'MMM dd, yyyy') : 'To date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    captionLayout="dropdown-buttons"
                    fromYear={2000}
                    toYear={new Date().getFullYear() + 5}
                    selected={dateTo}
                    onSelect={(d) => { if (d) { setDateTo(d); setToDropOpen(false); } }}
                    disabled={(d) => dateFrom ? d < dateFrom : false}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground px-2"
                  onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                  Clear
                </Button>
              )}
            </div>
          )}

          {/* ── Employee combobox (Popover + Command — standard shadcn pattern) ─ */}
          <Popover open={empDropOpen} onOpenChange={setEmpDropOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={empDropOpen}
                className="w-48 justify-between font-normal"
              >
                <span className="truncate">
                  {selectedEmployee === 'all'
                    ? 'All Employees'
                    : mergedEmployeeList.find((e: any) => e._id === selectedEmployee)?.name ?? 'All Employees'}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search employee..." />
                <CommandList>
                  <CommandEmpty>No employee found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="All Employees"
                      onSelect={() => { setSelectedEmployee('all'); setEmpDropOpen(false); }}
                    >
                      <Check className={`mr-2 h-4 w-4 ${selectedEmployee === 'all' ? 'opacity-100' : 'opacity-0'}`} />
                      All Employees
                    </CommandItem>
                    {mergedEmployeeList.map((emp: any) => (
                      <CommandItem
                        key={emp._id}
                        value={emp.name}
                        onSelect={() => { setSelectedEmployee(emp._id); setEmpDropOpen(false); }}
                      >
                        <Check className={`mr-2 h-4 w-4 ${selectedEmployee === emp._id ? 'opacity-100' : 'opacity-0'}`} />
                        {emp.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

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
              <SelectItem value="Late">Late</SelectItem>
              <SelectItem value="Half Day">Half Day</SelectItem>
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
                      {record.workHours > 0
                        ? formatWorkHours(record.workHours)
                        : record.clockIn && !record.clockOut
                          ? 'In progress'
                          : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No attendance records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}