import React from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import {App} from './App';
import reportWebVitals from './reportWebVitals';
import * as particles from "@pixi/particle-emitter";
import {StaticQuaternionParticleBehavior} from "./resources/particles/StaticQuaternionParticleBehavior";
import {MovementQuaternionParticleBehavior} from "./resources/particles/MovementQuaternionParticleBehavior";
import {StarFieldQuaternionParticleBehavior} from "./resources/particles/StarFieldQuaternionParticleBehavior";
import {BrowserRouter} from "react-router-dom";
import {CacheProvider} from "@emotion/react";
import createCache from "@emotion/cache";
import {ThemeConfig} from "./contextes/ThemeContext";
import {AuthProvider} from "./contextes/auth";

particles.Emitter.registerBehavior(StaticQuaternionParticleBehavior);
particles.Emitter.registerBehavior(MovementQuaternionParticleBehavior);
particles.Emitter.registerBehavior(StarFieldQuaternionParticleBehavior);

const key = 'css';
const cache = createCache({key});

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <AuthProvider>
                <CacheProvider value={cache}>
                    <ThemeConfig>
                        <BrowserRouter>
                            <App/>
                        </BrowserRouter>
                    </ThemeConfig>
                </CacheProvider>
            </AuthProvider>
        </React.StrictMode>
    );
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
