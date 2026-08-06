import React, { useState } from 'react';
import {
  Clock,
  DollarSign,
  Calendar,
  BarChart3,
  Users,
  Settings,
  Home,
  LogOut,
  Moon,
  Sun,
  Menu,
  X
} from 'lucide-react';
import { Button } from './ui/button';
import logoImage from '../assets/60ace96c513e5568730553.png';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  userRole: 'admin' | 'employee' | 'superadmin' | 'hr';
  userName: string;
  userPosition: string;
  onLogout: () => void;
  darkMode?: boolean;
  onDarkModeChange?: (val: boolean) => void;
}

export function Sidebar({ activeSection, onSectionChange, userRole, userName, userPosition, onLogout, darkMode = false, onDarkModeChange }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, roles: ['admin', 'employee', 'superadmin', 'hr'] },
    { id: 'attendance', label: 'Attendance', icon: Clock, roles: ['admin', 'employee', 'superadmin', 'hr'] },
    { id: 'salary', label: 'Salary', icon: DollarSign, roles: ['admin', 'superadmin', 'hr'] },
    { id: 'leave', label: 'Leave Requests', icon: Calendar, roles: ['admin', 'employee', 'superadmin', 'hr'] },
    { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'superadmin', 'hr'] },
    { id: 'employees', label: 'Employees', icon: Users, roles: ['admin', 'superadmin', 'hr'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin', 'employee', 'superadmin', 'hr'] },
  ];

  const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));

  const handleSelectSection = (id: string) => {
    onSectionChange(id);
    setMobileOpen(false);
  };

  const renderNavList = () => (
    <div className="flex flex-col h-full bg-card text-card-foreground">
      {/* Brand Header */}
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-14 flex items-center justify-center overflow-hidden">
            <img
              src={logoImage}
              alt="Attendance System Logo"
              className="h-9 w-auto object-contain"
            />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground leading-tight">Attendance System</h1>
            <p className="text-[11px] text-muted-foreground">{['admin', 'hr', 'superadmin'].includes(userRole) ? 'HR System' : 'Employee Portal'}</p>
          </div>
        </div>
        {/* Mobile Close Icon */}
        <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <Button
              key={item.id}
              variant={isActive ? "secondary" : "ghost"}
              className={`w-full justify-start gap-3 h-11 text-sm font-medium ${
                isActive ? 'bg-secondary text-secondary-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => handleSelectSection(item.id)}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      {/* User Profile & Dark Mode Footer */}
      <div className="p-4 border-t border-border bg-card flex items-center gap-3">
        <div className="h-9 w-9 bg-primary rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-primary-foreground text-xs font-bold">
            {userName ? userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '??'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
          <p className="text-xs text-muted-foreground capitalize truncate">{userPosition || (userRole === 'superadmin' ? 'Super Admin' : userRole)}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDarkModeChange?.(!darkMode)} title={darkMode ? 'Light Mode' : 'Dark Mode'}>
          {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600 dark:text-slate-300" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onLogout} title="Logout">
          <LogOut className="h-4 w-4 text-rose-500" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header Bar (< lg) */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border w-full sticky top-0 z-30 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <img src={logoImage} alt="Logo" className="h-7 w-auto object-contain" />
          <div>
            <h1 className="text-sm font-bold text-foreground leading-none">Attendance System</h1>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              {['admin', 'hr', 'superadmin'].includes(userRole) ? 'HR System' : 'Portal'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onDarkModeChange?.(!darkMode)}>
            {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600 dark:text-slate-300" />}
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9 border-border" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5 text-foreground" />
          </Button>
        </div>
      </div>

      {/* Mobile Drawer Overlay & Drawer Container */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Dark Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setMobileOpen(false)}
          />

          {/* Sliding Side Drawer Container */}
          <div className="relative z-50 w-72 max-w-[80vw] h-full bg-card shadow-2xl border-r border-border flex flex-col">
            {renderNavList()}
          </div>
        </div>
      )}

      {/* Desktop Sidebar (lg: flex w-64 h-screen) */}
      <div className="hidden lg:flex w-64 flex-shrink-0 h-screen border-r border-border bg-card">
        {renderNavList()}
      </div>
    </>
  );
}