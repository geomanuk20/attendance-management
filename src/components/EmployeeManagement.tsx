import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback } from './ui/avatar';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  Users,
  UserPlus,
  Download,
  Loader2
} from 'lucide-react';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, getAttendance, getLeaveRequests } from '../services/api';

interface EmployeeManagementProps {
  currency?: string;
}

export function EmployeeManagement({ currency = 'USD' }: EmployeeManagementProps) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCustomDepartment, setIsCustomDepartment] = useState(false);
  const [clockedInToday, setClockedInToday] = useState<Set<string>>(new Set());
  const [onLeaveToday, setOnLeaveToday] = useState<Set<string>>(new Set());

  // Unique departments list
  const defaultDepartments = ['Engineering', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Logistics and Fulfillment'];
  const uniqueDepartments = Array.from(new Set([...defaultDepartments, ...employees.map(e => e.department)])).filter(Boolean).sort();

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '', // Added password field
    phone: '',
    position: '',
    department: '',
    role: 'employee', // Added role field
    salary: '', // Monthly Gross
    ctc: '', // Annual CTC
    basicSalary: '', // Annual Basic
    hra: '', // Annual HRA
    otherAllowances: '', // Annual Allowances
    hireDate: '',
    address: '',
    emergencyContact: '',
    status: 'Active'
  });

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const data = await getEmployees();
      const mappedData = data.map((emp: any) => ({
        ...emp,
        id: emp._id,
      }));
      setEmployees(mappedData);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [attendanceData, leaveData] = await Promise.all([getAttendance(), getLeaveRequests()]);

      // Active = clocked in today and not yet clocked out
      const activeIds = new Set<string>(
        attendanceData
          .filter((r: any) => {
            const recordDate = r.date ? String(r.date).split('T')[0] : '';
            return recordDate === today && r.clockIn && !r.clockOut;
          })
          .map((r: any) => String(r.employeeId?._id || r.employeeId))
      );

      // On Leave = has an approved leave request that covers today
      const onLeaveIds = new Set<string>(
        leaveData
          .filter((l: any) => {
            if (l.status !== 'Approved') return false;
            const start = new Date(l.startDate).toISOString().split('T')[0];
            const end = new Date(l.endDate).toISOString().split('T')[0];
            return today >= start && today <= end;
          })
          .map((l: any) => String(l.employeeId?._id || l.employeeId))
      );

      setClockedInToday(activeIds);
      setOnLeaveToday(onLeaveIds);
    } catch (error) {
      console.error('Error fetching attendance status:', error);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchTodayAttendance();
  }, []);

  // Auto-calculate salary details when CTC changes
  // Logic: 
  // Basic = 50% of CTC
  // HRA = 50% of Basic (25% of CTC)
  // Allowances = Balance (25% of CTC)
  // Monthly Gross (salary) = CTC / 12
  const calculateSalaryDetails = (ctcValue: string) => {
    const ctc = Number(ctcValue);
    if (!ctc || isNaN(ctc)) return;

    const basic = ctc * 0.5;
    const hra = basic * 0.5;
    const allowances = ctc - basic - hra;
    const monthlyGross = ctc / 12;

    setFormData(prev => ({
      ...prev,
      basicSalary: basic.toFixed(2),
      hra: hra.toFixed(2),
      otherAllowances: allowances.toFixed(2),
      salary: monthlyGross.toFixed(2)
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;

    if (id === 'ctc') {
      setFormData(prev => ({ ...prev, [id]: value }));
      calculateSalaryDetails(value);
    } else {
      setFormData(prev => ({ ...prev, [id]: value }));
    }
  };

  const handleSelectChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      position: '',
      department: '',
      role: 'employee',
      salary: '',
      ctc: '',
      basicSalary: '',
      hra: '',
      otherAllowances: '',
      hireDate: '',
      address: '',
      emergencyContact: '',
      status: 'Active'
    });
    setIsCustomDepartment(false); // Reset custom department toggle
  };

  const handleAddEmployee = async () => {
    try {
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.hireDate || !formData.department || !formData.position) {
        toast.error('Please fill in all required fields (Name, Email, Department, Position, Hire Date)');
        return;
      }

      const newEmployee = {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        password: formData.password || 'welcome123', // Default password if not provided by UI yet, though we will add UI
        phone: formData.phone,
        position: formData.position,
        department: formData.department.charAt(0).toUpperCase() + formData.department.slice(1),
        role: formData.role,
        salary: Number(formData.salary) || 0,
        ctc: Number(formData.ctc) || 0,
        basicSalary: Number(formData.basicSalary) || 0,
        hra: Number(formData.hra) || 0,
        otherAllowances: Number(formData.otherAllowances) || 0,
        hireDate: formData.hireDate,
        status: 'Active',
        address: formData.address,
        emergencyContact: formData.emergencyContact
      };

      await createEmployee(newEmployee);
      toast.success('Employee added successfully');
      setIsAddDialogOpen(false);
      resetForm();
      fetchEmployees();
    } catch (error: any) {
      console.error('Error adding employee:', error);
      toast.error(error.message || 'Failed to add employee');
    }
  };

  const handleEditClick = (employee: any) => {
    setSelectedEmployee(employee);
    const nameParts = employee.name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    // Ensure the date is formatted for the input (YYYY-MM-DD)
    const formattedDate = employee.hireDate ? new Date(employee.hireDate).toISOString().split('T')[0] : '';

    setFormData({
      firstName: firstName || '',
      lastName: lastName || '',
      email: employee.email,
      password: '', // Password not retrieved for editing usually
      phone: employee.phone,
      position: employee.position,
      department: employee.department,
      role: employee.role || 'employee',
      salary: employee.salary ? employee.salary.toString() : '',
      ctc: employee.ctc ? employee.ctc.toString() : '',
      basicSalary: employee.basicSalary ? employee.basicSalary.toString() : '',
      hra: employee.hra ? employee.hra.toString() : '',
      otherAllowances: employee.otherAllowances ? employee.otherAllowances.toString() : '',
      hireDate: formattedDate,
      address: employee.address || '',
      emergencyContact: employee.emergencyContact || '',
      status: employee.status
    });

    // Check if department is custom
    const isCustom = !defaultDepartments.includes(employee.department);
    setIsCustomDepartment(isCustom);

    setIsEditDialogOpen(true);
  };

  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) return;

    try {
      const updatedData = {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        phone: formData.phone,
        position: formData.position,
        department: formData.department,
        salary: Number(formData.salary),
        ctc: Number(formData.ctc),
        basicSalary: Number(formData.basicSalary),
        hra: Number(formData.hra),
        otherAllowances: Number(formData.otherAllowances),
        hireDate: formData.hireDate,
        address: formData.address,
        emergencyContact: formData.emergencyContact,
        status: formData.status
      };

      await updateEmployee(selectedEmployee._id, updatedData);
      toast.success('Employee updated successfully');
      setIsEditDialogOpen(false);
      setSelectedEmployee(null);
      resetForm();
      fetchEmployees();
    } catch (error) {
      console.error('Error updating employee:', error);
      toast.error('Failed to update employee');
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!id) {
      toast.error('Error: Invalid employee ID');
      return;
    }

    if (window.confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
      try {
        await deleteEmployee(id);
        toast.success('Employee deleted successfully');
        fetchEmployees();
      } catch (error: any) {
        console.error('Error deleting employee:', error);
        toast.error(error.message || 'Failed to delete employee');
      }
    }
  };

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = selectedDepartment === 'all' || employee.department === selectedDepartment;
    const empId = String(employee._id || employee.id);
    const attendanceStatus = onLeaveToday.has(empId) ? 'On Leave' : clockedInToday.has(empId) ? 'Active' : 'Inactive';
    const matchesStatus = selectedStatus === 'all' || attendanceStatus === selectedStatus;
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const getAttendanceStatus = (employeeId: string) => {
    if (onLeaveToday.has(employeeId)) {
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100"><span className="h-2 w-2 rounded-full bg-yellow-500 inline-block mr-1"></span>On Leave</Badge>;
    }
    if (clockedInToday.has(employeeId)) {
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><span className="h-2 w-2 rounded-full bg-green-500 inline-block mr-1 animate-pulse"></span>Active</Badge>;
    }
    return <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">Inactive</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>;
      case 'On Leave':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">On Leave</Badge>;
      case 'Inactive':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Inactive</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    const locales: { [key: string]: string } = {
      'USD': 'en-US',
      'EUR': 'de-DE',
      'GBP': 'en-GB',
      'INR': 'en-IN',
      'EGP': 'en-EG',
      'JPY': 'ja-JP'
    };
    return new Intl.NumberFormat(locales[currency] || 'en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
          <h2>Employee Management</h2>
          <p className="text-muted-foreground">Manage employee profiles, information, and status</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={resetForm}>
                <UserPlus className="h-4 w-4" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
                <DialogDescription>
                  Enter the details of the new employee to add them to the system.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" placeholder="Enter first name" value={formData.firstName} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" placeholder="Enter last name" value={formData.lastName} onChange={handleInputChange} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="employee@company.com" value={formData.email} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" placeholder="+1 (555) 123-4567" value={formData.phone} onChange={handleInputChange} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" placeholder="Initial password" value={formData.password} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select onValueChange={(val: string) => handleSelectChange('role', val)} value={formData.role}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="hr">HR</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="superadmin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="position">Position</Label>
                    <Input id="position" placeholder="Job title" value={formData.position} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <div className="flex gap-2">
                      {isCustomDepartment ? (
                        <Input
                          id="department"
                          placeholder="Type new department"
                          value={formData.department}
                          onChange={handleInputChange}
                          className="flex-1"
                        />
                      ) : (
                        <Select
                          onValueChange={(val: string) => handleSelectChange('department', val)}
                          value={defaultDepartments.includes(formData.department) ? formData.department : ''}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {uniqueDepartments.map(dept => (
                              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setIsCustomDepartment(!isCustomDepartment);
                          if (!isCustomDepartment) {
                            setFormData(prev => ({ ...prev, department: '' })); // Clear if switching to custom
                          }
                        }}
                        title={isCustomDepartment ? "Select from list" : "Create new department"}
                      >
                        {isCustomDepartment ? <Search className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Payroll Information Section */}
                <div className="border-t border-b py-4 my-2">
                  <h3 className="font-semibold mb-4">Payroll Information</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label htmlFor="ctc" className="text-blue-600 font-bold">Annual CTC</Label>
                      <Input id="ctc" type="number" placeholder="e.g. 1200000" value={formData.ctc} onChange={handleInputChange} className="border-blue-200 bg-blue-50/50" />
                      <p className="text-xs text-muted-foreground">Enter this to auto-calculate others</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salary">Monthly Income (Gross)</Label>
                      <Input id="salary" type="number" title="Auto-calculated" value={formData.salary} onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="basicSalary">Annual Basic</Label>
                      <Input id="basicSalary" type="number" value={formData.basicSalary} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hra">Annual HRA</Label>
                      <Input id="hra" type="number" value={formData.hra} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="otherAllowances">Allowances</Label>
                      <Input id="otherAllowances" type="number" value={formData.otherAllowances} onChange={handleInputChange} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hireDate">Hire Date</Label>
                    <Input id="hireDate" type="date" value={formData.hireDate} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" placeholder="Street address, City, State" value={formData.address} onChange={handleInputChange} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContact">Emergency Contact</Label>
                  <Input id="emergencyContact" placeholder="Name - Phone number" value={formData.emergencyContact} onChange={handleInputChange} />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button className="flex-1" onClick={handleAddEmployee}>Add Employee</Button>
                  <Button variant="outline" className="flex-1" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Employees</p>
              <p className="text-2xl font-semibold">{employees.length}</p>
              <p className="text-xs text-green-600 mt-1">+3 this month</p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-semibold text-green-600">
                {employees.filter(e => e.status === 'Active').length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {employees.length > 0 ? Math.round((employees.filter(e => e.status === 'Active').length / employees.length) * 100) : 0}% of total
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">On Leave</p>
              <p className="text-2xl font-semibold text-yellow-600">
                {employees.filter(e => e.status === 'On Leave').length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Temporary absence</p>
            </div>
            <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Calendar className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Salary</p>
              <p className="text-2xl font-semibold text-purple-600">
                {employees.length > 0 ? formatCurrency(employees.reduce((sum, e) => sum + e.salary, 0) / employees.length) : formatCurrency(0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Across all departments</p>
            </div>
            <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Briefcase className="h-6 w-6 text-purple-600" />
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
              <SelectItem value="Active">Active (Working Now)</SelectItem>
              <SelectItem value="On Leave">On Leave</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Employee Table */}
      <Card>
        <div className="p-6">
          <h3 className="mb-4">Employee Directory</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Hire Date</TableHead>
                <TableHead>Monthly Income</TableHead>
                <TableHead>CTC (Annual)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {employee.name.split(' ').map((n: string) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{employee.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {employee.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{employee.position}</TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell>{formatDate(employee.hireDate)}</TableCell>
                  <TableCell>{formatCurrency(employee.salary)}</TableCell>
                  <TableCell>{employee.ctc ? formatCurrency(employee.ctc) : '-'}</TableCell>
                  <TableCell>{getAttendanceStatus(employee._id || employee.id)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleEditClick(employee)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteEmployee(employee._id || employee.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee Details</DialogTitle>
            <DialogDescription>
              View and edit employee information.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="personal">Personal Info</TabsTrigger>
              <TabsTrigger value="employment">Employment & Salary</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
            </TabsList>
            <TabsContent value="personal" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-firstName">First Name</Label>
                  <Input id="firstName" value={formData.firstName} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-lastName">Last Name</Label>
                  <Input id="lastName" value={formData.lastName} onChange={handleInputChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-address">Address</Label>
                <Textarea id="address" value={formData.address} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-emergency">Emergency Contact</Label>
                <Input id="emergencyContact" value={formData.emergencyContact} onChange={handleInputChange} />
              </div>
            </TabsContent>
            <TabsContent value="employment" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-position">Position</Label>
                  <Input id="position" value={formData.position} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-department">Department</Label>
                  <div className="flex gap-2">
                    {isCustomDepartment ? (
                      <Input
                        id="department"
                        placeholder="Type new department"
                        value={formData.department}
                        onChange={handleInputChange}
                        className="flex-1"
                      />
                    ) : (
                      <Select
                        onValueChange={(val: string) => handleSelectChange('department', val)}
                        value={defaultDepartments.includes(formData.department) ? formData.department : ''}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {uniqueDepartments.map(dept => (
                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setIsCustomDepartment(!isCustomDepartment);
                        if (!isCustomDepartment) {
                          setFormData(prev => ({ ...prev, department: '' })); // Clear if switching to custom
                        }
                      }}
                      title={isCustomDepartment ? "Select from list" : "Create new department"}
                    >
                      {isCustomDepartment ? <Search className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Edit Salary Section */}
              <div className="border rounded-md p-4 bg-slate-50">
                <h4 className="font-semibold mb-3">Salary Details</h4>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="space-y-2">
                    <Label htmlFor="edit-ctc" className="text-blue-600 font-bold">Annual CTC</Label>
                    <Input id="ctc" type="number" value={formData.ctc} onChange={handleInputChange} className="border-blue-200 bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-salary">Monthly Income (Gross)</Label>
                    <Input id="salary" type="number" value={formData.salary} onChange={handleInputChange} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="edit-basicSalary" className="text-xs">Annual Basic</Label>
                    <Input id="basicSalary" type="number" value={formData.basicSalary} onChange={handleInputChange} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-hra" className="text-xs">Annual HRA</Label>
                    <Input id="hra" type="number" value={formData.hra} onChange={handleInputChange} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-otherAllowances" className="text-xs">Allowances</Label>
                    <Input id="otherAllowances" type="number" value={formData.otherAllowances} onChange={handleInputChange} className="h-8 text-sm" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-hireDate">Hire Date</Label>
                  <Input id="hireDate" type="date" value={formData.hireDate} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={formData.status} onValueChange={(val: string) => handleSelectChange('status', val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="On Leave">On Leave</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="contact" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input id="email" type="email" value={formData.email} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input id="phone" value={formData.phone} onChange={handleInputChange} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
          <div className="flex gap-2 pt-4">
            <Button onClick={handleUpdateEmployee}>Save Changes</Button>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}