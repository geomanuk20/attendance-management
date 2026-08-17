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
import { Menu, Home, Clock, Calendar, Users, Moon, Sun, MoreHorizontal } from 'lucide-react';
import { Button } from './components/ui/button';
import logoImage from './assets/60ace96c513e5568730553.png';

import { Toaster } from './components/ui/sonner';
import { updatePreferences, getEmployees } from './services/api';

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

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setCurrentUser(null);
    setDarkMode(false);
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
        return <Settings userRole={userRole!} onLogout={handleLogout} currency={currency} onCurrencyChange={setCurrency} darkMode={darkMode} onDarkModeChange={setDarkMode} />;
      default:
        return ['admin', 'superadmin', 'hr'].includes(userRole!) ? <Dashboard currency={currency} /> : <EmployeeDashboard currency={currency} />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar (Desktop fixed on lg+, Mobile & Tablet slide-out drawer) */}
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        userRole={userRole!}
        userName={currentUser?.name || 'User'}
        userPosition={currentUser?.position || ''}
        darkMode={darkMode}
        onDarkModeChange={setDarkMode}
        onLogout={handleLogout}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile & Tablet Top Header (Visible on mobile/tablet, hidden on lg+) */}
        <header className="lg:hidden flex items-center justify-between px-4 h-14 bg-card border-b border-border shrink-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(true)}
              className="h-9 w-9 text-foreground hover:bg-muted cursor-pointer"
              aria-label="Open Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <img src={logoImage} alt="Logo" className="h-7 w-auto object-contain" />
              <span className="font-bold text-sm text-foreground">Attendance System</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
              {currentUser?.name ? currentUser.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '??'}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-background pb-20 lg:pb-0">
          {renderContent()}
        </main>

        {/* Mobile & Tablet Bottom Navigation Bar (Visible on mobile/tablet, hidden on lg+) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-md border-t border-border z-40 flex items-center justify-around px-2 shadow-lg">
          <button
            onClick={() => setActiveSection('dashboard')}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 transition-colors cursor-pointer ${
              activeSection === 'dashboard' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Home className="h-4 w-4" />
            <span className="text-[10px]">Dashboard</span>
          </button>

          <button
            onClick={() => setActiveSection('attendance')}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 transition-colors cursor-pointer ${
              activeSection === 'attendance' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span className="text-[10px]">Attendance</span>
          </button>

          {['admin', 'superadmin', 'hr'].includes(userRole) ? (
            <button
              onClick={() => setActiveSection('employees')}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 transition-colors cursor-pointer ${
                activeSection === 'employees' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-4 w-4" />
              <span className="text-[10px]">Employees</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveSection('leave')}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 transition-colors cursor-pointer ${
                activeSection === 'leave' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span className="text-[10px]">Leave</span>
            </button>
          )}

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="text-[10px]">More</span>
          </button>
        </nav>
      </div>

      <Toaster />
    </div>
  );
}