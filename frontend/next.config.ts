import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/w/:slug/discussion",
        destination: "/w/:slug?tab=topics",
        permanent: false,
      },
      {
        // Topics list now lives inside the world page as a tab.
        source: "/w/:slug/topics",
        destination: "/w/:slug?tab=topics",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
