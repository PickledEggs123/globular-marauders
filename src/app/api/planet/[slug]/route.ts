import {PrismaClient} from '@prisma/client';
const prisma = new PrismaClient();

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    let previewUrl = "";
    let gameUrl = "";

    try {
        const availableRoom = await prisma.room.findFirstOrThrow({
            where: {
                id: parseInt((await params).slug),
            },
            include: {
                planet: true,
            },
        });

        previewUrl = availableRoom.planet.meshUrl;
        gameUrl = availableRoom.planet.meshesUrl;
    } catch (e) {
        console.log(e);
    }

    return new Response(JSON.stringify({
        previewUrl,
        gameUrl,
    }), {
        status: 200,
    });
}