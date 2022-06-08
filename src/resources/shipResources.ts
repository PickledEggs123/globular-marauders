import {GetHullPoint, hexToRgb} from "../helpers/pixiHelpers";
import {EFaction} from "@pickledeggs123/globular-marauders-game/lib/src/EFaction";
import * as PIXI from "pixi.js";
import {
    CorvetteHull,
    EShipType,
    GetShipData,
    IShipData
} from "@pickledeggs123/globular-marauders-game/lib/src/ShipType";
import {getSpecialShipProgram} from "./specialShipProgram";
import {Game} from "@pickledeggs123/globular-marauders-game/lib/src/Game";

export class ShipResources {
    game: Game;
    constructor(game: Game) {
        this.game = game;
    }

    cachedResources: any;
    getResources = () => {
        if (this.cachedResources) {
            return this.cachedResources;
        }

        const getColor = (str: string) => {
            let shipColor;
            switch (str) {
                case "orange":
                    shipColor = [1, 0.5, 0];
                    break;
                case "red":
                    shipColor = [1, 0, 0];
                    break;
                case "blue":
                    shipColor = [0, 0, 1];
                    break;
                case "green":
                    shipColor = [0, 1, 0];
                    break;
                case "yellow":
                    shipColor = [1, 1, 0];
                    break;
                default:
                    if (str.startsWith("#")) {
                        shipColor = hexToRgb(str);
                    } else {
                        shipColor = [1, 1, 1];
                    }
            }
            return shipColor;
        }

        // generate ships
        const shipGeometryMap: Map<EFaction, Map<string, PIXI.Geometry>> = new Map();
        for (const factionType of Object.values(EFaction)) {
            for (const shipType of Object.values(EShipType)) {
                let shipToDraw: IShipData | undefined = undefined;
                try {
                    shipToDraw = GetShipData(shipType, this.game.shipScale);
                } catch (e) {

                }
                if (!shipToDraw) {
                    continue;
                }

                const shipGeometry = new PIXI.Geometry();
                const shipGeometryData: { position: number[], color: number[], index: number[] } = {
                    position: [],
                    color: [],
                    index: []
                };
                let shipColor = [1, 1, 1];
                const factionData = this.game.factions.get(factionType);
                if (factionData) {
                    shipColor = getColor(factionData.factionColor);
                }

                // draw hull
                shipGeometryData.position.push.apply(shipGeometryData.position, GetHullPoint([0, 0]));
                shipGeometryData.color.push.apply(shipGeometryData.color, shipColor);
                for (let i = 0; i < shipToDraw.hull.length; i++) {
                    // const a = shipToDraw.hull[i % shipToDraw.hull.length];
                    const a = [
                        shipToDraw.hull[i % shipToDraw.hull.length][0],
                        -shipToDraw.hull[i % shipToDraw.hull.length][1]
                    ] as [number, number];

                    shipGeometryData.position.push.apply(shipGeometryData.position, GetHullPoint(a));
                    shipGeometryData.color.push.apply(shipGeometryData.color, shipColor);
                    shipGeometryData.index.push(
                        0,
                        (i % CorvetteHull.length) + 1,
                        ((i + 1) % CorvetteHull.length) + 1,
                    );
                }

                // draw cannons
                const numCannonPositions = Math.floor(shipToDraw.cannons.numCannons / 2);
                const cannonSpacing = (shipToDraw.cannons.endY - shipToDraw.cannons.startY) / numCannonPositions;
                for (let cannonIndex = 0; cannonIndex < shipToDraw.cannons.numCannons; cannonIndex++) {
                    const position = Math.floor(cannonIndex / 2);
                    const isLeftSide = Math.floor(cannonIndex % 2) === 0;
                    const startIndex = shipGeometryData.index.reduce((acc, a) => Math.max(acc, a + 1), 0);

                    if (isLeftSide) {
                        shipGeometryData.position.push(
                            shipToDraw.cannons.leftWall, shipToDraw.cannons.startY + (position + 0.25) * cannonSpacing, 1,
                            shipToDraw.cannons.leftWall, shipToDraw.cannons.startY + (position + 0.75) * cannonSpacing, 1,
                            shipToDraw.cannons.leftWall + 5 * this.game.shipScale, shipToDraw.cannons.startY + (position + 0.75) * cannonSpacing, 1,
                            shipToDraw.cannons.leftWall + 5 * this.game.shipScale, shipToDraw.cannons.startY + (position + 0.25) * cannonSpacing, 1
                        );
                        shipGeometryData.color.push(
                            0.75, 0.75, 0.75,
                            0.75, 0.75, 0.75,
                            0.75, 0.75, 0.75,
                            0.75, 0.75, 0.75,
                        );
                    } else {
                        shipGeometryData.position.push(
                            shipToDraw.cannons.rightWall - 5 * this.game.shipScale, shipToDraw.cannons.startY + (position + 0.25) * cannonSpacing, 1,
                            shipToDraw.cannons.rightWall - 5 * this.game.shipScale, shipToDraw.cannons.startY + (position + 0.75) * cannonSpacing, 1,
                            shipToDraw.cannons.rightWall, shipToDraw.cannons.startY + (position + 0.75) * cannonSpacing, 1,
                            shipToDraw.cannons.rightWall, shipToDraw.cannons.startY + (position + 0.25) * cannonSpacing, 1
                        );
                        shipGeometryData.color.push(
                            0.75, 0.75, 0.75,
                            0.75, 0.75, 0.75,
                            0.75, 0.75, 0.75,
                            0.75, 0.75, 0.75,
                        );
                    }
                    shipGeometryData.index.push(
                        startIndex,
                        startIndex + 1,
                        startIndex + 2,
                        startIndex,
                        startIndex + 2,
                        startIndex + 3
                    );
                }

                // flip ship along y axis
                shipGeometryData.position = shipGeometryData.position.map((v, i) => i % 3 === 2 ? -v : v);

                // construct geometry
                shipGeometry.addAttribute("aPosition", shipGeometryData.position, 3);
                shipGeometry.addAttribute("aColor", shipGeometryData.color, 3);
                shipGeometry.addIndex(shipGeometryData.index);

                // add to map
                if (!shipGeometryMap.has(factionType)) {
                    shipGeometryMap.set(factionType, new Map<string, PIXI.Geometry>());
                }
                shipGeometryMap.get(factionType)?.set(shipType, shipGeometry);
            }
        }

        // create material
        const shipProgram = getSpecialShipProgram();

        this.cachedResources = {
            shipGeometryMap,
            shipProgram,
            getColor,
        };
        return this.cachedResources;
    };
}