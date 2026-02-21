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
      await createLeaveRequest({ ...newRequest, employeeId });
      toast.success('Leave request submitted successfully');
      setIsDialogOpen(false);
      setNewRequest({ employeeId: '', leaveType: 'Vacation', startDate: '', endDate: '', reason: '' });
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
      case 'Vacation': return 'text-blue-600';
      case 'Sick Leave': return 'text-red-600';
      case 'Personal': return 'text-purple-600';
      case 'Maternity': return 'text-pink-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
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
          <h2>Leave Requests</h2>
          <p className="text-muted-foreground">Manage employee leave requests and approvals</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Submit Leave Request</DialogTitle>
              <DialogDescription>
                Fill out the form below to submit a new leave request.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="leave-type">Leave Type</Label>
                  <Select
                    value={newRequest.leaveType}
                    onValueChange={(val) => setNewRequest({ ...newRequest, leaveType: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Vacation">Vacation</SelectItem>
                      <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                      <SelectItem value="Personal">Personal</SelectItem>
                      <SelectItem value="Maternity">Maternity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee">Employee</Label>
                  {userRole === 'employee' ? (
                    <Input
                      id="employee"
                      value={currentUser?.name || ''}
                      readOnly
                      className="bg-muted cursor-not-allowed"
                    />
                  ) : (
                    <Select
                      value={newRequest.employeeId}
                      onValueChange={(val) => setNewRequest({ ...newRequest, employeeId: val })}
                    >
                      <SelectTrigger>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    type="date"
                    id="start-date"
                    value={newRequest.startDate}
                    onChange={(e) => setNewRequest({ ...newRequest, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    type="date"
                    id="end-date"
                    value={newRequest.endDate}
                    onChange={(e) => setNewRequest({ ...newRequest, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="Please provide a reason for your leave request..."
                  className="min-h-[100px]"
                  value={newRequest.reason}
                  onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1" onClick={handleCreateRequest}>Submit Request</Button>
                <Button variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Requests</p>
              <p className="text-2xl font-semibold text-yellow-600">{pendingCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
            </div>
            <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-2xl font-semibold text-green-600">{approvedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Total approved</p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Check className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Rejected</p>
              <p className="text-2xl font-semibold text-red-600">{rejectedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Total rejected</p>
            </div>
            <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
              <X className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Requests</p>
              <p className="text-2xl font-semibold text-blue-600">{leaveRequests.length}</p>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
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
              <SelectItem value="Vacation">Vacation</SelectItem>
              <SelectItem value="Sick Leave">Sick Leave</SelectItem>
              <SelectItem value="Personal">Personal</SelectItem>
              <SelectItem value="Maternity">Maternity</SelectItem>
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
                    <TableCell>{new Date(request.startDate).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(request.endDate).toLocaleDateString()}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {userRole !== 'employee' && (
                        <div className="flex gap-2">
                          {request.status === 'Pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => handleStatusUpdate(request._id, 'Approved')}
                              >
                                <Check className="h-3 w-3" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => handleStatusUpdate(request._id, 'Rejected')}
                              >
                                <X className="h-3 w-3" /> Reject
                              </Button>
                            </>
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