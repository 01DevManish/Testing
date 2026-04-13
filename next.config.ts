import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["72.61.250.170"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.amazonaws.com" },
      { protocol: "https", hostname: "*.cloudfront.net" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
