/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Evidencias y tiles externos
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.basemaps.cartocdn.com" },
    ],
  },
};

export default nextConfig;
