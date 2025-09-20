import {PrismaClient} from '@prisma/client';
const prisma = new PrismaClient();

const maxOccupantsInRoom = 8;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    // try to find room that is less than 4 users
    let availableRoom;

    try {

        availableRoom = await prisma.room.findFirstOrThrow({
            where: {
                id: parseInt((await params).slug),
            },
            include: {
                roomUser: true,
            },
        });

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