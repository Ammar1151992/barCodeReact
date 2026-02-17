import { useEffect, useRef, useState } from 'react';
import {
  MultiFormatReader,
  BinaryBitmap,
  HybridBinarizer,
  GlobalHistogramBinarizer,
} from '@zxing/library';
import { HTMLCanvasElementLuminanceSource } from '@zxing/library/esm/browser';

// Line height as fraction of video height (scan region - wider for IMEI)
const LINE_HEIGHT_FRACTION = 0.22;
const SCAN_INTERVAL_MS = 120;
const SEND_AFTER_STABLE_MS = 3000;

export default function BarcodeScanner() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const stripCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const drawLoopRef = useRef(null);
  const sentRef = useRef(false);
  const scanningRef = useRef(false);
  const stableTextRef = useRef(null);
  const stableSinceRef = useRef(0);

  const [status, setStatus] = useState('loading');
  const [lastScanned, setLastScanned] = useState(null);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(null);

  const readerRef = useRef(null);

  // Send scanned data to Telegram bot
  const sendToBot = (data) => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.sendData(data);
    } else {
      console.log('Scanned (send to bot):', data);
      setLastScanned(data);
    }
  };

  // Telegram: expand to full height when opened in Telegram
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.expand();
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const stripCanvas = stripCanvasRef.current;

    if (!video || !canvas || !stripCanvas) return;

    readerRef.current = new MultiFormatReader();

    const startCamera = async () => {
      try {
        setStatus('loading');
        setError(null);
        sentRef.current = false;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 },
          },
          audio: false,
        });

        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();

        setStatus('scanning');

        // Scan loop: crop strip under line and decode
        const scan = async () => {
          if (video.readyState !== video.HAVE_ENOUGH_DATA || sentRef.current || scanningRef.current) return;

          const vw = video.videoWidth;
          const vh = video.videoHeight;
          if (!vw || !vh) return;

          scanningRef.current = true;

          const lineHeight = Math.max(80, Math.floor(vh * LINE_HEIGHT_FRACTION));
          const y = Math.floor((vh - lineHeight) / 2);

          // Extract strip under the line for barcode decode
          const stripCtx = stripCanvas.getContext('2d');
          stripCanvas.width = vw;
          stripCanvas.height = lineHeight;
          stripCtx.drawImage(video, 0, y, vw, lineHeight, 0, 0, vw, lineHeight);

          const tryDecode = (binarizer) => {
            try {
              const luminanceSource = new HTMLCanvasElementLuminanceSource(stripCanvas, false);
              const binaryBitmap = new BinaryBitmap(binarizer(luminanceSource));
              return readerRef.current.decode(binaryBitmap);
            } catch {
              return null;
            }
          };

          const tryDecodeInverted = () => {
            try {
              const luminanceSource = new HTMLCanvasElementLuminanceSource(stripCanvas, true);
              const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
              return readerRef.current.decode(binaryBitmap);
            } catch {
              return null;
            }
          };

          try {
            let result = tryDecode((s) => new HybridBinarizer(s));
            if (!result) result = tryDecode((s) => new GlobalHistogramBinarizer(s));
            if (!result) result = tryDecodeInverted();
            if (result && !sentRef.current) {
              const text = result.getText();
              if (!text) {
                stableTextRef.current = null;
                setCountdown(null);
                return;
              }
              const now = Date.now();
              if (text !== stableTextRef.current) {
                stableTextRef.current = text;
                stableSinceRef.current = now;
                setLastScanned(text);
                setStatus('found');
                setCountdown(1);
              } else {
                const elapsed = now - stableSinceRef.current;
                if (elapsed >= SEND_AFTER_STABLE_MS) {
                  sendToBot(text);
                  sentRef.current = true;
                  setStatus('sent');
                  setCountdown(null);
                } else {
                  setCountdown(Math.ceil((SEND_AFTER_STABLE_MS - elapsed) / 1000));
                }
              }
            }
          } catch {
            // no barcode in frame - reset stability
            stableTextRef.current = null;
            setCountdown(null);
            // No barcode in this frame - expected most of the time
          } finally {
            scanningRef.current = false;
          }
        };

        const drawCtx = canvas.getContext('2d');
        const drawLoop = () => {
          if (video.readyState === video.HAVE_ENOUGH_DATA && drawCtx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            drawCtx.drawImage(video, 0, 0);
          }
          drawLoopRef.current = requestAnimationFrame(drawLoop);
        };
        drawLoopRef.current = requestAnimationFrame(drawLoop);
        scanIntervalRef.current = setInterval(scan, SCAN_INTERVAL_MS);
      } catch (err) {
        setError(err.message || 'فشل الوصول للكاميرا');
        setStatus('error');
      }
    };

    startCamera();

    return () => {
      if (drawLoopRef.current) cancelAnimationFrame(drawLoopRef.current);
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div className="barcode-scanner">
      <div className="scanner-viewport">
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ display: 'none' }}
        />
        <canvas
          ref={canvasRef}
          className="scanner-canvas"
          style={{ display: status === 'loading' ? 'none' : 'block' }}
        />
        <canvas
          ref={stripCanvasRef}
          className="strip-canvas"
          aria-hidden
        />
        {status !== 'loading' && (
          <div className="line-overlay">
            <div className="viewfinder">
              <span className="corner-bl" />
              <span className="corner-br" />
            </div>
            <div className="scan-line" />
            <div className="barcode-bars">
              {[...Array(10)].map((_, i) => <span key={i} />)}
            </div>
          </div>
        )}
      </div>

      <div className="scanner-status">
        {status === 'loading' && <p className="status-text">جاري فتح الكاميرا...</p>}
        {status === 'scanning' && (
          <p className="status-text">ضع الباركود أو الآيماي تحت الخط الأخضر</p>
        )}
        {status === 'found' && (
          <p className="status-text success">
            {countdown != null ? `ثبّته ${countdown} ثانية للإرسال` : 'تم القراءة!'}
          </p>
        )}
        {status === 'sent' && (
          <p className="status-text success">تم الإرسال!</p>
        )}
        {status === 'error' && (
          <p className="status-text error">{error}</p>
        )}
        {lastScanned && (
          <p className="scanned-value">{lastScanned}</p>
        )}
      </div>
    </div>
  );
}
