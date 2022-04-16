import {EVoronoiMode} from "./Data";
import {
    Ship
} from "@pickledeggs123/globular-marauders-game/lib/src/Ship";
import {
    CorvetteHull,
    EShipType,
    GetShipData,
    IShipData,
    PHYSICS_SCALE,
} from "@pickledeggs123/globular-marauders-game/lib/src/ShipType";
import {
    EFaction,
} from "@pickledeggs123/globular-marauders-game/lib/src/EFaction";
import {Game, IPlayerData} from "@pickledeggs123/globular-marauders-game/lib/src/Game";
import * as PIXI from "pixi.js";
import {ITessellatedTriangle} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";
import Quaternion from "quaternion";
import {EResourceType} from "@pickledeggs123/globular-marauders-game/lib/src/Resource";
import {Faction, Star} from "@pickledeggs123/globular-marauders-game/lib/src";
import {Planet} from "@pickledeggs123/globular-marauders-game/lib/src/Planet";
import {CannonBall, Crate} from "@pickledeggs123/globular-marauders-game/lib/src/Item";
import {ICameraState, IGameMesh} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import React from "react";
import planetMesh0 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet0.mesh.json";
import planetMesh1 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet1.mesh.json";
import planetMesh2 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet2.mesh.json";
import planetMesh3 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet3.mesh.json";
import planetMesh4 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet4.mesh.json";
import planetMesh5 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet5.mesh.json";
import planetMesh6 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet6.mesh.json";
import planetMesh7 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet7.mesh.json";
import planetMesh8 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet8.mesh.json";
import planetMesh9 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet9.mesh.json";

/**
 * The input parameters of the app.
 */
export interface IAppProps {
    /**
     * If the app is in test mode.
     */
    isTestMode?: boolean;
    /**
     * The size of the world, initially
     */
    worldScale?: number;
}

/**
 * The state of the app.
 */
export interface IAppState {
    showShips: boolean;
    showItems: boolean;
    width: number;
    height: number;
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    zoom: number;
    showVoronoi: boolean;
    voronoiMode: EVoronoiMode;
    autoPilotEnabled: boolean;
    audioEnabled: boolean;
    init: boolean;
    showScoreboard: boolean;
    showSettings: boolean;
    showLoginMenu: boolean;
    showMainMenu: boolean;
    showPlanetMenu: boolean;
    showSpawnMenu: boolean;
    faction: EFaction | null;
    planetId: string | null;
    spawnShipType: EShipType | null;
    userName: string;
    numNetworkFrames: number;
}

export abstract class AppPixi extends React.Component<IAppProps, IAppState> {
    state = {
        showShips: false as boolean,
        showItems: false as boolean,
        width: 800 as number,
        height: 800 as number,
        marginTop: 0 as number,
        marginBottom: 0 as number,
        marginLeft: 0 as number,
        marginRight: 0 as number,
        zoom: 4 as number,
        showVoronoi: false as boolean,
        voronoiMode: EVoronoiMode.KINGDOM as EVoronoiMode,
        autoPilotEnabled: true as boolean,
        audioEnabled: true as boolean,
        faction: null as EFaction | null,
        planetId: null as string | null,
        spawnShipType: null as EShipType | null,
        init: false as boolean,
        showScoreboard: false as boolean,
        showSettings: false as boolean,
        showLoginMenu: true as boolean,
        showMainMenu: false as boolean,
        showPlanetMenu: false as boolean,
        showSpawnMenu: false as boolean,
        userName: "" as string,
        numNetworkFrames: 0 as number,
    };
    public game: Game = new Game();
    public playerId: string | null = null;

    // ui ref
    protected showAppBodyRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    protected measureAppBodyRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();

    // pixi.js renderer
    public abstract application: PIXI.Application;

    GetHullPoint = ([x, y]: [number, number]): [number, number, number] => {
        const z = Math.sqrt(1 -
            Math.pow(x * PHYSICS_SCALE, 2) -
            Math.pow(y * PHYSICS_SCALE, 2)
        );
        return [x, y, z];
    };

    hexToRgb = (hex: string): [number, number, number, number] => {
        if (hex === "red") return [1, 0, 0, 1];
        if (hex === "yellow") return [1, 1, 0, 1];
        if (hex === "blue") return [0, 0, 1, 1];
        return [
            parseInt(hex.slice(1, 3), 16) / 255,
            parseInt(hex.slice(3, 5), 16) / 255,
            parseInt(hex.slice(5, 7), 16) / 255,
            1
        ];
    };

    pixiStarResources = (() => {
        // create geometry
        const starGeometry = new PIXI.Geometry();
        starGeometry.addAttribute("aPosition", (new Array(32).fill(0).reduce((acc, v, i) => {
            acc.push(Math.cos(i * Math.PI * 2 / 32), Math.sin(i * Math.PI * 2 / 32), 0);
            return acc;
        }, [0, 0, 0] as number[])), 3);
        starGeometry.addIndex((new Array(33).fill(0).reduce((acc, v, i) => {
            acc.push(0, (i % 32) + 1, ((i + 1) % 32) + 1);
            return acc;
        }, [] as number[])));

        // create material
        const starVertexShader = `
            precision mediump float;
            
            attribute vec3 aPosition;
            
            uniform mat4 uCameraPosition;
            uniform mat4 uCameraOrientation;
            uniform float uCameraScale;
            uniform mat4 uPosition;
            uniform float uScale;
            uniform float uWorldScale;
            
            void main() {
                vec4 cameraOrientationPoint = uCameraOrientation * vec4(1.0, 0.0, 0.0, 0.0);
                float cr = atan(cameraOrientationPoint.y, cameraOrientationPoint.x);
                mat4 cameraRotation = mat4(
                    cos(cr), -sin(cr), 0.0, 0.0,
                    sin(cr),  cos(cr), 0.0, 0.0,
                    0.0,      0.0,     1.0, 0.0,
                    0.0,      0.0,     0.0, 1.0
                );
                    
                vec4 pos = cameraRotation * uCameraPosition * uPosition * vec4(aPosition * uScale * uCameraScale / uWorldScale + vec3(0, 0, uCameraScale), 1.0) - vec4(0, 0, uCameraScale, 0);
                gl_Position = pos * vec4(1.0 * uWorldScale, -1.0 * uWorldScale, 0.0625, 1);
            }
        `;
        const starFragmentShader = `
            precision mediump float;
            
            uniform vec4 uColor;
            
            void main() {
                gl_FragColor = uColor;
            }
        `;
        const starProgram = new PIXI.Program(starVertexShader, starFragmentShader);

        return {
            starGeometry,
            starProgram
        };
    })();

