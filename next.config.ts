import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // SMS terms were consolidated into the main Terms & Conditions.
      { source: "/sms-terms", destination: "/terms", permanent: true },
    ];
  },
};

export default nextConfig;
