import React from 'react';
import './App.css';
import Quaternion from 'quaternion';
import {IHitTest} from "./Intersection";
import {CAPITAL_GOODS, EResourceType, ITEM_DATA, OUTPOST_GOODS} from "./Resource";
import {
    ESettlementLevel,
    ICameraState,
    ICameraStateWithOriginal,
    ICollidable,
    IDrawable,
    IExpirable,
    IExpirableTicks,
    MIN_DISTANCE
} from "./Interface";
import {EFaction, EShipType, PHYSICS_SCALE, Ship, SHIP_DATA} from "./Ship";
import {EOrderType, Order} from "./Order";
import {
    DelaunayGraph,
    DelaunayTile,
    DelaunayTriangle,
    ICellData,
    IDrawableTile,
    ITessellatedTriangle,
    VoronoiCell,
    VoronoiGraph
} from "./Graph";
import {VoronoiCounty, VoronoiKingdom, VoronoiTerrain, VoronoiTree} from "./VoronoiTree";
import {Faction, LuxuryBuff} from "./Faction";
import {EBuildingType, Manufactory, Planet, Plantation, Star} from "./Planet";
import {CannonBall, Crate, SmokeCloud} from "./Item";
import * as Tone from "tone";

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

interface ITargetLineData {
    targetLines: Array<[[number, number], [number, number]]>,
    targetNodes: Array<[[number, number], number]>
}

enum EVoronoiMode {
    KINGDOM = "KINGDOM",
    DUCHY = "DUCHY",
    COUNTY = "COUNTY"
}

interface IAppProps {
    /**
     * If the app is in test mode.
     */
    isTestMode?: boolean;
    /**
     * If the app is in voronoi test mode.
     */
    isVoronoiTestMode?: boolean;
    /**
     * The size of the world, initially
     */
    worldScale?: number;
}

interface IAppState {
    showNotes: boolean;
    showShips: boolean;
    showItems: boolean;
    width: number;
    height: number;
    zoom: number;
    showDelaunay: boolean;
    showVoronoi: boolean;
    voronoiMode: EVoronoiMode;
    autoPilotEnabled: boolean;
    audioEnabled: boolean;
    showMainMenu: boolean;
    showSpawnMenu: boolean;
    faction: EFaction | null;
}

export class App extends React.Component<IAppProps, IAppState> {
    state = {
        showNotes: false as boolean,
        showShips: false as boolean,
        showItems: false as boolean,
        width: 500 as number,
        height: 500 as number,
        zoom: 4 as number,
        showDelaunay: false as boolean,
        showVoronoi: false as boolean,
        voronoiMode: EVoronoiMode.KINGDOM as EVoronoiMode,
        autoPilotEnabled: true as boolean,
        audioEnabled: false as boolean,
        faction: null as EFaction | null,
        showMainMenu: true as boolean,
        showSpawnMenu: false as boolean,
    };

    private showNotesRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    private showShipsRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    private showItemsRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    private showDelaunayRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    private showVoronoiRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    private autoPilotEnabledRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    private audioEnabledRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    private svgRef: React.RefObject<SVGSVGElement> = React.createRef<SVGSVGElement>();
    public rotateCameraInterval: any = null;
    private activeKeys: any[] = [];
    private keyDownHandlerInstance: any;
    private keyUpHandlerInstance: any;
    public delaunayGraph: DelaunayGraph<Planet> = new DelaunayGraph<Planet>(this);
    private delaunayData: DelaunayTriangle[] = [];
    public voronoiGraph: VoronoiGraph<Planet> = new VoronoiGraph(this);
    public voronoiData: VoronoiCell[] = [];
    public refreshVoronoiDataTick: number = 0;
    public voronoiShips: VoronoiTree<Ship> = new VoronoiTree(this);
    public voronoiTerrain: VoronoiTerrain = new VoronoiTerrain(this);
    public factions: { [key: string]: Faction } = {};
    public ships: Ship[] = [];
    public playerShip: Ship | null = null;
    public crates: Crate[] = [];
    public planets: Planet[] = [];
    public smokeClouds: SmokeCloud[] = [];
    public cannonBalls: CannonBall[] = [];
    public luxuryBuffs: LuxuryBuff[] = [];
    public gold: number = 2000;
    public worldScale: number = 2;
    public music: MusicPlayer = new MusicPlayer();
    public demoAttackingShipId: string | null = null;
    public lastDemoAttackingShipTime: Date = new Date();

    /**
     * Velocity step size of ships.
     */
    public static VELOCITY_STEP: number = 1 / 6000;
    /**
     * The speed of the cannon ball projectiles.
     */
    public static PROJECTILE_SPEED: number = App.VELOCITY_STEP * 100;
    /**
     * How long a cannon ball will live for in ticks.
     */
    public static PROJECTILE_LIFE: number = 40;
    /**
     * The enemy detection range.
     */
    public static PROJECTILE_DETECTION_RANGE: number = App.PROJECTILE_SPEED * App.PROJECTILE_LIFE * 1.2;
    /**
     * The number of burn ticks.
     */
    public static NUM_BURN_TICKS: number = 10;
    /**
     * The number of repair ticks.
     */
    public static NUM_REPAIR_TICKS: number = 10;
    /**
     * The number of ticks between each health tick event.
     */
    public static HEALTH_TICK_COOL_DOWN: number = 3 * 10;
    /**
     * The amount of damage that is burn damage.
     */
    public static BURN_DAMAGE_RATIO: number = 0.5;
    /**
     * The amount of damage that is repairable damage.
     */
    public static REPAIR_DAMAGE_RATIO: number = 0.8;
    /**
     * Rotation step size of ships.
     */
    public static ROTATION_STEP: number = 1 / 300;
    /**
     * The drag which slows down increases of velocity.
     */
    public static VELOCITY_DRAG: number = 1 / 20;
    /**
     * The rotation which slows down increases of rotation.
     */
    public static ROTATION_DRAG: number = 1 / 10;
    /**
     * The power of the brake action. Slow down velocity dramatically.
     */
    public static BRAKE_POWER: number = 1 / 10;

    private static randomRange(start: number = -1, end: number = 1): number {
        const value = Math.random();
        return start + (end - start) * value;
    }

    private static GetCameraState(viewableObject: ICameraState): ICameraState {
        return {
            id: viewableObject.id,
            color: viewableObject.color,
            position: viewableObject.position.clone(),
            positionVelocity: viewableObject.positionVelocity.clone(),
            orientation: viewableObject.orientation.clone(),
            orientationVelocity: viewableObject.orientationVelocity.clone(),
            cannonLoading: viewableObject.cannonLoading,
            size: viewableObject.size,
        };
    }

    private getPlayerShip(): ICameraState {
        const ship = this.playerShip;
        if (ship) {
            return App.GetCameraState(ship);
        }

        // show latest faction ship
        if (this.state.faction) {
            // faction selected, orbit the faction's home world
            const faction = Object.values(this.factions).find(f => f.id === this.state.faction);
            const ship = this.ships.find(s => faction && faction.shipIds.length > 0 && s.id === faction.shipIds[faction.shipIds.length - 1]);
            if (ship) {
                return App.GetCameraState(ship);
            }
        }

        // show latest attacking ship
        const attackingAIShip = this.ships.find(s => s.id === this.demoAttackingShipId);
        if (attackingAIShip && !this.props.isVoronoiTestMode) {
            return App.GetCameraState(attackingAIShip);
        } else {
            this.demoAttackingShipId = null;
        }

        // no faction selected, orbit the world
        const tempShip = new Ship(this, EShipType.SLOOP);
        tempShip.id = "ghost-ship";
        const numSecondsToCircle = 120 * this.worldScale;
        const millisecondsPerSecond = 1000;
        const circleSlice = numSecondsToCircle * millisecondsPerSecond;
        const circleFraction = (+new Date() % circleSlice) / circleSlice;
        const angle = circleFraction * (Math.PI * 2);
        tempShip.position = Quaternion.fromAxisAngle([1, 0, 0], -angle);
        return App.GetCameraState(tempShip);
    }

    private rotateDelaunayTriangle(earthLike: boolean, triangle: ICellData, index: number): IDrawableTile {
        const {
            position: cameraPosition,
            orientation: cameraOrientation,
        } = this.getPlayerShip();
        const pointToQuaternion = (v: [number, number, number]): Quaternion => {
            const q = Quaternion.fromBetweenVectors([0, 0, 1], v);
            return cameraOrientation.clone().inverse()
                .mul(cameraPosition.clone().inverse())
                .mul(q);
        };
        const vertices = triangle.vertices.map(pointToQuaternion);
        let color: string = "red";
        if (earthLike) {
            // earth colors
            if (index % 6 < 2) {
                color = "green";
            } else {
                color = "blue";
            }
        } else {
            // beach ball colors
            if (index % 6 === 0) {
                color = "red";
            } else if (index % 6 === 1) {
                color = "orange";
            } else if (index % 6 === 2) {
                color = "yellow";
            } else if (index % 6 === 3) {
                color = "green";
            } else if (index % 6 === 4) {
                color = "blue";
            } else if (index % 6 === 5) {
                color = "purple";
            }
        }

        const tile = new DelaunayTile();
        tile.vertices = vertices;
        tile.centroid = pointToQuaternion(triangle.centroid);
        tile.color = color;
        tile.id = `tile-${index}`;
        return tile;
    }

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

