import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Eye, EyeOff, Loader2, Lock, Mail, Scan } from 'lucide-react';
import { toast } from 'sonner';
import { loginUser, getEnrolledFaceProfiles, loginWithFace } from '../services/api';
import { FaceRecognitionModal } from './FaceRecognitionModal';
import logoImage from '../assets/60ace96c513e5568730553.png';

interface LoginProps {
    onLogin: (user: any) => void;
}

export function Login({ onLogin }: LoginProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Face Recognition Quick Login State
    const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
    const [enrolledFaceProfiles, setEnrolledFaceProfiles] = useState<any[]>([]);
    const [loadingFaces, setLoadingFaces] = useState(false);
    const [isQuickFaceEnabled, setIsQuickFaceEnabled] = useState<boolean>(() => {
        const stored = localStorage.getItem('quickFaceScanLoginEnabled');
        return stored !== null ? stored === 'true' : true;
    });

    useEffect(() => {
        const stored = localStorage.getItem('quickFaceScanLoginEnabled');
        setIsQuickFaceEnabled(stored !== null ? stored === 'true' : true);
    }, []);

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

    const handleStartFaceLogin = async () => {
        setLoadingFaces(true);
        try {
            const profiles = await getEnrolledFaceProfiles();
            if (!profiles || profiles.length === 0) {
                toast.error('No enrolled employee face photos found in database. Please log in with email/password and upload a biometric face photo in Employee Management.');
                return;
            }
            setEnrolledFaceProfiles(profiles);
            setIsFaceModalOpen(true);
        } catch (err: any) {
            toast.error('Could not load biometric face database');
        } finally {
            setLoadingFaces(false);
        }
    };

    const handleFaceVerified = async (matchedUser: any) => {
        if (!matchedUser || !matchedUser.faceImage || matchedUser.faceImage.length < 50) {
            toast.error('Unrecognized Face: Identity does not match any enrolled user photo.');
            return;
        }
        setLoading(true);
        try {
            const data = await loginWithFace(matchedUser);
            const empId = data._id || data.id || matchedUser._id || matchedUser.id;

            localStorage.setItem('enrolledFaceProfile', JSON.stringify({
                _id: empId,
                name: data.name || matchedUser.name,
                email: data.email || matchedUser.email,
                role: data.role || matchedUser.role,
                position: data.position || matchedUser.position,
                token: data.token,
                enrolledAt: new Date().toISOString()
            }));

            onLogin(data);
            toast.success(`✓ Biometric Face Verified! Welcome, ${data.name || matchedUser.name}!`);
        } catch (err: any) {
            toast.error(err.message || 'Biometric Face Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center login-clean-bg p-4 sm:p-6 relative overflow-hidden">
            {/* Fluid Floating Ambient Light Spotlights */}
            <div className="absolute top-1/4 left-1/3 w-[520px] h-[520px] bg-sky-500/20 rounded-full blur-[110px] pointer-events-none animate-float-slow" />
            <div className="absolute bottom-1/4 right-1/4 w-[480px] h-[480px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none animate-float-reverse" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[130px] pointer-events-none animate-pulse-glow" />

            <Card className="w-full max-w-sm login-card-modern login-card-entrance rounded-2xl relative z-10">
                <CardHeader className="space-y-4 text-center pb-2 pt-6">
                    <div className="flex justify-center">
                        <div className="h-12 w-auto px-4 py-1.5 rounded-xl bg-slate-950 flex items-center justify-center shadow-lg border border-slate-800 transition-transform duration-300 hover:scale-105">
                            <img
                                src={logoImage}
                                alt="VOID Logo"
                                className="h-7 w-auto max-w-[110px] object-contain brightness-110"
                            />
                        </div>
                    </div>
                    <div>
                        <CardTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Welcome to Attendance System</CardTitle>
                        <CardDescription className="text-slate-500 dark:text-slate-400 text-sm mt-1">Sign in to your account to continue</CardDescription>
                    </div>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4 pt-2 pb-6">
                        {/* Quick Face Scan Pill Button (Configurable from Admin Settings) */}
                        {isQuickFaceEnabled && (
                            <>
                                <Button
                                    type="button"
                                    onClick={handleStartFaceLogin}
                                    disabled={loading || loadingFaces}
                                    className="w-full h-12 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/90 shadow-md hover:shadow-lg rounded-full font-bold text-sm gap-3 transition-all cursor-pointer"
                                >
                                    {loadingFaces ? (
                                        <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                                    ) : (
                                        <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-200/60">
                                            <Scan className="h-4 w-4 text-emerald-600 animate-pulse" />
                                        </div>
                                    )}
                                    <span className="tracking-tight text-slate-800 font-bold">Quick Face Scan Login</span>
                                </Button>

                                <div className="relative flex items-center justify-center my-2">
                                    <div className="border-t border-slate-200 w-full" />
                                    <span className="bg-white px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider absolute">or</span>
                                </div>
                            </>
                        )}

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
                        <div className="pt-2 space-y-3">
                            <Button className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer" type="submit" disabled={loading}>
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

            {/* Biometric Face Recognition Login Modal */}
            <FaceRecognitionModal
                isOpen={isFaceModalOpen}
                onClose={() => setIsFaceModalOpen(false)}
                onVerified={handleFaceVerified}
                actionType="Login"
                enrolledEmployees={enrolledFaceProfiles}
            />
        </div>
    );
}
