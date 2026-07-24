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
        destination: `${process.env.NEXT_PUBLIC_UPLOAD_API_BASE_URL}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