    pixiPlanetResources = (() => {
        // generate planets
        const planetGeometries: PIXI.Geometry[] = [];
        const jsonFiles: IGameMesh[] = [
            planetMesh0,
            planetMesh1,
            planetMesh2,
            planetMesh3,
            planetMesh4,
            planetMesh5,
            planetMesh6,
            planetMesh7,
            planetMesh8,
            planetMesh9,
        ];
        for (const gameMesh of jsonFiles) {
            const planetGeometry = new PIXI.Geometry();
            for (const attribute of gameMesh.attributes) {
                planetGeometry.addAttribute(attribute.id, attribute.buffer, attribute.size);
            }
            planetGeometry.addIndex(gameMesh.index);
            planetGeometries.push(planetGeometry);
        }
        const getPlanetGeometry = (): [PIXI.Geometry, number] => {
            const index = Math.floor(Math.random() * planetGeometries.length);
            return [planetGeometries[index], index];
        };

        // create material
        const planetVertexShader = `
                precision mediump float;
                
                attribute vec3 aPosition;
                attribute vec3 aColor;
                
                uniform mat4 uCameraPosition;
                uniform mat4 uCameraOrientation;
                uniform mat4 uCameraPositionInv;
                uniform mat4 uCameraOrientationInv;
                uniform mat4 uRight;
                uniform float uCameraScale;
                uniform mat4 uPosition;
                uniform mat4 uOrientation;
                uniform float uScale;
                uniform float uWorldScale;
                
                varying vec3 vColor;
                
                void main() {
                    vColor = aColor;
                    
                    vec4 cameraOrientationPoint = uCameraOrientation * vec4(1.0, 0.0, 0.0, 0.0);
                    float cr = atan(cameraOrientationPoint.y, cameraOrientationPoint.x);
                    mat4 cameraRotation = mat4(
                        cos(cr), -sin(cr), 0.0, 0.0,
                        sin(cr),  cos(cr), 0.0, 0.0,
                        0.0,      0.0,     1.0, 0.0,
                        0.0,      0.0,     0.0, 1.0
                    );
                    
                    vec4 orientationPoint = uOrientation * vec4(1.0, 0.0, 0.0, 0.0);
                    float r = atan(orientationPoint.y, orientationPoint.x);
                    mat4 objectRotation = mat4(
                        cos(r), -sin(r), 0.0, 0.0,
                        sin(r),  cos(r), 0.0, 0.0,
                        0.0,     0.0,    1.0, 0.0,
                        0.0,     0.0,    0.0, 1.0
                    );
                    
                    vec4 cameraOrientationPositionPoint = uCameraPositionInv * vec4(0.0, 0.0, 1.0, 0.0);
                    float crp = atan(cameraOrientationPositionPoint.y, cameraOrientationPositionPoint.x);
                    vec4 orientationPositionPoint = uPosition * vec4(0.0, 0.0, 1.0, 0.0);
                    float rp = atan(orientationPositionPoint.y, orientationPositionPoint.x);
                    float rpDiff = 2.0 * (rp - crp);
                    mat4 orientationDiffRotation = mat4(
                        cos(rpDiff), -sin(rpDiff), 0.0, 0.0,
                        sin(rpDiff),  cos(rpDiff), 0.0, 0.0,
                        0.0,     0.0,    1.0, 0.0,
                        0.0,     0.0,    0.0, 1.0
                    );
                    
                    vec4 translation = cameraRotation * uCameraPosition * uPosition * vec4(0, 0, uCameraScale, 1.0) - vec4(0, 0, uCameraScale, 1.0);
                    mat4 rotation = cameraRotation * objectRotation * orientationDiffRotation;
                    
                    vec4 pos = translation + vec4((rotation * vec4(aPosition, 1.0)).xyz * uScale * uCameraScale / uWorldScale, 1.0);
                    gl_Position = pos * vec4(1.0 * uWorldScale, -1.0 * uWorldScale, 0.0625, 1);
                }
            `;
        const planetFragmentShader = `
                precision mediump float;
                
                varying vec3 vColor;
                
                void main() {
                    gl_FragColor = vec4(vColor, 1.0);
                }
            `;
        const planetProgram = new PIXI.Program(planetVertexShader, planetFragmentShader);

        return {
            getPlanetGeometry,
            planetProgram
        };
    })();

