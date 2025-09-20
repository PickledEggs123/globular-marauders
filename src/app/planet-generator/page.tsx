'use client';

import dynamic from 'next/dynamic'

const DynamicComponentWithNoSSR = dynamic(
    () => import('../../appPages/PlanetGenerator'),
    { ssr: false }
)

export default function Page() {
    return <DynamicComponentWithNoSSR/>;
};
