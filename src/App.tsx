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
import { updatePreferences, getEmployees } from './services/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState<{ name: string; role: 'admin' | 'employee' | 'superadmin' | 'hr'; position?: string; token?: string } | null>(null);
  const userRole = currentUser?.role || null;
  const [activeSection, setActiveSection] = useState('dashboard');
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

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} userRole={userRole!} userName={currentUser?.name || 'User'} userPosition={currentUser?.position || ''} darkMode={darkMode} onDarkModeChange={setDarkMode} onLogout={() => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setCurrentUser(null);
        setDarkMode(false); // Reset dark mode on logout
      }} />
      <main className="flex-1 overflow-auto bg-background">
        {renderContent()}
      </main>
      <Toaster />
    </div>
  );
}