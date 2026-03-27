export const uploadToCloudinary = async (base64OrUrl: string): Promise<string> => {
    if (!base64OrUrl.startsWith("data:image")) {
        return base64OrUrl; // Already a URL or absolute path
    }

    try {
        const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file: base64OrUrl })
        });
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Failed to upload file to Cloudinary");
        }
        if (!data.secure_url) {
            throw new Error("No secure_url returned from Cloudinary");
        }
        return data.secure_url;
    } catch (err) {
        console.error("Cloudinary Upload Error:", err);
        throw err;
    }
};

/**
 * Extracts public_id from a Cloudinary URL
 * Example: https://res.cloudinary.com/demo/image/upload/v12345678/sample.jpg -> sample
 */
export const extractPublicId = (url: string): string | null => {
    if (!url || !url.includes("cloudinary.com")) return null;
    try {
        const parts = url.split("/");
        const lastPart = parts[parts.length - 1];
        // Remove extension (e.g., .jpg, .png)
        return lastPart.split(".")[0];
    } catch (err) {
        return null;
    }
};

export const deleteFromCloudinary = async (imageUrl: string): Promise<boolean> => {
    const publicId = extractPublicId(imageUrl);
    if (!publicId) return false;

    try {
        const res = await fetch("/api/delete-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ public_id: publicId })
        });
        const data = await res.json();
        return data.result === "ok";
    } catch (err) {
        console.error("Cloudinary Delete Error:", err);
        return false;
    }
};
