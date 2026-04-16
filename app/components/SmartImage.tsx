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
  const originalSrc = (src && typeof src === "string") ? src : "";
  const resolvedSrc = originalSrc ? resolveS3Url(originalSrc) : originalSrc;
  const [displaySrc, setDisplaySrc] = React.useState<string>(resolvedSrc);
  const isPriority = (props as { priority?: boolean }).priority === true;

  React.useEffect(() => {
    setDisplaySrc(resolvedSrc);
  }, [resolvedSrc]);

  const handleClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (zoomable && displaySrc) {
      openLightbox(displaySrc);
    }
    if (props.onClick) props.onClick(e);
  };

  return (
    <img
      src={displaySrc}
      alt={alt || "Image"}
      loading={isPriority ? "eager" : loading}
      {...(isPriority ? { fetchPriority: "high" } : {})}
      decoding="async"
      {...props}
      onClick={handleClick}
      onError={(e) => {
        if (originalSrc && displaySrc !== originalSrc) {
          setDisplaySrc(originalSrc);
        }
        if (props.onError) props.onError(e);
      }}
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
