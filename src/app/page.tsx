'use client';

import dynamic from "next/dynamic";

const DynamicComponentWithNoSSR = dynamic(
    () => import('../appPages/Main'),
    { ssr: false }
)

export default function Page() {
    return <DynamicComponentWithNoSSR/>;
};
