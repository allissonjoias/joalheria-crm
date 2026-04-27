import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build standalone — imagem Docker ~80MB em vez de ~1GB
  output: "standalone",
  // Imagens do Supabase Storage e Instagram CDN
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.alisson.api.br" },
      { protocol: "https", hostname: "*.cdninstagram.com" },
      { protocol: "https", hostname: "*.fbcdn.net" },
      { protocol: "https", hostname: "lookaside.fbsbx.com" },
    ],
  },
  // Webhooks Unipile/Meta podem mandar payload grande
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
