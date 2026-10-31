'use client';

import dynamic from 'next/dynamic'

const DynamicComponentWithNoSSR = dynamic(
    () => import('../../appPages/SphericalCamera'),
    { ssr: false }
)

export default function Page() {
    return <DynamicComponentWithNoSSR/>;
};
