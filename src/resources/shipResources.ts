import {
    computePositionPolarCorrectionFactorTheta,
    convertPositionQuaternionToPositionPolar,
    hexToRgb, IPositionPolarData,
    isPositionPolarDifferent
} from "../helpers/pixiHelpers";
import {EFaction} from "@pickledeggs123/globular-marauders-game/lib/src/EFaction";
import * as PIXI from "pixi.js";
import {
    EShipType,
    GetShipData,
    IShipData, PHYSICS_SCALE
} from "@pickledeggs123/globular-marauders-game/lib/src/ShipType";
import {getSpecialShipProgram} from "./specialShipProgram";
import * as particles from "@pixi/particle-emitter";
import Quaternion from "quaternion";
import {EParticleState} from "../pages/PixiGameBase";
import PixiGame from "../pages/PixiGame";
import {DelaunayGraph} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";
import cutterMeshJson from "@pickledeggs123/globular-marauders-generator/meshes/ships/cutter.mesh.json";
import sloopMeshJson from "@pickledeggs123/globular-marauders-generator/meshes/ships/sloop.mesh.json";
import corvetteMeshJson from "@pickledeggs123/globular-marauders-generator/meshes/ships/corvette.mesh.json";
import brigantineMeshJson from "@pickledeggs123/globular-marauders-generator/meshes/ships/brigantine.mesh.json";
import brigMeshJson from "@pickledeggs123/globular-marauders-generator/meshes/ships/brig.mesh.json";
import frigateMeshJson from "@pickledeggs123/globular-marauders-generator/meshes/ships/frigate.mesh.json";
import galleonMeshJson from "@pickledeggs123/globular-marauders-generator/meshes/ships/galleon.mesh.json";
import {IGameMesh} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";

const mapShipTypeToMeshJson = new Map<EShipType, IGameMesh>();
mapShipTypeToMeshJson.set(EShipType.CUTTER, cutterMeshJson);
mapShipTypeToMeshJson.set(EShipType.SLOOP, sloopMeshJson);
mapShipTypeToMeshJson.set(EShipType.CORVETTE, corvetteMeshJson);
mapShipTypeToMeshJson.set(EShipType.BRIGANTINE, brigantineMeshJson);
mapShipTypeToMeshJson.set(EShipType.BRIG, brigMeshJson);
mapShipTypeToMeshJson.set(EShipType.FRIGATE, frigateMeshJson);
mapShipTypeToMeshJson.set(EShipType.GALLEON, galleonMeshJson);

export class ShipResources {
    game: PixiGame;
    constructor(game: PixiGame) {
        this.game = game;
    }

    private getFreshData() {
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
                    shipToDraw = GetShipData(shipType, this.game.game.shipScale);
                } catch (e) {

                }
                if (!shipToDraw) {
                    continue;
                }

                const shipGeometry = new PIXI.Geometry();
                const shipGeometryData: { position: number[], color: number[], normal: number[], index: number[] } = {
                    position: [],
                    color: [],
                    normal: [],
                    index: []
                };
                let shipColor = [1, 1, 1];
                const factionData = this.game.game.factions.get(factionType);
                if (factionData) {
                    shipColor = getColor(factionData.factionColor);
                }

