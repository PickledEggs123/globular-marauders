import crypto from 'crypto';
import EventEmitter from "node:events";
import { headers } from 'next/headers';
import { createClient } from "redis";
import {PrismaClient} from '@prisma/client';
import {ServerIdSingleton} from "../../utils/serverId";



class AsyncEventEmitter extends EventEmitter {
    /**
     * Emit an event and wait for all async listeners to finish.
     * @param {string} event - Event name
     * @param  {...any} args - Arguments to pass to listeners
     * @returns {Promise<void>}
     */
    async emitAsync(event: string, ...args: any[]) {
        const listeners = this.listeners(event);

        // Run all listeners and wait for completion
        await Promise.all(
            listeners.map(async (listener) => {
                try {
                    await listener(...args);
                } catch (err) {
                    console.error(`Error in listener for event "${event}":`, err);
                }
            })
        );
    }
}



enum MessageType {
    JOIN_ROOM = "joinRoom",
    PING = "ping",
    PONG = "pong",
    DISCONNECT = "disconnect",
    SEND = "send",
    BROADCAST = "broadcast",
}



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



    const prisma = new PrismaClient();



    // connect to Redis
    let pub: any, sub: any;
    try {
        pub = createClient({
            socket: {
                host: process.env.REDIS_HOST,
                port: 6379
            },
        });
        sub = createClient({
            socket: {
                host: process.env.REDIS_HOST,
                port: 6379
            },
        });
        await pub.connect();
        await sub.connect();
    } catch (e) {
        console.log(e);
        throw e;
    }

    // rename variables from new code to old code
    const socket = client;
    const io = server;
    socket.id = randomBytes();
    console.log("user connected", socket.id);

    // current room of the client
    let curRoom: any = null;
    let roomFromSQL: any = null;
    let roomReady: boolean = false;

    // bounce messages around internally
    const eventEmitterIn = new AsyncEventEmitter();
    const eventEmitterOut = new AsyncEventEmitter();

    // receive messages from network, Redis or WebSocket
    const messageHandler = (forwardToRedis: boolean) => async (msg: any) => {
        const { from, type, data, to, msgType, drillToSocket } = JSON.parse(msg);

        switch (type) {
            case MessageType.JOIN_ROOM:
            case MessageType.PONG:
            case MessageType.DISCONNECT: {
                await eventEmitterIn.emitAsync(type, {
                    from, type, data, to, forwardToRedis, msgType,
                });
                break;
            }
            default: {
                await eventEmitterOut.emitAsync(msgType, {
                    from, type, data, to, forwardToRedis, drillToSocket, msgType
                });
                break;
            }
        }
    };
    socket.on("message", messageHandler(true));
    await sub.subscribe(`svr:${ServerIdSingleton.v4}`, messageHandler(false));




    // join room event
    eventEmitterIn.on(MessageType.JOIN_ROOM, async ({ from, type, data, to, forwardToRedis }) => {
        const { room, clientId } = data;

        // assign better id only on direct WebSocket connections
        if (forwardToRedis) {
            console.log("RENAMING SOCKET from", socket.id, "to", clientId);
            socket.id = clientId;
        }
        curRoom = room;

        // detect right server or need redis
        for (let i = 0; i < 10; i++) {
            roomFromSQL = await prisma.room.findFirst({
                where: {
                    id: parseInt(room),
                },
            });
            if (roomFromSQL) {
                break;
            }
            await new Promise((resolve) => {
                setTimeout(resolve, 1000);
            });
        }
        if (!roomFromSQL) {
            throw new Error("No such room with id " + room);
        }
        if (roomFromSQL.serverId !== ServerIdSingleton.v4) {
            // wrong server, publish to network
            if (forwardToRedis) {
                console.log("Forwarding joinRoom to Redis Network");
                await sub.subscribe(`msg:${clientId}`, messageHandler(false));
                await pub.publish(`svr:${roomFromSQL.serverId}`, JSON.stringify({
                    from,
                    type: MessageType.JOIN_ROOM,
                    data,
                    to,
                    msgType: MessageType.SEND,
                }));
            }
            console.log("FORWARD TO MAIN", from, roomFromSQL.serverId, type);
            return;
        } else {
            // match host server, is primary shard
            if (forwardToRedis) {
                // websocket connection subscribe to network
                await sub.subscribe(`msg:${clientId}`, messageHandler(false));
            }
        }
        console.log("RECEIVED ON MAIN", from, to, type);


        // create room
        let roomInfo = rooms.get(room);
        if (!roomInfo) {
            roomInfo = {
                name: room,
                occupants: {},
                occupantsCount: 0,
                host: clientId,
            };
            rooms.set(room, roomInfo);
        }

        // find next room
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

            // create room
            if (!availableRoomFound) {
                // No available room found, create a new one
                const newRoomNumber = numberOfInstances + 1;
                curRoom = `${roomPrefix}${newRoomNumber}`;
                roomInfo = {
                    name: curRoom,
                    occupants: {},
                    occupantsCount: 0,
                    host: clientId,
                };
                rooms.set(curRoom, roomInfo);
            }
        }

        // record order of joining so the next client can become host if the host disconnects
        const joinedTime = Date.now();
        roomInfo.occupants[clientId] = joinedTime;
        roomInfo.occupantsCount++;

        // detect if client is host
        let sendIsHost = roomInfo.host === clientId;
        console.log(`${clientId} joined room ${curRoom}`);

        // send join success
        await eventEmitterOut.emitAsync(MessageType.SEND, {
            from: "server",
            to: clientId,
            type: "connectSuccess",
            data: joinedTime,
            msgType: MessageType.SEND,
            forwardToRedis: true,
        });
        const occupants = {...roomInfo.occupants};
        await eventEmitterOut.emitAsync(MessageType.BROADCAST, {
            from: "server",
            type: "occupantsChanged",
            data: { occupants },
            msgType: MessageType.BROADCAST,
            forwardToRedis: true,
        });
        if (sendIsHost) {
            await eventEmitterOut.emitAsync(MessageType.SEND, {
                from: "server",
                to: clientId,
                type: "isHost",
                data: joinedTime,
                msgType: MessageType.SEND,
                forwardToRedis: true,
            });
        }
        roomReady = true;
    });

    eventEmitterIn.on(MessageType.DISCONNECT, async ({to}) => {
        await disconnect(to);
    });





    // send to client on server or redis
    eventEmitterOut.on(MessageType.SEND, async ({ data, from, to, type, msgType, forwardToRedis, drillToSocket }) => {
        // @ts-ignore
        const client = Array.from(io.clients).find(x => x.id === to);
        if (client) {
            // in client list, send via WebSocket
            if (from === to) {
                return;
            }
            if (type === "occupantsChanged") {
                console.log("occupantsChanged", data);
            }
            // @ts-ignore
            client.send(JSON.stringify({
                data, from, to, type, msgType,
            }));
        } else {
            // not in client list, publish to redis network
            if (from === to || to === undefined || !forwardToRedis) {
                return;
            }
            await pub.publish(`msg:${to}`, JSON.stringify({
                data,
                from,
                to,
                type,
                msgType: MessageType.SEND,
                forwardToRedis: false,
                drillToSocket: true,
            }));
        }
    });

    // broadcast to clients on server or redis
    eventEmitterOut.on(MessageType.BROADCAST, async ({ data, from, type, to: msgTo, forwardToRedis }) => {
        const mainShardOccupants = Array.from(Object.keys(rooms.get(curRoom)?.occupants ?? {}));

        // detect right server or need redis
        if (!roomReady) {
            if (["u", "um", "r"].includes(type)) {
                return;
            }
        }
        if (roomFromSQL.serverId !== ServerIdSingleton.v4 && forwardToRedis) {
            await pub.publish(`svr:${roomFromSQL.serverId}`, JSON.stringify({
                data,
                from,
                to: msgTo,
                type,
                msgType: MessageType.BROADCAST,
                forwardToRedis: false,
                drillToSocket: true,
            }));
            return;
        }

        await Promise.all(mainShardOccupants.map(async (to) => {
            if (to === msgTo) {
                return;
            }
            await eventEmitterOut.emitAsync(MessageType.SEND, {
                data, from, to, type, msgType: MessageType.SEND, forwardToRedis: true,
            });
        }));
    });




    // setup ping every 5 seconds for 4000 ms lag
    let pingTimeout: NodeJS.Timeout | undefined = undefined;
    let pingInterval: NodeJS.Timeout | undefined = undefined;
    let firstPingTimeout: NodeJS.Timeout | undefined = setTimeout(async () => {
        pingInterval = setInterval(async () => {
            await eventEmitterOut.emitAsync(MessageType.SEND, {
                data: undefined,
                from: 'server',
                to: socket.id,
                type: MessageType.PING,
                msgType: MessageType.SEND,
                forwardToRedis: true,
            });
            pingTimeout = setTimeout(async () => {
                // clean up ping
                clearInterval(pingInterval);
                pingInterval = undefined;
                pingTimeout = undefined;
                await eventEmitterIn.emitAsync(MessageType.DISCONNECT, {
                    from: "server",
                    to: socket.id,
                    type: MessageType.DISCONNECT,
                    msgType: MessageType.SEND,
                    data: undefined,
                });
            }, 4000);
        }, 5000);
        eventEmitterIn.on(MessageType.PONG, () => {
            clearTimeout(pingTimeout);
            pingTimeout = undefined;
        });
    }, 31_000);




    // disconnect client from server
    async function disconnect(clientId: any) {
        // clean up ping
        // @ts-ignore
        const client = Array.from(io.clients).find(x => x.id === clientId);
        if (client) {
            if (pingInterval) {
                clearInterval(pingInterval);
                pingInterval = undefined;
            }
            if (firstPingTimeout) {
                clearTimeout(firstPingTimeout);
                firstPingTimeout = undefined;
            }
            if (pingTimeout) {
                clearTimeout(pingTimeout);
                pingTimeout = undefined;
            }
        }

        // detect right server or need redis
        for (let i = 0; i < 60; i++) {
            if (roomReady) {
                break;
            }
            await new Promise((resolve) => {
                setTimeout(resolve, 1000);
            });
        }
        if (roomFromSQL.serverId !== ServerIdSingleton.v4) {
            // wrong server, publish to network
                console.log("Forwarding disconnect to Redis Network");
                await sub.unsubscribe(`msg:${clientId}`);
                await pub.publish(`svr:${roomFromSQL.serverId}`, JSON.stringify({
                    from: "server",
                    to: clientId,
                    type: MessageType.DISCONNECT,
                    data: undefined,
                    msgType: MessageType.SEND,
                    forwardToRedis: true,
                }));
            return;
        }

        // handle disconnect
        console.log("disconnected: ", clientId, curRoom);
        const roomInfo = rooms.get(curRoom);
        if (roomInfo) {
            console.log("user disconnected", clientId);

            delete roomInfo.occupants[clientId];
            roomInfo.occupantsCount--;
            const occupants = {...roomInfo.occupants};
            await eventEmitterOut.emitAsync(MessageType.BROADCAST, {
                from: "server",
                type: "occupantsChanged",
                data: { occupants },
                msgType: MessageType.BROADCAST,
                forwardToRedis: true,
            });

            // update host
            let sendIsHost = false;
            if (roomInfo.host === clientId) {
                console.log(`${clientId} disconnected from ${curRoom} as host`);
                roomInfo.host = null;

                roomInfo.host = Array.from(Object.keys(roomInfo.occupants))[0] || null;
                if (roomInfo.host) {
                    console.log(`${roomInfo.host} was promoted to ${curRoom} host`);
                    sendIsHost = true;
                }
            }
            if (sendIsHost) {
                await eventEmitterOut.emitAsync(MessageType.SEND, {
                    from: 'server',
                    to: roomInfo.host,
                    type: "isHost",
                    data: null,
                    msgType: MessageType.SEND,
                    forwardToRedis: true,
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



    socket.on(MessageType.DISCONNECT, async () => {
        await eventEmitterIn.emitAsync(MessageType.DISCONNECT, {
            from: "server",
            to: socket.id,
            type: MessageType.DISCONNECT,
            msgType: MessageType.SEND,
            data: undefined,
        });
    });
}
