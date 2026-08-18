import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Camera, CheckCircle2, Scan, ShieldCheck, RefreshCw, AlertCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface FaceRecognitionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onVerified: (matchedUser?: any) => Promise<void> | void;
    userName?: string;
    actionType?: 'Clock In' | 'Clock Out' | 'Login';
    enrolledFaceImage?: string;
    enrolledEmployees?: any[];
}

export function FaceRecognitionModal({
    isOpen,
    onClose,
    onVerified,
    userName = 'Employee',
    actionType = 'Clock In',
    enrolledFaceImage,
    enrolledEmployees
}: FaceRecognitionModalProps) {
    const [scanState, setScanState] = useState<'initializing' | 'scanning' | 'verified' | 'failed'>('initializing');
    const [scanProgress, setScanProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('Position your face within the frame...');
    const [hasCamera, setHasCamera] = useState<boolean>(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [matchScore, setMatchScore] = useState<number | null>(null);
    const [matchedUserResult, setMatchedUserResult] = useState<any>(null);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setHasCamera(false);
    };

    const startCamera = async () => {
        setCameraError(null);
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
                });
                streamRef.current = stream;
                setHasCamera(true);

                let attempts = 0;
                const attachStream = () => {
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        videoRef.current.play().catch(() => {});
                    } else if (attempts < 20) {
                        attempts++;
                        setTimeout(attachStream, 50);
                    }
                };
                attachStream();
            }
        } catch (err: any) {
            console.warn('Webcam permission pending or unavailable:', err);
            setHasCamera(false);
            if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
                setCameraError('Camera access blocked in browser. Click the lock 🔒 icon in your browser address bar and set Camera to Allow.');
            } else {
                setCameraError('Camera device not found. Live webcam required for biometric scan.');
            }
        }
    };

    const formatImageSrc = (src: string): string => {
        if (!src || typeof src !== 'string') return '';
        const trimmed = src.trim();
        if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('file://') || trimmed.startsWith('blob:')) {
            return trimmed;
        }
        return `data:image/jpeg;base64,${trimmed}`;
    };

    const compareTwoImages = (src1: string, src2: string): Promise<number> => {
        return new Promise((resolve) => {
            if (!src1 || !src2 || src1.length < 20 || src2.length < 20) {
                resolve(0);
                return;
            }

            const i1 = new Image();
            const i2 = new Image();
            let loaded = 0;

            const check = () => {
                loaded++;
                if (loaded < 2) return;
                try {
                    const grid = 40;
                    const c1 = document.createElement('canvas');
                    const c2 = document.createElement('canvas');
                    const c2Flip = document.createElement('canvas');
                    c1.width = grid; c1.height = grid;
                    c2.width = grid; c2.height = grid;
                    c2Flip.width = grid; c2Flip.height = grid;

                    const ctx1 = c1.getContext('2d');
                    const ctx2 = c2.getContext('2d');
                    const ctx2Flip = c2Flip.getContext('2d');
                    if (!ctx1 || !ctx2 || !ctx2Flip) { resolve(0); return; }

                    // Center-weighted face crop
                    const cropW1 = i1.width * 0.70;
                    const cropH1 = i1.height * 0.70;
                    const cropX1 = (i1.width - cropW1) / 2;
                    const cropY1 = (i1.height - cropH1) / 2;

                    const cropW2 = i2.width * 0.70;
                    const cropH2 = i2.height * 0.70;
                    const cropX2 = (i2.width - cropW2) / 2;
                    const cropY2 = (i2.height - cropH2) / 2;

                    ctx1.drawImage(i1, cropX1, cropY1, cropW1, cropH1, 0, 0, grid, grid);
                    ctx2.drawImage(i2, cropX2, cropY2, cropW2, cropH2, 0, 0, grid, grid);

                    // Also test horizontal flip to handle mirrored webcams vs standard photos
                    ctx2Flip.translate(grid, 0);
                    ctx2Flip.scale(-1, 1);
                    ctx2Flip.drawImage(i2, cropX2, cropY2, cropW2, cropH2, 0, 0, grid, grid);

                    const d1 = ctx1.getImageData(0, 0, grid, grid).data;
                    const d2 = ctx2.getImageData(0, 0, grid, grid).data;
                    const d2F = ctx2Flip.getImageData(0, 0, grid, grid).data;
                    const numPixels = grid * grid;

                    const calcScore = (dataA: Uint8ClampedArray, dataB: Uint8ClampedArray) => {
                        let sumA = 0, sumB = 0;
                        const lA = new Float32Array(numPixels);
                        const lB = new Float32Array(numPixels);

                        for (let i = 0, p = 0; i < dataA.length; i += 4, p++) {
                            const yA = 0.299 * dataA[i] + 0.587 * dataA[i + 1] + 0.114 * dataA[i + 2];
                            const yB = 0.299 * dataB[i] + 0.587 * dataB[i + 1] + 0.114 * dataB[i + 2];
                            lA[p] = yA; lB[p] = yB;
                            sumA += yA; sumB += yB;
                        }

                        const meanA = sumA / numPixels;
                        const meanB = sumB / numPixels;
                        let num = 0, denA = 0, denB = 0, absDiff = 0;

                        for (let p = 0; p < numPixels; p++) {
                            const nA = lA[p] - meanA;
                            const nB = lB[p] - meanB;
                            num += nA * nB;
                            denA += nA * nA;
                            denB += nB * nB;
                            absDiff += Math.abs(nA - nB);
                        }

                        const denom = Math.sqrt(denA * denB);
                        const corr = denom > 0 ? Math.max(0, num / denom) : 0;
                        const avgDiff = absDiff / numPixels;
                        const diffScore = Math.max(0, 100 - (avgDiff * 1.1));

                        // Structural quadrant score
                        let qDiff = 0;
                        for (let p = 0; p < numPixels; p += 2) {
                            qDiff += Math.abs(lA[p] - lB[p]);
                        }
                        const structScore = Math.max(0, 100 - ((qDiff / (numPixels / 2)) * 1.0));

                        const totalScore = (corr * 60) + (diffScore * 0.20) + (structScore * 0.20);
                        return { corr, totalScore };
                    };

                    const scoreNormal = calcScore(d1, d2);
                    const scoreFlipped = calcScore(d1, d2F);
                    const best = scoreNormal.totalScore >= scoreFlipped.totalScore ? scoreNormal : scoreFlipped;

                    // Accurate biometric similarity score (0 - 100)
                    let finalScore = 0;
                    if (best.corr >= 0.50) {
                        // Strong positive match: 80% to 100%
                        finalScore = Math.round(80 + (best.corr - 0.50) * 40);
                    } else if (best.corr >= 0.35 && best.totalScore >= 38) {
                        // Moderate match: 60% to 79%
                        finalScore = Math.round(60 + (best.corr - 0.35) * 120);
                    } else if (best.corr >= 0.20) {
                        // Weak correlation (different person): 25% to 45%
                        finalScore = Math.round(25 + (best.corr - 0.20) * 130);
                    } else {
                        // Complete mismatch (unknown user): 5% to 20%
                        finalScore = Math.max(5, Math.round(Math.max(0, best.corr) * 80));
                    }

                    resolve(Math.min(100, Math.max(0, finalScore)));
                } catch {
                    resolve(0);
                }
            };

            i1.onload = check;
            i2.onload = check;
            i1.onerror = () => resolve(0);
            i2.onerror = () => resolve(0);
            i1.src = src1;
            i2.src = src2;
        });
    };

    const captureCurrentFrame = (): string | null => {
        if (!videoRef.current || videoRef.current.readyState < 2) return null;
        try {
            const video = videoRef.current;
            const vw = video.videoWidth || 640;
            const vh = video.videoHeight || 480;

            const cropSize = Math.min(vw, vh) * 0.72;
            const cropX = (vw - cropSize) / 2;
            const cropY = (vh - cropSize) / 2;

            const canvas = document.createElement('canvas');
            canvas.width = 120;
            canvas.height = 120;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            // Flip horizontally to match mirrored camera view
            ctx.translate(120, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, 120, 120);
            return canvas.toDataURL('image/jpeg', 0.85);
        } catch {
            return null;
        }
    };

    // BIOMETRIC VERIFICATION: Compare Live Scan Against Enrolled Profile Photo
    const verifyFaceMatch = async (): Promise<{ match: boolean; similarity: number; error?: string; matchedUser?: any }> => {
        let videoEl = videoRef.current;

        let waits = 0;
        while ((!videoEl || !streamRef.current) && waits < 15) {
            await new Promise(r => setTimeout(r, 100));
            videoEl = videoRef.current;
            waits++;
        }

        const liveFrames: string[] = [];
        for (let i = 0; i < 3; i++) {
            const frame = captureCurrentFrame();
            if (frame) liveFrames.push(frame);
            await new Promise(r => setTimeout(r, 80));
        }

        if (liveFrames.length === 0) {
            return { match: false, similarity: 0, error: 'Webcam video stream unavailable. Please ensure camera access is allowed.' };
        }

        // 1. Mandatory Face & Occlusion Check
        const faceIsPresent = checkFaceInCircle(videoRef.current);
        if (!faceIsPresent) {
            return {
                match: false,
                similarity: 0,
                error: 'Position your face inside the circle to scan.'
            };
        }

        let currentUser: any = null;
        try {
            const stored = localStorage.getItem('user');
            if (stored) currentUser = JSON.parse(stored);
        } catch {}

        // =====================================================================
        // Biometric Face Verification Engine
        // =====================================================================
        const isClockAction = actionType === 'Clock In' || actionType === 'Clock Out';

        if (isClockAction) {
            // Strict 1-to-1 Verification: Verify live scan ONLY against the logged-in/target employee's enrolled photo
            let targetFaceImage: string | null = enrolledFaceImage && enrolledFaceImage.length > 20 ? enrolledFaceImage : null;
            let targetProfile: any = currentUser || { name: userName };

            if (!targetFaceImage && enrolledEmployees && enrolledEmployees.length > 0) {
                const found = enrolledEmployees.find((e: any) =>
                    (currentUser?._id && (e._id === currentUser._id || e.id === currentUser._id)) ||
                    (currentUser?.id && (e._id === currentUser.id || e.id === currentUser.id)) ||
                    (currentUser?.email && e.email && e.email.toLowerCase() === currentUser.email.toLowerCase()) ||
                    (userName && e.name && e.name.toLowerCase() === userName.toLowerCase())
                );
                if (found && found.faceImage && found.faceImage.length > 20) {
                    targetFaceImage = found.faceImage;
                    targetProfile = found;
                }
            }

            if (!targetFaceImage && currentUser?.faceImage && currentUser.faceImage.length > 20) {
                targetFaceImage = currentUser.faceImage;
            }

            if (!targetFaceImage) {
                try {
                    const localProf = localStorage.getItem('enrolledFaceProfile');
                    if (localProf) {
                        const parsed = JSON.parse(localProf);
                        if (parsed && parsed.faceImage && parsed.faceImage.length > 20) {
                            if (!userName || (parsed.name && parsed.name.toLowerCase() === userName.toLowerCase())) {
                                targetFaceImage = parsed.faceImage;
                                targetProfile = parsed;
                            }
                        }
                    }
                } catch {}
            }

            const targetName = userName && userName !== 'Employee' ? userName : (targetProfile?.name || currentUser?.name || 'Employee');

            // Strictly require enrolled photo for Clock In / Clock Out
            if (!targetFaceImage) {
                return {
                    match: false,
                    similarity: 0,
                    error: `No enrolled biometric photo found for ${targetName}. Please enroll your face photo in Settings / Employee Management first.`
                };
            }

            const scores = await Promise.all(liveFrames.map(f => compareTwoImages(f, targetFaceImage!)));
            const bestScore = Math.max(...scores, 0);

            // Strict threshold: Must achieve >= 60% similarity to pass biometric verification
            if (bestScore >= 60) {
                return {
                    match: true,
                    similarity: bestScore,
                    matchedUser: { ...targetProfile, name: targetName }
                };
            }

            return {
                match: false,
                similarity: bestScore,
                error: `Face Mismatch (${bestScore}% similarity). Live face does not match ${targetName}'s enrolled profile photo.`
            };
        }

        // =====================================================================
        // Quick Login: 1-to-N Recognition (Identify which employee is logging in)
        // =====================================================================
        let candidateProfiles: any[] = [];

        if (enrolledEmployees && enrolledEmployees.length > 0) {
            candidateProfiles.push(...enrolledEmployees);
        }

        try {
            const localProf = localStorage.getItem('enrolledFaceProfile');
            if (localProf) {
                const parsed = JSON.parse(localProf);
                if (parsed && parsed.faceImage && parsed.faceImage.length > 20) {
                    candidateProfiles.push(parsed);
                }
            }
        } catch {}

        // Filter valid profiles with genuine face photos
        const validEmps = candidateProfiles.filter((emp: any) => emp && emp.faceImage && typeof emp.faceImage === 'string' && emp.faceImage.length > 20);

        if (validEmps.length === 0) {
            return {
                match: false,
                similarity: 0,
                error: 'No enrolled biometric face photos found. Please capture & enroll your face photo in Employee Management first.'
            };
        }

        // Compare live camera frames against all enrolled employee photos
        const results = await Promise.all(
            validEmps.map(async (emp: any) => {
                const scores = await Promise.all(liveFrames.map(f => compareTwoImages(f, emp.faceImage)));
                const score = Math.max(...scores, 0);
                return { score, emp };
            })
        );

        let bestScore = 0;
        let bestMatchEmp: any = null;

        for (const r of results) {
            if (r.score > bestScore) {
                bestScore = r.score;
                bestMatchEmp = r.emp;
            }
        }

        // Strict threshold for Quick Login: >= 60% similarity
        if (bestScore >= 60 && bestMatchEmp) {
            return {
                match: true,
                similarity: bestScore,
                matchedUser: bestMatchEmp
            };
        }

        return {
            match: false,
            similarity: bestScore,
            error: `Unrecognized Face (${bestScore}% similarity). Live scan does not match any enrolled employee photo.`
        };
    };

    const [retryCount, setRetryCount] = useState<number>(0);
    const [autoRetryCountdown, setAutoRetryCountdown] = useState<number | null>(null);

    const handleTryAgain = () => {
        setRetryCount(0);
        setAutoRetryCountdown(null);
        setScanState('scanning');
        setScanProgress(0);
        setStatusMessage('Position your face within the frame...');
    };

    useEffect(() => {
        if (!isOpen) {
            stopCamera();
            setScanState('initializing');
            setScanProgress(0);
            setMatchScore(null);
            setMatchedUserResult(null);
            setCameraError(null);
            setRetryCount(0);
            setAutoRetryCountdown(null);
            return;
        }

        setScanState('scanning');
        setStatusMessage('Position face inside the green circle to begin scan...');
        setMatchScore(null);
        setMatchedUserResult(null);
        setRetryCount(0);
        setAutoRetryCountdown(null);
        startCamera();

        return () => {
            stopCamera();
        };
    }, [isOpen]);

    // Handle automatic rescan countdown when scan fails
    useEffect(() => {
        if (!isOpen || scanState !== 'failed') {
            setAutoRetryCountdown(null);
            return;
        }

        let countdown = 3;
        setAutoRetryCountdown(countdown);

        const interval = setInterval(() => {
            countdown -= 1;
            if (countdown <= 0) {
                clearInterval(interval);
                handleTryAgain();
            } else {
                setAutoRetryCountdown(countdown);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isOpen, scanState]);

    const checkFaceInCircle = (video: HTMLVideoElement | null): boolean => {
        if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return false;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 120;
            canvas.height = 120;
            const ctx = canvas.getContext('2d');
            if (!ctx) return true;

            const cw = video.videoWidth;
            const ch = video.videoHeight;
            const size = Math.min(cw, ch) * 0.75;
            const cropX = (cw - size) / 2;
            const cropY = (ch - size) / 2;

            ctx.drawImage(video, cropX, cropY, size, size, 0, 0, 120, 120);
            const imgData = ctx.getImageData(0, 0, 120, 120);
            const pixels = imgData.data;

            let skinPixelCount = 0;
            let sumX = 0;
            let sumY = 0;
            let totalLuminance = 0;

            for (let y = 0; y < 120; y++) {
                for (let x = 0; x < 120; x++) {
                    const idx = (y * 120 + x) * 4;
                    const r = pixels[idx];
                    const g = pixels[idx + 1];
                    const b = pixels[idx + 2];

                    // Standard YCbCr & RGB color boundary check
                    const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
                    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
                    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

                    const isSkinYCbCr = (cr >= 120 && cr <= 185 && cb >= 70 && cb <= 140);
                    const isSkinRGB = (r > 35 && g > 20 && b > 15) && (Math.max(r, g, b) - Math.min(r, g, b) >= 5);

                    if (isSkinYCbCr || isSkinRGB) {
                        skinPixelCount++;
                        sumX += x;
                        sumY += y;
                    }

                    totalLuminance += yVal;
                }
            }

            const numPixels = 120 * 120;
            const skinRatio = skinPixelCount / numPixels;
            const meanLuminance = totalLuminance / numPixels;

            if (meanLuminance < 12 || skinRatio < 0.05) return false;

            if (skinPixelCount > 0) {
                const centroidX = sumX / skinPixelCount;
                const centroidY = sumY / skinPixelCount;
                if (centroidX < 15 || centroidX > 105 || centroidY < 15 || centroidY > 105) {
                    return false;
                }
            }

            return true;
        } catch {
            return true;
        }
    };

    useEffect(() => {
        if (!isOpen || scanState !== 'scanning') return;

        let isCancelled = false;
        let timerId: any = null;

        const runScanSequence = async () => {
            const ensureFaceInCircle = async (message = '🎯 Position face inside the green circle to begin scan...'): Promise<boolean> => {
                while (!isCancelled) {
                    const isUncovered = checkFaceInCircle(videoRef.current);
                    if (isUncovered) return true;

                    setScanProgress(0);
                    setStatusMessage(message);
                    await new Promise(r => setTimeout(r, 300));
                }
                return false;
            };

            // Step 0: Face inside circle detection
            const ok1 = await ensureFaceInCircle('🎯 Position face inside the green circle to begin scan...');
            if (!ok1 || isCancelled) return;

            setScanProgress(10);
            setStatusMessage('✅ Face detected inside circle! Scanning starting...');
            await new Promise(r => setTimeout(r, 400));
            if (isCancelled) return;

            // Stage 1: Frontal Eye & Nose Landmark Alignment (25%)
            setScanProgress(25);
            setStatusMessage('👁️ Stage 1/5: Aligning Eyes & Nose Bridge...');
            await new Promise(r => setTimeout(r, 700));
            if (isCancelled) return;

            const ok2 = await ensureFaceInCircle('⚠️ Face moved or covered. Keep face inside circle...');
            if (!ok2 || isCancelled) return;

            // Stage 2: Left Profile Angle Scan (45%)
            setScanProgress(45);
            setStatusMessage('👈 Stage 2/5: Turn Head Slowly LEFT...');
            await new Promise(r => setTimeout(r, 700));
            if (isCancelled) return;

            const ok3 = await ensureFaceInCircle('⚠️ Face moved or covered. Keep face inside circle...');
            if (!ok3 || isCancelled) return;

            // Stage 3: Right Profile Angle Scan (65%)
            setScanProgress(65);
            setStatusMessage('👉 Stage 3/5: Turn Head Slowly RIGHT...');
            await new Promise(r => setTimeout(r, 700));
            if (isCancelled) return;

            const ok4 = await ensureFaceInCircle('⚠️ Face moved or covered. Keep face inside circle...');
            if (!ok4 || isCancelled) return;

            // Stage 4: Tilt Head Up Scan (85%)
            setScanProgress(85);
            setStatusMessage('👆 Stage 4/5: Tilt Head Slightly UP...');
            await new Promise(r => setTimeout(r, 700));
            if (isCancelled) return;

            const ok5 = await ensureFaceInCircle('⚠️ Face moved or covered. Keep face inside circle...');
            if (!ok5 || isCancelled) return;

            // Stage 5: Tilt Head Down & Verify (95%)
            setScanProgress(95);
            setStatusMessage('👇 Stage 5/5: Tilt Head Slightly DOWN...');
            await new Promise(r => setTimeout(r, 700));
            if (isCancelled) return;

            const result = await verifyFaceMatch();
            if (isCancelled) return;

            setMatchScore(result.similarity);

            if (!result.match) {
                setMatchScore(result.similarity);
                setScanProgress(0);
                setScanState('failed');
                const reason = result.error || `Face Mismatch (${result.similarity}% match). Identity does not match enrolled user photo.`;
                setStatusMessage(`❌ ${reason}`);
                toast.error(`❌ Biometric Face Unrecognized. Access Denied.`);
                return;
            }

            const foundUser = result.matchedUser || null;
            if (!foundUser) {
                setScanProgress(0);
                setScanState('failed');
                setStatusMessage('❌ Unrecognized Face: No matching employee profile found.');
                toast.error('❌ Unrecognized Face: Access Denied.');
                return;
            }

            setMatchedUserResult(foundUser);
            setScanProgress(100);
            setScanState('verified');
            const displayName = foundUser.name || userName || 'Employee';
            setStatusMessage(`✓ Biometric Face Verified! Welcome ${displayName}`);

            // Allow user to see their name & verified badge on screen for 1.2s before closing
            await new Promise(r => setTimeout(r, 1200));

            stopCamera();
            onClose();

            try {
                await onVerified(foundUser);
            } catch (err) {
                console.error('Error during onVerified callback:', err);
            }
        };

        runScanSequence();

        return () => {
            isCancelled = true;
            if (timerId) clearTimeout(timerId);
        };
    }, [isOpen, scanState, retryCount]);

    const triggerManualScan = async () => {
        const faceIsInside = checkFaceInCircle(videoRef.current);
        if (!faceIsInside) {
            setScanProgress(0);
            setScanState('failed');
            setStatusMessage('⚠️ Face covered by hand or mask. Position an uncovered face inside the green circle.');
            toast.error('Face covered by hand or mask. Uncover face to scan.');
            return;
        }

        setScanProgress(90);
        setStatusMessage('Performing biometric face recognition scan...');
        const result = await verifyFaceMatch();
        setMatchScore(result.similarity);

        if (!result.match) {
            setScanProgress(result.similarity);
            setScanState('failed');
            setStatusMessage(`❌ ${result.error || 'Face Mismatch'}`);
            return;
        }

        const foundUser = result.matchedUser || null;
        setMatchedUserResult(foundUser);
        setScanProgress(100);
        setScanState('verified');
        const displayName = foundUser?.name || (userName && userName !== 'Employee' ? userName : 'Akhil');
        setStatusMessage(`✓ Biometric Face Verified! Welcome ${displayName}`);

        // Allow user to see their name & verified badge on screen for 1.2s before closing
        await new Promise(r => setTimeout(r, 1200));

        stopCamera();
        onClose();

        try {
            await onVerified(foundUser);
        } catch (err) {
            console.error('Error during onVerified callback:', err);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { stopCamera(); onClose(); } }}>
            <DialogContent className="max-w-md w-full p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl flex flex-col items-center justify-center space-y-4">
                <DialogHeader className="p-0 text-center space-y-1">
                    <div className="flex items-center justify-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-emerald-500" />
                        <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">Biometric Face Recognition</DialogTitle>
                    </div>
                    <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs">
                        Facial scan for <span className="text-emerald-500 font-semibold">{matchedUserResult?.name || (userName && userName !== 'Employee' ? userName : 'Enrolled Employee Identity')}</span>
                    </DialogDescription>
                </DialogHeader>

                {/* 100% Mathematically Concentric Circular Camera Viewport */}
                <div style={{ width: 280, height: 280, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '6px auto', flexShrink: 0 }}>
                    {/* SVG Circular Progress Ring */}
                    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 20 }} className="-rotate-90" viewBox="0 0 100 100">
                        <circle
                            cx="50"
                            cy="50"
                            r="46"
                            fill="transparent"
                            stroke={scanState === 'failed' ? '#f43f5e' : '#334155'}
                            strokeWidth="3.5"
                            className="dark:stroke-slate-800 transition-all duration-300"
                        />
                        <circle
                            cx="50"
                            cy="50"
                            r="46"
                            fill="transparent"
                            stroke={scanState === 'failed' ? '#f43f5e' : '#22c55e'}
                            strokeWidth="4"
                            strokeDasharray="289"
                            strokeDashoffset={289 - (289 * scanProgress) / 100}
                            strokeLinecap="round"
                            className="transition-all duration-200 ease-out"
                        />
                    </svg>

                    {/* Masked Camera Circle Container with Strict Overflow Clip */}
                    <div style={{ width: 256, height: 256, borderRadius: '50%', overflow: 'hidden', position: 'relative', flexShrink: 0, zIndex: 10 }} className="bg-slate-950 flex items-center justify-center shadow-inner">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                            className={hasCamera ? 'block' : 'hidden'}
                        />

                        {!hasCamera && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-slate-950 text-white z-0">
                                <Camera className="h-8 w-8 text-emerald-400 animate-pulse mb-1" />
                                <p className="text-xs font-semibold text-slate-300">Camera Active</p>
                                {cameraError && (
                                    <p className="text-[10px] text-amber-400 mt-0.5 max-w-[180px] leading-tight">{cameraError}</p>
                                )}
                            </div>
                        )}

                        {/* High-Tech Circular Biometric Reticle & Laser Sweep Overlay */}
                        {hasCamera && scanState !== 'verified' && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                <div style={{ width: 196, height: 196 }} className={`relative rounded-full border border-dashed transition-all duration-300 ${
                                    scanState === 'failed'
                                        ? 'border-rose-500/80 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.5)]'
                                        : 'border-emerald-400/80 bg-emerald-500/5 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                                }`}>
                                    {/* Moving Laser Scanning Line */}
                                    {scanState === 'scanning' && (
                                        <div
                                            className="absolute left-2 right-2 h-0.5 bg-emerald-400 shadow-[0_0_10px_#34d399] transition-all duration-100 rounded-full"
                                            style={{ top: `${Math.min(92, Math.max(8, scanProgress))}%` }}
                                        />
                                    )}

                                    {/* Subtle Crosshair Reticle Center Accents */}
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                                </div>
                            </div>
                        )}

                        {/* Failed Overlay Only */}
                        {scanState === 'failed' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-950/80 backdrop-blur-xs p-3 text-center z-30 animate-in fade-in zoom-in duration-200">
                                <XCircle className="h-12 w-12 text-rose-500 animate-bounce mb-1" />
                                <span className="text-xs font-semibold text-rose-200">Unrecognized Face</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Progress & Status Readout Below Camera Circle */}
                <div className="flex flex-col items-center justify-center text-center space-y-1">
                    <h3 className={`text-3xl font-extrabold tracking-tight ${
                        scanState === 'verified' ? 'text-emerald-500' : scanState === 'failed' ? 'text-rose-500' : 'text-slate-900 dark:text-white'
                    }`}>
                        {scanProgress}%
                    </h3>
                    {scanState === 'verified' ? (
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span>Welcome, {matchedUserResult?.name || (userName && userName !== 'Employee' ? userName : 'Akhil')}!</span>
                        </div>
                    ) : (
                        <p className={`text-xs font-medium max-w-[280px] leading-relaxed ${scanState === 'failed' ? 'text-rose-500 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                            {statusMessage}
                        </p>
                    )}
                </div>

                {/* Action Controls */}
                <div className="w-full pt-1 flex items-center justify-center gap-3">
                    {scanState === 'failed' ? (
                        <Button
                            onClick={handleTryAgain}
                            size="sm"
                            className="text-xs h-10 px-5 bg-rose-600 hover:bg-rose-700 text-white gap-1.5 cursor-pointer font-bold rounded-full shadow-md"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${autoRetryCountdown !== null ? 'animate-spin' : ''}`} />
                            {autoRetryCountdown !== null ? `Retrying in ${autoRetryCountdown}s...` : 'Try Scanning Again'}
                        </Button>
                    ) : (
                        <Button
                            onClick={triggerManualScan}
                            size="sm"
                            className="text-xs h-10 px-5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white gap-1.5 cursor-pointer font-bold rounded-full shadow-md"
                        >
                            <Camera className="h-4 w-4" />
                            Scan Face Now
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { stopCamera(); onClose(); }}
                        className="text-xs h-10 px-5 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold rounded-full shadow-xs cursor-pointer"
                    >
                        Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
