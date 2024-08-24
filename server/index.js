import React from 'react';
import ReactDOMServer from 'react-dom/server';

import {App} from '../src/App';
import {StaticRouter} from "react-router-dom/server";
import {CacheProvider} from "@emotion/react";
import createEmotionServer from "@emotion/server/create-instance";
import createCache from "@emotion/cache";
import {CssBaseline} from "@mui/material";
import {theme} from "../src/theme";
import {ThemeProvider} from "@mui/material/styles";
import {PrismaClient} from "@prisma/client";
import compression from "compression";

const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const easyrtc = require('open-easyrtc');

process.title = "globular-marauders-server";

// get port or default to 8080
const PORT = process.env.PORT || 8080;

// setup and configure express http server.
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

const planetRand = Math.random();

app.get('/api/planet', async (req, res) => {
    const prisma = new PrismaClient();

    let previewUrl = "";
    let gameUrl = "";
    try {
        await prisma.$connect();
        const max = await prisma.planet.count();
        const planet = await prisma.planet.findFirstOrThrow({ where: { id: Math.floor(planetRand * max) + 1 } });
        previewUrl = planet.meshUrl;
        gameUrl = planet.meshesUrl;

        await prisma.$disconnect();
    } catch (e) {
        console.log(e);
        await prisma.$disconnect();
    }

    res.status(200).json({
        previewUrl,
        gameUrl,
    });
});

app.use(compression());
app.use(express.static('./build'));

// Start Express http server
const webServer = http.createServer(app);
// To enable https on the node server, comment the line above and uncomment the line below
// const webServer = https.createServer(credentials, app);

// Start Socket.io so it attaches itself to Express server
const socketServer = socketIo(webServer, {"log level": 1});
const myIceServers = [
    {"urls":"stun:stun1.l.google.com:19302"},
    {"urls":"stun:stun2.l.google.com:19302"},
    // {
    //   "urls":"turn:[ADDRESS]:[PORT]",
    //   "username":"[USERNAME]",
    //   "credential":"[CREDENTIAL]"
    // },
    // {
    //   "urls":"turn:[ADDRESS]:[PORT][?transport=tcp]",
    //   "username":"[USERNAME]",
    //   "credential":"[CREDENTIAL]"
    // }
];
easyrtc.setOption("appIceServers", myIceServers);
easyrtc.setOption("logLevel", "debug");
easyrtc.setOption("demosEnable", false);

// Overriding the default easyrtcAuth listener, only so we can directly access its callback
easyrtc.events.on("easyrtcAuth", (socket, easyrtcid, msg, socketCallback, callback) => {
    easyrtc.events.defaultListeners.easyrtcAuth(socket, easyrtcid, msg, socketCallback, (err, connectionObj) => {
        if (err || !msg.msgData || !msg.msgData.credential || !connectionObj) {
            callback(err, connectionObj);
            return;
        }

        connectionObj.setField("credential", msg.msgData.credential, {"isShared":false});

        console.log("["+easyrtcid+"] Credential saved!", connectionObj.getFieldValueSync("credential"));

        callback(err, connectionObj);
    });
});

// To test, lets print the credential to the console for every room join!
easyrtc.events.on("roomJoin", (connectionObj, roomName, roomParameter, callback) => {
    console.log("["+connectionObj.getEasyrtcid()+"] Credential retrieved!", connectionObj.getFieldValueSync("credential"));
    easyrtc.events.defaultListeners.roomJoin(connectionObj, roomName, roomParameter, callback);
});

// Start EasyRTC server
easyrtc.listen(app, socketServer, null, (err, rtcRef) => {
    console.log("Initiated");

    rtcRef.events.on("roomCreate", (appObj, creatorConnectionObj, roomName, roomOptions, callback) => {
        console.log("roomCreate fired! Trying to create: " + roomName);

        appObj.events.defaultListeners.roomCreate(appObj, creatorConnectionObj, roomName, roomOptions, callback);
    });
});

// Listen on port
webServer.listen(PORT, () => {
    console.log("listening on http://localhost:" + PORT);
});