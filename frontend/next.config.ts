import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: `${process.env.API_BASE_URL || "http://localhost:8080"}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