    private convertToDrawable<T extends ICameraState>(layerPostfix: string, size: number, planet: ICameraStateWithOriginal<T>): IDrawable<T> {
        const rotatedPosition = planet.position.rotateVector([0, 0, 1]);
        const projection = this.stereographicProjection(planet, size);
        const reverseProjection = this.stereographicProjection(planet, size);
        const distance = Math.max(MIN_DISTANCE, 5 * (1 - rotatedPosition[2] * size)) * this.worldScale;
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

    private stereographicProjection(planet: ICameraState, size: number = 1): {x: number, y: number} {
        const zoom = (this.state.zoom * this.worldScale);
        const vector = planet.position.rotateVector([0, 0, 1]);
        return {
            x: vector[0] * zoom * size,
            y: vector[1] * zoom * size,
        };
    }

    /**
     * Get the points of angular progress for a polygon pi chart.
     * @param percent the percentage done from 0 to 1.
     * @param radius the size of the pi chart
     */
    private getPointsOfAngularProgress(percent: number, radius: number) {
        return new Array(17).fill(0).map((v, i) => {
            return `${radius * Math.cos((i / 16) * percent * Math.PI * 2)},${radius * Math.sin((i / 16) * percent * Math.PI * 2)}`;
        }).join(" ");
    }

    private drawPlanet(uiPass: boolean, planetDrawing: IDrawable<Planet>) {
        const isReverseSide = planetDrawing.rotatedPosition[2] < 0;
        const x = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).x + 1) * 0.5;
        const y = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).y + 1) * 0.5;
        const distance = planetDrawing.distance * 5;
        const size = 5 * Math.max(0, 2 * Math.atan(planetDrawing.original.size / (2 * distance)));

        // extract faction information
        let factionColor: string | null = null;
        const ownerFaction = Object.values(this.factions).find(faction => faction.planetIds.includes(planetDrawing.original.id));
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
                            key={`${planetDrawing.id}-settlement-progress`}
                            transform={`translate(${x * this.state.width},${(1 - y) * this.state.height})`}
                            fill={factionColor}
                            style={{opacity: 0.8}}
                            points={`0,0 ${this.getPointsOfAngularProgress.call(this, planetDrawing.original.settlementProgress, size * (this.state.zoom * this.worldScale) * 1.35)}`}
                        />
                    )
                }
                {
                    !uiPass && (
                        <circle
                            key={`${planetDrawing.id}-planet`}
                            cx={x * this.state.width}
                            cy={(1 - y) * this.state.height}
                            r={size * (this.state.zoom * this.worldScale)}
                            fill={planetDrawing.color}
                            stroke="grey"
                            strokeWidth={0.2 * size * (this.state.zoom * this.worldScale)}
                            style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
                        />
                    )
                }
                {
                    uiPass && planetVisible && (
                        <>
                            <text
                                key={`${planetDrawing.id}-planet-title`}
                                x={planetX + size * (this.state.zoom * this.worldScale) + 10}
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
                                            x={planetX + size * (this.state.zoom * this.worldScale) + 10}
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
                    r={size * (this.state.zoom * this.worldScale)}
                    fill={planetDrawing.color}
                    stroke="grey"
                    strokeWidth={0.2 * size * (this.state.zoom * this.worldScale)}
                    style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
                />
                <line
                    x1={(x + 0.01) * this.state.width}
                    y1={(1 - y) * this.state.height}
                    x2={(x - 0.01) * this.state.width}
                    y2={(1 - y) * this.state.height}
                    stroke={planetDrawing.color}
                    strokeWidth={0.2 * size * (this.state.zoom * this.worldScale)}
                    style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
                />
                <line
                    x1={x * this.state.width}
                    y1={(1 - y + 0.01) * this.state.height}
                    x2={x * this.state.width}
                    y2={(1 - y - 0.01) * this.state.height}
                    stroke={planetDrawing.color}
                    strokeWidth={0.2 * size * (this.state.zoom * this.worldScale)}
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
                    const midPoint = DelaunayGraph.normalize(App.getAveragePoint([aPoint, bPoint]));
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
                    const midPoint = DelaunayGraph.normalize(App.getAveragePoint([aPoint, bPoint]));
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
     * Compute a set of physics quaternions for the hull.
     * @param hullPoints A physics hull to convert to quaternions.
     * @param worldScale The size of the world.
     * @private
     */
    private static getPhysicsHull(hullPoints: Array<[number, number]>, worldScale: number): Quaternion[] {
        const hullSpherePoints = hullPoints.map(([xi, yi]): [number, number, number] => {
            const x = xi * PHYSICS_SCALE / worldScale;
            const y = -yi * PHYSICS_SCALE / worldScale;
            const z = Math.sqrt(1 - Math.pow(x, 2) - Math.pow(y, 2));
            return [x, y, z];
        });
        return hullSpherePoints.map((point) => Quaternion.fromBetweenVectors([0, 0, 1], point));
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

        const hullQuaternions = App.getPhysicsHull(hullPoints, this.worldScale);
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
                points={rotatedHullPoints.map(([x, y]) => `${(x * (this.state.zoom * this.worldScale) + 1) * 0.5 * this.state.width},${(1 - (y * (this.state.zoom * this.worldScale) + 1) * 0.5) * this.state.height}`).join(" ")}
                fill="white"
                stroke="cyan"
                opacity={0.5}
            />
        );
    }

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
                    strokeWidth={0.05 * size * (this.state.zoom * this.worldScale)}
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
                                strokeWidth={0.05 * size * (this.state.zoom * this.worldScale)}
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
                                strokeWidth={0.05 * size * (this.state.zoom * this.worldScale)}
                                style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
                            />
                        );
                    })
                }
            </>
        )
    }

    private drawShip(planetDrawing: IDrawable<Ship>) {
        const shipData = SHIP_DATA.find(s => s.shipType === planetDrawing.original.shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }

        const isReverseSide = planetDrawing.rotatedPosition[2] > 0;
        const x = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).x + 1) * 0.5;
        const y = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).y + 1) * 0.5;
        const distance = planetDrawing.distance;
        const size = 0.1 * Math.max(0, 2 * Math.atan(1 / (2 * distance)));
        const scale = size * (this.state.zoom * this.worldScale);

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
            Math.max(this.state.width / 2, this.state.height / 2) * Math.cos((10 / 180 * Math.PI)) * (this.state.zoom * this.worldScale),
            Math.max(this.state.width / 2, this.state.height / 2) * Math.sin((10 / 180 * Math.PI)) * (this.state.zoom * this.worldScale),
        ]
        const rightCannonPointBottom: [number, number] = [
            Math.max(this.state.width / 2, this.state.height / 2) * Math.cos(-(10 / 180 * Math.PI)) * (this.state.zoom * this.worldScale),
            Math.max(this.state.width / 2, this.state.height / 2) * Math.sin(-(10 / 180 * Math.PI)) * (this.state.zoom * this.worldScale),
        ];
        const leftCannonPointTop: [number, number] = [
            Math.max(this.state.width / 2, this.state.height / 2) * Math.cos(Math.PI - (10 / 180 * Math.PI)) * (this.state.zoom * this.worldScale),
            Math.max(this.state.width / 2, this.state.height / 2) * Math.sin(Math.PI - (10 / 180 * Math.PI)) * (this.state.zoom * this.worldScale),
        ]
        const leftCannonPointBottom: [number, number] = [
            Math.max(this.state.width / 2, this.state.height / 2) * Math.cos(Math.PI + (10 / 180 * Math.PI)) * (this.state.zoom * this.worldScale),
            Math.max(this.state.width / 2, this.state.height / 2) * Math.sin(Math.PI + (10 / 180 * Math.PI)) * (this.state.zoom * this.worldScale),
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
                                x1={this.state.width * a[0] * (this.state.zoom * this.worldScale)}
                                y1={this.state.height * -a[1] * (this.state.zoom * this.worldScale)}
                                x2={this.state.width * b[0] * (this.state.zoom * this.worldScale)}
                                y2={this.state.height * -b[1] * (this.state.zoom * this.worldScale)}
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
                                    cx={this.state.width * a[0] * (this.state.zoom * this.worldScale)}
                                    cy={this.state.height * -a[1] * (this.state.zoom * this.worldScale)}
                                    stroke="blue"
                                    fill="none"
                                />
                                <text
                                    key={`target-value-${value}`}
                                    textAnchor="middle"
                                    x={this.state.width * a[0] * (this.state.zoom * this.worldScale)}
                                    y={this.state.height * -a[1] * (this.state.zoom * this.worldScale) + 5}
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
                                    strokeWidth={0.05 * size * (this.state.zoom * this.worldScale)}
                                    style={{opacity: 0.3}}
                                />
                                <polygon
                                    points={`-10,-20 ${leftCannonPointBottom[0]},${leftCannonPointBottom[1]} ${leftCannonPointTop[0]},${leftCannonPointTop[1]} -10,20`}
                                    fill="grey"
                                    stroke="white"
                                    strokeWidth={0.05 * size * (this.state.zoom * this.worldScale)}
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
            </g>
        );
    }

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
                r={size * (this.state.zoom * this.worldScale)}
                fill={planetDrawing.color}
                stroke="darkgray"
                strokeWidth={0.02 * size * (this.state.zoom * this.worldScale)}
                style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
            />
        );
    }

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
                            x={size * (this.state.zoom * this.worldScale) + 10}
                            y={0}
                        >
                            {planetDrawing.original.resourceType}
                        </text>
                    )
                }
            </g>
        );
    }

    public static getAveragePoint(points: Array<[number, number, number]>): [number, number, number] {
        let sum: [number, number, number] = [0, 0, 0];
        for (const point of points) {
            sum = DelaunayGraph.add(sum, point);
        }
        return [
            sum[0] / points.length,
            sum[1] / points.length,
            sum[2] / points.length,
        ];
    }

    private static MAX_TESSELLATION: number = 3;

    private *getDelaunayTileTessellation(centroid: Quaternion, vertices: Quaternion[], maxStep: number = App.MAX_TESSELLATION, step: number = 0): Generator<ITessellatedTriangle> {
        if (step === maxStep) {
            // max step, return current level of tessellation
            const data: ITessellatedTriangle = {
                vertices,
            };
            return yield data;
        } else if (step === 0) {
            // perform triangle fan
            for (let i = 0; i < vertices.length; i++) {
                const generator = this.getDelaunayTileTessellation(centroid, [
                    centroid,
                    vertices[i % vertices.length],
                    vertices[(i + 1) % vertices.length],
                ], maxStep, step + 1);
                while (true) {
                    const res = generator.next();
                    if (res.done) {
                        break;
                    }
                    yield res.value;
                }
            }

        } else {
            // perform triangle tessellation

            // compute mid points used in tessellation
            const midPoints: Quaternion[] = [];
            for (let i = 0; i < vertices.length; i++) {
                const a: Quaternion = vertices[i % vertices.length].clone();
                const b: Quaternion = vertices[(i + 1) % vertices.length].clone();
                let lerpPoint = App.lerp(
                    a.rotateVector([0, 0, 1]),
                    b.rotateVector([0, 0, 1]),
                    0.5
                )
                if (DelaunayGraph.distanceFormula(lerpPoint, [0, 0, 0]) < 0.01) {
                    lerpPoint = App.lerp(
                        a.rotateVector([0, 0, 1]),
                        b.rotateVector([0, 0, 1]),
                        0.4
                    );
                }
                const midPoint = Quaternion.fromBetweenVectors(
                    [0, 0, 1],
                    DelaunayGraph.normalize(lerpPoint)
                );
                midPoints.push(midPoint);
            }

            // return recursive tessellation of triangle into 4 triangles
            const generators: Array<Generator<ITessellatedTriangle>> = [
                this.getDelaunayTileTessellation(centroid, [
                    vertices[0],
                    midPoints[0],
                    midPoints[2]
                ], maxStep, step + 1),
                this.getDelaunayTileTessellation(centroid, [
                    vertices[1],
                    midPoints[1],
                    midPoints[0]
                ], maxStep, step + 1),
                this.getDelaunayTileTessellation(centroid, [
                    vertices[2],
                    midPoints[2],
                    midPoints[1]
                ], maxStep, step + 1),
                this.getDelaunayTileTessellation(centroid, [
                    midPoints[0],
                    midPoints[1],
                    midPoints[2]
                ], maxStep, step + 1)
            ];
            for (const generator of generators) {
                while (true) {
                    const res = generator.next();
                    if (res.done) {
                        break;
                    }
                    yield res.value;
                }
            }
        }
    }

    private getDelaunayTileMidPoint(tile: DelaunayTile): {x: number, y: number} {
        const rotatedPoints = tile.vertices.map((v: Quaternion): [number, number, number] => {
            return v.rotateVector([0, 0, 1]);
        });
        const averagePoint = DelaunayGraph.normalize(App.getAveragePoint(rotatedPoints));
        return {
            x: (averagePoint[0] * (this.state.zoom * this.worldScale) + 1) * 0.5,
            y: (averagePoint[1] * (this.state.zoom * this.worldScale) + 1) * 0.5,
        };
    }

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
                x: (p.x - 0.5) * (this.state.zoom * this.worldScale) * 1.1 + 0.5,
                y: (p.y - 0.5) * (this.state.zoom * this.worldScale) * 1.1 + 0.5,
            };
        });

        return {
            points,
            rotatedPoints
        };
    }

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

    public static lerp(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
        const delta = DelaunayGraph.subtract(b, a);
        return [
            a[0] + delta[0] * t,
            a[1] + delta[1] * t,
            a[2] + delta[2] * t
        ];
    }

    private drawDelaunayTile(earthLike: boolean, tile: IDrawableTile) {
        const tessellationMesh = Array.from(this.getDelaunayTileTessellation(tile.centroid, tile.vertices));
        return (
            <g key={tile.id}>
                {
                    tessellationMesh.map(this.drawDelaunayTessellatedTriangle.bind(this, earthLike, tile))
                }
            </g>
        );
    }

    /**
     * Process a ship by making changes to the ship's data.
     * @param shipIndex Index to get ship's state.
     * @param getActiveKeys Get the ship's active keys.
     * @param isAutomated If the function is called by AI, which shouldn't clear pathfinding logic.
     * @private
     */
    private handleShipLoop(shipIndex: number, getActiveKeys: () => string[], isAutomated: boolean) {
        let {
            id: cameraId,
            position: cameraPosition,
            positionVelocity: cameraPositionVelocity,
            orientation: cameraOrientation,
            orientationVelocity: cameraOrientationVelocity,
            cannonLoading: cameraCannonLoading,
            cannonCoolDown,
            shipType,
            faction
        } = this.ships[shipIndex];
        const shipData = SHIP_DATA.find(i => i.shipType === shipType);
        if (!shipData) {
            throw new Error("Could not find Ship Type");
        }
        const speedFactor = this.ships[shipIndex].getSpeedFactor();
        const smokeClouds = [
            ...this.smokeClouds.slice(-20)
        ];
        const cannonBalls = [
            ...this.cannonBalls.slice(-100)
        ];

        let clearPathFindingPoints: boolean = false;

        const activeKeys = getActiveKeys();

        // handle movement
        if (activeKeys.includes("a")) {
            const rotation = Quaternion.fromAxisAngle([0, 0, 1], Math.PI).pow(App.ROTATION_STEP);
            const rotationDrag = cameraOrientationVelocity.pow(App.ROTATION_DRAG).inverse();
            cameraOrientationVelocity = cameraOrientationVelocity.clone().mul(rotation).mul(rotationDrag);
            if (VoronoiGraph.angularDistanceQuaternion(cameraOrientationVelocity, 1) < Math.PI * App.ROTATION_STEP * 0.9) {
                cameraOrientationVelocity = Quaternion.ONE;
            }
        }
        if (activeKeys.includes("d")) {
            const rotation = Quaternion.fromAxisAngle([0, 0, 1], -Math.PI).pow(App.ROTATION_STEP);
            const rotationDrag = cameraOrientationVelocity.pow(App.ROTATION_DRAG).inverse();
            cameraOrientationVelocity = cameraOrientationVelocity.clone().mul(rotation).mul(rotationDrag);
            if (VoronoiGraph.angularDistanceQuaternion(cameraOrientationVelocity, 1) < Math.PI * App.ROTATION_STEP * 0.9) {
                cameraOrientationVelocity = Quaternion.ONE;
            }
        }
        if (activeKeys.includes("w")) {
            const forward = cameraOrientation.clone().rotateVector([0, 1, 0]);
            const rotation = Quaternion.fromBetweenVectors([0, 0, 1], forward).pow(App.VELOCITY_STEP / this.worldScale);
            const rotationDrag = cameraPositionVelocity.pow(App.VELOCITY_DRAG / this.worldScale).inverse();
            cameraPositionVelocity = cameraPositionVelocity.clone().mul(rotation).mul(rotationDrag);
            if (VoronoiGraph.angularDistanceQuaternion(cameraPositionVelocity, this.worldScale) < Math.PI / 2 * App.VELOCITY_STEP / this.worldScale) {
                cameraPositionVelocity = Quaternion.ONE;
            }

            // make backward smoke cloud
            const smokeCloud = new SmokeCloud();
            smokeCloud.id = `${cameraId}-${Math.floor(Math.random() * 100000000)}`;
            smokeCloud.position = cameraPosition.clone();
            smokeCloud.positionVelocity = cameraOrientation.clone().inverse()
                .mul(cameraPosition.clone().inverse())
                .mul(rotation.clone())
                .mul(cameraPosition.clone())
                .mul(cameraOrientation.clone());
            smokeCloud.size = 2;
            smokeClouds.push(smokeCloud);
        }
        if (activeKeys.includes("s")) {
            const rotation = cameraPositionVelocity.clone().inverse().pow(App.BRAKE_POWER / this.worldScale);
            cameraPositionVelocity = cameraPositionVelocity.clone().mul(rotation);
            if (VoronoiGraph.angularDistanceQuaternion(cameraPositionVelocity, this.worldScale) < Math.PI / 2 * App.VELOCITY_STEP / this.worldScale) {
                cameraPositionVelocity = Quaternion.ONE;
            }

            // get smoke cloud parameters
            const engineBackwardsPointInitial = rotation.rotateVector([0, 0, 1]);
            engineBackwardsPointInitial[2] = 0;
            const engineBackwardsPoint = DelaunayGraph.normalize(engineBackwardsPointInitial);
            const engineBackwards = Quaternion.fromBetweenVectors([0, 0, 1], engineBackwardsPoint).pow(App.VELOCITY_STEP / this.worldScale);

            // make left smoke cloud
            const smokeCloudLeft = new SmokeCloud();
            smokeCloudLeft.id = `${cameraId}-${Math.floor(Math.random() * 100000000)}`;
            smokeCloudLeft.position = cameraPosition.clone();
            smokeCloudLeft.positionVelocity = cameraOrientation.clone().inverse()
                .mul(cameraPosition.clone().inverse())
                .mul(Quaternion.fromAxisAngle([0, 0, 1], Math.PI / 4))
                .mul(engineBackwards.clone())
                .mul(cameraPosition.clone())
                .mul(cameraOrientation.clone());
            smokeCloudLeft.size = 2;
            smokeClouds.push(smokeCloudLeft);

            // make right smoke cloud
            const smokeCloudRight = new SmokeCloud();
            smokeCloudRight.id = `${cameraId}-${Math.floor(Math.random() * 100000000)}`;
            smokeCloudRight.position = cameraPosition.clone();
            smokeCloudLeft.positionVelocity = cameraOrientation.clone().inverse()
                .mul(cameraPosition.clone().inverse())
                .mul(Quaternion.fromAxisAngle([0, 0, 1], -Math.PI / 4))
                .mul(engineBackwards.clone())
                .mul(cameraPosition.clone())
                .mul(cameraOrientation.clone());
            smokeCloudRight.size = 2;
            smokeClouds.push(smokeCloudRight);
        }

        // handle main cannons
        if (activeKeys.includes(" ") && !cameraCannonLoading && cannonCoolDown <= 0) {
            cameraCannonLoading = new Date(Date.now());
        }
        if (!activeKeys.includes(" ") && cameraCannonLoading && faction && cannonCoolDown <= 0) {
            // cannon fire
            cameraCannonLoading = undefined;
            cannonCoolDown = 20;

            // fire cannons
            for (let i = 0; i < shipData.cannons.numCannons; i++) {
                // pick left or right side
                let jitterPoint: [number, number, number] = [i % 2 === 0 ? -1 : 1, 0, 0];
                // apply random jitter
                jitterPoint[1] += DelaunayGraph.randomInt() * 0.15;
                jitterPoint = DelaunayGraph.normalize(jitterPoint);
                const fireDirection = cameraOrientation.clone().rotateVector(jitterPoint);
                const fireVelocity = Quaternion.fromBetweenVectors([0, 0, 1], fireDirection).pow(App.PROJECTILE_SPEED / this.worldScale);

                // create a cannon ball
                const cannonBall = new CannonBall(faction.id);
                cannonBall.id = `${cameraId}-${Math.floor(Math.random() * 100000000)}`;
                cannonBall.position = cameraPosition.clone();
                cannonBall.positionVelocity = fireVelocity.clone();
                cannonBall.size = 15;
                cannonBall.damage = 10;
                cannonBalls.push(cannonBall);
            }
        }
        if (activeKeys.includes(" ") && cameraCannonLoading && Date.now() - +cameraCannonLoading > 3000) {
            // cancel cannon fire
            cameraCannonLoading = undefined;
        }

        // handle automatic cannonades
        for (let i = 0; i < this.ships[shipIndex].cannonadeCoolDown.length; i++) {
            const cannonadeCoolDown = this.ships[shipIndex].cannonadeCoolDown[i];
            if (cannonadeCoolDown <= 0) {
                // find nearby ship
                const targetVector = this.ships[shipIndex].fireControl.getTargetVector();
                if (!targetVector) {
                    continue;
                }

                // aim at ship with slight jitter
                const angle = Math.atan2(targetVector[1], targetVector[0]);
                const jitter = (Math.random() * 2 - 1) * 5 * Math.PI / 180;
                const jitterPoint: [number, number, number] = [
                    Math.cos(jitter + angle),
                    Math.sin(jitter + angle),
                    0
                ];
                const fireDirection = cameraOrientation.clone().rotateVector(jitterPoint);
                const fireVelocity = Quaternion.fromBetweenVectors([0, 0, 1], fireDirection).pow(App.PROJECTILE_SPEED / this.worldScale);

                // no faction, no cannon balls
                if (!faction) {
                    continue;
                }

                // roll a dice to have random cannonade fire
                if (Math.random() > 0.1) {
                    continue;
                }

                // create a cannon ball
                const cannonBall = new CannonBall(faction.id);
                cannonBall.id = `${cameraId}-${Math.floor(Math.random() * 100000000)}`;
                cannonBall.position = cameraPosition.clone();
                cannonBall.positionVelocity = fireVelocity.clone();
                cannonBall.size = 15;
                cannonBall.damage = 10;
                cannonBalls.push(cannonBall);

                // apply a cool down to the cannonades
                this.ships[shipIndex].cannonadeCoolDown[i] = 45;
            } else if (cannonadeCoolDown > 0) {
                this.ships[shipIndex].cannonadeCoolDown[i] = this.ships[shipIndex].cannonadeCoolDown[i] - 1;
            }
        }

        // if (activeKeys.some(key => ["a", "s", "d", "w", " "].includes(key)) && !isAutomated) {
        //     clearPathFindingPoints = true;
        // }

        // apply velocity
        if (cameraPositionVelocity !== Quaternion.ONE) {
            cameraPosition = cameraPosition.clone().mul(cameraPositionVelocity.clone().pow(speedFactor));
        }
        if (cameraOrientationVelocity !== Quaternion.ONE) {
            cameraOrientation = cameraOrientation.clone().mul(cameraOrientationVelocity.clone().pow(speedFactor));
        }
        if (cameraPosition !== this.ships[shipIndex].position && false) {
            const diffQuaternion = this.ships[shipIndex].position.clone().inverse().mul(cameraPosition.clone());
            cameraOrientation = cameraOrientation.clone().mul(diffQuaternion);
        }

        // handle cool downs
        if (cannonCoolDown > 0) {
            cannonCoolDown -= 1;
        }
        this.ships[shipIndex].handleHealthTick();

        this.ships[shipIndex].position = cameraPosition;
        this.ships[shipIndex].orientation = cameraOrientation;
        this.ships[shipIndex].positionVelocity = cameraPositionVelocity;
        this.ships[shipIndex].orientationVelocity = cameraOrientationVelocity;
        this.ships[shipIndex].cannonLoading = cameraCannonLoading;
        this.ships[shipIndex].cannonCoolDown = cannonCoolDown;
        if (clearPathFindingPoints) {
            this.ships[shipIndex].pathFinding.points = [];
        }
        if (!isAutomated)
            this.smokeClouds = smokeClouds;
        this.cannonBalls = cannonBalls;
    }

    public static computeIntercept(a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number]): [number, number, number] {
        const midPoint = DelaunayGraph.normalize(App.getAveragePoint([a, b]));
        const n1 = DelaunayGraph.crossProduct(a, b);
        const n2 = DelaunayGraph.crossProduct(c, d);
        const n = DelaunayGraph.crossProduct(n1, n2);
        return DelaunayGraph.dotProduct(n, midPoint) >= 0 ? n : [
            -n[0],
            -n[1],
            -n[2]
        ];
    }

    /**
     * Compute a cannon ball collision.
     * @param cannonBall The cannon ball to shoot.
     * @param ship The ship to collide against.
     * @param worldScale The size of the world.
     * @private
     */
    public static cannonBallCollision(cannonBall: ICollidable, ship: Ship, worldScale: number): IHitTest {
        const shipData = SHIP_DATA.find(s => s.shipType === ship.shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }

        const c = cannonBall.position.clone().rotateVector([0, 0, 1]);
        const d = cannonBall.position.clone().mul(
            ship.positionVelocity.clone().inverse().mul(cannonBall.positionVelocity.clone())
        ).rotateVector([0, 0, 1]);
        const cannonBallDistance = VoronoiGraph.angularDistance(c, d, worldScale);

        let hitPoint: [number, number, number] | null = null;
        let hitDistance: number | null = null;
        const hull = App.getPhysicsHull(shipData.hull, worldScale).map((q): Quaternion => {
            return ship.position.clone().mul(ship.orientation.clone()).mul(q);
        });
        for (let i = 0; i < hull.length; i++) {
            const a = hull[i % hull.length].rotateVector([0, 0, 1]);
            const b = hull[(i + 1) % hull.length].rotateVector([0, 0, 1]);
            const intercept = App.computeIntercept(a, b, c, d);
            const segmentLength = VoronoiGraph.angularDistance(a, b, worldScale);
            const interceptSegmentLength = VoronoiGraph.angularDistance(a, intercept, worldScale) + VoronoiGraph.angularDistance(intercept, b, worldScale);
            const isInsideSegment = interceptSegmentLength - PHYSICS_SCALE / worldScale * cannonBall.size * 2 <= segmentLength;
            const interceptVelocityLength = VoronoiGraph.angularDistance(c, intercept, worldScale) + VoronoiGraph.angularDistance(intercept, d, worldScale);
            const isInsideVelocity = interceptVelocityLength - PHYSICS_SCALE / worldScale <= cannonBallDistance;
            const interceptDistance = VoronoiGraph.angularDistance(c, intercept, worldScale);
            if (isInsideSegment && isInsideVelocity && (!hitPoint || (hitPoint && hitDistance && interceptDistance < hitDistance))) {
                hitPoint = intercept;
                hitDistance = interceptDistance;
            }
        }

        const hitTime: number | null = hitDistance ? hitDistance / cannonBallDistance : null;
        return {
            success: hitTime !== null && hitTime >= 0 && hitTime < 1,
            distance: hitDistance,
            point: hitPoint,
            time: hitTime,
        };
    }

    public gameLoop() {
        // expire smoke clouds
        const expiredSmokeClouds: SmokeCloud[] = [];
        for (const smokeCloud of this.smokeClouds) {
            const isExpired = +smokeCloud.expires > Date.now();
            if (isExpired) {
                expiredSmokeClouds.push(smokeCloud);
            }
        }
        for (const expiredSmokeCloud of expiredSmokeClouds) {
            const index = this.smokeClouds.findIndex(s => s === expiredSmokeCloud);
            if (index >= 0) {
                this.smokeClouds.splice(index, 1);
            }
        }
        
        // expire cannon balls and crates
        const expirableArrays: Array<IExpirableTicks[]> = [
            this.cannonBalls,
            this.crates
        ];
        for (const expirableArray of expirableArrays) {

            // collect expired entities
            const expiredEntities: IExpirableTicks[] = [];
            for (const entity of expirableArray) {
                const isExpired = entity.life >= entity.maxLife;
                if (isExpired) {
                    expiredEntities.push(entity);
                }
            }

            // remove expired entities
            for (const expiredEntity of expiredEntities) {
                const index = expirableArray.findIndex(s => s === expiredEntity);
                if (index >= 0) {
                    expirableArray.splice(index, 1);
                }
            }
        }

        // move cannon balls and crates
        const movableArrays: Array<Array<ICameraState & IExpirableTicks>> = [
            this.cannonBalls,
            this.crates
        ];
        for (const movableArray of movableArrays) {
            for (const entity of movableArray) {
                entity.position = entity.position.clone().mul(entity.positionVelocity.clone());
                entity.orientation = entity.orientation.clone().mul(entity.orientationVelocity.clone());
                entity.life += 1;
            }
        }

        // handle physics and collision detection
        const collidableArrays: Array<{
            arr: ICollidable[],
            collideFn: (this: App, ship: Ship, entity: ICollidable, hit: IHitTest) => void,
            useRayCast: boolean
        }> = [{
            arr: this.cannonBalls,
            collideFn(this: App, ship: Ship, entity: ICollidable, hit: IHitTest) {
                ship.applyDamage(entity as CannonBall);

                // make collision smoke cloud
                if (hit.point) {
                    const smokeCloud = new SmokeCloud();
                    smokeCloud.id = `${ship.id}-${Math.floor(Math.random() * 100000000)}`;
                    smokeCloud.position = Quaternion.fromBetweenVectors([0, 0, 1], hit.point);
                    smokeCloud.size = 2;
                    this.smokeClouds.push(smokeCloud);
                }
            },
            useRayCast: true
        }, {
            arr: this.crates,
            collideFn(this: App, ship: Ship, entity: ICollidable, hit: IHitTest) {
                ship.pickUpCargo(entity as Crate);
            },
            useRayCast: false
        }];
        for (const { arr: collidableArray, collideFn, useRayCast } of collidableArrays) {
            const entitiesToRemove = [];
            for (const entity of collidableArray) {
                // get nearby ships
                const position = entity.position.rotateVector([0, 0, 1]);
                const nearByShips = Array.from(this.voronoiShips.listItems(position));

                // compute closest ship
                let bestHit: IHitTest | null = null;
                let bestShip: Ship | null = null;
                for (const nearByShip of nearByShips) {
                    if (useRayCast) {
                        const hit = App.cannonBallCollision(entity, nearByShip, this.worldScale);
                        if (hit.success && hit.time && (!bestHit || (bestHit && bestHit.time && hit.time < bestHit.time))) {
                            bestHit = hit;
                            bestShip = nearByShip;
                        }
                    } else {
                        const point = nearByShip.position.rotateVector([0, 0, 1]);
                        const distance = VoronoiGraph.angularDistance(
                            point,
                            position,
                            this.worldScale
                        );
                        if (distance < PHYSICS_SCALE * (entity.size || 1) && (!bestHit || (bestHit && bestHit.distance && distance < bestHit.distance))) {
                            bestHit = {
                                success: true,
                                distance,
                                time: 0,
                                point
                            };
                            bestShip = nearByShip;
                        }
                    }
                }

                // apply damage
                const teamDamage = bestShip && bestShip.faction && entity.factionId && bestShip.faction.id === entity.factionId;
                if (bestHit && bestShip && !teamDamage) {
                    collideFn.call(this, bestShip, entity, bestHit);
                    entitiesToRemove.push(entity);
                }
            }
            // remove collided cannon balls
            for (const entityToRemove of entitiesToRemove) {
                const index = collidableArray.findIndex(c => c === entityToRemove);
                if (index >= 0) {
                    collidableArray.splice(index, 1);
                }
            }
        }

        // update collision acceleration structures
        for (const ship of this.ships) {
            this.voronoiShips.removeItem(ship);
        }

        // move player ship if auto pilot is off
        const playerShipIndex = this.ships.findIndex(ship => ship === this.playerShip);
        if (!this.state.autoPilotEnabled && this.playerShip) {
            this.handleShipLoop(playerShipIndex, () => this.activeKeys, false);
        }

        // AI ship loop
        const destroyedShips: Ship[] = [];
        for (let i = 0; i < this.ships.length; i++) {
            const ship = this.ships[i];

            // handle ship health
            if (ship.health <= 0) {
                destroyedShips.push(ship);
                const crates = ship.destroy();
                for (const crate of crates) {
                    this.crates.push(crate);
                }
                continue;
            }

            // handle ship orders
            // handle automatic piracy orders
            const hasPiracyOrder: boolean = ship.hasPirateOrder();
            const hasPirateCargo: boolean = ship.hasPirateCargo();
            if (!hasPiracyOrder && hasPirateCargo && ship.faction) {
                const piracyOrder = new Order(this, ship, ship.faction);
                piracyOrder.orderType = EOrderType.PIRATE;
                ship.orders.splice(0, 0, piracyOrder);
            }
            // get new orders from faction
            if (ship.orders.length === 0) {
                const faction = Object.values(this.factions).find(f => f.shipIds.includes(this.ships[i].id));
                if (faction) {
                    ship.orders.push(faction.getOrder(ship));
                }
            }
            // handle first priority order
            const shipOrder = ship.orders[0];
            if (shipOrder) {
                shipOrder.handleOrderLoop();
            }

            if (ship.fireControl.targetShipId) {
                // handle firing at ships
                ship.fireControl.fireControlLoop();
            }
            // handle pathfinding
            ship.pathFinding.pathFindingLoop(ship.fireControl.isAttacking);
            // ship is player ship if autoPilot is not enabled
            if (!(i === playerShipIndex && !this.state.autoPilotEnabled)) {
                this.handleShipLoop(i, () => ship.activeKeys, true);
            }
        }

        // remove destroyed ships
        for (const destroyedShip of destroyedShips) {
            if (destroyedShip === this.playerShip) {
                this.playerShip = null;
                this.setState({
                    showSpawnMenu: true
                });
            }
            const index = this.ships.findIndex(s => s === destroyedShip);
            if (index >= 0) {
                this.ships.splice(index, 1);
            }
        }

        // update collision acceleration structures
        for (const ship of this.ships) {
            this.voronoiShips.addItem(ship);
        }

        for (const ship of this.ships) {
            // handle detecting ships to shoot at
            if (!ship.fireControl.targetShipId || ship.fireControl.retargetCoolDown) {
                // get a list of nearby ships
                const shipPosition = ship.position.clone().rotateVector([0, 0, 1]);
                const nearByShips = Array.from(this.voronoiShips.listItems(shipPosition));
                const nearByEnemyShips: Ship[] = [];
                const nearByFriendlyShips: Ship[] = [];
                for (const nearByShip of nearByShips) {
                    if (VoronoiGraph.angularDistance(
                        nearByShip.position.clone().rotateVector([0, 0, 1]),
                        shipPosition,
                        this.worldScale
                    ) < App.PROJECTILE_DETECTION_RANGE) {
                        if (!(nearByShip.faction && ship.faction && nearByShip.faction.id === ship.faction.id)) {
                            nearByEnemyShips.push(nearByShip);
                        } else {
                            nearByFriendlyShips.push(nearByShip);
                        }
                    }
                }

                // find closest target
                let closestTarget: Ship | null = null;
                let closestDistance: number | null = null;
                // also count the number of cannons
                let numEnemyCannons: number = 0;
                let numFriendlyCannons: number = 0;
                for (const nearByEnemyShip of nearByEnemyShips) {
                    const distance = VoronoiGraph.angularDistance(
                        shipPosition,
                        nearByEnemyShip.position.clone().rotateVector([0, 0, 1]),
                        this.worldScale
                    );
                    if (!closestDistance || distance < closestDistance) {
                        closestDistance = distance;
                        closestTarget = nearByEnemyShip;
                    }

                    const shipData = SHIP_DATA.find(s => s.shipType === nearByEnemyShip.shipType);
                    if (!shipData) {
                        throw new Error("Could not find ship type");
                    }
                    numEnemyCannons += shipData.cannons.numCannons;
                }
                for (const nearByFriendlyShip of nearByFriendlyShips) {
                    const shipData = SHIP_DATA.find(s => s.shipType === nearByFriendlyShip.shipType);
                    if (!shipData) {
                        throw new Error("Could not find ship type");
                    }
                    numFriendlyCannons += shipData.cannons.numCannons;
                }

                // set closest target
                if (closestTarget) {
                    ship.fireControl.targetShipId = closestTarget.id;
                    if (!this.demoAttackingShipId || +this.lastDemoAttackingShipTime + 30 * 1000 < +new Date()) {
                        this.demoAttackingShipId = ship.id;
                        this.lastDemoAttackingShipTime = new Date();
                    }
                }

                // if too many ships, cancel order and stop attacking
                const currentShipData = SHIP_DATA.find(s => s.shipType === ship.shipType);
                if (!currentShipData) {
                    throw new Error("Could not find ship type");
                }
                if (numEnemyCannons > (numFriendlyCannons + currentShipData.cannons.numCannons) * 1.5 && ship.hasPirateOrder()) {
                    for (const order of ship.orders) {
                        order.cancelOrder(numEnemyCannons);
                        ship.fireControl.isAttacking = false;
                    }
                }
            }
        }

        // handle luxury buffs
        for (const resourceType of Object.values(OUTPOST_GOODS)) {
            for (const faction of Object.values(this.factions)) {
                LuxuryBuff.CalculateGoldBuff(this, faction, resourceType);
            }
        }

        // handle planet loop
        for (const planet of this.planets) {
            planet.handlePlanetLoop();
        }

        // handle AI factions
        for (const faction of Object.values(this.factions)) {
            faction.handleFactionLoop();
        }

        if (this.refreshVoronoiDataTick <= 20) {
            this.refreshVoronoiDataTick += 1;
        } else {
            this.refreshVoronoiDataTick = 0;
            this.refreshVoronoiData();
        }

        this.forceUpdate();
    }

    private handleShowNotes() {
        if (this.showNotesRef.current) {
            this.setState({
                ...this.state,
                showNotes: this.showNotesRef.current.checked,
            });
        }
    }

    private handleShowShips() {
        if (this.showShipsRef.current) {
            this.setState({
                ...this.state,
                showShips: this.showShipsRef.current.checked,
            });
        }
    }

    private handleShowItems() {
        if (this.showItemsRef.current) {
            this.setState({
                ...this.state,
                showItems: this.showItemsRef.current.checked,
            });
        }
    }

    private handleShowDelaunay() {
        if (this.showDelaunayRef.current) {
            this.setState({
                ...this.state,
                showDelaunay: this.showDelaunayRef.current.checked,
            });
        }
    }

    private handleShowVoronoi() {
        if (this.showVoronoiRef.current) {
            this.setState({
                ...this.state,
                showVoronoi: this.showVoronoiRef.current.checked,
            });
        }
    }

    private handleChangeVoronoi(voronoiMode: EVoronoiMode) {
        this.setState({
            ...this.state,
            voronoiMode,
        }, () => {
            this.refreshVoronoiData();
        });
    }

    private handleAutoPilotEnabled() {
        if (this.autoPilotEnabledRef.current) {
            this.setState({
                ...this.state,
                autoPilotEnabled: this.autoPilotEnabledRef.current.checked,
            });
        }
    }

    private handleAudioEnabled() {
        if (this.audioEnabledRef.current) {
            this.setState({
                ...this.state,
                audioEnabled: this.audioEnabledRef.current.checked,
            });
            if (this.audioEnabledRef.current.checked) {
                this.music.start();
            } else {
                this.music.stop();
            }
        }
    }

    private static getKeyString(event: KeyboardEvent): string {
        switch (event.key) {
            case "ArrowUp": return "w";
            case "ArrowDown": return "s";
            case "ArrowLeft": return "a";
            case "ArrowRight": return "d";
            default: return event.key;
        }
    }

    private handleKeyDown(event: KeyboardEvent) {
        if (!this.activeKeys.includes(App.getKeyString(event))) {
            this.activeKeys.push(App.getKeyString(event));
        }
    }

    private handleKeyUp(event: KeyboardEvent) {
        const index = this.activeKeys.findIndex(k => k === App.getKeyString(event));
        if (index >= 0) {
            this.activeKeys.splice(index, 1);
        }
    }

    private incrementZoom() {
        const zoom = Math.min(this.state.zoom * 2, 32);
        this.setState({
            ...this.state,
            zoom
        });
    }

    private decrementZoom() {
        const zoom = Math.max(this.state.zoom / 2, 1);
        this.setState({
            ...this.state,
            zoom
        });
    }

    /**
     * Initialize random position and orientation for an entity.
     * @param entity The entity to add random position and orientation to.
     * @private
     */
    public static addRandomPositionAndOrientationToEntity(entity: ICameraState) {
        entity.position = new Quaternion(0, App.randomRange(), App.randomRange(), App.randomRange());
        entity.position = entity.position.normalize();
        entity.orientation = Quaternion.fromAxisAngle([0, 0, 1], Math.random() * 2 * Math.PI);
    }

    public generateGoodPoints<T extends ICameraState>(numPoints: number, numSteps: number): VoronoiCell[] {
        if (numPoints < 4) {
            throw new Error("Not enough points to initialize sphere");
        }
        let delaunayGraph = new DelaunayGraph<T>(this);
        let voronoiGraph = new VoronoiGraph<T>(this);
        delaunayGraph.initialize();
        for (let i = 0; i < numPoints - 4; i++) {
            delaunayGraph.incrementalInsert();
        }
        for (let step = 0; step < numSteps; step++) {
            // this line is needed because inserting vertices could remove old vertices.
            while (delaunayGraph.numRealVertices() < numPoints) {
                delaunayGraph.incrementalInsert();
            }
            voronoiGraph = delaunayGraph.getVoronoiGraph();
            const lloydPoints = voronoiGraph.lloydRelaxation();
            delaunayGraph = new DelaunayGraph<T>(this);
            delaunayGraph.initializeWithPoints(lloydPoints);
        }
        // this line is needed because inserting vertices could remove old vertices.
        while (delaunayGraph.numRealVertices() < numPoints) {
            delaunayGraph.incrementalInsert();
        }
        voronoiGraph = delaunayGraph.getVoronoiGraph();
        return voronoiGraph.cells;
    }

    public generateTessellatedPoints<T extends ICameraState>(tessellationLevel: number, numSteps: number): VoronoiCell[] {
        let delaunayGraph = new DelaunayGraph<T>(this);
        let voronoiGraph = new VoronoiGraph<T>(this);
        delaunayGraph.initialize();

        // generate tessellated points to a tessellation level
        const tessellatedPoints = Array.from(delaunayGraph.GetTriangles())
            .map(this.rotateDelaunayTriangle.bind(this, false))
            .reduce((acc, tile) => {
                const tessellatedTriangles = Array.from(this.getDelaunayTileTessellation(tile.centroid, tile.vertices, tessellationLevel, 1));
                return [
                    ...acc,
                    ...tessellatedTriangles.map(t => {
                        return DelaunayGraph.normalize(
                            App.getAveragePoint(t.vertices.map(v => v.rotateVector([0, 0, 1])))
                        );
                    })
                ];
            }, [] as Array<[number, number, number]>);
        const jitteredTessellatedPoints = tessellatedPoints.map(t => {
            const jitter = DelaunayGraph.randomPoint();
            const jitterAmount = 0;
            return DelaunayGraph.normalize([
                t[0] + jitter[0] * jitterAmount,
                t[1] + jitter[1] * jitterAmount,
                t[2] + jitter[2] * jitterAmount
            ]);
        });

        // add jittered tessellated points
        for (const point of jitteredTessellatedPoints) {
            delaunayGraph.incrementalInsert(point);
        }

        for (let step = 0; step < numSteps; step++) {
            // this line is needed because inserting vertices could remove old vertices.
            while (delaunayGraph.numRealVertices() < Math.pow(4, tessellationLevel) + 4) {
                delaunayGraph.incrementalInsert();
            }
            voronoiGraph = delaunayGraph.getVoronoiGraph();
            const lloydPoints = voronoiGraph.lloydRelaxation();
            delaunayGraph = new DelaunayGraph<T>(this);
            delaunayGraph.initializeWithPoints(lloydPoints);
        }
        // this line is needed because inserting vertices could remove old vertices.
        while (delaunayGraph.numRealVertices() < Math.pow(4, tessellationLevel) + 4) {
            delaunayGraph.incrementalInsert();
        }
        voronoiGraph = delaunayGraph.getVoronoiGraph();
        return voronoiGraph.cells;
    }

    public buildStar(point: [number, number, number], index: number): Star {
        const star = new Star(this);
        star.id = `star-${index}`;
        star.position = Quaternion.fromBetweenVectors([0, 0, 1], point);
        if (index % 5 === 0 || index % 5 === 1) {
            star.color = "blue";
            star.size = 5;
        } else if (index % 5 === 2 || index % 5 === 3) {
            star.color = "yellow";
            star.size = 2.5;
        } else if (index % 5 === 4) {
            star.color = "red";
            star.size = 7.5;
        }
        return star;
    }

    public lerpColors(a: string, b: string, t: number): string {
        const v1: number[] = [
            parseInt(a.slice(1, 3), 16),
            parseInt(a.slice(3, 5), 16),
            parseInt(a.slice(5, 7), 16)
        ];
        const v2: number[] = [
            parseInt(b.slice(1, 3), 16),
            parseInt(b.slice(3, 5), 16),
            parseInt(b.slice(5, 7), 16)
        ];
        const v3 = [
            Math.floor(v1[0] * (1 - t) + v2[0] * t),
            Math.floor(v1[1] * (1 - t) + v2[1] * t),
            Math.floor(v1[2] * (1 - t) + v2[2] * t)
        ];
        const v4 = [v3[0].toString(16), v3[1].toString(16), v3[2].toString(16)];
        return `#${v4[0].length === 2 ? v4[0] : `0${v4[0]}`}${v4[1].length === 2 ? v4[1] : `0${v4[1]}`}${v4[2].length === 2 ? v4[2] : `0${v4[2]}`}`;
    }

    /**
     * Create a planet.
     * @param planetPoint The point the planet is created at.
     * @param county The feudal county of the planet.
     * @param planetI The index of the planet.
     * @param isCapital If the planet is a capital.
     * @private
     */
    public createPlanet(planetPoint: [number, number, number], county: VoronoiCounty, planetI: number): Planet {
        const planet = new Planet(this, county);
        planet.id = `planet-${planetI}`;
        planet.position = Quaternion.fromBetweenVectors([0, 0, 1], planetPoint);
        planet.position = planet.position.normalize();
        planet.orientation = Quaternion.fromAxisAngle([0, 0, 1], Math.random() * 2 * Math.PI);
        const colorValue = Math.random();
        if (colorValue > 0.875)
            planet.color = this.lerpColors(planet.county.duchy.color, "#ff8888", 0.33);
        else if (colorValue > 0.75)
            planet.color = this.lerpColors(planet.county.duchy.color, "#88ff88", 0.33);
        else if (colorValue > 0.625)
            planet.color = this.lerpColors(planet.county.duchy.color, "#8888ff", 0.33);
        else if (colorValue > 0.5)
            planet.color = this.lerpColors(planet.county.duchy.color, "#ffff88", 0.33);
        else if (colorValue > 0.375)
            planet.color = this.lerpColors(planet.county.duchy.color, "#88ffff", 0.33);
        else if (colorValue > 0.25)
            planet.color = this.lerpColors(planet.county.duchy.color, "#ff88ff", 0.33);
        else if (colorValue > 0.125)
            planet.color = this.lerpColors(planet.county.duchy.color, "#ffffff", 0.33);
        else
            planet.color = this.lerpColors(planet.county.duchy.color, "#888888", 0.33);
        planet.buildInitialResourceBuildings();
        planet.recomputeResources();
        planet.pathingNode = this.delaunayGraph.createPathingNode(planet.position.rotateVector([0, 0, 1]));
        return planet;
    }

    refreshVoronoiData() {
        const position = this.getPlayerShip().position.rotateVector([0, 0, 1]);

        switch (this.state.voronoiMode) {
            default:
            case EVoronoiMode.KINGDOM: {
                this.voronoiData = this.voronoiTerrain.kingdoms.reduce((acc, k) => {
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
                this.voronoiData = this.voronoiTerrain.kingdoms.reduce((acc, k) => {
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
                this.voronoiData = this.voronoiTerrain.kingdoms.reduce((acc, k) => {
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

    componentDidMount() {
        // set initial world scale
        if (this.props.isVoronoiTestMode) {
            this.worldScale = 1;
        }
        if (typeof(this.props.worldScale) === "number") {
            this.worldScale = this.props.worldScale;
        }

        // initialize voronoi test mode parameters
        if (this.props.isVoronoiTestMode) {
            this.setState({
                zoom: 1,
                showVoronoi: true
            });
        }

        // initialize 3d terrain stuff
        this.delaunayGraph.initialize();
        this.delaunayData = Array.from(this.delaunayGraph.GetTriangles());
        this.voronoiGraph = this.delaunayGraph.getVoronoiGraph();
        this.voronoiData = this.voronoiGraph.cells;
        this.voronoiTerrain.generateTerrain();
        this.refreshVoronoiData();

        // initialize planets
        this.planets = Array.from(this.voronoiTerrain.getPlanets());

        // initialize factions
        if (!this.props.isVoronoiTestMode) {
            const factionStartingPoints = this.generateGoodPoints(5, 10).map(p => p.centroid);
            let factionStartingKingdoms = this.voronoiTerrain.kingdoms;
            const getStartingKingdom = (point: [number, number, number]): VoronoiKingdom => {
                // get the closest kingdom to the point
                const kingdom = factionStartingKingdoms.reduce((acc, k) => {
                    if (!acc) {
                        return k;
                    } else {
                        const distanceToAcc = VoronoiGraph.angularDistance(point, acc.voronoiCell.centroid, this.worldScale);
                        const distanceToK = VoronoiGraph.angularDistance(point, k.voronoiCell.centroid, this.worldScale);
                        if (distanceToK < distanceToAcc) {
                            return k;
                        } else {
                            return acc;
                        }
                    }
                }, null as VoronoiKingdom | null);

                // handle empty value
                if (!kingdom) {
                    throw new Error("Could not find a kingdom to start a faction on");
                }

                // return closest kingdom
                factionStartingKingdoms = factionStartingKingdoms.filter(k => k !== kingdom);
                return kingdom;
            };
            const factionDataList = [{
                id: EFaction.DUTCH,
                color: "orange",
                // the forth planet is always in a random location
                // the dutch are a republic which means players can vote on things
                // but the dutch are weaker compared to the kingdoms
                kingdom: getStartingKingdom(factionStartingPoints[0])
            }, {
                id: EFaction.ENGLISH,
                color: "red",
                kingdom: getStartingKingdom(factionStartingPoints[1])
            }, {
                id: EFaction.FRENCH,
                color: "blue",
                kingdom: getStartingKingdom(factionStartingPoints[2])
            }, {
                id: EFaction.PORTUGUESE,
                color: "green",
                kingdom: getStartingKingdom(factionStartingPoints[3])
            }, {
                id: EFaction.SPANISH,
                color: "yellow",
                kingdom: getStartingKingdom(factionStartingPoints[4])
            }];
            for (const factionData of factionDataList) {
                let planetId: string | null = null;
                if (factionData.kingdom) {
                    for (const duchy of factionData.kingdom.duchies) {
                        for (const county of duchy.counties) {
                            if (county.planet) {
                                planetId = county.planet.id;
                                break;
                            }
                        }
                        if (planetId) {
                            break;
                        }
                    }
                }
                if (!planetId) {
                    throw new Error("Could not find planet to make faction");
                }
                const faction = new Faction(this, factionData.id, factionData.color, planetId);
                this.factions[factionData.id] = faction;
                const planet = this.planets.find(p => p.id === planetId);
                if (planet) {
                    planet.setAsStartingCapital();
                    planet.claim(faction);
                }
                if (planet && !this.props.isTestMode) {
                    for (let numShipsToStartWith = 0; numShipsToStartWith < 10; numShipsToStartWith++) {
                        const shipType = planet.shipyard.getNextShipTypeToBuild();
                        const shipData = SHIP_DATA.find(s => s.shipType === shipType);
                        if (!shipData) {
                            throw new Error("Could not find ship type");
                        }
                        planet.wood += shipData.cost;
                        planet.cannons += shipData.cannons.numCannons;
                        planet.cannonades += shipData.cannons.numCannonades;
                        planet.shipyard.buildShip(shipType);
                        const dock = planet.shipyard.docks[planet.shipyard.docks.length - 1];
                        if (dock) {
                            dock.progress = dock.shipCost - 1;
                        }
                    }
                }
            }
        }

        if (!this.props.isTestMode) {
            this.rotateCameraInterval = setInterval(this.gameLoop.bind(this), 100);
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
                ((x / size) - 0.5) * 2 / (this.state.zoom * this.worldScale),
                ((y / size) - 0.5) * 2 / (this.state.zoom * this.worldScale),
                0
            ];
            clickScreenPoint[1] *= -1;
            clickScreenPoint[2] = Math.sqrt(1 - Math.pow(clickScreenPoint[0], 2) - Math.pow(clickScreenPoint[1], 2));

            // compute sphere position
            const clickQuaternion = Quaternion.fromBetweenVectors([0, 0, 1], clickScreenPoint);
            const ship = this.getPlayerShip();
            const spherePoint = ship.position.clone()
                .mul(ship.orientation.clone())
                .mul(clickQuaternion)
                .rotateVector([0, 0, 1]);

            if (this.props.isVoronoiTestMode) {
                // insert into delaunay graph
                this.delaunayGraph.incrementalInsert(spherePoint);

                // insert multiple if shift key is down
                if (event.shiftKey) {
                    for (let i = 0; i < 9; i++) {
                        this.delaunayGraph.incrementalInsert();
                    }
                }

                // rebuild delaunay data
                this.delaunayData = Array.from(this.delaunayGraph.GetTriangles());
                this.voronoiGraph = this.delaunayGraph.getVoronoiGraph();
                this.voronoiData = this.voronoiGraph.cells;
            }
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
                    this.state.showDelaunay ?
                        this.delaunayData.map(this.rotateDelaunayTriangle.bind(this, false))
                            .map(this.drawDelaunayTile.bind(this, false)) :
                        null
                }
                {
                    this.state.showVoronoi ?
                        this.voronoiData.filter(d => {
                            return VoronoiGraph.angularDistance(
                                this.getPlayerShip().position.rotateVector([0, 0, 1]),
                                d.centroid,
                                this.worldScale
                            ) < (Math.PI / (this.worldScale * this.state.zoom)) + d.radius;
                        }).map(this.rotateDelaunayTriangle.bind(this, !!this.props.isVoronoiTestMode))
                            .map(this.drawDelaunayTile.bind(this, !!this.props.isVoronoiTestMode)) :
                        null
                }
                {/*{*/}
                {/*    this.state.showVoronoi ?*/}
                {/*        this.voronoiShipsCells.map(this.rotateDelaunayTriangle.bind(this))*/}
                {/*            .map(this.drawDelaunayTile.bind(this)) :*/}
                {/*        null*/}
                {/*}*/}
                {
                    ([
                        ...Array.from(this.voronoiTerrain.getStars(shipPosition)).map(this.rotatePlanet.bind(this))
                            .map(this.convertToDrawable.bind(this, "-star2", 0.5)),
                        ...Array.from(this.voronoiTerrain.getStars(shipPosition)).map(this.rotatePlanet.bind(this))
                            .map(this.convertToDrawable.bind(this, "-star3", 0.25)),
                        ...Array.from(this.voronoiTerrain.getStars(shipPosition)).map(this.rotatePlanet.bind(this))
                            .map(this.convertToDrawable.bind(this, "-star4", 0.125))
                    ] as Array<IDrawable<Planet>>)
                        .sort((a: any, b: any) => b.distance - a.distance)
                        .map(this.drawStar.bind(this))
                }
                {
                    (Array.from(this.voronoiTerrain.getPlanets(shipPosition)).map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-planet", 1)) as Array<IDrawable<Planet>>)
                        .map(this.drawPlanet.bind(this, false))
                }
                {
                    (this.smokeClouds.map(App.applyKinematics.bind(this))
                        .map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-smokeClouds", 1)) as Array<IDrawable<SmokeCloud>>)
                        .map(this.drawSmokeCloud.bind(this))
                }
                {
                    (this.cannonBalls.map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-cannonBalls", 1)) as Array<IDrawable<SmokeCloud>>)
                        .map(this.drawSmokeCloud.bind(this))
                }
                {
                    (this.crates.map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-crates", 1)) as Array<IDrawable<Crate>>)
                        .map(this.drawCrate.bind(this, false))
                }
                {
                    (this.ships.map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-ships", 1)) as Array<IDrawable<Ship>>)
                        .map(this.drawShip.bind(this))
                }
                {
                    (Array.from(this.voronoiTerrain.getPlanets(shipPosition)).map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-planet", 1)) as Array<IDrawable<Planet>>)
                        .map(this.drawPlanet.bind(this, true))
                }
                {
                    (this.crates.map(this.rotatePlanet.bind(this))
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
                <text x="25" y="60" textAnchor="center">{(this.state.zoom * this.worldScale)}</text>
                <rect x="40" y="45" width="20" height="20" fill="grey" onClick={this.incrementZoom.bind(this)}/>
                <text x="5" y="60" onClick={this.decrementZoom.bind(this)}>-</text>
                <text x="40" y="60" onClick={this.incrementZoom.bind(this)}>+</text>
                {
                    this.playerShip && (
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
        const numPathingNodes = this.playerShip && this.playerShip.pathFinding.points.length;
        const distanceToNode = this.playerShip && this.playerShip.pathFinding.points.length > 0 ?
            VoronoiGraph.angularDistance(
                this.playerShip.position.rotateVector([0, 0, 1]),
                this.playerShip.pathFinding.points[0],
                this.worldScale
            ) :
            0;

        const order = this.playerShip && this.playerShip.orders[0];
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
        if (this.playerShip) {
            const shipType = this.playerShip.shipType;
            const shipData = SHIP_DATA.find(s => s.shipType === shipType);
            if (!shipData) {
                throw new Error("Could not find ship type");
            }

            const cargoSlotSize = Math.min(50, this.state.width / shipData.cargoSize);
            const cargos = this.playerShip.cargo;
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
        const faction = Object.values(this.factions).find(f => this.playerShip && f.shipIds.includes(this.playerShip.id));
        if (faction) {
            return (
                <g key="faction-status" transform={`translate(${this.state.width - 80},${this.state.height - 80})`}>
                    <text x="0" y="30" fontSize={8} color="black">Faction: {faction.id}</text>
                    <text x="0" y="45" fontSize={8} color="black">Gold: {faction.gold}</text>
                    <text x="0" y="60" fontSize={8} color="black">Planet{faction.planetIds.length > 1 ? "s" : ""}: {faction.planetIds.length}</text>
                    <text x="0" y="75" fontSize={8} color="black">Ship{faction.shipIds.length > 1 ? "s" : ""}: {faction.shipIds.length}</text>
                </g>
            );
        } else {
            return null;
        }
    }

    private renderPlayerStatus() {
        if (this.playerShip) {
            return (
                <g key="player-status" transform={`translate(0,${this.state.height - 80})`}>
                    <text x="0" y="45" fontSize={8} color="black">Gold: {this.gold}</text>
                </g>
            );
        } else {
            return null;
        }
    }

    public selectFaction(faction: EFaction) {
        this.setState({
            faction,
            showMainMenu: false,
            showSpawnMenu: true,
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

    public beginSpawnShip(planetId: string, shipType: EShipType) {
        if (this.state.faction) {
            this.setState({
                showSpawnMenu: false
            });
            const planet = this.planets.find(p => p.id === planetId);
            if (planet && this.gold >= planet.shipyard.quoteShip(shipType)) {
                this.playerShip = planet.shipyard.buyShip(this, shipType);
            } else {
                this.returnToMainMenu();
            }
        } else {
            this.returnToMainMenu();
        }
    }

    public returnToMainMenu() {
        this.setState({
            showSpawnMenu: false,
            showMainMenu: true,
            faction: null
        });
        this.playerShip = null;
    }

    private renderSpawnMenu() {
        const x = this.state.width / 3;
        const y = this.state.height / 2 + 50;
        const width = (this.state.width / 3) - 20;
        const height = 40;
        const spawnLocations = [];
        let faction: Faction | null = null;
        if (this.state.faction) {
            faction = this.factions[this.state.faction];
        }
        if (faction) {
            const planetsToSpawnAt = this.planets.filter(p => faction && faction.planetIds.includes(p.id))
                .sort((a, b) => {
                    const settlementLevelDifference = b.settlementLevel - a.settlementLevel;
                    if (settlementLevelDifference !== 0) {
                        return settlementLevelDifference;
                    }
                    const settlementProgressDifference = b.settlementProgress - a.settlementProgress;
                    if (settlementProgressDifference !== 0) {
                        return settlementProgressDifference;
                    }
                    if (a.id > b.id) {
                        return -1;
                    } else {
                        return 1;
                    }
                }
            );

            for (const planet of planetsToSpawnAt) {
                for (const shipType of Object.values(EShipType)) {
                    const numShipsAvailable = planet.getNumShipsAvailable(shipType);
                    if (numShipsAvailable > 0) {
                        spawnLocations.push({
                            id: planet.id,
                            numShipsAvailable,
                            price: planet.shipyard.quoteShip(shipType),
                            shipType
                        });
                    }
                }
            }
        }
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
                    spawnLocations.map((spawnLocation, index) => {
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

    getShowShipDrawing(id: string, shipType: EShipType, factionType: EFaction | null = null): IDrawable<Ship> {
        const original: Ship = new Ship(this, shipType);
        original.id = id;
        if (factionType) {
            const faction = Object.values(this.factions).find(f => f.id === factionType);
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
                            <input type="checkbox" tabIndex={-1} ref={this.showDelaunayRef} checked={this.state.showDelaunay} onChange={this.handleShowDelaunay.bind(this)}/>
                            <span>Show Delaunay</span>
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
                            <li>Added nested delaunay and nested voronoi.</li>
                            <li>Add Imperial/Colonial empire design, the capital will upgrade certain locations into high level planets.</li>
                            <li>Add tax trading where planets will pay taxes to the capital.</li>
                            <li>Pirate hunters.</li>
                            <li>Factions will plan invasions of enemy colonies and capitals.</li>
                            <li>Add multiplayer...</li>
                            <li>Break game into client and server.</li>
                            <li>Add multiple clients.</li>
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
                            this.state.showMainMenu && !this.props.isVoronoiTestMode ? this.renderMainMenu.call(this) : null
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
