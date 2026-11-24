import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    output: 'standalone',
    distDir: 'build',
    allowedDevOrigins: ['172.20.10.2'],
}

export default nextConfig;
