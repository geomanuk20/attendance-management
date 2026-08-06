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
  X,
  PanelLeftClose,
  PanelLeftOpen
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
  isOpen?: boolean;
  onToggleSidebar?: () => void;
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
  isOpen = true,
  onToggleSidebar
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

  return (
    <div className={`${isOpen ? 'w-64' : 'w-0 border-r-0'} transition-all duration-300 bg-card border-r border-border h-screen flex flex-col overflow-hidden flex-shrink-0 relative`}>
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
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Collapse Sidebar"
          >
            <PanelLeftClose className="h-5 w-5" />
          </Button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <Button
              key={item.id}
              variant={isActive ? "secondary" : "ghost"}
              className={`w-full justify-start gap-3 ${isActive ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              onClick={() => onSectionChange(item.id)}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-primary-foreground text-xs font-semibold">
              {userName ? userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '??'}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm text-foreground">{userName}</p>
            <p className="text-xs text-muted-foreground capitalize">{userPosition || (userRole === 'superadmin' ? 'Super Admin' : userRole)}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onDarkModeChange?.(!darkMode)} title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onLogout} title="Logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}