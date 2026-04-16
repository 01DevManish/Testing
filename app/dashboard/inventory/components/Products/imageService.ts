import { normalizeStorageImageUrl } from "../../../../lib/urlUtils";

const REGION = process.env.NEXT_PUBLIC_AWS_S3_REGION || "ap-south-1";
const BUCKET = process.env.NEXT_PUBLIC_AWS_S3_BUCKET || "epanelimages";
const ARCHIVE_PREFIX = process.env.NEXT_PUBLIC_S3_ARCHIVE_PREFIX || "Cloudinary_Archive_2026-04-10_10_27_479_Originals/";
const CLOUDFRONT_DOMAIN = process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN; // e.g., https://d123.cloudfront.net

/**
 * Resolves any image URL to its S3 counterpart.
 * If the URL is already S3, it returns it as is.
 * If it's a Cloudinary URL, it maps it to the S3 Archive folder.
 */

let formatSupport: "avif" | "webp" | "original" = "original";

if (typeof window !== "undefined") {
    try {
        const canvas = document.createElement("canvas");
        if (canvas.toDataURL("image/avif").indexOf("data:image/avif") === 0) {
            formatSupport = "avif";
        } else if (canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0) {
            formatSupport = "webp";
        }
    } catch {
        // Fallback to basic string check if canvas fails
    }
}

