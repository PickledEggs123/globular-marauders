'use client';

import dynamic from "next/dynamic";

const App = dynamic(() => import('../../src/index'), {ssr: false});

export function ClientOnly() {
    return <App/>;
};
