import React from 'react';
import './App.css';
import Quaternion from "quaternion";
import * as Tone from "tone";
import SockJS from "sockjs-client";
import {EResourceType, ITEM_DATA} from "@pickledeggs123/globular-marauders-game/lib/src/Resource";
import {
    ESettlementLevel,
    ICameraState,
    ICameraStateWithOriginal,
    IDrawable,
    IExpirable,
    MIN_DISTANCE, MoneyAccount
} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import {EFaction, EShipType, Ship, SHIP_DATA} from "@pickledeggs123/globular-marauders-game/lib/src/Ship";
import {
    DelaunayGraph,
    DelaunayTile,
    IDrawableTile,
    ITessellatedTriangle,
    VoronoiCell,
    VoronoiGraph
} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";
import {EBuildingType, Manufactory, Planet, Plantation} from "@pickledeggs123/globular-marauders-game/lib/src/Planet";
import {Crate, SmokeCloud} from "@pickledeggs123/globular-marauders-game/lib/src/Item";
import {
    EMessageType,
    Game,
    IAutoPilotMessage,
    IChooseFactionMessage,
    IChoosePlanetMessage,
    IKeyboardMessage,
    IMessage, IPlayerData,
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
    showMainMenu: boolean;
    showPlanetMenu: boolean;
    showSpawnMenu: boolean;
    faction: EFaction | null;
    planetId: string | null;
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
        audioEnabled: false as boolean,
        faction: null as EFaction | null,
        planetId: null as string | null,
        showMainMenu: true as boolean,
        showPlanetMenu: false as boolean,
        showSpawnMenu: false as boolean,
    };

    // ui ref
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
    public voronoiData: VoronoiCell[] = [];
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

    public sendMessage(event: string, message: any = undefined) {
        this.socket.send(JSON.stringify({
            event,
            message
        }));
    }

    constructor(props: IAppProps) {
        super(props);

        this.socket = new SockJS("/game");
        this.socket.onopen = () => {
            this.sendMessage("get-world");
        };
        this.socket.onerror = (err) => {
            console.log("Failed to connect", err);
        };
        this.socket.onmessage = (message) => {
            let data: {event: string, message: any} | null = null;
            try {
                data = JSON.parse(message.data) as {event: string, message: any};
            } catch {}
            if (data) {
                const matchingHandler = this.socketEvents[data.event];
                if (matchingHandler) {
                    matchingHandler(data.message);
                }
            }
        };
        this.socketEvents["send-world"] = (data) => {
            this.game.applyGameInitializationFrame(data);
            this.initialized = true;
            this.sendMessage("init-loop");
        };
        this.socketEvents["send-frame"] = (data) => {
            this.game.applyGameSyncFrame(data);
            //this.game.resetClientLoop();
            this.resetClientLoop();
        };
        this.socketEvents["send-players"] = (data) => {
            this.game.playerData = data.players;
            this.playerId = data.playerId;
        };
        this.socketEvents["generic-message"] = (data) => {
            this.messages.push(data);
        };
        this.socketEvents["send-spawn-planets"] = (data) => {
            this.spawnPlanets = data;
        };
        this.socketEvents["send-spawn-locations"] = (data) => {
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
     * Draw a star onto the screen.
     * @param planetDrawing
     * @private
     */
    private drawStar(planetDrawing: IDrawable<Planet>) {
        const isReverseSide = planetDrawing.rotatedPosition[2] > 0;
        const x = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).x + 1) * 0.5;
        const y = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).y + 1) * 0.5;
        const distance = planetDrawing.distance;
        const size = 0.1 * Math.max(0, 2 * Math.atan((planetDrawing.original.size || 1) / (2 * distance)));
        return (
            <g key={planetDrawing.id}>
                <circle
                    cx={x * this.state.width}
                    cy={(1 - y) * this.state.height}
                    r={size * (this.state.zoom * this.game.worldScale)}
                    fill={planetDrawing.color}
                    stroke="grey"
                    strokeWidth={0.2 * size * (this.state.zoom * this.game.worldScale)}
                    style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
                />
                <line
                    x1={(x + 0.01) * this.state.width}
                    y1={(1 - y) * this.state.height}
                    x2={(x - 0.01) * this.state.width}
                    y2={(1 - y) * this.state.height}
                    stroke={planetDrawing.color}
                    strokeWidth={0.2 * size * (this.state.zoom * this.game.worldScale)}
                    style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
                />
                <line
                    x1={x * this.state.width}
                    y1={(1 - y + 0.01) * this.state.height}
                    x2={x * this.state.width}
                    y2={(1 - y - 0.01) * this.state.height}
                    stroke={planetDrawing.color}
                    strokeWidth={0.2 * size * (this.state.zoom * this.game.worldScale)}
                    style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
                />
            </g>
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
     * Draw a physics hull.
     * @param planetDrawing
     * @private
     */
    private renderPhysicsHull(planetDrawing: IDrawable<Ship>) {
        // do not draw hulls on the other side of the world
        if (planetDrawing.rotatedPosition[2] < 0) {
            return null;
        }

        const shipData = SHIP_DATA.find(s => s.shipType === planetDrawing.original.shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }
        const hullPoints = shipData.hull;

        const hullQuaternions = Game.getPhysicsHull(hullPoints, this.game.worldScale);
        const rotatedHullQuaternion = hullQuaternions.map((q): Quaternion => {
            return planetDrawing.position.clone()
                .mul(q);
        });
        const rotatedHullPoints = rotatedHullQuaternion.map((q): [number, number] => {
            const point = q.rotateVector([0, 0, 1]);
            return [point[0], point[1]]
        });

        return (
            <polygon
                key={`${planetDrawing.id}-physics-hull`}
                points={rotatedHullPoints.map(([x, y]) => `${(x * (this.state.zoom * this.game.worldScale) + 1) * 0.5 * this.state.width},${(1 - (y * (this.state.zoom * this.game.worldScale) + 1) * 0.5) * this.state.height}`).join(" ")}
                fill="white"
                stroke="cyan"
                opacity={0.5}
            />
        );
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
     * Draw a ship into the game world.
     * @param planetDrawing
     * @private
     */
    private drawShip(planetDrawing: IDrawable<Ship>) {
        const shipData = SHIP_DATA.find(s => s.shipType === planetDrawing.original.shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }

        const playerData = this.game.playerData.find(p => p.shipId === planetDrawing.original.id) || null;

        const isReverseSide = planetDrawing.rotatedPosition[2] > 0;
        const x = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).x + 1) * 0.5;
        const y = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).y + 1) * 0.5;
        const distance = planetDrawing.distance;
        const size = 0.1 * Math.max(0, 2 * Math.atan(1 / (2 * distance)));
        const scale = size * (this.state.zoom * this.game.worldScale);

        // handle UI lines
        let velocityX: number = 0;
        let velocityY: number = 0;
        let targetLineData: ITargetLineData | null = null;
        const isPlayerShip = planetDrawing.original.id === this.getPlayerShip().id;
        if (isPlayerShip) {
            // handle velocity line
            let velocityPoint = planetDrawing.positionVelocity.clone()
                .rotateVector([0, 0, 1]);
            velocityPoint[2] = 0;
            velocityPoint = DelaunayGraph.normalize(velocityPoint);
            velocityX = velocityPoint[0];
            velocityY = velocityPoint[1];

            targetLineData = App.getShipTargetLines.call(this, planetDrawing);
        }
        const rightCannonPointTop: [number, number] = [
            Math.max(this.state.width / 2, this.state.height / 2) * Math.cos((10 / 180 * Math.PI)) * (this.state.zoom * this.game.worldScale),
            Math.max(this.state.width / 2, this.state.height / 2) * Math.sin((10 / 180 * Math.PI)) * (this.state.zoom * this.game.worldScale),
        ]
        const rightCannonPointBottom: [number, number] = [
            Math.max(this.state.width / 2, this.state.height / 2) * Math.cos(-(10 / 180 * Math.PI)) * (this.state.zoom * this.game.worldScale),
            Math.max(this.state.width / 2, this.state.height / 2) * Math.sin(-(10 / 180 * Math.PI)) * (this.state.zoom * this.game.worldScale),
        ];
        const leftCannonPointTop: [number, number] = [
            Math.max(this.state.width / 2, this.state.height / 2) * Math.cos(Math.PI - (10 / 180 * Math.PI)) * (this.state.zoom * this.game.worldScale),
            Math.max(this.state.width / 2, this.state.height / 2) * Math.sin(Math.PI - (10 / 180 * Math.PI)) * (this.state.zoom * this.game.worldScale),
        ]
        const leftCannonPointBottom: [number, number] = [
            Math.max(this.state.width / 2, this.state.height / 2) * Math.cos(Math.PI + (10 / 180 * Math.PI)) * (this.state.zoom * this.game.worldScale),
            Math.max(this.state.width / 2, this.state.height / 2) * Math.sin(Math.PI + (10 / 180 * Math.PI)) * (this.state.zoom * this.game.worldScale),
        ];
        let cannonLoadingPercentage = 0;
        if (isPlayerShip && planetDrawing.original.cannonLoading) {
            cannonLoadingPercentage = (Date.now() - +planetDrawing.original.cannonLoading) / 3000;
        }
        return (
            <g key={planetDrawing.id} transform={`translate(${x * this.state.width},${(1 - y) * this.state.height})`}>
                {
                    isPlayerShip && !isNaN(velocityX) && !isNaN(velocityY) && (
                        <line
                            key="velocity-line"
                            x1={0}
                            y1={0}
                            x2={this.state.width * 0.5 * velocityX}
                            y2={this.state.height * 0.5 * -velocityY}
                            stroke="white"
                            strokeWidth={2}
                            strokeDasharray="1,5"
                        />
                    )
                }
                {
                    isPlayerShip && targetLineData && targetLineData.targetLines.map(([a, b], index) => {
                        return (
                            <line
                                key={`target-line-${index}`}
                                x1={this.state.width * a[0] * (this.state.zoom * this.game.worldScale)}
                                y1={this.state.height * -a[1] * (this.state.zoom * this.game.worldScale)}
                                x2={this.state.width * b[0] * (this.state.zoom * this.game.worldScale)}
                                y2={this.state.height * -b[1] * (this.state.zoom * this.game.worldScale)}
                                stroke="blue"
                                strokeWidth={2}
                                strokeDasharray="1,5"
                            />
                        );
                    })
                }
                {
                    isPlayerShip && targetLineData && targetLineData.targetNodes.map(([a, value]) => {
                        return (
                            <>
                                <circle
                                    key={`target-marker-${value}`}
                                    r={10}
                                    cx={this.state.width * a[0] * (this.state.zoom * this.game.worldScale)}
                                    cy={this.state.height * -a[1] * (this.state.zoom * this.game.worldScale)}
                                    stroke="blue"
                                    fill="none"
                                />
                                <text
                                    key={`target-value-${value}`}
                                    textAnchor="middle"
                                    x={this.state.width * a[0] * (this.state.zoom * this.game.worldScale)}
                                    y={this.state.height * -a[1] * (this.state.zoom * this.game.worldScale) + 5}
                                    stroke="blue"
                                    fill="none"
                                >{value}</text>
                            </>
                        );
                    })
                }
                <g transform={`rotate(${planetDrawing.rotation}) scale(${scale})`}>
                    {
                        this.renderShip(planetDrawing, size)
                    }
                    <polyline
                        key={`${planetDrawing.id}-health`}
                        fill="none"
                        stroke="green"
                        strokeWidth={5}
                        points={`${this.getPointsOfAngularProgress.call(
                            this, planetDrawing.original.health / planetDrawing.original.maxHealth,
                            shipData.hull[0][1] * 3 + 5
                        )}`}
                    />
                    {
                        isPlayerShip && planetDrawing.original.cannonLoading && (
                            <>
                                <polygon
                                    points={`10,-20 ${rightCannonPointBottom[0]},${rightCannonPointBottom[1]} ${rightCannonPointTop[0]},${rightCannonPointTop[1]} 10,20`}
                                    fill="grey"
                                    stroke="white"
                                    strokeWidth={0.05 * size * (this.state.zoom * this.game.worldScale)}
                                    style={{opacity: 0.3}}
                                />
                                <polygon
                                    points={`-10,-20 ${leftCannonPointBottom[0]},${leftCannonPointBottom[1]} ${leftCannonPointTop[0]},${leftCannonPointTop[1]} -10,20`}
                                    fill="grey"
                                    stroke="white"
                                    strokeWidth={0.05 * size * (this.state.zoom * this.game.worldScale)}
                                    style={{opacity: 0.3}}
                                />
                                <polygon
                                    points={`10,-20 ${rightCannonPointBottom[0] * cannonLoadingPercentage},${rightCannonPointBottom[1] * cannonLoadingPercentage} ${rightCannonPointTop[0] * cannonLoadingPercentage},${rightCannonPointTop[1] * cannonLoadingPercentage} 10,20`}
                                    fill="white"
                                    style={{opacity: 0.3}}
                                />
                                <polygon
                                    points={`-10,-20 ${leftCannonPointBottom[0] * cannonLoadingPercentage},${leftCannonPointBottom[1] * cannonLoadingPercentage} ${leftCannonPointTop[0] * cannonLoadingPercentage},${leftCannonPointTop[1] * cannonLoadingPercentage} -10,20`}
                                    fill="white"
                                    style={{opacity: 0.3}}
                                />
                            </>
                        )
                    }
                </g>
                {
                    playerData ? (
                        <g>
                            <text x={0} y={this.state.height > 0.5 ? -20 : 10} fill="white" textAnchor="middle">{playerData.id}</text>
                        </g>
                    ) : null
                }
            </g>
        );
    }

    /**
     * Draw a smoke cloud from the space ship in the game world.
     * @param planetDrawing
     * @private
     */
    private drawSmokeCloud(planetDrawing: IDrawable<SmokeCloud>) {
        const isReverseSide = planetDrawing.rotatedPosition[2] > 0;
        const x = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).x + 1) * 0.5;
        const y = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).y + 1) * 0.5;
        const distance = planetDrawing.distance;
        const size = 0.1 * Math.max(0, 2 * Math.atan(planetDrawing.original.size / (2 * distance)));
        return (
            <circle
                key={planetDrawing.id}
                cx={x * this.state.width}
                cy={(1 - y) * this.state.height}
                r={size * (this.state.zoom * this.game.worldScale)}
                fill={planetDrawing.color}
                stroke="darkgray"
                strokeWidth={0.02 * size * (this.state.zoom * this.game.worldScale)}
                style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
            />
        );
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
     * Get the mid point of a delaunay tile.
     * @param tile
     * @private
     */
    private getDelaunayTileMidPoint(tile: DelaunayTile): {x: number, y: number} {
        const rotatedPoints = tile.vertices.map((v: Quaternion): [number, number, number] => {
            return v.rotateVector([0, 0, 1]);
        });
        const averagePoint = DelaunayGraph.normalize(Game.getAveragePoint(rotatedPoints));
        return {
            x: (averagePoint[0] * (this.state.zoom * this.game.worldScale) + 1) * 0.5,
            y: (averagePoint[1] * (this.state.zoom * this.game.worldScale) + 1) * 0.5,
        };
    }

    /**
     * Rotate a series of quaternion points.
     * @param vertices
     * @private
     */
    private getPointsAndRotatedPoints(vertices: Quaternion[]) {
        const rotatedPoints = vertices.map((v: Quaternion): [number, number, number] => {
            return v.rotateVector([0, 0, 1]);
        });
        const points: Array<{x: number, y: number}> = rotatedPoints.map(point => {
            return {
                x: (point[0] + 1) * 0.5,
                y: (point[1] + 1) * 0.5,
            };
        }).map(p => {
            return {
                x: (p.x - 0.5) * (this.state.zoom * this.game.worldScale) * 1.1 + 0.5,
                y: (p.y - 0.5) * (this.state.zoom * this.game.worldScale) * 1.1 + 0.5,
            };
        });

        return {
            points,
            rotatedPoints
        };
    }

    /**
     * Draw a delaunay tessellated triangle. Tessellated triangles are triangles recursively broken into smaller triangles
     * using the zelda pattern.
     * @param earthLike
     * @param tile
     * @param triangle
     * @param index
     * @param arr
     * @private
     */
    private drawDelaunayTessellatedTriangle(earthLike: boolean, tile: DelaunayTile, triangle: ITessellatedTriangle, index: number, arr: ITessellatedTriangle[]) {
        const {
            points,
            rotatedPoints
        } = this.getPointsAndRotatedPoints(triangle.vertices);

        // determine if the triangle is facing the camera, do not draw triangles facing away from the camera
        const triangleNormal = DelaunayGraph.crossProduct(
            DelaunayGraph.subtract(rotatedPoints[1], rotatedPoints[0]),
            DelaunayGraph.subtract(rotatedPoints[2], rotatedPoints[0]),
        );

        const triangleFacingCamera = DelaunayGraph.dotProduct([0, 0, 1], triangleNormal) > 0;

        // get a point position for the text box on the area
        let averageDrawingPoint: {x: number, y: number} | null = null;
        if (index === arr.length - 1 && triangleFacingCamera) {
            averageDrawingPoint = this.getDelaunayTileMidPoint(tile);
        }

        if (triangleFacingCamera) {
            return (
                <g key={`${tile.id}-${index}`}>
                    <polygon
                        points={points.map(p => `${p.x * this.state.width},${(1 - p.y) * this.state.height}`).join(" ")}
                        fill={tile.color}
                        stroke={!earthLike ? "white" : undefined}
                        strokeWidth={!earthLike ? 2 : 0}
                        style={{opacity: !earthLike ? 0.1 : 1}}
                    />
                    {
                        averageDrawingPoint && !earthLike && (
                            <text
                                x={averageDrawingPoint.x * this.state.width}
                                y={(1 - averageDrawingPoint.y) * this.state.height}
                                stroke="white"
                                style={{opacity: 0.1}}
                            >{tile.id}</text>
                        )
                    }
                </g>
            );
        } else {
            return null;
        }
    }

    /**
     * Draw a delaunay tile.
     * @param earthLike
     * @param tile
     * @private
     */
    private drawDelaunayTile(earthLike: boolean, tile: IDrawableTile) {
        const tessellationMesh = Array.from(this.game.getDelaunayTileTessellation(tile.centroid, tile.vertices));
        return (
            <g key={tile.id}>
                {
                    tessellationMesh.map(this.drawDelaunayTessellatedTriangle.bind(this, earthLike, tile))
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

            // remove smoke clouds for performance
            this.game.smokeClouds.splice(0, this.game.smokeClouds.length);
        }

        // draw onto screen
        //this.game.handleClientLoop();
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

            // send key down message to server
            const message: IKeyboardMessage = {
                messageType: EMessageType.KEYBOARD,
                key,
                enabled: true,
            };
            if (this.socket) {
                this.sendMessage("generic-message", message);
            }
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

            // send key up message to server
            const message: IKeyboardMessage = {
                messageType: EMessageType.KEYBOARD,
                key,
                enabled: false,
            };
            if (this.socket) {
                this.sendMessage("generic-message", message);
            }
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
        const position = this.getPlayerShip().position.rotateVector([0, 0, 1]);

        switch (this.state.voronoiMode) {
            default:
            case EVoronoiMode.KINGDOM: {
                this.voronoiData = this.game.voronoiTerrain.kingdoms.reduce((acc, k) => {
                    if (k.isNearBy(position)) {
                        return [
                            ...acc, k.voronoiCell
                        ];
                    } else {
                        return acc;
                    }
                }, [] as VoronoiCell[]);
                break;
            }
            case EVoronoiMode.DUCHY: {
                this.voronoiData = this.game.voronoiTerrain.kingdoms.reduce((acc, k) => {
                    if (k.isNearBy(position)) {
                        return [
                            ...acc, ...k.duchies.map(d => d.voronoiCell)
                        ];
                    } else {
                        return acc;
                    }
                }, [] as VoronoiCell[]);
                break;
            }
            case EVoronoiMode.COUNTY: {
                this.voronoiData = this.game.voronoiTerrain.kingdoms.reduce((acc, k) => {
                    if (k.isNearBy(position)) {
                        return [
                            ...acc, ...k.duchies.reduce((acc2, d) => [
                                ...acc2, ...d.counties.map(c => c.voronoiCell)
                            ], [] as VoronoiCell[])
                        ];
                    } else {
                        return acc;
                    }
                }, [] as VoronoiCell[]);
                break;
            }
        }
    }

    /**
     * Perform the initialization of the game.
     */
    componentDidMount() {
        if (!this.props.isTestMode) {
            this.rotateCameraInterval = setInterval(this.gameLoop.bind(this), 30);
        }
        this.keyDownHandlerInstance = this.handleKeyDown.bind(this);
        this.keyUpHandlerInstance = this.handleKeyUp.bind(this);
        document.addEventListener("keydown", this.keyDownHandlerInstance);
        document.addEventListener("keyup", this.keyUpHandlerInstance);
    }

    componentWillUnmount() {
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

    private renderGameWorld() {
        const shipPosition = this.getPlayerShip().position.rotateVector([0, 0, 1]);

        return (
            <>
                <circle
                    key="game-world-background"
                    cx={this.state.width * 0.5}
                    cy={this.state.height * 0.5}
                    r={Math.min(this.state.width, this.state.height) * 0.5}
                    fill="black"
                />
                {
                    this.state.showVoronoi ?
                        this.voronoiData.filter(d => {
                            return VoronoiGraph.angularDistance(
                                this.getPlayerShip().position.rotateVector([0, 0, 1]),
                                d.centroid,
                                this.game.worldScale
                            ) < (Math.PI / (this.game.worldScale * this.state.zoom)) + d.radius;
                        }).map(this.game.rotateDelaunayTriangle.bind(this.game, this.getPlayerShip(),false))
                            .map(this.drawDelaunayTile.bind(this, false)) :
                        null
                }
                {
                    ([
                        ...Array.from(this.game.voronoiTerrain.getStars(shipPosition, 0.5)).map(this.rotatePlanet.bind(this))
                            .map(this.convertToDrawable.bind(this, "-star2", 0.5)),
                        ...Array.from(this.game.voronoiTerrain.getStars(shipPosition, 0.25)).map(this.rotatePlanet.bind(this))
                            .map(this.convertToDrawable.bind(this, "-star3", 0.25)),
                        ...Array.from(this.game.voronoiTerrain.getStars(shipPosition, 0.125)).map(this.rotatePlanet.bind(this))
                            .map(this.convertToDrawable.bind(this, "-star4", 0.125))
                    ] as Array<IDrawable<Planet>>)
                        .sort((a: any, b: any) => b.distance - a.distance)
                        .map(this.drawStar.bind(this))
                }
                {
                    (Array.from(this.game.voronoiTerrain.getPlanets(shipPosition)).map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-planet", 1)) as Array<IDrawable<Planet>>)
                        .map(this.drawPlanet.bind(this, false))
                }
                {
                    (this.game.smokeClouds.map(App.applyKinematics.bind(this))
                        .map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-smokeClouds", 1)) as Array<IDrawable<SmokeCloud>>)
                        .map(this.drawSmokeCloud.bind(this))
                }
                {
                    (this.game.cannonBalls.map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-cannonBalls", 1)) as Array<IDrawable<SmokeCloud>>)
                        .map(this.drawSmokeCloud.bind(this))
                }
                {
                    (this.game.crates.map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-crates", 1)) as Array<IDrawable<Crate>>)
                        .map(this.drawCrate.bind(this, false))
                }
                {
                    (this.game.ships.map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-ships", 1)) as Array<IDrawable<Ship>>)
                        .map(this.drawShip.bind(this))
                }
                {
                    (Array.from(this.game.voronoiTerrain.getPlanets(shipPosition)).map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-planet", 1)) as Array<IDrawable<Planet>>)
                        .map(this.drawPlanet.bind(this, true))
                }
                {
                    (this.game.crates.map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-crates", 1)) as Array<IDrawable<Crate>>)
                        .map(this.drawCrate.bind(this, true))
                }
                {/*{*/}
                {/*    (this.ships.map(this.rotatePlanet.bind(this))*/}
                {/*        .map(this.convertToDrawable.bind(this, "-physics-hulls", 1)) as Array<IDrawable<Ship>>)*/}
                {/*        .map(this.renderPhysicsHull.bind(this))*/}
                {/*}*/}
            </>
        );
    }

    private renderGameControls() {
        return (
            <g key="game-controls">
                <text x="0" y="30" fill="black">Zoom</text>
                <rect x="0" y="45" width="20" height="20" fill="grey" onClick={this.decrementZoom.bind(this)}/>
                <text x="25" y="60" textAnchor="center">{(this.state.zoom * this.game.worldScale)}</text>
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
                                    fill="black"
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
                                    fill="black"
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

    renderItem(resourceType: EResourceType, index: number = 0) {
        switch (resourceType) {
            case EResourceType.RATION: {
                return (
                    <>
                        <polygon
                            key={`ration-bar-1-${index}`}
                            fill="tan"
                            stroke="brown"
                            strokeWidth="3"
                            points="40,40 -40,40 -40,-40 40,-40"
                        />
                        <line
                            key={`ration-line-1-${index}`}
                            stroke="brown"
                            strokeWidth="3"
                            x1={40}
                            x2={40}
                            y1={-40}
                            y2={40}
                        />
                        <line
                            key={`ration-line-2-${index}`}
                            stroke="brown"
                            strokeWidth="3"
                            x1={30}
                            x2={30}
                            y1={-40}
                            y2={40}
                        />
                        <line
                            key={`ration-line-3-${index}`}
                            stroke="brown"
                            strokeWidth="3"
                            x1={20}
                            x2={20}
                            y1={-40}
                            y2={40}
                        />
                        <line
                            key={`ration-line-4-${index}`}
                            stroke="brown"
                            strokeWidth="3"
                            x1={10}
                            x2={10}
                            y1={-40}
                            y2={40}
                        />
                        <line
                            key={`ration-line-5-${index}`}
                            stroke="brown"
                            strokeWidth="3"
                            x1={0}
                            x2={0}
                            y1={-40}
                            y2={40}
                        />
                        <line
                            key={`ration-line-6-${index}`}
                            stroke="brown"
                            strokeWidth="3"
                            x1={-10}
                            x2={-10}
                            y1={-40}
                            y2={40}
                        />
                        <line
                            key={`ration-line-7-${index}`}
                            stroke="brown"
                            strokeWidth="3"
                            x1={-20}
                            x2={-20}
                            y1={-40}
                            y2={40}
                        />
                        <line
                            key={`ration-line-8-${index}`}
                            stroke="brown"
                            strokeWidth="3"
                            x1={-30}
                            x2={-30}
                            y1={-40}
                            y2={40}
                        />
                    </>
                );
            }
            case EResourceType.IRON: {
                return (
                    <>
                        <polygon
                            key={`iron-bar-1-${index}`}
                            fill="darkgrey"
                            stroke="grey"
                            strokeWidth="3"
                            points="50,50 40,30 10,30 0,50"
                        />
                        <polygon
                            key={`iron-bar-2-${index}`}
                            fill="darkgrey"
                            stroke="grey"
                            strokeWidth="3"
                            points="-50,50 -40,30 -10,30 0,50"
                        />
                        <polygon
                            key={`iron-bar-3-${index}`}
                            fill="darkgrey"
                            stroke="grey"
                            strokeWidth="3"
                            points="25,30 15,10 -15,10 -25,30"
                        />
                    </>
                );
            }
            case EResourceType.GUNPOWDER: {
                return (
                    <>
                        <polygon
                            key={`gunpowder-cone-${index}`}
                            fill="darkgrey"
                            stroke="grey"
                            strokeWidth="3"
                            points="-40,40 0,-40 40,40 30,45 0,50 -30,45"
                        />
                    </>
                );
            }
            case EResourceType.FIREARM: {
                return (
                    <>
                        <polygon
                            key={`firearm-handle-${index}`}
                            fill="tan"
                            stroke="brown"
                            strokeWidth="3"
                            points="10,-20 40,-20 50,-10 40,10 30,0 30,-10"
                        />
                        <rect
                            key={`firearm-barrel-${index}`}
                            fill="grey"
                            stroke="darkgrey"
                            strokeWidth="3"
                            x={-20}
                            y={-20}
                            width={60}
                            height={10}
                        />
                    </>
                );
            }
            case EResourceType.MAHOGANY: {
                return (
                    <>
                        <polygon
                            key={`mahogany-log-1-${index}`}
                            fill="tan"
                            stroke="brown"
                            strokeWidth="3"
                            points="-40,-40 40,-40 45,-25 50,0 45,25 40,40 -40,40"
                        />
                        <ellipse
                            key={`mahogany-log-2-${index}`}
                            fill="tan"
                            stroke="brown"
                            strokeWidth="3"
                            cx={-40}
                            cy={0}
                            rx={10}
                            ry={40}
                        />
                    </>
                );
            }
            case EResourceType.FUR: {
                return (
                    <>
                        <polygon
                            key={`fur-${index}`}
                            fill="orange"
                            stroke="brown"
                            strokeWidth="3"
                            points="-40,-40 -30,-50 -20,-40 0,-50 20,-40 30,-50 40,-40 40,50 30,40 20,50 0,40 -20,50 -30,40 -40,50"
                        />
                        <line
                            key={`fur-line-1-${index}`}
                            stroke="brown"
                            strokeWidth="3"
                            x1={-30}
                            y1={-40}
                            x2={-30}
                            y2={30}
                        />
                        <line
                            key={`fur-line-2-${index}`}
                            stroke="brown"
                            strokeWidth="3"
                            x1={30}
                            y1={-40}
                            x2={30}
                            y2={30}
                        />
                        <line
                            key={`fur-line-3-${index}`}
                            stroke="brown"
                            strokeWidth="3"
                            x1={-20}
                            y1={-30}
                            x2={-20}
                            y2={40}
                        />
                        <line
                            key={`fur-line-4-${index}`}
                            stroke="brown"
                            strokeWidth="3"
                            x1={20}
                            y1={-30}
                            x2={20}
                            y2={40}
                        />
                        <line
                            key={`fur-line-5-${index}`}
                            stroke="brown"
                            strokeWidth="3"
                            x1={0}
                            y1={-40}
                            x2={0}
                            y2={30}
                        />
                    </>
                );
            }
            case EResourceType.RUBBER: {
                return (
                    <>
                        <polygon
                            key={`rubber-bowl-${index}`}
                            fill="tan"
                            stroke="brown"
                            strokeWidth="3"
                            points="-50,-30 50,-30 40,0 30,20, 20,30, 10,35, 0,38 -10,35, -20,30, -30,20, -40,0"
                        />
                        <ellipse
                            key={`rubber-powder-${index}`}
                            fill="white"
                            stroke="darkgray"
                            strokeWidth="3"
                            cx="0"
                            cy="-30"
                            rx="50"
                            ry="20"
                        />
                    </>
                );
            }
            case EResourceType.CACAO: {
                return (
                    <>
                        <polygon
                            key={`cacao-bowl-${index}`}
                            fill="grey"
                            stroke="darkgray"
                            strokeWidth="3"
                            points="-50,-30 50,-30 40,0 30,20, 20,30, 10,35, 0,38 -10,35, -20,30, -30,20, -40,0"
                        />
                        <ellipse
                            key={`cacao-powder-${index}`}
                            fill="brown"
                            stroke="darkgray"
                            strokeWidth="3"
                            cx="0"
                            cy="-30"
                            rx="50"
                            ry="20"
                        />
                    </>
                );
            }
            case EResourceType.COFFEE: {
                const coffeeBeanLocations: Array<{x: number, y: number}> = [{
                    x: -30, y: 40
                }, {
                    x: -10, y: 40
                }, {
                    x: 10, y: 40
                }, {
                    x: 30, y: 40
                }, {
                    x: -20, y: 20
                }, {
                    x: 0, y: 20
                }, {
                    x: 20, y: 20
                }, {
                    x: -10, y: 0
                }, {
                    x: 10, y: 0
                }, {
                    x: 0, y: -20
                }]
                return coffeeBeanLocations.map(({x, y}, beanIndex) => (
                    <>
                        <ellipse
                            key={`coffee-beans-${beanIndex}-${index}`}
                            fill="brown"
                            stroke="#330C00"
                            strokeWidth="3"
                            cx={x}
                            cy={y}
                            rx="20"
                            ry="10"
                        />
                        <line
                            key={`coffee-beans-${beanIndex}-line-${index}`}
                            stroke="#330C00"
                            strokeWidth="3"
                            x1={x - 20}
                            x2={x + 20}
                            y1={y}
                            y2={y}
                        />
                    </>
                ));
            }
            case EResourceType.RUM: {
                return (
                    <>
                        <polygon
                            key={`rum-bottle-${index}`}
                            fill="maroon"
                            stroke="#330C00"
                            strokeWidth="3"
                            points="-10,-40 10,-40 10,-20 20,-15 30,-10 30,50 -30,50 -30,-10 -20,-15 -10,-20"
                        />
                        <polygon
                            key={`rum-bottle-label-${index}`}
                            fill="tan"
                            stroke="#330C00"
                            strokeWidth="3"
                            points="30,-10 30,20 -30,20 -30,-10"
                        />
                        <text
                            key={`rum-bottle-text-${index}`}
                            stroke="#330C00"
                            strokeWidth="3"
                            textAnchor="middle"
                            x={0}
                            y={10}
                        >XXX</text>
                    </>
                );
            }
            case EResourceType.MOLASSES: {
                return (
                    <>
                        <polygon
                            key={`molasses-jar-${index}`}
                            fill="maroon"
                            stroke="#330C00"
                            strokeWidth="3"
                            points="-30,-40 30,-40 30,40 20,45 0,50 -20,45 -30,40"
                        />
                        <ellipse
                            key={`molasses-jar-lid-${index}`}
                            fill="grey"
                            stroke="darkgrey"
                            strokeWidth="3"
                            cx={0}
                            cy={-40}
                            rx={30}
                            ry={10}
                        />
                    </>
                );
            }
            case EResourceType.COTTON: {
                return (
                    <>
                        <polyline
                            key={`cotton-stem-1-${index}`}
                            stroke="brown"
                            strokeWidth="3"
                            points="-30,-30 50,50"
                        />
                        <polyline
                            key={`cotton-stem-2-${index}`}
                            stroke="brown"
                            strokeWidth="3"
                            points="-30,20 20,20"
                        />
                        <ellipse
                            key={`cotton-leaf-1-${index}`}
                            fill="green"
                            stroke="darkgreen"
                            strokeWidth="3"
                            cx={20}
                            cy={0}
                            rx={20}
                            ry={10}
                        />
                        <ellipse
                            key={`cotton-leaf-2-${index}`}
                            fill="green"
                            stroke="darkgreen"
                            strokeWidth="3"
                            cx={-20}
                            cy={0}
                            rx={25}
                            ry={10}
                        />
                        <circle
                            key={`cotton-1-${index}`}
                            fill="white"
                            stroke="grey"
                            strokeWidth="3"
                            cx={-30}
                            cy={-30}
                            r={20}
                        />
                        <circle
                            key={`cotton-2-${index}`}
                            fill="white"
                            stroke="grey"
                            strokeWidth="3"
                            cx={-10}
                            cy={0}
                            r={10}
                        />
                        <circle
                            key={`cotton-2-${index}`}
                            fill="white"
                            stroke="grey"
                            strokeWidth="3"
                            cx={-15}
                            cy={-20}
                            r={15}
                        />
                        <circle
                            key={`cotton-2-${index}`}
                            fill="white"
                            stroke="grey"
                            strokeWidth="3"
                            cx={-25}
                            cy={20}
                            r={15}
                        />
                    </>
                );
            }
            case EResourceType.FLAX: {
                return (
                    <>
                        <polyline
                            key={`flax-stem-1-${index}`}
                            stroke="green"
                            strokeWidth="3"
                            points="0,-50 0,50"
                        />
                        <polyline
                            key={`flax-stem-2-${index}`}
                            stroke="green"
                            strokeWidth="3"
                            points="10,-40 0,50"
                        />
                        <polyline
                            key={`flax-stem-3-${index}`}
                            stroke="green"
                            strokeWidth="3"
                            points="-10,-40 0,50"
                        />
                        <polyline
                            key={`flax-stem-4-${index}`}
                            stroke="green"
                            strokeWidth="3"
                            points="20,-35 0,50"
                        />
                        <polyline
                            key={`flax-stem-5-${index}`}
                            stroke="green"
                            strokeWidth="3"
                            points="-20,-35 0,50"
                        />
                    </>
                );
            }
            case EResourceType.TOBACCO: {
                return (
                    <>
                        <polyline
                            key={`tobacco-stem-1-${index}`}
                            stroke="green"
                            strokeWidth="3"
                            points="0,-50 0,50"
                        />
                        <ellipse
                            key={`tobacco-leaf-1-${index}`}
                            fill="green"
                            stroke="darkgreen"
                            strokeWidth="3"
                            cx={-25}
                            cy={40}
                            rx={25}
                            ry={10}
                        />
                        <ellipse
                            key={`tobacco-leaf-2-${index}`}
                            fill="green"
                            stroke="darkgreen"
                            strokeWidth="3"
                            cx={25}
                            cy={40}
                            rx={25}
                            ry={10}
                        />
                        <ellipse
                            key={`tobacco-leaf-3-${index}`}
                            fill="green"
                            stroke="darkgreen"
                            strokeWidth="3"
                            cx={20}
                            cy={10}
                            rx={20}
                            ry={10}
                        />
                        <ellipse
                            key={`tobacco-leaf-4-${index}`}
                            fill="green"
                            stroke="darkgreen"
                            strokeWidth="3"
                            cx={-20}
                            cy={10}
                            rx={20}
                            ry={10}
                        />
                        <ellipse
                            key={`tobacco-leaf-5-${index}`}
                            fill="green"
                            stroke="darkgreen"
                            strokeWidth="3"
                            cx={-15}
                            cy={-20}
                            rx={15}
                            ry={10}
                        />
                        <ellipse
                            key={`tobacco-leaf-6-${index}`}
                            fill="green"
                            stroke="darkgreen"
                            strokeWidth="3"
                            cx={15}
                            cy={-20}
                            rx={15}
                            ry={10}
                        />
                    </>
                );
            }
            default: {
                return (
                    <>
                        <rect
                            key={`item-rect-${index}`}
                            fill="white"
                            stroke="red"
                            strokeWidth="5"
                            x={-50}
                            y={-50}
                            width="100"
                            height="100"
                        />
                        <line
                            key={`item-line-1-${index}`}
                            stroke="red"
                            strokeWidth="5"
                            x1={-50}
                            x2={50}
                            y1={-50}
                            y2={50}
                        />
                        <line
                            key={`item-line-2-${index}`}
                            stroke="red"
                            strokeWidth="5"
                            x1={-50}
                            x2={50}
                            y1={50}
                            y2={-50}
                        />
                    </>
                );
            }
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
                                        <svg key={`show-item-${item.resourceType}`} width="100" height="100">
                                            <g transform="translate(50, 50)">
                                                {
                                                    this.renderItem(item.resourceType)
                                                }
                                                {
                                                    <text textAnchor="middle">{item.resourceType}</text>
                                                }
                                            </g>
                                        </svg>
                                    );
                                })
                            }
                        </ul>
                    )
                }
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
                            this.renderGameWorld.call(this)
                        }
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
        );
    }
}

export default App;
