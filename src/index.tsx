'use client';

import React from 'react';
import './index.css';
import {CacheProvider} from "@emotion/react";
import createCache from "@emotion/cache";
import {ThemeConfig} from "./contextes/ThemeContext";
import {AuthProvider} from "./contextes/auth";

const key = 'css';
const cache = createCache({key});

export default App2;

function App2({children}: {children: React.ReactNode}) {
    return (
        <React.StrictMode>
            <AuthProvider>
                <CacheProvider value={cache}>
                    <ThemeConfig>
                        {children}
                    </ThemeConfig>
                </CacheProvider>
            </AuthProvider>
        </React.StrictMode>
    );
}
