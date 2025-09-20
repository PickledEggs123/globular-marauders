import {PrismaClient} from '@prisma/client';
const prisma = new PrismaClient();

export async function GET(req: Request) {
    let previewUrl = "";
    let gameUrl = "";

    try {
        const max = await prisma.planet.count();
        const planet = await prisma.planet.findFirstOrThrow({ where: { id: Math.floor(Math.random() * max) + 1 } });
        previewUrl = planet.meshUrl;
        gameUrl = planet.meshesUrl;
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