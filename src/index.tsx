import React from 'react';
import './index.css';
import {App} from './App';
import reportWebVitals from './reportWebVitals';
import * as particles from "@pixi/particle-emitter";
import {BrowserRouter} from "react-router-dom";
import {CacheProvider} from "@emotion/react";
import createCache from "@emotion/cache";
import {ThemeConfig} from "./contextes/ThemeContext";
import {AuthProvider} from "./contextes/auth";

const key = 'css';
const cache = createCache({key});

export default App2;

function App2() {
    return (
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

// // If you want to start measuring performance in your app, pass a function
// // to log results (for example: reportWebVitals(console.log))
// // or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
