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
    // Ultra-low debounce for continuous background scanning (1 scan per ~0.5s)
    if (Date.now() - (lastMessage?.time || 0) < 400 && lastMessage?.text.includes(code)) return;

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
    }, 500);
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

        {/* Top Navigation & Target Header */}
        <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
            
            {/* Minimal Top Bar with Close Button */}
            <div className="flex justify-between items-start p-4 mb-2">
                <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-3 shadow-lg pointer-events-auto">
                   <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                   <span className="text-white text-[10px] font-black uppercase tracking-widest">{partyName.substring(0,15)}</span>
                </div>
                
                <button 
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg hover:bg-rose-500/80 pointer-events-auto"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                  </svg>
                </button>
            </div>

            {/* Target SKU Box */}
            <div className="px-4">
               {nextItem ? (
                   <div className="bg-white/15 backdrop-blur-3xl border border-white/20 rounded-3xl p-5 shadow-2xl pointer-events-auto transform transition-transform">
                       <div className="flex justify-between items-center mb-2">
                           <span className="text-[9px] text-white/70 font-black uppercase tracking-[0.2em] flex items-center gap-2">
                               <div className="w-4 h-4 bg-indigo-500 rounded flex items-center justify-center text-[10px]">🎯</div> Target
                           </span>
                           <span className="text-[10px] text-white/90 font-black uppercase bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">Pack {packedCount + 1} of {totalCount}</span>
                       </div>
                       <div className="flex flex-col">
                           <h2 className="text-white text-[22px] font-black truncate tracking-tight uppercase font-mono">{nextItem.sku}</h2>
                           <p className="text-white/70 text-[11px] font-bold truncate tracking-wide mt-0.5">{nextItem.productName}</p>
                       </div>
                   </div>
               ) : (
                   <div className="bg-emerald-500/90 backdrop-blur-2xl rounded-3xl p-5 text-center animate-bounce shadow-2xl pointer-events-auto border border-emerald-400">
                       <h2 className="text-white text-lg font-black uppercase italic tracking-wider">🎉 Scanning Complete!</h2>
                   </div>
               )}
            </div>
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

      {/* Viewport 2: Activity Log (Premium List) */}
      <div className="flex-1 bg-slate-50 flex flex-col rounded-t-[32px] -mt-6 z-[55] relative shadow-[0_-20px_40px_rgba(0,0,0,0.15)] overflow-hidden">
        
        {/* Header/Status Strip */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-slate-100">
           <div className="flex items-center gap-4">
              <div className="flex flex-col">
                 <span className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-0.5">Scanned</span>
                 <span className="text-xl font-black text-slate-900 leading-none">{packedCount} <span className="text-sm font-bold text-slate-300">/</span> <span className="text-sm font-bold text-slate-400">{totalCount}</span></span>
              </div>
              <div className="h-8 w-[1px] bg-slate-200"></div>
              <div className="flex flex-col">
                 <span className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-0.5">Current Box</span>
                 <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{currentBoxName}</span>
                 </div>
              </div>
           </div>
           
           <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
               <button onClick={() => onBoxChange(Math.max(1, currentIdx - 1))} className="w-8 h-8 flex items-center justify-center bg-white text-slate-600 rounded-lg text-sm font-black shadow-sm active:scale-95 transition-transform">−</button>
               <button onClick={() => onBoxChange(currentIdx + 1)} className="w-8 h-8 flex items-center justify-center bg-white text-slate-600 rounded-lg text-sm font-black shadow-sm active:scale-95 transition-transform">+</button>
           </div>
        </div>

        {/* History Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 pb-12 pt-2">
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
