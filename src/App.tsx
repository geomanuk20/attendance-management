import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { EmployeeDashboard } from './components/EmployeeDashboard';
import { Attendance } from './components/Attendance';
import { Salary } from './components/Salary';
import { LeaveRequests } from './components/LeaveRequests';
import { Reports } from './components/Reports';
import { EmployeeManagement } from './components/EmployeeManagement';
import { Settings } from './components/Settings';

import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
import { updatePreferences, getEmployees } from './services/api';
import {
  Menu,
  Home,
  Clock,
  Users,
  Calendar,
  DollarSign,
  Settings as SettingsIcon,
  Sun,
  Moon,
  BarChart3
} from 'lucide-react';
import logoImage from './assets/60ace96c513e5568730553.png';

export default function App() {
  const [currentUser, setCurrentUser] = useState<{ name: string; role: 'admin' | 'employee' | 'superadmin' | 'hr'; position?: string; token?: string } | null>(null);
  const userRole = currentUser?.role || null;
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currency, setCurrency] = useState(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.id) {
          const localCurr = localStorage.getItem(`currency_${parsed.id}`);
          if (localCurr) return localCurr;
        }
      }
    } catch { }
    return localStorage.getItem('currency') || 'USD';
  });
  const [darkMode, setDarkMode] = useState(() => {
    // Sync read on init to avoid flash: check if there's a stored user and their dark mode preference
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const { id } = JSON.parse(storedUser);
        if (id) return localStorage.getItem(`darkMode_${id}`) === 'true';
      }
    } catch { }
    return false;
  });

  // Apply dark class to document root whenever darkMode changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Save to DB + localStorage per-user
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const { id } = JSON.parse(storedUser);
      if (id) {
        localStorage.setItem(`darkMode_${id}`, String(darkMode));
        updatePreferences(id, { darkMode }).catch(() => { });
      }
    }
  }, [darkMode]);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser) {
          const rawRole = (parsedUser.role || '').toLowerCase();
          parsedUser.role = ['admin', 'superadmin', 'hr', 'employee'].includes(rawRole) ? rawRole : 'superadmin';
          setCurrentUser(parsedUser);

          const userDark = parsedUser.id ? localStorage.getItem(`darkMode_${parsedUser.id}`) === 'true' : false;
          setDarkMode(userDark);

          const userCurr = parsedUser.id ? localStorage.getItem(`currency_${parsedUser.id}`) : null;
          if (userCurr) setCurrency(userCurr);

          // Fetch fresh employee profile from DB to ensure position is live and synced
          const targetId = parsedUser.id || parsedUser._id;
          getEmployees().then((emps: any[]) => {
            if (Array.isArray(emps)) {
              const fresh = emps.find((e: any) =>
                (targetId && (String(e._id) === String(targetId) || String(e.id) === String(targetId))) ||
                (parsedUser.email && e.email && e.email.toLowerCase() === parsedUser.email.toLowerCase())
              );
              if (fresh) {
                setCurrentUser((prev: any) => {
                  const updated = {
                    ...(prev || {}),
                    ...fresh,
                    id: fresh._id || fresh.id || prev?.id,
                    position: fresh.position || prev?.position || 'Editor',
                    role: ['admin', 'superadmin', 'hr', 'employee'].includes((fresh.role || '').toLowerCase()) ? fresh.role.toLowerCase() : prev?.role
                  };
                  localStorage.setItem('user', JSON.stringify(updated));
                  return updated;
                });
              }
            }
          }).catch(() => {});
        }
      }
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
  }, []);

  // Sync currency changes to Backend and LocalStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const { id } = JSON.parse(storedUser);
        if (id) {
          localStorage.setItem(`currency_${id}`, currency);
          localStorage.setItem('currency', currency);
          updatePreferences(id, { currency }).catch(() => { });
        }
      } catch {}
    }
  }, [currency]);

  const handleLogin = (user: any) => {
    const rawRole = (user?.role || 'superadmin').toLowerCase();
    const role = ['admin', 'superadmin', 'hr', 'employee'].includes(rawRole) ? rawRole : 'superadmin';

    const userToStore = {
      id: user._id || user.id || 'admin-101',
      name: user.name || 'Super Admin',
      role: role,
      position: user.position || (role === 'employee' ? 'Editor' : 'Administrator'),
      token: user.token || 'token-101'
    };
    localStorage.setItem('user', JSON.stringify(userToStore));
    localStorage.setItem('token', userToStore.token);
    setCurrentUser(userToStore);

    const userId = userToStore.id;
    const dbDark = typeof user.darkMode === 'boolean' ? user.darkMode : null;
    const localDark = userId ? localStorage.getItem(`darkMode_${userId}`) === 'true' : false;
    setDarkMode(dbDark !== null ? dbDark : localDark);

    const dbCurr = user.currency || null;
    const localCurr = userId ? localStorage.getItem(`currency_${userId}`) : null;
    setCurrency(dbCurr || localCurr || 'USD');
  };

  if (!userRole) {
    return (
      <>
        <Login onLogin={handleLogin} />
        <Toaster />
      </>
    );
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return ['admin', 'superadmin', 'hr'].includes(userRole) ? <Dashboard currency={currency} /> : <EmployeeDashboard currency={currency} />;
      case 'attendance':
        return <Attendance userRole={userRole} />;
      case 'salary':
        return <Salary currency={currency} />;
      case 'leave':
        return <LeaveRequests userRole={userRole} />;
      case 'reports':
        return <Reports currency={currency} />;
      case 'employees':
        return <EmployeeManagement currency={currency} />;
      case 'settings':
        return <Settings userRole={userRole!} onLogout={() => setCurrentUser(null)} currency={currency} onCurrencyChange={setCurrency} darkMode={darkMode} onDarkModeChange={setDarkMode} />;
      default:
        return ['admin', 'superadmin', 'hr'].includes(userRole!) ? <Dashboard currency={currency} /> : <EmployeeDashboard currency={currency} />;
    }
  };

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'dashboard': return 'Dashboard';
      case 'attendance': return 'Attendance';
      case 'salary': return 'Salary & Payroll';
      case 'leave': return 'Leave Requests';
      case 'reports': return 'Reports';
      case 'employees': return 'Employees';
      case 'settings': return 'Settings';
      default: return 'Dashboard';
    }
  };

  const isHR = ['admin', 'superadmin', 'hr'].includes(userRole);

  const mobileNavItems = isHR ? [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'salary', label: 'Salary', icon: DollarSign },
    { id: 'more', label: 'Menu', icon: Menu, isAction: true },
  ] : [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'leave', label: 'Leave', icon: Calendar },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
    { id: 'more', label: 'Menu', icon: Menu, isAction: true },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Responsive Sidebar (Persistent on Desktop, Drawer on Mobile) */}
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        userRole={userRole!}
        userName={currentUser?.name || 'User'}
        userPosition={currentUser?.position || ''}
        darkMode={darkMode}
        onDarkModeChange={setDarkMode}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
        onLogout={() => {
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          setCurrentUser(null);
          setDarkMode(false);
        }}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">
        {/* Mobile Top Navbar Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-2.5 bg-card/95 backdrop-blur-md border-b border-border sticky top-0 z-30 shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(true)}
              className="h-9 w-9 p-0 text-foreground hover:bg-secondary rounded-lg"
              aria-label="Open Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-7 w-9 flex items-center justify-center overflow-hidden">
                <img src={logoImage} alt="Logo" className="h-7 w-auto object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xs sm:text-sm text-foreground leading-tight">{getSectionTitle()}</span>
                <span className="text-[10px] text-muted-foreground leading-none">{isHR ? 'HR System' : 'Employee Portal'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-foreground"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Light Mode' : 'Dark Mode'}
            >
              {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </Button>
            <div
              onClick={() => setIsMobileMenuOpen(true)}
              className="h-7 w-7 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-[10px] font-bold cursor-pointer shrink-0"
              title={currentUser?.name || 'Profile'}
            >
              {currentUser?.name ? currentUser.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
            </div>
          </div>
        </header>

        {/* Scrollable Page Body with padding bottom for mobile navigation bar */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background pb-20 md:pb-0">
          {renderContent()}
        </main>

        {/* Mobile Sticky Bottom Navigation Bar for rapid thumb access */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-lg border-t border-border flex items-center justify-around py-1.5 px-1 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = !item.isAction && activeSection === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.isAction) {
                    setIsMobileMenuOpen(true);
                  } else {
                    setActiveSection(item.id);
                  }
                }}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-150 ${
                  isActive
                    ? 'text-primary font-bold scale-105'
                    : 'text-muted-foreground hover:text-foreground active:scale-95'
                }`}
              >
                <div className={`p-1 rounded-full ${isActive ? 'bg-primary/10' : ''}`}>
                  <Icon className={`h-5 w-5 ${isActive ? 'text-primary' : ''}`} />
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 font-medium leading-none">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <Toaster />
    </div>
  );
}