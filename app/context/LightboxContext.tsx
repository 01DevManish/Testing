"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface LightboxContextType {
  isOpen: boolean;
  imageSrc: string | null;
  openLightbox: (src: string) => void;
  closeLightbox: () => void;
}

const LightboxContext = createContext<LightboxContextType | undefined>(undefined);

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const openLightbox = (src: string) => {
    setImageSrc(src);
    setIsOpen(true);
    // Prevent scrolling when lightbox is open
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    setIsOpen(false);
    // Restore scrolling
    document.body.style.overflow = "auto";
  };

  return (
    <LightboxContext.Provider value={{ isOpen, imageSrc, openLightbox, closeLightbox }}>
      {children}
    </LightboxContext.Provider>
  );
}

export function useLightbox() {
  const context = useContext(LightboxContext);
  if (context === undefined) {
    throw new Error("useLightbox must be used within a LightboxProvider");
  }
  return context;
}
