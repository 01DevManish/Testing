"use client";

import React, { useEffect } from "react";
import { useLightbox } from "../context/LightboxContext";

const FONT = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export default function ImageLightbox() {
  const { isOpen, imageSrc, closeLightbox } = useLightbox();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [closeLightbox]);

  if (!isOpen || !imageSrc) return null;

  return (
    <div 
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "fadeIn 0.3s ease-out",
        cursor: "zoom-out"
      }}
      onClick={closeLightbox}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zoomIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Close Button */}
      <button 
        onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
        style={{
          position: "absolute",
          top: 24,
          right: 24,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.2s",
          zIndex: 10000
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      {/* Image Container */}
      <div 
        style={{
          maxWidth: "90%",
          maxHeight: "90%",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "zoomIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          cursor: "default"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <img 
          src={imageSrc} 
          alt="Preview" 
          style={{
            maxWidth: "100%",
            maxHeight: "100vh",
            objectFit: "contain",
            borderRadius: 12,
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
          }} 
        />
        
        {/* Info Overlay (Optional) */}
        <div style={{
          position: "absolute",
          bottom: -40,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "rgba(255,255,255,0.6)",
          fontSize: 12,
          fontFamily: FONT,
          letterSpacing: "0.05em"
        }}>
          CLICK OUTSIDE TO CLOSE
        </div>
      </div>
    </div>
  );
}
