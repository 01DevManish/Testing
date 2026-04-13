"use client";

import React from "react";
import { useLightbox } from "../context/LightboxContext";
import { resolveS3Url } from "../dashboard/inventory/components/Products/imageService";

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
  loading = "lazy",
  ...props 
}: SmartImageProps) {
  const { openLightbox } = useLightbox();
  const resolvedSrc = (src && typeof src === "string") ? resolveS3Url(src) : src;
  const isPriority = (props as any).priority === true;

  const handleClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (zoomable && resolvedSrc && typeof resolvedSrc === "string") {
      openLightbox(resolvedSrc);
    }
    if (props.onClick) props.onClick(e);
  };

  return (
    <img
      src={resolvedSrc}
      alt={alt || "Image"}
      loading={isPriority ? "eager" : loading}
      {...(isPriority ? { fetchPriority: "high" } : {})}
      decoding="async"
      {...props}
      onClick={handleClick}
      style={{
        ...style,
        cursor: zoomable ? "zoom-in" : (style?.cursor || "default"),
        transition: "opacity 0.2s ease-in-out, transform 0.2s ease",
      }}
      className={className}
      onMouseEnter={(e) => {
        if (zoomable) {
            e.currentTarget.style.opacity = "0.85";
            e.currentTarget.style.transform = "scale(1.02)";
        }
      }}
      onMouseLeave={(e) => {
        if (zoomable) {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.transform = "scale(1)";
        }
      }}
    />
  );
}