    cachedPixiShipResources: any;
    pixiShipResources = () => {
        if (this.cachedPixiShipResources) {
            return this.cachedPixiShipResources;
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
                        shipColor = this.hexToRgb(str);
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
                shipGeometryData.position.push.apply(shipGeometryData.position, this.GetHullPoint([0, 0]));
                shipGeometryData.color.push.apply(shipGeometryData.color, shipColor);
                for (let i = 0; i < shipToDraw.hull.length; i++) {
                    // const a = shipToDraw.hull[i % shipToDraw.hull.length];
                    const a = [
                        shipToDraw.hull[i % shipToDraw.hull.length][0],
                        -shipToDraw.hull[i % shipToDraw.hull.length][1]
                    ] as [number, number];

                    shipGeometryData.position.push.apply(shipGeometryData.position, this.GetHullPoint(a));
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
        const shipProgram = this.pixiPlanetResources.planetProgram;

        this.cachedPixiShipResources = {
            shipGeometryMap,
            shipProgram,
            getColor,
        };
        return this.cachedPixiShipResources;
    }

    pixiCannonBallResources = (() => {
        // create geometry
        const cannonBallGeometry = new PIXI.Geometry();
        cannonBallGeometry.addAttribute("aPosition", (new Array(32).fill(0).reduce((acc, v, i) => {
            acc.push(Math.cos(i * Math.PI * 2 / 32), Math.sin(i * Math.PI * 2 / 32), 0);
            return acc;
        }, [0, 0, 0] as number[])), 3);
        cannonBallGeometry.addIndex((new Array(33).fill(0).reduce((acc, v, i) => {
            acc.push(0, (i % 32) + 1, ((i + 1) % 32) + 1);
            return acc;
        }, [] as number[])));

        // create material
        const cannonBallVertexShader = `
            precision mediump float;
            
            attribute vec3 aPosition;
            
            uniform mat4 uCameraPosition;
            uniform mat4 uCameraOrientation;
            uniform float uCameraScale;
            uniform mat4 uPosition;
            uniform float uScale;
            uniform float uWorldScale;
            
            void main() {
                vec4 cameraOrientationPoint = uCameraOrientation * vec4(1.0, 0.0, 0.0, 0.0);
                float cr = atan(cameraOrientationPoint.y, cameraOrientationPoint.x);
                mat4 cameraRotation = mat4(
                    cos(cr), -sin(cr), 0.0, 0.0,
                    sin(cr),  cos(cr), 0.0, 0.0,
                    0.0,      0.0,     1.0, 0.0,
                    0.0,      0.0,     0.0, 1.0
                );
                
                vec4 pos = cameraRotation * uCameraPosition * uPosition * vec4(aPosition * uScale * uCameraScale / uWorldScale + vec3(0, 0, uCameraScale), 1.0) - vec4(0, 0, uCameraScale, 0);
                gl_Position = pos * vec4(1.0 * uWorldScale, -1.0 * uWorldScale, 0.0625, 1);
            }
        `;
        const cannonBallFragmentShader = `
            precision mediump float;
            
            uniform vec4 uColor;
            
            void main() {
                gl_FragColor = uColor;
            }
        `;
        const cannonBallProgram = new PIXI.Program(cannonBallVertexShader, cannonBallFragmentShader);

        return {
            cannonBallGeometry,
            cannonBallProgram
        };
    })();

    pixiCrateResources = (() => {
        // generate crates
        const crateGeometry = new PIXI.Geometry();
        const crateGeometryData: { position: number[], color: number[], index: number[] } = {
            position: [
                ...this.GetHullPoint([0, 0]),
                ...this.GetHullPoint([0.1, 0.1]),
                ...this.GetHullPoint([0, 1]),
                ...this.GetHullPoint([0.1, 0.9]),
                ...this.GetHullPoint([1, 0]),
                ...this.GetHullPoint([0.9, 0.1]),
                ...this.GetHullPoint([1, 1]),
                ...this.GetHullPoint([0.9, 0.9]),
                ...this.GetHullPoint([0.1, 0.8]),
                ...this.GetHullPoint([0.2, 0.9]),
                ...this.GetHullPoint([0.8, 0.1]),
                ...this.GetHullPoint([0.9, 0.2]),

                ...this.GetHullPoint([0.1, 0.1]),
                ...this.GetHullPoint([0.1, 0.8]),
                ...this.GetHullPoint([0.2, 0.9]),
                ...this.GetHullPoint([0.9, 0.9]),
                ...this.GetHullPoint([0.8, 0.1]),
                ...this.GetHullPoint([0.9, 0.2])
            ].map(i => i * 2 - 1),
            color: [
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,

                0.5, 0.5, 0.3,
                0.5, 0.5, 0.3,
                0.5, 0.5, 0.3,
                0.5, 0.5, 0.3,
                0.5, 0.5, 0.3,
                0.5, 0.5, 0.3,
            ],
            index: [
                0, 1, 2,
                1, 2, 3,
                2, 3, 6,
                3, 6, 7,
                6, 7, 4,
                7, 4, 5,
                4, 5, 0,
                5, 1, 0,

                3, 9, 8,
                9, 11, 8,
                8, 11, 10,
                10, 11, 5,

                12, 13, 16,
                15, 17, 14
            ]
        };
        crateGeometry.addAttribute("aPosition", crateGeometryData.position, 3);
        crateGeometry.addAttribute("aColor", crateGeometryData.color, 3);
        crateGeometry.addIndex(crateGeometryData.index);

        // create crate image geometry
        const crateImageGeometry = new PIXI.Geometry();
        const crateImageGeometryData: { position: number[], uv: number[], index: number[] } = {
            position: [
                ...this.GetHullPoint([0, 0]),
                ...this.GetHullPoint([1, 0]),
                ...this.GetHullPoint([0, 1]),
                ...this.GetHullPoint([1, 1]),
            ].map(i => i * 2 - 1),
            uv: [
                0, 0,
                1, 0,
                0, 1,
                1, 1,
            ],
            index: [
                0, 1, 2,
                1, 3, 2,
            ]
        };
        crateImageGeometry.addAttribute("aPosition", crateImageGeometryData.position, 3);
        crateImageGeometry.addAttribute("aUv", crateImageGeometryData.uv, 2);
        crateImageGeometry.addIndex(crateImageGeometryData.index);

        // create material
        const crateProgram = this.pixiPlanetResources.planetProgram;

        // create material
        const crateImageVertexShader = `
                precision mediump float;
                
                attribute vec3 aPosition;
                attribute vec2 aUv;
                
                uniform mat4 uCameraPosition;
                uniform mat4 uCameraOrientation;
                uniform float uCameraScale;
                uniform mat4 uPosition;
                uniform mat4 uOrientation;
                uniform float uScale;
                uniform float uWorldScale;
                
                varying highp vec2 vUv;
                
                void main() {
                    vUv = aUv;
                    
                    vec4 cameraOrientationPoint = uCameraOrientation * vec4(1.0, 0.0, 0.0, 0.0);
                    float cr = atan(cameraOrientationPoint.y, cameraOrientationPoint.x);
                    mat4 cameraRotation = mat4(
                        cos(cr), -sin(cr), 0.0, 0.0,
                        sin(cr),  cos(cr), 0.0, 0.0,
                        0.0,      0.0,     1.0, 0.0,
                        0.0,      0.0,     0.0, 1.0
                    );
                    
                    vec4 orientationPoint = uOrientation * vec4(1.0, 0.0, 0.0, 0.0);
                    float r = atan(orientationPoint.y, orientationPoint.x);
                    mat4 objectRotation = mat4(
                        cos(r), -sin(r), 0.0, 0.0,
                        sin(r),  cos(r), 0.0, 0.0,
                        0.0,     0.0,    1.0, 0.0,
                        0.0,     0.0,    0.0, 1.0
                    );
                    
                    vec4 translation = cameraRotation * uCameraPosition * uPosition * vec4(0, 0, uCameraScale, 1.0) - vec4(0, 0, uCameraScale, 1.0);
                    mat4 rotation = cameraRotation * objectRotation;
                    
                    vec4 pos = translation + vec4((rotation * vec4(aPosition, 1.0)).xyz * uScale * uCameraScale / uWorldScale, 1.0);
                    gl_Position = pos * vec4(1.0 * uWorldScale, -1.0 * uWorldScale, 0.0625, 1);
                }
            `;
        const crateImageFragmentShader = `
                precision mediump float;
                
                uniform sampler2D uSampler;
                
                varying highp vec2 vUv;
                
                void main() {
                    gl_FragColor = texture2D(uSampler, vUv);
                }
            `;
        const crateImageProgram = new PIXI.Program(crateImageVertexShader, crateImageFragmentShader);

        return {
            crateGeometry,
            crateProgram,
            crateImageGeometry,
            crateImageProgram
        };
    })();

    pixiVoronoiResources = (() => {
        // create geometry
        const getVoronoiGeometry = (tile: ITessellatedTriangle): PIXI.Geometry => {
            const voronoiGeometry = new PIXI.Geometry();
            voronoiGeometry.addAttribute("aPosition", (tile.vertices.reduce((acc, v) => {
                acc.push(...v.rotateVector([0, 0, 1]));
                return acc;
            }, [] as number[])), 3);
            const indices: number[] = [];
            for (let i = 0; i < tile.vertices.length - 2; i++) {
                indices.push(0, i + 1, i + 2);
            }
            voronoiGeometry.addIndex(indices);
            return voronoiGeometry;
        };

        // create material
        const voronoiVertexShader = `
            precision mediump float;
            
            attribute vec3 aPosition;
            
            uniform mat4 uCameraPosition;
            uniform mat4 uCameraOrientation;
            uniform float uCameraScale;
            uniform float uWorldScale;
            
            void main() {
                vec4 cameraOrientationPoint = uCameraOrientation * vec4(1.0, 0.0, 0.0, 0.0);
                float cr = atan(cameraOrientationPoint.y, cameraOrientationPoint.x);
                mat4 cameraRotation = mat4(
                    cos(cr), -sin(cr), 0.0, 0.0,
                    sin(cr),  cos(cr), 0.0, 0.0,
                    0.0,      0.0,     1.0, 0.0,
                    0.0,      0.0,     0.0, 1.0
                );
                vec4 pos = cameraRotation * uCameraPosition * vec4(-aPosition * uCameraScale, 1.0);
                gl_Position = pos * vec4(1.0 * uWorldScale, -1.0 * uWorldScale, 0.0625, 1);
            }
        `;
        const voronoiFragmentShader = `
            precision mediump float;
            
            uniform vec4 uColor;
            
            void main() {
                gl_FragColor = uColor;
            }
        `;
        const voronoiProgram = new PIXI.Program(voronoiVertexShader, voronoiFragmentShader);

        return {
            getVoronoiGeometry,
            voronoiProgram
        };
    })();

    pixiBackgroundVoronoiResources = (() => {
        // create geometry
        const getVoronoiGeometry = (tile: ITessellatedTriangle, tileUv: [number, number][]): PIXI.Geometry => {
            const voronoiGeometry = new PIXI.Geometry();
            voronoiGeometry.addAttribute("aPosition", (tile.vertices.reduce((acc, v) => {
                acc.push(...v.rotateVector([0, 0, 1]));
                return acc;
            }, [] as number[]).map(x => -x)), 3);
            voronoiGeometry.addAttribute("aUv", (tileUv.reduce((acc, i) => {
                acc.push(...i);
                return acc;
            }, [] as number[])), 2);
            const indices: number[] = [];
            for (let i = 0; i < tile.vertices.length - 2; i++) {
                indices.push(0, i + 1, i + 2);
            }
            voronoiGeometry.addIndex(indices);
            return voronoiGeometry;
        };

        // create material
        const voronoiVertexShader = `
            precision mediump float;
            
            attribute vec3 aPosition;
            attribute vec2 aUv;
            
            uniform mat4 uCameraPosition;
            uniform mat4 uCameraOrientation;
            uniform float uCameraScale;
            uniform float uWorldScale;
                
            varying highp vec2 vUv;
            
            void main() {
                vUv = aUv;
            
                vec4 cameraOrientationPoint = uCameraOrientation * vec4(1.0, 0.0, 0.0, 0.0);
                float cr = atan(cameraOrientationPoint.y, cameraOrientationPoint.x);
                mat4 cameraRotation = mat4(
                    cos(cr), -sin(cr), 0.0, 0.0,
                    sin(cr),  cos(cr), 0.0, 0.0,
                    0.0,      0.0,     1.0, 0.0,
                    0.0,      0.0,     0.0, 1.0
                );
                vec4 pos = cameraRotation * uCameraPosition * vec4(-aPosition * uCameraScale, 1.0);
                gl_Position = pos * vec4(-1.0 * uWorldScale, 1.0 * uWorldScale, 0.0625, 1);
            }
        `;
        const voronoiFragmentShader = `
            precision mediump float;
            
            uniform sampler2D uSampler;
            
            varying highp vec2 vUv;
            
            void main() {
                gl_FragColor = texture2D(uSampler, vUv);
            }
        `;
        const voronoiProgram = new PIXI.Program(voronoiVertexShader, voronoiFragmentShader);

        return {
            getVoronoiGeometry,
            voronoiProgram
        };
    })();

    starMeshes: Array<{
        id: string, mesh: PIXI.Mesh<PIXI.Shader>,
        tick: number
    }> = [];
    planetMeshes: Array<{
        id: string,
        mesh: PIXI.Mesh<PIXI.Shader>,
        faction: PIXI.Graphics,
        factionRadius: number,
        factionColor: number | null,
        settlementLevel: number,
        settlementProgress: number,
        textName: PIXI.Text,
        textTitle: PIXI.Text,
        textResource1: PIXI.Text,
        textResource2: PIXI.Text,
        textResource3: PIXI.Text,
        position: Quaternion,
        orientation: Quaternion,
        rotation: Quaternion,
        tick: number
    }> = [];
    planetThumbnails: Map<string, string> = new Map<string, string>();
    shipMeshes: Array<{
        id: string,
        mesh: PIXI.Mesh<PIXI.Shader>,
        text: PIXI.Text,
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
        orientation: Quaternion,
        positionVelocity: Quaternion,
        tick: number
    }> = [];
    cannonBallMeshes: Array<{
        id: string,
        mesh: PIXI.Mesh<PIXI.Shader>,
        position: Quaternion,
        positionVelocity: Quaternion,
        tick: number
    }> = [];
    crateMeshes: Array<{
        id: string,
        mesh: PIXI.Mesh<PIXI.Shader>,
        image: PIXI.Mesh<PIXI.Shader>,
        text: PIXI.Text,
        position: Quaternion,
        orientation: Quaternion,
        rotation: Quaternion,
        resourceType: EResourceType,
        tick: number
    }> = [];
    sprites: Record<string, PIXI.Texture> = {};
    voronoiMeshes: Array<{
        id: string,
        mesh: PIXI.Mesh<PIXI.Shader>,
        tick: number
    }> = [];
    backgroundVoronoiMeshes: Array<{
        id: string,
        mesh: PIXI.Mesh<PIXI.Shader>,
        tick: number
    }> = [];

    addStar = ({star, cameraPosition, cameraOrientation, tick}: {
        star: Star,
        cameraPosition: Quaternion,
        cameraOrientation: Quaternion,
        tick: number
    }) => {
        // create mesh
        const uniforms = {
            uCameraPosition: cameraPosition.clone().inverse().toMatrix4(),
            uCameraOrientation: cameraOrientation.clone().inverse().toMatrix4(),
            uCameraScale: this.state.zoom,
            uPosition: star.position.toMatrix4(),
            uColor: this.hexToRgb(star.color),
            uScale: 2 * star.size * PHYSICS_SCALE,
            uWorldScale: this.game.worldScale,
        };
        const shader = new PIXI.Shader(this.pixiStarResources.starProgram, uniforms);
        const mesh = new PIXI.Mesh(this.pixiStarResources.starGeometry, shader);
        mesh.zIndex = -10;

        this.application.stage.addChild(mesh);
        this.starMeshes.push({
            id: star.id,
            mesh,
            tick
        });
    };

    getFactionColor(ownerFaction: Faction | undefined | null) {
        let factionColorName: string | null = null;
        if (ownerFaction) {
            factionColorName = ownerFaction.factionColor;
        }
        let factionColor: number | null = null;
        switch (factionColorName) {
            case "red":
                factionColor = 0xff0000;
                break;
            case "orange":
                factionColor = 0xff8000;
                break;
            case "yellow":
                factionColor = 0xffff00;
                break;
            case "green":
                factionColor = 0x00ff00;
                break;
            case "blue":
                factionColor = 0x0000ff;
                break;
        }
        return factionColor;
    }

    addPlanet = ({planet, cameraPosition, cameraOrientation, tick}: {
        planet: Planet, cameraPosition: Quaternion, cameraOrientation: Quaternion, tick: number
    }) => {
        // create planet properties
        const position: Quaternion = planet.position.clone();
        const orientation: Quaternion = planet.orientation.clone();
        const randomRotationAngle = Math.random() * 2 * Math.PI;
        const rotation: Quaternion = Quaternion.fromAxisAngle([Math.cos(randomRotationAngle), Math.sin(randomRotationAngle), 0], Math.PI * 2 / 60 / 10 / 10);
        const settlementLevel = planet.settlementLevel;
        const settlementProgress = planet.settlementProgress;

        // create mesh
        const uniforms = {
            uCameraPosition: cameraPosition.clone().inverse().toMatrix4(),
            uCameraOrientation: cameraOrientation.clone().inverse().toMatrix4(),
            uCameraPositionInv: cameraPosition.clone().toMatrix4(),
            uCameraOrientationInv: cameraOrientation.clone().toMatrix4(),
            uRight: Quaternion.fromBetweenVectors([0, 0, 1], [1, 0, 0]).toMatrix4(),
            uCameraScale: this.state.zoom,
            uPosition: planet.position.toMatrix4(),
            uOrientation: orientation.toMatrix4(),
            uScale: 10 * planet.size * PHYSICS_SCALE,
            uWorldScale: this.game.worldScale,
        };
        const shader = new PIXI.Shader(this.pixiPlanetResources.planetProgram, uniforms);
        const state = PIXI.State.for2d();
        state.depthTest = true;
        const [geometry, meshIndex] = this.pixiPlanetResources.getPlanetGeometry();
        const planetThumbnail = [
            planetMesh0,
            planetMesh1,
            planetMesh2,
            planetMesh3,
            planetMesh4,
            planetMesh5,
            planetMesh6,
            planetMesh7,
            planetMesh8,
            planetMesh9,
        ][meshIndex].image;
        this.planetThumbnails.set(planet.id, planetThumbnail);

        const mesh = new PIXI.Mesh(geometry, shader, state);
        mesh.zIndex = -5;

        const faction = new PIXI.Graphics();
        faction.zIndex = -6;
        faction.alpha = 0.75;

        const factionRadius = (planet.size * this.game.worldScale + 3) * PHYSICS_SCALE;
        const ownerFaction = Array.from(this.game.factions.values()).find(faction => faction.planetIds.includes(planet.id));
        const factionColor = this.getFactionColor(ownerFaction)

        const textName = new PIXI.Text(planet.name ?? planet.id ?? "");
        textName.style.fill = "white";
        textName.style.fontSize = 15;
        const textTitle = new PIXI.Text(planet.getRoyalRank() ?? "");
        textTitle.style.fill = "white";
        textTitle.style.fontSize = 15;
        const textResource1 = new PIXI.Text(planet.naturalResources[0] ?? "");
        textResource1.style.fill = "white";
        textResource1.style.fontSize = 10;
        const textResource2 = new PIXI.Text(planet.naturalResources[1] ?? "");
        textResource2.style.fill = "white";
        textResource2.style.fontSize = 10;
        const textResource3 = new PIXI.Text(planet.naturalResources[2] ?? "");
        textResource3.style.fill = "white";
        textResource3.style.fontSize = 10;

        this.application.stage.addChild(mesh);
        this.application.stage.addChild(faction);
        this.application.stage.addChild(textName);
        this.application.stage.addChild(textTitle);
        this.application.stage.addChild(textResource1);
        this.application.stage.addChild(textResource2);
        this.application.stage.addChild(textResource3);
        this.planetMeshes.push({
            id: planet.id,
            mesh,
            faction,
            factionRadius,
            factionColor,
            settlementLevel,
            settlementProgress,
            textName,
            textTitle,
            textResource1,
            textResource2,
            textResource3,
            position,
            orientation,
            rotation,
            tick,
        });
    };

    addShip = ({ship, cameraPosition, cameraOrientation, tick}: {
        ship: Ship, cameraPosition: Quaternion, cameraOrientation: Quaternion, tick: number
    }) => {
        const position: Quaternion = ship.position.clone();
        const positionVelocity: Quaternion = ship.positionVelocity.clone();
        const orientation: Quaternion = ship.orientation.clone();

        // create mesh
        const uniforms = {
            uCameraPosition: cameraPosition.clone().inverse().toMatrix4(),
            uCameraOrientation: cameraOrientation.clone().inverse().toMatrix4(),
            uCameraPositionInv: cameraPosition.clone().toMatrix4(),
            uCameraOrientationInv: cameraOrientation.clone().toMatrix4(),
            uRight: Quaternion.fromBetweenVectors([0, 0, 1], [1, 0, 0]).toMatrix4(),
            uCameraScale: this.state.zoom,
            uPosition: position.toMatrix4(),
            uOrientation: orientation.toMatrix4(),
            uScale: PHYSICS_SCALE,
            uWorldScale: this.game.worldScale,
        };
        const shader = new PIXI.Shader(this.pixiShipResources().shipProgram, uniforms);
        const mesh = new PIXI.Mesh(this.pixiShipResources().shipGeometryMap.get(ship.faction?.id ?? EFaction.DUTCH)?.get(ship.shipType) as any, shader);
        mesh.zIndex = -3;

        const text = new PIXI.Text(ship.shipType);
        text.style.fill = "white";
        text.style.fontSize = 15;

        const line = new PIXI.Graphics();
        line.zIndex = -4;

        const cannonBallLeft = new PIXI.Graphics();
        cannonBallLeft.zIndex = -4;

        const cannonBallRight = new PIXI.Graphics();
        cannonBallRight.zIndex = -4;

        const health = new PIXI.Graphics();
        health.zIndex = -4;
        health.alpha = 0.5;

        const healthColor = this.pixiShipResources().getColor(ship.faction?.factionColor ?? ship.color).slice(0, 3).reduce((acc: number, v: number, i: number) => acc | (Math.floor(v * 255) << (2 - i) * 8), 0xff000000);

        const isPlayer = this.getPlayerShip().id === ship.id;
        const isEnemy = this.findPlayerShip()?.faction?.id !== ship.faction?.id;

        this.application.stage.addChild(mesh);
        this.application.stage.addChild(text);
        this.application.stage.addChild(line);
        this.application.stage.addChild(cannonBallLeft);
        this.application.stage.addChild(cannonBallRight);
        this.application.stage.addChild(health);
        this.shipMeshes.push({
            id: ship.id,
            mesh,
            text,
            line,
            cannonBallLeft,
            cannonBallRight,
            autoPilotLines: [],
            autoPilotLinePoints: [],
            health,
            healthColor,
            healthValue: Math.ceil(ship.health / ship.maxHealth * 100),
            isPlayer,
            isEnemy,
            position,
            orientation,
            positionVelocity,
            tick,
        });
    };

    addCannonBall = ({cannonBall, cameraPosition, cameraOrientation, tick}: {
        cannonBall: CannonBall, cameraPosition: Quaternion, cameraOrientation: Quaternion, tick: number
    }) => {
        const position: Quaternion = cannonBall.position.clone();
        const positionVelocity: Quaternion = cannonBall.positionVelocity.clone();

        // create mesh
        const ownerFaction = cannonBall.factionId && this.game.factions.get(cannonBall.factionId);
        const factionColor = this.getFactionColor(ownerFaction);
        const uniforms = {
            uCameraPosition: cameraPosition.clone().inverse().toMatrix4(),
            uCameraOrientation: cameraOrientation.clone().inverse().toMatrix4(),
            uCameraScale: this.state.zoom,
            uPosition: position.toMatrix4(),
            uColor: factionColor != null ? [((factionColor & 0xff0000) >> 16) / 0xff, ((factionColor & 0x00ff00) >> 8) / 0xff, (factionColor & 0x0000ff) / 0xff, 1] : [0.75, 0.75, 0.75, 1],
            uScale: 5 * PHYSICS_SCALE,
            uWorldScale: this.game.worldScale,
        };
        const shader = new PIXI.Shader(this.pixiCannonBallResources.cannonBallProgram, uniforms);
        const mesh = new PIXI.Mesh(this.pixiCannonBallResources.cannonBallGeometry, shader);
        mesh.zIndex = -1;

        this.application.stage.addChild(mesh);
        this.cannonBallMeshes.push({
            id: cannonBall.id,
            mesh,
            position,
            positionVelocity,
            tick,
        });
    };

    addCrate = ({
                    crate,
                    cameraPosition,
                    cameraOrientation,
                    tick
                }: {
        crate: Crate,
        cameraPosition: Quaternion,
        cameraOrientation: Quaternion,
        tick: number
    }) => {
        const position: Quaternion = crate.position.clone();
        const orientation: Quaternion = crate.orientation.clone();
        const rotation: Quaternion = crate.orientationVelocity.clone();
        const resourceType: EResourceType = crate.resourceType;

        // create mesh
        const meshUniforms = {
            uCameraPosition: cameraPosition.clone().inverse().toMatrix4(),
            uCameraOrientation: cameraOrientation.clone().inverse().toMatrix4(),
            uCameraScale: this.state.zoom,
            uPosition: position.toMatrix4(),
            uOrientation: orientation.toMatrix4(),
            uScale: 5 * PHYSICS_SCALE,
            uWorldScale: this.game.worldScale,
        };
        const meshShader = new PIXI.Shader(this.pixiCrateResources.crateProgram, meshUniforms);
        const mesh = new PIXI.Mesh(this.pixiCrateResources.crateGeometry, meshShader);
        mesh.zIndex = -4;

        // crate texture sprite
        const imageUniforms = {
            uCameraPosition: cameraPosition.clone().inverse().toMatrix4(),
            uCameraOrientation: cameraOrientation.clone().inverse().toMatrix4(),
            uCameraScale: this.state.zoom,
            uPosition: position.toMatrix4(),
            uOrientation: orientation.toMatrix4(),
            uScale: 15 * PHYSICS_SCALE,
            uWorldScale: this.game.worldScale,
            uSampler: this.sprites[resourceType]
        };
        const imageShader = new PIXI.Shader(this.pixiCrateResources.crateImageProgram, imageUniforms);
        const image = new PIXI.Mesh(this.pixiCrateResources.crateImageGeometry, imageShader);
        mesh.zIndex = -4;

        const text = new PIXI.Text(resourceType);
        text.style.fill = "white";
        text.style.fontSize = 12;

        this.application.stage.addChild(mesh);
        this.application.stage.addChild(image);
        this.application.stage.addChild(text);
        this.crateMeshes.push({
            id: crate.id,
            mesh,
            image,
            text,
            position,
            orientation,
            rotation,
            resourceType,
            tick,
        });
    };
    hashCode = (str: string): number => {
        let hash: number = 0;
        for (let i = 0; i < str.length; i++) {
            const character: number = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + character;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    addVoronoi = ({id, tile, cameraPosition, cameraOrientation, tick}: {
        id: string, tile: ITessellatedTriangle, cameraPosition: Quaternion, cameraOrientation: Quaternion, tick: number
    }) => {
        // parse digits from the id
        // last digit is tesselation index, ignore
        const digits: number[] = [];
        for (const match of id.split("-")) {
            const int = parseInt(match);
            if (!isNaN(int)) {
                digits.push(int);
            }
        }

        // initial coloring
        let primaryIndex = digits[0] ?? 0;
        let secondaryIndex = digits[digits.length - 1] ?? 0;

        // second style coloring
        const lastIndexOf = id.lastIndexOf('-');
        if (lastIndexOf) {
            // hash id into a primary color
            primaryIndex = this.hashCode(id.slice(0, lastIndexOf));
            secondaryIndex = this.hashCode(digits.slice(0, digits.length - 1).join(","));
        }

        const colors: Array<[number, number, number, number]> = [
            [0.75, 0.00, 0.00, 0.25],   // red
            [0.75, 0.75, 0.00, 0.25],   // orange
            [0.00, 0.75, 0.00, 0.25],   // green
            [0.00, 0.75, 0.75, 0.25],   // yellow
            [0.00, 0.00, 0.75, 0.25],   // blue
            [0.75, 0.00, 0.75, 0.25]    // purple
        ];
        const color = colors[primaryIndex % colors.length];
        const shades = [0.75, 0.65, 0.55, 0.45, 0.35, 0.25]; // 6 shades
        const shade = shades[Math.floor(secondaryIndex / colors.length) % shades.length];
        // 6 * 6 = 36 unique colors, should prevent two regions of the same color from being next to each other
        const uColor = color.map(i => i === 0.75 ? shade : i);

        // create mesh
        const uniforms = {
            uCameraPosition: cameraPosition.clone().inverse().toMatrix4(),
            uCameraOrientation: cameraOrientation.clone().inverse().toMatrix4(),
            uCameraScale: this.state.zoom,
            uWorldScale: this.game.worldScale,
            uColor
        };
        const shader = new PIXI.Shader(this.pixiVoronoiResources.voronoiProgram, uniforms);
        const mesh = new PIXI.Mesh(this.pixiVoronoiResources.getVoronoiGeometry(tile), shader);
        mesh.zIndex = -20;

        this.application.stage.addChild(mesh);
        this.voronoiMeshes.push({
            id,
            mesh,
            tick,
        });
    };

    addBackgroundVoronoi = ({id, tile, tileUv, cameraPosition, cameraOrientation, textureName, tick}: {
        id: string, tile: ITessellatedTriangle, tileUv: [number, number][], cameraPosition: Quaternion, cameraOrientation: Quaternion, textureName: string, tick: number
    }) => {
        // create mesh
        const uniforms = {
            uCameraPosition: cameraPosition.clone().inverse().toMatrix4(),
            uCameraOrientation: cameraOrientation.clone().inverse().toMatrix4(),
            uCameraScale: this.state.zoom,
            uWorldScale: this.game.worldScale,
            uSampler: this.sprites[textureName]
        };
        const shader = new PIXI.Shader(this.pixiBackgroundVoronoiResources.voronoiProgram, uniforms);
        const mesh = new PIXI.Mesh(this.pixiBackgroundVoronoiResources.getVoronoiGeometry(tile, tileUv), shader);
        mesh.zIndex = -30;

        this.application.stage.addChild(mesh);
        this.backgroundVoronoiMeshes.push({
            id,
            mesh,
            tick,
        });
    };

    handleResize = () => {
        const width = this.measureAppBodyRef.current ? this.measureAppBodyRef.current.getBoundingClientRect().width : window.innerWidth;
        const height = this.measureAppBodyRef.current ? this.measureAppBodyRef.current.getBoundingClientRect().height : window.innerHeight;
        const size = Math.min(width, height);
        const verticalSpace = height - size;
        const horizontalSpace = width - size;

        this.setState({
            marginTop: verticalSpace / 2,
            marginBottom: verticalSpace / 2,
            marginLeft: horizontalSpace / 2,
            marginRight: horizontalSpace / 2,
            width: size,
            height: size,
        });
    };

    /**
     * ------------------------------------------------------------
     * Get player data
     * ------------------------------------------------------------
     */

    private findPlayer(): IPlayerData | null {
        return (this.playerId && this.game.playerData.get(this.playerId)) || null;
    }

    protected findPlayerShip(): Ship | null {
        const player = this.findPlayer();
        if (player) {
            return this.game.ships.get(player.shipId) || null;
        } else {
            return null;
        }
    }

    /**
     * Get the ship of the player.
     */
    getPlayerShip(): ICameraState {
        const ship = this.findPlayerShip();
        if (ship) {
            return Game.GetCameraState(ship);
        }
        // show the latest planet
        if (this.state.planetId) {
            // faction selected, orbit the faction's home world
            const planet = this.game.planets.get(this.state.planetId);
            if (planet) {
                // no faction selected, orbit the world
                const planetShip = new Ship(this.game, EShipType.CUTTER);
                planetShip.id = "ghost-ship";
                planetShip.position = planet.position;
                planetShip.orientation = planet.orientation;
                return Game.GetCameraState(planetShip);
            }
        }
        // show the latest faction ship
        if (this.state.faction) {
            // faction selected, orbit the faction's home world
            const faction = Array.from(this.game.factions.values()).find(f => f.id === this.state.faction);
            const ship = Array.from(this.game.ships.values()).find(s => faction && faction.shipIds.length > 0 && s.id === faction.shipIds[faction.shipIds.length - 1]);
            if (ship) {
                return Game.GetCameraState(ship);
            }
        }
        // show the latest attacking ship
        const attackingAIShip = (this.game.demoAttackingShipId && this.game.ships.get(this.game.demoAttackingShipId)) ?? null;
        if (attackingAIShip) {
            return Game.GetCameraState(attackingAIShip);
        } else {
            this.game.demoAttackingShipId = null;
        }
        // no faction selected, orbit the world
        const tempShip = new Ship(this.game, EShipType.CUTTER);
        tempShip.id = "ghost-ship";
        const numSecondsToCircle = 120 * this.game.worldScale;
        const millisecondsPerSecond = 1000;
        const circleSlice = numSecondsToCircle * millisecondsPerSecond;
        const circleFraction = (+new Date() % circleSlice) / circleSlice;
        const angle = circleFraction * (Math.PI * 2);
        tempShip.position = Quaternion.fromBetweenVectors([0, 0, 1], [0, 0, 1]).mul(
            Quaternion.fromAxisAngle([1, 0, 0], -angle)
        )
        return Game.GetCameraState(tempShip);
    }
}