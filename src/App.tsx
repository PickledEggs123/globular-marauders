import React from 'react';
import './App.css';
import Quaternion from "quaternion";
import * as Tone from "tone";
import SockJS from "sockjs-client";
import * as PIXI from "pixi.js";
import {EResourceType, ITEM_DATA} from "@pickledeggs123/globular-marauders-game/lib/src/Resource";
import {
    ESettlementLevel,
    ICameraState,
    ICameraStateWithOriginal,
    IDrawable,
    IExpirable,
    MIN_DISTANCE,
    MoneyAccount
} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import {
    CorvetteHull,
    EFaction,
    EShipType,
    PHYSICS_SCALE,
    Ship,
    SHIP_DATA
} from "@pickledeggs123/globular-marauders-game/lib/src/Ship";
import {
    DelaunayGraph, ITessellatedTriangle,
    VoronoiCell,
    VoronoiGraph, VoronoiTile
} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";
import {
    EBuildingType,
    Manufactory,
    Planet,
    Plantation, Star
} from "@pickledeggs123/globular-marauders-game/lib/src/Planet";
import {
    CannonBall,
    Crate,
    DeserializeQuaternion,
    SerializeQuaternion,
} from "@pickledeggs123/globular-marauders-game/lib/src/Item";
import {
    EMessageType,
    Game,
    IAutoPilotMessage,
    IChooseFactionMessage,
    IChoosePlanetMessage,
    IGameInitializationFrame,
    IGameSyncFrame,
    IMessage,
    IPlayerData,
    ISpawnLocation,
    ISpawnMessage,
    ISpawnPlanet
} from "@pickledeggs123/globular-marauders-game/lib/src/Game";

/**
 * A class for playing music through a series of notes. The data is a list of musical notes to play in sequence.
 */
export class MusicPlayer {
    synth: Tone.PolySynth | null = null;
    synthPart: Tone.Sequence | null = null;

    public start() {
        this.startTone().catch(err => {
            console.log("FAILED TO START MUSIC", err);
        });
    }

    public stop() {
        if (this.synthPart) {
            this.synthPart.stop();
            this.synthPart.dispose();
            this.synthPart = null;
        }
        Tone.Transport.stop();
    }

    public static firstMelody = [
        // stanza 1
        "C3",
        ["C3", "C3"],
        null,
        ["G3", "A#3"],
        null,
        ["A3", "G3"],
        null,
        null,

        // stanza 2
        "C3",
        ["C3", "C3"],
        null,
        ["G3", "A#3"],
        null,
        ["A3", "G3"],
        null,
        null,

        // stanza 3
        "A#3",
        ["A#3", "A3"],
        null,
        ["F3", "G3"],
        null,
        ["C2", "C2"],
        null,
        null,

        // stanza 4
        "A#3",
        ["A#3", "A3"],
        null,
        ["F3", "G3"],
        null,
        ["C2", "C2"],
        null,
        null,
        "END"
    ];
    public static secondMelody = [
        // stanza 1
        "C3",
        "D3",
        "Eb3",
        null,

        // stanza 2
        "Eb3",
        null,
        "D3",
        null,

        // stanza 3
        "Eb3",
        "D3",
        "C3",
        null,

        // stanza 4
        "A2",
        null,
        "A#2",
        null,

        // stanza 1
        "C3",
        "D3",
        "Eb3",
        null,

        // stanza 2
        "Eb3",
        null,
        "D3",
        null,

        // stanza 3
        "Eb3",
        "D3",
        "C3",
        null,

        // stanza 4
        "A2",
        null,
        "A#2",
        null,
        "END"
    ];
    public static thirdMelody = [
        // stanza 1
        "C3",
        "G2",
        "A2",
        "A#2",
        "A2",
        "G2",

        // stanza 2
        "C3",
        "G2",
        "A2",
        "A#2",
        "A2",
        "G2",

        // stanza 3
        "C3",
        "G2",
        "A2",
        "A#2",
        "A2",
        "G2",

        // stanza 4
        "A2",
        "G2",
        "F2",
        "G2",
        "C2",
        "C2",
        "END"
    ];
    public static forthMelody = [
        // stanza 1
        "C3",
        null,
        "G3",
        "G3",
        null,
        null,

        // stanza 2
        "F3",
        null,
        "Eb3",
        "C3",
        null,
        null,

        // stanza 3
        "D3",
        null,
        "Eb3",
        "D3",
        null,
        null,

        // stanza 4
        "C3",
        null,
        "B2",
        "C3",
        null,
        null,
        "END"
    ];

    public melodyMap: Array<{
        id: string,
        next: string,
        notes: Array<string | null | Array<string | null>>
    }> = [{
        id: "main",
        next: "main2",
        notes: MusicPlayer.firstMelody
    }, {
        id: "main2",
        next: "main3",
        notes: MusicPlayer.secondMelody
    }, {
        id: "main3",
        next: "main4",
        notes: MusicPlayer.thirdMelody
    }, {
        id: "main4",
        next: "main5",
        notes: MusicPlayer.thirdMelody
    }, {
        id: "main5",
        next: "main6",
        notes: MusicPlayer.secondMelody
    }, {
        id: "main6",
        next: "main7",
        notes: MusicPlayer.forthMelody
    }, {
        id: "main7",
        next: "main",
        notes: MusicPlayer.forthMelody
    }];
    public currentMelody: string = "";
    public getNextMelody(): Array<string | null | Array<string | null>> {
        const melodyNode = this.melodyMap.find(m => m.id === this.currentMelody);
        if (melodyNode) {
            const nextMelodyNode = this.melodyMap.find(m => m.id === melodyNode.next);
            if (nextMelodyNode) {
                this.currentMelody = nextMelodyNode.id;
                return nextMelodyNode.notes;
            }
        }
        const firstMelodyNode = this.melodyMap[0];
        if (firstMelodyNode) {
            this.currentMelody = firstMelodyNode.id;
            return firstMelodyNode.notes;
        }
        throw new Error("Could not find melody node to play next sound");
    }

    /**
     * Handle the playing of music and the transition between melodies.
     * @param time
     * @param note
     */
    handleToneSequenceCallback = (time: number, note: any) => {
        if (note === "END") {
            this.setupMelody(this.getNextMelody());
            if (this.synthPart) {
                this.synthPart.start(Tone.Transport.seconds);
            }
            return;
        }
        if (this.synth && note) {
            this.synth.triggerAttackRelease(note, "10hz", time);
        }
    };

    setupMelody(notes: Array<string | null | Array<string | null>>) {
        // clean up old synth parts
        if (this.synthPart) {
            this.synthPart.stop();
            this.synthPart.dispose();
            this.synthPart = null;
        }
        this.synthPart = new Tone.Sequence(
            this.handleToneSequenceCallback,
            notes,
            "4n"
        );
        this.synthPart.loop = false;
    }

    async startTone() {
        await Tone.start();

        this.synth = new Tone.PolySynth(Tone.Synth).toDestination();

        // first melody
        this.setupMelody(this.getNextMelody());
        if (this.synthPart) {
            this.synthPart.start(Tone.Transport.seconds);
        }
        Tone.Transport.start();
    }
}

/**
 * A class used to draw a line in the world, useful for drawing pathing directions with bends and turns.
 */
interface ITargetLineData {
    targetLines: Array<[[number, number], [number, number]]>,
    targetNodes: Array<[[number, number], number]>
}

/**
 * Which mode the app is in.
 */
enum EVoronoiMode {
    KINGDOM = "KINGDOM",
    DUCHY = "DUCHY",
    COUNTY = "COUNTY"
}

/**
 * An object which contains a texture match for a resource type.
 */
interface IResourceTypeTexturePair {
    resourceType: EResourceType | null;
    name: string;
    url: string;
}
const RESOURCE_TYPE_TEXTURE_PAIRS: IResourceTypeTexturePair[] = [{
    resourceType: EResourceType.RUM,
    name: "rum",
    url: "images/rum.svg"
}, {
    resourceType: EResourceType.RATION,
    name: "ration",
    url:"images/ration.svg"
}, {
    resourceType: EResourceType.IRON,
    name: "iron",
    url:"images/iron.svg"
}, {
    resourceType: EResourceType.GUNPOWDER,
    name: "gunpowder",
    url:"images/gunpowder.svg"
}, {
    resourceType: EResourceType.FIREARM,
    name: "firearm",
    url:"images/firearm.svg"
}, {
    resourceType: EResourceType.MAHOGANY,
    name: "mahogany",
    url:"images/mahogany.svg"
}, {
    resourceType: EResourceType.FUR,
    name: "fur",
    url:"images/fur.svg"
}, {
    resourceType: EResourceType.RUBBER,
    name: "rubber",
    url:"images/rubber.svg"
}, {
    resourceType: EResourceType.CACAO,
    name: "cacao",
    url:"images/cacao.svg"
}, {
    resourceType: EResourceType.COFFEE,
    name: "coffee",
    url:"images/coffee.svg"
}, {
    resourceType: EResourceType.RUM,
    name: "rum",
    url:"images/rum.svg"
}, {
    resourceType: EResourceType.MOLASSES,
    name: "molasses",
    url:"images/molasses.svg"
}, {
    resourceType: EResourceType.COTTON,
    name: "cotton",
    url:"images/cotton.svg"
}, {
    resourceType: EResourceType.FLAX,
    name: "flax",
    url:"images/flax.svg"
}, {
    resourceType: EResourceType.TOBACCO,
    name: "tobacco",
    url:"images/tobacco.svg"
}];

const DEFAULT_IMAGE: string = "images/no_image.svg";

/**
 * The input parameters of the app.
 */
interface IAppProps {
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
interface IAppState {
    showNotes: boolean;
    showShips: boolean;
    showItems: boolean;
    width: number;
    height: number;
    zoom: number;
    showVoronoi: boolean;
    voronoiMode: EVoronoiMode;
    autoPilotEnabled: boolean;
    audioEnabled: boolean;
    showLoginMenu: boolean;
    showMainMenu: boolean;
    showPlanetMenu: boolean;
    showSpawnMenu: boolean;
    faction: EFaction | null;
    planetId: string | null;
    userName: string;
}

export class App extends React.Component<IAppProps, IAppState> {
    state = {
        showNotes: false as boolean,
        showShips: false as boolean,
        showItems: false as boolean,
        width: 500 as number,
        height: 500 as number,
        zoom: 4 as number,
        showVoronoi: false as boolean,
        voronoiMode: EVoronoiMode.KINGDOM as EVoronoiMode,
        autoPilotEnabled: true as boolean,
        audioEnabled: true as boolean,
        faction: null as EFaction | null,
        planetId: null as string | null,
        showLoginMenu: true as boolean,
        showMainMenu: false as boolean,
        showPlanetMenu: false as boolean,
        showSpawnMenu: false as boolean,
        userName: "" as string,
    };

    // ui ref
    private showAppBodyRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private showNotesRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    private showShipsRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    private showItemsRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    private showVoronoiRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    private autoPilotEnabledRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    private audioEnabledRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    private svgRef: React.RefObject<SVGSVGElement> = React.createRef<SVGSVGElement>();

    // game loop stuff
    public rotateCameraInterval: any = null;
    private activeKeys: any[] = [];
    private keyDownHandlerInstance: any;
    private keyUpHandlerInstance: any;

    // game data stuff
    public voronoiData: Array<{
        id: string,
        voronoi: VoronoiCell
    }> = [];
    public refreshVoronoiDataTick: number = 0;
    public music: MusicPlayer = new MusicPlayer();
    public initialized: boolean = false;
    public frameCounter: number = 0;
    public game: Game = new Game();
    public socket: WebSocket;
    public socketEvents: Record<string, (data: any) => void> = {};
    public spawnPlanets: ISpawnPlanet[] = [];
    public spawnLocations: ISpawnLocation[] = [];
    public playerId: string | null = null;
    public messages: IMessage[] = [];

    // client loop stuff
    public clientLoopStart: number = performance.now();
    public clientLoopDelta: number = 1000 / 10;
    public clientLoopDeltaStart: number = performance.now();

