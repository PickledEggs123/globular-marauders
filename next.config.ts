import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    output: 'standalone',
    distDir: 'build',
    async rewrites() {
        return [
            {
                source: "/__/auth/handler",
                destination: "/__/auth/handler/index.html",
            },
            {
                source: "/__/auth/iframe",
                destination: "/__/auth/iframe/index.html",
            },
            {
                source: "/__/auth/links",
                destination: "/__/auth/links/index.html",
            },
        ];
    },
    allowedDevOrigins: ['172.20.10.2'],
}

export default nextConfig;
