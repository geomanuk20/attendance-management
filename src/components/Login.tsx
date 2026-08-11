import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { loginUser } from '../services/api';

interface LoginProps {
    onLogin: (user: any) => void;
}

export function Login({ onLogin }: LoginProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const performLogin = async (targetEmail: string, targetPass: string) => {
        setLoading(true);
        try {
            const data = await loginUser(targetEmail || 'admin@company.com', targetPass || 'admin');
            
            // Save enrolled profile for future Quick Face ID logins
            localStorage.setItem('enrolledFaceProfile', JSON.stringify({
                _id: data._id,
                name: data.name,
                email: data.email,
                role: data.role,
                position: data.position,
                token: data.token,
                enrolledAt: new Date().toISOString()
            }));

            onLogin(data);
            toast.success(`Welcome back, ${data.name}!`);
        } catch (error: any) {
            console.error('Login error:', error);
            toast.error(error.message || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error('Please enter email and password');
            return;
        }
        await performLogin(email, password);
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4 sm:p-6">
            <Card className="w-full max-w-sm shadow-md border border-slate-200/80 bg-white rounded-xl">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-xl font-bold tracking-tight text-slate-900">Welcome to Attendance System</CardTitle>
                    <CardDescription className="text-slate-500 text-sm">Sign in to your account to continue</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4 pt-2 pb-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email</Label>
                            <div className="relative flex items-center">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@company.com"
                                    className="pl-10 h-10 border-slate-200 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-0 text-slate-900 placeholder:text-slate-400 w-full"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium text-slate-700">Password</Label>
                            <div className="relative flex items-center">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    className="pl-10 pr-10 h-10 border-slate-200 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-0 text-slate-900 placeholder:text-slate-400 w-full"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none z-10 cursor-pointer p-1"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4 text-slate-500" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-slate-500" />
                                    )}
                                </button>
                            </div>
                        </div>
                        <div className="pt-4 space-y-3">
                            <Button className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-semibold" type="submit" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </form>
            </Card>
        </div>
    );
}
