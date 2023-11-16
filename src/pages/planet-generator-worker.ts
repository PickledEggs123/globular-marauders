// @ts-ignore
import {generatePlanet, generatePlanetMesh} from "@pickledeggs123/globular-marauders-generator/dist/helpers";
import {VoronoiCell} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";
import {VoronoiTerrain} from "@pickledeggs123/globular-marauders-game/lib/src";
import {Game} from "@pickledeggs123/globular-marauders-game/lib/src/Game";
import seedrandom from "seedrandom";
import {VoronoiTreeNode} from "@pickledeggs123/globular-marauders-game/lib/src/VoronoiTree";

let seed: string;
let data2: any = null;

// eslint-disable-next-line no-restricted-globals
self.onmessage = (e: MessageEvent<string>) => {
    if (e.data === "init") {
        seed = new Date().toISOString();

        const data0 = generatePlanet(0, seed);
// eslint-disable-next-line no-restricted-globals
        self.postMessage({
            mesh: data0.mesh,
            deleteBefore: true,
            heightMapData: null
        });

        const data1 = generatePlanet(1, seed);
// eslint-disable-next-line no-restricted-globals
        self.postMessage({
            mesh: data1.mesh,
            deleteBefore: true,
            heightMapData: null,
        });

        data2 = generatePlanet(2, seed);
// eslint-disable-next-line no-restricted-globals
        self.postMessage({
            mesh: data2.mesh,
            deleteBefore: true,
            heightMapData: data2.heightMapData
        });
    } else {
        const game = new Game();
        const voronoiTerrain = VoronoiTerrain.deserializeTerrainPlanet(game, data2.voronoiTerrain);
        const combinedVoronoiTreeNodes2 = voronoiTerrain.nodes.reduce((acc, x) => [
            ...acc,
            ...x.nodes.reduce((acc2, y) => [
                ...acc2,
                ...y.nodes.reduce((acc3, z) => [
                    ...acc3,
                    z
                ], [] as VoronoiTreeNode<any>[])
            ], [] as VoronoiTreeNode<any>[])
        ], [] as VoronoiTreeNode<any>[]);
        const combinedVoronoiCells2 = combinedVoronoiTreeNodes2.map(x => x.voronoiCell);
        // @ts-ignore
        const heightMap = new Map<VoronoiCell, number>(data2.heightMapData.map(([key, value]) => [combinedVoronoiCells2[key], value]));
        const colors3 = (data2.colorData as [number, [number, number, number][]]).map((value: any): [VoronoiCell, [number, number, number]] => [combinedVoronoiCells2[value[0]], value[1]]);
        for (const [v, height] of Array.from(heightMap.entries())) {
            if (height >= 0 && combinedVoronoiCells2.indexOf(v) === parseInt(e.data)) {
                const index = combinedVoronoiCells2.indexOf(v);
                const node = combinedVoronoiTreeNodes2[index];
                voronoiTerrain.setRecursionNodeLevels([100, 10, 10, 100]);
                game.seedRandom = seedrandom(`${seed}-terrainTiles`);
                node.generateTerrainPlanet(2, 3);
                const voronoiCells = node.nodes.reduce((acc, x) => [
                    ...acc,
                    x.voronoiCell
                ], [] as VoronoiCell[]);


                const generateMesh = (voronoiCells: VoronoiCell[], colors: [number, number, number][]) => {
                    return voronoiCells.reduce((acc, v, index) => {
                        // color of voronoi tile
                        const color = colors[index];
                        // initial center index
                        const startingIndex = acc.index.reduce((acc, a) => Math.max(acc, a + 1), 0);
                        acc.position.push.apply(acc.position, v.centroid.map(x => x * 1.05));
                        acc.color.push.apply(acc.color, color);
                        acc.normal.push.apply(acc.normal, v.centroid);
                        for (let i = 0; i < v.vertices.length; i++) {
                            // vertex data
                            const a = v.vertices[i % v.vertices.length];
                            acc.position.push.apply(acc.position, a);
                            acc.color.push.apply(acc.color, color);
                            acc.normal.push.apply(acc.normal, a);
                            // triangle data
                            acc.index.push(startingIndex, startingIndex + (i % v.vertices.length) + 1, startingIndex + ((i + 1) % v.vertices.length) + 1);
                        }
                        return acc;
                    }, {
                        position: [] as number[],
                        color: [] as number[],
                        normal: [] as number[],
                        index: [] as number[]
                    });
                };

                const colors4 = voronoiCells.map((x) => {
                    const color: [number, number, number] = (colors3.find((item) => item[0].containsPoint(x.centroid)) ?? [x, [0, 0, 0]])[1];
                    const newColor = [color[0] * (game.seedRandom.double() * 0.1 + 0.9), color[1] * (game.seedRandom.double() * 0.1 + 0.9), color[2] * (game.seedRandom.double() * 0.1 + 0.9)];
                    return [x, newColor] as [VoronoiCell, [number, number, number]];
                });
                const meshData = generateMesh(voronoiCells, colors4.map(x => x[1]));
                const mesh = {
                    attributes: [{
                        id: "aPosition", buffer: meshData.position, size: 3
                    }, {
                        id: "aColor", buffer: meshData.color, size: 3
                    }, {
                        id: "aNormal", buffer: meshData.normal, size: 3
                    }],
                    index: meshData.index
                };
// eslint-disable-next-line no-restricted-globals
                self.postMessage({
                    mesh,
                    deleteBefore: false
                });
            }
        }
    }
}