export const resolveS3Url = (url: string): string => {
    if (!url) return "";
    
    // If it's already an S3 URL, return as is
    if (url.includes("amazonaws.com")) return url;

    // If it's a Cloudinary URL, map to our S3 Archive
    if (url.includes("cloudinary.com")) {
        try {
            const parts = url.split("/");
            const filename = parts[parts.length - 1]; 
            const s3Url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${ARCHIVE_PREFIX}${filename}`;
            console.log(`[S3-Resolve] Cloudinary: ${url} -> S3: ${s3Url}`);
            url = s3Url; // Continue to CloudFront rewrite if enabled
        } catch (err) {
            console.error("S3 Resolution Error:", err);
        }
    }

    // Step 2: Rewrite S3 URLs to CloudFront URLs for fast Edge optimized delivery
    if (CLOUDFRONT_DOMAIN && url.includes("amazonaws.com")) {
        const domain = CLOUDFRONT_DOMAIN.endsWith("/") ? CLOUDFRONT_DOMAIN.slice(0, -1) : CLOUDFRONT_DOMAIN;
        // Extract the path from the S3 URL
        const domainParts = url.split(".amazonaws.com/");
        if (domainParts.length > 1) {
            let path = domainParts[1];
            
            // Step 3: Progressive Format Rewrite (Client-Side Negotiation)
            // If the browser supports AVIF/WebP, we explicitly ask for it to bypass Edge logic and show in inspector
            if (formatSupport !== "original") {
                const parts = path.split('.');
                if (parts.length > 1) {
                    const ext = parts.pop()?.toLowerCase();
                    if (ext && ['jpg', 'jpeg', 'png'].includes(ext)) {
                        path = `${parts.join('.')}.${formatSupport}`;
                    }
                }
            }

            return `${domain}/${path}${process.env.NEXT_PUBLIC_IMAGE_VERSION ? `?v=${process.env.NEXT_PUBLIC_IMAGE_VERSION}` : ""}`;
        }
    }

    return url;
};

/**
 * Client-side image compression and conversion to modern formats (AVIF/WebP).
 * This reduces upload time, S3 storage costs, and improves dashboard performance.
 */
const compressImage = async (base64: string, maxWidth = 1400, quality = 0.8): Promise<string> => {
    // Only process images, skip others (PDFs, etc.)
    if (!base64.startsWith("data:image/")) return base64;

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;

            // Maintain aspect ratio while respecting maxWidth
            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) return resolve(base64);

            // Use white background for transparent images to avoid black artifacts in modern formats if needed
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            // Step 1: Try AVIF (Best compression)
            let result = canvas.toDataURL("image/avif", quality);
            
            // Step 2: Fallback to WebP if AVIF is not supported (returns image/png or similar)
            if (!result.startsWith("data:image/avif")) {
                result = canvas.toDataURL("image/webp", quality);
            }

            // Step 3: Second fallback to JPEG if WebP is also not supported
            if (!result.startsWith("data:image/webp") && !result.startsWith("data:image/avif")) {
                result = canvas.toDataURL("image/jpeg", quality);
            }

            console.log(`[Image-Optimization] Resized to ${width}x${height}, format: ${result.substring(0, 20)}...`);
            resolve(result);
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
    });
};

/**
 * Uploads an image or PDF to the S3 bucket through the local API.
 * Supports both base64 strings and standard URLs.
 * Automatically compresses and converts images to modern formats (AVIF/WebP).
 */
export const uploadImage = async (base64OrUrl: string, sku?: string): Promise<string> => {
    if (!base64OrUrl || (!base64OrUrl.startsWith("data:") && !base64OrUrl.startsWith("http"))) {
        return base64OrUrl;
    }

    try {
        // For already-hosted URLs (S3/Cloudinary/HTTP links), do not re-upload.
        // Re-uploading URL strings as base64 corrupts files on the server path.
        if (base64OrUrl.startsWith("http")) {
            return normalizeStorageImageUrl(base64OrUrl);
        }

        // We now rely on server-side Sharp for conversion, 
        // but we still do a quick client-side resize to save bandwidth during upload.
        let processableData = base64OrUrl;
        if (base64OrUrl.startsWith("data:image/")) {
            // Only resize if it's very large, let server handle the WebP conversion.
            processableData = await compressImage(base64OrUrl, 1600, 0.9);
        }

        const formData = new FormData();
        formData.append("file", processableData);
        if (sku && sku.trim()) {
            formData.append("sku", sku.trim());
        }

        const res = await fetch("/api/upload", {
            method: "POST",
            body: formData
        });
        
        const data = await res.json().catch(() => ({ error: "Server response was not valid JSON" }));

        if (!res.ok) {
            throw new Error(data.error || `Upload failed with status ${res.status}`);
        }
        if (!data.secure_url) {
            throw new Error("Invalid response: secure_url missing");
        }
        
        console.log(`[Image-Optimization] Success! Server handled WebP conversion: ${data.secure_url}`);
        return data.secure_url;
    } catch (err: unknown) {
        console.error("Image Upload Error:", err);
        const message = err instanceof Error ? err.message : "Network error occurred during upload";
        throw new Error(message);
    }
};

/**
 * Extracts the file key from an image URL.
 * Works for both legacy Cloudinary and AWS S3 patterns.
 */
export const extractImageKey = (url: string): string | null => {
    if (!url) return null;
    try {
        // Handle Cloudinary URLs (Legacy)
        if (url.includes("cloudinary.com")) {
            const parts = url.split("/");
            const lastPart = parts[parts.length - 1];
            return lastPart.split(".")[0];
        }
        
        // Handle AWS S3 URLs
        if (url.includes("amazonaws.com")) {
            // S3 pattern: https://[bucket].s3.[region].amazonaws.com/[key]
            const domainParts = url.split(".amazonaws.com/");
            if (domainParts.length > 1) {
                const keyWithParams = domainParts[1];
                // Remove any query params
                return keyWithParams.split("?")[0];
            }
        }
        return null;
    } catch (err) {
        console.error("Error extracting ID from URL:", err);
        return null;
    }
};

/**
 * Deletes an image from the storage provider (S3).
 */
export const deleteImage = async (imageUrl: string): Promise<boolean> => {
    const key = extractImageKey(imageUrl);
    if (!key) return false;

    try {
        const res = await fetch("/api/delete-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key })
        });
        const data = await res.json();
        return data.result === "ok" || data.result === "deleted";
    } catch (err) {
        console.error("Image Delete Error:", err);
        return false;
    }
};
