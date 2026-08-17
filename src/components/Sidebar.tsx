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
  isMobileOpen?: boolean;
  onMobileToggle?: (open: boolean) => void;
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
  onMobileToggle
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
    if (onMobileToggle) {
      onMobileToggle(false);
    }
  };

  const renderNavButtons = () =>
    menuItems.map((item) => {
      const Icon = item.icon;
      const isActive = activeSection === item.id;

      return (
        <Button
          key={item.id}
          variant={isActive ? "secondary" : "ghost"}
          className={`w-full justify-start gap-3 ${
            isActive ? 'bg-secondary text-secondary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => handleNavClick(item.id)}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {item.label}
        </Button>
      );
    });

  const renderUserSection = () => (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0 shadow-xs"
        style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px', borderRadius: '9999px', aspectRatio: '1/1' }}
      >
        <span className="text-primary-foreground text-xs font-bold leading-none">
          {userName ? userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '??'}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{userName}</p>
        <p className="text-xs text-muted-foreground capitalize truncate">{userPosition || (userRole === 'superadmin' ? 'Super Admin' : userRole)}</p>
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onDarkModeChange?.(!darkMode)} title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
        {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={onLogout} title="Logout">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <>
      {/* ========================================================= */}
      {/* MOBILE ONLY: Top Header Bar                               */}
      {/* ========================================================= */}
      <header className="app-mobile-header fixed top-0 left-0 right-0 h-14 bg-card border-b border-border z-40 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-foreground"
            onClick={() => onMobileToggle?.(!isMobileOpen)}
            aria-label="Toggle menu"
          >
            {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-12 flex items-center justify-center overflow-hidden">
              <img
                src={logoImage}
                alt="Logo"
                className="h-7 w-auto object-contain"
                style={{ maxHeight: '28px', maxWidth: '48px' }}
              />
            </div>
            <span className="font-semibold text-sm text-foreground">Attendance</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDarkModeChange?.(!darkMode)}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <div
            className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0 shadow-xs"
            style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px', borderRadius: '9999px', aspectRatio: '1/1' }}
          >
            <span className="leading-none">
              {userName ? userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '??'}
            </span>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MOBILE ONLY: Off-Canvas Drawer Backdrop & Full-Height Panel */}
      {/* ========================================================= */}
      {isMobileOpen && (
        <div
          className="app-mobile-backdrop fixed inset-0 bg-black/50 backdrop-blur-xs z-40 transition-opacity duration-300"
          onClick={() => onMobileToggle?.(false)}
        />
      )}

      <div
        className={`app-mobile-drawer fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] bg-card border-r border-border z-50 flex flex-col transition-transform duration-300 shadow-2xl h-screen ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header with Logo & Close Button */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-14 flex items-center justify-center overflow-hidden rounded bg-black/5 dark:bg-white/5 p-1">
              <img
                src={logoImage}
                alt="Logo"
                className="h-7 w-auto object-contain"
                style={{ maxHeight: '28px', maxWidth: '44px' }}
              />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground leading-tight">Attendance System</h2>
              <p className="text-[11px] text-muted-foreground">{['admin', 'hr', 'superadmin'].includes(userRole) ? 'HR System' : 'Employee Portal'}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-full"
            onClick={() => onMobileToggle?.(false)}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {renderNavButtons()}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-border mt-auto">
          {renderUserSection()}
        </div>
      </div>

      {/* ========================================================= */}
      {/* DESKTOP ONLY: Original Fixed Sidebar                      */}
      {/* ========================================================= */}
      <aside className="app-desktop-sidebar w-64 bg-card border-r border-border h-screen flex-col shrink-0">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-16 flex items-center justify-center overflow-hidden rounded-md bg-black/5 dark:bg-white/5 p-1">
              <img
                src={logoImage}
                alt="Attendance System Logo"
                className="h-9 w-auto object-contain"
                style={{ maxHeight: '36px', maxWidth: '56px' }}
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">Attendance System</h1>
              <p className="text-[11px] text-muted-foreground">{['admin', 'hr', 'superadmin'].includes(userRole) ? 'HR System' : 'Employee Portal'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {renderNavButtons()}
        </nav>

        <div className="p-4 border-t border-border">
          {renderUserSection()}
        </div>
      </aside>
    </>
  );
}