import React from 'react';
import type {Metadata} from "next";
import App2 from "../index";

export const metadata: Metadata = {
    title: 'Play Planet',
    description: 'Play Planet - Spherical Planets with Pirates and Wizards',
};

export default function RootLayout({
    children
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>
                <noscript>You need to enable JavaScript to run this app.</noscript>
                <div id="root">
                    <App2>
                        {children}
                    </App2>
                </div>
            </body>
        </html>
    );
}
