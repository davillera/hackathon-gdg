/** @type {import('next').NextConfig} */
const nextConfig = {
  // Export estático para Firebase Hosting (carpeta `out`).
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
