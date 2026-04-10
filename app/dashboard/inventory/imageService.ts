const REGION = "ap-south-1";
const BUCKET = "epanelimages";
const ARCHIVE_PREFIX = "Cloudinary_Archive_2026-04-10_10_27_479_Originals/";

/**
 * Resolves any image URL to its S3 counterpart.
 * If the URL is already S3, it returns it as is.
 * If it's a Cloudinary URL, it maps it to the S3 Archive folder.
 */
export const resolveS3Url = (url: string): string => {
    if (!url) return "";
    
    // If it's already an S3 URL, return as is
    if (url.includes("amazonaws.com")) return url;

    // If it's a Cloudinary URL, map to our S3 Archive
    // Pattern: https://res.cloudinary.com/[cloud]/image/upload/v[version]/[path]/[public_id].[ext]
    if (url.includes("cloudinary.com")) {
        try {
            const parts = url.split("/");
            const filename = parts[parts.length - 1]; // Just the file name with extension
            const s3Url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${ARCHIVE_PREFIX}${filename}`;
            console.log(`[S3-Resolve] Cloudinary: ${url} -> S3: ${s3Url}`);
            return s3Url;
        } catch (err) {
            console.error("S3 Resolution Error:", err);
        }
    }



    return url;
};

/**
 * Uploads an image or PDF to the S3 bucket through the local API.
 * Supports both base64 strings and standard URLs.
 */
export const uploadImage = async (base64OrUrl: string): Promise<string> => {
    if (!base64OrUrl || (!base64OrUrl.startsWith("data:") && !base64OrUrl.startsWith("http"))) {
        return base64OrUrl;
    }

    try {
        const formData = new FormData();
        formData.append("file", base64OrUrl);

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
        return data.secure_url;
    } catch (err: any) {
        console.error("Image Upload Error:", err);
        throw new Error(err.message || "Network error occurred during upload");
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
