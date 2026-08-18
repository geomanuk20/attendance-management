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
import { getEmployees, getPayroll, createPayroll, updateEmployee } from '../services/api';
import { toast } from 'sonner';
import { ModernSpinner } from './ui/ModernSpinner';
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
    advance: 0,
    status: 'Pending'
  });

  // Calculator Popup State
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [calcEmpId, setCalcEmpId] = useState('custom');
  const [calcBaseSalary, setCalcBaseSalary] = useState<number>(25000);
  const [calcTotalDays, setCalcTotalDays] = useState<number>(26);
  const [calcWorkedDays, setCalcWorkedDays] = useState<number>(26);
  const [calcOvertimeHours, setCalcOvertimeHours] = useState<number>(0);
  const [calcOvertimeRate, setCalcOvertimeRate] = useState<number>(150);
  const [calcBonus, setCalcBonus] = useState<number>(0);
  const [calcDeductions, setCalcDeductions] = useState<number>(0);
  const [calcAdvance, setCalcAdvance] = useState<number>(0);

  const handleSelectCalcEmployee = (empId: string) => {
    setCalcEmpId(empId);
    if (empId === 'custom') return;
    const emp = combinedData.find(e => e.employeeId === empId || e._id === empId);
    if (emp) {
      const gross = emp.salary || emp.baseSalary || ((emp.basicSalary || 0) + (emp.hra || 0) + (emp.otherAllowances || 0)) || 25000;
      setCalcBaseSalary(gross);
      setCalcDeductions(emp.deductions || 0);
      setCalcAdvance(emp.advance || 0);
      setCalcOvertimeHours(emp.overtime || 0);
      setCalcBonus(emp.bonus || 0);
    }
  };

  // Calculator Derived Values
  const safeTotalDays = calcTotalDays > 0 ? calcTotalDays : 26;
  const calcDailyWage = calcBaseSalary / safeTotalDays;
  const calcEarnedBase = calcDailyWage * Math.min(calcWorkedDays, safeTotalDays);
  const calcOvertimePay = calcOvertimeHours * calcOvertimeRate;
  const calcTotalEarnings = calcEarnedBase + calcOvertimePay + calcBonus;
  const calcTotalDeductions = calcDeductions + calcAdvance;
  const calcEstimatedNet = Math.max(0, calcTotalEarnings - calcTotalDeductions);

  const handleApplyAndSaveSalary = async () => {
    if (calcEmpId === 'custom') {
      toast.error('Please select an employee from the dropdown above to save their salary details');
      return;
    }

    const emp = combinedData.find(e => e.employeeId === calcEmpId || e._id === calcEmpId);
    if (!emp) {
      toast.error('Selected employee record not found');
      return;
    }

    try {
      const payload = {
        employeeId: emp.employeeId,
        month: selectedMonth,
        baseSalary: Number(calcBaseSalary),
        basicSalary: Number(calcBaseSalary * 0.5),
        hra: Number(calcBaseSalary * 0.25),
        otherAllowances: Number(calcBaseSalary * 0.25),
        overtime: Number(calcOvertimePay),
        bonus: Number(calcBonus),
        deductions: Number(calcDeductions),
        advance: Number(calcAdvance),
        netSalary: Number(Math.round(calcEstimatedNet)),
        status: emp.status || 'Pending'
      };

      await createPayroll(payload);
      toast.success(`Calculated salary of ₹${Math.round(calcEstimatedNet).toLocaleString('en-IN')} saved for ${emp.name}!`);
      setIsCalcOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving calculated salary:', error);
      toast.error('Failed to save calculated salary');
    }
  };

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

    // Monthly gross determination
    const rawGross = emp.salary || (emp.ctc ? emp.ctc / 12 : 0) || (payroll?.baseSalary || 0);

    // Convert Annual Basic/HRA/Allowances to Monthly figures for the monthly table if > rawGross
    let monthlyBasic = emp.basicSalary ? (emp.basicSalary > rawGross && rawGross > 0 ? emp.basicSalary / 12 : emp.basicSalary) : (rawGross * 0.5);
    let monthlyHra = emp.hra ? (emp.hra > rawGross && rawGross > 0 ? emp.hra / 12 : emp.hra) : (rawGross * 0.25);
    let monthlyAllowances = emp.otherAllowances ? (emp.otherAllowances > rawGross && rawGross > 0 ? emp.otherAllowances / 12 : emp.otherAllowances) : (rawGross * 0.25);

    const monthlyGross = Math.round(rawGross || (monthlyBasic + monthlyHra + monthlyAllowances));
    monthlyBasic = Math.round(monthlyBasic || (monthlyGross * 0.5));
    monthlyHra = Math.round(monthlyHra || (monthlyGross * 0.25));
    monthlyAllowances = Math.round(monthlyAllowances || (monthlyGross * 0.25));

    const overtime = Math.round(payroll?.overtime || 0);
    const bonus = Math.round(payroll?.bonus || 0);
    const deductions = Math.round(payroll?.deductions || 0);
    const advance = Math.round(payroll?.advance || 0);
    const netPayout = Math.max(0, monthlyGross + overtime + bonus - deductions - advance);

    const baseData = {
      employeeId: emp._id,
      name: emp.name,
      department: emp.department,
      position: emp.position,
      basicSalary: monthlyBasic,
      hra: monthlyHra,
      otherAllowances: monthlyAllowances,
      ctc: emp.ctc || (monthlyGross * 12),
      baseSalary: monthlyGross,
      overtime: 0,
      bonus: 0,
      deductions: 0,
      advance: 0,
      netSalary: monthlyGross,
      status: 'Pending',
      isSaved: false
    };

    if (payroll) {
      return {
        ...baseData,
        ...payroll,
        baseSalary: monthlyGross,
        basicSalary: monthlyBasic,
        hra: monthlyHra,
        otherAllowances: monthlyAllowances,
        overtime,
        bonus,
        deductions,
        advance,
        netSalary: netPayout,
        isSaved: true
      };
    }

    return baseData;
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
      advance: record.advance || 0,
      status: record.status || 'Pending'
    });
    setIsEditing(false);
    setIsDetailsOpen(true);
  };

  const handleSaveChanges = async () => {
    if (!selectedRecord) return;

    try {
      const gross = Number(editValues.basicSalary) + Number(editValues.hra) + Number(editValues.otherAllowances);
      const net = gross + Number(editValues.overtime) + Number(editValues.bonus) - Number(editValues.deductions) - Number(editValues.advance);

      const empId = typeof selectedRecord.employeeId === 'object'
        ? selectedRecord.employeeId?._id
        : (selectedRecord.employeeId || selectedRecord._id || selectedRecord.id);

      if (!empId) {
        toast.error('Employee ID missing');
        return;
      }

      const updatedRecord = {
        ...selectedRecord,
        ...editValues,
        baseSalary: gross,
        netSalary: net
      };

      await createPayroll({
        employeeId: empId,
        month: selectedMonth,
        baseSalary: updatedRecord.baseSalary,
        basicSalary: editValues.basicSalary,
        hra: editValues.hra,
        otherAllowances: editValues.otherAllowances,
        overtime: editValues.overtime,
        bonus: editValues.bonus,
        deductions: editValues.deductions,
        advance: editValues.advance,
        netSalary: updatedRecord.netSalary,
        status: editValues.status
      });

      try {
        await updateEmployee(empId, {
          salary: gross,
          ctc: gross * 12,
          basicSalary: Number(editValues.basicSalary),
          hra: Number(editValues.hra),
          otherAllowances: Number(editValues.otherAllowances)
        });
      } catch (err) {
        console.warn('Note: Employee master record update skipped:', err);
      }

      setSelectedRecord({
        ...updatedRecord,
        status: editValues.status
      });

      toast.success(`Salary details updated to ${editValues.status}!`);
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
      const response = await fetch('http://localhost:5002/api/email/send-payslip', {
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
            advance: formatCurrency(selectedRecord.advance || 0),
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
    (isEditing ? Number(editValues.deductions) : (selectedRecord?.deductions || 0)) -
    (isEditing ? Number(editValues.advance) : (selectedRecord?.advance || 0));

  if (loading) {
    return <ModernSpinner label="Calculating Payroll & Slips..." size="lg" />;
  }

  // Unique Departments for Filtering
  const uniqueDepartments = Array.from(new Set(combinedData.map(item => item.department).filter(Boolean)));

  const exportToExcel = () => {
    try {
      const recordsToExport = filteredData && filteredData.length > 0 ? filteredData : combinedData;

      if (!recordsToExport || recordsToExport.length === 0) {
        toast.error('No salary records found for the selected filters');
        return;
      }

      const getEmpCode = (empObj: any, index: number) => {
        const name = String(empObj.name || '').trim();
        if (name.includes('Geo')) return 'WTN 025';
        if (name.includes('Leo')) return 'LMT 002';
        if (name.includes('Sony')) return 'SK 003';
        if (name.includes('Jane')) return 'WTN 004';
        if (name.includes('Super') || name.includes('Admin')) return 'WTN 001';
        if (name.includes('Hr') || name.includes('Manager')) return 'WTN 002';
        return empObj.employeeCode || `WTN ${String(index + 1).padStart(3, '0')}`;
      };

      const monthLabel = selectedMonth;
      const formattedMonth = new Date(`${selectedMonth}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      let sumBasic = 0;
      let sumGross = 0;
      let sumAdditions = 0;
      let sumDeductions = 0;
      let sumAdvance = 0;
      let sumPayout = 0;

      const rowsHtml = recordsToExport.map((emp, idx) => {
        const empCode = getEmpCode(emp, idx);
        const empName = emp.name || 'Employee';
        const dept = emp.department || 'Management';
        const position = emp.position || 'Staff';

        const basic = emp.basicSalary || 0;
        const gross = (emp.basicSalary || 0) + (emp.hra || 0) + (emp.otherAllowances || 0);
        const additions = (emp.overtime || 0) + (emp.bonus || 0);
        const deductions = emp.deductions || 0;
        const advance = emp.advance || 0;
        const payout = emp.netSalary || (gross + additions - deductions - advance);

        sumBasic += basic;
        sumGross += gross;
        sumAdditions += additions;
        sumDeductions += deductions;
        sumAdvance += advance;
        sumPayout += payout;

        const statusBg = emp.status === 'Paid' ? '#dcfce7' : '#fef3c7';
        const statusColor = emp.status === 'Paid' ? '#15803d' : '#b45309';

        return `<tr>
          <td style="font-weight:bold; color:#0f172a;">${empName}</td>
          <td style="font-weight:bold; color:#1e3a8a;">${empCode}</td>
          <td>${dept}</td>
          <td>${position}</td>
          <td style="text-align:right;">₹${basic.toLocaleString('en-IN')}</td>
          <td style="text-align:right; color:#16a34a;">+₹${additions.toLocaleString('en-IN')}</td>
          <td style="text-align:right; color:#dc2626;">-₹${deductions.toLocaleString('en-IN')}</td>
          <td style="text-align:right; color:#dc2626;">-₹${advance.toLocaleString('en-IN')}</td>
          <td style="text-align:right; font-weight:bold; color:#0f172a;">₹${payout.toLocaleString('en-IN')}</td>
          <td style="text-align:center; font-weight:bold; background-color:${statusBg}; color:${statusColor};">${emp.status}</td>
        </tr>`;
      }).join('');

      const excelTemplate = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8"/>
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Salary & Payroll Report</x:Name>
          <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    th { background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; padding: 10px; border: 1px solid #0f172a; }
    td { padding: 8px; border: 1px solid #cbd5e1; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; }
  </style>
</head>
<body>
  <h2 style="font-family:sans-serif; color:#0f172a; margin-bottom:5px;">WHITESWAN TV LLP — SALARY & PAYROLL REPORT (${formattedMonth.toUpperCase()})</h2>
  <p style="font-family:sans-serif; color:#475569; margin-bottom:15px; font-weight:bold;">
    Pay Period: ${formattedMonth} | Total Records: ${recordsToExport.length} | Status: Complete Payroll Record Sheet
  </p>

  <table border="1" style="border-collapse:collapse;">
    <thead>
      <tr>
        <th style="background-color:#0f172a; color:#ffffff; text-align:left;">Employee Name</th>
        <th style="background-color:#0f172a; color:#ffffff; text-align:left;">Employee ID</th>
        <th style="background-color:#0f172a; color:#ffffff; text-align:left;">Department</th>
        <th style="background-color:#0f172a; color:#ffffff; text-align:left;">Position</th>
        <th style="background-color:#0f172a; color:#ffffff; text-align:right;">Basic Salary</th>
        <th style="background-color:#0f172a; color:#ffffff; text-align:right;">Additions</th>
        <th style="background-color:#0f172a; color:#ffffff; text-align:right;">Deductions</th>
        <th style="background-color:#0f172a; color:#ffffff; text-align:right;">Advance Salary</th>
        <th style="background-color:#0f172a; color:#ffffff; text-align:right;">Monthly Payout</th>
        <th style="background-color:#0f172a; color:#ffffff; text-align:center;">Payment Status</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr style="background-color:#f1f5f9; font-weight:bold;">
        <td colspan="4" style="text-align:right; font-size:14px; font-weight:bold; color:#0f172a;">TOTAL PAYROLL:</td>
        <td style="text-align:right;">₹${sumBasic.toLocaleString('en-IN')}</td>
        <td style="text-align:right; color:#16a34a;">+₹${sumAdditions.toLocaleString('en-IN')}</td>
        <td style="text-align:right; color:#dc2626;">-₹${sumDeductions.toLocaleString('en-IN')}</td>
        <td style="text-align:right; color:#dc2626;">-₹${sumAdvance.toLocaleString('en-IN')}</td>
        <td style="text-align:right; font-size:14px; color:#0f172a; background-color:#e2e8f0;">₹${sumPayout.toLocaleString('en-IN')}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;

      const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `Whiteswan_Salary_Report_${monthLabel}_${new Date().toISOString().slice(0, 10)}.xls`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported salary report for ${formattedMonth} to Excel!`);
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error('Failed to export salary report to Excel');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2>Salary Management</h2>
          <p className="text-muted-foreground">Manage employee salaries and payroll processing</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={exportToExcel}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setIsCalcOpen(true)}>
            <Calculator className="h-4 w-4 text-primary" />
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


      <Card className="p-4 sm:p-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex items-center flex-1 sm:flex-initial min-w-[200px] sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full"
            />
          </div>

          <div className="relative flex items-center flex-1 sm:flex-initial min-w-[140px]">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full sm:w-40 pl-10"
            />
          </div>

          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-full sm:w-40">
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
            <SelectTrigger className="w-full sm:w-32">
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
        <div className="p-4 sm:p-6">
          <h3 className="mb-4">Employee Salary Details</h3>
          <div className="overflow-x-auto rounded-xl border border-border">
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
                    <TableCell className="text-green-600">+{formatCurrency((record.overtime || 0) + (record.bonus || 0))}</TableCell>
                    <TableCell className="text-red-600">-{formatCurrency(record.deductions || 0)}</TableCell>
                    <TableCell className="font-bold">{formatCurrency(record.netSalary)}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {record.status !== 'Paid' && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProcessIndividual(record);
                            }}
                            style={{ backgroundColor: '#16a34a', color: '#ffffff' }}
                            className="h-8 px-3 text-xs font-semibold gap-1 shadow-sm hover:opacity-90 border-0"
                          >
                            <Send className="h-3.5 w-3.5 text-white" />
                            <span className="text-white font-bold">Pay</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(record)}
                          className="h-8 px-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <span>View Details</span>
                          <ChevronRight className="h-3.5 w-3.5 ml-1" />
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
        </div>
      </Card>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl shadow-2xl border border-border bg-background">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">Salary Details</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
              Breakdown for {selectedRecord?.name} - {new Date(selectedMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4 py-3" ref={slipRef}>
              {/* Employee Summary Card */}
              <div className="bg-slate-100 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px] font-medium">Employee Name</span>
                  <span className="font-bold text-foreground text-sm">{selectedRecord?.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px] font-medium">Designation & Department</span>
                  <span className="font-semibold text-foreground">{selectedRecord?.position || 'Employee'} • {selectedRecord?.department || 'Engineering'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px] font-medium mb-1">Employment Type</span>
                  <Badge variant="outline" className="text-[10px] py-0.5 px-2 font-bold leading-none bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700">
                    {selectedRecord?.employmentType || selectedRecord?.empDetails?.employmentType || 'Full-Time'}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px] font-medium">Employee Code / ID</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{selectedRecord?.employeeCode || 'EMP-101'}</span>
                </div>
              </div>

              {/* Additions Section */}
              <div className="space-y-2">
                <div className="flex justify-between items-center hide-on-print">
                  <h4 className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider">Earnings</h4>
                  {!isEditing && (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="h-7 px-2 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/50">
                      <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                  )}
                </div>
                <div className="bg-green-50 dark:bg-emerald-950/30 p-3.5 sm:p-4 rounded-xl space-y-2.5 border border-green-100 dark:border-emerald-900/40">
                  <div className="flex justify-between text-xs sm:text-sm items-center gap-2 sm:gap-3">
                    <span className="text-gray-700 dark:text-slate-300 font-medium flex-1">Basic Salary</span>
                    {isEditing ? (
                      <Input
                        type="number"
                        className="h-8 w-24 sm:w-32 shrink-0 text-right font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xs rounded-lg px-2 sm:px-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500"
                        value={editValues.basicSalary}
                        onChange={(e) => setEditValues({ ...editValues, basicSalary: Number(e.target.value) })}
                      />
                    ) : (
                      <span className="font-semibold text-foreground">{formatCurrency(selectedRecord.basicSalary)}</span>
                    )}
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm items-center gap-2 sm:gap-3">
                    <span className="text-gray-700 dark:text-slate-300 font-medium flex-1">HRA</span>
                    {isEditing ? (
                      <Input
                        type="number"
                        className="h-8 w-24 sm:w-32 shrink-0 text-right font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xs rounded-lg px-2 sm:px-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500"
                        value={editValues.hra}
                        onChange={(e) => setEditValues({ ...editValues, hra: Number(e.target.value) })}
                      />
                    ) : (
                      <span className="font-semibold text-foreground">{formatCurrency(selectedRecord.hra)}</span>
                    )}
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm items-center gap-2 sm:gap-3">
                    <span className="text-gray-700 dark:text-slate-300 font-medium flex-1">Allowances</span>
                    {isEditing ? (
                      <Input
                        type="number"
                        className="h-8 w-24 sm:w-32 shrink-0 text-right font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xs rounded-lg px-2 sm:px-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500"
                        value={editValues.otherAllowances}
                        onChange={(e) => setEditValues({ ...editValues, otherAllowances: Number(e.target.value) })}
                      />
                    ) : (
                      <span className="font-semibold text-foreground">{formatCurrency(selectedRecord.otherAllowances)}</span>
                    )}
                  </div>

                  <div className="flex justify-between text-xs sm:text-sm items-center gap-2 sm:gap-3">
                    <span className="text-gray-700 dark:text-slate-300 font-medium flex-1">Overtime</span>
                    {isEditing ? (
                      <Input
                        type="number"
                        className="h-8 w-24 sm:w-32 shrink-0 text-right font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xs rounded-lg px-2 sm:px-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500"
                        value={editValues.overtime}
                        onChange={(e) => setEditValues({ ...editValues, overtime: Number(e.target.value) })}
                      />
                    ) : (
                      <span className={`font-semibold ${selectedRecord.overtime > 0 ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                        +{formatCurrency(selectedRecord.overtime || 0)}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm items-center gap-2 sm:gap-3">
                    <span className="text-gray-700 dark:text-slate-300 font-medium flex-1">Bonus / Incentive</span>
                    {isEditing ? (
                      <Input
                        type="number"
                        className="h-8 w-24 sm:w-32 shrink-0 text-right font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xs rounded-lg px-2 sm:px-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500"
                        value={editValues.bonus}
                        onChange={(e) => setEditValues({ ...editValues, bonus: Number(e.target.value) })}
                      />
                    ) : (
                      <span className={`font-semibold ${selectedRecord.bonus > 0 ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                        +{formatCurrency(selectedRecord.bonus || 0)}
                      </span>
                    )}
                  </div>

                  <div className="border-t border-green-200 dark:border-emerald-900/60 pt-2.5 mt-2 flex justify-between items-center font-bold text-slate-900 dark:text-white">
                    <span>Gross Earnings</span>
                    <span className="text-base">{formatCurrency(calculatedGross + (isEditing ? editValues.overtime : (selectedRecord.overtime || 0)) + (isEditing ? editValues.bonus : (selectedRecord.bonus || 0)))}</span>
                  </div>
                </div>
              </div>

              {/* Deductions Section */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">Deductions</h4>
                <div className="bg-red-50 dark:bg-rose-950/30 p-3.5 sm:p-4 rounded-xl space-y-2.5 border border-red-100 dark:border-rose-900/40">
                  <div className="flex justify-between text-sm items-center gap-3">
                    <span className="text-gray-700 dark:text-slate-300 font-medium flex-1">Tax / Standard Deductions</span>
                    {isEditing ? (
                      <Input
                        type="number"
                        className="h-8 w-32 shrink-0 text-right font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xs rounded-lg px-2.5 focus:ring-2 focus:ring-rose-500"
                        value={editValues.deductions}
                        onChange={(e) => setEditValues({ ...editValues, deductions: Number(e.target.value) })}
                      />
                    ) : (
                      <span className="font-semibold text-red-600 dark:text-red-400">-{formatCurrency(selectedRecord.deductions || 0)}</span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm items-center gap-3">
                    <span className="text-gray-700 dark:text-slate-300 font-medium flex-1">Salary Advance / Loan</span>
                    {isEditing ? (
                      <Input
                        type="number"
                        className="h-8 w-32 shrink-0 text-right font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xs rounded-lg px-2.5 focus:ring-2 focus:ring-rose-500"
                        value={editValues.advance}
                        onChange={(e) => setEditValues({ ...editValues, advance: Number(e.target.value) })}
                      />
                    ) : (
                      <span className={`font-semibold ${selectedRecord.advance > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                        -{formatCurrency(selectedRecord.advance || 0)}
                      </span>
                    )}
                  </div>
                  <div className="border-t border-red-200 dark:border-rose-900/60 pt-2.5 mt-2 flex justify-between items-center font-bold text-red-700 dark:text-red-400">
                    <span>Total Deductions</span>
                    <span className="text-base">-{formatCurrency((isEditing ? editValues.deductions : (selectedRecord.deductions || 0)) + (isEditing ? editValues.advance : (selectedRecord.advance || 0)))}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay */}
              <div className="bg-slate-900 dark:bg-slate-800 text-white p-4 rounded-xl flex justify-between items-center shadow-lg border border-slate-800">
                <div>
                  <p className="text-xs text-slate-400">Net Pay</p>
                  <h3 className="text-xl font-bold">{formatCurrency(calculatedNetSalary)}</h3>
                </div>
                <Badge variant="outline" className={`bg-white/10 text-white border-0 ${(isEditing ? editValues.status : selectedRecord.status) === 'Paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {isEditing ? editValues.status : selectedRecord.status}
                </Badge>
              </div>

              {/* Status Edit - Only visible in Edit Mode */}
              {isEditing && (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="edit-status" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Payment Status</Label>
                  <Select
                    value={editValues.status}
                    onValueChange={(val) => setEditValues({ ...editValues, status: val })}
                  >
                    <SelectTrigger className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xs font-medium">
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

          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-border justify-between items-stretch sm:items-center w-full">
            {isEditing ? (
              <div className="flex justify-end gap-2 w-full">
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={handleSaveChanges}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="flex-1 sm:flex-initial">
                    <Download className="h-4 w-4 mr-1.5" /> Download PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleEmailSlip} disabled={emailLoading} className="flex-1 sm:flex-initial">
                    {emailLoading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Mail className="h-4 w-4 mr-1.5" />}
                    Email Slip
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                  {selectedRecord?.status === 'Pending' && (
                    <Button size="sm" onClick={() => handleProcessIndividual(selectedRecord)} className="flex-1 sm:flex-initial bg-green-600 hover:bg-green-700 text-white">
                      Process Payroll
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setIsDetailsOpen(false)} className="flex-1 sm:flex-initial">Close</Button>
                </div>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary & Payroll Calculator Modal */}
      <Dialog open={isCalcOpen} onOpenChange={setIsCalcOpen}>
        <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl shadow-2xl border border-border bg-background">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
              <Calculator className="h-5 w-5 text-primary" />
              Payroll & Salary Calculator
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
              Estimate net monthly payouts, overtime wages, and deductions.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 text-sm">
            {/* Auto-fill employee selector */}
            <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border">
              <Label className="text-xs text-muted-foreground font-semibold">Quick Auto-Fill Employee Data</Label>
              <Select value={calcEmpId} onValueChange={handleSelectCalcEmployee}>
                <SelectTrigger className="h-8 bg-background text-xs sm:text-sm">
                  <SelectValue placeholder="Custom Calculation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Calculation</SelectItem>
                  {combinedData.map(e => (
                    <SelectItem key={e.employeeId || e._id} value={e.employeeId || e._id}>
                      {e.name} ({e.department || 'Management'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="calcBaseSalary" className="text-xs">Base Monthly Gross (₹)</Label>
                <Input
                  id="calcBaseSalary"
                  type="number"
                  value={calcBaseSalary}
                  onChange={(e) => setCalcBaseSalary(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calcTotalDays" className="text-xs">Total Working Days</Label>
                <Input
                  id="calcTotalDays"
                  type="number"
                  value={calcTotalDays}
                  onChange={(e) => setCalcTotalDays(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="calcWorkedDays" className="text-xs">Actual Present Days</Label>
                <Input
                  id="calcWorkedDays"
                  type="number"
                  value={calcWorkedDays}
                  onChange={(e) => setCalcWorkedDays(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calcOvertimeHours" className="text-xs">Overtime (Hours)</Label>
                <Input
                  id="calcOvertimeHours"
                  type="number"
                  value={calcOvertimeHours}
                  onChange={(e) => setCalcOvertimeHours(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="calcOvertimeRate" className="text-xs">OT Rate (₹/hr)</Label>
                <Input
                  id="calcOvertimeRate"
                  type="number"
                  value={calcOvertimeRate}
                  onChange={(e) => setCalcOvertimeRate(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calcBonus" className="text-xs">Bonus (₹)</Label>
                <Input
                  id="calcBonus"
                  type="number"
                  value={calcBonus}
                  onChange={(e) => setCalcBonus(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calcAdvance" className="text-xs">Advance (₹)</Label>
                <Input
                  id="calcAdvance"
                  type="number"
                  value={calcAdvance}
                  onChange={(e) => setCalcAdvance(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Live Calculation Summary Box */}
            <div className="bg-slate-900 text-slate-100 p-4 rounded-xl space-y-2 border border-slate-800 shadow-md">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Daily Wage Rate:</span>
                <span>₹{calcDailyWage.toFixed(2)}/day</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300">
                <span>Base Earned ({calcWorkedDays}/{safeTotalDays} days):</span>
                <span>₹{Math.round(calcEarnedBase).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs text-emerald-400">
                <span>Additions (OT + Bonus):</span>
                <span>+₹{Math.round(calcOvertimePay + calcBonus).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs text-rose-400">
                <span>Deductions (Tax + Advance):</span>
                <span>-₹{Math.round(calcTotalDeductions).toLocaleString('en-IN')}</span>
              </div>

              <div className="border-t border-slate-800 pt-2 flex justify-between items-center mt-2">
                <div>
                  <p className="text-xs text-slate-400">Estimated Net Payout</p>
                  <p className="text-xl font-bold text-emerald-400">
                    ₹{Math.round(calcEstimatedNet).toLocaleString('en-IN')}
                  </p>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                  Net Estimated
                </Badge>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-border justify-between items-stretch sm:items-center w-full">
            <Button variant="outline" onClick={() => setIsCalcOpen(false)}>
              Close
            </Button>
            <Button
              onClick={handleApplyAndSaveSalary}
              style={{ backgroundColor: '#16a34a', color: '#ffffff' }}
              className="gap-2 font-bold hover:opacity-90 border-0 shadow-sm"
            >
              <Save className="h-4 w-4 text-white" />
              <span className="text-white font-bold">Save Salary Details</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}