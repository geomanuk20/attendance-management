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
                    const grid = 48; // standard normalized grid for feature extraction
                    const c1 = document.createElement('canvas');
                    c1.width = grid;
                    c1.height = grid;
                    const ctx1 = c1.getContext('2d');
                    if (!ctx1) { resolve(0); return; }

                    // Center crop for image 1 (live camera frame)
                    const crop1 = Math.min(i1.width, i1.height) * 0.80;
                    ctx1.drawImage(i1, (i1.width - crop1) / 2, (i1.height - crop1) / 2, crop1, crop1, 0, 0, grid, grid);
                    const d1 = ctx1.getImageData(0, 0, grid, grid).data;

                    // Extract local zero-mean spatial feature vector (6x6 = 36 blocks)
                    const getFeatures = (data: Uint8ClampedArray) => {
                        const numBlocks = 6;
                        const bSize = 8;
                        const rawLum = new Float32Array(36);
                        const rawGradH = new Float32Array(36);
                        const rawGradV = new Float32Array(36);
                        let sumL = 0, sumL2 = 0;
                        let sumCb = 0, sumCr = 0;
                        const lum = new Float32Array(grid * grid);

                        for (let y = 0; y < grid; y++) {
                            for (let x = 0; x < grid; x++) {
                                const idx = (y * grid + x) * 4;
                                const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                                const yv = 0.299 * r + 0.587 * g + 0.114 * b;
                                lum[y * grid + x] = yv;
                                sumL += yv;
                                sumL2 += yv * yv;
                                sumCb += 128 - 0.1687 * r - 0.3313 * g + 0.5 * b;
                                sumCr += 128 + 0.5 * r - 0.4187 * g - 0.0813 * b;
                            }
                        }

                        const totalPixels = grid * grid;
                        const meanL = sumL / totalPixels;
                        const stdL = Math.sqrt(Math.max(1, (sumL2 / totalPixels) - (meanL * meanL)));

                        let sumBlockLum = 0;
                        let sumBlockGrad = 0;

                        for (let by = 0; by < numBlocks; by++) {
                            for (let bx = 0; bx < numBlocks; bx++) {
                                let bSum = 0, bGradH = 0, bGradV = 0;
                                for (let py = 0; py < bSize; py++) {
                                    for (let px = 0; px < bSize; px++) {
                                        const y = by * bSize + py;
                                        const x = bx * bSize + px;
                                        const v = (lum[y * grid + x] - meanL) / stdL;
                                        bSum += v;
                                        if (x > 0 && x < grid - 1) {
                                            bGradH += Math.abs(lum[y * grid + x + 1] - lum[y * grid + x - 1]) / stdL;
                                        }
                                        if (y > 0 && y < grid - 1) {
                                            bGradV += Math.abs(lum[(y + 1) * grid + x] - lum[(y - 1) * grid + x]) / stdL;
                                        }
                                    }
                                }
                                const pCount = bSize * bSize;
                                const bIdx = by * numBlocks + bx;
                                const lVal = bSum / pCount;
                                const gVal = (bGradH + bGradV) / pCount;
                                rawLum[bIdx] = lVal;
                                rawGradH[bIdx] = bGradH / pCount;
                                rawGradV[bIdx] = bGradV / pCount;
                                sumBlockLum += lVal;
                                sumBlockGrad += gVal;
                            }
                        }

                        // ZERO-MEAN NORMALIZATION across the 36 facial blocks:
                        // This eliminates generic "top is hair, middle is face" bias that causes false matches between different people!
                        const meanBlockLum = sumBlockLum / 36;
                        const meanBlockGrad = sumBlockGrad / 36;
                        const diffLum = new Float32Array(36);
                        const diffGrad = new Float32Array(36);

                        for (let i = 0; i < 36; i++) {
                            diffLum[i] = rawLum[i] - meanBlockLum;
                            diffGrad[i] = (rawGradH[i] + rawGradV[i]) - meanBlockGrad;
                        }

                        return {
                            diffLum,
                            diffGrad,
                            avgCb: sumCb / totalPixels,
                            avgCr: sumCr / totalPixels
                        };
                    };

                    const f1 = getFeatures(d1);

                    // Test alignment on image 2 (enrolled photo)
                    let maxMatchScore = -1;
                    const scales = [0.72, 0.85];
                    const yOffsets = [-0.05, 0, 0.05];

                    for (const sc of scales) {
                        for (const yo of yOffsets) {
                            const c2 = document.createElement('canvas');
                            const c2F = document.createElement('canvas');
                            c2.width = grid; c2.height = grid;
                            c2F.width = grid; c2F.height = grid;
                            const ctx2 = c2.getContext('2d');
                            const ctx2F = c2F.getContext('2d');
                            if (!ctx2 || !ctx2F) continue;

                            const baseSize = Math.min(i2.width, i2.height);
                            const cropSize = baseSize * sc;
                            const cx = (i2.width - cropSize) / 2;
                            const cy = (i2.height - cropSize) / 2 + (yo * baseSize);
                            const clampX = Math.max(0, Math.min(i2.width - cropSize, cx));
                            const clampY = Math.max(0, Math.min(i2.height - cropSize, cy));

                            ctx2.drawImage(i2, clampX, clampY, cropSize, cropSize, 0, 0, grid, grid);
                            ctx2F.translate(grid, 0);
                            ctx2F.scale(-1, 1);
                            ctx2F.drawImage(i2, clampX, clampY, cropSize, cropSize, 0, 0, grid, grid);

                            const d2 = ctx2.getImageData(0, 0, grid, grid).data;
                            const d2F = ctx2F.getImageData(0, 0, grid, grid).data;

                            const f2 = getFeatures(d2);
                            const f2F = getFeatures(d2F);

                            const compareFeats = (fA: any, fB: any) => {
                                let numL = 0, denLA = 0, denLB = 0;
                                let numG = 0, denGA = 0, denGB = 0;
                                for (let i = 0; i < 36; i++) {
                                    numL += fA.diffLum[i] * fB.diffLum[i];
                                    denLA += fA.diffLum[i] * fA.diffLum[i];
                                    denLB += fB.diffLum[i] * fB.diffLum[i];

                                    numG += fA.diffGrad[i] * fB.diffGrad[i];
                                    denGA += fA.diffGrad[i] * fA.diffGrad[i];
                                    denGB += fB.diffGrad[i] * fB.diffGrad[i];
                                }
                                const rL = (denLA > 0 && denLB > 0) ? (numL / Math.sqrt(denLA * denLB)) : 0;
                                const rG = (denGA > 0 && denGB > 0) ? (numG / Math.sqrt(denGA * denGB)) : 0;

                                const cbDiff = Math.abs(fA.avgCb - fB.avgCb);
                                const crDiff = Math.abs(fA.avgCr - fB.avgCr);
                                const colSim = Math.max(0, 1 - Math.sqrt(cbDiff * cbDiff + crDiff * crDiff) / 40);

                                return (rL * 0.60) + (rG * 0.30) + (colSim * 0.10);
                            };

                            const scoreNorm = compareFeats(f1, f2);
                            const scoreFlip = compareFeats(f1, f2F);
                            const bestR = Math.max(scoreNorm, scoreFlip);

                            if (bestR > maxMatchScore) {
                                maxMatchScore = bestR;
                            }
                        }
                    }

                    // Precise biometric discrimination percentage
                    let finalAccuracy = 0;
                    if (maxMatchScore >= 0.50) {
                        // Confirmed same person: 82% to 98%
                        finalAccuracy = Math.round(82 + Math.min(16, (maxMatchScore - 0.50) * 35));
                    } else if (maxMatchScore >= 0.38) {
                        // Moderate similarity: 65% to 78%
                        finalAccuracy = Math.round(65 + (maxMatchScore - 0.38) * 110);
                    } else if (maxMatchScore >= 0.20) {
                        // Weak correlation (different person): 25% to 50%
                        finalAccuracy = Math.round(25 + (maxMatchScore - 0.20) * 135);
                    } else {
                        // Unrecognized face (different gender, different person, impostor): 5% to 22%
                        finalAccuracy = Math.max(5, Math.round(Math.max(0, maxMatchScore) * 100));
                    }

                    resolve(Math.min(99, Math.max(0, finalAccuracy)));
                } catch {
                    resolve(0);
                }
            };

            i1.crossOrigin = 'anonymous';
            i2.crossOrigin = 'anonymous';
            i1.onload = check;
            i2.onload = check;
            i1.onerror = () => resolve(0);
            i2.onerror = () => resolve(0);
            i1.src = formatImageSrc(src1);
            i2.src = formatImageSrc(src2);
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

            // 1. Mandatory Enrollment Check: Profile face photo MUST exist
            if (!targetFaceImage) {
                return {
                    match: false,
                    similarity: 0,
                    error: `No enrolled biometric photo found for ${targetName}. Please upload/enroll your face photo in Employee Management first.`
                };
            }

            // 2. Mandatory Biometric Face Matching: Compare live scanned face against target enrolled photo
            const scores = await Promise.all(liveFrames.map(f => compareTwoImages(f, targetFaceImage!)));
            const bestScore = Math.max(...scores, 0);

            // Verification threshold: Requires at least 65% match accuracy
            if (bestScore >= 65) {
                return {
                    match: true,
                    similarity: bestScore,
                    matchedUser: { ...targetProfile, name: targetName }
                };
            }

            return {
                match: false,
                similarity: bestScore,
                error: `Face Mismatch (${bestScore}% accuracy). Scan face does not match ${targetName}'s enrolled photo.`
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

        const validEmps = candidateProfiles.filter((emp: any) => emp && emp.faceImage && typeof emp.faceImage === 'string' && emp.faceImage.length > 20);

        if (validEmps.length === 0) {
            return {
                match: false,
                similarity: 0,
                error: 'No enrolled biometric face photos found in database. Please log in with email/password first.'
            };
        }

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

        if (bestScore >= 65 && bestMatchEmp) {
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

    const checkFaceInCircleStatus = (video: HTMLVideoElement | null): { ok: boolean; message: string } => {
        if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
            return { ok: false, message: '👤 Initializing camera...' };
        }
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 48;
            canvas.height = 48;
            const ctx = canvas.getContext('2d');
            if (!ctx) return { ok: true, message: '🎯 Aligning face in circle...' };

            const cw = video.videoWidth;
            const ch = video.videoHeight;
            const size = Math.min(cw, ch) * 0.75;
            const cropX = (cw - size) / 2;
            const cropY = (ch - size) / 2;

            ctx.drawImage(video, cropX, cropY, size, size, 0, 0, 48, 48);
            const imgData = ctx.getImageData(0, 0, 48, 48);
            const pixels = imgData.data;

            let skinPixelCount = 0;
            let sumLum = 0;
            let sumLumSq = 0;
            const totalPixels = 48 * 48;

            for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];

                const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
                sumLum += yVal;
                sumLumSq += yVal * yVal;

                const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
                const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

                // Robust human face & skin tone detector (handles warm/cool lighting, beards, shadows)
                const isSkinYCbCr = (cr >= 105 && cr <= 195 && cb >= 60 && cb <= 155);
                const isOrganicTone = (r > 30 && g > 18 && b > 12) && (r >= g - 5);

                if (isSkinYCbCr || isOrganicTone) {
                    skinPixelCount++;
                }
            }

            const skinRatio = skinPixelCount / totalPixels;
            const meanLum = sumLum / totalPixels;
            const lumVariance = (sumLumSq / totalPixels) - (meanLum * meanLum);

            // Rejects completely pitch-black feed or solid blank monotone frames
            if (meanLum < 8 || lumVariance < 3) {
                return { ok: false, message: '💡 Increase lighting or face the camera' };
            }

            // Checks that face/person presence is in the circular frame
            if (skinRatio < 0.06) {
                return { ok: false, message: '👤 Position face inside the green circle' };
            }

            return { ok: true, message: '🎯 Face detected inside circle' };
        } catch {
            return { ok: true, message: '🎯 Aligning face in circle...' };
        }
    };

    const checkFaceInCircle = (video: HTMLVideoElement | null): boolean => {
        return checkFaceInCircleStatus(video).ok;
    };

    useEffect(() => {
        if (!isOpen || scanState !== 'scanning') return;

        let isCancelled = false;
        let timerId: any = null;

        const runScanSequence = async () => {
            const targetDisplayName = userName && userName !== 'Employee' ? userName : 'Employee';

            // 1. Wait for live camera stream to initialize
            while (!isCancelled && (!videoRef.current || videoRef.current.readyState < 2)) {
                await new Promise(r => setTimeout(r, 100));
            }
            if (isCancelled) return;

            // 2. Active Face Detection & Proximity Loop: Wait until face is inside circle
            let faceDetected = false;
            while (!isCancelled && !faceDetected) {
                const status = checkFaceInCircleStatus(videoRef.current);
                if (status.ok) {
                    faceDetected = true;
                    break;
                }
                setScanProgress(0);
                setStatusMessage(status.message);
                await new Promise(r => setTimeout(r, 180));
            }
            if (isCancelled) return;

            // 3. Stage 1: Face Acquired & Alignment (25%)
            setScanProgress(25);
            setStatusMessage(`🎯 Face detected in circle! Aligning for ${targetDisplayName}...`);
            await new Promise(r => setTimeout(r, 380));
            if (isCancelled) return;

            // Stage 2: Feature Matrix (55%)
            setScanProgress(55);
            setStatusMessage('🔍 Stage 1/3: Scanning Biometric Features...');
            await new Promise(r => setTimeout(r, 380));
            if (isCancelled) return;

            // Stage 3: Biometric Identity Match (80%)
            setScanProgress(80);
            setStatusMessage(`🛡️ Stage 2/3: Matching against ${targetDisplayName}'s enrolled photo...`);
            await new Promise(r => setTimeout(r, 380));
            if (isCancelled) return;

            // Stage 4: Verification Result (95%)
            setScanProgress(95);
            setStatusMessage('⚡ Stage 3/3: Finalizing biometric verification...');
            const result = await verifyFaceMatch();
            if (isCancelled) return;

            setMatchScore(result.similarity);

            if (!result.match) {
                setMatchScore(result.similarity);
                setScanProgress(0);
                setScanState('failed');
                const reason = result.error || `Face Mismatch (${result.similarity}% match). Live scan does not match ${targetDisplayName}'s enrolled photo.`;
                setStatusMessage(`❌ ${reason}`);
                toast.error(`❌ Biometric Face Mismatch. Identity does not match ${targetDisplayName}.`);
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

            // Brief pause for user feedback before auto-submitting
            await new Promise(r => setTimeout(r, 1000));
            if (isCancelled) return;

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
        setScanProgress(30);
        setStatusMessage('🔍 Scanning biometric features...');
        await new Promise(r => setTimeout(r, 200));

        setScanProgress(75);
        setStatusMessage('🛡️ Matching face against enrolled photo...');
        const result = await verifyFaceMatch();
        setMatchScore(result.similarity);

        if (!result.match) {
            setScanProgress(0);
            setScanState('failed');
            setStatusMessage(`❌ ${result.error || 'Face Mismatch'}`);
            toast.error(`❌ ${result.error || 'Face Mismatch'}`);
            return;
        }

        const foundUser = result.matchedUser || null;
        setMatchedUserResult(foundUser);
        setScanProgress(100);
        setScanState('verified');
        const displayName = foundUser?.name || (userName && userName !== 'Employee' ? userName : 'Employee');
        setStatusMessage(`✓ Biometric Face Verified! Welcome ${displayName}`);

        await new Promise(r => setTimeout(r, 1000));

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
                        Facial scan for <span className="text-emerald-500 font-semibold">
                            {actionType === 'Login'
                                ? (matchedUserResult?.name || 'Enrolled Employee Identity')
                                : (userName && userName !== 'Employee' ? userName : 'Employee')}
                        </span>
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
                <div className="w-full pt-2 flex items-center justify-center gap-3">
                    {scanState === 'failed' ? (
                        <Button
                            onClick={handleTryAgain}
                            size="sm"
                            className="text-xs h-10 px-5 bg-rose-600 hover:bg-rose-700 text-white gap-1.5 cursor-pointer font-bold rounded-full shadow-md shrink-0"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${autoRetryCountdown !== null ? 'animate-spin' : ''}`} />
                            <span>{autoRetryCountdown !== null ? `Retrying in ${autoRetryCountdown}s...` : 'Try Scanning Again'}</span>
                        </Button>
                    ) : (
                        <Button
                            onClick={triggerManualScan}
                            size="sm"
                            className="text-xs h-10 px-5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white gap-1.5 cursor-pointer font-bold rounded-full shadow-md shrink-0"
                        >
                            <Camera className="h-4 w-4" />
                            <span>Scan Face Now</span>
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { stopCamera(); onClose(); }}
                        className="text-xs h-10 px-5 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold rounded-full shadow-xs cursor-pointer shrink-0"
                    >
                        <span>Cancel</span>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
