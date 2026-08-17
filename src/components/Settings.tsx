import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { getAppUpdateSettings, saveAppUpdateSettings, getCompanySettings, saveCompanySettings } from '../services/api';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Database,
  Globe,
  Moon,
  Sun,
  Save,
  Download,
  Upload,
  Trash2,
  Key,
  Mail,
  Smartphone,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

interface SettingsProps {
  userRole?: 'admin' | 'employee' | 'superadmin' | 'hr';
  onLogout?: () => void;
  currency?: string;
  onCurrencyChange?: (currency: string) => void;
  darkMode?: boolean;
  onDarkModeChange?: (val: boolean) => void;
}

export function Settings({ userRole = 'admin', onLogout, currency = 'INR', onCurrencyChange, darkMode = false, onDarkModeChange }: SettingsProps) {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [autoLogout, setAutoLogout] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [timeFormat, setTimeFormat] = useState(() => localStorage.getItem('timeFormat') || '12h');
  const [quickFaceScanLogin, setQuickFaceScanLogin] = useState<boolean>(() => {
    const stored = localStorage.getItem('quickFaceScanLoginEnabled');
    return stored !== null ? stored === 'true' : true;
  });

  const [appVersion, setAppVersion] = useState('1.0.2');
  const [updateStatus, setUpdateStatus] = useState<'ON' | 'OFF'>('OFF');
  const [updateMsg, setUpdateMsg] = useState('A new version is available. Please update for the best experience.');
  const [updateUrl, setUpdateUrl] = useState('');
  const [cancelButton, setCancelButton] = useState<'ON' | 'OFF'>('ON');
  const [appSettingsSaving, setAppSettingsSaving] = useState(false);

  // Company Settings state
  const [companyName, setCompanyName] = useState('Whiteswan TV News');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('1/3, Malamel Center, Club Junction, Edappally.P.O, Ernakulam, Kerala- 682024');
  const [officeLatitude, setOfficeLatitude] = useState('10.0279421');
  const [officeLongitude, setOfficeLongitude] = useState('76.3166192');
  const [allowedRadiusMeters, setAllowedRadiusMeters] = useState('100');
  const [workStartTime, setWorkStartTime] = useState('09:00');
  const [workEndTime, setWorkEndTime] = useState('17:00');
  const [annualVacationDays, setAnnualVacationDays] = useState('25');
  const [sickLeaveDays, setSickLeaveDays] = useState('10');
  const [personalDays, setPersonalDays] = useState('5');
  const [companySaving, setCompanySaving] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('general');

  const handleGlobalSave = async () => {
    if (activeSettingsTab === 'company') {
      try {
        setCompanySaving(true);
        await saveCompanySettings({
          companyName, companyEmail, companyPhone, website, address,
          officeLatitude: Number(officeLatitude),
          officeLongitude: Number(officeLongitude),
          allowedRadiusMeters: Number(allowedRadiusMeters),
          workStartTime, workEndTime,
          annualVacationDays: Number(annualVacationDays),
          sickLeaveDays: Number(sickLeaveDays),
          personalDays: Number(personalDays),
        });
        toast.success('Company settings saved successfully');
      } catch (err: any) {
        toast.error(err.message || 'Failed to save company settings');
      } finally {
        setCompanySaving(false);
      }
    } else if (activeSettingsTab === 'appUpdate') {
      await handleSaveAppSettings();
    } else {
      toast.success('Settings saved successfully');
    }
  };

  const [updateChecking, setUpdateChecking] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getAppUpdateSettings();
        setAppVersion(data.appVersion || '1.0.0');
        setUpdateStatus(data.updateStatus || 'OFF');
        setUpdateMsg(data.updateMsg || '');
        setUpdateUrl(data.updateUrl || '');
        setCancelButton(data.cancelButton || 'ON');
      } catch (error) {
        console.error('Failed to load app update settings:', error);
      }
    };
    fetchSettings();

    // Load company settings
    const fetchCompanySettings = async () => {
      try {
        const data = await getCompanySettings();
        if (data) {
          setCompanyName(data.companyName || 'Whiteswan TV News');
          setCompanyEmail(data.companyEmail || '');
          setCompanyPhone(data.companyPhone || '');
          setWebsite(data.website || '');
          setAddress(data.address || '1/3, Malamel Center, Club Junction, Edappally.P.O, Ernakulam, Kerala- 682024');
          setOfficeLatitude(data.officeLatitude !== undefined ? String(data.officeLatitude) : '10.0279421');
          setOfficeLongitude(data.officeLongitude !== undefined ? String(data.officeLongitude) : '76.3166192');
          setAllowedRadiusMeters(data.allowedRadiusMeters !== undefined ? String(data.allowedRadiusMeters) : '100');
          setWorkStartTime(data.workStartTime || '09:00');
          setWorkEndTime(data.workEndTime || '17:00');
          setAnnualVacationDays(String(data.annualVacationDays ?? 25));
          setSickLeaveDays(String(data.sickLeaveDays ?? 10));
          setPersonalDays(String(data.personalDays ?? 5));
        }
      } catch (error) {
        console.error('Failed to load company settings:', error);
      }
    };
    fetchCompanySettings();
  }, [userRole]);

  const handleSaveAppSettings = async () => {
    try {
      setAppSettingsSaving(true);
      await saveAppUpdateSettings({
        appVersion,
        updateStatus,
        updateMsg,
        updateUrl,
        cancelButton
      });
      toast.success("App Update settings saved successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to save App Update settings");
    } finally {
      setAppSettingsSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>Settings</h2>
          <p className="text-muted-foreground">Manage your system preferences and configurations</p>
        </div>
        <div className="flex gap-2">
          {userRole === 'superadmin' && (
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export Settings
            </Button>
          )}
          <Button
            className="gap-2"
            onClick={handleGlobalSave}
            disabled={companySaving || appSettingsSaving}
          >
            <Save className="h-4 w-4" />
            {companySaving || appSettingsSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full" onValueChange={setActiveSettingsTab}>
        <div className="w-full overflow-x-auto no-scrollbar py-1 mb-3" style={{ WebkitOverflowScrolling: 'touch' }}>
          <TabsList className="inline-flex w-max min-w-full flex-nowrap justify-start items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl gap-1.5 border border-slate-200/60 dark:border-slate-700/60">
            <TabsTrigger value="general" className="whitespace-nowrap px-4 py-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer">General</TabsTrigger>
            <TabsTrigger value="notifications" className="whitespace-nowrap px-4 py-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer">Notifications</TabsTrigger>
            <TabsTrigger value="security" className="whitespace-nowrap px-4 py-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer">Security</TabsTrigger>
            <TabsTrigger value="appUpdate" className="whitespace-nowrap px-4 py-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer">📲 App Update</TabsTrigger>
            {userRole === 'superadmin' && (
              <>
                <TabsTrigger value="company" className="whitespace-nowrap px-4 py-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer">Company</TabsTrigger>
                <TabsTrigger value="integrations" className="whitespace-nowrap px-4 py-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer">Integrations</TabsTrigger>
                <TabsTrigger value="backup" className="whitespace-nowrap px-4 py-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer">Backup</TabsTrigger>
              </>
            )}
          </TabsList>
        </div>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card className="p-6">
            <h3 className="mb-4 flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              System Preferences
            </h3>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select defaultValue="america/new_york">
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="america/new_york">Eastern Time (UTC-5)</SelectItem>
                      <SelectItem value="america/chicago">Central Time (UTC-6)</SelectItem>
                      <SelectItem value="america/denver">Mountain Time (UTC-7)</SelectItem>
                      <SelectItem value="america/los_angeles">Pacific Time (UTC-8)</SelectItem>
                      <SelectItem value="utc">UTC (UTC+0)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="it">Italian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Select defaultValue="mm/dd/yyyy">
                    <SelectTrigger>
                      <SelectValue placeholder="Select date format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mm/dd/yyyy">MM/DD/YYYY</SelectItem>
                      <SelectItem value="dd/mm/yyyy">DD/MM/YYYY</SelectItem>
                      <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeFormat">Time Format</Label>
                  <Select value={timeFormat} onValueChange={(val) => {
                    setTimeFormat(val);
                    localStorage.setItem('timeFormat', val);
                    toast.success(`Time format set to ${val === '24h' ? '24-Hour (18:35)' : '12-Hour AM/PM (06:35 PM)'}`);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12h">12-Hour AM/PM (e.g. 06:35 PM)</SelectItem>
                      <SelectItem value="24h">24-Hour (e.g. 18:35)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {userRole === 'superadmin' && (
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={currency} onValueChange={(val) => {
                      localStorage.setItem('currency', val);
                      if (onCurrencyChange) onCurrencyChange(val);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EGP">EGP (ج.م)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="JPY">JPY (¥)</SelectItem>
                        <SelectItem value="INR">INR (₹)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="darkMode">Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">Use dark theme across the application</p>
                </div>
                <Switch
                  id="darkMode"
                  checked={darkMode}
                  onCheckedChange={(val) => onDarkModeChange?.(val)}
                />
              </div>

              {['admin', 'superadmin', 'hr'].includes(userRole) && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="quickFaceScanGeneral" className="font-semibold text-sm flex items-center gap-2">
                        <span>⚡ Quick Face Scan Login</span>
                        <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800">
                          Login Screen
                        </Badge>
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Show or hide the one-tap face recognition login button on the sign-in screen
                      </p>
                    </div>
                    <Switch
                      id="quickFaceScanGeneral"
                      checked={quickFaceScanLogin}
                      onCheckedChange={(checked) => {
                        setQuickFaceScanLogin(checked);
                        localStorage.setItem('quickFaceScanLoginEnabled', checked ? 'true' : 'false');
                        toast.success(`Quick Face Scan Login ${checked ? 'Enabled (ON)' : 'Disabled (OFF)'}`);
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="p-6">
            <h3 className="mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="emailNotifications">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                </div>
                <Switch
                  id="emailNotifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="pushNotifications">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive browser push notifications</p>
                </div>
                <Switch
                  id="pushNotifications"
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                />
              </div>
              <Separator />
              <div className="space-y-4">
                <Label>Email Notification Types</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Leave requests</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Payroll updates</span>
                    <Switch defaultChecked />
                  </div>
                  {userRole === 'superadmin' && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">System maintenance</span>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">New employee onboarding</span>
                        <Switch />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card className="p-6">
            <h3 className="mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security & Authentication
            </h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="twoFactorAuth">Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                </div>
                <Switch
                  id="twoFactorAuth"
                  checked={twoFactorAuth}
                  onCheckedChange={setTwoFactorAuth}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoLogout">Auto Logout</Label>
                  <p className="text-sm text-muted-foreground">Automatically log out after period of inactivity</p>
                </div>
                <Switch
                  id="autoLogout"
                  checked={autoLogout}
                  onCheckedChange={setAutoLogout}
                />
              </div>
              {['admin', 'superadmin', 'hr'].includes(userRole) && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="quickFaceScanSecurity" className="font-semibold text-sm flex items-center gap-2">
                        <span>⚡ Quick Face Scan Login Option</span>
                        <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800">
                          Login Screen
                        </Badge>
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Allow employees & admins to log in with one-click facial recognition on sign in page
                      </p>
                    </div>
                    <Switch
                      id="quickFaceScanSecurity"
                      checked={quickFaceScanLogin}
                      onCheckedChange={(checked) => {
                        setQuickFaceScanLogin(checked);
                        localStorage.setItem('quickFaceScanLoginEnabled', checked ? 'true' : 'false');
                        toast.success(`Quick Face Scan Login ${checked ? 'Enabled (ON)' : 'Disabled (OFF)'}`);
                      }}
                    />
                  </div>
                </>
              )}
              <Separator />
              <div className="space-y-4">
                <Label>Password Settings</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="gap-2">
                    <Key className="h-4 w-4" />
                    Change Password
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <Smartphone className="h-4 w-4" />
                    Manage 2FA Devices
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <Label>Session Management</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Current Session</p>
                      <p className="text-xs text-muted-foreground">Chrome on Windows • Active now</p>
                    </div>
                    <Badge variant="secondary">Current</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Mobile Session</p>
                      <p className="text-xs text-muted-foreground">Safari on iPhone • 2 hours ago</p>
                    </div>
                    <Button size="sm" variant="outline">Revoke</Button>
                  </div>
                </div>
              </div>

              {userRole === 'employee' && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <Label className="text-destructive">Account Actions</Label>
                    <Button variant="destructive" className="w-full gap-2" onClick={onLogout}>
                      <SettingsIcon className="h-4 w-4 rotate-90" /> {/* Reusing Icon for now or import LogOut if available/needed but user asked for button */}
                      Log Out
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* App Update Settings (Accessible to all users) */}
        <TabsContent value="appUpdate" className="space-y-6">
          <Card className="p-6">
            {userRole === 'superadmin' ? (
              // Superadmin: full editable form
              <div className="space-y-6 max-w-4xl">
                <h3 className="mb-2 text-sm font-semibold tracking-wider uppercase text-muted-foreground">APP UPDATE SETTINGS</h3>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="appVersion" className="text-sm font-medium text-muted-foreground">App Version</Label>
                  <div className="col-span-2">
                    <Input id="appVersion" value={appVersion} onChange={(e) => setAppVersion(e.target.value)} className="bg-zinc-950 border-zinc-800" />
                  </div>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="updateStatus" className="text-sm font-medium text-muted-foreground">Update Status</Label>
                  <div className="col-span-2">
                    <Select value={updateStatus} onValueChange={(val: 'ON' | 'OFF') => setUpdateStatus(val)}>
                      <SelectTrigger id="updateStatus" className="bg-zinc-950 border-zinc-800"><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800">
                        <SelectItem value="ON">ON</SelectItem>
                        <SelectItem value="OFF">OFF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="updateMsg" className="text-sm font-medium text-muted-foreground">Update Msg</Label>
                  <div className="col-span-2">
                    <Input id="updateMsg" value={updateMsg} onChange={(e) => setUpdateMsg(e.target.value)} className="bg-zinc-950 border-zinc-800" />
                  </div>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="updateUrl" className="text-sm font-medium text-muted-foreground">Update URL</Label>
                  <div className="col-span-2">
                    <Input id="updateUrl" value={updateUrl} onChange={(e) => setUpdateUrl(e.target.value)} className="bg-zinc-950 border-zinc-800" />
                  </div>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="cancelButton" className="text-sm font-medium text-muted-foreground">Cancel Button</Label>
                  <div className="col-span-2">
                    <Select value={cancelButton} onValueChange={(val: 'ON' | 'OFF') => setCancelButton(val)}>
                      <SelectTrigger id="cancelButton" className="bg-zinc-950 border-zinc-800"><SelectValue placeholder="Select cancel option" /></SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800">
                        <SelectItem value="ON">ON</SelectItem>
                        <SelectItem value="OFF">OFF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="pt-2">
                  <Button className="bg-[#84cc16] text-black hover:bg-[#a3e635] font-semibold px-6 py-2.5 rounded-md" onClick={handleSaveAppSettings} disabled={appSettingsSaving}>
                    {appSettingsSaving ? 'Saving Settings...' : 'Save Settings'}
                  </Button>
                </div>
              </div>
            ) : (
              // Employee / HR / Admin: read-only view with live update status & download button
              <div className="space-y-6 max-w-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Smartphone className="h-6 w-6 text-indigo-500" />
                  <h3 className="text-base font-semibold">App Version &amp; Updates</h3>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-medium">Current APK Version</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Latest available release</p>
                  </div>
                  <span
                    className="text-sm font-bold px-3 py-1 border rounded-md"
                    style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                  >
                    v{appVersion}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-medium">Update Status</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {updateStatus === 'ON' ? 'An update is available for download' : 'You are on the latest version'}
                    </p>
                  </div>
                  <div
                    className="inline-flex items-center justify-center px-4 py-1.5 rounded-full text-xs font-bold shrink-0 whitespace-nowrap shadow-xs"
                    style={{
                      backgroundColor: updateStatus === 'ON' ? '#fef3c7' : '#f1f5f9',
                      color: updateStatus === 'ON' ? '#92400e' : '#0f172a',
                      border: `1px solid ${updateStatus === 'ON' ? '#fde68a' : '#cbd5e1'}`,
                      minWidth: '100px'
                    }}
                  >
                    <span>{updateStatus === 'ON' ? 'Update Available' : 'Up to Date'}</span>
                  </div>
                </div>

                {updateStatus === 'ON' && updateMsg && (
                  <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-4">
                    <p className="text-sm font-medium text-indigo-400 mb-1">📣 Release Note</p>
                    <p className="text-sm text-muted-foreground">{updateMsg}</p>
                  </div>
                )}

                {updateStatus === 'ON' && updateUrl && (
                  <Button
                    className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => window.open(updateUrl, '_blank')}
                  >
                    <Download className="h-4 w-4" />
                    Download Latest APK
                  </Button>
                )}

                {updateStatus !== 'ON' && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    disabled={updateChecking}
                    onClick={async () => {
                      setUpdateChecking(true);
                      try {
                        const data = await getAppUpdateSettings();
                        setAppVersion(data.appVersion || appVersion);
                        setUpdateStatus(data.updateStatus || 'OFF');
                        setUpdateMsg(data.updateMsg || '');
                        setUpdateUrl(data.updateUrl || '');
                        toast.success(`Checked! Portal version v${data.appVersion || appVersion} is up to date.`);
                      } catch {
                        toast.error('Could not reach update server');
                      } finally {
                        setUpdateChecking(false);
                      }
                    }}
                  >
                    <Download className="h-4 w-4" />
                    {updateChecking ? 'Checking...' : 'Check for Update'}
                  </Button>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Superadmin Only Tabs */}
        {userRole === 'superadmin' && (
          <>
            {/* Company Settings */}
            <TabsContent value="company" className="space-y-6">
              <Card className="p-6">
                <h3 className="mb-4 flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Company Information
                </h3>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input id="companyName" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Attendance System" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyEmail">Company Email</Label>
                      <Input id="companyEmail" type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} placeholder="contact@company.com" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="companyPhone">Company Phone</Label>
                      <Input id="companyPhone" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} placeholder="+1 (555) 123-4567" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input id="website" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://www.company.com" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Company Address</Label>
                    <Input id="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="1/3, Malamel Center, Club Junction, Edappally.P.O, Ernakulam, Kerala- 682024" />
                  </div>

                  <Separator />

                  {/* Office Map Location & Geofence Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 font-semibold text-base">
                        <MapPin className="h-4 w-4 text-indigo-600" />
                        Office Map Location & 200m Geofence
                      </Label>
                      <a
                        href={`https://www.google.com/maps?q=${officeLatitude},${officeLongitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Pin in Google Maps
                      </a>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="officeLat">Latitude (° N)</Label>
                        <Input
                          id="officeLat"
                          type="number"
                          step="any"
                          value={officeLatitude}
                          onChange={e => setOfficeLatitude(e.target.value)}
                          placeholder="10.0279421"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="officeLng">Longitude (° E)</Label>
                        <Input
                          id="officeLng"
                          type="number"
                          step="any"
                          value={officeLongitude}
                          onChange={e => setOfficeLongitude(e.target.value)}
                          placeholder="76.3166192"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="geofenceRadius">Geofence Radius (Meters)</Label>
                        <Input
                          id="geofenceRadius"
                          type="number"
                          value={allowedRadiusMeters}
                          onChange={e => setAllowedRadiusMeters(e.target.value)}
                          placeholder="100"
                        />
                      </div>
                    </div>

                    {/* Interactive Map with 100m Circular Geofence Zone Overlay */}
                    <div className="border rounded-lg overflow-hidden h-64 w-full relative bg-slate-900 shadow-md">
                      <div className="absolute top-2 left-2 z-10 bg-slate-900/90 text-white backdrop-blur border border-indigo-500/30 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 shadow">
                        <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping"></span>
                        ⭕ Verified {allowedRadiusMeters || 100}m Geofence Radius Zone
                      </div>
                      <iframe
                        title="Office Location Map with 100m Geofence Zone"
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        srcDoc={`
                          <!DOCTYPE html>
                          <html>
                          <head>
                            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                            <style>
                              html, body, #map { width:100%; height:100%; margin:0; padding:0; background:#0f172a; font-family:sans-serif; }
                              .leaflet-popup-content-wrapper { background:#0f172a; color:#f8fafc; border:1px solid #475569; border-radius:8px; }
                              .leaflet-popup-tip { background:#0f172a; }
                            </style>
                          </head>
                          <body>
                            <div id="map"></div>
                            <script>
                              var lat = ${officeLatitude || 10.0279421};
                              var lng = ${officeLongitude || 76.3166192};
                              var rad = ${allowedRadiusMeters || 100};

                              var map = L.map('map', { zoomControl: true }).setView([lat, lng], 16);
                              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                                maxZoom: 19
                              }).addTo(map);

                              // 200m Geofence Circle Overlay
                              L.circle([lat, lng], {
                                color: '#4f46e5',
                                weight: 3,
                                fillColor: '#6366f1',
                                fillOpacity: 0.35,
                                radius: rad
                              }).addTo(map);

                              // Office Pin Marker
                              var marker = L.marker([lat, lng]).addTo(map);
                              marker.bindPopup('<div style="text-align:center;padding:4px;"><b>Whiteswan TV News</b><br><span style="color:#818cf8;font-weight:bold;">⭕ ' + rad + 'm Active Geofence Zone</span></div>').openPopup();
                            </script>
                          </body>
                          </html>
                        `}
                      ></iframe>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-4">
                    <Label>Working Hours</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="workStart">Work Start Time</Label>
                        <Input id="workStart" type="time" value={workStartTime} onChange={e => setWorkStartTime(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="workEnd">Work End Time</Label>
                        <Input id="workEnd" type="time" value={workEndTime} onChange={e => setWorkEndTime(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label>Leave Policies</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vacationDays">Annual Vacation Days</Label>
                        <Input id="vacationDays" type="number" value={annualVacationDays} onChange={e => setAnnualVacationDays(e.target.value)} min="0" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sickDays">Sick Leave Days</Label>
                        <Input id="sickDays" type="number" value={sickLeaveDays} onChange={e => setSickLeaveDays(e.target.value)} min="0" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="personalDays">Personal Days</Label>
                        <Input id="personalDays" type="number" value={personalDays} onChange={e => setPersonalDays(e.target.value)} min="0" />
                      </div>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button
                      className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                      disabled={companySaving}
                      onClick={async () => {
                        try {
                          setCompanySaving(true);
                          await saveCompanySettings({
                            companyName, companyEmail, companyPhone, website, address,
                            officeLatitude: Number(officeLatitude),
                            officeLongitude: Number(officeLongitude),
                            allowedRadiusMeters: Number(allowedRadiusMeters),
                            workStartTime, workEndTime,
                            annualVacationDays: Number(annualVacationDays),
                            sickLeaveDays: Number(sickLeaveDays),
                            personalDays: Number(personalDays),
                          });
                          toast.success('Company settings saved successfully');
                        } catch (err: any) {
                          toast.error(err.message || 'Failed to save company settings');
                        } finally {
                          setCompanySaving(false);
                        }
                      }}
                    >
                      <Save className="h-4 w-4" />
                      {companySaving ? 'Saving...' : 'Save Company Settings'}
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Integrations */}
            <TabsContent value="integrations" className="space-y-6">
              <Card className="p-6">
                <h3 className="mb-4 flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Third-Party Integrations
                </h3>
                <div className="space-y-6">
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Mail className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">Google Workspace</p>
                          <p className="text-sm text-muted-foreground">Email and calendar integration</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Connected</Badge>
                        <Button size="sm" variant="outline">Configure</Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Database className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium">Slack</p>
                          <p className="text-sm text-muted-foreground">Team communication and notifications</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Disconnected</Badge>
                        <Button size="sm">Connect</Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <Database className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">QuickBooks</p>
                          <p className="text-sm text-muted-foreground">Payroll and accounting integration</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Disconnected</Badge>
                        <Button size="sm">Connect</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Backup & Export */}
            <TabsContent value="backup" className="space-y-6">
              <Card className="p-6">
                <h3 className="mb-4 flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Data Management
                </h3>
                <div className="space-y-6">
                  <div className="space-y-4">
                    <Label>Automatic Backups</Label>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">Enable automatic daily backups</p>
                        <p className="text-xs text-muted-foreground">Backups are stored securely and encrypted</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-4">
                    <Label>Manual Backup</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <Button variant="outline" className="gap-2">
                        <Download className="h-4 w-4" />
                        Download Full Backup
                      </Button>
                      <Button variant="outline" className="gap-2">
                        <Upload className="h-4 w-4" />
                        Restore from Backup
                      </Button>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-4">
                    <Label>Data Export</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <Button variant="outline" className="gap-2">
                        <Download className="h-4 w-4" />
                        Export Employee Data
                      </Button>
                      <Button variant="outline" className="gap-2">
                        <Download className="h-4 w-4" />
                        Export Attendance Records
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Button variant="outline" className="gap-2">
                        <Download className="h-4 w-4" />
                        Export Payroll Data
                      </Button>
                      <Button variant="outline" className="gap-2">
                        <Download className="h-4 w-4" />
                        Export Leave Records
                      </Button>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-4">
                    <Label className="text-destructive">Danger Zone</Label>
                    <div className="p-4 border border-destructive rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-destructive">Delete All Data</p>
                          <p className="text-sm text-muted-foreground">Permanently delete all company data. This action cannot be undone.</p>
                        </div>
                        <Button variant="destructive" className="gap-2">
                          <Trash2 className="h-4 w-4" />
                          Delete All Data
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}