                //
                // // draw hull
                // shipGeometryData.position.push.apply(shipGeometryData.position, GetHullPoint([0, 0]));
                // shipGeometryData.color.push.apply(shipGeometryData.color, shipColor);
                // for (let i = 0; i < shipToDraw.hull.length; i++) {
                //     // const a = shipToDraw.hull[i % shipToDraw.hull.length];
                //     const a = [
                //         shipToDraw.hull[i % shipToDraw.hull.length][0],
                //         -shipToDraw.hull[i % shipToDraw.hull.length][1]
                //     ] as [number, number];
                //
                //     shipGeometryData.position.push.apply(shipGeometryData.position, GetHullPoint(a));
                //     shipGeometryData.color.push.apply(shipGeometryData.color, shipColor);
                //     shipGeometryData.index.push(
                //         0,
                //         (i % CorvetteHull.length) + 1,
                //         ((i + 1) % CorvetteHull.length) + 1,
                //     );
                // }
                //
                // // draw cannons
                // const numCannonPositions = Math.floor(shipToDraw.cannons.numCannons / 2);
                // const cannonSpacing = (shipToDraw.cannons.endY - shipToDraw.cannons.startY) / numCannonPositions;
                // for (let cannonIndex = 0; cannonIndex < shipToDraw.cannons.numCannons; cannonIndex++) {
                //     const position = Math.floor(cannonIndex / 2);
                //     const isLeftSide = Math.floor(cannonIndex % 2) === 0;
                //     const startIndex = shipGeometryData.index.reduce((acc, a) => Math.max(acc, a + 1), 0);
                //
                //     if (isLeftSide) {
                //         shipGeometryData.position.push(
                //             shipToDraw.cannons.leftWall, shipToDraw.cannons.startY + (position + 0.25) * cannonSpacing, 1,
                //             shipToDraw.cannons.leftWall, shipToDraw.cannons.startY + (position + 0.75) * cannonSpacing, 1,
                //             shipToDraw.cannons.leftWall + 5 * this.game.game.shipScale, shipToDraw.cannons.startY + (position + 0.75) * cannonSpacing, 1,
                //             shipToDraw.cannons.leftWall + 5 * this.game.game.shipScale, shipToDraw.cannons.startY + (position + 0.25) * cannonSpacing, 1
                //         );
                //         shipGeometryData.color.push(
                //             0.75, 0.75, 0.75,
                //             0.75, 0.75, 0.75,
                //             0.75, 0.75, 0.75,
                //             0.75, 0.75, 0.75,
                //         );
                //     } else {
                //         shipGeometryData.position.push(
                //             shipToDraw.cannons.rightWall - 5 * this.game.game.shipScale, shipToDraw.cannons.startY + (position + 0.25) * cannonSpacing, 1,
                //             shipToDraw.cannons.rightWall - 5 * this.game.game.shipScale, shipToDraw.cannons.startY + (position + 0.75) * cannonSpacing, 1,
                //             shipToDraw.cannons.rightWall, shipToDraw.cannons.startY + (position + 0.75) * cannonSpacing, 1,
                //             shipToDraw.cannons.rightWall, shipToDraw.cannons.startY + (position + 0.25) * cannonSpacing, 1
                //         );
                //         shipGeometryData.color.push(
                //             0.75, 0.75, 0.75,
                //             0.75, 0.75, 0.75,
                //             0.75, 0.75, 0.75,
                //             0.75, 0.75, 0.75,
                //         );
                //     }
                //     shipGeometryData.index.push(
                //         startIndex,
                //         startIndex + 1,
                //         startIndex + 2,
                //         startIndex,
                //         startIndex + 2,
                //         startIndex + 3
                //     );
                // }

                // flip ship along y axis
                shipGeometryData.position = shipGeometryData.position.map((v, i) => i % 3 === 2 ? -v : v);

                // insert gltf mesh
                const gltfData = mapShipTypeToMeshJson.get(shipType);
                if (gltfData) {
                    const q = Quaternion.fromBetweenVectors([0, 0, 1], [1, 0, 0]).mul(Quaternion.fromAxisAngle([0, 0, 1], -Math.PI / 2));

                    const startIndex = shipGeometryData.index.reduce((acc, a) => Math.max(acc, a + 1), 0);
                    const aPosition = gltfData.attributes.find(x => x.id === "aPosition");
                    const aColor = gltfData.attributes.find(x => x.id === "aColor");
                    const aNormal = gltfData.attributes.find(x => x.id === "aNormal");
                    if (aPosition && aColor && aNormal) {
                        for (let i = 0; i < aPosition.buffer.length; i += 3) {
                            const p = [aPosition.buffer[i], aPosition.buffer[i + 1], aPosition.buffer[i + 2]] as [number, number, number];
                            const p2 = q.rotateVector(p);
                            for (let i = 0; i < p2.length; i++) {
                                p2[i] *= 6;
                            }
                            shipGeometryData.position.push(...p2);
                        }
                        for (let i = 0; i < aNormal.buffer.length; i += 3) {
                            const p = [aNormal.buffer[i], aNormal.buffer[i + 1], aNormal.buffer[i + 2]] as [number, number, number];
                            const p2 = q.rotateVector(p);
                            shipGeometryData.normal.push(...p2);
                        }
                        for (let i = 0; i < aColor.buffer.length; i += 3) {
                            const r = aColor.buffer[i];
                            const g = aColor.buffer[i + 1];
                            const b = aColor.buffer[i + 2];
                            if (r === g && g === b) {
                                shipGeometryData.color.push(r, g, b);
                            } else {
                                shipGeometryData.color.push(...shipColor);
                            }
                        }
                        for (const i of gltfData.index) {
                            shipGeometryData.index.push(i + startIndex);
                        }
                    }
                }

