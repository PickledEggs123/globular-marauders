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
    }
}

export default nextConfig;
