"use client";

import React from "react";
import { useLightbox } from "../context/LightboxContext";

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  zoomable?: boolean;
}

/**
 * A reusable Image component that automatically integrates with the Global Lightbox.
 * Use this instead of standard <img> tags for images that should be zoomable.
 */
export default function SmartImage({ 
  src, 
  alt, 
  style, 
  className, 
  zoomable = true,
  ...props 
}: SmartImageProps) {
  const { openLightbox } = useLightbox();

  const handleClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (zoomable && src && typeof src === "string") {
      openLightbox(src);
    }
    if (props.onClick) props.onClick(e);
  };

  return (
    <img
      src={src}
      alt={alt || "Image"}
      {...props}
      onClick={handleClick}
      style={{
        ...style,
        cursor: zoomable ? "zoom-in" : (style?.cursor || "default"),
        transition: "opacity 0.2s ease-in-out",
      }}
      className={className}
      // Add a hover effect to indicate it's clickable
      onMouseEnter={(e) => {
        if (zoomable) e.currentTarget.style.opacity = "0.85";
      }}
      onMouseLeave={(e) => {
        if (zoomable) e.currentTarget.style.opacity = "1";
      }}
    />
  );
}
