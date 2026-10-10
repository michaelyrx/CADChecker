/** @type {import('next').NextConfig} */
const nextConfig = { outputFileTracingRoot: process.cwd(), eslint: { ignoreDuringBuilds: true } };
export default nextConfig;
