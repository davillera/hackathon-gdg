import path from "node:path";
import nextEnv from "@next/env";

// Las variables viven en el .env de la raíz del repo, compartido con el backend.
nextEnv.loadEnvConfig(path.resolve(process.cwd(), ".."), process.env.NODE_ENV !== "production", undefined, true);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Export estático para Firebase Hosting (carpeta `out`).
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
