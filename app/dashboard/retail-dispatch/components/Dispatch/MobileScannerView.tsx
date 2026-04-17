"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TouchEvent as ReactTouchEvent } from "react";
import { createPortal } from "react-dom";
import { Html5Qrcode } from "html5-qrcode";
import { resolveS3Url } from "../../../inventory/components/Products/imageService";

interface MobileScannerViewProps {
  partyName: string;
  scannableItems: any[];
  currentBoxName: string;
  packageType: string;
  onBoxChange: (index: number) => void;
  onScan: (code: string) => { success: boolean; item?: any; message?: string };
  onClose: () => void;
}

const FALLBACK_SCANNER_IMAGE = "https://epanelimages.s3.ap-south-1.amazonaws.com/inventory/images/1776344255576-CLR-401.webp";

const normalizeScannerImageUrl = (raw?: string): string => {
  const value = (raw || "").trim();
  if (!value) return FALLBACK_SCANNER_IMAGE;
  if (value.startsWith("http://") || value.startsWith("https://")) return resolveS3Url(value);
  if (value.startsWith("/")) return value;
  return `https://epanelimages.s3.ap-south-1.amazonaws.com/${value.replace(/^\/+/, "")}`;
};

export default function MobileScannerView({
  partyName,
  scannableItems,
  currentBoxName,
  packageType,
  onBoxChange,
  onScan,
  onClose,
}: MobileScannerViewProps) {
  const COLLAPSED_SHEET_HEIGHT = 132;
  const [mounted, setMounted] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastMessage, setLastMessage] = useState<{ type: "success" | "error"; text: string; time: number } | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isLogExpanded, setIsLogExpanded] = useState(false);
  const [scanHistory, setScanHistory] = useState<Array<{ id: number; sku: string; productName: string; time: string; box: string }>>([]);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "global-barcode-scanner";
  const nextAllowedScanAtRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);

  const latestOnScanRef = useRef(onScan);

  useEffect(() => {
    latestOnScanRef.current = onScan;
  }, [onScan]);

  const packedCount = scannableItems.filter((i) => i.isPacked).length;
  const totalCount = scannableItems.length;
  const packedInCurrentBox = scannableItems.filter((i) => i.isPacked && i.boxName === currentBoxName).length;
  const nextItem = scannableItems.find((i) => !i.isPacked);

  const scannedSummary = useMemo(() => {
    const grouped = new Map<string, { productName: string; sku: string; qty: number }>();
    scannableItems.forEach((item) => {
      if (!item.isPacked) return;
      const key = `${item.sku}__${item.productName}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.qty += 1;
      } else {
        grouped.set(key, {
          productName: item.productName || "Unnamed",
          sku: item.sku || "N/A",
          qty: 1,
        });
      }
    });
    return Array.from(grouped.values());
  }, [scannableItems]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const playBeep = (type: "success" | "error") => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === "success") {
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      } else {
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
      }
    } catch {
      // noop
    }
  };

  const handleDetection = (code: string) => {
    const now = Date.now();
    if (now < nextAllowedScanAtRef.current) return;

    const result = latestOnScanRef.current(code);

    if (result.success) {
      setLastMessage({ type: "success", text: `Scanned: ${code}`, time: now });
      nextAllowedScanAtRef.current = now + 3000;
      if ("vibrate" in navigator) navigator.vibrate(80);
      playBeep("success");

      setScanHistory((prev) => [
        {
          id: now,
          productName: result.item?.productName || "Unknown",
          sku: result.item?.sku || "N/A",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          box: currentBoxName,
        },
        ...prev,
      ].slice(0, 12));
    } else {
      setLastMessage({ type: "error", text: result.message || "No match", time: now });
      nextAllowedScanAtRef.current = now + 800;
      if ("vibrate" in navigator) navigator.vibrate([80, 50, 80]);
      playBeep("error");
    }

    setTimeout(() => {
      setLastMessage((prev) => (prev?.time === now ? null : prev));
    }, result.success ? 3000 : 900);
  };

  const handleSheetTouchStart = (e: ReactTouchEvent<HTMLButtonElement>) => {
    touchStartYRef.current = e.touches[0]?.clientY ?? null;
    setIsDraggingSheet(true);
  };

  const handleSheetTouchMove = (e: ReactTouchEvent<HTMLButtonElement>) => {
    if (touchStartYRef.current === null) return;
    const currentY = e.touches[0]?.clientY ?? touchStartYRef.current;
    const delta = currentY - touchStartYRef.current;
    const clamped = Math.max(-90, Math.min(180, delta));
    setDragOffset(clamped);
  };

  const handleSheetTouchEnd = () => {
    const delta = dragOffset;
    if (delta < -50) setIsLogExpanded(true);
    if (delta > 50) setIsLogExpanded(false);
    setDragOffset(0);
    setIsDraggingSheet(false);
    touchStartYRef.current = null;
  };

  const handleSheetTouchCancel = () => {
    setDragOffset(0);
    setIsDraggingSheet(false);
    touchStartYRef.current = null;
  };

  const latestHandleDetectionRef = useRef(handleDetection);
  useEffect(() => {
    latestHandleDetectionRef.current = handleDetection;
  });

  const startScanner = async () => {
    if (scannerRef.current?.isScanning) return;

    setErrorStatus(null);
    let html5QrCode: Html5Qrcode;

    try {
      html5QrCode = new Html5Qrcode(scannerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 25,
          qrbox: { width: 320, height: 180 },
          aspectRatio: 1,
        },
        (decodedText) => latestHandleDetectionRef.current(decodedText),
        () => {}
      );

      setIsScanning(true);
    } catch (err) {
      console.error("Scanner failed to start:", err);
      setErrorStatus("Camera access denied or busy. Check browser permissions.");
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    startScanner();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {});
      }
    };
  }, [mounted]);

  useEffect(() => {
    let hwBarcode = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 50) hwBarcode = "";

      if (e.key === "Enter") {
        if (hwBarcode.length >= 3) {
          e.preventDefault();
          latestHandleDetectionRef.current(hwBarcode);
        }
        hwBarcode = "";
      } else if (e.key.length === 1) {
        hwBarcode += e.key;
      }

      lastKeyTime = currentTime;
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const currentIdx = parseInt(currentBoxName.replace(/\D/g, "")) || 1;

  if (!mounted) return null;

  const content = (
    <div className="fixed inset-0 z-[99999] flex h-full w-full flex-col overflow-hidden bg-black font-sans animate-in fade-in duration-300">
      <div className={`relative flex-1 min-h-0 overflow-hidden shadow-2xl transition-colors duration-200 ${
        lastMessage?.type === "success" ? "bg-emerald-600" : lastMessage?.type === "error" ? "bg-rose-600" : "bg-black"
      }`}>
        <div id={scannerId} className={`h-full w-full transition-opacity duration-200 ${lastMessage ? "opacity-30" : "opacity-100"}`}></div>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className={`absolute inset-0 transition-colors duration-300 ${
            lastMessage?.type === "success" ? "bg-emerald-500/20" : lastMessage?.type === "error" ? "bg-rose-500/20" : "bg-black/40"
          }`}></div>

          <div className={`relative h-[160px] w-[320px] transition-transform duration-200 ${lastMessage ? "scale-105" : "scale-100"}`}>
            <div className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-white shadow-lg"></div>
            <div className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-white shadow-lg"></div>
            <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-white shadow-lg"></div>
            <div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-white shadow-lg"></div>
            {!lastMessage && <div className="animate-viewfinder-scan absolute left-0 top-0 h-[2px] w-full bg-indigo-400 shadow-[0_0_20px_rgba(129,140,248,1)]"></div>}
            <div className="absolute inset-0 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"></div>
          </div>

          {lastMessage?.type === "success" && (
            <div className="absolute top-[26%] z-20 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white/80 bg-emerald-500 text-white shadow-2xl animate-in zoom-in-75 duration-150">
              <svg width="22" height="16" viewBox="0 0 12 9" fill="none">
                <path d="M1 4.5L4.5 8L11 1.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4 pb-12 pt-6">
          <button onClick={onClose} className="pointer-events-auto flex items-center gap-1.5 rounded-full py-2 pr-4 text-white/90 transition-colors hover:text-white active:scale-95">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span className="text-sm font-black tracking-wide">Back</span>
          </button>

          <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 backdrop-blur-md">
            <div className={`h-1.5 w-1.5 rounded-full ${isScanning ? "animate-pulse bg-emerald-500" : "bg-amber-400"}`}></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-white">{partyName.substring(0, 18)}</span>
          </div>
        </div>

        <div
          className={`pointer-events-none absolute left-4 right-4 z-40 transition-all duration-200 ${isLogExpanded ? "bottom-4 opacity-0 blur-sm" : "bottom-[152px] opacity-100"}`}
          style={{ transform: `translateY(${Math.max(0, dragOffset * 0.55)}px)` }}
        >
          {nextItem ? (
            <div className="pointer-events-auto flex items-center gap-5 rounded-[32px] border-t-[6px] border-indigo-600 bg-white/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-3xl animate-in slide-in-from-bottom duration-300">
              <img
                src={normalizeScannerImageUrl(nextItem.imageUrl || nextItem.image)}
                alt={nextItem.productName || "Scanned product"}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = FALLBACK_SCANNER_IMAGE;
                }}
                className="h-16 w-16 shrink-0 rounded-2xl border border-slate-200 bg-slate-100 object-cover shadow-inner"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Next Item to Scan</span>
                  <span className="rounded-full border border-indigo-200 bg-indigo-100 px-2.5 py-0.5 text-[10px] font-black text-indigo-700 shadow-sm">
                    {packedCount + 1} / {totalCount}
                  </span>
                </div>
                <h2 className="truncate font-mono text-2xl font-black uppercase tracking-tighter text-slate-900">{nextItem.sku}</h2>
                <p className="mt-0.5 truncate text-[11px] font-bold tracking-wide text-slate-500">{nextItem.productName}</p>
              </div>
            </div>
          ) : (
            <div className="pointer-events-auto flex flex-col items-center justify-center rounded-[32px] border-2 border-white/50 bg-emerald-500/95 p-6 shadow-2xl backdrop-blur-3xl">
              <h2 className="text-xl font-black uppercase tracking-wider text-white">All Items Scanned</h2>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-white/80">Ready for Dispatch</p>
            </div>
          )}
        </div>

        {errorStatus && (
          <div className="pointer-events-auto absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 p-12 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-rose-500 text-4xl shadow-2xl">!</div>
            <h3 className="mb-3 text-xl font-black text-white">Camera Disabled</h3>
            <p className="mb-10 text-xs font-bold uppercase tracking-widest text-white/50">{errorStatus}</p>
            <button onClick={startScanner} className="rounded-2xl bg-indigo-500 px-12 py-4 font-black text-white shadow-[0_10px_30px_rgba(99,102,241,0.4)] transition-all active:scale-95">
              ENABLE CAMERA
            </button>
          </div>
        )}
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 z-[95] flex flex-col overflow-hidden rounded-t-[32px] border-t border-white/50 bg-white/95 shadow-[0_-20px_50px_rgba(15,23,42,0.26)] backdrop-blur-sm"
        style={{
          height: isLogExpanded ? "84vh" : `${COLLAPSED_SHEET_HEIGHT}px`,
          transform: `translateY(${dragOffset}px)`,
          transition: isDraggingSheet ? "none" : "height 220ms ease, transform 220ms ease",
        }}
      >
        <button
          onClick={() => setIsLogExpanded((prev) => !prev)}
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
          onTouchCancel={handleSheetTouchCancel}
          className="w-full border-b border-slate-100 bg-white py-3 touch-none"
        >
          <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-300"></div>
        </button>

        <div className="flex items-center justify-between bg-white px-4 pb-3">
          <div className="min-w-0">
            <h3 className="text-base font-black text-slate-800">Scan Log</h3>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
              {packedCount} / {totalCount} verified, {packedInCurrentBox} in {currentBoxName}
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-slate-100 bg-slate-50 p-1 shadow-sm">
            <span className="px-1 text-[9px] font-black uppercase text-slate-400">{packageType}</span>
            <span className="rounded border border-indigo-100 bg-white px-2 py-0.5 text-[11px] font-black text-indigo-600">{currentBoxName}</span>
            <button onClick={() => onBoxChange(Math.max(1, currentIdx - 1))} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-sm font-black text-slate-600 transition-transform active:scale-95" aria-label="Previous Box">-</button>
            <button onClick={() => onBoxChange(currentIdx + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-sm font-black text-slate-600 transition-transform active:scale-95" aria-label="Next Box">+</button>
          </div>
        </div>

        {!isLogExpanded ? (
          <div className="px-4 pb-4 text-[11px] font-medium text-slate-500">
            Slide up to view all scanned products with SKU and quantity.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white px-4 pb-12 pt-1">
            {scannedSummary.map((item) => (
              <div key={`${item.sku}-${item.productName}`} className="mx-1 my-2 flex items-center gap-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-sm font-bold text-emerald-600">
                  {item.qty}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black uppercase tracking-tight text-slate-900">{item.sku}</p>
                  <p className="truncate text-[11px] font-semibold text-slate-500">{item.productName}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">QTY {item.qty}</span>
              </div>
            ))}

            {scannedSummary.length === 0 && <div className="py-16 text-center text-xs font-semibold text-slate-400">Awaiting first scan</div>}

            {scanHistory.length > 0 && (
              <div className="px-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Recent: {scanHistory[0].sku} at {scanHistory[0].time}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes viewfinder-scan {
          0% {
            transform: translateY(0) scaleX(0.85);
            opacity: 0.2;
          }
          50% {
            transform: translateY(160px) scaleX(1);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scaleX(0.85);
            opacity: 0.2;
          }
        }
        .animate-viewfinder-scan {
          animation: viewfinder-scan 3s infinite ease-in-out;
        }
        #global-barcode-scanner video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
        #global-barcode-scanner {
          border: none !important;
          overflow: hidden !important;
        }
        #global-barcode-scanner #qr-shaded-region {
          display: none !important;
        }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}
