import { useState, useEffect, useRef } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Download, Send, Calculator, Search, Calendar as CalendarIcon, Loader2, ChevronRight, X, Edit2, Save, Mail, CheckSquare } from 'lucide-react';
import { getEmployees, getPayroll, createPayroll } from '../services/api';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface SalaryProps {
  currency?: string;
}

export function Salary({ currency = 'USD' }: SalaryProps) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  // Dialog State
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const slipRef = useRef<HTMLDivElement>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  // Edit Values State
  const [editValues, setEditValues] = useState({
    basicSalary: 0,
    hra: 0,
    otherAllowances: 0,
    overtime: 0,
    bonus: 0,
    deductions: 0,
    status: 'Pending'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empData, payrollData] = await Promise.all([
        getEmployees(),
        getPayroll(selectedMonth)
      ]);

      setEmployees(empData);
      setPayrollRecords(payrollData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  // Merge employees with payroll records
  const combinedData = Array.isArray(employees) ? employees.map(emp => {
    const payroll = Array.isArray(payrollRecords) ? payrollRecords.find(p => (p.employeeId?._id || p.employeeId) === emp._id) : undefined;

    // Base data structure from Employee record (defaults)
    const defaultBasic = emp.basicSalary || (emp.salary ? emp.salary * 0.5 : 0);
    const defaultHra = emp.hra || (emp.salary ? emp.salary * 0.25 : 0);
    const defaultAllowances = emp.otherAllowances || (emp.salary ? emp.salary * 0.25 : 0);

    const baseData = {
      employeeId: emp._id,
      name: emp.name,
      department: emp.department,
      position: emp.position,
      basicSalary: defaultBasic,
      hra: defaultHra,
      otherAllowances: defaultAllowances,
      ctc: emp.ctc || 0,
      baseSalary: emp.salary || 0,
    };

    if (payroll) {
      return {
        ...baseData,
        ...payroll,
        basicSalary: payroll.basicSalary !== undefined ? payroll.basicSalary : baseData.basicSalary,
        hra: payroll.hra !== undefined ? payroll.hra : baseData.hra,
        otherAllowances: payroll.otherAllowances !== undefined ? payroll.otherAllowances : baseData.otherAllowances,
        baseSalary: payroll.baseSalary,
        isSaved: true
      };
    }

    // Draft data (Pending)
    return {
      ...baseData,
      overtime: 0,
      bonus: 0,
      deductions: 0,
      netSalary: baseData.baseSalary,
      status: 'Pending',
      isSaved: false
    };
  }) : [];

  const handleProcessIndividual = async (record: any) => {
    try {
      const payload = {
        employeeId: record.employeeId,
        month: selectedMonth,
        baseSalary: Number(record.baseSalary),
        basicSalary: Number(record.basicSalary),
        hra: Number(record.hra),
        otherAllowances: Number(record.otherAllowances),
        overtime: Number(record.overtime),
        bonus: Number(record.bonus),
        deductions: Number(record.deductions),
        netSalary: Number(record.netSalary),
        status: 'Paid'
      };

      await createPayroll(payload);

      toast.success(`Processed payroll for ${record.name}`);
      fetchData();
      if (setIsDetailsOpen) setIsDetailsOpen(false); // Check if function exists to avoid error if passed as prop
    } catch (error) {
      console.error('Error processing individual payroll:', error);
      toast.error('Failed to process payroll');
    }
  };

  const handleProcessPayroll = async () => {
    try {
      const pendingRecords = combinedData.filter(d => d.status === 'Pending');

      if (pendingRecords.length === 0) {
        toast.info('No pending records to process');
        return;
      }

      const promises = pendingRecords.map(record => {
        const payload = {
          employeeId: record.employeeId,
          month: selectedMonth,
          baseSalary: Number(record.baseSalary),
          basicSalary: Number(record.basicSalary),
          hra: Number(record.hra),
          otherAllowances: Number(record.otherAllowances),
          overtime: Number(record.overtime),
          bonus: Number(record.bonus),
          deductions: Number(record.deductions),
          netSalary: Number(record.netSalary),
          status: 'Paid'
        };
        return createPayroll(payload);
      });

      await Promise.all(promises);
      toast.success(`Processed payroll for ${pendingRecords.length} employees`);
      fetchData();
    } catch (error) {
      console.error('Error processing payroll:', error);
      toast.error('Failed to process payroll');
    }
  };

  const handleProcessSelected = async () => {
    if (selectedEmployeeIds.length === 0) return;

    try {
      // Find records that are selected AND pending
      const selectedRecords = combinedData.filter(d =>
        selectedEmployeeIds.includes(d.employeeId) && d.status === 'Pending'
      );

      if (selectedRecords.length === 0) {
        toast.info('No pending records selected');
        return;
      }

      const promises = selectedRecords.map(record => {
        const payload = {
          employeeId: record.employeeId,
          month: selectedMonth,
          baseSalary: Number(record.baseSalary),
          basicSalary: Number(record.basicSalary),
          hra: Number(record.hra),
          otherAllowances: Number(record.otherAllowances),
          overtime: Number(record.overtime),
          bonus: Number(record.bonus),
          deductions: Number(record.deductions),
          netSalary: Number(record.netSalary),
          status: 'Paid'
        };
        return createPayroll(payload);
      });

      await Promise.all(promises);
      toast.success(`Processed payroll for ${selectedRecords.length} selected employees`);
      setSelectedEmployeeIds([]); // Clear selection
      fetchData();
    } catch (error) {
      console.error('Error processing selected payroll:', error);
      toast.error('Failed to process selected payroll');
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all PENDING records
      const pendingIds = combinedData
        .filter(d => d.status === 'Pending')
        .map(d => d.employeeId);
      setSelectedEmployeeIds(pendingIds);
    } else {
      setSelectedEmployeeIds([]);
    }
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployeeIds(prev => [...prev, id]);
    } else {
      setSelectedEmployeeIds(prev => prev.filter(empId => empId !== id));
    }
  };

  const filteredData = combinedData.filter(record => {
    const matchesSearch = record.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = selectedDepartment === 'all' || record.department === selectedDepartment;
    const matchesStatus = selectedStatus === 'all' || record.status === selectedStatus;
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const totalPayroll = combinedData.reduce((sum, record) => sum + (record.netSalary || 0), 0);
  const paidAmount = combinedData.filter(r => r.status === 'Paid').reduce((sum, record) => sum + (record.netSalary || 0), 0);
  const pendingAmount = combinedData.filter(r => r.status === 'Pending').reduce((sum, record) => sum + (record.netSalary || 0), 0);

  const paidCount = combinedData.filter(r => r.status === 'Paid').length;
  const pendingCount = combinedData.filter(r => r.status === 'Pending').length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid':
        return <Badge style={{ backgroundColor: '#10B981', color: '#ffffff' }} className="hover:bg-green-600">Paid</Badge>;
      case 'Pending':
        return <Badge style={{ backgroundColor: '#F9A825', color: '#ffffff' }} className="hover:bg-yellow-600">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleViewDetails = (record: any) => {
    setSelectedRecord(record);
    setEditValues({
      basicSalary: record.basicSalary || 0,
      hra: record.hra || 0,
      otherAllowances: record.otherAllowances || 0,
      overtime: record.overtime || 0,
      bonus: record.bonus || 0,
      deductions: record.deductions || 0,
      status: record.status || 'Pending'
    });
    setIsEditing(false);
    setIsDetailsOpen(true);
  };

  const handleSaveChanges = async () => {
    if (!selectedRecord) return;

    try {
      const updatedRecord = {
        ...selectedRecord,
        ...editValues,
        // Recalculate Net Salary based on NEW values
        baseSalary: Number(editValues.basicSalary) + Number(editValues.hra) + Number(editValues.otherAllowances), // Re-sum Gross
        netSalary: (Number(editValues.basicSalary) + Number(editValues.hra) + Number(editValues.otherAllowances)) +
          Number(editValues.overtime) +
          Number(editValues.bonus) -
          Number(editValues.deductions)
      };

      await createPayroll({
        employeeId: updatedRecord.employeeId,
        month: selectedMonth,
        baseSalary: updatedRecord.baseSalary,
        basicSalary: editValues.basicSalary,
        hra: editValues.hra,
        otherAllowances: editValues.otherAllowances,
        overtime: editValues.overtime,
        bonus: editValues.bonus,
        deductions: editValues.deductions,
        netSalary: updatedRecord.netSalary,
        status: editValues.status
      });

      toast.success('Salary details updated');
      setIsEditing(false);
      setIsDetailsOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating salary:', error);
      toast.error('Failed to update salary details');
    }
  };

  const handleDownloadPDF = async () => {
    if (!slipRef.current || !selectedRecord) return;

    try {
      const canvas = await html2canvas(slipRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${selectedRecord.name}_Payslip_${selectedMonth}.pdf`);
      toast.success('PDF Downloaded');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handleEmailSlip = async () => {
    if (!selectedRecord) return;
    try {
      setEmailLoading(true);
      const response = await fetch('http://localhost:5001/api/email/send-payslip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: selectedRecord.employeeId,
          month: selectedMonth,
          salaryDetails: {
            basicSalary: formatCurrency(selectedRecord.basicSalary || 0),
            hra: formatCurrency(selectedRecord.hra || 0),
            otherAllowances: formatCurrency(selectedRecord.otherAllowances || 0),
            overtime: formatCurrency(selectedRecord.overtime || 0),
            bonus: formatCurrency(selectedRecord.bonus || 0),
            deductions: formatCurrency(selectedRecord.deductions || 0),
            netSalary: formatCurrency(selectedRecord.netSalary || 0),
          }
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Payslip emailed successfully');
      } else {
        toast.error(data.message || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to connect to email server');
    } finally {
      setEmailLoading(false);
    }
  };

  // Preview Calculation during Edit
  const calculatedGross =
    (isEditing ? Number(editValues.basicSalary) : (selectedRecord?.basicSalary || 0)) +
    (isEditing ? Number(editValues.hra) : (selectedRecord?.hra || 0)) +
    (isEditing ? Number(editValues.otherAllowances) : (selectedRecord?.otherAllowances || 0));

  const calculatedNetSalary =
    calculatedGross +
    (isEditing ? Number(editValues.overtime) : (selectedRecord?.overtime || 0)) +
    (isEditing ? Number(editValues.bonus) : (selectedRecord?.bonus || 0)) -
    (isEditing ? Number(editValues.deductions) : (selectedRecord?.deductions || 0));

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Unique Departments for Filtering
  const uniqueDepartments = Array.from(new Set(combinedData.map(item => item.department).filter(Boolean)));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>Salary Management</h2>
          <p className="text-muted-foreground">Manage employee salaries and payroll processing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => {/* Logic for calculate could go here */ }}>
            <Calculator className="h-4 w-4" />
            Calculate
          </Button>
          {selectedEmployeeIds.length > 0 && (
            <Button className="gap-2" style={{ backgroundColor: '#2563eb', color: 'white' }} onClick={handleProcessSelected}>
              <CheckSquare className="h-4 w-4" />
              Process Selected ({selectedEmployeeIds.length})
            </Button>
          )}
          <Button className="gap-2" style={{ backgroundColor: '#16a34a', color: 'white' }} onClick={handleProcessPayroll}>
            <Send className="h-4 w-4" />
            Process All Pending
          </Button>
        </div>
      </div>


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

          <div className="relative">
            <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-40 pl-9"
            />
          </div>

          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {uniqueDepartments.sort().map((dept: any) => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <h3 className="mb-4">Employee Salary Details</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={
                      combinedData.some(d => d.status === 'Pending') &&
                      combinedData.filter(d => d.status === 'Pending').every(d => selectedEmployeeIds.includes(d.employeeId))
                    }
                    onCheckedChange={(checked) => toggleSelectAll(checked as boolean)}
                    aria-label="Select all pending"
                    disabled={!combinedData.some(d => d.status === 'Pending')}
                  />
                </TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Basic Salary</TableHead>
                <TableHead>Gross Salary</TableHead>
                <TableHead>Additions</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Monthly Payout</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length > 0 ? (
                filteredData.map((record, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Checkbox
                        checked={selectedEmployeeIds.includes(record.employeeId)}
                        onCheckedChange={(checked) => toggleSelectOne(record.employeeId, checked as boolean)}
                        disabled={record.status === 'Paid'} // Disable if already paid
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                          <span className="text-primary-foreground text-xs">
                            {record.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{record.name}</p>
                          <p className="text-xs text-muted-foreground">{record.department}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{record.position}</TableCell>
                    <TableCell>{formatCurrency(record.basicSalary)}</TableCell>
                    <TableCell>{formatCurrency(record.baseSalary)}</TableCell>
                    <TableCell className="text-green-600">+{formatCurrency((record.overtime || 0) + (record.bonus || 0))}</TableCell>
                    <TableCell className="text-red-600">-{formatCurrency(record.deductions || 0)}</TableCell>
                    <TableCell className="font-bold">{formatCurrency(record.netSalary)}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {record.status === 'Pending' && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProcessIndividual(record);
                            }}
                            className="bg-green-600 hover:bg-green-700 h-8"
                          >
                            Pay
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(record)}>
                          View Details <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No salary records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Salary Details</DialogTitle>
            <DialogDescription>
              Breakdown for {selectedRecord?.name} - {new Date(selectedMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4 py-2" ref={slipRef}>
              {/* Additions Section */}
              <div className="space-y-2">
                <div className="flex justify-between items-center hide-on-print">
                  <h4 className="text-sm font-semibold text-green-700 uppercase tracking-wider">Earnings</h4>
                  {!isEditing && (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="h-6 px-2 text-green-700 hover:bg-green-100 hover:text-green-800">
                      <Edit2 className="h-3 w-3 mr-1" /> Edit
                    </Button>
                  )}
                </div>
                <div className="bg-green-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-600">Basic Salary</span>
                    {isEditing ? (
                      <Input
                        type="number"
                        className="h-7 w-24 text-right"
                        value={editValues.basicSalary}
                        onChange={(e) => setEditValues({ ...editValues, basicSalary: Number(e.target.value) })}
                      />
                    ) : (
                      <span className="font-medium">{formatCurrency(selectedRecord.basicSalary)}</span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-600">HRA</span>
                    {isEditing ? (
                      <Input
                        type="number"
                        className="h-7 w-24 text-right"
                        value={editValues.hra}
                        onChange={(e) => setEditValues({ ...editValues, hra: Number(e.target.value) })}
                      />
                    ) : (
                      <span className="font-medium">{formatCurrency(selectedRecord.hra)}</span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-600">Allowances</span>
                    {isEditing ? (
                      <Input
                        type="number"
                        className="h-7 w-24 text-right"
                        value={editValues.otherAllowances}
                        onChange={(e) => setEditValues({ ...editValues, otherAllowances: Number(e.target.value) })}
                      />
                    ) : (
                      <span className="font-medium">{formatCurrency(selectedRecord.otherAllowances)}</span>
                    )}
                  </div>

                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-600">Overtime</span>
                    {isEditing ? (
                      <Input
                        type="number"
                        className="h-7 w-24 text-right"
                        value={editValues.overtime}
                        onChange={(e) => setEditValues({ ...editValues, overtime: Number(e.target.value) })}
                      />
                    ) : (
                      <span className={`font-medium ${selectedRecord.overtime > 0 ? 'text-green-600' : ''}`}>
                        +{formatCurrency(selectedRecord.overtime || 0)}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-600">Bonus / Incentive</span>
                    {isEditing ? (
                      <Input
                        type="number"
                        className="h-7 w-24 text-right"
                        value={editValues.bonus}
                        onChange={(e) => setEditValues({ ...editValues, bonus: Number(e.target.value) })}
                      />
                    ) : (
                      <span className={`font-medium ${selectedRecord.bonus > 0 ? 'text-green-600' : ''}`}>
                        +{formatCurrency(selectedRecord.bonus || 0)}
                      </span>
                    )}
                  </div>


                  <div className="border-t border-green-200 pt-2 mt-2 flex justify-between font-bold">
                    <span>Gross Earnings</span>
                    <span>{formatCurrency(calculatedGross + (isEditing ? editValues.overtime : (selectedRecord.overtime || 0)) + (isEditing ? editValues.bonus : (selectedRecord.bonus || 0)))}</span>
                  </div>
                </div>
              </div>

              {/* Deductions Section */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-red-700 uppercase tracking-wider">Deductions</h4>
                <div className="bg-red-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-600">Tax / Deductions</span>
                    {isEditing ? (
                      <Input
                        type="number"
                        className="h-7 w-24 text-right"
                        value={editValues.deductions}
                        onChange={(e) => setEditValues({ ...editValues, deductions: Number(e.target.value) })}
                      />
                    ) : (
                      <span className="font-medium text-red-600">-{formatCurrency(selectedRecord.deductions)}</span>
                    )}
                  </div>
                  <div className="border-t border-red-200 pt-2 mt-2 flex justify-between font-bold text-red-700">
                    <span>Total Deductions</span>
                    <span>-{formatCurrency(isEditing ? editValues.deductions : selectedRecord.deductions)}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay */}
              <div className="bg-slate-900 text-white p-4 rounded-lg flex justify-between items-center shadow-lg">
                <div>
                  <p className="text-xs text-slate-400">Net Pay</p>
                  <h3 className="text-xl font-bold">{formatCurrency(calculatedNetSalary)}</h3>
                </div>
                <Badge variant="outline" className={`bg-white/10 text-white border-0 ${selectedRecord.status === 'Paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {selectedRecord.status}
                </Badge>
              </div>

              {/* Status Edit - Only visible in Edit Mode */}
              {isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Payment Status</Label>
                  <Select
                    value={editValues.status}
                    onValueChange={(val) => setEditValues({ ...editValues, status: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <DialogFooter className={`gap-2 sm:gap-0 ${isEditing ? '' : 'sm:justify-between'}`}>
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={handleSaveChanges}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleDownloadPDF}>
                    <Download className="h-4 w-4 mr-2" /> Download PDF
                  </Button>
                  <Button variant="outline" onClick={handleEmailSlip} disabled={emailLoading}>
                    {emailLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                    Email Slip
                  </Button>
                </div>
                <div className="flex gap-2">
                  {selectedRecord?.status === 'Pending' && (
                    <Button onClick={() => handleProcessIndividual(selectedRecord)} className="bg-green-600 hover:bg-green-700">
                      Process Payroll
                    </Button>
                  )}
                  <Button onClick={() => setIsDetailsOpen(false)}>Close</Button>
                </div>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}