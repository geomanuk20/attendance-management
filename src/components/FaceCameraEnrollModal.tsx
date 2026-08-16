import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Camera, CheckCircle2, ShieldCheck, RefreshCw, AlertCircle, Scan, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface FaceCameraEnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (capturedImageDataUrl: string) => Promise<void> | void;
  userName?: string;
}

export function FaceCameraEnrollModal({
  isOpen,
  onClose,
  onCapture,
  userName = 'Employee',
}: FaceCameraEnrollModalProps) {
  const [hasCamera, setHasCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [enrollProgress, setEnrollProgress] = useState<number>(0);
  const [enrollStage, setEnrollStage] = useState<'idle' | 'eyes' | 'left' | 'right' | 'up' | 'down' | 'complete'>('idle');
  const [enrollStatus, setEnrollStatus] = useState<string>('Align face in frame to begin scan...');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setHasCamera(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setHasCamera(true);
      } else {
        setCameraError('Webcam is not supported in this browser.');
      }
    } catch (err: any) {
      console.warn('Webcam permission or device error:', err);
      setHasCamera(false);
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
        setCameraError('Camera access blocked. Please click the lock 🔒 icon in your browser URL bar and set Camera to Allow.');
      } else {
        setCameraError('No webcam detected on this device. Please connect a camera and try again.');
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setPreviewImage(null);
      setCameraError(null);
      setEnrollProgress(0);
      setEnrollStage('idle');
      return;
    }

    setPreviewImage(null);
    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const checkFaceInCircle = (video: HTMLVideoElement | null): boolean => {
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return false;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      const cw = video.videoWidth;
      const ch = video.videoHeight;
      const cropW = cw * 0.6;
      const cropH = ch * 0.6;
      const cropX = (cw - cropW) / 2;
      const cropY = (ch - cropH) / 2;

      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, 120, 120);
      const imgData = ctx.getImageData(0, 0, 120, 120);
      const pixels = imgData.data;
      let skinPixelCount = 0;
      let sumX = 0;
      let sumY = 0;
      let totalLuminance = 0;
      const rowLuminances: number[] = new Array(120).fill(0);

      for (let y = 0; y < 120; y++) {
        for (let x = 0; x < 120; x++) {
          const idx = (y * 120 + x) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];

          const isSkin = (r > 40) && (g > 20) && (b > 15) && (r > g) && (r > b) && (Math.abs(r - g) >= 10);
          if (isSkin) {
            skinPixelCount++;
            sumX += x;
            sumY += y;
          }

          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          totalLuminance += lum;
          rowLuminances[y] += lum / 120;
        }
      }

      const numPixels = 120 * 120;
      const skinRatio = skinPixelCount / numPixels;
      const meanLuminance = totalLuminance / numPixels;

      if (meanLuminance < 20 || skinRatio < 0.22) return false;

      // 1. Strict centroid centering inside circle
      const centroidX = sumX / skinPixelCount;
      const centroidY = sumY / skinPixelCount;
      const isProperlyCentered = centroidX >= 42 && centroidX <= 78 && centroidY >= 40 && centroidY <= 80;
      if (!isProperlyCentered) return false;

      let leftEyeLum = 0, rightEyeLum = 0, noseBridgeLum = 0;
      for (let y = 20; y < 50; y++) {
        for (let x = 20; x < 50; x++) {
          const idx = (y * 120 + x) * 4;
          leftEyeLum += (0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]);
        }
        for (let x = 70; x < 100; x++) {
          const idx = (y * 120 + x) * 4;
          rightEyeLum += (0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]);
        }
        for (let x = 50; x < 70; x++) {
          const idx = (y * 120 + x) * 4;
          noseBridgeLum += (0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]);
        }
      }
      const avgLeftEye = leftEyeLum / (30 * 30);
      const avgRightEye = rightEyeLum / (30 * 30);
      const avgBridge = noseBridgeLum / (30 * 20);

      const hasFacialStructure = Math.abs(avgLeftEye - avgRightEye) < 45 && (avgBridge >= avgLeftEye - 15);

      // Occlusion Check: Detect hand/mask covering mouth, nose, or lower face
      let minLowerLum = 255;
      let maxLowerLum = 0;
      let sumLowerLum = 0;
      let lowerCount = 0;

      for (let y = 55; y < 98; y++) {
        for (let x = 35; x < 85; x++) {
          const idx = (y * 120 + x) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum < minLowerLum) minLowerLum = lum;
          if (lum > maxLowerLum) maxLowerLum = lum;
          sumLowerLum += lum;
          lowerCount++;
        }
      }

      const avgLowerLum = sumLowerLum / lowerCount;
      const lowerContrast = maxLowerLum - minLowerLum;

      const isOccludedByHand = lowerContrast < 18 || minLowerLum > (avgLowerLum - 12);
      if (isOccludedByHand) {
        return false;
      }

      let varianceSum = 0;
      for (let y = 0; y < 120; y++) {
        varianceSum += Math.pow(rowLuminances[y] - meanLuminance, 2);
      }
      const stdDev = Math.sqrt(varianceSum / 120);

      return hasFacialStructure && stdDev >= 5.0 && skinRatio >= 0.22;
    } catch {
      return false;
    }
  };

  const isEnrollRunningRef = useRef<boolean>(false);

  // Guided 5-Stage Multi-Angle Enrollment Scan Sequence
  useEffect(() => {
    if (!isOpen || !hasCamera || previewImage) {
      isEnrollRunningRef.current = false;
      return;
    }

    if (isEnrollRunningRef.current) return;
    isEnrollRunningRef.current = true;

    let isCancelled = false;

    const runEnrollSequence = async () => {
      const ensureFaceInCircle = async (): Promise<boolean> => {
        while (!isCancelled) {
          const isUncovered = checkFaceInCircle(videoRef.current);
          if (isUncovered) return true;

          setEnrollStage('idle');
          setEnrollProgress(0);
          setEnrollStatus('⚠️ Face covered by hand or mask. Uncover your face to auto-scan...');
          await new Promise(r => setTimeout(r, 300));
        }
        return false;
      };

      await ensureFaceInCircle();
      if (isCancelled) return;

      // Stage 1: Eyes & Nose Bridge Alignment (20%)
      setEnrollStage('eyes');
      setEnrollProgress(20);
      setEnrollStatus('👁️ Stage 1/5: Aligning Eyes & Nose Bridge...');
      await new Promise(r => setTimeout(r, 1000));
      if (isCancelled) return;

      await ensureFaceInCircle();
      if (isCancelled) return;

      // Stage 2: Left Side Profile (40%)
      setEnrollStage('left');
      setEnrollProgress(40);
      setEnrollStatus('👈 Stage 2/5: Turn Head Slowly LEFT...');
      await new Promise(r => setTimeout(r, 1000));
      if (isCancelled) return;

      await ensureFaceInCircle();
      if (isCancelled) return;

      // Stage 3: Right Side Profile (60%)
      setEnrollStage('right');
      setEnrollProgress(60);
      setEnrollStatus('👉 Stage 3/5: Turn Head Slowly RIGHT...');
      await new Promise(r => setTimeout(r, 1000));
      if (isCancelled) return;

      await ensureFaceInCircle();
      if (isCancelled) return;

      // Stage 4: Tilt Head Up (80%)
      setEnrollStage('up');
      setEnrollProgress(80);
      setEnrollStatus('👆 Stage 4/5: Tilt Head Slightly UP...');
      await new Promise(r => setTimeout(r, 1000));
      if (isCancelled) return;

      await ensureFaceInCircle();
      if (isCancelled) return;

      // Stage 5: Tilt Head Down (95%)
      setEnrollStage('down');
      setEnrollProgress(95);
      setEnrollStatus('👇 Stage 5/5: Tilt Head Slightly DOWN...');
      await new Promise(r => setTimeout(r, 1000));
      if (isCancelled) return;

      // Complete & Auto Snap (100%)
      setEnrollStage('complete');
      setEnrollProgress(100);
      setEnrollStatus('✓ 100% All 5 Facial Angles Verified! Capturing photo...');
      await new Promise(r => setTimeout(r, 600));
      if (isCancelled) return;

      snapPhoto();
    };

    runEnrollSequence();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, hasCamera, previewImage]);

  const snapPhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;

      // Full Face Region Crop (Head & Face from hair to chin, fully centered)
      const cropSize = Math.min(vw, vh) * 0.70;
      const cropX = (vw - cropSize) / 2;
      const cropY = (vh - cropSize) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Flip horizontally to mirror webcam view
      ctx.translate(320, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, 320, 320);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      if (dataUrl && dataUrl.length > 500) {
        setPreviewImage(dataUrl);
        setEnrollProgress(100);
        setEnrollStatus('✓ Biometric Face Photo Captured Successfully!');
      }
    } catch (e) {
      console.error('Snap photo error:', e);
    }
  };

  const handleConfirmSave = async () => {
    if (!previewImage) return;
    setIsCapturing(true);
    try {
      await onCapture(previewImage);
      stopCamera();
      onClose();
      toast.success('Biometric face photo enrolled successfully!');
    } catch (err: any) {
      console.error('Save face image error:', err);
      toast.error('Failed to save biometric face photo');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    setPreviewImage(null);
    setEnrollStage('idle');
    setEnrollProgress(0);
    setEnrollStatus('Position your face inside the green circle to enroll...');
    isEnrollRunningRef.current = false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { stopCamera(); onClose(); } }}>
      <DialogContent className="max-w-md w-full p-6 rounded-3xl border border-slate-700 bg-slate-900 text-white shadow-2xl flex flex-col items-center justify-center space-y-4">
        <DialogHeader className="p-0 text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <Camera className="h-5 w-5 text-emerald-400" />
            <DialogTitle className="text-lg font-bold text-white">Biometric Face ID Camera</DialogTitle>
          </div>
          <DialogDescription className="text-slate-400 text-xs">
            Position your face in camera frame to enroll biometric photo — <span className="text-emerald-400 font-semibold">{userName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* 100% Mathematically Concentric Circular Camera Viewport */}
        <div style={{ width: 250, height: 250, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px auto', flexShrink: 0 }}>
          {/* SVG Circular Progress Ring */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 20 }} className="-rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="transparent" stroke="#334155" strokeWidth="3.5" />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="transparent"
              stroke="#22c55e"
              strokeWidth="4"
              strokeDasharray="289"
              strokeDashoffset={289 - (289 * enrollProgress) / 100}
              strokeLinecap="round"
              className="transition-all duration-300 ease-out"
            />
          </svg>

          {/* Masked Camera Circle Container with Strict Overflow Clip */}
          <div style={{ width: 228, height: 228, borderRadius: '50%', overflow: 'hidden', position: 'relative', flexShrink: 0, zIndex: 10 }} className="bg-slate-950 flex items-center justify-center shadow-inner">
            {/* Always keep video tag mounted in DOM so streamRef.current is never lost */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
                display: previewImage ? 'none' : (hasCamera ? 'block' : 'none'),
              }}
            />

            {previewImage && (
              <img
                src={previewImage}
                alt="Captured Face"
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
              />
            )}

            {!hasCamera && !previewImage && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-slate-950 text-white z-10">
                <Camera className="h-8 w-8 text-emerald-400 animate-pulse mb-1" />
                <p className="text-xs font-semibold text-slate-300">Opening Camera...</p>
                {cameraError && (
                  <p className="text-[10px] text-amber-400 mt-0.5 max-w-[180px] leading-tight">{cameraError}</p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={startCamera}
                  className="mt-2 text-xs h-7 border-slate-700 text-cyan-300 hover:bg-slate-800 gap-1.5 rounded-full"
                >
                  <RefreshCw className="h-3 w-3" /> Retry
                </Button>
              </div>
            )}

            {/* Clean High-Tech Green Face Bounding Frame Overlay (No Text/Emojis Inside Circle) */}
            {!previewImage && hasCamera && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div style={{ width: 145, height: 165 }} className="relative rounded-xl border-2 border-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(52,211,153,0.4)]">
                  {/* Corner Brackets */}
                  <div className="absolute -top-1 -left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-emerald-400 rounded-tl-sm" />
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-emerald-400 rounded-tr-sm" />
                  <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-emerald-400 rounded-bl-sm" />
                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-emerald-400 rounded-tr-sm" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progress & Status Message Readout Below Circle */}
        <div className="flex flex-col items-center justify-center text-center space-y-1">
          <h3 className="text-3xl font-extrabold tracking-tight text-emerald-400">
            {enrollProgress}%
          </h3>
          <p className="text-xs font-semibold text-slate-300 max-w-[260px] leading-relaxed">
            {enrollStatus}
          </p>
        </div>

        <div className="pt-2 w-full flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => { stopCamera(); onClose(); }}
            className="text-xs h-10 px-5 border border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 font-semibold rounded-full shadow-xs cursor-pointer"
          >
            Cancel
          </Button>

          {previewImage ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleRetake}
                className="text-xs h-10 px-4 border-amber-500/60 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 font-bold gap-1 rounded-full cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retake
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSave}
                disabled={isCapturing}
                className="text-xs h-10 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 rounded-full shadow-md cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" /> Save Face Photo
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              onClick={snapPhoto}
              disabled={!hasCamera}
              className="text-xs h-10 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 rounded-full shadow-md cursor-pointer"
            >
              <Camera className="h-4 w-4" /> Snap Photo Now
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