    public resetClientLoop() {
        const now = performance.now();
        const difference = now - this.clientLoopStart;
        if (difference < 10) {
            return;
        }
        this.clientLoopDelta = difference;
        this.clientLoopStart = now;
    }

    public handleClientLoop() {
        const now = performance.now();
        const delta = (now - this.clientLoopDeltaStart) / this.clientLoopDelta;
        this.clientLoopDeltaStart = now;

        const movableArrays: Array<{
            array: ICameraState[]
        }> = [{
            array: this.game.ships,
        }, {
            array: this.game.cannonBalls,
        }, {
            array: this.game.crates,
        }];

        for (const {array: movableArray} of movableArrays) {
            for (const item of movableArray) {
                item.position = item.position.clone().mul(item.positionVelocity.clone().pow(delta));
                item.orientation = item.orientation.clone().mul(item.orientationVelocity.clone().pow(delta));
            }
        }
    }

    // networking messages, outgoing
    public sendMessage(event: string, message: any = undefined) {
        this.socket.send(JSON.stringify({
            event,
            message
        }));
    }

    // pixi.js renderer
    public application: PIXI.Application;

    GetHullPoint = ([x, y]: [number, number]): [number, number, number] => {
        const z = Math.sqrt(1 -
            Math.pow(x * PHYSICS_SCALE / this.game.worldScale, 2) -
            Math.pow(y * PHYSICS_SCALE / this.game.worldScale, 2)
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
            
            void main() {
                vec4 pos = uCameraOrientation * uCameraPosition * uPosition * vec4(aPosition * uScale * uCameraScale + vec3(0, 0, uCameraScale), 1.0) - vec4(0, 0, uCameraScale, 0);
                gl_Position = pos * vec4(1, -1, 0.0625, 1);
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
        const planetVoronoiCells = this.game.generateGoodPoints(100, 10);
        const planetGeometry = new PIXI.Geometry();
        const planetGeometryData = planetVoronoiCells.reduce((acc, v) => {
            // color of voronoi tile
            const color: [number, number, number] = Math.random() > 0.33 ? [0, 0, 1] : [0, 1, 0];

            // initial center index
            const startingIndex = acc.index.reduce((acc, a) => Math.max(acc, a + 1), 0);
            acc.position.push.apply(acc.position, v.centroid);
            acc.color.push.apply(acc.color, color);

            for (let i = 0; i < v.vertices.length; i++) {
                // vertex data
                const a = v.vertices[i % v.vertices.length];
                acc.position.push.apply(acc.position, a);
                acc.color.push.apply(acc.color, color);

                // triangle data
                acc.index.push(
                    startingIndex,
                    startingIndex + (i % v.vertices.length) + 1,
                    startingIndex + ((i + 1) % v.vertices.length) + 1
                );
            }
            return acc;
        }, {position: [], color: [], index: []} as {position: number[], color: number[], index: number[]});
        planetGeometry.addAttribute("aPosition", planetGeometryData.position, 3);
        planetGeometry.addAttribute("aColor", planetGeometryData.color, 3);
        planetGeometry.addIndex(planetGeometryData.index);

        // create material
        const planetVertexShader = `
                precision mediump float;
                
                attribute vec3 aPosition;
                attribute vec3 aColor;
                
                uniform mat4 uCameraPosition;
                uniform mat4 uCameraOrientation;
                uniform float uCameraScale;
                uniform mat4 uPosition;
                uniform mat4 uOrientation;
                uniform float uScale;
                
                varying vec3 vColor;
                
                void main() {
                    vColor = aColor;
                    vec4 pos = uCameraOrientation * uCameraPosition * uPosition * vec4((uOrientation * vec4(aPosition, 1.0)).xyz * uScale * uCameraScale + vec3(0, 0, uCameraScale), 1.0) - vec4(0, 0, uCameraScale, 0);
                    gl_Position = pos * vec4(1, -1, 0.0625, 1);
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
            planetGeometry,
            planetProgram
        };
    })();

    cachedPixiShipResources: any;
    pixiShipResources = () => {
        if (this.cachedPixiShipResources) {
            return this.cachedPixiShipResources;
        }

        // generate ships
        const shipGeometryMap: Map<EFaction, Map<string, PIXI.Geometry>> = new Map();
        for (const factionType of Object.values(EFaction)) {
            for (const shipType of Object.values(EShipType)) {
                const shipToDraw = SHIP_DATA.find(i => i.shipType === shipType);
                if (!shipToDraw) {
                    continue;
                }

                const shipGeometry = new PIXI.Geometry();
                const shipGeometryData: {position: number[], color: number[], index: number[]} = {
                    position: [],
                    color: [],
                    index: []
                };
                let shipColor = [1, 1, 1];
                const factionData = this.game.factions[factionType];
                if (factionData) {
                    switch (factionData.factionColor) {
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
                            if (factionData.factionColor.startsWith("#")) {
                                shipColor = this.hexToRgb(factionData.factionColor);
                            } else {
                                shipColor = [1, 1, 1];
                            }
                    }
                }

                // draw hull
                shipGeometryData.position.push.apply(shipGeometryData.position, this.GetHullPoint([0, 0]));
                shipGeometryData.color.push.apply(shipGeometryData.color, shipColor);
                for (let i = 0; i < shipToDraw.hull.length; i++) {
                    const a = shipToDraw.hull[i % shipToDraw.hull.length];

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
                            shipToDraw.cannons.leftWall + 5, shipToDraw.cannons.startY + (position + 0.75) * cannonSpacing, 1,
                            shipToDraw.cannons.leftWall + 5, shipToDraw.cannons.startY + (position + 0.25) * cannonSpacing, 1
                        );
                        shipGeometryData.color.push(
                            0.75, 0.75, 0.75,
                            0.75, 0.75, 0.75,
                            0.75, 0.75, 0.75,
                            0.75, 0.75, 0.75,
                        );
                    } else {
                        shipGeometryData.position.push(
                            shipToDraw.cannons.rightWall - 5, shipToDraw.cannons.startY + (position + 0.25) * cannonSpacing, 1,
                            shipToDraw.cannons.rightWall - 5, shipToDraw.cannons.startY + (position + 0.75) * cannonSpacing, 1,
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
            shipProgram
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
            
            void main() {
                vec4 pos = uCameraOrientation * uCameraPosition * uPosition * vec4(aPosition * uScale * uCameraScale + vec3(0, 0, uCameraScale), 1.0) - vec4(0, 0, uCameraScale, 0);
                gl_Position = pos * vec4(1, -1, 0.0625, 1);
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
        const crateGeometryData: {position: number[], color: number[], index: number[]} = {
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
        const crateImageGeometryData: {position: number[], uv: number[], index: number[]} = {
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
                
                varying highp vec2 vUv;
                
                void main() {
                    vUv = aUv;
                    vec4 pos = uCameraOrientation * uCameraPosition * uPosition * vec4((uOrientation * vec4(aPosition, 1.0)).xyz * uScale * uCameraScale + vec3(0, 0, uCameraScale), 1.0) - vec4(0, 0, uCameraScale, 0);
                    gl_Position = pos * vec4(1, -1, 0.0625, 1);
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
            
            void main() {
                vec4 pos = uCameraOrientation * uCameraPosition * vec4(aPosition * uCameraScale, 1.0);
                gl_Position = pos * vec4(1, -1, 0.0625, 1);
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

    starMeshes: Array<{
        id: string, mesh: PIXI.Mesh<PIXI.Shader>,
        tick: number
    }> = [];
    planetMeshes: Array<{
        id: string,
        mesh: PIXI.Mesh<PIXI.Shader>,
        orientation: Quaternion,
        rotation: Quaternion,
        tick: number
    }> = [];
    shipMeshes: Array<{
        id: string,
        mesh: PIXI.Mesh<PIXI.Shader>,
        text: PIXI.Text,
        line: PIXI.Graphics,
        isPlayer: boolean,
        position: Quaternion,
        orientation: Quaternion,
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
            uScale: 2 * star.size * PHYSICS_SCALE / this.game.worldScale
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

    addPlanet = ({planet, cameraPosition, cameraOrientation, tick}: {
        planet: Planet, cameraPosition: Quaternion, cameraOrientation: Quaternion, tick: number
    }) => {
        // create planet properties
        const orientation: Quaternion = planet.orientation;
        const rotation: Quaternion = Quaternion.fromAxisAngle(DelaunayGraph.randomPoint(), Math.PI * 2 / 60 / 10 / 10);

        // create mesh
        const uniforms = {
            uCameraPosition: cameraPosition.clone().inverse().toMatrix4(),
            uCameraOrientation: cameraOrientation.clone().inverse().toMatrix4(),
            uCameraScale: this.state.zoom,
            uPosition: planet.position.toMatrix4(),
            uOrientation: orientation.toMatrix4(),
            uScale: 10 * planet.size * PHYSICS_SCALE / this.game.worldScale
        };
        const shader = new PIXI.Shader(this.pixiPlanetResources.planetProgram, uniforms);
        const state = PIXI.State.for2d();
        state.depthTest = true;
        const mesh = new PIXI.Mesh(this.pixiPlanetResources.planetGeometry, shader, state);
        mesh.zIndex = -5;

        this.application.stage.addChild(mesh);
        this.planetMeshes.push({
            id: planet.id,
            mesh,
            orientation,
            rotation,
            tick,
        });
    };

    addShip = ({ship, cameraPosition, cameraOrientation, tick}: {
        ship: Ship, cameraPosition: Quaternion, cameraOrientation: Quaternion, tick: number
    }) => {
        const position: Quaternion = ship.position;
        const orientation: Quaternion = ship.orientation;
        console.log(orientation.rotateVector([1, 0, 0]));

        // create mesh
        const uniforms = {
            uCameraPosition: cameraPosition.clone().inverse().toMatrix4(),
            uCameraOrientation: cameraOrientation.clone().inverse().toMatrix4(),
            uCameraScale: this.state.zoom,
            uPosition: position.toMatrix4(),
            uOrientation: orientation.toMatrix4(),
            uScale: PHYSICS_SCALE / this.game.worldScale
        };
        const shader = new PIXI.Shader(this.pixiShipResources().shipProgram, uniforms);
        const mesh = new PIXI.Mesh(this.pixiShipResources().shipGeometryMap.get(ship.faction?.id ?? EFaction.DUTCH)?.get(ship.shipType) as any, shader);
        mesh.zIndex = -3;

        const text = new PIXI.Text(ship.shipType);
        text.style.fill = "white";
        text.style.fontSize = 15;

        const line = new PIXI.Graphics();
        line.zIndex = -4;

        const isPlayer = this.getPlayerShip().id === ship.id;

        this.application.stage.addChild(mesh);
        this.application.stage.addChild(text);
        this.application.stage.addChild(line);
        this.shipMeshes.push({
            id: ship.id,
            mesh,
            text,
            line,
            isPlayer,
            position,
            orientation,
            tick,
        });
    };

    addCannonBall = ({cannonBall, cameraPosition, cameraOrientation, tick}: {
        cannonBall: CannonBall, cameraPosition: Quaternion, cameraOrientation: Quaternion, tick: number
    }) => {
        const position: Quaternion = cannonBall.position;
        const positionVelocity: Quaternion = cannonBall.positionVelocity;

        // create mesh
        const uniforms = {
            uCameraPosition: cameraPosition.clone().inverse().toMatrix4(),
            uCameraOrientation: cameraOrientation.clone().inverse().toMatrix4(),
            uCameraScale: this.state.zoom,
            uPosition: position.toMatrix4(),
            uColor: [0.75, 0.75, 0.75, 1],
            uScale: 5 * PHYSICS_SCALE / this.game.worldScale
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
        const position: Quaternion = crate.position;
        const orientation: Quaternion = crate.orientation;
        const rotation: Quaternion = crate.orientationVelocity;
        const resourceType: EResourceType = crate.resourceType;

        // create mesh
        const meshUniforms = {
            uCameraPosition: cameraPosition.clone().inverse().toMatrix4(),
            uCameraOrientation: cameraOrientation.clone().inverse().toMatrix4(),
            uCameraScale: this.state.zoom,
            uPosition: position.toMatrix4(),
            uOrientation: orientation.toMatrix4(),
            uScale: 5 * PHYSICS_SCALE / this.game.worldScale
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
            uScale: 15 * PHYSICS_SCALE / this.game.worldScale,
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
            hash = ((hash<<5)-hash)+character;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    addVoronoi = ({id, tile, cameraPosition, cameraOrientation, tick}: {
        id: string, tile: ITessellatedTriangle, cameraPosition: Quaternion, cameraOrientation: Quaternion, tick: number
    }) => {
        const digits: number[] = [];
        for (const match of id.split("-")) {
            const int = parseInt(match);
            if (!isNaN(int)) {
                digits.push(int);
            }
        }

        const initialIndex = this.hashCode(id);
        let primaryIndex = digits[0] ?? 0;
        let secondaryIndex = digits[digits.length - 1] ?? 0;

        const lastIndexOf = id.lastIndexOf('-');
        if (lastIndexOf) {
            primaryIndex = this.hashCode(id.slice(0, lastIndexOf));
            secondaryIndex = this.hashCode(id.slice(0, lastIndexOf));
        }

        const colors: Array<[number, number, number, number]> = [
            [0.75, 0.00, 0.00, 0.25],
            [0.75, 0.75, 0.00, 0.25],
            [0.00, 0.75, 0.00, 0.25],
            [0.00, 0.75, 0.75, 0.25],
            [0.00, 0.00, 0.75, 0.25],
            [0.75, 0.00, 0.75, 0.25]
        ];
        const color = colors[primaryIndex % colors.length];
        const shades = [0.75, 0.65, 0.55, 0.45, 0.35, 0.25];
        const shade = shades[Math.floor(secondaryIndex / colors.length) % shades.length];
        const uColor = color.map(i => i === 0.75 ? shade : i);

        // create mesh
        const uniforms = {
            uCameraPosition: cameraPosition.clone().inverse().toMatrix4(),
            uCameraOrientation: cameraOrientation.clone().inverse().toMatrix4(),
            uCameraScale: this.game.worldScale * this.state.zoom,
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

    constructor(props: IAppProps) {
        super(props);

        // setup rendering
        this.application = new PIXI.Application({
            width: this.state.width,
            height: this.state.height
        });
        this.application.stage.sortableChildren = true;
        // this.application.stage.mask = new Graphics()
        //     .beginFill(0xffffff)
        //     .drawCircle(this.application.stage.width / 2, this.application.stage.height / 2,
        //         Math.min(this.application.stage.width, this.application.stage.height) / 2)
        //     .endFill();

        // draw app
        this.game.initializeGame();

        // draw rotating app
        let cameraPosition: Quaternion = Quaternion.ONE;
        let cameraOrientation: Quaternion = Quaternion.ONE;

        // load sprites into memory
        const loader = new PIXI.Loader();

        // queue images to be loaded
        loader.add("missing", DEFAULT_IMAGE);
        for (const resourceType of Object.values(EResourceType)) {
            const item = RESOURCE_TYPE_TEXTURE_PAIRS.find(i => i.resourceType === resourceType);
            if (item) {
                loader.add(item.name, item.url);
            }
        }
        loader.load((loader, resources) => {
            // load images into cache
            for (const resourceType of Object.values(EResourceType)) {
                const resourceTypeTextureItem = RESOURCE_TYPE_TEXTURE_PAIRS.find(i => i.resourceType === resourceType);
                const textureName = resourceTypeTextureItem ? resourceTypeTextureItem.name : "missing";
                const item = resources[textureName];
                if (item) {
                    this.sprites[resourceType] = item.texture;
                } else {
                    this.sprites[resourceType] = resources.missing.texture;
                }
            }
        });

        const handleDrawingOfText = (text: PIXI.Text, position: Quaternion) => {
            const textPosition = cameraOrientation.clone().inverse()
                .mul(cameraPosition.clone().inverse())
                .mul(position.clone())
                .rotateVector([0, 0, 1]);
            text.x = ((textPosition[0] * this.game.worldScale * this.state.zoom) / 2 * this.application.renderer.width) + this.application.renderer.width * 0.5;
            text.y = ((textPosition[1] * this.game.worldScale * this.state.zoom) / 2 * this.application.renderer.height) + this.application.renderer.height * 0.5;
            const center: [number, number] = [
                this.application.renderer.width / 2,
                this.application.renderer.height / 2
            ];
            const directionTowardsCenter: [number, number] = [
                center[0] - text.x,
                center[1] - text.y
            ];
            const directionTowardsCenterLength = Math.sqrt(Math.pow(directionTowardsCenter[0], 2) + Math.pow(directionTowardsCenter[1], 2));
            const normalizedDirectionTowardsCenter: [number, number] = [
                directionTowardsCenter[0] / directionTowardsCenterLength,
                directionTowardsCenter[1] / directionTowardsCenterLength
            ];
            text.x += normalizedDirectionTowardsCenter[0] * 25;
            text.y += normalizedDirectionTowardsCenter[1] * 25;
            text.visible = textPosition[2] < 0;
        }

        // draw rotating app
        let pixiTick: number = 0;
        this.application.ticker.add(() => {
            const playerShip = this.getPlayerShip();
            cameraPosition = playerShip.position.clone();
            cameraOrientation = playerShip.orientation.clone();
            pixiTick += 1;

            // sync game to Pixi renderer
            // stars
            for (const star of [
                ...Array.from(this.game.voronoiTerrain.getStars(cameraPosition.rotateVector([0, 0, 1]), 0.5)),
                ...Array.from(this.game.voronoiTerrain.getStars(cameraPosition.rotateVector([0, 0, 1]), 0.25)),
                ...Array.from(this.game.voronoiTerrain.getStars(cameraPosition.rotateVector([0, 0, 1]), 0.125))
            ]) {
                const starMesh = this.starMeshes.find(p => p.id === star.id);
                if (starMesh) {
                    starMesh.tick = pixiTick;
                } else {
                    this.addStar({
                        star,
                        cameraPosition,
                        cameraOrientation,
                        tick: pixiTick
                    });
                }
            }
            for (const item of this.starMeshes.filter(m => m.tick !== pixiTick)) {
                this.application.stage.removeChild(item.mesh);
            }
            this.starMeshes = this.starMeshes.filter(m => m.tick === pixiTick);
            // planets
            for (const planet of Array.from(this.game.voronoiTerrain.getPlanets(cameraPosition.rotateVector([0, 0, 1])))) {
                const planetMesh = this.planetMeshes.find(p => p.id === planet.id);
                if (planetMesh) {
                    planetMesh.orientation = planetMesh.rotation.clone().mul(planetMesh.orientation.clone());
                    planetMesh.tick = pixiTick;
                } else {
                    this.addPlanet({
                        planet,
                        cameraPosition,
                        cameraOrientation,
                        tick: pixiTick
                    });
                }
            }
            for (const item of this.planetMeshes.filter(m => m.tick !== pixiTick)) {
                this.application.stage.removeChild(item.mesh);
            }
            this.planetMeshes = this.planetMeshes.filter(m => m.tick === pixiTick);
            // ships
            for (const ship of this.game.ships) {
                const shipMesh = this.shipMeshes.find(s => s.id === ship.id);
                if (shipMesh) {
                    shipMesh.isPlayer = this.getPlayerShip().id === ship.id;
                    shipMesh.position = ship.position.clone();
                    shipMesh.orientation = ship.orientation.clone();
                    shipMesh.tick = pixiTick;
                } else {
                    this.addShip({
                        ship,
                        cameraPosition,
                        cameraOrientation,
                        tick: pixiTick
                    });
                }
            }
            for (const item of this.shipMeshes.filter(m => m.tick !== pixiTick)) {
                this.application.stage.removeChild(item.mesh);
                this.application.stage.removeChild(item.text);
                this.application.stage.removeChild(item.line);
            }
            this.shipMeshes = this.shipMeshes.filter(m => m.tick === pixiTick);
            // cannonBalls
            for (const cannonBall of this.game.cannonBalls) {
                const cannonBallMesh = this.cannonBallMeshes.find(c => c.id === cannonBall.id);
                if (cannonBallMesh) {
                    cannonBallMesh.position = cannonBall.position;
                    cannonBallMesh.positionVelocity = cannonBall.positionVelocity;
                    cannonBallMesh.tick = pixiTick;
                } else {
                    this.addCannonBall({
                        cannonBall,
                        cameraPosition,
                        cameraOrientation,
                        tick: pixiTick
                    });
                }
            }
            for (const item of this.cannonBallMeshes.filter(m => m.tick !== pixiTick)) {
                this.application.stage.removeChild(item.mesh);
            }
            this.cannonBallMeshes = this.cannonBallMeshes.filter(m => m.tick === pixiTick);
            // crates
            for (const crate of this.game.crates) {
                const crateMeshes = this.crateMeshes.find(c => c.id === crate.id);
                if (crateMeshes) {
                    crateMeshes.position = crate.position;
                    crateMeshes.orientation = crate.orientation;
                    crateMeshes.tick = pixiTick;
                } else {
                    this.addCrate({
                        crate,
                        cameraPosition,
                        cameraOrientation,
                        tick: pixiTick
                    });
                }
            }
            for (const item of this.crateMeshes.filter(m => m.tick !== pixiTick)) {
                this.application.stage.removeChild(item.mesh);
                this.application.stage.removeChild(item.image);
            }
            this.crateMeshes = this.crateMeshes.filter(m => m.tick === pixiTick);
            // voronoi tiles
            if (this.state.showVoronoi) {
                const voronoiDataStuff = this.voronoiData.reduce((acc, {id, voronoi}) => {
                    const tiles = this.game.getDelaunayTileTessellation(
                        Quaternion.fromBetweenVectors([0, 0, 1], voronoi.centroid),
                        voronoi.vertices.map(v => Quaternion.fromBetweenVectors([0, 0, 1], v)),
                        this.state.voronoiMode === EVoronoiMode.KINGDOM ? 3 :
                            this.state.voronoiMode === EVoronoiMode.DUCHY ? 2 : 1
                    );
                    acc.push(...Array.from(tiles).map((tile, index) => ({
                        id: `${id}-${index}`,
                        tile
                    })));
                    return acc;
                }, [] as Array<{id: string, tile: ITessellatedTriangle}>).filter(({tile}) => {
                    const vertices = tile.vertices.map(v => {
                        const item = v.rotateVector([0, 0, 1]);
                        return [
                            item[0],
                            -item[1],
                            item[2]
                        ] as [number, number, number];
                    });
                    return DelaunayGraph.dotProduct(DelaunayGraph.crossProduct(
                        DelaunayGraph.subtract(vertices[1], vertices[0]),
                        DelaunayGraph.subtract(vertices[2], vertices[0]),
                    ), cameraPosition.rotateVector([0, 0, 1])) < 0;
                });
                for (const {id, tile} of voronoiDataStuff) {
                    const voronoiMesh = this.voronoiMeshes.find(p => p.id === id);
                    if (voronoiMesh) {
                        voronoiMesh.tick = pixiTick;
                    } else {
                        this.addVoronoi({
                            id,
                            tile,
                            cameraPosition,
                            cameraOrientation,
                            tick: pixiTick
                        });
                    }
                }
            }
            for (const item of this.voronoiMeshes.filter(m => m.tick !== pixiTick)) {
                this.application.stage.removeChild(item.mesh);
            }
            this.voronoiMeshes = this.voronoiMeshes.filter(m => m.tick === pixiTick);

            // update each star
            for (const item of this.starMeshes) {
                const shader = item.mesh.shader;
                shader.uniforms.uCameraPosition = cameraPosition.clone().inverse().toMatrix4();
                shader.uniforms.uCameraOrientation = cameraOrientation.clone().inverse().toMatrix4();
                shader.uniforms.uCameraScale = this.state.zoom;
            }

            // update each planet
            for (const item of this.planetMeshes) {
                item.orientation = item.rotation.clone().mul(item.orientation.clone());

                const shader = item.mesh.shader;
                shader.uniforms.uCameraPosition = cameraPosition.clone().inverse().toMatrix4();
                shader.uniforms.uCameraOrientation = cameraOrientation.clone().inverse().toMatrix4();
                shader.uniforms.uCameraScale = this.state.zoom;
                shader.uniforms.uOrientation = item.orientation.toMatrix4();
            }

            // update each ship
            for (const item of this.shipMeshes) {
                const shader = item.mesh.shader;
                shader.uniforms.uCameraPosition = cameraPosition.clone().inverse().toMatrix4();
                shader.uniforms.uCameraOrientation = cameraOrientation.clone().inverse().toMatrix4();
                shader.uniforms.uCameraScale = this.state.zoom;
                shader.uniforms.uPosition = item.position.toMatrix4();
                shader.uniforms.uOrientation = item.orientation.toMatrix4();

                handleDrawingOfText(item.text, item.position);

                if (item.isPlayer) {
                    const startPoint = cameraOrientation.clone().inverse()
                        .mul(cameraPosition.clone().inverse())
                        .mul(item.position.clone())
                        .rotateVector([0, 0, 1]);
                    const lineXS = ((startPoint[0] * this.game.worldScale * this.state.zoom) / 2 * this.application.renderer.width) + this.application.renderer.width * 0.5;
                    const lineYS = ((startPoint[1] * this.game.worldScale * this.state.zoom) / 2 * this.application.renderer.height) + this.application.renderer.height * 0.5;

                    const endPoint = cameraOrientation.clone().inverse()
                        .mul(cameraPosition.clone().inverse())
                        .mul(item.position.clone())
                        .mul(item.orientation.clone())
                        .mul(Quaternion.fromAxisAngle([1, 0, 0], Math.PI / this.game.worldScale / this.state.zoom))
                        .rotateVector([0, 0, 1]);
                    const lineXE = ((endPoint[0] * this.game.worldScale * this.state.zoom) / 2 * this.application.renderer.width) + this.application.renderer.width * 0.5;
                    const lineYE = ((endPoint[1] * this.game.worldScale * this.state.zoom) / 2 * this.application.renderer.height) + this.application.renderer.height * 0.5;

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
                    item.line.beginFill(0x0000ff);
                    item.line.lineStyle(1, 0x0000ff);
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
                } else {
                    item.line.visible = false;
                }
            }

            // update each cannon ball
            for (const item of this.cannonBallMeshes) {
                item.position = item.position.clone().mul(item.positionVelocity.clone().pow(1/60));

                const shader = item.mesh.shader;
                shader.uniforms.uCameraPosition = cameraPosition.clone().inverse().toMatrix4();
                shader.uniforms.uCameraOrientation = cameraOrientation.clone().inverse().toMatrix4();
                shader.uniforms.uCameraScale = this.state.zoom;
                shader.uniforms.uPosition = item.position.toMatrix4();
            }

            // update each crate
            for (const item of this.crateMeshes) {
                item.orientation = item.orientation.clone().mul(item.rotation.clone());

                const meshShader = item.mesh.shader;
                meshShader.uniforms.uCameraPosition = cameraPosition.clone().inverse().toMatrix4();
                meshShader.uniforms.uCameraOrientation = cameraOrientation.clone().inverse().toMatrix4();
                meshShader.uniforms.uCameraScale = this.state.zoom;
                meshShader.uniforms.uPosition = item.position.toMatrix4();
                meshShader.uniforms.uOrientation = item.orientation.toMatrix4();

                const imageShader = item.image.shader;
                imageShader.uniforms.uCameraPosition = cameraPosition.clone().inverse().toMatrix4();
                imageShader.uniforms.uCameraOrientation = cameraOrientation.clone().inverse().toMatrix4();
                imageShader.uniforms.uCameraScale = this.state.zoom;
                imageShader.uniforms.uPosition = item.position.toMatrix4();
                imageShader.uniforms.uOrientation = item.orientation.toMatrix4();

                handleDrawingOfText(item.text, item.position);
            }

            // draw voronoi terrain tiles for political boundaries
            if (this.state.showVoronoi) {
                for (const item of this.voronoiMeshes) {
                    const shader = item.mesh.shader;
                    shader.uniforms.uCameraPosition = cameraPosition.clone().inverse().toMatrix4();
                    shader.uniforms.uCameraOrientation = cameraOrientation.clone().inverse().toMatrix4();
                    shader.uniforms.uCameraScale = this.state.zoom;
                }
            }
        });

        // setup networking
        this.socket = new SockJS("/game");
        this.socket.onerror = (err) => {
            console.log("Failed to connect", err);
        };
        this.socket.onmessage = (message) => {
            let data: {event: string, message: any} | null = null;
            try {
                data = JSON.parse(message.data) as {event: string, message: any};
            } catch {}
            if (data) {
                if (data.event === "send-frame") {
                    // send a message back to stop effects of nagle algorithm
                    // do not want messages to clump or buffer
                    // old message delays 100 100 100 300 0 0 100
                    // this line fixes the bug so it is 100 100 100 100 100 100 100
                    // clumpy messages will cause interpolation bugs
                    this.sendMessage("ack", "ACK");
                }
                const matchingHandler = this.socketEvents[data.event];
                if (matchingHandler) {
                    matchingHandler(data.message);
                }
            }
        };
        this.socketEvents["send-world"] = (data: IGameInitializationFrame) => {
            this.setState({
                showSpawnMenu: false,
                showPlanetMenu: false,
                showMainMenu: true,
                showLoginMenu: false,
            });
            this.game.applyGameInitializationFrame(data);
            this.initialized = true;
            setTimeout(() => {
                this.sendMessage("init-loop");
            }, 500);
        };
        this.socketEvents["send-frame"] = (data: IGameSyncFrame) => {
            const playerData = this.game.playerData.find(p => p.id === this.playerId);
            if (playerData) {
                const ship = this.game.ships.find(s => s.id === playerData.shipId);
                const shipData = data.ships.find(s => s.id === playerData.shipId);
                if (ship && shipData) {
                    // cancel server position if the position difference is small
                    if (VoronoiGraph.angularDistance(
                        ship.position.rotateVector([0, 0, 1]),
                        DeserializeQuaternion(shipData.position).rotateVector([0, 0, 1]),
                        this.game.worldScale
                    ) < Game.VELOCITY_STEP * 10 * 3 * 10 * Math.PI * 2) {
                        shipData.position = SerializeQuaternion(ship.position);
                        shipData.positionVelocity = SerializeQuaternion(ship.positionVelocity);
                        shipData.orientation = SerializeQuaternion(ship.orientation);
                        shipData.orientationVelocity = SerializeQuaternion(ship.orientationVelocity);
                        shipData.cannonLoading = ship.cannonLoading;
                        shipData.cannonCoolDown = ship.cannonCoolDown;
                        shipData.cannonadeCoolDown = ship.cannonadeCoolDown;
                    }
                }
            }
            this.game.applyGameSyncFrame(data);
            this.resetClientLoop();
        };
        this.socketEvents["send-players"] = (data) => {
            this.game.playerData = data.players;
            this.playerId = data.playerId;
        };
        this.socketEvents["generic-message"] = (data: IMessage) => {
            this.messages.push(data);
        };
        this.socketEvents["send-spawn-planets"] = (data: ISpawnPlanet[]) => {
            this.spawnPlanets = data;
        };
        this.socketEvents["send-spawn-locations"] = (data: ISpawnLocation[]) => {
            this.spawnLocations = data;
        };
    }

    /**
     * ------------------------------------------------------------
     * Get player data
     * ------------------------------------------------------------
     */

    private findPlayer(): IPlayerData | null {
        return this.game.playerData.find(p => p.id === this.playerId) || null;
    }

    private findPlayerShip(): Ship | null {
        const player = this.findPlayer();
        if (player) {
            return this.game.ships.find(s => s.id === player.shipId) || null;
        } else {
            return null;
        }
    }

    /**
     * Get the home world of the player.
     */
    getPlayerPlanet(): Planet | null {
        const ship = this.findPlayerShip();
        if (ship) {
            return ship.planet || null;
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
        // show latest faction ship
        if (this.state.faction) {
            // faction selected, orbit the faction's home world
            const faction = Object.values(this.game.factions).find(f => f.id === this.state.faction);
            const ship = this.game.ships.find(s => faction && faction.shipIds.length > 0 && s.id === faction.shipIds[faction.shipIds.length - 1]);
            if (ship) {
                return Game.GetCameraState(ship);
            }
        }
        // show latest attacking ship
        const attackingAIShip = this.game.ships.find(s => s.id === this.game.demoAttackingShipId);
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
        tempShip.position = Quaternion.fromAxisAngle([1, 0, 0], -angle);
        return Game.GetCameraState(tempShip);
    }

    /**
     * --------------------------------------------------------
     * Transform objects to render them onto the screen.
     * --------------------------------------------------------
     */

    /**
     * Move an object over time, useful for graphics only objects which do not collide, like smoke clouds and sparks.
     * @param graphicsOnlyObject The object to move.
     * @private
     */
    private static applyKinematics<T extends ICameraState & IExpirable>(graphicsOnlyObject: T): T {
        const {
            position: objectPosition,
            positionVelocity: objectPositionVelocity,
            orientation: objectOrientation,
            orientationVelocity: objectOrientationVelocity,
            created
        } = graphicsOnlyObject;

        // apply basic kinematics
        const t = (+new Date() - +created) / 100;
        const position = objectPositionVelocity.clone().pow(t).mul(objectPosition);
        const orientation = objectOrientationVelocity.clone().pow(t).mul(objectOrientation);

        return {
            ...graphicsOnlyObject,
            position,
            orientation
        }
    }

    /**
     * Rotate an object based on the current ship's position and orientation.
     * @param planet The object to rotate.
     * @private
     */
    private rotatePlanet<T extends ICameraState>(planet: T): ICameraStateWithOriginal<T> {
        const {
            position: cameraPosition,
            orientation: cameraOrientation,
        } = this.getPlayerShip();
        const position = cameraOrientation.clone().inverse()
            .mul(cameraPosition.clone().inverse())
            .mul(planet.position.clone());
        const orientation = cameraOrientation.clone().inverse()
            .mul(planet.orientation.clone());
        const positionVelocity = cameraOrientation.clone().inverse()
            .mul(planet.positionVelocity.clone());
        return {
            original: planet,
            ...planet,
            position,
            orientation,
            positionVelocity,
        };
    }

    /**
     * Convert the object to a drawable object, able to be sorted and drawn on the screen.
     * @param layerPostfix
     * @param size
     * @param planet
     * @private
     */
    private convertToDrawable<T extends ICameraState>(layerPostfix: string, size: number, planet: ICameraStateWithOriginal<T>): IDrawable<T> {
        const rotatedPosition = planet.position.rotateVector([0, 0, 1]);
        const projection = this.stereographicProjection(planet, size);
        const reverseProjection = this.stereographicProjection(planet, size);
        const distance = Math.max(MIN_DISTANCE, 5 * (1 - rotatedPosition[2] * size)) * this.game.worldScale;
        const orientationPoint = planet.orientation.rotateVector([1, 0, 0]);
        const rotation = Math.atan2(-orientationPoint[1], orientationPoint[0]) / Math.PI * 180;
        return {
            id: `${planet.id}${layerPostfix}`,
            color: planet.color,
            position: planet.position,
            positionVelocity: planet.positionVelocity,
            orientation: planet.orientation,
            orientationVelocity: planet.orientationVelocity,
            original: planet.original,
            projection,
            reverseProjection,
            rotatedPosition,
            rotation,
            distance,
        };
    }

    /**
     * Perform a projection from 3d spherical space to 2d screen space.
     * @param planet
     * @param size
     * @private
     */
    private stereographicProjection(planet: ICameraState, size: number = 1): {x: number, y: number} {
        const zoom = (this.state.zoom * this.game.worldScale);
        const vector = planet.position.rotateVector([0, 0, 1]);
        return {
            x: vector[0] * zoom * size,
            y: vector[1] * zoom * size,
        };
    }

    /**
     * Get the points of angular progress for a polygon pi chart. Used for health bars and progress bars.
     * @param percent the percentage done from 0 to 1.
     * @param radius the size of the pi chart
     */
    private getPointsOfAngularProgress(percent: number, radius: number) {
        const numSlices = Math.ceil(percent * 32);
        return new Array(numSlices + 1).fill(0).map((v, i) => {
            return `${radius * Math.cos((i / numSlices) * percent * Math.PI * 2)},${radius * Math.sin((i / numSlices) * percent * Math.PI * 2)}`;
        }).join(" ");
    }

    /**
     * ----------------------------------------------------------------------------------------------
     * Render functions used to draw stuff onto the screen. Each stuff has their own render function.
     * ----------------------------------------------------------------------------------------------
     */
    /**
     * Draw the planet onto the screen.
     * @param uiPass
     * @param planetDrawing
     * @private
     */
    private drawPlanet(uiPass: boolean, planetDrawing: IDrawable<Planet>) {
        const isReverseSide = planetDrawing.rotatedPosition[2] < 0;
        const x = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).x + 1) * 0.5;
        const y = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).y + 1) * 0.5;
        const distance = planetDrawing.distance * 5;
        const size = 2 * Math.max(0, 2 * Math.atan(planetDrawing.original.size / (2 * distance)));

        // extract faction information
        let factionColor: string | null = null;
        const ownerFaction = Object.values(this.game.factions).find(faction => faction.planetIds.includes(planetDrawing.original.id));
        if (ownerFaction) {
            factionColor = ownerFaction.factionColor;
        }

        // extract planet information
        let planetX: number = 0;
        let planetY: number = 0;
        let planetVisible: boolean = false;
        let planetTitle: string = "";
        if (planetDrawing.original.settlementProgress > 0) {
            if (ownerFaction) {
                // get the settlement text
                let settlementText: string = "";
                const settlementEntry = Object.entries(ESettlementLevel).find(e => e[1] === planetDrawing.original.settlementLevel);
                if (settlementEntry) {
                    settlementText = ` ${settlementEntry[0]}`;
                }

                // get the title text
                let titleText: string = "";
                if (planetDrawing.original.county.faction) {
                    titleText = "County of ";
                    if (planetDrawing.original.county.duchy.capital === planetDrawing.original.county) {
                        titleText = "Duchy of ";
                        if (planetDrawing.original.county.duchy.kingdom.capital === planetDrawing.original.county.duchy) {
                            titleText = "Kingdom of ";
                            if (planetDrawing.original.id === ownerFaction.homeWorldPlanetId) {
                                titleText = "Empire of ";
                            }
                        }
                    }
                }
                planetTitle = `${titleText}${ownerFaction.id}${settlementText}`;
            }

            planetX = x * this.state.width;
            planetY = (1 - y) * this.state.height;
            planetVisible = !isReverseSide;
        }

        return (
            <>
                {
                    !uiPass && planetDrawing.original.settlementProgress > 0 && factionColor && (
                        <polygon
                            key={`${planetDrawing.id}-settlement-progress-1`}
                            transform={`translate(${x * this.state.width},${(1 - y) * this.state.height})`}
                            fill={factionColor}
                            style={{opacity: 0.8}}
                            points={`0,0 ${this.getPointsOfAngularProgress.call(this, Math.max(0, Math.min(planetDrawing.original.settlementProgress, 1)), size * (this.state.zoom * this.game.worldScale) * 1.35)}`}
                        />
                    )
                }
                {
                    !uiPass && planetDrawing.original.settlementProgress > 1 && factionColor && (
                        <polygon
                            key={`${planetDrawing.id}-settlement-progress-2`}
                            transform={`translate(${x * this.state.width},${(1 - y) * this.state.height})`}
                            fill={factionColor}
                            style={{opacity: 0.8}}
                            points={`0,0 ${this.getPointsOfAngularProgress.call(this, Math.max(0, Math.min((planetDrawing.original.settlementProgress - 1) / 4, 1)), size * (this.state.zoom * this.game.worldScale) * 1.70)}`}
                        />
                    )
                }
                {
                    !uiPass && (
                        <circle
                            key={`${planetDrawing.id}-planet`}
                            cx={x * this.state.width}
                            cy={(1 - y) * this.state.height}
                            r={size * (this.state.zoom * this.game.worldScale)}
                            fill={planetDrawing.color}
                            stroke="grey"
                            strokeWidth={0.2 * size * (this.state.zoom * this.game.worldScale)}
                            style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
                        />
                    )
                }
                {
                    uiPass && planetVisible && (
                        <>
                            <text
                                key={`${planetDrawing.id}-planet-title`}
                                x={planetX + size * (this.state.zoom * this.game.worldScale) + 10}
                                y={planetY - 6}
                                fill="white"
                                fontSize="12"
                            >{planetTitle}</text>
                            {
                                planetDrawing.original.buildings.filter(b => {
                                    return b.buildingType === EBuildingType.PLANTATION || b.buildingType === EBuildingType.MANUFACTORY;
                                }).map((building, index) => {
                                    const resourceType: EResourceType = building.buildingType === EBuildingType.PLANTATION ? (building as Plantation).resourceType : (building as Manufactory).recipe.products[0].resourceType;
                                    return (
                                        <text
                                            key={`${planetDrawing.id}-planet-resource-${index}`}
                                            x={planetX + size * (this.state.zoom * this.game.worldScale) + 10}
                                            y={planetY + (index + 1) * 10}
                                            fill="white"
                                            fontSize="8"
                                        >{resourceType} ({building.buildingLevel})</text>
                                    );
                                })
                            }
                        </>
                    )
                }
            </>
        );
    }

    /**
     * Get the target lines for a ship.
     * @param planetDrawing The ship to get target lines for.
     * @private
     */
    private static getShipTargetLines(planetDrawing: IDrawable<Ship>): ITargetLineData {
        const targetLines: Array<[[number, number], [number, number]]> = [];
        const targetNodes: Array<[[number, number], number]> = [];

        if (planetDrawing.original.pathFinding.points.length > 0) {
            for (let i = -1; i < planetDrawing.original.pathFinding.points.length - 1; i++) {
                // get pair of points to draw line in between two nodes
                const a = i >= 0 ? planetDrawing.original.pathFinding.points[i] : planetDrawing.original.position.rotateVector([0, 0, 1]);
                const b = planetDrawing.original.pathFinding.points[i + 1];

                // get points projected onto plane
                const aPoint = planetDrawing.original.orientation.clone().inverse()
                    .mul(planetDrawing.original.position.clone().inverse())
                    .rotateVector(a);
                const bPoint = planetDrawing.original.orientation.clone().inverse()
                    .mul(planetDrawing.original.position.clone().inverse())
                    .rotateVector(b);

                if (aPoint[2] >= 0 && bPoint[2] >= 0) {
                    // both points on front of sphere
                    const aLinePoint: [number, number] = [
                        aPoint[0] * 0.5,
                        aPoint[1] * 0.5,
                    ];
                    const bLinePoint: [number, number] = [
                        bPoint[0] * 0.5,
                        bPoint[1] * 0.5
                    ];
                    targetLines.push([aLinePoint, bLinePoint]);
                } else if (aPoint[2] >= 0 && bPoint[2] < 0) {
                    // first point on front of sphere while second point is behind sphere
                    const aLinePoint: [number, number] = [
                        aPoint[0] * 0.5,
                        aPoint[1] * 0.5,
                    ];
                    const midPoint = DelaunayGraph.normalize(Game.getAveragePoint([aPoint, bPoint]));
                    const abNormal = DelaunayGraph.normalize(DelaunayGraph.crossProduct(
                        DelaunayGraph.normalize(aPoint),
                        DelaunayGraph.normalize(bPoint)
                    ));
                    const equatorNormal = DelaunayGraph.crossProduct([1, 0, 0], [0, 1, 0]);
                    const line = DelaunayGraph.normalize(DelaunayGraph.crossProduct(abNormal, equatorNormal));
                    const bLinePoint: [number, number] = DelaunayGraph.dotProduct(line, midPoint) >= 0 ? [
                        line[0] * 0.5,
                        line[1] * 0.5
                    ] : [
                        -line[0] * 0.5,
                        -line[1] * 0.5
                    ];
                    targetLines.push([aLinePoint, bLinePoint]);
                } else if (aPoint[2] < 0 && bPoint[2] >= 0) {
                    // first point is behind sphere while second point is on front of sphere
                    const bLinePoint: [number, number] = [
                        bPoint[0] * 0.5,
                        bPoint[1] * 0.5
                    ];
                    const midPoint = DelaunayGraph.normalize(Game.getAveragePoint([aPoint, bPoint]));
                    const abNormal = DelaunayGraph.normalize(DelaunayGraph.crossProduct(
                        DelaunayGraph.normalize(aPoint),
                        DelaunayGraph.normalize(bPoint)
                    ));
                    const equatorNormal = DelaunayGraph.crossProduct([1, 0, 0], [0, 1, 0]);
                    const line = DelaunayGraph.normalize(DelaunayGraph.crossProduct(abNormal, equatorNormal));
                    const aLinePoint: [number, number] = DelaunayGraph.dotProduct(line, midPoint) >= 0 ? [
                        line[0] * 0.5,
                        line[1] * 0.5
                    ] : [
                        -line[0] * 0.5,
                        -line[1] * 0.5
                    ];
                    targetLines.push([aLinePoint, bLinePoint]);
                }

                if (bPoint[2] >= 0) {
                    const bLinePoint: [number, number] = [
                        bPoint[0] * 0.5,
                        bPoint[1] * 0.5
                    ];
                    targetNodes.push([bLinePoint, planetDrawing.original.pathFinding.points.length - i - 1]);
                }
            }
        }

        return {
            targetLines,
            targetNodes
        };
    }

    /**
     * Render a ship into a rectangle, Useful for UI button or game world.
     * @param planetDrawing
     * @param size
     * @private
     */
    private renderShip(planetDrawing: IDrawable<Ship>, size: number) {
        const shipData = SHIP_DATA.find(item => item.shipType === planetDrawing.original.shipType);
        if (!shipData) {
            throw new Error("Cannot find ship type");
        }
        const cannonsLeft = Math.ceil(shipData.cannons.numCannons / 2);
        const cannonsRight = shipData.cannons.numCannons - cannonsLeft;
        return (
            <>
                <polygon
                    key={`${planetDrawing.id}-ship-hull`}
                    points={`${shipData.hull.map(([x, y]) => `${x},${y}`).join(" ")}`}
                    fill={planetDrawing.color}
                    stroke="grey"
                    strokeWidth={0.05 * size * (this.state.zoom * this.game.worldScale)}
                    style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
                />
                {
                    new Array(cannonsRight).fill(0).map((v, index) => {
                        const cannonRightSize = (shipData.cannons.startY - shipData.cannons.endY) / cannonsRight;
                        return (
                            <polygon
                                key={`cannon-right-${index}`}
                                transform={`translate(${-shipData.cannons.rightWall},${shipData.cannons.endY + cannonRightSize * (index + 0.5)})`}
                                points="5,-2 0,-2 0,2 5,2"
                                fill="darkgrey"
                                stroke="grey"
                                strokeWidth={0.05 * size * (this.state.zoom * this.game.worldScale)}
                                style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
                            />
                        );
                    })
                }
                {
                    new Array(cannonsLeft).fill(0).map((v, index) => {
                        const cannonsLeftSize = (shipData.cannons.startY - shipData.cannons.endY) / cannonsLeft;
                        return (
                            <polygon
                                key={`cannon-left-${index}`}
                                transform={`translate(${-shipData.cannons.leftWall},${shipData.cannons.endY + cannonsLeftSize * (index + 0.5)})`}
                                points="-5,-2 0,-2 0,2 -5,2"
                                fill="darkgrey"
                                stroke="grey"
                                strokeWidth={0.05 * size * (this.state.zoom * this.game.worldScale)}
                                style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
                            />
                        );
                    })
                }
            </>
        )
    }

    /**
     * Draw a crate containing cargo, Crates are created when ships are destroyed and if that dead ship had cargo.
     * @param uiPass
     * @param planetDrawing
     * @private
     */
    private drawCrate(uiPass: boolean, planetDrawing: IDrawable<Crate>) {
        const isReverseSide = planetDrawing.rotatedPosition[2] > 0;
        const x = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).x + 1) * 0.5;
        const y = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).y + 1) * 0.5;
        const distance = planetDrawing.distance;
        const size = 0.1 * Math.max(0, 2 * Math.atan(planetDrawing.original.size / (2 * distance)));
        return (
            <g
                key={`${planetDrawing.id}${uiPass ? "-ui" : ""}`}
                transform={`translate(${x * this.state.width},${(1 - y) * this.state.height})`}
            >
                {
                    !uiPass && (
                        <g transform={`scale(0.2)`}>
                            {
                                this.renderItem(planetDrawing.original.resourceType)
                            }
                        </g>
                    )
                }
                {
                    uiPass && (
                        <text
                            stroke="white"
                            x={size * (this.state.zoom * this.game.worldScale) + 10}
                            y={0}
                        >
                            {planetDrawing.original.resourceType}
                        </text>
                    )
                }
            </g>
        );
    }

    /**
     * Run the game loop. This function is called 10 times a second to simulate a video game.
     */
    public gameLoop() {
        if (!this.initialized) {
            return;
        }

        if (this.frameCounter++ % 3 === 0) {
            // refresh voronoi data, refresh occasionally since this is expensive.
            if (this.refreshVoronoiDataTick <= 20) {
                this.refreshVoronoiDataTick += 1;
            } else {
                this.refreshVoronoiDataTick = 0;
                this.refreshVoronoiData();
            }

            // handle server replies
            while (true) {
                const message = this.messages.shift();
                if (message) {
                    // has message, process message
                    if (message.messageType === EMessageType.DEATH) {
                        this.setState({
                            showSpawnMenu: true
                        });
                    }
                } else {
                    // no more messages, end message processing
                    break;
                }
            }

            // perform client side movement
            const playerData = this.game.playerData.find(p => p.id === this.playerId);
            if (playerData && !playerData.autoPilotEnabled) {
                const shipIndex = this.game.ships.findIndex(s => s.id === playerData.shipId);
                if (shipIndex >= 0) {
                    this.game.handleShipLoop(shipIndex, () => this.activeKeys, false);
                }
            }

            // remove smoke clouds for performance
            this.game.smokeClouds.splice(0, this.game.smokeClouds.length);

            // move client side data to server
            while (true) {
                const message = this.game.outgoingMessages.shift();
                if (message) {
                    const [playerId, m] = message;
                    if (playerId === this.playerId) {
                        this.sendMessage("generic-message", m);
                    }
                } else {
                    break;
                }
            }
        }

        // draw onto screen
        this.handleClientLoop();
        this.forceUpdate();
    }

    /**
     * -----------------------------------------------------------
     * Handle UI functions, responds to UI button clicks.
     * -----------------------------------------------------------
     */

    /**
     * Handle show notes of the UI. The notes contain the goals to program/write. The ultimate goal is a multiplayer game,
     * but show notes contains about 20 bullet points to write over time.
     * @private
     */
    private handleShowNotes() {
        if (this.showNotesRef.current) {
            this.setState({
                ...this.state,
                showNotes: this.showNotesRef.current.checked,
            });
        }
    }

    /**
     * Show different type of ships in the screen above the game. Used for debugging the appearance of each ship
     * without buying the ship in game.
     * @private
     */
    private handleShowShips() {
        if (this.showShipsRef.current) {
            this.setState({
                ...this.state,
                showShips: this.showShipsRef.current.checked,
            });
        }
    }

    /**
     * Show different items in the screen above the game. Used for debugging the appearance of each item without buying
     * the item in game.
     * @private
     */
    private handleShowItems() {
        if (this.showItemsRef.current) {
            this.setState({
                ...this.state,
                showItems: this.showItemsRef.current.checked,
            });
        }
    }

    /**
     * Show a voronoi map in game. Used for debugging the marking of land between each planet. Voronoi mode is used
     * to display political information such as the boundaries of each kingdom.
     * @private
     */
    private handleShowVoronoi() {
        if (this.showVoronoiRef.current) {
            this.setState({
                ...this.state,
                showVoronoi: this.showVoronoiRef.current.checked,
            });
        }
    }

    /**
     * Change voronoi mode in game. Switch between Kingdom, Duchy, or County boundaries.
     * @param voronoiMode
     * @private
     */
    private handleChangeVoronoi(voronoiMode: EVoronoiMode) {
        this.setState({
            ...this.state,
            voronoiMode,
        }, () => {
            this.refreshVoronoiData();
        });
    }

    /**
     * Change if auto pilot is enabled in game.
     * @private
     */
    private handleAutoPilotEnabled() {
        if (this.autoPilotEnabledRef.current) {
            this.setState({
                ...this.state,
                autoPilotEnabled: this.autoPilotEnabledRef.current.checked,
            }, () => {
                const message: IAutoPilotMessage = {
                    messageType: EMessageType.AUTOPILOT,
                    enabled: this.state.autoPilotEnabled
                };
                if (this.socket) {
                    this.sendMessage("generic-message", message);
                }
            });
        }
    }

    /**
     * Enable or disable in game audio such as music.
     * @private
     */
    private handleAudioEnabled() {
        if (this.audioEnabledRef.current) {
            this.setState({
                ...this.state,
                audioEnabled: this.audioEnabledRef.current.checked,
            }, () => {
                if (this.state.audioEnabled) {
                    this.music.start();
                } else {
                    this.music.stop();
                }
            });
        }
    }

    /**
     * Convert keyboard keys into key events.
     * @param event
     * @private
     */
    private static getKeyString(event: KeyboardEvent): string {
        switch (event.key) {
            case "ArrowUp": return "w";
            case "ArrowDown": return "s";
            case "ArrowLeft": return "a";
            case "ArrowRight": return "d";
            default: return event.key;
        }
    }

    /**
     * Add key down event, send message to server.
     * @param event
     * @private
     */
    private handleKeyDown(event: KeyboardEvent) {
        const key = App.getKeyString(event);
        if (!this.activeKeys.includes(key)) {
            this.activeKeys.push(key);
        }
    }

    /**
     * Send keyboard key up message to the server.
     * @param event
     * @private
     */
    private handleKeyUp(event: KeyboardEvent) {
        const key = App.getKeyString(event);
        const index = this.activeKeys.findIndex(k => k === key);
        if (index >= 0) {
            this.activeKeys.splice(index, 1);
        }
    }

    /**
     * Change the zoom of the client, Increase zoom, get closer to see smaller detail.
     * @private
     */
    private incrementZoom() {
        const zoom = Math.min(this.state.zoom * 2, 32);
        this.setState({
            ...this.state,
            zoom
        });
    }

    /**
     * Change the zoom of the client, Decrease zoom, get farther to see larger detail.
     * @private
     */
    private decrementZoom() {
        const zoom = Math.max(this.state.zoom / 2, 1);
        this.setState({
            ...this.state,
            zoom
        });
    }

    /**
     * Update the voronoi data which will update the political map. This function can be costly, running this too many
     * times a second will lag the game, just to draw colored shapes on screen.
     */
    refreshVoronoiData() {
        let position = this.getPlayerShip().position.rotateVector([0, 0, 1]);
        position[1] = -position[1];

        switch (this.state.voronoiMode) {
            default:
            case EVoronoiMode.KINGDOM: {
                this.voronoiData = this.game.voronoiTerrain.kingdoms.reduce((acc, k, index) => {
                    if (k.isNearBy(position)) {
                        return [
                            ...acc, {
                                id: `kingdom-${index}`,
                                voronoi: k.voronoiCell
                            }
                        ];
                    } else {
                        return acc;
                    }
                }, [] as Array<{
                    id: string,
                    voronoi: VoronoiCell
                }>);
                break;
            }
            case EVoronoiMode.DUCHY: {
                this.voronoiData = this.game.voronoiTerrain.kingdoms.reduce((acc, k, index) => {
                    if (k.isNearBy(position)) {
                        return [
                            ...acc, ...k.duchies.map((d, index2) => ({
                                id: `kingdom-${index}-dutchy-${index2}`,
                                voronoi: d.voronoiCell
                            }))
                        ];
                    } else {
                        return acc;
                    }
                }, [] as Array<{
                    id: string,
                    voronoi: VoronoiCell
                }>);
                break;
            }
            case EVoronoiMode.COUNTY: {
                this.voronoiData = this.game.voronoiTerrain.kingdoms.reduce((acc, k, index) => {
                    if (k.isNearBy(position)) {
                        return [
                            ...acc, ...k.duchies.reduce((acc2, d, index2) => [
                                ...acc2, ...d.counties.map((c, index3) => ({
                                    id: `kingdom-${index}-dutchy-${index2}-county-${index3}`,
                                    voronoi: c.voronoiCell
                                }))
                            ], [] as Array<{
                                id: string,
                                voronoi: VoronoiCell
                            }>)
                        ];
                    } else {
                        return acc;
                    }
                }, [] as Array<{
                    id: string,
                    voronoi: VoronoiCell
                }>);
                break;
            }
        }
    }

    /**
     * Perform the initialization of the game.
     */
    componentDidMount() {
        // add renderer
        if (this.showAppBodyRef.current) {
            this.showAppBodyRef.current.appendChild(this.application.view);
        }

        // handle keyboard input
        if (!this.props.isTestMode) {
            this.rotateCameraInterval = setInterval(this.gameLoop.bind(this), 30);
        }
        this.keyDownHandlerInstance = this.handleKeyDown.bind(this);
        this.keyUpHandlerInstance = this.handleKeyUp.bind(this);
        document.addEventListener("keydown", this.keyDownHandlerInstance);
        document.addEventListener("keyup", this.keyUpHandlerInstance);
    }

    componentWillUnmount() {
        // clean up renderer
        if (this.showAppBodyRef.current) {
            this.showAppBodyRef.current.removeChild(this.application.view);
        }

        // clean up game stuff
        if (this.rotateCameraInterval) {
            clearInterval(this.rotateCameraInterval);
        }
        document.removeEventListener("keydown", this.keyDownHandlerInstance);
        document.removeEventListener("keyup", this.keyUpHandlerInstance);
        this.music.stop();
    }

    handleSvgClick(event: React.MouseEvent) {
        // get element coordinates
        if (!this.svgRef.current) {
            return;
        }
        const node = this.svgRef.current;
        const bounds = node.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;

        // if inside bounds of the play area
        const size = Math.min(this.state.width, this.state.height);
        if (x >= 0 && x <= size && y >= 0 && y <= size) {
            const clickScreenPoint: [number, number, number] = [
                ((x / size) - 0.5) * 2 / (this.state.zoom * this.game.worldScale),
                ((y / size) - 0.5) * 2 / (this.state.zoom * this.game.worldScale),
                0
            ];
            clickScreenPoint[1] *= -1;
            clickScreenPoint[2] = Math.sqrt(1 - Math.pow(clickScreenPoint[0], 2) - Math.pow(clickScreenPoint[1], 2));

            // compute sphere position
            // const clickQuaternion = Quaternion.fromBetweenVectors([0, 0, 1], clickScreenPoint);
            // const ship = this.getPlayerShip();
            // const spherePoint = ship.position.clone()
            //     .mul(ship.orientation.clone())
            //     .mul(clickQuaternion)
            //     .rotateVector([0, 0, 1]);
        }
    }

    private renderGameControls() {
        return (
            <g key="game-controls">
                <text x="0" y="30" fill="white">Zoom</text>
                <rect x="0" y="45" width="20" height="20" fill="grey" onClick={this.decrementZoom.bind(this)}/>
                <text x="25" y="60" textAnchor="center" fill="white">{(this.state.zoom * this.game.worldScale)}</text>
                <rect x="40" y="45" width="20" height="20" fill="grey" onClick={this.incrementZoom.bind(this)}/>
                <text x="5" y="60" onClick={this.decrementZoom.bind(this)}>-</text>
                <text x="40" y="60" onClick={this.incrementZoom.bind(this)}>+</text>
                {
                    this.findPlayerShip() && (
                        <>
                            <rect key="return-to-menu-rect" x="5" y="75" width="50" height="20" fill="red" onClick={this.returnToMainMenu.bind(this)}/>
                            <text key="return-to-menu-text" x="10" y="90" fill="white" onClick={this.returnToMainMenu.bind(this)}>Leave</text>
                        </>
                    )
                }
            </g>
        );
    }

    private renderGameStatus() {
        const playerShip = this.findPlayerShip();
        const numPathingNodes = playerShip && playerShip.pathFinding.points.length;
        const distanceToNode = playerShip && playerShip.pathFinding.points.length > 0 ?
            VoronoiGraph.angularDistance(
                playerShip.position.rotateVector([0, 0, 1]),
                playerShip.pathFinding.points[0],
                this.game.worldScale
            ) :
            0;

        const order = playerShip && playerShip.orders[0];
        const orderType = order ? order.orderType : "NONE";

        if (numPathingNodes) {
            return (
                <g key="game-status" transform={`translate(${this.state.width - 80},0)`}>
                    <text x="0" y="30" fontSize={8} color="black">Node{numPathingNodes > 1 ? "s" : ""}: {numPathingNodes}</text>
                    <text x="0" y="45" fontSize={8} color="black">Distance: {Math.round(distanceToNode * 100000 / Math.PI) / 100}</text>
                    <text x="0" y="60" fontSize={8} color="black">Order: {orderType}</text>
                </g>
            );
        } else {
            return null;
        }
    }

    private renderCargoStatus() {
        const playerShip = this.findPlayerShip();
        if (playerShip) {
            const shipType = playerShip.shipType;
            const shipData = SHIP_DATA.find(s => s.shipType === shipType);
            if (!shipData) {
                throw new Error("Could not find ship type");
            }

            const cargoSlotSize = Math.min(50, this.state.width / shipData.cargoSize);
            const cargos = playerShip.cargo;
            const cargoSize = shipData.cargoSize;
            return (
                <g key="cargo-status" transform={`translate(${this.state.width / 2},${this.state.height - 50})`}>
                    {
                        new Array(shipData.cargoSize).fill(0).map((v, i) => {
                            const cargo = cargos[i];
                            if (cargo) {
                                return (
                                    <g key={`cargo-slot-${i}`} transform={`translate(${cargoSlotSize * (i - cargoSize / 2 + 0.5)},0)`}>
                                        <g transform={`scale(0.5)`}>
                                            {this.renderItem(cargo.resourceType)}
                                        </g>
                                        <rect x={-25} y={-25} width={50} height={50} fill="none" stroke="grey" strokeWidth={3}/>
                                    </g>
                                );
                            } else {
                                return (
                                    <g key={`cargo-slot-${i}`} transform={`translate(${cargoSlotSize * (i - cargoSize / 2 + 0.5)},0)`}>
                                        <rect x={-25} y={-25} width={50} height={50} fill="none" stroke="grey" strokeWidth={3}/>
                                    </g>
                                );
                            }
                        })
                    }
                </g>
            );
        } else {
            return null;
        }
    }

    private renderFactionStatus() {
        const planet = this.getPlayerPlanet();
        const faction = planet?.county?.faction;
        if (faction) {
            return (
                <g key="faction-status" transform={`translate(${this.state.width - 80},${this.state.height - 80})`}>
                    <text x="0" y="30" fontSize={8} color="black">Faction: {faction.id}</text>
                    <text x="0" y="45" fontSize={8} color="black">Gold: {planet && planet.moneyAccount ? planet.moneyAccount.cash.getGold() : "N/A"}</text>
                    <text x="0" y="60" fontSize={8} color="black">Planet{faction.planetIds.length > 1 ? "s" : ""}: {faction.planetIds.length}</text>
                    <text x="0" y="75" fontSize={8} color="black">Ship{faction.shipIds.length > 1 ? "s" : ""}: {faction.shipIds.length}</text>
                </g>
            );
        } else {
            return null;
        }
    }

    private renderPlayerStatus() {
        const player = this.findPlayer();
        if (player) {
            const moneyAccount = MoneyAccount.deserialize(player.moneyAccount as any);
            return (
                <g key="player-status" transform={`translate(0,${this.state.height - 80})`}>
                    <text x="0" y="45" fontSize={8} color="black">Gold: {moneyAccount.getGold()}</text>
                </g>
            );
        } else {
            return null;
        }
    }

    public selectFaction(faction: EFaction) {
        this.setState({
            faction,
            showSpawnMenu: false,
            showPlanetMenu: true,
            showMainMenu: false,
            showLoginMenu: false,
        }, () => {
            if (this.socket) {
                const message: IChooseFactionMessage = {
                    messageType: EMessageType.CHOOSE_FACTION,
                    factionId: faction
                };
                this.sendMessage("generic-message", message);
            }
        });
    }

    private handleUserName(e: React.ChangeEvent<HTMLInputElement>) {
        this.setState({userName: e.target.value});
    }

    private handleLogin() {
        this.sendMessage("join-game", {name: this.state.userName});
        this.sendMessage("get-world");
        if (this.state.audioEnabled) {
            this.music.start();
        }
    }

    private renderLoginMenu() {
        return (
            <div key="login-menu">
                <label>UserName
                    <input value={this.state.userName} onChange={this.handleUserName.bind(this)}/>
                </label>
                <button onClick={this.handleLogin.bind(this)}>Login</button>
            </div>
        );
    }

    private renderMainMenu() {
        return (
            <g key="main-menu">
                <text fontSize="28"
                      fill="white"
                      x={this.state.width / 2}
                      y={this.state.height / 2 - 14}
                      textAnchor="middle">
                    Globular Marauders
                </text>
                {
                    [{
                        faction: EFaction.DUTCH,
                        text: "Dutch"
                    }, {
                        faction: EFaction.ENGLISH,
                        text: "English"
                    }, {
                        faction: EFaction.FRENCH,
                        text: "French"
                    }, {
                        faction: EFaction.PORTUGUESE,
                        text: "Portuguese"
                    }, {
                        faction: EFaction.SPANISH,
                        text: "Spanish"
                    }].map(({faction, text}, index) => {
                        const x = this.state.width / 5 * (index + 0.5);
                        const y = this.state.height / 2 + 50;
                        const width = (this.state.width / 5) - 20;
                        const height = 40;
                        return (
                            <>
                                <rect key={`${text}-rect`}
                                      stroke="white"
                                      fill="transparent"
                                      x={x - width / 2}
                                      y={y - 20}
                                      width={width}
                                      height={height}
                                      onClick={this.selectFaction.bind(this, faction)}
                                />
                                <text
                                    key={`${text}-text`}
                                    fill="white"
                                    x={x}
                                    y={y + 5}
                                    textAnchor="middle"
                                    onClick={this.selectFaction.bind(this, faction)}>
                                    {text}
                                </text>
                            </>
                        );
                    })
                }
            </g>
        );
    }

    public beginPickPlanet(planetId: string) {
        if (this.state.faction) {
            this.setState({
                showSpawnMenu: true,
                showPlanetMenu: false,
                showMainMenu: false,
                showLoginMenu: false,
            });
            const message: IChoosePlanetMessage = {
                messageType: EMessageType.CHOOSE_PLANET,
                planetId
            };
            if (this.socket) {
                this.sendMessage("generic-message", message);
            }
        } else {
            this.returnToFactionMenu();
        }
    }

    public returnToFactionMenu() {
        this.setState({
            showSpawnMenu: false,
            showPlanetMenu: false,
            showMainMenu: true,
            showLoginMenu: false,
            planetId: null,
        }, () => {
            if (this.socket) {
                const message: IChoosePlanetMessage = {
                    messageType: EMessageType.CHOOSE_PLANET,
                    planetId: null
                };
                this.sendMessage("generic-message", message);
            }
        });
    }

    private renderPlanetMenu() {
        const x = this.state.width / 3;
        const y = this.state.height / 2 + 50;
        const width = (this.state.width / 3) - 20;
        const height = 40;
        return (
            <g key="planet-menu">
                <text
                    fill="white"
                    fontSize="28"
                    x={this.state.width / 2}
                    y={this.state.height / 2 - 14 - 50}
                    textAnchor="middle"
                >{this.state.faction}</text>
                {
                    this.spawnPlanets.map((spawnPlanet, index) => {
                        return (
                            <>
                                <rect
                                    key={`${spawnPlanet.planetId}-spawn-planet-rect`}
                                    stroke="white"
                                    fill="white"
                                    x={x * (index + 0.5) - width / 2}
                                    y={y - 20 - 50}
                                    width={width}
                                    height={height + 50}
                                    style={{opacity: 0.3}}
                                    onClick={this.beginPickPlanet.bind(this, spawnPlanet.planetId)}
                                />
                                <text
                                    key={`${spawnPlanet.planetId}-spawn-planet-text`}
                                    fill="white"
                                    x={x * (index + 0.5)}
                                    y={y + 5}
                                    textAnchor="middle"
                                    onClick={this.beginPickPlanet.bind(this, spawnPlanet.planetId)}
                                >{spawnPlanet.planetId} ({spawnPlanet.numShipsAvailable} ships)</text>
                            </>
                        );
                    })
                }
                <rect
                    stroke="white"
                    fill="transparent"
                    x={x * 1.5 - width / 2}
                    y={y - 20 + height}
                    width={width}
                    height={height}
                    onClick={this.returnToMainMenu.bind(this)}
                />
                <text
                    fill="white"
                    x={x * 1.5}
                    y={y + 5 + height}
                    textAnchor="middle"
                    onClick={this.returnToMainMenu.bind(this)}
                >Back</text>
            </g>
        );
    }

    public beginSpawnShip(planetId: string, shipType: EShipType) {
        if (this.state.faction) {
            this.setState({
                showSpawnMenu: false,
                showPlanetMenu: false,
                showMainMenu: false,
                showLoginMenu: false,
            });
            const message: ISpawnMessage = {
                messageType: EMessageType.SPAWN,
                shipType,
                planetId
            };
            if (this.socket) {
                this.sendMessage("generic-message", message);
            }
        } else {
            this.returnToPlanetMenu();
        }
    }

    public returnToPlanetMenu() {
        this.setState({
            showSpawnMenu: false,
            showPlanetMenu: true,
            showMainMenu: false,
            showLoginMenu: false,
            planetId: null,
        }, () => {
            if (this.socket) {
                const message: IChoosePlanetMessage = {
                    messageType: EMessageType.CHOOSE_PLANET,
                    planetId: null
                };
                this.sendMessage("generic-message", message);
            }
        });
    }

    public returnToMainMenu() {
        this.setState({
            showSpawnMenu: false,
            showPlanetMenu: false,
            showMainMenu: true,
            showLoginMenu: false,
            faction: null,
            planetId: null,
        }, () => {
            if (this.socket) {
                const message: IChooseFactionMessage = {
                    messageType: EMessageType.CHOOSE_FACTION,
                    factionId: null
                };
                this.sendMessage("generic-message", message);
            }
        });
    }

    private renderSpawnMenu() {
        const x = this.state.width / 3;
        const y = this.state.height / 2 + 50;
        const width = (this.state.width / 3) - 20;
        const height = 40;
        return (
            <g key="spawn-menu">
                <text
                    fill="white"
                    fontSize="28"
                    x={this.state.width / 2}
                    y={this.state.height / 2 - 14 - 50}
                    textAnchor="middle"
                >{this.state.faction}</text>
                {
                    this.spawnLocations.map((spawnLocation, index) => {
                        return (
                            <>
                                <rect
                                    key={`${spawnLocation.id}-spawn-location-rect`}
                                    stroke="white"
                                    fill="white"
                                    x={x * (index + 0.5) - width / 2}
                                    y={y - 20 - 50}
                                    width={width}
                                    height={height + 50}
                                    style={{opacity: 0.3}}
                                    onClick={this.beginSpawnShip.bind(this, spawnLocation.id, spawnLocation.shipType)}
                                />
                                {
                                    <g
                                        key={`${spawnLocation.id}-ship`}
                                        transform={`translate(${x * (index + 0.5)},${y - 10 - 25})`}
                                        onClick={this.beginSpawnShip.bind(this, spawnLocation.id, spawnLocation.shipType)}
                                    >
                                        {
                                            this.renderShip(this.getShowShipDrawing(
                                                `${spawnLocation.id}-spawn-location-ship`,
                                                spawnLocation.shipType,
                                                this.state.faction
                                            ), 1)
                                        }
                                    </g>
                                }
                                <text
                                    key={`${spawnLocation.id}-spawn-location-text`}
                                    fill="white"
                                    x={x * (index + 0.5)}
                                    y={y + 5}
                                    textAnchor="middle"
                                    onClick={this.beginSpawnShip.bind(this, spawnLocation.id, spawnLocation.shipType)}
                                >{spawnLocation.shipType} {spawnLocation.price}gp</text>
                            </>
                        );
                    })
                }
                <rect
                    stroke="white"
                    fill="transparent"
                    x={x * 1.5 - width / 2}
                    y={y - 20 + height}
                    width={width}
                    height={height}
                    onClick={this.returnToPlanetMenu.bind(this)}
                />
                <text
                    fill="white"
                    x={x * 1.5}
                    y={y + 5 + height}
                    textAnchor="middle"
                    onClick={this.returnToPlanetMenu.bind(this)}
                >Back</text>
            </g>
        );
    }

    getShowShipDrawing(id: string, shipType: EShipType, factionType: EFaction | null = null): IDrawable<Ship> {
        const original: Ship = new Ship(this.game, shipType);
        original.id = id;
        if (factionType) {
            const faction = Object.values(this.game.factions).find(f => f.id === factionType);
            if (faction) {
                original.color = faction.factionColor;
            }
        }
        return this.convertToDrawable("draw-ships", 1, this.rotatePlanet(original));
    }

    renderItem(resourceType: EResourceType) {
        const item = RESOURCE_TYPE_TEXTURE_PAIRS.find(i => i.resourceType === resourceType);
        if (item) {
            return <img src={item.url} width={100} height={100} alt={item.name}/>;
        } else {
            return <img src={DEFAULT_IMAGE} width={100} height={100} alt="missing"/>;
        }
    }

    render() {
        return (
            <div className="App">
                <div style={{display: "flex", justifyContent: "space-evenly"}}>
                    <div style={{display: "inline-block", background: "lightskyblue"}}>
                        <label>
                            <input type="checkbox" tabIndex={-1} ref={this.showNotesRef} checked={this.state.showNotes} onChange={this.handleShowNotes.bind(this)}/>
                            <span>Show Notes</span>
                        </label>
                    </div>
                    <div style={{display: "inline-block", background: "lightskyblue"}}>
                        <label>
                            <input type="checkbox" tabIndex={-1} ref={this.showShipsRef} checked={this.state.showShips} onChange={this.handleShowShips.bind(this)}/>
                            <span>Show Ships</span>
                        </label>
                    </div>
                    <div style={{display: "inline-block", background: "lightskyblue"}}>
                        <label>
                            <input type="checkbox" tabIndex={-1} ref={this.showItemsRef} checked={this.state.showItems} onChange={this.handleShowItems.bind(this)}/>
                            <span>Show Items</span>
                        </label>
                    </div>
                    <div style={{display: "inline-block", background: "lightskyblue"}}>
                        <label>
                            <input type="checkbox" tabIndex={-1} ref={this.showVoronoiRef} checked={this.state.showVoronoi} onChange={this.handleShowVoronoi.bind(this)}/>
                            <span>Show Voronoi</span>
                        </label>
                        <g key="voronoi-mode-radio-group">
                            <label>
                                <input type="radio" tabIndex={-1} checked={this.state.voronoiMode === EVoronoiMode.KINGDOM} onChange={this.handleChangeVoronoi.bind(this, EVoronoiMode.KINGDOM)}/>
                                <span>Kingdom</span>
                            </label>
                            <label>
                                <input type="radio" tabIndex={-1} checked={this.state.voronoiMode === EVoronoiMode.DUCHY} onChange={this.handleChangeVoronoi.bind(this, EVoronoiMode.DUCHY)}/>
                                <span>Duchy</span>
                            </label>
                            <label>
                                <input type="radio" tabIndex={-1} checked={this.state.voronoiMode === EVoronoiMode.COUNTY} onChange={this.handleChangeVoronoi.bind(this, EVoronoiMode.COUNTY)}/>
                                <span>County</span>
                            </label>
                        </g>
                    </div>
                    <div style={{display: "inline-block", background: "lightskyblue"}}>
                        <label>
                            <input type="checkbox" tabIndex={-1} ref={this.autoPilotEnabledRef} checked={this.state.autoPilotEnabled} onChange={this.handleAutoPilotEnabled.bind(this)}/>
                            <span>AutoPilot Enabled</span>
                        </label>
                    </div>
                    <div style={{display: "inline-block", background: "lightskyblue"}}>
                        <label>
                            <input type="checkbox" tabIndex={-1} ref={this.audioEnabledRef} checked={this.state.audioEnabled} onChange={this.handleAudioEnabled.bind(this)}/>
                            <span>Audio Enabled</span>
                        </label>
                    </div>
                </div>
                {
                    this.state.showNotes && (
                        <ul>
                            <li>Started 3/28/2021</li>
                            <li>Create 3d sphere world which has different planets. -- DONE 3/28/2021</li>
                            <li>Project 3d world onto a small area for viewing, yet still able to navigate in a circle like a 3d sphere. -- DONE 3/28/2021</li>
                            <li>Create camera system centered around a small ship. Rotating will rotate camera/world. -- DONE 3/30/2021</li>
                            <li>Add projectiles or cannon balls and small frictionless motion in space. -- DONE 4/17/2021</li>
                            <li>Add gravity around planets.</li>
                            <li>Improve random distribution of planets using Voronoi and Lloyd Relaxation. -- DONE 4/17/2021</li>
                            <li>Create factions which start from a home world and launch ships. - DONE 4/21/2021</li>
                            <li>Spawn settler ships to colonize other worlds. Each world has upto 3 resources. DONE 4/21/2021</li>
                            <li>Spawn merchant ships to trade with colonies. Trading is simplified flying between A and B. DONE 4/21/2021</li>
                            <li>Add economics, price rising and falling based on supply and demand, traders will try to go towards important colonies. DONE 4/21/2021</li>
                            <li>Add ship building economy for each planet. DONE 4/24/2021</li>
                            <li>Planets will sell ships using dutch auction, 50% will go to faction as tax, 50% will go to island renovation. DONE 4/24/2021</li>
                            <li>Make cannon balls damage merchant ships. -- DONE 4/27/2021</li>
                            <li>Add ability to pirate merchants and raid colonies. -- DONE 4/30/2021</li>
                            <li>Add ability for AI to aim at player. -- DONE 5/1/2021</li>
                            <li>Add AI pirates. -- DONE 5/9/2021</li>
                            <li>Construction and upgrade of buildings in capitals and colonies. -- DONE 5/15/2021</li>
                            <li>Fix Delaunay and Voronoi. -- DONE 5/26/2021</li>
                            <li>Add nested delaunay and nested voronoi. -- DONE 5/28/2021</li>
                            <li>Add Imperial/Colonial empire design, the capital will upgrade certain locations into high level planets. -- DONE 5/31/2021</li>
                            <li>Add Feudal tribute and Feudal offers to move ships to where they're needed. -- DONE 5/31/2021</li>
                            <li>Add Feudal resource trading where planets will spoke and wheel resources back to the emperor.</li>
                            <li>Add Feudal taxes where planets will pay taxes to the capital.</li>
                            <li>Pirate hunters. Ships will report the position of pirates and the local ruler will send or request a ship to patrol the area.</li>
                            <li>Factions will plan invasions of enemy colonies and capitals.</li>
                            <li>Create a flotilla of boats to attack an area.</li>
                            <li>Sitting on a planet with no enemies for 30 seconds will capture it.</li>
                            <li>3 minutes of no reinforcements will confirm the capture.</li>
                            <li>10 or 15 minute battles to capture as many planets within a kingdom or duchy as possible.</li>
                            <li>Compute new nobility after each battle.</li>
                            <li>Add multiplayer... (1 month)
                                <ol>
                                    <li>Break game into client and server.</li>
                                    <li>Create bot clients based on bot code, copied into client.</li>
                                    <li>Test number of bots on single process server before lagging.</li>
                                    <li>Create multi process servers which divide each kingdom (1 out of 20 voronoi cells) into a process.</li>
                                    <li>Test number of bots on multi process server.</li>
                                    <li>Create code which can spawn multiple servers and release multiple servers.</li>
                                    <li>Create random match making via Website (1 server).</li>
                                    <li>Create infinite random match making via Website (automatic generated servers).</li>
                                </ol>
                            </li>
                            <li>Play Styles:
                                <ul>
                                    <li>Pirate/Marauder will attack kingdoms and other pirates.</li>
                                    <li>Bounty Hunter will find pirates in the outskirts of the trade empire.</li>
                                    <li>Warship will attach kingdoms in large battles over colonies and capitals.</li>
                                </ul>
                            </li>
                            <li>
                                Places:
                                <ul>
                                    <li>Capitals: Home of a kingdom.</li>
                                    <li>Colony: New world island which makes money and repairs ships.</li>
                                    <li>Undiscovered Islands: Locations to build colonies.</li>
                                </ul>
                            </li>
                            <li>
                                Ships:
                                <ul>
                                    <li>Settler: Colonize</li>
                                    <li>Merchant: Trade</li>
                                    <li>Warship: Attack</li>
                                </ul>
                            </li>
                            <li>Make multiple rooms/worlds for large amounts of players.</li>
                        </ul>
                    )
                }
                {
                    this.state.showShips && (
                        <ul>
                            {
                                SHIP_DATA.map(ship => {
                                    return (
                                        <svg key={`show-ship-${ship.shipType}`} width="100" height="100">
                                            <g transform="translate(50, 50)">
                                                {
                                                    this.renderShip(this.getShowShipDrawing(ship.shipType, ship.shipType), 1)
                                                }
                                            </g>
                                        </svg>
                                    );
                                })
                            }
                        </ul>
                    )
                }
                {
                    this.state.showItems && (
                        <ul>
                            {
                                ITEM_DATA.map(item => {
                                    return (
                                        <div key={`show-item-${item.resourceType}`} style={{display: "inline-block"}}>
                                            {
                                                this.renderItem(item.resourceType)
                                            }
                                            <br/>
                                            {item.resourceType}
                                        </div>
                                    );
                                })
                            }
                        </ul>
                    )
                }
                {this.state.showLoginMenu ? this.renderLoginMenu.call(this) : null}
                <div style={{width: "100%", height: this.state.height}}>
                    <div style={{position: "absolute", padding: "0px auto", width: "100%"}} ref={this.showAppBodyRef}/>
                    {
                        this.state.showLoginMenu ? null : (
                            <div style={{position: "absolute", padding: "0px auto", width: "100%"}}>
                                <svg ref={this.svgRef} width={this.state.width} height={this.state.height}>
                                    <defs>
                                        <mask id="worldMask">
                                            <circle
                                                cx={this.state.width * 0.5}
                                                cy={this.state.height * 0.5}
                                                r={Math.min(this.state.width, this.state.height) * 0.5}
                                                fill="white"
                                            />
                                        </mask>
                                    </defs>
                                    <g mask="url(#worldMask)" onClick={this.handleSvgClick.bind(this)}>
                                        {
                                            this.state.showMainMenu ? this.renderMainMenu.call(this) : null
                                        }
                                        {
                                            this.state.showPlanetMenu ? this.renderPlanetMenu.call(this) : null
                                        }
                                        {
                                            this.state.showSpawnMenu ? this.renderSpawnMenu.call(this) : null
                                        }
                                    </g>
                                    {
                                        this.renderGameControls()
                                    }
                                    {
                                        this.renderGameStatus()
                                    }
                                    {
                                        this.renderCargoStatus()
                                    }
                                    {
                                        this.renderFactionStatus()
                                    }
                                    {
                                        this.renderPlayerStatus()
                                    }
                                </svg>
                            </div>
                        )
                    }
                </div>
            </div>
        );
    }
}

export default App;
