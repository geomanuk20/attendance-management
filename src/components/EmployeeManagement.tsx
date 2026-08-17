import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
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
  Loader2,
  Check,
  X,
  Camera,
  Upload,
  ShieldCheck
} from 'lucide-react';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, getAttendance, getLeaveRequests } from '../services/api';
import { FaceCameraEnrollModal } from './FaceCameraEnrollModal';
import { ModernSpinner } from './ui/ModernSpinner';

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
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [selectedEmployeeForFace, setSelectedEmployeeForFace] = useState<any | null>(null);

  // Custom department management
  const [customDepartments, setCustomDepartments] = useState<string[]>([]);
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [newDeptInput, setNewDeptInput] = useState('');

  const defaultDepartments = ['Engineering', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Management', 'Logistics and Fulfillment'];
  const uniqueDepartments = Array.from(new Set([...defaultDepartments, ...customDepartments, ...employees.map(e => e.department)])).filter(Boolean).sort();

  const saveNewDept = () => {
    const trimmed = newDeptInput.trim();
    if (!trimmed) {
      toast.error('Please type a department name');
      return;
    }
    const existingMatch = uniqueDepartments.find(d => d.toLowerCase() === trimmed.toLowerCase());
    if (existingMatch) {
      setFormData(prev => ({ ...prev, department: existingMatch }));
      toast.info(`Department "${existingMatch}" selected`);
    } else {
      setCustomDepartments(prev => [...prev, trimmed]);
      setFormData(prev => ({ ...prev, department: trimmed }));
      toast.success(`Department "${trimmed}" created & selected!`);
    }
    setIsAddingDept(false);
    setNewDeptInput('');
  };

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
    employeeCode: '', // Employee ID
    salary: '', // Monthly Gross
    ctc: '', // Annual CTC
    basicSalary: '', // Annual Basic
    hra: '', // Annual HRA
    otherAllowances: '', // Annual Allowances
    hireDate: '',
    address: '',
    emergencyContact: '',
    status: 'Active',
    employmentType: 'Full-Time',
    faceImage: '' // Face ID Photo
  });

  // Check if a face image is a real uploaded photo (not empty or placeholder)
  const isValidFaceImage = (img: string | undefined | null): boolean => {
    if (!img || typeof img !== 'string') return false;
    const clean = img.trim();
    // Valid: real base64 data URI, http URL, or file URI
    if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('file://')) {
      return clean.length > 10;
    }
    if (clean.startsWith('data:image')) {
      return clean.length > 100;
    }
    return false;
  };

  const handleFaceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, faceImage: reader.result as string }));
        toast.success('Face ID photo uploaded!');
      };
      reader.readAsDataURL(file);
    }
  };

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

  const formatNumStr = (num: number) => {
    if (isNaN(num) || num <= 0) return '';
    const rounded = Math.round(num * 100) / 100;
    return Number.isInteger(rounded) ? String(Math.round(rounded)) : String(rounded);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;

    if (id === 'ctc') {
      const num = parseFloat(value);
      if (!isNaN(num) && num > 0) {
        // Support both LPA (e.g., 3.36) and full Rupees (e.g., 336000)
        const ctcAmount = num < 100 ? num * 100000 : num;
        const monthly = ctcAmount / 12;
        const basic = ctcAmount * 0.5;
        const hra = basic * 0.5;
        const allowances = ctcAmount - basic - hra;

        setFormData(prev => ({
          ...prev,
          ctc: value,
          salary: formatNumStr(monthly),
          basicSalary: formatNumStr(basic),
          hra: formatNumStr(hra),
          otherAllowances: formatNumStr(allowances)
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          ctc: value,
          salary: '',
          basicSalary: '',
          hra: '',
          otherAllowances: ''
        }));
      }
    } else if (id === 'salary') {
      const monthly = parseFloat(value);
      if (!isNaN(monthly) && monthly > 0) {
        const ctcAmount = monthly * 12;
        const basic = ctcAmount * 0.5;
        const hra = basic * 0.5;
        const allowances = ctcAmount - basic - hra;

        setFormData(prev => ({
          ...prev,
          salary: value,
          ctc: formatNumStr(ctcAmount),
          basicSalary: formatNumStr(basic),
          hra: formatNumStr(hra),
          otherAllowances: formatNumStr(allowances)
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          salary: value,
          ctc: '',
          basicSalary: '',
          hra: '',
          otherAllowances: ''
        }));
      }
    } else if (id === 'basicSalary') {
      const basic = parseFloat(value);
      if (!isNaN(basic) && basic > 0) {
        const hraVal = formData.hra ? parseFloat(formData.hra) : basic * 0.5;
        const allowVal = formData.otherAllowances ? parseFloat(formData.otherAllowances) : basic * 0.5;
        const totalCTC = basic + hraVal + allowVal;
        const monthly = totalCTC / 12;

        setFormData(prev => ({
          ...prev,
          basicSalary: value,
          hra: formatNumStr(hraVal),
          otherAllowances: formatNumStr(allowVal),
          ctc: formatNumStr(totalCTC),
          salary: formatNumStr(monthly)
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          basicSalary: value,
          ctc: '',
          salary: ''
        }));
      }
    } else if (id === 'hra') {
      const hra = parseFloat(value);
      if (!isNaN(hra) && hra > 0) {
        const basicVal = formData.basicSalary ? parseFloat(formData.basicSalary) : hra * 2;
        const allowVal = formData.otherAllowances ? parseFloat(formData.otherAllowances) : hra;
        const totalCTC = basicVal + hra + allowVal;
        const monthly = totalCTC / 12;

        setFormData(prev => ({
          ...prev,
          hra: value,
          basicSalary: formatNumStr(basicVal),
          otherAllowances: formatNumStr(allowVal),
          ctc: formatNumStr(totalCTC),
          salary: formatNumStr(monthly)
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          hra: value,
          ctc: '',
          salary: ''
        }));
      }
    } else if (id === 'otherAllowances') {
      const allowances = parseFloat(value);
      if (!isNaN(allowances) && allowances > 0) {
        const basicVal = formData.basicSalary ? parseFloat(formData.basicSalary) : allowances * 2;
        const hraVal = formData.hra ? parseFloat(formData.hra) : allowances;
        const totalCTC = basicVal + hraVal + allowances;
        const monthly = totalCTC / 12;

        setFormData(prev => ({
          ...prev,
          otherAllowances: value,
          basicSalary: formatNumStr(basicVal),
          hra: formatNumStr(hraVal),
          ctc: formatNumStr(totalCTC),
          salary: formatNumStr(monthly)
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          otherAllowances: value,
          ctc: '',
          salary: ''
        }));
      }
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
      employeeCode: '',
      salary: '',
      ctc: '',
      basicSalary: '',
      hra: '',
      otherAllowances: '',
      hireDate: '',
      address: '',
      emergencyContact: '',
      status: 'Active',
      employmentType: 'Full-Time',
      faceImage: ''
    });
    setIsCustomDepartment(false);
  };

  const handleAddEmployee = async () => {
    try {
      if (!formData.firstName || !formData.lastName || !formData.email) {
        toast.error('Please fill in required fields (First Name, Last Name, Email)');
        return;
      }

      const hireDateValid = formData.hireDate && !isNaN(new Date(formData.hireDate).getTime())
        ? formData.hireDate
        : new Date().toISOString().split('T')[0];

      const newEmployee = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        password: formData.password || 'welcome123',
        phone: formData.phone || '',
        position: formData.position || 'Software Engineer',
        department: (formData.department || 'Engineering').charAt(0).toUpperCase() + (formData.department || 'Engineering').slice(1),
        role: formData.role || 'employee',
        employeeCode: formData.employeeCode || `WTN ${Math.floor(100 + Math.random() * 900)}`,
        salary: Number(formData.salary) || 0,
        ctc: Number(formData.ctc) || 0,
        basicSalary: Number(formData.basicSalary) || 0,
        hra: Number(formData.hra) || 0,
        otherAllowances: Number(formData.otherAllowances) || 0,
        hireDate: hireDateValid,
        status: 'Active',
        employmentType: formData.employmentType || 'Full-Time',
        address: formData.address || '',
        emergencyContact: formData.emergencyContact || '',
        faceImage: formData.faceImage || ''
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

    const formattedDate = employee.hireDate ? new Date(employee.hireDate).toISOString().split('T')[0] : '';

    const ctcNum = Number(employee.ctc) || (employee.salary ? Number(employee.salary) * 12 : 0);
    const basicVal = employee.basicSalary ? formatNumStr(Number(employee.basicSalary)) : (ctcNum ? formatNumStr(ctcNum * 0.5) : '');
    const hraVal = employee.hra ? formatNumStr(Number(employee.hra)) : (ctcNum ? formatNumStr(ctcNum * 0.25) : '');
    const allowancesVal = employee.otherAllowances ? formatNumStr(Number(employee.otherAllowances)) : (ctcNum ? formatNumStr(ctcNum * 0.25) : '');
    const salaryVal = employee.salary ? formatNumStr(Number(employee.salary)) : (ctcNum ? formatNumStr(ctcNum / 12) : '');
    const ctcStr = employee.ctc ? formatNumStr(Number(employee.ctc)) : (ctcNum ? formatNumStr(ctcNum) : '');

    setFormData({
      firstName: firstName || '',
      lastName: lastName || '',
      email: employee.email,
      password: '',
      phone: employee.phone,
      position: employee.position,
      department: employee.department,
      role: employee.role || 'employee',
      employeeCode: employee.employeeCode || (employee._id ? `EMP-${employee._id.substring(0, 6).toUpperCase()}` : 'EMP-101'),
      salary: salaryVal,
      ctc: ctcStr,
      basicSalary: basicVal,
      hra: hraVal,
      otherAllowances: allowancesVal,
      hireDate: formattedDate,
      address: employee.address || '',
      emergencyContact: employee.emergencyContact || '',
      status: employee.status,
      employmentType: employee.employmentType || 'Full-Time',
      faceImage: employee.faceImage || ''
    });

    const isCustom = !defaultDepartments.includes(employee.department);
    setIsCustomDepartment(isCustom);

    setIsEditDialogOpen(true);
  };

  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) return;
    const empId = selectedEmployee._id || selectedEmployee.id;

    if (!empId) {
      toast.error('Cannot update: Employee ID is missing');
      return;
    }

    try {
      const updatedData = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        phone: formData.phone || '',
        position: formData.position,
        department: formData.department,
        role: formData.role || selectedEmployee.role || 'employee',
        faceImage: formData.faceImage !== undefined ? formData.faceImage : (selectedEmployee.faceImage || ''),
        employeeCode: formData.employeeCode || selectedEmployee.employeeCode || `EMP-${String(empId).substring(0, 6).toUpperCase()}`,
        salary: Number(formData.salary) || 0,
        ctc: Number(formData.ctc) || 0,
        basicSalary: Number(formData.basicSalary) || 0,
        hra: Number(formData.hra) || 0,
        otherAllowances: Number(formData.otherAllowances) || 0,
        hireDate: formData.hireDate || selectedEmployee.hireDate,
        address: formData.address || '',
        emergencyContact: formData.emergencyContact || '',
        status: formData.status || 'Active',
        employmentType: formData.employmentType || 'Full-Time'
      };

      await updateEmployee(empId, updatedData);
      
      if (updatedData.faceImage && updatedData.faceImage.length > 20) {
        try {
          localStorage.setItem('enrolledFaceProfile', JSON.stringify({
            _id: empId,
            id: empId,
            name: updatedData.name,
            email: updatedData.email,
            faceImage: updatedData.faceImage
          }));
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            const parsed = JSON.parse(storedUser);
            if ((parsed._id && String(parsed._id) === String(empId)) || (parsed.id && String(parsed.id) === String(empId))) {
              localStorage.setItem('user', JSON.stringify({ ...parsed, faceImage: updatedData.faceImage }));
            }
          }
        } catch {}
      }

      toast.success('Employee updated successfully');
      setIsEditDialogOpen(false);
      setSelectedEmployee(null);
      resetForm();
      fetchEmployees();
    } catch (error: any) {
      console.error('Error updating employee:', error);
      toast.error(error?.message || 'Failed to update employee');
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
    const nameStr = String(employee.name || '').toLowerCase();
    const emailStr = String(employee.email || '').toLowerCase();
    const posStr = String(employee.position || '').toLowerCase();
    const deptStr = String(employee.department || '').toLowerCase();
    const codeStr = String(employee.employeeCode || '').toLowerCase();
    const searchLower = searchTerm.trim().toLowerCase();

    const matchesSearch = !searchLower ||
      nameStr.includes(searchLower) ||
      emailStr.includes(searchLower) ||
      posStr.includes(searchLower) ||
      deptStr.includes(searchLower) ||
      codeStr.includes(searchLower);

    const matchesDepartment = selectedDepartment === 'all' ||
      String(employee.department || '').toLowerCase() === selectedDepartment.toLowerCase();

    const empAccountStatus = employee.status || 'Active';
    const matchesStatus = selectedStatus === 'all' ||
      String(empAccountStatus).toLowerCase() === selectedStatus.toLowerCase();

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
    return <ModernSpinner label="Loading Employee Directory..." size="lg" />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2>Employee Management</h2>
          <p className="text-muted-foreground">Manage employee profiles, information, and status</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            <DialogContent className="max-w-3xl w-[90vw] max-h-[88vh] flex flex-col p-0 rounded-2xl shadow-2xl border border-border bg-background overflow-hidden">
              <DialogHeader className="p-6 pb-4 border-b border-border shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
                <DialogTitle className="text-xl font-bold">Add New Employee</DialogTitle>
                <DialogDescription>
                  Enter the details of the new employee to add them to the system.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Face ID Photo Upload Section */}
                <div className="p-3.5 sm:p-4 bg-slate-950/40 dark:bg-slate-900/60 rounded-xl border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div
                      className="relative rounded-full overflow-hidden border-2 border-emerald-400/60 bg-slate-800 flex items-center justify-center shrink-0 shadow-inner"
                      style={{ width: '48px', height: '48px', minWidth: '48px', minHeight: '48px', borderRadius: '9999px', aspectRatio: '1/1' }}
                    >
                      {formData.faceImage ? (
                        <img src={formData.faceImage} alt="Face ID Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-400">
                        <ShieldCheck className="h-4 w-4 shrink-0" />
                        Biometric Face ID Photo
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate sm:whitespace-normal">
                        {formData.faceImage ? '✓ Face Photo Attached & Ready (Face ID Active)' : 'Upload photo for face recognition attendance'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setIsCameraModalOpen(true)}
                      className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      {formData.faceImage ? 'Recapture Face' : 'Capture Face Photo'}
                    </Button>
                    {formData.faceImage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-rose-400 hover:text-rose-300"
                        onClick={() => setFormData(prev => ({ ...prev, faceImage: '' }))}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="grid grid-cols-3 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="employmentType" className="text-emerald-600 font-semibold">Employment Type</Label>
                    <Select onValueChange={(val: string) => handleSelectChange('employmentType', val)} value={formData.employmentType || 'Full-Time'}>
                      <SelectTrigger className="border-emerald-200 bg-emerald-50/30">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Full-Time">💼 Full-Time</SelectItem>
                        <SelectItem value="Part-Time">⏱️ Part-Time</SelectItem>
                        <SelectItem value="Hybrid">🏢 Hybrid</SelectItem>
                        <SelectItem value="Remote">🌐 Remote</SelectItem>
                        <SelectItem value="Contract">📄 Contract</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeeCode" className="text-indigo-600 font-semibold flex items-center gap-1">
                    🆔 Employee ID / Code
                  </Label>
                  <Input
                    id="employeeCode"
                    placeholder="e.g. EMP-101 or WS-2026 (Optional)"
                    value={formData.employeeCode}
                    onChange={handleInputChange}
                    className="bg-indigo-50/50 border-indigo-200 font-mono font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="position">Position</Label>
                    <Input id="position" placeholder="Job title" value={formData.position} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <div className="flex gap-2 items-center">
                      {isAddingDept ? (
                        <div className="flex gap-2 items-center flex-1">
                          <Input
                            placeholder="Type new department name..."
                            value={newDeptInput}
                            onChange={(e) => setNewDeptInput(e.target.value)}
                            className="flex-1 h-9 text-sm border-primary focus:ring-1 focus:ring-primary"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                saveNewDept();
                              } else if (e.key === 'Escape') {
                                setIsAddingDept(false);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-9 px-3 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold gap-1 shrink-0"
                            onClick={saveNewDept}
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Add</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 px-2 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setIsAddingDept(false);
                              setNewDeptInput('');
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Select
                            onValueChange={(val: string) => {
                              if (val === '__ADD_NEW__') {
                                setIsAddingDept(true);
                              } else {
                                handleSelectChange('department', val);
                              }
                            }}
                            value={formData.department}
                          >
                            <SelectTrigger className="flex-1 h-9">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                              {uniqueDepartments.map(dept => (
                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                              ))}
                              <SelectItem value="__ADD_NEW__" className="text-primary font-semibold text-xs border-t mt-1 pt-1">
                                + Add New Department...
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setIsAddingDept(true)}
                            title="Add new department"
                            className="h-9 w-9 shrink-0 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Plus className="h-4 w-4 text-primary" />
                          </Button>
                        </>
                      )}
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
              </div>

              <DialogFooter className="p-4 sm:p-5 border-t border-border shrink-0 bg-slate-50/50 dark:bg-slate-900/50 flex flex-row gap-3 justify-end items-center">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddEmployee} className="px-6 font-semibold">Add Employee</Button>
              </DialogFooter>
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
                <TableHead>Face ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                        {employee.faceImage ? (
                          <img src={employee.faceImage} alt={employee.name} className="w-full h-full object-cover" />
                        ) : (
                          <AvatarFallback className="bg-slate-800 text-slate-200 font-bold">
                            {employee.name.split(' ').map((n: string) => n[0]).join('')}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{employee.name}</p>
                          {isValidFaceImage(employee.faceImage) && (
                            <span title="Biometric Face ID Enrolled">
                              <ShieldCheck className="h-4 w-4 text-emerald-400" />
                            </span>
                          )}
                          <span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                            {employee.employeeCode || (employee._id ? `EMP-${employee._id.substring(0, 6).toUpperCase()}` : 'EMP-101')}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {employee.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium text-xs">{employee.position}</p>
                      <Badge variant="outline" className="text-[10px] py-0.5 px-2 font-semibold leading-none bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700">
                        {employee.employmentType || 'Full-Time'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell>{formatDate(employee.hireDate)}</TableCell>
                  <TableCell>{formatCurrency(employee.salary || (employee.ctc ? employee.ctc / 12 : 0))}</TableCell>
                  <TableCell>{formatCurrency(employee.ctc || (employee.salary ? employee.salary * 12 : 0))}</TableCell>
                  <TableCell>
                    {isValidFaceImage(employee.faceImage) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmployeeForFace(employee);
                          setIsCameraModalOpen(true);
                        }}
                        title="Click to update Face ID photo"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-700 transition-colors cursor-pointer"
                      >
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                        Enrolled
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmployeeForFace(employee);
                          setIsCameraModalOpen(true);
                        }}
                        title="Click to open camera and enroll Face ID"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-300 dark:border-amber-700 transition-colors cursor-pointer shadow-xs"
                      >
                        <Camera className="h-3.5 w-3.5 text-amber-600" />
                        Enroll Face
                      </button>
                    )}
                  </TableCell>
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
        <DialogContent className="max-w-3xl w-[90vw] max-h-[88vh] flex flex-col p-0 rounded-2xl shadow-2xl border border-border bg-background overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-border shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
            <DialogTitle className="text-xl font-bold">Edit Employee Details</DialogTitle>
            <DialogDescription>
              View and edit employee information.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="grid grid-cols-1 sm:grid-cols-3 w-full h-auto p-1 bg-muted/60 rounded-xl gap-1 mb-4">
                <TabsTrigger value="personal" className="py-2 text-xs sm:text-sm font-semibold">Personal Info</TabsTrigger>
                <TabsTrigger value="employment" className="py-2 text-xs sm:text-sm font-semibold">Employment & Salary</TabsTrigger>
                <TabsTrigger value="contact" className="py-2 text-xs sm:text-sm font-semibold">Contact</TabsTrigger>
              </TabsList>
              <TabsContent value="personal" className="space-y-4 mt-0">
                {/* Face ID Photo Upload Section */}
                <div className="p-3.5 sm:p-4 bg-slate-950/40 dark:bg-slate-900/60 rounded-xl border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div
                      className="relative rounded-full overflow-hidden border-2 border-emerald-400/60 bg-slate-800 flex items-center justify-center shrink-0 shadow-inner"
                      style={{ width: '48px', height: '48px', minWidth: '48px', minHeight: '48px', borderRadius: '9999px', aspectRatio: '1/1' }}
                    >
                      {formData.faceImage ? (
                        <img src={formData.faceImage} alt="Face ID Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-400">
                        <ShieldCheck className="h-4 w-4 shrink-0" />
                        Biometric Face ID Photo
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate sm:whitespace-normal">
                        {formData.faceImage ? '✓ Face Photo Enrolled & Saved (Face ID Active)' : 'Upload photo for face recognition attendance'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <label className="cursor-pointer">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer">
                        <Upload className="h-3.5 w-3.5" />
                        {formData.faceImage ? 'Change Photo' : 'Upload Photo'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFaceImageUpload}
                      />
                    </label>
                    {formData.faceImage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-rose-400 hover:text-rose-300"
                        onClick={() => setFormData(prev => ({ ...prev, faceImage: '' }))}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="edit-employeeCode" className="text-indigo-600 font-semibold flex items-center gap-1">
                  🆔 Employee ID / Code
                </Label>
                <Input
                  id="employeeCode"
                  placeholder="e.g. EMP-101 or WS-2026"
                  value={formData.employeeCode}
                  onChange={handleInputChange}
                  className="bg-indigo-50/50 border-indigo-200 font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-position">Position</Label>
                  <Input id="position" value={formData.position} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-department">Department</Label>
                  <div className="flex gap-2 items-center">
                    {isAddingDept ? (
                      <div className="flex gap-2 items-center flex-1">
                        <Input
                          placeholder="Type new department name..."
                          value={newDeptInput}
                          onChange={(e) => setNewDeptInput(e.target.value)}
                          className="flex-1 h-9 text-sm border-primary focus:ring-1 focus:ring-primary"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              saveNewDept();
                            } else if (e.key === 'Escape') {
                              setIsAddingDept(false);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 px-3 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold gap-1 shrink-0"
                          onClick={saveNewDept}
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Add</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 px-2 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setIsAddingDept(false);
                            setNewDeptInput('');
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Select
                          onValueChange={(val: string) => {
                            if (val === '__ADD_NEW__') {
                              setIsAddingDept(true);
                            } else {
                              handleSelectChange('department', val);
                            }
                          }}
                          value={formData.department}
                        >
                          <SelectTrigger className="flex-1 h-9">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {uniqueDepartments.map(dept => (
                              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                            ))}
                            <SelectItem value="__ADD_NEW__" className="text-primary font-semibold text-xs border-t mt-1 pt-1">
                              + Add New Department...
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setIsAddingDept(true)}
                          title="Add new department"
                          className="h-9 w-9 shrink-0 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Plus className="h-4 w-4 text-primary" />
                        </Button>
                      </>
                    )}
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
                    <Label htmlFor="edit-salary" className="text-indigo-600 font-bold">Monthly Gross Salary</Label>
                    <Input id="salary" type="number" value={formData.salary} onChange={handleInputChange} className="border-indigo-200 bg-white font-semibold" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <Label htmlFor="edit-basicSalary" className="text-xs">Basic (Annual)</Label>
                    <Input id="basicSalary" type="number" value={formData.basicSalary} onChange={handleInputChange} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label htmlFor="edit-hra" className="text-xs">HRA (Annual)</Label>
                    <Input id="hra" type="number" value={formData.hra} onChange={handleInputChange} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label htmlFor="edit-otherAllowances" className="text-xs">Allowances (Annual)</Label>
                    <Input id="otherAllowances" type="number" value={formData.otherAllowances} onChange={handleInputChange} className="h-8 text-xs" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
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
                <div className="space-y-2">
                  <Label htmlFor="edit-employmentType" className="text-emerald-600 font-semibold">Employment Type</Label>
                  <Select value={formData.employmentType || 'Full-Time'} onValueChange={(val: string) => handleSelectChange('employmentType', val)}>
                    <SelectTrigger className="border-emerald-200 bg-emerald-50/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full-Time">💼 Full-Time</SelectItem>
                      <SelectItem value="Part-Time">⏱️ Part-Time</SelectItem>
                      <SelectItem value="Hybrid">🏢 Hybrid</SelectItem>
                      <SelectItem value="Remote">🌐 Remote</SelectItem>
                      <SelectItem value="Contract">📄 Contract</SelectItem>
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
        </div>

          <DialogFooter className="p-4 sm:p-5 border-t border-border shrink-0 bg-slate-50/50 dark:bg-slate-900/50 flex flex-row gap-3 justify-end items-center">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateEmployee} className="px-6 font-semibold">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Face Camera Capture Modal */}
      <FaceCameraEnrollModal
        isOpen={isCameraModalOpen}
        onClose={() => {
          setIsCameraModalOpen(false);
          setSelectedEmployeeForFace(null);
        }}
        onCapture={async (dataUrl) => {
          if (selectedEmployeeForFace) {
            const empId = selectedEmployeeForFace._id || selectedEmployeeForFace.id;
            try {
              await updateEmployee(empId, { faceImage: dataUrl });
              toast.success(`✅ Face ID captured & saved for ${selectedEmployeeForFace.name}!`);
              fetchEmployees();
            } catch (err: any) {
              toast.error(err.message || 'Failed to update face photo');
            } finally {
              setSelectedEmployeeForFace(null);
            }
          } else {
            setFormData(prev => ({ ...prev, faceImage: dataUrl }));
            toast.success('Face photo captured from camera!');
          }
        }}
        userName={selectedEmployeeForFace ? selectedEmployeeForFace.name : (formData.firstName ? `${formData.firstName} ${formData.lastName}` : 'Employee')}
      />
    </div>
  );
}