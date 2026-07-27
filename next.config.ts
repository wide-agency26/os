import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/app/home",
        permanent: false,
      },
      {
        source: "/home",
        destination: "/app/home",
        permanent: false,
      },
      {
        source: "/app",
        destination: "/app/home",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
