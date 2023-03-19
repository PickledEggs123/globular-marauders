import path from 'path';
import fs from 'fs';

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import express from 'express';

import {App} from '../src/App';
import {StaticRouter} from "react-router-dom/server";
import {CacheProvider} from "@emotion/react";
import createEmotionServer from "@emotion/server/create-instance";
import createCache from "@emotion/cache";
import {CssBaseline} from "@mui/material";
import {theme} from "../src/theme";
import {ThemeProvider} from "@mui/material/styles";

const PORT = process.env.PORT || 8080;
const app = express();

// handle react pages
const handleReactPage = (req, res) => {
    const key = 'css';
    const cache = createCache({key});
    const {extractCriticalToChunks, constructStyleTagsFromChunks} = createEmotionServer(cache);

    const html = ReactDOMServer.renderToString(
        <React.StrictMode>
            <CacheProvider value={cache}>
                <ThemeProvider theme={theme}>
                    <CssBaseline/>
                    <StaticRouter location={req.url}>
                        <App/>
                    </StaticRouter>
                </ThemeProvider>
            </CacheProvider>
        </React.StrictMode>
    );
    const chunks = extractCriticalToChunks(html);
    const styles = constructStyleTagsFromChunks(chunks);

    const indexFile = path.resolve('./build/index.html');

    fs.readFile(indexFile, 'utf8', (err, data) => {
        if (err) {
            console.error('Something went wrong:', err);
            return res.status(500).send('Oops, better luck next time!');
        }

        return res.send(
            data.replace('</head>', `${styles}</head>`).replace('<div id="root"></div>', `<div id="root">${html}</div>`)
        );
    });
};

// handle react pages with router
app.get('/', handleReactPage);
app.get('/game-model', handleReactPage);
app.get('/planet-generator', handleReactPage);
app.get('/ship-wiki', handleReactPage);
app.get('/character-wiki', handleReactPage);
app.get('/about', handleReactPage);
app.get('/contact', handleReactPage);

app.use(express.static('./build'));

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
