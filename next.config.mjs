/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "tryhackme.com" },
      { protocol: "https", hostname: "*.tryhackme.com" },
    ],
  },
};

export default nextConfig;
