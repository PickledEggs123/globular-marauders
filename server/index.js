import React from 'react';
import ReactDOMServer from 'react-dom/server';

import {App} from '../src/App';
import {StaticRouter} from "react-router-dom/server";
import {CacheProvider} from "@emotion/react";
import createEmotionServer from "@emotion/server/create-instance";
import createCache from "@emotion/cache";
import {theme} from "../src/theme";
import {ThemeProvider} from "@mui/material/styles";
import {PrismaClient} from "@prisma/client";
import compression from "compression";

const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const EventEmitter = require("node:events");
const WebSocketServer = require('ws').Server;
const crypto = require("crypto");

process.title = "globular-marauders-server";

// Get port or default to 8080
const port = process.env.PORT || 8080;

const maxOccupantsInRoom = 8;

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
app.get('/chat', handleReactPage);
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
                        lt: maxOccupantsInRoom,
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
const io = new WebSocketServer({
    server: webServer,
    path: '/socket',
});

const rooms = new Map();

function randomBytes() {
    return crypto.randomBytes(16).toString("base64url");
}

io.on("connection", (socket) => {
    socket.id = randomBytes();
    console.log("user connected", socket.id);

    let curRoom = null;

    const eventEmitterIn = new EventEmitter();
    const eventEmitterOut = new EventEmitter();

    socket.on("message", (msg) => {
        const { from, type, data, to, msgType } = JSON.parse(msg);

        switch (type) {
            case 'joinRoom':
            case 'pong': {
                eventEmitterIn.emit(type, {
                    from, type, data, to
                });
                break;
            }
            default: {
                eventEmitterOut.emit(msgType, {
                    from, type, data, to
                });
                break;
            }
        }
    });

    eventEmitterIn.on("joinRoom", ({ data }) => {
        const { room, clientId } = data;
        socket.id = clientId;

        curRoom = room;
        let roomInfo = rooms.get(room);
        if (!roomInfo) {
            roomInfo = {
                name: room,
                occupants: {},
                occupantsCount: 0,
                host: socket.id,
            };
            rooms.set(room, roomInfo);
        }

        if (roomInfo.occupantsCount >= maxOccupantsInRoom) {
            // If room is full, search for spot in other instances
            let availableRoomFound = false;
            const roomPrefix = `${room}--`;
            let numberOfInstances = 1;
            for (const [roomName, roomData] of rooms.entries()) {
                if (roomName.startsWith(roomPrefix)) {
                    numberOfInstances++;
                    if (roomData.occupantsCount < maxOccupantsInRoom) {
                        availableRoomFound = true;
                        curRoom = roomName;
                        roomInfo = roomData;
                        break;
                    }
                }
            }

            if (!availableRoomFound) {
                // No available room found, create a new one
                const newRoomNumber = numberOfInstances + 1;
                curRoom = `${roomPrefix}${newRoomNumber}`;
                roomInfo = {
                    name: curRoom,
                    occupants: {},
                    occupantsCount: 0,
                    host: socket.id,
                };
                rooms.set(curRoom, roomInfo);
            }
        }

        const joinedTime = Date.now();
        roomInfo.occupants[socket.id] = joinedTime;
        roomInfo.occupantsCount++;

        let sendIsHost = roomInfo.host === socket.id;
        console.log(`${socket.id} joined room ${curRoom}`);

        eventEmitterOut.emit("send", {
            from: "server",
            to: socket.id,
            type: "connectSuccess",
            data: joinedTime,
            msgType: 'send',
        });
        const occupants = roomInfo.occupants;
        eventEmitterOut.emit("broadcast", {
            from: "server",
            type: "occupantsChanged",
            data: { occupants },
            msgType: 'broadcast',
        });
        if (sendIsHost) {
            eventEmitterOut.emit("send", {
                from: "server",
                to: socket.id,
                type: "isHost",
                data: joinedTime,
                msgType: 'send',
            });
        }
    });

    eventEmitterOut.on("send", ({ data, from, to, type, msgType }) => {
        Array.from(io.clients).find(x => x.id === to)?.send(JSON.stringify({
            data, from, to, type, msgType,
        }));
    });

    eventEmitterOut.on("broadcast", ({ data, from, type, to: msgTo, msgType }) => {
        Array.from(Object.keys(rooms.get(curRoom)?.occupants ?? {})).forEach((to) => {
            if (to === msgTo) {
                return;
            }
            eventEmitterOut.emit("send", {
                data, from, to, type, msgType,
            });
        });
    });

    // setup ping every 5 seconds for 4000 ms lag
    let pingTimeout = null;
    let pingInterval = null;
    let firstPingTimeout = setTimeout(() => {
        pingInterval = setInterval(() => {
            eventEmitterOut.emit("send", {
                data: undefined,
                from: 'server',
                to: socket.id,
                type: 'ping',
                msgType: 'send',
            });
            pingTimeout = setTimeout(() => {
                // clean up ping
                clearInterval(pingInterval);
                pingInterval = null;
                pingTimeout = null;
                disconnect();
            }, 4000);
        }, 5000);
        eventEmitterIn.on("pong", () => {
            clearTimeout(pingTimeout);
            pingTimeout = null;
        });
    }, 61_000);

    function disconnect() {
        // clean up ping
        clearInterval(pingInterval);
        pingInterval = null;
        if (firstPingTimeout) {
            clearTimeout(firstPingTimeout);
            firstPingTimeout = null;
        }
        if (pingTimeout) {
            clearTimeout(pingTimeout);
            pingTimeout = null;
        }

        // handle disconnect
        console.log("disconnected: ", socket.id, curRoom);
        const roomInfo = rooms.get(curRoom);
        if (roomInfo) {
            console.log("user disconnected", socket.id);

            delete roomInfo.occupants[socket.id];
            roomInfo.occupantsCount--;
            const occupants = roomInfo.occupants;
            eventEmitterOut.emit("broadcast", {
                from: "server",
                type: "occupantsChanged",
                data: { occupants },
                msgType: 'broadcast',
            });

            // update host
            let sendIsHost = false;
            if (roomInfo.host === socket.id) {
                console.log(`${socket.id} disconnected from ${curRoom} as host`);
                roomInfo.host = null;

                roomInfo.host = Array.from(Object.keys(roomInfo.occupants))[0] || null;
                if (roomInfo.host) {
                    console.log(`${roomInfo.host} was promoted to ${curRoom} host`);
                    sendIsHost = true;
                }
            }
            if (sendIsHost) {
                eventEmitterOut.emit("send", {
                    from: 'server',
                    to: roomInfo.host,
                    type: "isHost",
                    data: null,
                    msgType: 'send',
                });
            }

            // delete room
            if (roomInfo.occupantsCount === 0) {
                console.log("everybody left room");
                rooms.delete(curRoom);
            }
        }

        socket.terminate();
    }
    socket.on("disconnect", disconnect);
});

webServer.listen(port, () => {
    console.log("listening on http://localhost:" + port);
});
