import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
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
  Smartphone
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
          <Button className="gap-2" onClick={() => toast.success("Settings saved successfully")}>
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className={`grid w-full ${userRole === 'superadmin' ? 'grid-cols-6' : 'grid-cols-3'}`}>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          {userRole === 'superadmin' && (
            <>
              <TabsTrigger value="company">Company</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
              <TabsTrigger value="backup">Backup</TabsTrigger>
            </>
          )}
        </TabsList>

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
                {userRole === 'superadmin' && (
                  <div className="space-y-2">
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

        {/* Admin Only Tabs */}
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
                      <Input id="companyName" defaultValue="MTOR" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyEmail">Company Email</Label>
                      <Input id="companyEmail" type="email" defaultValue="contact@mtor.com" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="companyPhone">Company Phone</Label>
                      <Input id="companyPhone" defaultValue="+1 (555) 123-4567" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input id="website" defaultValue="https://www.mtor.com" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Company Address</Label>
                    <Input id="address" defaultValue="123 Business St, San Francisco, CA 94105" />
                  </div>
                  <Separator />
                  <div className="space-y-4">
                    <Label>Working Hours</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="workStart">Work Start Time</Label>
                        <Input id="workStart" type="time" defaultValue="09:00" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="workEnd">Work End Time</Label>
                        <Input id="workEnd" type="time" defaultValue="17:00" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label>Leave Policies</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vacationDays">Annual Vacation Days</Label>
                        <Input id="vacationDays" type="number" defaultValue="25" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sickDays">Sick Leave Days</Label>
                        <Input id="sickDays" type="number" defaultValue="10" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="personalDays">Personal Days</Label>
                        <Input id="personalDays" type="number" defaultValue="5" />
                      </div>
                    </div>
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