import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    output: 'standalone',
    distDir: 'build',
    async rewrites() {
        return {
            beforeFiles: [
                {
                    source: "/__/auth/:path*",
                    destination: "https://tyler-truong-demos.firebaseapp.com/__/auth/:path*",
                },
            ],
        };
    },
    allowedDevOrigins: ['172.20.10.2'],
}

export default nextConfig;
