import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // SMS terms were consolidated into the main Terms & Conditions.
      { source: "/sms-terms", destination: "/terms", permanent: true },
      // Residential electrical retired as a standalone service — electrical now
      // lives inside the commercial offering.
      { source: "/electrical", destination: "/commercial", permanent: true },
      // Storm check + roof estimate merged into one binary eligibility tool.
      { source: "/storm-check", destination: "/roof-claim-check", permanent: true },
      { source: "/roof-estimate", destination: "/roof-claim-check", permanent: true },
    ];
  },
};

export default nextConfig;
