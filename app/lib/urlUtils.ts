/**
 * Utility to transform image URLs from common hosting services (like Dropbox)
 * into direct download links that can be used in <img> tags or processed by Cloudinary.
 */
export const transformImageUrl = (url: string): string => {
    if (!url) return "";
    
    let transformed = url.trim();

    // Dropbox Transformation
    // 1. Convert www.dropbox.com to dl.dropboxusercontent.com
    // 2. Remove query parameters like dl=0 or raw=0 and replace with direct download intent
    if (transformed.includes("dropbox.com")) {
        // Handle various dropbox patterns
        transformed = transformed.replace("www.dropbox.com", "dl.dropboxusercontent.com");
        
        // Ensure it doesn't have dl=0 which points to the webpage
        if (transformed.includes("?")) {
            const [base, query] = transformed.split("?");
            const params = new URLSearchParams(query);
            params.set("dl", "1");
            transformed = `${base}?${params.toString()}`;
        } else {
            transformed = `${transformed}?dl=1`;
        }
    }

    // Add other transformations here if needed (e.g., Google Drive, etc.)

    return transformed;
};

const REGION = process.env.NEXT_PUBLIC_AWS_S3_REGION || "ap-south-1";
const BUCKET = process.env.NEXT_PUBLIC_AWS_S3_BUCKET || process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME || "eurusimages";
const CLOUDFRONT_DOMAIN = (process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN || "").trim();

const normalizeDomain = (value: string): string =>
    value.replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();

const cloudfrontHost = CLOUDFRONT_DOMAIN ? normalizeDomain(CLOUDFRONT_DOMAIN) : "";

/**
 * Convert image URL to a stable, non-expiring storage URL when possible.
 * - Removes temporary query params (signed CDN URLs, cache-busters)
 * - Maps CloudFront URL to canonical S3 URL path
 * - Keeps Dropbox transformation behavior
 */
export const normalizeStorageImageUrl = (url: string): string => {
    if (!url) return "";

    const transformed = transformImageUrl(url);
    try {
        const u = new URL(transformed);
        const host = u.host.toLowerCase();
        const path = u.pathname.replace(/^\/+/, "");

        // CloudFront -> canonical S3 URL (stable and non-expiring)
        if (cloudfrontHost && host === cloudfrontHost) {
            return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${path}`;
        }

        // S3 URL => remove query params for stable identity
        if (host.includes("amazonaws.com")) {
            return `https://${u.host}${u.pathname}`;
        }

        // For other URL hosts, strip query params to avoid signed-token mismatch noise.
        return `https://${u.host}${u.pathname}`;
    } catch {
        return transformed;
    }
};

/**
 * Compare two image URLs by stable object identity.
 */
export const isSameImageIdentity = (a: string, b: string): boolean => {
    if (!a || !b) return false;
    return normalizeStorageImageUrl(a) === normalizeStorageImageUrl(b);
};
