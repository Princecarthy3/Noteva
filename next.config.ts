import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/transcribe": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    "/api/planner/import": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
};

export default nextConfig;
