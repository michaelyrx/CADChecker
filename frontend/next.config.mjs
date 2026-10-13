import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = { output: "standalone", outputFileTracingRoot: path.resolve(process.cwd(), ".."), eslint: { ignoreDuringBuilds: true } };
export default nextConfig;
