import crypto from 'crypto';
import EventEmitter from "node:events";
import { headers } from 'next/headers';

const maxOccupantsInRoom = 8;

const rooms = new Map();

function randomBytes() {
    return crypto.randomBytes(16).toString("base64url");
}

export function GET() {
    const headers = new Headers();
    headers.set('Connection', 'Upgrade');
    headers.set('Upgrade', 'websocket');
    return new Response('Upgrade Required', { status: 426, headers });
}

export async function UPGRADE(
    client: any,
    server: any,
) {
    await headers();

    const socket = client;
    const io = server;
    socket.id = randomBytes();
    console.log("user connected", socket.id);

    let curRoom: any = null;

    const eventEmitterIn = new EventEmitter();
    const eventEmitterOut = new EventEmitter();

    socket.on("message", (msg: any) => {
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
            // @ts-ignore
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
        // @ts-ignore
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
    let pingTimeout: NodeJS.Timeout | undefined = undefined;
    let pingInterval: NodeJS.Timeout | undefined = undefined;
    let firstPingTimeout: NodeJS.Timeout | undefined = setTimeout(() => {
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
                pingInterval = undefined;
                pingTimeout = undefined;
                disconnect();
            }, 4000);
        }, 5000);
        eventEmitterIn.on("pong", () => {
            clearTimeout(pingTimeout);
            pingTimeout = undefined;
        });
    }, 61_000);

    function disconnect() {
        // clean up ping
        clearInterval(pingInterval);
        pingInterval = undefined;
        if (firstPingTimeout) {
            clearTimeout(firstPingTimeout);
            firstPingTimeout = undefined;
        }
        if (pingTimeout) {
            clearTimeout(pingTimeout);
            pingTimeout = undefined;
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
                console.log("everybody left room: " + curRoom);
                rooms.delete(curRoom);
            }
        }

        socket.terminate();
    }
    socket.on("disconnect", disconnect);
}
