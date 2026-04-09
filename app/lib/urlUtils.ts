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
