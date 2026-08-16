import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Calendar, Search, Plus, Check, X, Clock, Loader2 } from 'lucide-react';
import { getLeaveRequests, createLeaveRequest, updateLeaveRequest, getEmployees } from '../services/api';
import { toast } from 'sonner';
import { ModernSpinner } from './ui/ModernSpinner';

interface LeaveRequestsProps {
  userRole?: string;
}

export function LeaveRequests({ userRole = 'admin' }: LeaveRequestsProps) {
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  // New Request Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [newRequest, setNewRequest] = useState({
    employeeId: '',
    leaveType: 'Vacation',
    startDate: '',
    endDate: '',
    reason: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      if (userRole === 'employee') {
        // Employees only need their own leave requests
        const leaves = await getLeaveRequests();
        setLeaveRequests(leaves);
      } else {
        // Admins/HR need all leaves and employee list for the dropdown
        const [leaves, emps] = await Promise.all([getLeaveRequests(), getEmployees()]);
        setLeaveRequests(leaves);
        setEmployees(emps);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setCurrentUser(parsedUser);
    }
    fetchData();
  }, []);

  const handleCreateRequest = async () => {
    try {
      const employeeId = userRole === 'employee' ? currentUser?.id : newRequest.employeeId;
      if (!employeeId || !newRequest.startDate || !newRequest.endDate) {
        toast.error('Please fill in all required fields');
        return;
      }
      const payload = {
        ...newRequest,
        employeeId,
        reason: newRequest.leaveType === 'Week Off' ? (newRequest.reason || 'Scheduled Week Off') : newRequest.reason,
      };
      await createLeaveRequest(payload);
      toast.success('Leave request submitted successfully');
      setIsDialogOpen(false);
      setNewRequest({ employeeId: '', leaveType: 'Casual Leave', startDate: '', endDate: '', reason: '' });
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Failed to create leave request');
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await updateLeaveRequest(id, { status });
      toast.success(`Leave request ${status.toLowerCase()}`);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Failed to update status');
    }
  };

  // For employees, filter to only their own requests
  const visibleRequests = userRole === 'employee' && currentUser?.id
    ? leaveRequests.filter(r => String(r.employeeId?._id || r.employeeId) === String(currentUser.id))
    : leaveRequests;

  const filteredRequests = visibleRequests.filter(request => {
    const employeeName = request.employeeId?.name || 'Unknown';
    const matchesSearch = employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = selectedDepartment === 'all' || (request.employeeId?.department === selectedDepartment);
    const matchesStatus = selectedStatus === 'all' || request.status === selectedStatus;
    const matchesType = selectedType === 'all' || request.leaveType === selectedType;
    return matchesSearch && matchesDepartment && matchesStatus && matchesType;
  }).sort((a, b) => {
    const parseD = (str?: string) => {
      if (!str) return 0;
      const clean = String(str).split('T')[0];
      const p = clean.split('-');
      if (p.length === 3) return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)).getTime();
      return new Date(str).getTime();
    };
    return parseD(b.startDate || b.createdAt) - parseD(a.startDate || a.createdAt);
  });

  const pendingCount = leaveRequests.filter(r => r.status === 'Pending').length;
  const approvedCount = leaveRequests.filter(r => r.status === 'Approved').length;
  const rejectedCount = leaveRequests.filter(r => r.status === 'Rejected').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Approved</Badge>;
      case 'Rejected':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Rejected</Badge>;
      case 'Pending':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Week Off': return 'text-slate-400 font-semibold';
      case 'Casual Leave': return 'text-indigo-400 font-medium';
      case 'Medical Leave': return 'text-emerald-400 font-medium';
      case 'Annual Leave': return 'text-amber-400 font-medium';
      case 'Vacation': return 'text-blue-400';
      case 'Sick Leave': return 'text-red-400';
      case 'Personal': return 'text-purple-400';
      case 'Maternity': return 'text-pink-400';
      default: return 'text-gray-400';
    }
  };

  if (loading) {
    return <ModernSpinner label="Loading Leave Applications..." size="lg" />;
  }

  return (
    <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Leave Requests</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage employee leave requests and approvals</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 text-xs sm:text-sm h-9 font-semibold">
              <Plus className="h-4 w-4" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl w-[95vw] sm:w-[90vw] max-h-[88vh] overflow-y-auto p-4 sm:p-6 rounded-2xl shadow-2xl border border-border bg-background">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-bold">Submit Leave Request</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Fill out the form below to submit a new leave request.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:gap-4 py-2 sm:py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="leave-type" className="text-xs sm:text-sm">Leave Type</Label>
                  <Select
                    value={newRequest.leaveType}
                    onValueChange={(val) => setNewRequest({ ...newRequest, leaveType: val })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Casual Leave">Casual Leave</SelectItem>
                      <SelectItem value="Medical Leave">Medical Leave</SelectItem>
                      <SelectItem value="Annual Leave">Annual Leave</SelectItem>
                      <SelectItem value="Week Off">Week Off</SelectItem>
                      <SelectItem value="Leave">Leave</SelectItem>
                      <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="employee" className="text-xs sm:text-sm">Employee</Label>
                  {userRole === 'employee' ? (
                    <Input
                      id="employee"
                      value={currentUser?.name || ''}
                      readOnly
                      className="bg-muted cursor-not-allowed h-9"
                    />
                  ) : (
                    <Select
                      value={newRequest.employeeId}
                      onValueChange={(val) => setNewRequest({ ...newRequest, employeeId: val })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp._id} value={emp._id}>{emp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="start-date" className="text-xs sm:text-sm">Start Date</Label>
                  <Input
                    type="date"
                    id="start-date"
                    className="h-9 text-xs sm:text-sm"
                    value={newRequest.startDate}
                    onChange={(e) => setNewRequest({ ...newRequest, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end-date" className="text-xs sm:text-sm">End Date</Label>
                  <Input
                    type="date"
                    id="end-date"
                    className="h-9 text-xs sm:text-sm"
                    value={newRequest.endDate}
                    onChange={(e) => setNewRequest({ ...newRequest, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reason" className="text-xs sm:text-sm">Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="Please provide a reason for your leave request..."
                  className="min-h-[80px] sm:min-h-[100px] text-xs sm:text-sm"
                  value={newRequest.reason}
                  onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                />
              </div>
              <div className="flex gap-2 pt-2 sm:pt-4">
                <Button className="flex-1 text-xs sm:text-sm h-9" onClick={handleCreateRequest}>Submit Request</Button>
                <Button variant="outline" className="flex-1 text-xs sm:text-sm h-9" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3.5 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">Pending Requests</p>
              <p className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5 text-yellow-600 dark:text-yellow-400">{pendingCount}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 font-medium">Awaiting approval</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-yellow-100 dark:bg-yellow-950/60 rounded-xl flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </Card>

        <Card className="p-3.5 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">Approved</p>
              <p className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5 text-green-600 dark:text-green-400">{approvedCount}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 font-medium">Total approved</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-green-100 dark:bg-green-950/60 rounded-xl flex items-center justify-center shrink-0">
              <Check className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="p-3.5 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">Rejected</p>
              <p className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5 text-red-600 dark:text-red-400">{rejectedCount}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 font-medium">Total rejected</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-red-100 dark:bg-red-950/60 rounded-xl flex items-center justify-center shrink-0">
              <X className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </Card>

        <Card className="p-3.5 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">Total Requests</p>
              <p className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5 text-blue-600 dark:text-blue-400">{leaveRequests.length}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 font-medium">All time</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-blue-100 dark:bg-blue-950/60 rounded-xl flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 sm:p-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex items-center flex-1 sm:flex-initial min-w-[200px] sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full"
            />
          </div>

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
              <SelectItem value="Logistics and Fulfillment">Logistics and Fulfillment</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Leave Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Casual Leave">Casual Leave</SelectItem>
              <SelectItem value="Medical Leave">Medical Leave</SelectItem>
              <SelectItem value="Annual Leave">Annual Leave</SelectItem>
              <SelectItem value="Week Off">Week Off</SelectItem>
              <SelectItem value="Leave">Leave</SelectItem>
              <SelectItem value="Sick Leave">Sick Leave</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Leave Requests Table */}
      <Card>
        <div className="p-6">
          <h3 className="mb-4">Leave Requests</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                {userRole !== 'employee' && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.length > 0 ? (
                filteredRequests.map((request) => (
                  <TableRow key={request._id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                          <span className="text-primary-foreground text-xs">
                            {request.employeeId?.name.split(' ').map((n: string) => n[0]).join('') || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{request.employeeId?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{request.employeeId?.department}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={getTypeColor(request.leaveType)}>{request.leaveType}</span>
                    </TableCell>
                    <TableCell>{new Date(request.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                    <TableCell>{new Date(request.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {userRole !== 'employee' && (
                        <div className="flex gap-2">
                          {request.status !== 'Approved' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-green-600 border-green-300 hover:bg-green-50"
                              onClick={() => handleStatusUpdate(request._id, 'Approved')}
                            >
                              <Check className="h-3 w-3" /> Approve
                            </Button>
                          )}
                          {request.status !== 'Rejected' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-red-600 border-red-300 hover:bg-red-50"
                              onClick={() => handleStatusUpdate(request._id, 'Rejected')}
                            >
                              <X className="h-3 w-3" /> Reject
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No leave requests found
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