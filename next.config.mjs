/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allows CI to use an isolated build cache when a developer has `next dev`
  // running locally. Production continues to use the normal `.next` folder.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
