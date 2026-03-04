import {PrismaClient} from '@prisma/client';
const prisma = new PrismaClient();

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    let previewUrl = "";
    let gameUrl = "";
    let error = undefined;

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
        // @ts-ignore
        error = e.message;
    }

    return new Response(JSON.stringify({
        previewUrl,
        gameUrl,
        error,
    }), {
        status: error ? 500 : 200,
    });
}