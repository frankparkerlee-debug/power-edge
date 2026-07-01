import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // SMS terms were consolidated into the main Terms & Conditions.
      { source: "/sms-terms", destination: "/terms", permanent: true },
      // Residential electrical retired as a standalone service — electrical now
      // lives inside the commercial offering.
      { source: "/electrical", destination: "/commercial", permanent: true },
    ];
  },
};

export default nextConfig;
