import { NextResponse } from 'next/server';

export async function GET() {
    const keys = [
        "CLOUDINARY_CLOUD_NAME",
        "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET",
        "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
        "NEXT_PUBLIC_CLOUDINARY_API_KEY",
        "NEXT_PUBLIC_CLOUDINARY_API_SECRET"
    ];

    const status: Record<string, string> = {};

    keys.forEach(key => {
        const value = process.env[key];
        if (value) {
            // Shadow the value for security: show only first and last 2 chars
            const shadowed = value.length > 4 
                ? `${value.substring(0, 2)}***${value.substring(value.length - 2)}`
                : "***";
            status[key] = `FOUND (${shadowed})`;
        } else {
            status[key] = "MISSING";
        }
    });

    return NextResponse.json({
        message: "Cloudinary Environment Diagnostic",
        status,
        tip: "If status is MISSING, ensure you have these keys in your .env.local (local) or your Hosting Dashboard (server)."
    });
}