                // construct geometry
                shipGeometry.addAttribute("aPosition", shipGeometryData.position, 3);
                shipGeometry.addAttribute("aColor", shipGeometryData.color, 3);
                shipGeometry.addAttribute("aNormal", shipGeometryData.normal, 3);
                shipGeometry.addIndex(shipGeometryData.index);

                // add to map
                if (!shipGeometryMap.has(factionType)) {
                    shipGeometryMap.set(factionType, new Map<string, PIXI.Geometry>());
                }
                shipGeometryMap.get(factionType)?.set(shipType, shipGeometry);
            }
        }

        // create material
        const shipProgram = getSpecialShipProgram().color;

        const shipDepthProgram = getSpecialShipProgram().depth;

        const shipMeshes: Array<{
            id: string,
            mesh: PIXI.Mesh<PIXI.Shader>,
            depthMesh: PIXI.Mesh<PIXI.Shader>,
            text: PIXI.Text,
            trailContainer: PIXI.Container,
            trail: particles.Emitter,
            trailState: EParticleState,
            line: PIXI.Graphics,
            cannonBallLeft: PIXI.Graphics,
            cannonBallRight: PIXI.Graphics,
            autoPilotLines: PIXI.Graphics[],
            autoPilotLinePoints: [number, number, number][],
            health: PIXI.Graphics,
            healthColor: number,
            healthValue: number,
            isPlayer: boolean,
            isEnemy: boolean,
            position: Quaternion,
            positionPolarNew: IPositionPolarData,
            positionPolarOld: IPositionPolarData,
            correctionFactorTheta: number,
            orientation: Quaternion,
            positionVelocity: Quaternion,
            positionVelocityTheta: number,
            tick: number
        }> = [];

        return {
            shipGeometryMap,
            shipProgram,
            shipDepthProgram,
            getColor,
            shipMeshes,
        };
    }

    cachedResources: any;
    getResources = () => {
        if (this.cachedResources) {
            return this.cachedResources;
        }

        const {
            shipGeometryMap,
            shipProgram,
            shipDepthProgram,
            getColor,
            shipMeshes,
        } = this.getFreshData();

        const removeExtraRotation = (q: Quaternion): Quaternion => {
            return Quaternion.fromBetweenVectors([0, 0, 1], q.rotateVector([0, 0, 1]));
        };

        const handleSync = (pixiTick: number) => {
            for (const [, ship] of Array.from(this.game.game.ships)) {
                const shipMesh = this.cachedResources.shipMeshes.find((s: any) => s.id === ship.id);
                if (shipMesh) {
                    shipMesh.isPlayer = this.game.getPlayerShip().id === ship.id;
                    shipMesh.isEnemy = this.game.findPlayerShip()?.faction?.id !== ship.faction?.id;
                    shipMesh.healthValue = Math.ceil(ship.health / ship.maxHealth * 100);

                    switch (shipMesh.trailState) {
                        case EParticleState.STOP: {
                            if ((shipMesh.isPlayer && !this.game.state.autoPilotEnabled ? this.game.activeKeys : ship.activeKeys).includes("w")) {
                                shipMesh.trailState = EParticleState.PLAYING;
                            }
                            break;
                        }
                        case EParticleState.PLAYING: {
                            shipMesh.trail.emit = true;
                            shipMesh.trailState = EParticleState.PLAY;
                            break;
                        }
                        case EParticleState.PLAY: {
                            if (!(shipMesh.isPlayer && !this.game.state.autoPilotEnabled ? this.game.activeKeys : ship.activeKeys).includes("w")) {
                                shipMesh.trailState = EParticleState.STOPPING;
                            }
                            break;
                        }
                        case EParticleState.STOPPING: {
                            shipMesh.trail.emit = false;
                            shipMesh.trailState = EParticleState.STOP;
                            break;
                        }
                    }

                    const currentPositionPolar = convertPositionQuaternionToPositionPolar(ship.position);
                    if (isPositionPolarDifferent(shipMesh.positionPolarNew, currentPositionPolar)) {
                        shipMesh.positionPolarOld = shipMesh.positionPolarNew;
                        shipMesh.positionPolarNew = currentPositionPolar;
                        shipMesh.correctionFactorTheta = -computePositionPolarCorrectionFactorTheta(shipMesh.positionPolarOld, shipMesh.positionPolarNew) + Math.PI / 2;
                        if (ship === this.game.findPlayerShip()) {
                            this.game.cameraCorrectionFactor = shipMesh.correctionFactorTheta;
                        }
                    }
                    shipMesh.position = removeExtraRotation(ship.position);
                    shipMesh.positionVelocity = removeExtraRotation(ship.positionVelocity);
                    const positionVelocityPoint = ship.positionVelocity.rotateVector([0, 0, 1]);
                    const positionVelocityPointLength = Math.sqrt(positionVelocityPoint[0] ** 2 + positionVelocityPoint[1] ** 2);
                    if (positionVelocityPointLength > 0.0001) {
                        shipMesh.positionVelocityTheta = Math.atan2(positionVelocityPoint[1], positionVelocityPoint[0]);
                        if (ship === this.game.findPlayerShip()) {
                            this.game.cameraPositionVelocityTheta = shipMesh.positionVelocityTheta;
                        }
                    }
                    shipMesh.orientation = ship.orientation.clone().mul(Quaternion.fromAxisAngle([0, 0, 1], -shipMesh.positionVelocityTheta + Math.PI / 2));
                    const playerData = (this.game.playerId && this.game.game.playerData.get(this.game.playerId)) ?? null;
                    if (ship.pathFinding.points.length > 0 && !(
                        shipMesh.autoPilotLines.length === ship.pathFinding.points.length &&
                        ship.pathFinding.points.every(p => shipMesh.autoPilotLinePoints.includes(p)))
                    ) {
                        shipMesh.autoPilotLines.forEach((i: any) => {
                            this.game.application.stage.removeChild(i);
                        });
                        shipMesh.autoPilotLines.splice(0, shipMesh.autoPilotLines.length);
                        if (shipMesh.isPlayer && playerData) {
                            ship.pathFinding.points.forEach(() => {
                                const autoPilotLine = new PIXI.Graphics();
                                autoPilotLine.zIndex = -5;
                                this.game.application.stage.addChild(autoPilotLine);
                                shipMesh.autoPilotLines.push(autoPilotLine);
                            });
                        }
                    }
                    shipMesh.autoPilotLinePoints.splice(0, shipMesh.autoPilotLinePoints.length, ...ship.pathFinding.points);
                    shipMesh.tick = pixiTick;
                } else {
                    this.game.addShip({
                        ship,
                        cameraPosition: this.game.cameraPosition,
                        cameraOrientation: this.game.cameraOrientation,
                        tick: pixiTick
                    });
                }
            }
            for (const item of this.cachedResources.shipMeshes.filter((m: any) => m.tick !== pixiTick || this.game.clearMeshes)) {
                this.game.colorLayer.removeChild(item.mesh);
                this.game.depthLayer.removeChild(item.depthMesh);
                this.game.textColorLayer.removeChild(item.text);
                this.game.application.stage.removeChild(item.line);
                this.game.application.stage.removeChild(item.cannonBallLeft);
                this.game.application.stage.removeChild(item.cannonBallRight);
                this.game.application.stage.removeChild(item.health);
                item.trail.emit = false;
                item.trail.destroy();
                this.game.projectileColorLayer.removeChild(item.trailContainer);
                for (const autoPilotLine of item.autoPilotLines) {
                    this.game.application.stage.removeChild(autoPilotLine);
                }
                item.autoPilotLines.splice(0, item.autoPilotLines.length);
            }
            this.cachedResources.shipMeshes = this.cachedResources.shipMeshes.filter((m: any) => m.tick === pixiTick && !this.game.clearMeshes);
        };

        const handleRender = () => {
            for (const item of this.cachedResources.shipMeshes) {
                const setShader = (shader: PIXI.Shader) => {
                    shader.uniforms.uCameraPosition = this.game.cameraPosition.clone().inverse().toMatrix4();
                    shader.uniforms.uCameraOrientation = this.game.cameraOrientation.clone().inverse().toMatrix4();
                    shader.uniforms.uCameraPositionInv = this.game.cameraPosition.clone().toMatrix4();
                    shader.uniforms.uCameraOrientationInv = this.game.cameraOrientation.clone().toMatrix4();
                    shader.uniforms.uCorrectionFactorTheta = item.correctionFactorTheta;
                    shader.uniforms.uCameraScale = this.game.state.zoom;
                    shader.uniforms.uPosition = removeExtraRotation(item.position).toMatrix4();
                    shader.uniforms.uOrientation = this.game.convertOrientationToDisplay(item.orientation.mul(Quaternion.fromAxisAngle([0, 0, 1], Math.PI))).toMatrix4();
                };

                // handle color
                setShader(item.mesh.shader);
                this.game.updateMeshIfVisible(item);

                // handle depth
                setShader(item.depthMesh.shader);
                this.game.updateMeshIfVisible({...item, mesh: item.depthMesh});

                // hide ships on the other side of the world
                const shipPoint = DelaunayGraph.distanceFormula(
                    this.game.cameraPosition.rotateVector([0, 0, 1]),
                    item.position.rotateVector([0, 0, 1])
                ) < 0.001 ? [0, 0, 1] as [number, number, number] : this.game.cameraOrientation.clone().inverse()
                    .mul(this.game.cameraPosition.clone().inverse())
                    .mul(item.position.clone())
                    .rotateVector([0, 0, 1]);
                item.mesh.visible = shipPoint[2] > 0;
                item.depthMesh.visible = shipPoint[2] > 0;

                this.game.handleDrawingOfText(item.text, item.position);

                // draw player dotted line
                if (item.isPlayer) {
                    const lineXS = 1 / 2 * this.game.application.renderer.width;
                    const lineYS = 1 / 2 * this.game.application.renderer.height;

                    // velocity line
                    {
                        const endPoint = DelaunayGraph.distanceFormula(
                            [0, 0, 1],
                            item.positionVelocity.rotateVector([0, 0, 1])
                        ) < 0.00001 ? [0, 0, 1] as [number, number, number] :
                            item.orientation.clone().inverse().mul(Quaternion.fromAxisAngle([0, 0, 1], item.positionVelocityTheta + item.correctionFactorTheta - Math.PI / 2)).rotateVector([0, 1, 0]);
                        endPoint[2] = 0;
                        const endPointScaleFactor = 1 / Math.max(Math.abs(endPoint[0]), Math.abs(endPoint[1]));
                        endPoint[0] *= endPointScaleFactor;
                        endPoint[1] *= endPointScaleFactor;
                        const lineXE = ((-endPoint[0] * this.game.state.zoom * this.game.game.worldScale) + 1) / 2 * this.game.application.renderer.width;
                        const lineYE = ((-endPoint[1] * this.game.state.zoom * this.game.game.worldScale) + 1) / 2 * this.game.application.renderer.height;

                        const dashLength = 5;
                        const lineDirection = DelaunayGraph.normalize(
                            DelaunayGraph.subtract(
                                [lineXE, lineYE, 0],
                                [lineXS, lineYS, 0]
                            )
                        );
                        const lineLength = DelaunayGraph.distanceFormula(
                            [lineXE, lineYE, 0],
                            [lineXS, lineYS, 0]
                        );

                        // draw line
                        item.line.clear();
                        item.line.beginFill(0xff0000ff);
                        item.line.lineStyle(1, 0xff0000ff);
                        for (let i = 0; i < lineLength; i += dashLength * 2) {
                            item.line.moveTo(
                                lineXS + lineDirection[0] * i,
                                lineYS + lineDirection[1] * i
                            );
                            item.line.lineTo(
                                lineXS + lineDirection[0] * (i + dashLength),
                                lineYS + lineDirection[1] * (i + dashLength)
                            );
                        }
                        item.line.endFill();
                        item.line.visible = true;
                    }
                    //  cannonball lines
                    for (const values of [{jitterPoint: [1, 0, 0] as [number, number, number], property: "cannonBallLeft"}, {jitterPoint: [-1, 0, 0] as [number, number, number], property: "cannonBallRight"}]) {
                        const jitterPoint = Quaternion.fromAxisAngle([0, 0, 1], -item.mesh.shader.uniforms.uCorrectionFactorTheta).mul(item.orientation.clone()).rotateVector(values.jitterPoint);
                        const worldPoint = item.position.clone().mul(Quaternion.fromBetweenVectors([0, 0, 1], jitterPoint)).rotateVector([0, 0, 1]);
                        const position = Quaternion.fromBetweenVectors([0, 0, 1], worldPoint);
                        const endPoint = DelaunayGraph.distanceFormula(
                            this.game.cameraPosition.rotateVector([0, 0, 1]),
                            position.rotateVector([0, 0, 1])
                        ) < 0.001 ? [0, 0, 1] as [number, number, number] : this.game.cameraOrientation.clone().inverse()
                            .mul(this.game.cameraPosition.clone().inverse())
                            .mul(position.clone())
                            .rotateVector([0, 0, 1]);
                        endPoint[2] = 0;
                        const endPointScaleFactor = 1 / Math.max(Math.abs(endPoint[0]), Math.abs(endPoint[1]));
                        endPoint[0] *= endPointScaleFactor;
                        endPoint[1] *= endPointScaleFactor;
                        const lineXE = ((-endPoint[0] * this.game.state.zoom * this.game.game.worldScale) + 1) / 2 * this.game.application.renderer.width;
                        const lineYE = ((-endPoint[1] * this.game.state.zoom * this.game.game.worldScale) + 1) / 2 * this.game.application.renderer.height;

                        const dashLength = 5;
                        const lineDirection = DelaunayGraph.normalize(
                            DelaunayGraph.subtract(
                                [lineXE, lineYE, 0],
                                [lineXS, lineYS, 0]
                            )
                        );
                        const lineLength = DelaunayGraph.distanceFormula(
                            [lineXE, lineYE, 0],
                            [lineXS, lineYS, 0]
                        );

                        // draw line
                        const graphics: PIXI.Graphics = (item as any)[values.property] as PIXI.Graphics;
                        graphics.clear();
                        graphics.beginFill(0xffffff88);
                        graphics.lineStyle(1, 0xffffff88);
                        for (let i = 0; i < lineLength; i += dashLength * 2) {
                            graphics.moveTo(
                                lineXS + lineDirection[0] * i,
                                lineYS + lineDirection[1] * i
                            );
                            graphics.lineTo(
                                lineXS + lineDirection[0] * (i + dashLength),
                                lineYS + lineDirection[1] * (i + dashLength)
                            );
                        }
                        graphics.endFill();
                        graphics.visible = true;
                    }
                } else {
                    item.line.visible = false;
                    item.cannonBallLeft.visible = false;
                    item.cannonBallRight.visible = false;
                }

                // draw AutoPilot dotted lines
                for (let i = 0; i < item.autoPilotLines.length && i < item.autoPilotLinePoints.length; i++) {
                    const lineStart = i === 0 ? this.game.cameraPosition.clone() : Quaternion.fromBetweenVectors([0, 0, 1], item.autoPilotLinePoints[i - 1]);
                    const lineEnd = Quaternion.fromBetweenVectors([0, 0, 1], item.autoPilotLinePoints[i]);
                    const startPoint = DelaunayGraph.distanceFormula(
                        this.game.cameraPosition.rotateVector([0, 0, 1]),
                        lineStart.rotateVector([0, 0, 1])
                    ) < 0.001 ? [0, 0, 1] as [number, number, number] : this.game.cameraOrientation.clone().inverse()
                        .mul(this.game.cameraPosition.clone().inverse())
                        .mul(lineStart)
                        .rotateVector([0, 0, 1]);
                    const lineXS = ((-startPoint[0] * this.game.state.zoom * this.game.game.worldScale) + 1) / 2 * this.game.application.renderer.width;
                    const lineYS = ((-startPoint[1] * this.game.state.zoom * this.game.game.worldScale) + 1) / 2 * this.game.application.renderer.height;

                    const endPoint = DelaunayGraph.distanceFormula(
                        this.game.cameraPosition.rotateVector([0, 0, 1]),
                        lineEnd.rotateVector([0, 0, 1])
                    ) < 0.001 ? [0, 0, 1] as [number, number, number] : this.game.cameraOrientation.clone().inverse()
                        .mul(this.game.cameraPosition.clone().inverse())
                        .mul(lineEnd)
                        .rotateVector([0, 0, 1]);
                    const lineXE = ((-endPoint[0] * this.game.state.zoom * this.game.game.worldScale) + 1) / 2 * this.game.application.renderer.width;
                    const lineYE = ((-endPoint[1] * this.game.state.zoom * this.game.game.worldScale) + 1) / 2 * this.game.application.renderer.height;

                    const dashLength = 5;
                    const lineDirection = DelaunayGraph.normalize(
                        DelaunayGraph.subtract(
                            [lineXE, lineYE, 0],
                            [lineXS, lineYS, 0]
                        )
                    );
                    const lineLength = DelaunayGraph.distanceFormula(
                        [lineXE, lineYE, 0],
                        [lineXS, lineYS, 0]
                    );

                    // draw line
                    item.autoPilotLines[i].clear();
                    item.autoPilotLines[i].beginFill(0xffffff);
                    item.autoPilotLines[i].lineStyle(1, 0xffffff);
                    for (let j = 0; j < lineLength; j += dashLength * 3) {
                        item.autoPilotLines[i].moveTo(
                            lineXS + lineDirection[0] * j,
                            lineYS + lineDirection[1] * j
                        );
                        item.autoPilotLines[i].lineTo(
                            lineXS + lineDirection[0] * (j + dashLength),
                            lineYS + lineDirection[1] * (j + dashLength)
                        );
                    }
                    item.autoPilotLines[i].endFill();
                    item.autoPilotLines[i].visible = true;
                }

                // draw health bar
                {
                    const startPoint = DelaunayGraph.distanceFormula(
                        this.game.cameraPosition.rotateVector([0, 0, 1]),
                        item.position.rotateVector([0, 0, 1])
                    ) < 0.001 ? [0, 0, 1] as [number, number, number] : this.game.cameraOrientation.clone().inverse()
                        .mul(this.game.cameraPosition.clone().inverse())
                        .mul(item.position.clone())
                        .rotateVector([0, 0, 1]);
                    const centerX = ((-startPoint[0] * this.game.state.zoom * this.game.game.worldScale) + 1) / 2 * this.game.application.renderer.width;
                    const centerY = ((-startPoint[1] * this.game.state.zoom * this.game.game.worldScale) + 1) / 2 * this.game.application.renderer.height;

                    const radius = 20 * PHYSICS_SCALE * this.game.state.zoom * this.game.game.worldScale * this.game.application.renderer.width;
                    const thickness = 3 * PHYSICS_SCALE * this.game.state.zoom * this.game.game.worldScale * this.game.application.renderer.width;
                    const sliceSize = Math.PI * 2 / 100;
                    item.health.clear();
                    item.health.position.set(centerX, centerY);
                    item.health.lineStyle(thickness, item.healthColor);
                    item.health.moveTo(
                        radius,
                        0
                    );
                    for (let i = 1; i <= item.healthValue; i++) {
                        item.health.lineTo(
                            Math.cos(i * sliceSize) * radius,
                            Math.sin(i * sliceSize) * radius
                        );
                    }
                    item.health.visible = startPoint[2] > 0 &&
                        centerX >= 0 &&
                        centerX <= this.game.application.renderer.width &&
                        centerY >= 0 &&
                        centerY <= this.game.application.renderer.height;
                }
            }
        };

        this.cachedResources = {
            shipGeometryMap,
            shipProgram,
            shipDepthProgram,
            getColor,
            shipMeshes,
            handleSync,
            handleRender,
        };
        return this.cachedResources;
    };
}