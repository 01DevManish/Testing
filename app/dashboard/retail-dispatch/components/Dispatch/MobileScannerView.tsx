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

  const playBeep = (type: "success" | "error") => {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        if (type === "success") {
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        } else {
            oscillator.type = "sawtooth";
            oscillator.frequency.setValueAtTime(110, audioCtx.currentTime); // Low A
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.3);
        }
    } catch (e) {
        console.warn("Audio feedback failed:", e);
    }
  };

  const handleDetection = (code: string) => {
    // Ultra-low debounce for continuous background scanning (1 scan per ~0.3s)
    if (Date.now() - (lastMessage?.time || 0) < 300 && lastMessage?.text.includes(code)) return;

    const result = onScan(code);
    const now = Date.now();

    if (result.success) {
      setLastMessage({ type: "success", text: `Scanned: ${code}`, time: now });
      if ("vibrate" in navigator) navigator.vibrate(80);
      playBeep("success");
      
      setScanHistory(prev => [{
        id: now,
        productName: result.item.productName,
        sku: result.item.sku,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        box: currentBoxName
      }, ...prev].slice(0, 10));
    } else {
      setLastMessage({ type: "error", text: result.message || "No match", time: now });
      if ("vibrate" in navigator) navigator.vibrate([80, 50, 80]);
      playBeep("error");
    }

    // Extremely fast clear for continuous scanning loop
    setTimeout(() => {
      setLastMessage(prev => prev?.time === now ? null : prev);
    }, 400);
  };

  const currentIdx = parseInt(currentBoxName.replace(/\D/g, "")) || 1;

  if (!mounted) return null;

  const content = (
    <div className="fixed inset-0 w-full h-full z-[99999] bg-white flex flex-col font-sans overflow-hidden animate-in fade-in duration-300">
      
      {/* Viewport 1: Camera Feed (Dominant) */}
      <div className={`relative h-[72vh] transition-colors duration-200 overflow-hidden shadow-2xl ${
        lastMessage?.type === "success" ? "bg-emerald-600" : 
        lastMessage?.type === "error" ? "bg-rose-600" : "bg-black"
      }`}>
        <div id={scannerId} className={`w-full h-full transition-opacity duration-200 ${lastMessage ? "opacity-30" : "opacity-100"}`}></div>
        
        {/* Viewfinder Overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            <div className={`absolute inset-0 transition-colors duration-300 ${
                lastMessage?.type === "success" ? "bg-emerald-500/20" : 
                lastMessage?.type === "error" ? "bg-rose-500/20" : "bg-black/40"
            }`}></div>
            
            <div className={`relative w-[320px] h-[160px] z-10 transition-transform duration-200 ${lastMessage ? "scale-105" : "scale-100"}`}>
                <div className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 transition-colors duration-300 rounded-tl-xl shadow-lg ${
                    lastMessage?.type === "success" ? "border-emerald-400" : 
                    lastMessage?.type === "error" ? "border-rose-400" : "border-white"
                }`}></div>
                <div className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 transition-colors duration-300 rounded-tr-xl shadow-lg ${
                    lastMessage?.type === "success" ? "border-emerald-400" : 
                    lastMessage?.type === "error" ? "border-rose-400" : "border-white"
                }`}></div>
                <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 transition-colors duration-300 rounded-bl-xl shadow-lg ${
                    lastMessage?.type === "success" ? "border-emerald-400" : 
                    lastMessage?.type === "error" ? "border-rose-400" : "border-white"
                }`}></div>
                <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 transition-colors duration-300 rounded-br-xl shadow-lg ${
                    lastMessage?.type === "success" ? "border-emerald-400" : 
                    lastMessage?.type === "error" ? "border-rose-400" : "border-white"
                }`}></div>
                
                {!lastMessage && (
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-400 shadow-[0_0_20px_rgba(129,140,248,1)] animate-viewfinder-scan"></div>
                )}
                
                <div className="absolute inset-0 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"></div>
            </div>
            
            <p className="mt-6 text-white text-[10px] font-bold uppercase tracking-[0.4em] drop-shadow-lg opacity-40">
                Align Barcode inside Box
            </p>
        </div>

        {/* Native App Top Navigation Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 pt-6 z-50 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none pb-12">
            <button 
                onClick={onClose}
                className="pointer-events-auto flex items-center gap-1.5 text-white/90 hover:text-white transition-colors py-2 pr-4 rounded-full active:scale-95"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6"/>
                </svg>
                <span className="font-black text-sm tracking-wide">Back</span>
            </button>

            <div className="bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,1)]"></div>
                <span className="text-white text-[10px] font-black uppercase tracking-widest">{partyName.substring(0,18)}</span>
            </div>
        </div>

        {/* Target SKU Box (Floating near the bottom crosshair) */}
        <div className="absolute bottom-10 left-4 right-4 z-50 pointer-events-none">
            {nextItem ? (
                <div className="bg-indigo-600/95 backdrop-blur-2xl border border-indigo-400/50 rounded-[32px] p-5 shadow-[0_10px_40px_rgba(79,70,229,0.5)] animate-in slide-in-from-bottom duration-500 pointer-events-auto flex items-center gap-5">
                     <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl border border-white/20 flex-shrink-0 shadow-inner">
                         📦
                     </div>
                     <div className="flex-1 min-w-0">
                         <div className="flex justify-between items-center mb-1">
                             <span className="text-[10px] text-white/70 font-black uppercase tracking-[0.2em]">Scan Target</span>
                             <span className="text-[10px] text-white font-black bg-black/20 px-2.5 py-0.5 rounded-full border border-black/10">Pack {packedCount + 1}/{totalCount}</span>
                         </div>
                         <h2 className="text-white text-xl font-black truncate font-mono uppercase tracking-tight">{nextItem.sku}</h2>
                     </div>
                </div>
            ) : (
                <div className="bg-emerald-500/95 backdrop-blur-2xl rounded-[32px] p-5 flex items-center gap-4 shadow-2xl pointer-events-auto border border-emerald-400">
                     <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 animate-bounce">
                         🎉
                     </div>
                     <div>
                        <h2 className="text-white text-lg font-black uppercase tracking-wider">All Done!</h2>
                        <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Scanning Completed</p>
                     </div>
                </div>
            )}
        </div>

        {/* Camera Error Display */}
        {errorStatus && (
           <div className="absolute inset-0 z-[70] bg-slate-950 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 bg-rose-500 rounded-[28px] flex items-center justify-center text-4xl mb-6 shadow-2xl rotate-3">⚠️</div>
              <h3 className="text-white text-xl font-black mb-3">Camera Connection Lost</h3>
              <p className="text-white/50 text-xs font-bold uppercase tracking-widest leading-loose mb-10">{errorStatus}</p>
              <button 
                onClick={startScanner}
                className="bg-indigo-500 text-white font-black px-12 py-4 rounded-2xl shadow-[0_10px_30px_rgba(99,102,241,0.4)] active:scale-95 transition-all"
              >
                REINITIALIZE CAMERA
              </button>
           </div>
        )}
      </div>

      {/* Viewport 2: Activity Log (Mobile Drawer Style) */}
      <div className="flex-1 bg-white flex flex-col rounded-t-[32px] -mt-6 z-[55] relative shadow-[0_-20px_40px_rgba(0,0,0,0.15)] overflow-hidden">
        
        {/* Drawer Handle */}
        <div className="w-full flex justify-center py-3 bg-white">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
        </div>

        {/* Header/Status Strip */}
        <div className="flex items-center justify-between px-6 pb-4 bg-white border-b border-slate-100">
           <div className="flex items-center gap-4">
              <div className="flex flex-col">
                 <h3 className="text-slate-800 font-black text-lg">Scan Log</h3>
                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.1em]">{packedCount} of {totalCount} items verified</span>
              </div>
           </div>
           
           <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-100 shadow-sm">
               <span className="text-[9px] text-slate-400 font-black uppercase mr-1 pl-1">BOX</span>
               <span className="text-[11px] font-black text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-100">{currentBoxName}</span>
               <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>
               <button onClick={() => onBoxChange(Math.max(1, currentIdx - 1))} className="w-7 h-7 flex items-center justify-center bg-white text-slate-600 rounded-lg text-sm font-black active:scale-95 transition-transform" aria-label="Previous Box">−</button>
               <button onClick={() => onBoxChange(currentIdx + 1)} className="w-7 h-7 flex items-center justify-center bg-white text-slate-600 rounded-lg text-sm font-black active:scale-95 transition-transform" aria-label="Next Box">+</button>
           </div>
        </div>

        {/* History Scrollable (The Background Autofill Visuals) */}
        <div className="flex-1 overflow-y-auto px-4 pb-12 pt-3 bg-slate-50">
            {scanHistory.map((item) => (
                <div key={item.id} className="bg-white mx-1 my-2 p-4 rounded-3xl flex items-center gap-5 border border-slate-100 shadow-sm transition-all animate-in slide-in-from-bottom-2 duration-400">
                    <div className="w-12 h-12 rounded-[20px] bg-emerald-50 text-emerald-500 flex items-center justify-center text-lg shadow-inner shrink-0 border border-emerald-100">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-slate-900 text-sm font-black uppercase truncate tracking-tight">{item.sku}</p>
                        <p className="text-slate-400 text-[10px] font-bold truncate leading-tight mt-0.5">{item.productName}</p>
                    </div>
                    <div className="text-right">
                        <span className="block text-[10px] font-black text-slate-300 uppercase italic mb-0.5">{item.box}</span>
                        <span className="block text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">{item.time}</span>
                    </div>
                </div>
            ))}
            
            {scanHistory.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center opacity-40">
                    <div className="text-4xl mb-4 bg-slate-100 p-6 rounded-full grayscale animate-pulse">📡</div>
                    <p className="text-slate-500 text-xs font-black uppercase tracking-[0.3em]">Awaiting First Scan</p>
                </div>
            )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes viewfinder-scan {
            0% { transform: translateY(0); opacity: 0.2; transform: scaleX(0.85); }
            50% { transform: translateY(160px); opacity: 1; transform: scaleX(1); }
            100% { transform: translateY(0); opacity: 0.2; transform: scaleX(0.85); }
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
