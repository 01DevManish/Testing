"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Html5Qrcode } from "html5-qrcode";

interface MobileScannerViewProps {
  partyName: string;
  scannableItems: any[];
  currentBoxName: string;
  packageType: string;
  onBoxChange: (index: number) => void;
  onScan: (code: string) => { success: boolean; item?: any; message?: string };
  onClose: () => void;
}

export default function MobileScannerView({ partyName, scannableItems, currentBoxName, packageType, onBoxChange, onScan, onClose }: MobileScannerViewProps) {
  const [lastMessage, setLastMessage] = useState<{ type: "success" | "error"; text: string; time: number } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "global-barcode-scanner";
  const [mounted, setMounted] = useState(false);

  // Stats
  const packedCount = scannableItems.filter(i => i.isPacked).length;
  const totalCount = scannableItems.length;
  const packedInCurrentBox = scannableItems.filter(i => i.isPacked && i.boxName === currentBoxName).length;

  // Find next target SKU (first item not packed)
  const nextItem = scannableItems.find(i => !i.isPacked);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Initialize Scanner
  const startScanner = async () => {
    if (scannerRef.current?.isScanning) return;
    
    setErrorStatus(null);
    let html5QrCode: Html5Qrcode;

    try {
      html5QrCode = new Html5Qrcode(scannerId);
      scannerRef.current = html5QrCode;

      const config = {
        fps: 25,
        qrbox: { width: 320, height: 180 },
        aspectRatio: 1.0,
        formatsToSupport: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] // All barcode formats
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => handleDetection(decodedText),
        () => {} // Quiet on frame errors
      );
      setIsScanning(true);
    } catch (err) {
      console.error("Scanner failed to start:", err);
      setErrorStatus("Camera access denied or busy. Check browser permissions.");
    }
  };

  useEffect(() => {
    if (mounted) {
      startScanner();
    }
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(e => console.warn(e));
      }
    };
  }, [mounted]);

  const handleDetection = (code: string) => {
    // Debounce rapid fire
    if (Date.now() - (lastMessage?.time || 0) < 1800 && lastMessage?.text.includes(code)) return;

    const result = onScan(code);
    const now = Date.now();

    if (result.success) {
      setLastMessage({ type: "success", text: `Scanned: ${code}`, time: now });
      if ("vibrate" in navigator) navigator.vibrate(100);
      setScanHistory(prev => [{
        id: now,
        productName: result.item.productName,
        sku: result.item.sku,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        box: currentBoxName
      }, ...prev].slice(0, 8));
    } else {
      setLastMessage({ type: "error", text: result.message || "No match", time: now });
      if ("vibrate" in navigator) navigator.vibrate([80, 50, 80]);
    }

    setTimeout(() => {
      setLastMessage(prev => prev?.time === now ? null : prev);
    }, 2500);
  };

  const currentIdx = parseInt(currentBoxName.replace(/\D/g, "")) || 1;

  if (!mounted) return null;

  const content = (
    <div className="fixed inset-0 w-full h-full z-[99999] bg-white flex flex-col font-sans overflow-hidden animate-in fade-in duration-300">
      
      {/* Viewport 1: Camera Feed (Dominant) */}
      <div className="relative h-[70vh] bg-black overflow-hidden shadow-2xl">
        <div id={scannerId} className="w-full h-full opacity-95"></div>
        
        {/* Viewfinder Overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative w-[320px] h-[160px] z-10">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white opacity-80 rounded-tl-xl shadow-lg"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white opacity-80 rounded-tr-xl shadow-lg"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white opacity-80 rounded-bl-xl shadow-lg"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white opacity-80 rounded-br-xl shadow-lg"></div>
                
                <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-400 shadow-[0_0_20px_rgba(129,140,248,1)] animate-viewfinder-scan"></div>
                
                <div className="absolute inset-0 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"></div>
            </div>
            <p className="mt-6 text-white text-[10px] font-bold uppercase tracking-[0.4em] drop-shadow-lg opacity-60">
                Ready to Scan
            </p>
        </div>

        {/* Floating Top Bar (Minimal) */}
        <div className="absolute top-0 left-0 right-0 p-4 pt-8 flex justify-between items-center z-20">
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-white text-xs font-black tracking-tight">{partyName}</span>
                  <span className="text-[9px] text-white/50 font-bold uppercase tracking-widest">Active Box: {currentBoxName}</span>
                </div>
                <div className="h-6 w-[1px] bg-white/10 mx-1"></div>
                <div className="flex items-center gap-1">
                   <button onClick={() => onBoxChange(Math.max(1, currentIdx - 1))} className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg text-white font-black text-sm transition-colors">−</button>
                   <button onClick={() => onBoxChange(currentIdx + 1)} className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg text-white font-black text-sm transition-colors">+</button>
                </div>
            </div>
            
            <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-rose-500/90 text-white shadow-xl flex items-center justify-center active:scale-90 transition-transform"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
            </button>
        </div>

        {/* Expected Next (Mobile-Style Overlay) */}
        {nextItem && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[90%] bg-white/10 backdrop-blur-3xl border border-white/20 p-3 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-xl shadow-lg shrink-0">📦</div>
            <div className="flex-1 min-w-0">
               <span className="text-[8px] text-white/50 font-black uppercase tracking-widest">Next Target</span>
               <p className="text-white text-[13px] font-black truncate leading-none">{nextItem.productName}</p>
               <span className="text-indigo-300 text-[10px] font-mono font-bold">{nextItem.sku}</span>
            </div>
          </div>
        )}

        {/* Flash Message */}
        {lastMessage && (
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 p-4 rounded-full text-white font-black text-center shadow-2xl animate-in zoom-in duration-200 ${
                lastMessage.type === "success" ? "bg-emerald-500/90" : "bg-rose-500/90"
            }`}>
               <div className="flex items-center justify-center gap-3 px-2">
                    {lastMessage.type === "success" ? "✓ SUCCESS" : "✕ FAILED"}
               </div>
            </div>
        )}

        {/* Camera Error */}
        {errorStatus && (
           <div className="absolute inset-0 z-40 bg-black/80 flex flex-col items-center justify-center p-8 text-center backdrop-blur-md">
              <div className="w-16 h-16 bg-rose-500 rounded-full flex items-center justify-center text-3xl mb-4">⚠️</div>
              <h3 className="text-white text-lg font-black mb-2">Camera Disabled</h3>
              <p className="text-white/60 text-sm mb-6">{errorStatus}</p>
              <button 
                onClick={startScanner}
                className="bg-white text-black font-black px-8 py-3 rounded-xl hover:bg-indigo-50 transition-colors"
              >
                RETRY ACCESS
              </button>
           </div>
        )}
      </div>

      {/* Viewport 2: History (Linklist Style) */}
      <div className="flex-1 bg-white flex flex-col rounded-t-[32px] -mt-8 z-40 relative shadow-[0_-20px_50px_rgba(0,0,0,0.1)] border-t border-slate-100/50 overflow-hidden">
        
        {/* Slim Status row */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
           <div className="flex items-center gap-4">
              <div className="flex flex-col">
                 <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Progress</span>
                 <span className="text-sm font-black text-slate-900">{packedCount} <span className="text-slate-300">/</span> {totalCount}</span>
              </div>
              <div className="h-6 w-[1px] bg-slate-100"></div>
              <div className="flex flex-col">
                 <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">In Current</span>
                 <span className="text-sm font-black text-indigo-600">{packedInCurrentBox} <span className="text-[10px] uppercase">Stored</span></span>
              </div>
           </div>
           <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[9px] font-black text-emerald-500 uppercase">Live Feed</span>
           </div>
        </div>

        {/* Condensed Scanned List */}
        <div className="flex-1 overflow-y-auto px-1 pb-10">
            {scanHistory.map((item) => (
                <div key={item.id} className="mx-2 my-1 bg-white border border-slate-100 p-3 rounded-2xl flex items-center gap-4 hover:border-indigo-100 transition-all animate-in slide-in-from-right duration-300">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-xs font-black shrink-0 border border-emerald-100/20">
                        ✓
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-slate-900 text-[13px] font-bold truncate leading-none">{item.productName}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-slate-400 text-[9px] font-mono font-bold tracking-tighter bg-slate-50 px-1 rounded">{item.sku}</span>
                            <span className="text-slate-300 text-[9px]">•</span>
                            <span className="text-slate-400 text-[9px] font-bold uppercase">{item.time}</span>
                        </div>
                    </div>
                    <div className="text-[9px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                        {item.box}
                    </div>
                </div>
            ))}
            
            {scanHistory.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center opacity-30">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">Scan history empty</p>
                </div>
            )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes viewfinder-scan {
            0% { transform: translateY(0); opacity: 0.2; transform: scaleX(0.85); }
            50% { transform: translateY(180px); opacity: 1; transform: scaleX(1); }
            100% { transform: translateY(0); opacity: 0.2; transform: scaleX(0.85); }
        }
        .animate-viewfinder-scan {
            animation: viewfinder-scan 3.2s infinite ease-in-out;
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
