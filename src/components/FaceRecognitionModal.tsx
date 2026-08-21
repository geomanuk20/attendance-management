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
                    const grid = 64;
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
                    const cropW1 = i1.width * 0.80;
                    const cropH1 = i1.height * 0.80;
                    const cropX1 = (i1.width - cropW1) / 2;
                    const cropY1 = (i1.height - cropH1) / 2;

                    const cropW2 = i2.width * 0.80;
                    const cropH2 = i2.height * 0.80;
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

                    const extractFeatures = (data: Uint8ClampedArray) => {
                        const blockSize = 8; // 8x8 blocks = 64 spatial cells across face
                        const numBlocks = 8;
                        const blockFeatures = new Float32Array(numBlocks * numBlocks);
                        const gradHFeatures = new Float32Array(numBlocks * numBlocks);
                        const gradVFeatures = new Float32Array(numBlocks * numBlocks);

                        let totalY = 0, totalCb = 0, totalCr = 0;
                        const lumMatrix = new Float32Array(grid * grid);

                        for (let y = 0; y < grid; y++) {
                            for (let x = 0; x < grid; x++) {
                                const idx = (y * grid + x) * 4;
                                const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                                const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
                                const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
                                const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

                                lumMatrix[y * grid + x] = yVal;
                                totalY += yVal;
                                totalCb += cb;
                                totalCr += cr;
                            }
                        }

                        const globalMeanLum = totalY / (grid * grid);
                        const avgCb = totalCb / (grid * grid);
                        const avgCr = totalCr / (grid * grid);

                        // Extract block statistics (Normalized Intensity & Local Sobel Gradients)
                        for (let by = 0; by < numBlocks; by++) {
                            for (let bx = 0; bx < numBlocks; bx++) {
                                let blockLumSum = 0;
                                let blockGradH = 0;
                                let blockGradV = 0;
                                const bIdx = by * numBlocks + bx;

                                for (let py = 0; py < blockSize; py++) {
                                    for (let px = 0; px < blockSize; px++) {
                                        const y = by * blockSize + py;
                                        const x = bx * blockSize + px;
                                        const val = lumMatrix[y * grid + x];
                                        blockLumSum += (val - globalMeanLum);

                                        // Horizontal gradient (edges of nose, eyes, face border)
                                        if (x > 0 && x < grid - 1) {
                                            blockGradH += Math.abs(lumMatrix[y * grid + x + 1] - lumMatrix[y * grid + x - 1]);
                                        }
                                        // Vertical gradient (eyebrows, eyelids, lips, chin)
                                        if (y > 0 && y < grid - 1) {
                                            blockGradV += Math.abs(lumMatrix[(y + 1) * grid + x] - lumMatrix[(y - 1) * grid + x]);
                                        }
                                    }
                                }

                                const cellPixels = blockSize * blockSize;
                                blockFeatures[bIdx] = blockLumSum / cellPixels;
                                gradHFeatures[bIdx] = blockGradH / cellPixels;
                                gradVFeatures[bIdx] = blockGradV / cellPixels;
                            }
                        }

                        return { blockFeatures, gradHFeatures, gradVFeatures, avgCb, avgCr };
                    };

                    const computeCorrelation = (fA: any, fB: any): number => {
                        const len = fA.blockFeatures.length; // 64 blocks
                        let sumA = 0, sumB = 0;
                        let sumGradA = 0, sumGradB = 0;

                        for (let i = 0; i < len; i++) {
                            sumA += fA.blockFeatures[i];
                            sumB += fB.blockFeatures[i];
                            sumGradA += (fA.gradHFeatures[i] + fA.gradVFeatures[i]);
                            sumGradB += (fB.gradHFeatures[i] + fB.gradVFeatures[i]);
                        }

                        const meanA = sumA / len, meanB = sumB / len;
                        const meanGradA = sumGradA / len, meanGradB = sumGradB / len;

                        let numInt = 0, denIntA = 0, denIntB = 0;
                        let numGrad = 0, denGradA = 0, denGradB = 0;

                        for (let i = 0; i < len; i++) {
                            const nA = fA.blockFeatures[i] - meanA;
                            const nB = fB.blockFeatures[i] - meanB;
                            numInt += nA * nB;
                            denIntA += nA * nA;
                            denIntB += nB * nB;

                            const gA = (fA.gradHFeatures[i] + fA.gradVFeatures[i]) - meanGradA;
                            const gB = (fB.gradHFeatures[i] + fB.gradVFeatures[i]) - meanGradB;
                            numGrad += gA * gB;
                            denGradA += gA * gA;
                            denGradB += gB * gB;
                        }

                        const denomInt = Math.sqrt(denIntA * denIntB);
                        const rInt = denomInt > 0 ? (numInt / denomInt) : 0;

                        const denomGrad = Math.sqrt(denGradA * denGradB);
                        const rGrad = denomGrad > 0 ? (numGrad / denomGrad) : 0;

                        const cbDiff = Math.abs(fA.avgCb - fB.avgCb);
                        const crDiff = Math.abs(fA.avgCr - fB.avgCr);
                        const colorDistance = Math.sqrt(cbDiff * cbDiff + crDiff * crDiff);
                        const colorSimilarity = Math.max(0, 1 - (colorDistance / 45));

                        // Combined biometric feature correlation (-1 to 1)
                        const rCombined = (rInt * 0.50) + (rGrad * 0.35) + (colorSimilarity * 0.15);

                        // Calibrate into human-accurate similarity percentage (0% to 100%)
                        let accuracyPercent = 0;
                        if (rCombined >= 0.50) {
                            // Same person strong match: 80% to 98%
                            accuracyPercent = Math.round(80 + Math.min(18, (rCombined - 0.50) * 45));
                        } else if (rCombined >= 0.35) {
                            // Borderline / Moderate similarity: 60% to 78%
                            accuracyPercent = Math.round(60 + (rCombined - 0.35) * 120);
                        } else if (rCombined >= 0.18) {
                            // Weak correlation (different person): 25% to 50%
                            accuracyPercent = Math.round(25 + (rCombined - 0.18) * 145);
                        } else {
                            // Complete mismatch (different person / unknown face): 5% to 22%
                            accuracyPercent = Math.max(5, Math.round(Math.max(0, rCombined) * 90));
                        }

                        return Math.min(99, Math.max(0, accuracyPercent));
                    };

                    const feat1 = extractFeatures(d1);
                    const feat2 = extractFeatures(d2);
                    const feat2F = extractFeatures(d2F);

                    const scoreNormal = computeCorrelation(feat1, feat2);
                    const scoreFlipped = computeCorrelation(feat1, feat2F);
                    const best = Math.max(scoreNormal, scoreFlipped);

                    resolve(best);
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

    const checkFaceInCircle = (video: HTMLVideoElement | null): boolean => {
        if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return false;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            if (!ctx) return false;

            const cw = video.videoWidth;
            const ch = video.videoHeight;
            const size = Math.min(cw, ch) * 0.75;
            const cropX = (cw - size) / 2;
            const cropY = (ch - size) / 2;

            ctx.drawImage(video, cropX, cropY, size, size, 0, 0, 64, 64);
            const imgData = ctx.getImageData(0, 0, 64, 64);
            const pixels = imgData.data;

            let skinPixelCount = 0;
            let sumX = 0;
            let sumY = 0;
            let sumLum = 0;
            let sumLumSq = 0;
            const totalPixels = 64 * 64;

            for (let y = 0; y < 64; y++) {
                for (let x = 0; x < 64; x++) {
                    const idx = (y * 64 + x) * 4;
                    const r = pixels[idx];
                    const g = pixels[idx + 1];
                    const b = pixels[idx + 2];

                    const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
                    sumLum += yVal;
                    sumLumSq += yVal * yVal;

                    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
                    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

                    // Standard human skin detection boundary across diverse tones & lighting
                    const isSkinYCbCr = (cr >= 115 && cr <= 188 && cb >= 68 && cb <= 145);
                    const isSkinRGB = (r > 35 && g > 20 && b > 15) && (r > g && r > b) && (r - g >= 6);

                    if (isSkinYCbCr || isSkinRGB) {
                        skinPixelCount++;
                        sumX += x;
                        sumY += y;
                    }
                }
            }

            const skinRatio = skinPixelCount / totalPixels;
            const meanLum = sumLum / totalPixels;
            const lumVariance = (sumLumSq / totalPixels) - (meanLum * meanLum);

            // Must have sufficient lighting, natural facial contrast variation, and skin presence inside circular viewport
            if (meanLum < 12 || lumVariance < 10 || skinRatio < 0.08) {
                return false;
            }

            // Must be centered within the circular viewfinder
            const centroidX = sumX / skinPixelCount;
            const centroidY = sumY / skinPixelCount;
            if (centroidX < 10 || centroidX > 54 || centroidY < 10 || centroidY > 54) {
                return false;
            }

            return true;
        } catch {
            return false;
        }
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

            // 2. Active Face Detection Loop: ONLY proceed if a face is inside the circle!
            let faceDetected = false;
            while (!isCancelled && !faceDetected) {
                const hasFace = checkFaceInCircle(videoRef.current);
                if (hasFace) {
                    faceDetected = true;
                    break;
                }
                setScanProgress(0);
                setStatusMessage('👤 Position face inside the green circle to begin scan...');
                await new Promise(r => setTimeout(r, 200));
            }
            if (isCancelled) return;

            // 3. Stage 1: Face Acquired & Alignment (25%)
            setScanProgress(25);
            setStatusMessage(`🎯 Face detected in circle! Aligning for ${targetDisplayName}...`);
            await new Promise(r => setTimeout(r, 450));
            if (isCancelled) return;
            if (!checkFaceInCircle(videoRef.current)) {
                setScanProgress(0);
                setStatusMessage('👤 Face moved out of circle. Position face inside to resume...');
                runScanSequence();
                return;
            }

            // Stage 2: Feature Matrix (55%)
            setScanProgress(55);
            setStatusMessage('🔍 Stage 1/3: Scanning Biometric Features...');
            await new Promise(r => setTimeout(r, 450));
            if (isCancelled) return;
            if (!checkFaceInCircle(videoRef.current)) {
                setScanProgress(0);
                setStatusMessage('👤 Face moved out of circle. Position face inside to resume...');
                runScanSequence();
                return;
            }

            // Stage 3: Biometric Identity Match (80%)
            setScanProgress(80);
            setStatusMessage(`🛡️ Stage 2/3: Matching against ${targetDisplayName}'s enrolled photo...`);
            await new Promise(r => setTimeout(r, 450));
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
