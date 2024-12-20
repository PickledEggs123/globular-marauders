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
const socketRedis = require('socket.io-redis');
const redis = require('redis');

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
app.get('/2d-game', handleReactPage);
app.get('/game-model', handleReactPage);
app.get('/planet-generator', handleReactPage);
app.get('/ship-wiki', handleReactPage);
app.get('/character-wiki', handleReactPage);
app.get('/about', handleReactPage);
app.get('/contact', handleReactPage);

app.get('/api/room/:webrtcId', async (req, res) => {
    const prisma = new PrismaClient();

    // try to find room that is less than 4 users
    try {
        // find room with less than 4 users and less than 5 minutes old
        await prisma.$connect();
        const availableRoomRecords = await prisma.roomUser.groupBy({
            by: [
                "roomId",
            ],
            _count: {
                roomId: true,
            },
            where: {
                room: {
                    creationDate: {
                        gt: new Date(+new Date() - 300_000).toISOString(),
                    },
                },
            },
            having: {
                roomId: {
                    _count: {
                        lt: 4,
                    },
                },
            },
        });

        // load room
        let availableRoom;
        if (availableRoomRecords.length > 0) {
            availableRoom = await prisma.room.findFirst({
                where: {
                    id: availableRoomRecords[0].roomId,
                },
            });
        }

        // create room if not available
        if (!availableRoom) {
            // get planet
            const max = await prisma.planet.count();
            const planet = await prisma.planet.findFirst({ where: { id: Math.floor(Math.random() * max) + 1 } });

            availableRoom = await prisma.room.create({
                data: {
                    creationDate: new Date().toISOString(),
                    planetId: planet.id,
                    roomUser: {
                        create: [
                            {
                                webrtcId: req.params.webrtcId,
                                login: new Date().toISOString(),
                            },
                        ],
                    },
                },
                include: {
                    roomUser: true,
                },
            });
        } else {
            // add to room
            await prisma.roomUser.create({
                data: {
                    webrtcId: req.params.webrtcId,
                    login: new Date().toISOString(),
                    room: {
                        connect: availableRoom
                    },
                },
                include: {
                    room: true,
                },
            });
            availableRoom = await prisma.room.findFirst({
                where: {
                    id: availableRoomRecords[0].roomId,
                },
                include: {
                    roomUser: true,
                }
            });
        }

        res.status(200).json(availableRoom);
    } catch (e) {
        console.log(e);
        res.status(400).json({err: "an error has occurred"});
    } finally {
        await prisma.$disconnect();
    }
});

app.get('/api/room-manifest/:roomId', async (req, res) => {
    const prisma = new PrismaClient();

    let availableRoom;
    try {
        await prisma.$connect();

         availableRoom = await prisma.room.findFirstOrThrow({
            where: {
                id: parseInt(req.params.roomId),
            },
            include: {
                roomUser: true,
            },
        });

        res.status(200).json(availableRoom);
    } catch (e) {
        console.log(e);
        res.status(400).json({err: "an error has occurred"});
    } finally {
        await prisma.$disconnect();
    }
});

app.get('/api/planet/:roomId', async (req, res) => {
    const prisma = new PrismaClient();

    let previewUrl = "";
    let gameUrl = "";
    try {
        await prisma.$connect();

        const availableRoom = await prisma.room.findFirstOrThrow({
            where: {
                id: parseInt(req.params.roomId),
            },
            include: {
                planet: true,
            },
        });

        previewUrl = availableRoom.planet.meshUrl;
        gameUrl = availableRoom.planet.meshesUrl;

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

app.get('/api/planet', async (req, res) => {
    const prisma = new PrismaClient();

    let previewUrl = "";
    let gameUrl = "";
    try {
        await prisma.$connect();
        const max = await prisma.planet.count();
        const planet = await prisma.planet.findFirstOrThrow({ where: { id: Math.floor(Math.random() * max) + 1 } });
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
if (process.env.NODE_ENV === 'production') {
    const redisClient = redis.createClient({
        url: "redis://10.15.144.3:6379",
    });
    socketServer.adapter(socketRedis.createAdapter({
        pubClient: redisClient,
        subClient: redisClient,
    }));
}

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
easyrtc.setOption("logLevel", "error");
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
