/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allows CI to use an isolated build cache when a developer has `next dev`
  // running locally. Production continues to use the normal `.next` folder.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};

export default nextConfig;
