/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No ESLint config is checked in; don't block production builds on linting.
  eslint: { ignoreDuringBuilds: true }
};

export default nextConfig;
