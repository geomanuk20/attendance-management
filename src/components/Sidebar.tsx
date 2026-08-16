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
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({
  activeSection,
  onSectionChange,
  userRole,
  userName,
  userPosition,
  onLogout,
  darkMode = false,
  onDarkModeChange,
  isMobileOpen = false,
  onMobileClose
}: SidebarProps) {
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

  const handleNavClick = (sectionId: string) => {
    onSectionChange(sectionId);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-card">
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

        {/* Mobile Close Button */}
        {onMobileClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileClose}
            className="md:hidden h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Close Sidebar"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <Button
              key={item.id}
              variant={isActive ? "secondary" : "ghost"}
              className={`w-full justify-start gap-3 h-10 px-3.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary/10 text-primary font-semibold border-l-4 border-primary rounded-l-none'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              onClick={() => handleNavClick(item.id)}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              {item.label}
            </Button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border mt-auto">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-primary rounded-full flex items-center justify-center flex-shrink-0 shadow-xs">
            <span className="text-primary-foreground text-xs font-bold">
              {userName ? userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '??'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
            <p className="text-xs text-muted-foreground capitalize truncate">{userPosition || (userRole === 'superadmin' ? 'Super Admin' : userRole)}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => onDarkModeChange?.(!darkMode)}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-rose-500"
            onClick={onLogout}
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile, visible on md+) */}
      <aside className="w-64 border-r border-border h-screen flex flex-col shrink-0 hidden md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile Off-Canvas Drawer & Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
            onClick={onMobileClose}
          />
          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[80vw] h-full shadow-2xl z-10 transition-transform duration-300 animate-in slide-in-from-left">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}