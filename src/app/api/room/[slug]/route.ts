import {PrismaClient} from '@prisma/client';
const prisma = new PrismaClient();

const maxOccupantsInRoom = 8;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {// try to find room that is less than 4 users
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
            if (!planet) {
                throw new Error("No planet found!");
            }

            availableRoom = await prisma.room.create({
                data: {
                    creationDate: new Date().toISOString(),
                    planetId: planet.id,
                    roomUser: {
                        create: [
                            {
                                webrtcId: (await params).slug,
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
                    webrtcId: (await params).slug,
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

        return new Response(JSON.stringify(availableRoom), {
            status: 200,
        });
    } catch (e) {
        console.log(e);
        return new Response(JSON.stringify({err: "an error has occurred"}), {
            status: 400,
        });
    }
}