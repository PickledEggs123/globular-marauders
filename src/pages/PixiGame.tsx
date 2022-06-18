import React, {Fragment} from 'react';
import '../App.scss';
import Quaternion from "quaternion";
import SockJS from "sockjs-client";
import * as PIXI from "pixi.js";
import * as particles from "@pixi/particle-emitter";
import {IMediaInstance, PlayOptions, sound} from "@pixi/sound";
import {EResourceType, ITEM_DATA} from "@pickledeggs123/globular-marauders-game/lib/src/Resource";
import {
    ICameraState,
    ICameraStateWithOriginal,
    IDrawable,
    IFormResult,
    MIN_DISTANCE
} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import {Ship,} from "@pickledeggs123/globular-marauders-game/lib/src/Ship";
import {
    EShipType,
    GetShipData,
    PHYSICS_SCALE,
    SHIP_DATA,
} from "@pickledeggs123/globular-marauders-game/lib/src/ShipType";
import {EFaction,} from "@pickledeggs123/globular-marauders-game/lib/src/EFaction";
import {
    DelaunayGraph,
    ITessellatedTriangle,
    VoronoiCell,
    VoronoiGraph
} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";
import {Planet} from "@pickledeggs123/globular-marauders-game/lib/src/Planet";
import {DeserializeQuaternion, SerializeQuaternion,} from "@pickledeggs123/globular-marauders-game/lib/src/Item";
import {
    EMessageType,
    ESoundEventType,
    ESoundType,
    Game,
    IAutoPilotMessage,
    IChooseFactionMessage,
    IChoosePlanetMessage,
    IGameInitializationFrame,
    IGameSyncFrame,
    IJoinMessage,
    IMessage,
    IPlayerData,
    ISpawnFaction,
    ISpawnLocationResult,
    ISpawnMessage,
    ISpawnPlanet
} from "@pickledeggs123/globular-marauders-game/lib/src/Game";
import {MusicPlayer} from "../MusicPlayer";
import {
    Avatar,
    Badge,
    Button,
    Card,
    CardActionArea,
    CardActions,
    CardContent,
    CardHeader,
    Checkbox,
    Dialog,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Grid,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Paper,
    Popper,
    Radio,
    RadioGroup,
    Stack,
    SvgIcon,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import {DEFAULT_IMAGE, EVoronoiMode, RESOURCE_TYPE_TEXTURE_PAIRS, SPACE_BACKGROUND_TEXTURES} from "../helpers/Data";
import {EGameMode, EParticleState, IPixiGameProps, PixiGameBase} from "./PixiGameBase";
import {DirectionsBoat, MusicNote, MusicOff, People, Public, School, SmartToy, Tv, TvOff} from "@mui/icons-material";
import {EOrderType} from "@pickledeggs123/globular-marauders-game/lib/src/Order";
import {EInvasionPhase, Invasion} from "@pickledeggs123/globular-marauders-game/lib/src/Invasion";
import {ReactComponent as Pirate} from "../icons/pirate.svg";
import {ReactComponent as Attack} from "../icons/attack.svg";
import {ReactComponent as WasdImage} from "../icons/wasd.svg";
import {ReactComponent as MouseImage} from "../icons/mouse.svg";
import {WebsiteDrawer} from "../Drawer";
import {
    computePositionPolarCorrectionFactorTheta,
    convertPositionQuaternionToPositionPolar,
    isPositionPolarDifferent
} from "../helpers/pixiHelpers";
import {ITutorialScriptContext, tutorialScript} from "../scripts/tutorial";
import {CardRenderer} from "../forms/CardRenderer";
import {Faction} from "@pickledeggs123/globular-marauders-game/lib/src";

const GetFactionSubheader = (faction: EFaction): string | null => {
    switch (faction) {
        case EFaction.DUTCH:
            return "Think of the economy! We have the cheapest and most ships medium ships.";
        case EFaction.ENGLISH:
            return "Maximum firepower! We have the most cannons per gold piece.";
        case EFaction.FRENCH:
            return "Be agile! We accelerate and rotate the fastest."
        case EFaction.PORTUGUESE:
            return "Full speed ahead! We have the fastest small ships. Great for trading long distances.";
        case EFaction.SPANISH:
            return "All of the gold! We have the largest ship which stores gold coins.";
        default:
            return null;
    }
}

export class PixiGame extends PixiGameBase {
    public application: PIXI.Application;
    public particleContainer: PIXI.Container;
    public starField: particles.Emitter | undefined;

    // game loop stuff
    activeKeys: any[] = [];
    private keyDownHandlerInstance: any;
    private keyUpHandlerInstance: any;
    private mouseWheelHandlerInstance: any;

    // game data stuff
    public voronoiData: Array<{
        id: string,
        voronoi: VoronoiCell
    }> = [];
    public backgroundVoronoiData: Array<{
        id: string,
        voronoi: VoronoiCell
    }> = [];
    public refreshVoronoiDataTick: number = 0;
    public music: MusicPlayer = new MusicPlayer();
    public initialized: boolean = false;
    public frameCounter: number = 0;
    public socket: WebSocket | undefined;
    public socketEvents: Record<string, (data: any) => void> = {};
    public spawnFactions: ISpawnFaction[] = [];
    public spawnPlanets: ISpawnPlanet[] = [];
    public spawnLocations: ISpawnLocationResult = {
        results: [],
        message: undefined
    };
    public forms: IFormResult = {
        cards: []
    };
    public shardPortNumber: number | null = null;
    public messages: IMessage[] = [];
    public localServerMessages: IMessage[] = [];

    // client loop stuff
    public clientLoopStart: number = performance.now();
    public clientLoopDelta: number = 1000 / 10;
    public clientLoopDeltaStart: number = performance.now();

    public numNetworkFrames: number = 0;

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
            array: Array.from(this.game.ships.values()),
        }, {
            array: Array.from(this.game.cannonBalls.values()),
        }, {
            array: Array.from(this.game.crates.values()),
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
        if (this.socket) {
            this.socket.send(JSON.stringify({
                event,
                message
            }));
        } else if ([EGameMode.TUTORIAL, EGameMode.SINGLE_PLAYER].includes(this.state.gameMode) && event === "generic-message") {
            this.localServerMessages.push(message);
        }
    }

    public submitForm(type: string, data: {[key: string]: any}) {
        if (this.state.gameMode === EGameMode.SINGLE_PLAYER) {
            this.game.handleFormApiRequestForPlayer(Array.from(this.game.playerData.values())[0], {
                buttonPath: type,
                data
            });
        }
    }

    convertOrientationToDisplay = (old: Quaternion): Quaternion => {
        return old.clone();
    };

    loadStarField = () => {
        if (this.starField) {
            this.starField.destroy();
        }
        this.starField = new particles.Emitter(this.particleContainer, {
            emit: true,
            autoUpdate: true,
            lifetime: {
                min: 30,
                max: 60,
            },
            particlesPerWave: 100,
            frequency: 1,
            spawnChance: 1,
            maxParticles: 100,
            addAtBack: false,
            pos: {
                x: 0,
                y: 0,
            },
            behaviors: [
                {
                    type: 'alpha',
                    config: {
                        alpha: {
                            list: [
                                {
                                    value: 0,
                                    time: 0
                                },
                                {
                                    value: 0.8,
                                    time: 0.1
                                },
                                {
                                    value: 0.8,
                                    time: 0.9
                                },
                                {
                                    value: 0.1,
                                    time: 1
                                }
                            ],
                        },
                    }
                },
                {
                    type: 'scale',
                    config: {
                        scale: {
                            list: [
                                {
                                    value: 0.2,
                                    time: 0
                                },
                                {
                                    value: 0.06,
                                    time: 1
                                }
                            ],
                        },
                    }
                },
                {
                    type: 'starFieldQuaternion',
                    config: {
                        game: this,
                    }
                },
                {
                    type: 'rotationStatic',
                    config: {
                        min: 0,
                        max: 360
                    }
                },
                {
                    type: 'spawnShape',
                    config: {
                        type: 'torus',
                        data: {
                            x: 0,
                            y: 0,
                            radius: 10
                        }
                    }
                },
                {
                    type: 'textureSingle',
                    config: {
                        texture: this.sprites.starFieldSpeckle
                    }
                },
            ]
        });
        this.application.stage.addChild(this.particleContainer);
    };

    loadSoundIntoMemory = () => {
        // load sounds into memory
        sound.add(ESoundType.FIRE, {url: "sounds/FireSFX.m4a", preload: true});
        sound.add(ESoundType.HIT, {url: "sounds/WoodHitSFX.m4a", preload: true});
        sound.add(ESoundType.ACCELERATE, {url: "sounds/SpeedSFX.m4a", preload: true});
        sound.add(ESoundType.DECELERATE, {url: "sounds/SlowSFX.m4a", preload: true});
        sound.add(ESoundType.MONEY, {url: "sounds/MoneySFX.m4a", preload: true});
        sound.add(ESoundType.LAND, {url: "sounds/RoyalSFX.m4a", preload: true});
        sound.add(ESoundType.LOOT, {url: "sounds/LootSFX.m4a", preload: true});
    };

    loadSpritesIntoMemory = () => {
        // load sprites into memory
        const loader = new PIXI.Loader();

        // queue images to be loaded
        loader.add("missing", DEFAULT_IMAGE);
        // load loot items
        for (const resourceType of Object.values(EResourceType)) {
            const item = RESOURCE_TYPE_TEXTURE_PAIRS.find(i => i.resourceType === resourceType);
            if (item) {
                loader.add(item.name, item.url);
            }
        }
        // load background textures
        for (const textureUrl of SPACE_BACKGROUND_TEXTURES) {
            const index = SPACE_BACKGROUND_TEXTURES.indexOf(textureUrl);
            loader.add(`space${index}`, textureUrl);
        }
        // load smoke trail
        loader.add("smokeTrail", "images/sprites/smokeTrail.svg");
        loader.add("cannonBallTrail", "images/sprites/cannonBallTrail.svg");
        loader.add("glowTrail", "images/sprites/glowTrail.svg");
        loader.add("starFieldSpeckle", "images/sprites/starFieldSpeckle.svg");
        // onload handler
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
            for (const textureUrl of SPACE_BACKGROUND_TEXTURES) {
                const index = SPACE_BACKGROUND_TEXTURES.indexOf(textureUrl);
                const textureName = `space${index}`;
                const item = resources[textureName];
                if (item) {
                    this.sprites[textureName] = item.texture;
                }
            }
            this.sprites.smokeTrail = resources.smokeTrail.texture;
            this.sprites.cannonBallTrail = resources.cannonBallTrail.texture;
            this.sprites.glowTrail = resources.glowTrail.texture;
            this.sprites.starFieldSpeckle = resources.starFieldSpeckle.texture;

            setTimeout(() => {
                this.loadStarField();
            }, 1000);
        });
    };

    handleSwitchGameMode = (gameMode: EGameMode) => {
        if (this.state.gameMode === EGameMode.MULTI_PLAYER && gameMode !== EGameMode.MULTI_PLAYER && this.socket) {
            this.socket.close();
            this.setState({
                showSpawnMenu: false,
                showPlanetMenu: false,
                showMainMenu: false,
                showLoginMenu: false,
                init: false,
            });
        }
        this.loadStarField();
        switch (gameMode) {
            case EGameMode.MAIN_MENU: {
                break;
            }
            case EGameMode.TUTORIAL: {
                // initialize server game
                const serverGame = new Game();
                serverGame.worldScale = 4;
                serverGame.voronoiTerrain.setRecursionNodeLevels([5, 3, 1]);
                serverGame.spawnAiShips = false;
                serverGame.initializeGame();


                // initialize game
                this.game = new Game();
                this.clearMeshes = true;
                this.game.applyGameInitializationFrame(serverGame.getInitializationFrame());

                // add player
                const joinMessage: IJoinMessage = {
                    messageType: EMessageType.JOIN,
                    name: "pirateDude"
                };
                serverGame.incomingMessages.push(["pirateDude", joinMessage]);
                serverGame.handleServerLoop();

                const tutorialPlayerData = serverGame.playerData.get("pirateDude")!;
                const sendPlayers = () => {
                    return {
                        players: Array.from(serverGame.playerData.values()),
                        playerId: tutorialPlayerData.id
                    };
                };
                const sendSpawnPlanets = () => {
                    const player = tutorialPlayerData;
                    if (player) {
                        return serverGame.getSpawnPlanets(player);
                    } else {
                        return null;
                    }
                };
                const sendSpawnLocations = () => {
                    const player = tutorialPlayerData;
                    if (player) {
                        return serverGame.getSpawnLocations(player);
                    } else {
                        return null;
                    }
                };
                const context: ITutorialScriptContext = {
                    tutorialPlayerData,
                    sendPlayers,
                    sendSpawnPlanets,
                    sendSpawnLocations,
                };

                this.initialized = true;
                serverGame.scriptEvents.push(tutorialScript.call(this, serverGame, context));
                setInterval(() => {
                    serverGame.outgoingMessages.splice(0, serverGame.outgoingMessages.length);
                    serverGame.handleServerLoop();

                    const faction = (tutorialPlayerData.factionId && serverGame.factions.get(tutorialPlayerData.factionId))! || serverGame.factions.get(EFaction.DUTCH)!;
                    const playerShip = tutorialPlayerData.shipId && serverGame.ships.get(tutorialPlayerData.shipId);
                    let position: [number, number, number] = [0, 0, 1];
                    if (playerShip) {
                        // get frame centered on player ship
                        position = playerShip.position.rotateVector([0, 0, 1]);
                    } else if (tutorialPlayerData.planetId) {
                        // get frame centered on last faction ship
                        const planet = serverGame.planets.get(tutorialPlayerData.planetId);
                        if (planet) {
                            position = planet.position.rotateVector([0, 0, 1]);
                        }
                    } else if (tutorialPlayerData.factionId) {
                        // get frame centered on last faction ship
                        const faction = serverGame.factions.get(tutorialPlayerData.factionId);
                        const lastShipId = faction!.shipIds[faction!.shipIds.length - 1];
                        if (lastShipId) {
                            const ship = serverGame.ships.get(lastShipId);
                            if (ship) {
                                position = ship.position.rotateVector([0, 0, 1]);
                            }
                        }
                    } else {
                        // get random orbiting frame in over world
                        const numSecondsToCircle = 120 * serverGame.worldScale;
                        const millisecondsPerSecond = 1000;
                        const circleSlice = numSecondsToCircle * millisecondsPerSecond;
                        const circleFraction = (+new Date() % circleSlice) / circleSlice;
                        const angle = circleFraction * (Math.PI * 2);
                        position = Quaternion.fromAxisAngle([1, 0, 0], -angle).rotateVector([0, 0, 1]);
                    }
                    this.handleSendFrame(serverGame.voronoiTerrain.getClientFrame(tutorialPlayerData, position));
                    this.handleSendPlayers(sendPlayers());

                    for (const message of this.localServerMessages) {
                        serverGame.incomingMessages.push(["pirateDude", message]);
                    }
                    for (const [, message] of serverGame.outgoingMessages) {
                        this.handleGenericMessage(message);
                    }
                    this.localServerMessages.splice(0, this.localServerMessages.length);
                }, 100);

                break;
            }
            case EGameMode.SINGLE_PLAYER: {
                // initialize server game
                const serverGame = new Game();
                serverGame.worldScale = 4;
                serverGame.initializeGame();


                // initialize game
                this.game = new Game();
                this.clearMeshes = true;
                this.game.applyGameInitializationFrame(serverGame.getInitializationFrame());

                // add player
                const joinMessage: IJoinMessage = {
                    messageType: EMessageType.JOIN,
                    name: "pirateDude"
                };
                serverGame.incomingMessages.push(["pirateDude", joinMessage]);
                serverGame.handleServerLoop();

                const tutorialPlayerData = serverGame.playerData.get("pirateDude")!;
                const sendPlayers = () => {
                    return {
                        players: Array.from(serverGame.playerData.values()),
                        playerId: tutorialPlayerData.id
                    };
                };
                const sendSpawnFactions = () => {
                    return serverGame.getSpawnFactions();
                };
                const sendSpawnPlanets = () => {
                    const player = tutorialPlayerData;
                    if (player) {
                        return serverGame.getSpawnPlanets(player);
                    } else {
                        return null;
                    }
                };
                const sendSpawnLocations = () => {
                    const player = tutorialPlayerData;
                    if (player) {
                        return serverGame.getSpawnLocations(player);
                    } else {
                        return null;
                    }
                };
                const sendForms = () => {
                    const player = tutorialPlayerData;
                    if (player) {
                        return this.game.getFormsForPlayer(player);
                    } else {
                        return null;
                    }
                };
                this.initialized = true;

                this.setState({
                    showSpawnMenu: false,
                    showPlanetMenu: false,
                    showMainMenu: true,
                    showLoginMenu: false,
                    init: true,
                });

                setInterval(() => {
                    serverGame.outgoingMessages.splice(0, serverGame.outgoingMessages.length);
                    serverGame.handleServerLoop();

                    const faction = (tutorialPlayerData.factionId && serverGame.factions.get(tutorialPlayerData.factionId))! || serverGame.factions.get(EFaction.DUTCH)!;
                    const playerShip = tutorialPlayerData.shipId && serverGame.ships.get(tutorialPlayerData.shipId);
                    let position: [number, number, number] = [0, 0, 1];
                    if (playerShip) {
                        // get frame centered on player ship
                        position = playerShip.position.rotateVector([0, 0, 1]);
                    } else if (tutorialPlayerData.planetId) {
                        // get frame centered on last faction ship
                        const planet = serverGame.planets.get(tutorialPlayerData.planetId);
                        if (planet) {
                            position = planet.position.rotateVector([0, 0, 1]);
                        }
                    } else if (tutorialPlayerData.factionId) {
                        // get frame centered on last faction ship
                        const faction = serverGame.factions.get(tutorialPlayerData.factionId);
                        const lastShipId = faction!.shipIds[faction!.shipIds.length - 1];
                        if (lastShipId) {
                            const ship = serverGame.ships.get(lastShipId);
                            if (ship) {
                                position = ship.position.rotateVector([0, 0, 1]);
                            }
                        }
                    } else {
                        // get random orbiting frame in over world
                        const numSecondsToCircle = 120 * serverGame.worldScale;
                        const millisecondsPerSecond = 1000;
                        const circleSlice = numSecondsToCircle * millisecondsPerSecond;
                        const circleFraction = (+new Date() % circleSlice) / circleSlice;
                        const angle = circleFraction * (Math.PI * 2);
                        position = Quaternion.fromAxisAngle([1, 0, 0], -angle).rotateVector([0, 0, 1]);
                    }
                    this.handleSendFrame(serverGame.voronoiTerrain.getClientFrame(tutorialPlayerData, position));
                    this.handleSendPlayers(sendPlayers());
                    this.handleSpawnFactions(sendSpawnFactions());
                    this.handleSpawnPlanets(sendSpawnPlanets() ?? []);
                    this.handleSpawnLocations(sendSpawnLocations() ?? {results:[], message: undefined});
                    this.handleForms(sendForms() ?? {cards: []});

                    for (const message of this.localServerMessages) {
                        serverGame.incomingMessages.push(["pirateDude", message]);
                    }
                    for (const [, message] of serverGame.outgoingMessages) {
                        this.handleGenericMessage(message);
                    }
                    this.localServerMessages.splice(0, this.localServerMessages.length);
                }, 100);
                break;
            }
            case EGameMode.MULTI_PLAYER: {
                this.setState({
                    showSpawnMenu: false,
                    showPlanetMenu: false,
                    showMainMenu: false,
                    showLoginMenu: true,
                    init: false,
                });
                // setup networking
                this.setupNetworking.call(this, false);
            }
        }
        this.setState({gameMode});
    }

    private cameraPosition: Quaternion = Quaternion.ONE;
    private cameraOrientation: Quaternion = Quaternion.ONE;
    private lastCameraOrientation: Quaternion = Quaternion.ONE;
    private cameraCorrectionFactor: number = 0;
    private cameraPositionVelocityTheta: number = Math.PI / 2;
    public getCamera() {
        return {
            cameraPosition: this.cameraPosition,
            cameraOrientation: this.cameraOrientation,
        };
    }

    constructor(props: IPixiGameProps) {
        super(props);

        // setup rendering
        this.application = new PIXI.Application({
            width: this.state.width,
            height: this.state.height,
            backgroundColor: 0xff110022,
        });
        this.application.stage.sortableChildren = true;
        this.particleContainer = new PIXI.Container();
        this.particleContainer.zIndex = -15;

        // draw app
        this.game.initializeGame();

        this.loadSoundIntoMemory();
        this.loadSpritesIntoMemory();

        const handleDrawingOfText = (text: PIXI.Text, position: Quaternion, offset?: {x: number, y: number}) => {
            const textPosition = DelaunayGraph.distanceFormula(
                this.cameraPosition.rotateVector([0, 0, 1]),
                position.rotateVector([0, 0, 1])
            ) < 0.001 ? [0, 0, 1] as [number, number, number] : this.cameraOrientation.clone().inverse()
                .mul(this.cameraPosition.clone().inverse())
                .mul(position.clone())
                .rotateVector([0, 0, 1]);
            textPosition[0] = ((-textPosition[0] * this.state.zoom * this.game.worldScale) + 1) / 2;
            textPosition[1] = ((-textPosition[1] * this.state.zoom * this.game.worldScale) + 1) / 2;
            text.x = textPosition[0] * this.application.renderer.width;
            text.y = textPosition[1] * this.application.renderer.height;
            text.y -= 20;
            const center: [number, number] = [
                this.application.renderer.width / 2,
                this.application.renderer.height / 2
            ];
            if (offset) {
                text.x += offset.x;
                text.y += offset.y;
            } else {
                const directionTowardsCenter: [number, number] = [
                    center[0] - text.x,
                    center[1] - text.y
                ];
                const directionTowardsCenterLength = Math.sqrt(Math.pow(directionTowardsCenter[0], 2) + Math.pow(directionTowardsCenter[1], 2));
                const normalizedDirectionTowardsCenter: [number, number] = directionTowardsCenterLength !== 0 ? [
                    directionTowardsCenter[0] / directionTowardsCenterLength,
                    directionTowardsCenter[1] / directionTowardsCenterLength
                ] : [0, 0];
                text.x += normalizedDirectionTowardsCenter[0] * 25;
                text.y += normalizedDirectionTowardsCenter[1] * 25;
            }
            text.anchor.set(0.5);
            text.visible = textPosition[2] > 0 && this.state.zoom * this.game.worldScale >= 6;
        };
        const handleDrawingOfParticles = (text: PIXI.Container, position: Quaternion, offset?: {x: number, y: number}) => {
        };

        const removeExtraRotation = (q: Quaternion): Quaternion => {
            return Quaternion.fromBetweenVectors([0, 0, 1], q.rotateVector([0, 0, 1]));
        };
        const removeExtraOrientation = (q: Quaternion): Quaternion => {
            return Quaternion.fromBetweenVectors([1, 0, 0], q.rotateVector([1, 0, 0]));
        };

        // draw rotating app
        let pixiTick: number = 0;
        this.application.ticker.add(() => {
            this.gameLoop.call(this);

            const playerShip = this.getPlayerShip();
            this.cameraPosition = removeExtraRotation(playerShip.position);
            this.lastCameraOrientation = this.cameraOrientation;
            const nextCameraOrientation = removeExtraOrientation(playerShip.orientation.clone().mul(Quaternion.fromAxisAngle([0, 0, 1], -this.cameraPositionVelocityTheta + Math.PI / 2 - this.cameraCorrectionFactor)));
            this.cameraOrientation = this.lastCameraOrientation.slerp(nextCameraOrientation)(0.1 * (1 - VoronoiGraph.angularDistanceQuaternion(this.lastCameraOrientation.clone().inverse().mul(nextCameraOrientation.clone()), 1) / Math.PI));
            pixiTick += 1;

            // sync game to Pixi renderer
            // stars
            for (const star of [
                ...Array.from(this.game.voronoiTerrain.getStars(this.cameraPosition.rotateVector([0, 0, 1]), 0.5)),
                ...Array.from(this.game.voronoiTerrain.getStars(this.cameraPosition.rotateVector([0, 0, 1]), 0.25)),
                ...Array.from(this.game.voronoiTerrain.getStars(this.cameraPosition.rotateVector([0, 0, 1]), 0.125))
            ]) {
                const starMesh = this.starMeshes.find(p => p.id === star.id);
                if (starMesh) {
                    starMesh.tick = pixiTick;
                } else {
                    this.addStar({
                        star,
                        cameraPosition: this.cameraPosition,
                        cameraOrientation: this.cameraOrientation,
                        tick: pixiTick
                    });
                }
            }
            for (const item of this.starMeshes.filter(m => m.tick !== pixiTick || this.clearMeshes)) {
                this.application.stage.removeChild(item.mesh);
            }
            this.starMeshes = this.starMeshes.filter(m => m.tick === pixiTick && !this.clearMeshes);
            // planets
            for (const planet of Array.from(this.game.voronoiTerrain.getPlanets(this.cameraPosition.rotateVector([0, 0, 1])))) {
                const planetMesh = this.planetMeshes.find(p => p.id === planet.id);
                if (planetMesh) {
                    planetMesh.orientation = planetMesh.rotation.clone().mul(planetMesh.orientation.clone());
                    const ownerFaction = Array.from(this.game.factions.values()).find(faction => faction.planetIds.includes(planet.id));
                    planetMesh.factionColor = this.getFactionColor(ownerFaction);
                    planetMesh.settlementLevel = planet.settlementLevel;
                    planetMesh.settlementProgress = planet.settlementProgress;
                    planetMesh.tick = pixiTick;
                } else {
                    this.addPlanet({
                        planet,
                        cameraPosition: this.cameraPosition,
                        cameraOrientation: this.cameraOrientation,
                        tick: pixiTick
                    });
                }
            }
            for (const item of this.planetMeshes.filter(m => m.tick !== pixiTick || this.clearMeshes)) {
                this.application.stage.removeChild(item.mesh);
                this.application.stage.removeChild(item.faction);
                this.application.stage.removeChild(item.textName);
                this.application.stage.removeChild(item.textTitle);
                this.application.stage.removeChild(item.textResource1);
                this.application.stage.removeChild(item.textResource2);
                this.application.stage.removeChild(item.textResource3);
            }
            this.planetMeshes = this.planetMeshes.filter(m => m.tick === pixiTick && !this.clearMeshes);
            // ships
            for (const [, ship] of Array.from(this.game.ships)) {
                const shipMesh = this.shipMeshes.find(s => s.id === ship.id);
                if (shipMesh) {
                    shipMesh.isPlayer = this.getPlayerShip().id === ship.id;
                    shipMesh.isEnemy = this.findPlayerShip()?.faction?.id !== ship.faction?.id;
                    shipMesh.healthValue = Math.ceil(ship.health / ship.maxHealth * 100);

                    switch (shipMesh.trailState) {
                        case EParticleState.STOP: {
                            if ((shipMesh.isPlayer && !this.state.autoPilotEnabled ? this.activeKeys : ship.activeKeys).includes("w")) {
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
                            if (!(shipMesh.isPlayer && !this.state.autoPilotEnabled ? this.activeKeys : ship.activeKeys).includes("w")) {
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
                        if (ship === this.findPlayerShip()) {
                            this.cameraCorrectionFactor = shipMesh.correctionFactorTheta;
                        }
                    }
                    shipMesh.position = removeExtraRotation(ship.position);
                    shipMesh.positionVelocity = removeExtraRotation(ship.positionVelocity);
                    const positionVelocityPoint = ship.positionVelocity.rotateVector([0, 0, 1]);
                    const positionVelocityPointLength = Math.sqrt(positionVelocityPoint[0] ** 2 + positionVelocityPoint[1] ** 2);
                    if (positionVelocityPointLength > 0.0001) {
                        shipMesh.positionVelocityTheta = Math.atan2(positionVelocityPoint[1], positionVelocityPoint[0]);
                        if (ship === this.findPlayerShip()) {
                            this.cameraPositionVelocityTheta = shipMesh.positionVelocityTheta;
                        }
                    }
                    shipMesh.orientation = ship.orientation.clone().mul(Quaternion.fromAxisAngle([0, 0, 1], -shipMesh.positionVelocityTheta + Math.PI / 2));
                    const playerData = (this.playerId && this.game.playerData.get(this.playerId)) ?? null;
                    if (ship.pathFinding.points.length > 0 && !(
                        shipMesh.autoPilotLines.length === ship.pathFinding.points.length &&
                        ship.pathFinding.points.every(p => shipMesh.autoPilotLinePoints.includes(p)))
                    ) {
                        shipMesh.autoPilotLines.forEach((i) => {
                            this.application.stage.removeChild(i);
                        });
                        shipMesh.autoPilotLines.splice(0, shipMesh.autoPilotLines.length);
                        if (shipMesh.isPlayer && playerData) {
                            ship.pathFinding.points.forEach(() => {
                                const autoPilotLine = new PIXI.Graphics();
                                autoPilotLine.zIndex = -5;
                                this.application.stage.addChild(autoPilotLine);
                                shipMesh.autoPilotLines.push(autoPilotLine);
                            });
                        }
                    }
                    shipMesh.autoPilotLinePoints.splice(0, shipMesh.autoPilotLinePoints.length, ...ship.pathFinding.points);
                    shipMesh.tick = pixiTick;
                } else {
                    this.addShip({
                        ship,
                        cameraPosition: this.cameraPosition,
                        cameraOrientation: this.cameraOrientation,
                        tick: pixiTick
                    });
                }
            }
            for (const item of this.shipMeshes.filter(m => m.tick !== pixiTick || this.clearMeshes)) {
                this.application.stage.removeChild(item.mesh);
                this.application.stage.removeChild(item.text);
                this.application.stage.removeChild(item.line);
                this.application.stage.removeChild(item.cannonBallLeft);
                this.application.stage.removeChild(item.cannonBallRight);
                this.application.stage.removeChild(item.health);
                item.trail.emit = false;
                item.trail.destroy();
                this.application.stage.removeChild(item.trailContainer);
                for (const autoPilotLine of item.autoPilotLines) {
                    this.application.stage.removeChild(autoPilotLine);
                }
                item.autoPilotLines.splice(0, item.autoPilotLines.length);
            }
            this.shipMeshes = this.shipMeshes.filter(m => m.tick === pixiTick && !this.clearMeshes);
            // cannonBalls
            for (const [, cannonBall] of Array.from(this.game.cannonBalls)) {
                const cannonBallMesh = this.cannonBallMeshes.find(c => c.id === cannonBall.id);
                if (cannonBallMesh) {
                    cannonBallMesh.position = removeExtraRotation(cannonBall.position);
                    cannonBallMesh.positionVelocity = removeExtraRotation(cannonBall.positionVelocity);
                    cannonBallMesh.tick = pixiTick;
                } else {
                    this.addCannonBall({
                        cannonBall,
                        cameraPosition: this.cameraPosition,
                        cameraOrientation: this.cameraOrientation,
                        tick: pixiTick
                    });
                }
            }
            for (const item of this.cannonBallMeshes.filter(m => m.tick !== pixiTick || this.clearMeshes)) {
                this.application.stage.removeChild(item.mesh);
                this.application.stage.removeChild(item.trailContainer);
            }
            this.cannonBallMeshes = this.cannonBallMeshes.filter(m => m.tick === pixiTick && !this.clearMeshes);
            // crates
            for (const [, crate] of Array.from(this.game.crates)) {
                const createMesh = this.crateMeshes.find(c => c.id === crate.id);
                if (createMesh) {
                    createMesh.position = removeExtraRotation(crate.position);
                    createMesh.orientation = crate.orientation;
                    createMesh.tick = pixiTick;
                } else {
                    this.addCrate({
                        crate,
                        cameraPosition: this.cameraPosition,
                        cameraOrientation: this.cameraOrientation,
                        tick: pixiTick
                    });
                }
            }
            for (const item of this.crateMeshes.filter(m => m.tick !== pixiTick || this.clearMeshes)) {
                this.application.stage.removeChild(item.mesh);
                this.application.stage.removeChild(item.trailContainer);
                this.application.stage.removeChild(item.image);
                this.application.stage.removeChild(item.text);
            }
            this.crateMeshes = this.crateMeshes.filter(m => m.tick === pixiTick && !this.clearMeshes);

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
                            item[1],
                            item[2]
                        ] as [number, number, number];
                    });
                    return DelaunayGraph.dotProduct(DelaunayGraph.crossProduct(
                        DelaunayGraph.subtract(vertices[1], vertices[0]),
                        DelaunayGraph.subtract(vertices[2], vertices[0]),
                    ), this.cameraPosition.rotateVector([0, 0, 1])) > 0;
                });
                for (const {id, tile} of voronoiDataStuff) {
                    const voronoiMesh = this.voronoiMeshes.find(p => p.id === id);
                    if (voronoiMesh) {
                        voronoiMesh.tick = pixiTick;
                    } else {
                        this.addVoronoi({
                            id,
                            tile,
                            cameraPosition: this.cameraPosition,
                            cameraOrientation: this.cameraOrientation,
                            tick: pixiTick
                        });
                    }
                }
            }
            for (const item of this.voronoiMeshes.filter(m => m.tick !== pixiTick || this.clearMeshes)) {
                this.application.stage.removeChild(item.mesh);
            }
            this.voronoiMeshes = this.voronoiMeshes.filter(m => m.tick === pixiTick && !this.clearMeshes);

            // background voronoi tiles
            const backgroundVoronoiDataStuff = this.backgroundVoronoiData.reduce((acc, {id, voronoi}) => {
                const qCentroid = Quaternion.fromBetweenVectors([0, 0, 1], voronoi.centroid);
                const qVertices = voronoi.vertices.map(v => Quaternion.fromBetweenVectors([0, 0, 1], v));
                const pCentroidVertices = qVertices.map(v => v.rotateVector([0, 0, 1])).map((v): [number, number, number] => [v[0], v[1], 0]);
                const iLongestCentroidVerticesSegmentIndex = pCentroidVertices.map((_, i, arr): [number, number] => [i, DelaunayGraph.distanceFormula(arr[i % arr.length], arr[(i + 1) % arr.length])]).sort((a, b) => b[1] - a[1])[0][0];
                const pLongestCentroidVerticesSegmentOrigin = pCentroidVertices[iLongestCentroidVerticesSegmentIndex];
                const pLongestCentroidVerticesSegmentAxisPoint = DelaunayGraph.subtract(pCentroidVertices[(iLongestCentroidVerticesSegmentIndex + 1) % pCentroidVertices.length], pLongestCentroidVerticesSegmentOrigin);
                const fLongestCentroidVerticesSegmentRotationAngle = Math.atan2(pLongestCentroidVerticesSegmentAxisPoint[1], pLongestCentroidVerticesSegmentAxisPoint[0]);
                const qLongestCentroidVerticesSegmentRotation = Quaternion.fromAxisAngle([0, 0, 1], -fLongestCentroidVerticesSegmentRotationAngle);
                const pRotatedCentroidVertices = pCentroidVertices.map(p => Quaternion.fromBetweenVectors([0, 0, 1], p).mul(qLongestCentroidVerticesSegmentRotation.clone()).rotateVector([0, 0, 1]));
                const bounds = {
                    minX: pRotatedCentroidVertices.reduce((acc, v) => Math.min(acc, v[0]), 1),
                    maxX: pRotatedCentroidVertices.reduce((acc, v) => Math.max(acc, v[0]), -1),
                    minY: pRotatedCentroidVertices.reduce((acc, v) => Math.min(acc, v[1]), 1),
                    maxY: pRotatedCentroidVertices.reduce((acc, v) => Math.max(acc, v[1]), -1),
                };
                const tiles = this.game.getDelaunayTileTessellation(
                    qCentroid,
                    qVertices,
                    3
                );
                acc.push(...Array.from(tiles).map((tile, index) => ({
                    id: `${id}-${index}`,
                    tile,
                    tileUv: tile.vertices.map(q => {
                        const v1 = q.rotateVector([0, 0, 1]);
                        const v = Quaternion.fromBetweenVectors([0, 0, 1], v1).mul(qLongestCentroidVerticesSegmentRotation.clone()).rotateVector([0, 0, 1]);
                        return [
                            (v[0] - bounds.minX) / (bounds.maxX - bounds.minX),
                            (v[1] - bounds.minY) / (bounds.maxY - bounds.minY),
                        ] as [number, number];
                    }),
                    textureName: `space${Math.abs(this.hashCode(id)) % SPACE_BACKGROUND_TEXTURES.length}`,
                })));
                return acc;
            }, [] as Array<{id: string, tile: ITessellatedTriangle, tileUv: [number, number][], textureName: string}>).filter(({tile}) => {
                const vertices = tile.vertices.map(v => {
                    const item = v.rotateVector([0, 0, 1]);
                    return [
                        item[0],
                        item[1],
                        item[2]
                    ] as [number, number, number];
                });
                return DelaunayGraph.dotProduct(DelaunayGraph.crossProduct(
                    DelaunayGraph.subtract(vertices[1], vertices[0]),
                    DelaunayGraph.subtract(vertices[2], vertices[0]),
                ), this.cameraPosition.rotateVector([0, 0, 1])) > 0;
            });
            for (const {id, tile, tileUv, textureName} of backgroundVoronoiDataStuff) {
                const voronoiMesh = this.backgroundVoronoiMeshes.find(p => p.id === id);
                if (voronoiMesh) {
                    voronoiMesh.tick = pixiTick;
                } else {
                    this.addBackgroundVoronoi({
                        id,
                        tile,
                        tileUv,
                        cameraPosition: this.cameraPosition,
                        cameraOrientation: this.cameraOrientation,
                        tick: pixiTick,
                        textureName
                    });
                }
            }
            for (const item of this.backgroundVoronoiMeshes.filter(m => m.tick !== pixiTick || this.clearMeshes)) {
                this.application.stage.removeChild(item.mesh);
            }
            this.backgroundVoronoiMeshes = this.backgroundVoronoiMeshes.filter(m => m.tick === pixiTick && !this.clearMeshes);

            this.clearMeshes = false;

            const updateMeshIfVisible = (item: {position: Quaternion, mesh: PIXI.Mesh<any>}) => {
                const shipPoint = DelaunayGraph.distanceFormula(
                    this.cameraPosition.rotateVector([0, 0, 1]),
                    item.position.rotateVector([0, 0, 1])
                ) < 0.001 ? [0, 0, 1] as [number, number, number] : this.cameraOrientation.clone().inverse()
                    .mul(this.cameraPosition.clone().inverse())
                    .mul(item.position.clone())
                    .rotateVector([0, 0, 1]);
                item.mesh.visible = shipPoint[2] > 0;
                item.mesh.tint = shipPoint[2] > 0 ? 0xaaaaaaaa : 0xffffffff;
            };

            // update each star
            for (const item of this.starMeshes) {
                const shader = item.mesh.shader;
                shader.uniforms.uCameraPosition = this.cameraPosition.clone().inverse().toMatrix4();
                shader.uniforms.uCameraOrientation = this.cameraOrientation.clone().inverse().toMatrix4();
                shader.uniforms.uCameraScale = this.state.zoom;
                updateMeshIfVisible(item);
            }

            // update each planet
            for (const item of this.planetMeshes) {
                item.orientation = item.orientation.clone().mul(item.rotation.clone());

                const shader = item.mesh.shader;
                shader.uniforms.uCameraPosition = this.cameraPosition.clone().inverse().toMatrix4();
                shader.uniforms.uCameraOrientation = this.cameraOrientation.clone().inverse().toMatrix4();
                shader.uniforms.uCameraScale = this.state.zoom;
                shader.uniforms.uOrientation = item.orientation.toMatrix4();
                updateMeshIfVisible(item);

                if (item.factionColor) {
                    const startPoint = DelaunayGraph.distanceFormula(
                        this.cameraPosition.rotateVector([0, 0, 1]),
                        item.position.rotateVector([0, 0, 1])
                    ) < 0.0001 ? [0, 0, 1] : this.cameraOrientation.clone().inverse()
                        .mul(this.cameraPosition.clone().inverse())
                        .mul(item.position.clone())
                        .rotateVector([0, 0, 1]);
                    const centerX = ((-startPoint[0] * this.state.zoom * this.game.worldScale) + 1) / 2 * this.application.renderer.width;
                    const centerY = ((-startPoint[1] * this.state.zoom * this.game.worldScale) + 1) / 2 * this.application.renderer.height;
                    const settlementProgressSlice = Math.max(0, Math.min(item.settlementProgress, 1)) * Math.PI * 2;
                    const settlementProgressSlice2 = Math.max(0, Math.min(item.settlementProgress - 1, 1) / 4) * Math.PI * 2;
                    const radius = item.factionRadius * this.state.zoom * this.game.worldScale * this.application.renderer.width;
                    const radius2 = (item.factionRadius + 3 * PHYSICS_SCALE) * this.state.zoom * this.game.worldScale * this.application.renderer.width;

                    // inner circle
                    item.faction.clear();
                    item.faction.position.set(centerX, centerY);
                    item.faction.beginFill(item.factionColor);
                    item.faction.moveTo(0, 0);
                    item.faction.lineTo(radius, 0);
                    item.faction.arc(0, 0, radius, 0, settlementProgressSlice);
                    item.faction.lineTo(0, 0);
                    item.faction.endFill();

                    // outer circle
                    item.faction.beginFill(item.factionColor);
                    item.faction.moveTo(0, 0);
                    item.faction.lineTo(radius2, 0);
                    item.faction.arc(0, 0, radius2, 0, settlementProgressSlice2);
                    item.faction.lineTo(0, 0);
                    item.faction.endFill();

                    item.faction.visible = startPoint[2] > 0 &&
                        centerX >= 0 &&
                        centerX <= this.application.renderer.width &&
                        centerY >= 0 &&
                        centerY <= this.application.renderer.height;
                } else {
                    item.faction.visible = false;
                }

                handleDrawingOfText(item.textName, item.position, {x: 0, y: item.factionRadius / PHYSICS_SCALE * 2 + 40 - 160});
                handleDrawingOfText(item.textTitle, item.position, {x: 0, y: item.factionRadius / PHYSICS_SCALE * 2 + 60 - 160});
                handleDrawingOfText(item.textResource1, item.position, {x: 0, y: item.factionRadius / PHYSICS_SCALE * 2 + 80 - 160});
                handleDrawingOfText(item.textResource2, item.position, {x: 0, y: item.factionRadius / PHYSICS_SCALE * 2 + 100 - 160});
                handleDrawingOfText(item.textResource3, item.position, {x: 0, y: item.factionRadius / PHYSICS_SCALE * 2 + 120 - 160});
            }

            // update each ship
            for (const item of this.shipMeshes) {
                const shader = item.mesh.shader;
                shader.uniforms.uCameraPosition = this.cameraPosition.clone().inverse().toMatrix4();
                shader.uniforms.uCameraOrientation = this.cameraOrientation.clone().inverse().toMatrix4();
                shader.uniforms.uCameraPositionInv = this.cameraPosition.clone().toMatrix4();
                shader.uniforms.uCameraOrientationInv = this.cameraOrientation.clone().toMatrix4();
                shader.uniforms.uCorrectionFactorTheta = item.correctionFactorTheta;
                shader.uniforms.uCameraScale = this.state.zoom;
                shader.uniforms.uPosition = removeExtraRotation(item.position).toMatrix4();
                shader.uniforms.uOrientation = this.convertOrientationToDisplay(item.orientation.mul(Quaternion.fromAxisAngle([0, 0, 1], Math.PI))).toMatrix4();
                updateMeshIfVisible(item);

                // hide ships on the other side of the world
                const shipPoint = DelaunayGraph.distanceFormula(
                    this.cameraPosition.rotateVector([0, 0, 1]),
                    item.position.rotateVector([0, 0, 1])
                ) < 0.001 ? [0, 0, 1] as [number, number, number] : this.cameraOrientation.clone().inverse()
                    .mul(this.cameraPosition.clone().inverse())
                    .mul(item.position.clone())
                    .rotateVector([0, 0, 1]);
                item.mesh.visible = shipPoint[2] > 0;

                handleDrawingOfText(item.text, item.position);

                handleDrawingOfParticles(item.trailContainer, item.position);

                // draw player dotted line
                if (item.isPlayer) {
                    const lineXS = 1 / 2 * this.application.renderer.width;
                    const lineYS = 1 / 2 * this.application.renderer.height;

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
                        const lineXE = ((-endPoint[0] * this.state.zoom * this.game.worldScale) + 1) / 2 * this.application.renderer.width;
                        const lineYE = ((-endPoint[1] * this.state.zoom * this.game.worldScale) + 1) / 2 * this.application.renderer.height;

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
                            this.cameraPosition.rotateVector([0, 0, 1]),
                            position.rotateVector([0, 0, 1])
                        ) < 0.001 ? [0, 0, 1] as [number, number, number] : this.cameraOrientation.clone().inverse()
                            .mul(this.cameraPosition.clone().inverse())
                            .mul(position.clone())
                            .rotateVector([0, 0, 1]);
                        endPoint[2] = 0;
                        const endPointScaleFactor = 1 / Math.max(Math.abs(endPoint[0]), Math.abs(endPoint[1]));
                        endPoint[0] *= endPointScaleFactor;
                        endPoint[1] *= endPointScaleFactor;
                        const lineXE = ((-endPoint[0] * this.state.zoom * this.game.worldScale) + 1) / 2 * this.application.renderer.width;
                        const lineYE = ((-endPoint[1] * this.state.zoom * this.game.worldScale) + 1) / 2 * this.application.renderer.height;

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
                    const lineStart = i === 0 ? this.cameraPosition.clone() : Quaternion.fromBetweenVectors([0, 0, 1], item.autoPilotLinePoints[i - 1]);
                    const lineEnd = Quaternion.fromBetweenVectors([0, 0, 1], item.autoPilotLinePoints[i]);
                    const startPoint = DelaunayGraph.distanceFormula(
                        this.cameraPosition.rotateVector([0, 0, 1]),
                        lineStart.rotateVector([0, 0, 1])
                    ) < 0.001 ? [0, 0, 1] as [number, number, number] : this.cameraOrientation.clone().inverse()
                        .mul(this.cameraPosition.clone().inverse())
                        .mul(lineStart)
                        .rotateVector([0, 0, 1]);
                    const lineXS = ((-startPoint[0] * this.state.zoom * this.game.worldScale) + 1) / 2 * this.application.renderer.width;
                    const lineYS = ((-startPoint[1] * this.state.zoom * this.game.worldScale) + 1) / 2 * this.application.renderer.height;

                    const endPoint = DelaunayGraph.distanceFormula(
                        this.cameraPosition.rotateVector([0, 0, 1]),
                        lineEnd.rotateVector([0, 0, 1])
                    ) < 0.001 ? [0, 0, 1] as [number, number, number] : this.cameraOrientation.clone().inverse()
                        .mul(this.cameraPosition.clone().inverse())
                        .mul(lineEnd)
                        .rotateVector([0, 0, 1]);
                    const lineXE = ((-endPoint[0] * this.state.zoom * this.game.worldScale) + 1) / 2 * this.application.renderer.width;
                    const lineYE = ((-endPoint[1] * this.state.zoom * this.game.worldScale) + 1) / 2 * this.application.renderer.height;

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
                        this.cameraPosition.rotateVector([0, 0, 1]),
                        item.position.rotateVector([0, 0, 1])
                    ) < 0.001 ? [0, 0, 1] as [number, number, number] : this.cameraOrientation.clone().inverse()
                        .mul(this.cameraPosition.clone().inverse())
                        .mul(item.position.clone())
                        .rotateVector([0, 0, 1]);
                    const centerX = ((-startPoint[0] * this.state.zoom * this.game.worldScale) + 1) / 2 * this.application.renderer.width;
                    const centerY = ((-startPoint[1] * this.state.zoom * this.game.worldScale) + 1) / 2 * this.application.renderer.height;

                    const radius = 20 * PHYSICS_SCALE * this.state.zoom * this.game.worldScale * this.application.renderer.width;
                    const thickness = 3 * PHYSICS_SCALE * this.state.zoom * this.game.worldScale * this.application.renderer.width;
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
                        centerX <= this.application.renderer.width &&
                        centerY >= 0 &&
                        centerY <= this.application.renderer.height;
                }
            }

            // update each cannon ball
            for (const item of this.cannonBallMeshes) {
                item.position = item.position.clone().mul(item.positionVelocity.clone().pow(1/60));

                const shader = item.mesh.shader;
                shader.uniforms.uCameraPosition = this.cameraPosition.clone().inverse().toMatrix4();
                shader.uniforms.uCameraOrientation = this.cameraOrientation.clone().inverse().toMatrix4();
                shader.uniforms.uCameraScale = this.state.zoom;
                shader.uniforms.uPosition = removeExtraRotation(item.position).toMatrix4();
                updateMeshIfVisible(item);
            }

            // update each crate
            for (const item of this.crateMeshes) {
                item.orientation = item.orientation.clone().mul(item.rotation.clone());

                const meshShader = item.mesh.shader;
                meshShader.uniforms.uCameraPosition = this.cameraPosition.clone().inverse().toMatrix4();
                meshShader.uniforms.uCameraOrientation = this.cameraOrientation.clone().inverse().toMatrix4();
                meshShader.uniforms.uCameraScale = this.state.zoom;
                meshShader.uniforms.uPosition = removeExtraRotation(item.position).toMatrix4();
                meshShader.uniforms.uOrientation = this.convertOrientationToDisplay(item.orientation).toMatrix4();
                updateMeshIfVisible(item);

                const imageShader = item.image.shader;
                imageShader.uniforms.uCameraPosition = this.cameraPosition.clone().inverse().toMatrix4();
                imageShader.uniforms.uCameraOrientation = this.cameraOrientation.clone().inverse().toMatrix4();
                imageShader.uniforms.uCameraScale = this.state.zoom;
                imageShader.uniforms.uPosition = removeExtraRotation(item.position).toMatrix4();
                imageShader.uniforms.uOrientation = this.convertOrientationToDisplay(item.orientation).toMatrix4();
                updateMeshIfVisible({...item, mesh: item.image});

                handleDrawingOfText(item.text, item.position);
            }

            // draw voronoi terrain tiles for political boundaries
            if (this.state.showVoronoi) {
                for (const item of this.voronoiMeshes) {
                    const shader = item.mesh.shader;
                    shader.uniforms.uCameraPosition = this.cameraPosition.clone().toMatrix4();
                    shader.uniforms.uCameraOrientation = this.cameraOrientation.clone().inverse().toMatrix4();
                    shader.uniforms.uCameraScale = this.state.zoom;
                }
            }

            // draw background voronoi terrain tiles for background images
            for (const item of this.backgroundVoronoiMeshes) {
                const shader = item.mesh.shader;
                shader.uniforms.uCameraPosition = this.cameraPosition.clone().toMatrix4();
                shader.uniforms.uCameraOrientation = this.cameraOrientation.clone().inverse().toMatrix4();
                shader.uniforms.uCameraScale = this.state.zoom;
            }
        });
    }

    continuousSounds = new Map<string, IMediaInstance>();
    handleSoundEffects = (serverFrame: boolean) => {
        // handle sounds
        const continuousSoundCheck = new Set<string>();
        for (const soundEvent of this.game.soundEvents) {
            if (!(soundEvent.shipId === this.findPlayerShip()?.id || soundEvent.soundType === ESoundType.HIT)) {
                continue;
            }
            const playOptions: PlayOptions = {
                volume: soundEvent.shipId === this.findPlayerShip()?.id ? 1 : 0.09
            };
            switch (soundEvent.soundEventType) {
                case ESoundEventType.ONE_OFF: {
                    const soundItem = sound.find(soundEvent.soundType);
                    if (soundItem && soundItem.isLoaded) {
                        sound.play(soundEvent.soundType, playOptions);
                    }
                    break;
                }
                case ESoundEventType.CONTINUOUS: {
                    playOptions.volume! *= 0.25;
                    const key = `${soundEvent.shipId}-${soundEvent.soundType}`;
                    if (!this.continuousSounds.has(key)) {
                        const soundItem = sound.find(soundEvent.soundType);
                        if (soundItem && soundItem.isLoaded) {
                            const mediaInstance = sound.play(soundEvent.soundType, playOptions) as IMediaInstance;
                            if (!(mediaInstance as any).then) {
                                this.continuousSounds.set(key, mediaInstance);
                            }
                        }
                    }
                    console.log("SERVER", serverFrame, "SOUND");
                    continuousSoundCheck.add(key);
                    break;
                }
            }
        }
        if (!serverFrame) {
            const stoppedContinuousSounds = Array.from(this.continuousSounds.keys()).filter(key => !continuousSoundCheck.has(key));
            for (const key of stoppedContinuousSounds) {
                const mediaInstance = this.continuousSounds.get(key)!;
                mediaInstance.stop();
                console.log("SERVER", serverFrame, "NO SOUND");
                this.continuousSounds.delete(key);
            }
        }
    }

    handleSendWorld = (data: IGameInitializationFrame) => {
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

    handleSendFrame = (data: IGameSyncFrame) => {
        this.numNetworkFrames += 1;
        setTimeout(() => {
            this.numNetworkFrames -= 1;
        }, 1000);

        const playerData = (this.playerId && this.game.playerData.get(this.playerId)) ?? null;
        if (playerData) {
            const ship = this.game.ships.get(playerData.shipId);
            const shipData = data.ships.update.find(s => s.id === playerData.shipId);
            if (ship && shipData && !playerData.autoPilotEnabled) {
                // cancel server position if the position difference is small
                if (VoronoiGraph.angularDistance(
                    ship.position.rotateVector([0, 0, 1]),
                    DeserializeQuaternion(shipData.position).rotateVector([0, 0, 1]),
                    this.game.worldScale
                ) < PHYSICS_SCALE * 100) {
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
        this.handleSoundEffects(true);
    };

    handleSendPlayers = (data: { players: IPlayerData[], playerId: string }) => {
        this.game.playerData = new Map<string, IPlayerData>();
        data.players.forEach((d) => {
            this.game.playerData.set(d.id, d);
        });
        this.playerId = data.playerId;
    };

    handleGenericMessage = (data: IMessage) => {
        this.messages.push(data);
    };

    handleSpawnFactions = (data: ISpawnFaction[]) => {
        this.spawnFactions = data;
    };

    handleSpawnPlanets = (data: ISpawnPlanet[]) => {
        this.spawnPlanets = data;
    };

    handleSpawnLocations = (data: ISpawnLocationResult) => {
        this.spawnLocations = data;
    };

    handleForms = (data: IFormResult) => {
        this.forms = data;
    }

    setupNetworking(autoLogin: boolean) {
        if (this.state.gameMode !== EGameMode.MULTI_PLAYER) {
            return;
        }

        this.socket = new SockJS(window.location.protocol + "//" + window.location.hostname + ":" + (this.shardPortNumber ?? 4000) + "/game");
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
                    // this line fixes the bug, so it is 100 100 100 100 100 100 100
                    // clumpy messages will cause interpolation bugs
                    this.sendMessage("ack", "ACK");
                }
                const matchingHandler = this.socketEvents[data.event];
                if (matchingHandler) {
                    matchingHandler(data.message);
                }
            }
        };
        this.socket.onclose = () => {
            this.initialized = false;
            this.music.stop();
            this.game = new Game();
            this.clearMeshes = true;
            this.game.worldScale = 4;
            this.game.initializeGame();
            this.setState({
                showSpawnMenu: false,
                showPlanetMenu: false,
                showMainMenu: false,
                showLoginMenu: true,
                init: false,
            });
            setTimeout(() => {
                this.setupNetworking.call(this, true);
            }, 2000);
        };
        this.socket.onopen = () => {
            this.setState({
                init: true
            });
            if (autoLogin) {
                this.handleLogin.call(this);
            }
        };
        this.socketEvents["shard-port-number"] = ({portNumber, isStandalone}: {portNumber: number, isStandalone: boolean}) => {
            this.shardPortNumber = portNumber;
            if (this.socket && !isStandalone) {
                this.socket.close();
            }
        };
        this.socketEvents["send-world"] = this.handleSendWorld;
        this.socketEvents["ack-init-loop"] = () => {
        };
        this.socketEvents["send-frame"] = this.handleSendFrame;
        this.socketEvents["send-players"] = this.handleSendPlayers;
        this.socketEvents["generic-message"] = this.handleGenericMessage;
        this.socketEvents["send-spawn-factions"] = this.handleSpawnFactions;
        this.socketEvents["send-spawn-planets"] = this.handleSpawnPlanets;
        this.socketEvents["send-spawn-locations"] = this.handleSpawnLocations;
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
     * --------------------------------------------------------
     * Transform objects to render them onto the screen.
     * --------------------------------------------------------
     */

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
     * ----------------------------------------------------------------------------------------------
     * Render functions used to draw stuff onto the screen. Each stuff has their own render function.
     * ----------------------------------------------------------------------------------------------
     */

    /**
     * Render a ship into a rectangle, Useful for UI button or game world.
     * @param planetDrawing
     * @param size
     * @private
     */
    private renderShip(planetDrawing: IDrawable<Ship>, size: number) {
        const shipData = GetShipData(planetDrawing.original.shipType, 1);
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
     * Run the game loop. This function is called 10 times a second to simulate a video game.
     */
    public gameLoop() {
        // refresh voronoi data, refresh occasionally since this is expensive.
        if (this.refreshVoronoiDataTick <= 60) {
            this.refreshVoronoiDataTick += 1;
        } else {
            this.refreshVoronoiDataTick = 0;
            this.refreshVoronoiData();
            this.setState({
                numNetworkFrames: this.numNetworkFrames
            });
        }

        if (!this.initialized) {
            return;
        }

        if (this.frameCounter++ % 3 === 0) {
            // handle server replies
            while (true) {
                const message = this.messages.shift();
                if (message) {
                    // has a message, process the message
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
            const playerData = (this.playerId && this.game.playerData.get(this.playerId)) || null;
            if (playerData && !playerData.autoPilotEnabled) {
                if (this.game.ships.has(playerData.shipId)) {
                    this.game.handleShipLoop(playerData.shipId, () => this.activeKeys, false);
                }
            }

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

        this.handleSoundEffects(false);
    }

    /**
     * -----------------------------------------------------------
     * Handle UI functions, responds to UI button clicks.
     * -----------------------------------------------------------
     */

    static cancelSpacebar(e: React.KeyboardEvent) {
        if (e.key === " ") {
            e.preventDefault();
        }
    }

    /**
     * Show scores for all players in the game.
     * @private
     */
    private handleShowScoreboard() {
        this.setState((s) => ({
            ...s,
            showScoreboard: !s.showScoreboard,
        }));
    }

    /**
     * Show different settings to change the appearance of the game.
     * @private
     */
    private handleShowSettings() {
        this.setState((s) => ({
            ...s,
            showSettings: !s.showSettings,
        }));
    }

    /**
     * Show different type of ships in the screen above the game. Used for debugging the appearance of each ship
     * without buying the ship in game.
     * @private
     */
    private handleShowShips(e: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            ...this.state,
            showShips: e.target.checked,
        });
    }

    /**
     * Show different items in the screen above the game. Used for debugging the appearance of each item without buying
     * the item in game.
     * @private
     */
    private handleShowItems(e: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            ...this.state,
            showItems: e.target.checked,
        });
    }

    /**
     * Show a voronoi map in game. Used for debugging the marking of land between each planet. Voronoi mode is used
     * to display political information such as the boundaries of each kingdom.
     * @private
     */
    private handleShowVoronoi(e: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            ...this.state,
            showVoronoi: e.target.checked,
        });
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
     * Change if autopilot is enabled in game.
     * @private
     */
    private handleAutoPilotEnabled(e: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            ...this.state,
            autoPilotEnabled: e.target.checked,
        }, () => {
            const message: IAutoPilotMessage = {
                messageType: EMessageType.AUTOPILOT,
                enabled: this.state.autoPilotEnabled
            };
            if (this.socket) {
                this.sendMessage("generic-message", message);
            }
            if (this.state.gameMode === EGameMode.SINGLE_PLAYER || this.state.gameMode === EGameMode.TUTORIAL) {
                this.localServerMessages.push(message);
            }
        });
    }

    /**
     * Enable or disable in game audio such as music.
     * @private
     */
    private handleAudioEnabled(e: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            ...this.state,
            audioEnabled: e.target.checked,
        }, () => {
            if (this.state.audioEnabled) {
                this.music.start();
            } else {
                this.music.stop();
            }
        });
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
            case "ArrowLeft": return "d";
            case "ArrowRight": return "a";
            case "a": return "d";
            case "d": return "a";
            default: return event.key;
        }
    }

    /**
     * Add key down event, send message to server.
     * @param event
     * @private
     */
    private handleKeyDown(event: KeyboardEvent) {
        const key = PixiGame.getKeyString(event);
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
        const key = PixiGame.getKeyString(event);
        const index = this.activeKeys.findIndex(k => k === key);
        if (index >= 0) {
            this.activeKeys.splice(index, 1);
        }
    }

    /**
     * Send touch key down message to server.
     * @param key
     * @private
     */
    private handleTouchDown(key: string) {
        if (!this.activeKeys.includes(key)) {
            this.activeKeys.push(key);
        }
    }

    /**
     * Send touch key up message to server.
     * @param event
     * @private
     */
    private handleTouchUp(key: string) {
        const index = this.activeKeys.findIndex(k => k === key);
        if (index >= 0) {
            this.activeKeys.splice(index, 1);
        }
    }

    /**
     * Make the mouse wheel change the zoom factor for the game.
     * @param event
     * @private
     */
    private handleMouseWheel(event: WheelEvent) {
        this.handleZoomEvent(event.deltaY);
    }

    /**
     * Handle the zoom event using any generic calling function, such as touch screen button
     * @param deltaY
     * @param strength
     * @private
     */
    private handleZoomEvent(deltaY: number, strength: number = 1) {
        if (deltaY < 0) {
            this.setState((state) => ({
                ...state,
                zoom: Math.min(state.zoom * (((Math.E - 1) / 10 * strength) + 1), 32)
            }));
        }
        else {
            this.setState((state) => ({
                ...state,
                zoom: Math.max(state.zoom / (((Math.E - 1) / 10 * strength) + 1), 0.25)
            }));
        }
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
                                id: `kingdom-${index}-duchy-${index2}`,
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
                                    id: `kingdom-${index}-duchy-${index2}-county-${index3}`,
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

        this.backgroundVoronoiData = this.game.voronoiTerrain.kingdoms.reduce((acc, k, index) => {
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
    }

    /**
     * Perform the initialization of the game.
     */
    componentDidMount() {
        // add renderer
        if (this.showAppBodyRef.current) {
            this.showAppBodyRef.current.appendChild(this.application.view);
        }

        window.addEventListener("resize", this.handleResize);
        this.handleResize();

        // handle keyboard input
        this.keyDownHandlerInstance = this.handleKeyDown.bind(this);
        this.keyUpHandlerInstance = this.handleKeyUp.bind(this);
        this.mouseWheelHandlerInstance = this.handleMouseWheel.bind(this);
        document.addEventListener("keydown", this.keyDownHandlerInstance);
        document.addEventListener("keyup", this.keyUpHandlerInstance);
        document.addEventListener("wheel", this.mouseWheelHandlerInstance);
    }

    componentWillUnmount() {
        // clean up renderer
        if (this.showAppBodyRef.current) {
            this.showAppBodyRef.current.removeChild(this.application.view);
        }

        // clean up game stuff
        document.removeEventListener("keydown", this.keyDownHandlerInstance);
        document.removeEventListener("keyup", this.keyUpHandlerInstance);
        document.removeEventListener("wheel", this.mouseWheelHandlerInstance);
        this.music.stop();
    }

    public selectFaction(faction: EFaction) {
        this.setState({
            faction,
            planetId: null
        });
    }

    public goToPlanetMenu() {
        const message: IChooseFactionMessage = {
            messageType: EMessageType.CHOOSE_FACTION,
            factionId: this.state.faction
        };
        if (this.state.faction) {
            this.setState({
                showSpawnMenu: false,
                showPlanetMenu: true,
                showMainMenu: false,
                showLoginMenu: false,
            });
            if (this.socket) {
                this.sendMessage("generic-message", message);
            }
            if (this.state.gameMode === EGameMode.SINGLE_PLAYER || this.state.gameMode === EGameMode.TUTORIAL) {
                this.localServerMessages.push(message);
            }
        }
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

    public selectPlanet(planetId: string) {
        if (this.state.faction) {
            this.setState({
                planetId
            });
        } else {
            this.returnToFactionMenu();
        }
    }

    public goToSpawnMenu() {
        if (this.state.faction && this.state.planetId) {
            this.setState({
                showSpawnMenu: true,
                showPlanetMenu: false,
                showMainMenu: false,
                showLoginMenu: false,
            });
            const message: IChoosePlanetMessage = {
                messageType: EMessageType.CHOOSE_PLANET,
                planetId: this.state.planetId
            };
            if (this.socket) {
                this.sendMessage("generic-message", message);
            }
            if (this.state.gameMode === EGameMode.SINGLE_PLAYER || this.state.gameMode === EGameMode.TUTORIAL) {
                this.localServerMessages.push(message);
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
            spawnShipType: null,
        }, () => {
            const message: IChoosePlanetMessage = {
                messageType: EMessageType.CHOOSE_PLANET,
                planetId: null
            };
            if (this.socket) {
                this.sendMessage("generic-message", message);
            }
            if (this.state.gameMode === EGameMode.SINGLE_PLAYER || this.state.gameMode === EGameMode.TUTORIAL) {
                this.localServerMessages.push(message);
            }
        });
    }

    public selectShip(planetId: string, spawnShipType: EShipType) {
        if (this.state.faction) {
            this.setState({
                planetId,
                spawnShipType
            });
        } else {
            this.returnToPlanetMenu();
        }
    }

    public spawnShip() {
        if (this.state.faction && this.state.planetId && this.state.spawnShipType) {
            this.setState({
                showSpawnMenu: false,
                showPlanetMenu: false,
                showMainMenu: false,
                showLoginMenu: false,
            });
            const message: ISpawnMessage = {
                messageType: EMessageType.SPAWN,
                shipType: this.state.spawnShipType,
                planetId: this.state.planetId
            };
            if (this.socket) {
                this.sendMessage("generic-message", message);
            }
            if (this.state.gameMode === EGameMode.SINGLE_PLAYER || this.state.gameMode === EGameMode.TUTORIAL) {
                this.localServerMessages.push(message);
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
            const message: IChoosePlanetMessage = {
                messageType: EMessageType.CHOOSE_PLANET,
                planetId: null
            };
            if (this.socket) {
                this.sendMessage("generic-message", message);
            }
            if (this.state.gameMode === EGameMode.SINGLE_PLAYER || this.state.gameMode === EGameMode.TUTORIAL) {
                this.localServerMessages.push(message);
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
            const message: IChooseFactionMessage = {
                messageType: EMessageType.CHOOSE_FACTION,
                factionId: null
            };
            if (this.socket) {
                this.sendMessage("generic-message", message);
            }
            if (this.state.gameMode === EGameMode.SINGLE_PLAYER || this.state.gameMode === EGameMode.TUTORIAL) {
                this.localServerMessages.push(message);
            }
        });
    }

    getShowShipDrawing(id: string, shipType: EShipType, factionType: EFaction | null = null): IDrawable<Ship> {
        const original: Ship = new Ship(this.game, shipType);
        original.id = id;
        if (factionType) {
            const faction = Array.from(this.game.factions.values()).find(f => f.id === factionType);
            if (faction) {
                original.color = faction.factionColor;
            }
        }
        return this.convertToDrawable("draw-ships", 1, this.rotatePlanet(original));
    }

    renderItemUrl(resourceType: EResourceType) {
        const item = RESOURCE_TYPE_TEXTURE_PAIRS.find(i => i.resourceType === resourceType);
        if (item) {
            return {url: item.url, name: item.name};
        } else {
            return {url: DEFAULT_IMAGE, name: "missing"};
        }
    }

    renderItem(resourceType: EResourceType) {
        const data = this.renderItemUrl(resourceType);
        return <img src={data.url} width={100} height={100} alt={data.name}/>;
    }

    invasionGauge(): React.ReactElement | null {
        const playerShip = this.findPlayerShip();
        if (!playerShip) {
            return null;
        }

        const nearestPlanet = this.game.voronoiTerrain.getNearestPlanet(playerShip.position.rotateVector([0, 0, 1]));
        let invasion: Invasion | null = this.game.invasions.get(nearestPlanet.id) ?? null;

        if (!invasion) {
            const order = playerShip.orders.find(o => o.orderType === EOrderType.INVADE);
            if (order && order.planetId) {
                invasion = this.game.invasions.get(order.planetId) ?? null;
            }
        }
        if (!invasion) {
            return null;
        }

        let timeLeft = 0;
        let progress = 0;
        let maxProgress = 0;
        let progress2 = 0;
        let maxProgress2 = 0;
        switch (invasion.invasionPhase) {
            case EInvasionPhase.STARTING: {
                timeLeft = invasion.startExpiration;
                maxProgress = 30 * 10;
                progress = invasion.startProgress;
                break;
            }
            case EInvasionPhase.CAPTURING: {
                timeLeft = invasion.captureExpiration;
                maxProgress = 3 * 60 * 10;
                progress = invasion.captureProgress;
                maxProgress2 = 3 * 10;
                progress2 = invasion.liberationProgress;
                break;
            }
        }
        const minute = timeLeft > 0 ? Math.floor(timeLeft / 10 / 60) : 0;
        const second = timeLeft > 0 ? Math.floor((timeLeft / 10) % 60) : 0;

        const gaugeWidth = this.state.width < 1024 ? this.state.width : this.state.width - 400;
        return (
            <svg style={{width: gaugeWidth, height: 100}}>
                <rect x={0} y={0} width={gaugeWidth} height={30} stroke="white" fill={invasion.defending.factionColor}/>
                <rect x={0} y={0} width={progress / maxProgress * (gaugeWidth)} height={30} stroke="white" fill={invasion.attacking.factionColor}/>
                <rect x={0} y={30} width={gaugeWidth} height={30} stroke="white" fill={invasion.attacking.factionColor}/>
                <rect x={0} y={30} width={progress2 / maxProgress2 * (gaugeWidth)} height={30} stroke="white" fill={invasion.defending.factionColor}/>
                <text x={(gaugeWidth) / 2} y={20} textAnchor="middle" fill="white">{minute}:{second < 10 ? "0" : ""}{second}</text>
                <text x={(gaugeWidth) / 2} y={50} textAnchor="middle" fill="white">{invasion.invasionPhase}</text>
                {
                    timeLeft < 0 ? <text x={(gaugeWidth) / 2} y={80} textAnchor="middle" fill="white">Overtime</text> : null
                }
            </svg>
        );
    }

    renderGameUiTop(): React.ReactElement | null {
        const gaugeWidth = this.state.width < 1024 ? this.state.width : this.state.width - 400;
        return (
            <React.Fragment>
                <Card className="TopLeft">
                </Card>
                <Card className="TopRight">
                    <Typography>Distance {Math.ceil(VoronoiGraph.angularDistance(
                        this.findPlayerShip()?.position.rotateVector([0, 0, 1]) ?? [0, 0, 1],
                        this.findPlayerShip()?.pathFinding?.points[0] ?? this.findPlayerShip()?.position.rotateVector([0, 0, 1]) ?? [0, 0, 1],
                        this.game.worldScale
                    ) * 1000)}</Typography>
                    <Typography>Mission {(this.findPlayerShip()?.orders[0] ?? null)?.orderType}</Typography>
                </Card>
                <div className="Top">
                    <svg style={{width: gaugeWidth, height: 24}}>
                        <rect x={0} y={0} width={((this.findPlayerShip()?.health ?? 100) + (this.findPlayerShip()?.repairTicks.reduce((acc, i) => acc + i, 0) ?? 0) ?? 100) / (this.findPlayerShip()?.maxHealth ?? 100) * (gaugeWidth)} height={24} fill="green" stroke="none"/>
                        <rect x={0} y={0} width={(this.findPlayerShip()?.health ?? 100) / (this.findPlayerShip()?.maxHealth ?? 100) * (gaugeWidth)} height={10} fill="yellow" stroke="none"/>
                        <rect x={0} y={0} width={((this.findPlayerShip()?.health ?? 100) - (this.findPlayerShip()?.burnTicks.reduce((acc, i) => acc + i, 0) ?? 0) ?? 100) / (this.findPlayerShip()?.maxHealth ?? 100) * (gaugeWidth)} height={24} fill="red" stroke="none"/>
                        <text x={(gaugeWidth) * (1 / 7)} y={18} fill="white" stroke="none" textAnchor="middle">Damage {(this.playerId && this.game.scoreBoard.damage.find(x => x.playerId === this.playerId)?.damage) ?? 0}</text>
                        <text x={(gaugeWidth) * (2 / 7)} y={18} fill="white" stroke="none" textAnchor="middle">Loot {(this.playerId && this.game.scoreBoard.loot.find(x => x.playerId === this.playerId)?.count) ?? 0}</text>
                        <text x={(gaugeWidth) * (3 / 7)} y={18} fill="white" stroke="none" textAnchor="middle">Money {(this.playerId && this.game.scoreBoard.money.find(x => x.playerId === this.playerId)?.amount) ?? 0}</text>
                        <text x={(gaugeWidth) * (4 / 7)} y={18} fill="white" stroke="none" textAnchor="middle">Land {(this.playerId && this.game.scoreBoard.land.find(x => x.playerId === this.playerId)?.amount) ?? 0}</text>
                        <text x={(gaugeWidth) * (5 / 7)} y={18} fill="white" stroke="none" textAnchor="middle">Capture {(this.playerId && this.game.scoreBoard.capture.find(x => x.playerId === this.playerId)?.count) ?? 0}</text>
                        <text x={(gaugeWidth) * (6 / 7)} y={18} fill="white" stroke="none" textAnchor="middle">Bounty {(this.playerId && this.game.scoreBoard.bounty.find(x => x.playerId === this.playerId)?.bountyAmount) ?? 0}</text>
                    </svg>
                    {
                        this.invasionGauge()
                    }
                </div>
            </React.Fragment>
        );
    }

    renderGameUiBottom(): React.ReactElement | null {
        return (
            <React.Fragment>
                <Card className="BottomRight">
                    <Typography>Gold {this.playerId && this.game.playerData.get(this.playerId)?.moneyAccount.currencies.find(f => f.currencyId === "GOLD")?.amount}</Typography>
                </Card>
                <Card className="BottomLeft">
                </Card>
                <Stack className="Bottom" direction="row" spacing={2} justifyItems="center">
                    {
                        new Array(GetShipData(this.findPlayerShip()?.shipType ?? EShipType.CUTTER, this.game.worldScale).cargoSize).fill(0).map((v, i) => {
                            return (
                                <Card>
                                    <CardContent>
                                        <Badge badgeContent={this.findPlayerShip()?.cargo[i] ? this.findPlayerShip()?.cargo[i].amount : null} color={"primary"}>
                                            <Avatar variant="rounded" style={{width: 50, height: 50}} srcSet={this.findPlayerShip()?.cargo[i] ? this.renderItemUrl(this.findPlayerShip()?.cargo[i].resourceType ?? EResourceType.CACAO).url : undefined}>
                                                {null}
                                            </Avatar>
                                        </Badge>
                                        <Typography variant="caption">{this.findPlayerShip()?.cargo[i] ? this.findPlayerShip()?.cargo[i].resourceType : ""}</Typography>
                                    </CardContent>
                                </Card>
                            )
                        })
                    }
                </Stack>
            </React.Fragment>
        );
    }

    renderMobileControls(): React.ReactElement | null {
        return (
            <React.Fragment>
                <svg width={200} height={200} viewBox="-30 -30 260 260" style={{position: "absolute", top: (this.state.height - 200) / 2, bottom: (this.state.height - 200) / 2, left: 0}}>
                    <circle fill="grey" stroke="white" opacity={0.3} cx={25} cy={25} r={50}
                            onMouseDown={() => this.handleZoomEvent(1, 10)}
                            onTouchStart={() => this.handleZoomEvent(1, 10)}/>
                    <circle fill="grey" stroke="white" opacity={0.3} cx={25} cy={175} r={50}
                            onMouseDown={() => this.handleZoomEvent(-1, 10)}
                            onTouchStart={() => this.handleZoomEvent(-1, 10)}/>
                    <circle fill="grey" stroke="white" opacity={0.3} cx={100} cy={100} r={50}
                            onMouseDown={() => this.handleTouchDown(" ")} onMouseUp={() => this.handleTouchUp(" ")}
                            onTouchStart={() => this.handleTouchDown(" ")} onTouchEnd={() => this.handleTouchUp(" ")}/>
                </svg>
                <svg width={200} height={200} viewBox="-30 -30 260 260" style={{position: "absolute", top: (this.state.height - 200) / 2, bottom: (this.state.height - 200) / 2, right: 0}}>
                    <circle fill="grey" stroke="white" opacity={0.3} cx={100} cy={25} r={50}
                            onMouseDown={() => this.handleTouchDown("w")} onMouseUp={() => this.handleTouchUp("w")}
                            onTouchStart={() => this.handleTouchDown("w")} onTouchEnd={() => this.handleTouchUp("w")}/>
                    <circle fill="grey" stroke="white" opacity={0.3} cx={100} cy={175} r={50}
                            onMouseDown={() => this.handleTouchDown("s")} onMouseUp={() => this.handleTouchUp("s")}
                            onTouchStart={() => this.handleTouchDown("s")} onTouchEnd={() => this.handleTouchUp("s")}/>
                    <circle fill="grey" stroke="white" opacity={0.3} cx={25} cy={100} r={50}
                            onMouseDown={() => this.handleTouchDown("d")} onMouseUp={() => this.handleTouchUp("d")}
                            onTouchStart={() => this.handleTouchDown("d")} onTouchEnd={() => this.handleTouchUp("d")}/>
                    <circle fill="grey" stroke="white" opacity={0.3} cx={175} cy={100} r={50}
                            onMouseDown={() => this.handleTouchDown("a")} onMouseUp={() => this.handleTouchUp("a")}
                            onTouchStart={() => this.handleTouchDown("a")} onTouchEnd={() => this.handleTouchUp("a")}/>
                </svg>
            </React.Fragment>
        );
    }

    render() {
        if (this.showAppBodyRef.current) {
            this.application.resizeTo = this.showAppBodyRef.current as HTMLElement;
        }

        return (
            <div className="App" style={{width: "100vw", height: "100vh"}}>
                <WebsiteDrawer rightSide={
                    <React.Fragment>
                        <Button variant="contained" color="secondary"
                                onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={this.handleShowSettings.bind(this)}>Settings</Button>
                        <Button variant="contained" color="secondary"
                                onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={this.handleShowScoreboard.bind(this)}>Scoreboard</Button>
                        <FormControlLabel control={<Checkbox tabIndex={-1} checked={this.state.audioEnabled}
                                                             onKeyDown={PixiGame.cancelSpacebar.bind(this)} onChange={this.handleAudioEnabled.bind(this)} icon={<MusicOff/>} checkedIcon={<MusicNote/>} color="default" />} label="Audio"/>
                        {
                            this.state.highlightAutopilotButton ? (
                                <div style={{
                                    boxShadow: "0 0 0 100vmax rgb(0,0,0,0.3)",
                                    borderRadius: 8
                                }}>
                                    <FormControlLabel control={<Checkbox tabIndex={-1} checked={this.state.autoPilotEnabled}
                                                                         onKeyDown={PixiGame.cancelSpacebar.bind(this)} onChange={this.handleAutoPilotEnabled.bind(this)} icon={<TvOff/>} checkedIcon={<Tv/>} color="default" />} label="AutoPilot"/>
                                    <Popper open>
                                        <Card>
                                            <CardHeader title="Click Me"/>
                                            <CardContent title="This is the autopilot button"/>
                                        </Card>
                                    </Popper>
                                </div>
                            ) : (
                                <FormControlLabel control={<Checkbox tabIndex={-1} checked={this.state.autoPilotEnabled}
                                                                     onKeyDown={PixiGame.cancelSpacebar.bind(this)} onChange={this.handleAutoPilotEnabled.bind(this)} icon={<TvOff/>} checkedIcon={<Tv/>} color="default" />} label="AutoPilot"/>
                            )
                        }
                    </React.Fragment>
                }/>
                <div className="AppMain" ref={this.measureAppBodyRef}>
                    <div style={{position: "absolute", top: this.state.marginTop, left: this.state.marginLeft, bottom: this.state.marginBottom, right: this.state.marginRight}}>
                        <div style={{width: this.state.width, height: this.state.height}} ref={this.showAppBodyRef}/>
                    </div>
                    <div className="AppMainContent">
                        {
                            !this.state.showLoginMenu && !this.state.showMainMenu && !this.state.showPlanetMenu && !this.state.showSpawnMenu && this.state.width < 1024 ? (
                                <div className="MobileGameUi">
                                    <div style={{position: "absolute", top: 0, left: this.state.marginLeft, bottom: this.state.marginBottom + this.state.height, right: this.state.marginRight}}>
                                        {this.renderGameUiTop()}
                                    </div>
                                    <div style={{position: "absolute", top: this.state.marginTop + this.state.height, left: this.state.marginLeft, bottom: 0, right: this.state.marginRight}}>
                                        {this.renderGameUiBottom()}
                                    </div>
                                </div>
                            ): null
                        }
                        <div style={{position: "absolute", top: this.state.marginTop, left: this.state.marginLeft, bottom: this.state.marginBottom, right: this.state.marginRight}}>
                            <Grid container direction="column" justifyContent="center" alignItems="center" spacing={2} xs={12} paddingTop={12}>
                                {
                                    this.state.mouseImageClass ? (
                                        <Grid item xs={12} justifyContent="center" alignItems="center">
                                            <Card>
                                                <CardHeader title="Use Mouse"/>
                                                <CardContent>
                                                    <MouseImage className={`mouse-image-${this.state.mouseImageClass}`}/>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    ) : null
                                }
                                {
                                    this.state.keyboardImageClass ? (
                                        <Grid item xs={12} justifyContent="center" alignItems="center">
                                            <Card>
                                                <CardHeader title="Press Keyboard"/>
                                                <CardContent>
                                                    <WasdImage className={`wasd-image-${this.state.keyboardImageClass}`}/>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    ) : null
                                }
                                <Grid item xs={12} justifyContent="center" alignItems="center">
                                    <Paper style={{maxHeight: "40vh", maxWidth: "80vw", overflow: "auto", backgroundColor: "none"}}>
                                        <Grid container spacing={2} columns={{
                                            xs: 6,
                                            lg: 12,
                                        }}>
                                            {
                                                this.forms.cards.map(card => {
                                                    return (
                                                        <Grid item xs={12} key={card.title} justifyContent="center" alignItems="center">
                                                            <CardRenderer card={card} submitForm={this.submitForm.bind(this)}/>
                                                        </Grid>
                                                    );
                                                })
                                            }
                                        </Grid>
                                    </Paper>
                                </Grid>
                                {
                                    this.state.gameMode === EGameMode.MAIN_MENU ? (
                                        <Grid item xs={12} justifyContent="center" alignItems="center" onWheel={(e) => {e.preventDefault();}}>
                                            <Card>
                                                <CardHeader title="Globular Marauders"/>
                                                <CardContent>
                                                    <List>
                                                        <ListItem onClick={this.handleSwitchGameMode.bind(this, EGameMode.TUTORIAL)}>
                                                            <ListItemAvatar>
                                                                <School/>
                                                            </ListItemAvatar>
                                                            <ListItemText>Tutorial</ListItemText>
                                                        </ListItem>
                                                        <ListItem onClick={this.handleSwitchGameMode.bind(this, EGameMode.SINGLE_PLAYER)}>
                                                            <ListItemAvatar>
                                                                <SmartToy/>
                                                            </ListItemAvatar>
                                                            <ListItemText>Single Player</ListItemText>
                                                        </ListItem>
                                                        <ListItem disabled={true}>
                                                            <ListItemAvatar>
                                                                <People/>
                                                            </ListItemAvatar>
                                                            <ListItemText>Multiplayer</ListItemText>
                                                        </ListItem>
                                                    </List>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    ) : null
                                }
                                {
                                    this.state.showLoginMenu ? (
                                        <Grid item xs={12} justifyContent="center" alignItems="center">
                                            <Card>
                                                <CardHeader title="Login"/>
                                                <CardContent>
                                                    {
                                                        this.state.init ? (
                                                            <Fragment>
                                                                <TextField fullWidth value={this.state.userName} onChange={this.handleUserName.bind(this)} label={"Username"} placeholder="PirateDude" helperText="A fun name to sow dread into your enemies"/>
                                                                <Button fullWidth variant="contained"
                                                                        onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={this.handleLogin.bind(this)}>Login</Button>
                                                            </Fragment>
                                                        ) : (
                                                            <Typography>Connecting to server...</Typography>
                                                        )
                                                    }
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    ) : null
                                }
                                {
                                    this.state.showMainMenu ? (
                                        <Grid item xs={12} justifyContent="center" alignItems="center" style={{marginTop: "20vh"}}>
                                            <Grid container>
                                                <Grid item xs={12}>
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Button fullWidth variant="contained"
                                                            onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={this.goToPlanetMenu.bind(this)}>Next</Button>
                                                </Grid>
                                            </Grid>
                                            <Paper style={{maxHeight: "40vh", maxWidth: "80vw", overflow: "auto", backgroundColor: "none"}}>
                                                <Grid container spacing={2} columns={{
                                                    xs: 6,
                                                    lg: 12,
                                                }}>
                                                    {
                                                        this.spawnFactions.map((f, _, arr) => {
                                                            const faction = this.game.factions.get(f.factionId);
                                                            if (!faction) {
                                                                return null;
                                                            }
                                                            return (
                                                                <Grid item xs={12} lg={arr.length >= 2 ? 6 : 12}>
                                                                    <Card>
                                                                        <CardActionArea onClick={this.selectFaction.bind(this, faction.id)}>
                                                                            <CardContent>
                                                                                <Avatar variant="rounded" style={{width: 256, height: 256, backgroundColor: faction.factionColor}}>{faction.id}</Avatar>
                                                                            </CardContent>
                                                                            <CardHeader title={<span>{this.state.faction === faction.id ? <CheckBoxIcon/> : <CheckBoxOutlineBlankIcon/>} {faction.id}</span>} subheader={GetFactionSubheader(faction.id)}>
                                                                            </CardHeader>
                                                                        </CardActionArea>
                                                                        <CardActions>
                                                                            <Tooltip title="Planets owned">
                                                                                <Badge badgeContent={f.numPlanets} color={"primary"}>
                                                                                    <Public/>
                                                                                </Badge>
                                                                            </Tooltip>
                                                                            <Tooltip title="Ships in play">
                                                                                <Badge badgeContent={f.numShips} color={"primary"}>
                                                                                    <DirectionsBoat/>
                                                                                </Badge>
                                                                            </Tooltip>
                                                                            <Tooltip title="Invasion events">
                                                                                <Badge badgeContent={f.numInvasions} color={"primary"}>
                                                                                    <SvgIcon>
                                                                                        <Attack/>
                                                                                    </SvgIcon>
                                                                                </Badge>
                                                                            </Tooltip>
                                                                        </CardActions>
                                                                    </Card>
                                                                </Grid>
                                                            );
                                                        })
                                                    }
                                                </Grid>
                                            </Paper>
                                        </Grid>
                                    ) : null
                                }
                                {
                                    this.state.showPlanetMenu ? (
                                        <Grid item xs={12} justifyContent="center" alignItems="center" style={{marginTop: "20vh"}}>
                                            <Grid container>
                                                <Grid item xs={12}>
                                                    <Button fullWidth variant="contained"
                                                            onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={this.returnToFactionMenu.bind(this)}>Back</Button>
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Button fullWidth variant="contained"
                                                            onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={this.goToSpawnMenu.bind(this)}>Next</Button>
                                                </Grid>
                                            </Grid>
                                            <Paper style={{maxHeight: "40vh", maxWidth: "80vw", overflow: "auto", backgroundColor: "none"}}>
                                                <Grid container spacing={2} columns={{
                                                    xs: 6,
                                                    lg: 12,
                                                }}>
                                                    {
                                                        this.spawnPlanets.map((f, i, arr) => {
                                                            const planet = this.game.planets.get(f.planetId);
                                                            const planetName = planet?.name ?? f.planetId;
                                                            return (
                                                                <Grid item xs={12} lg={arr.length >= 2 ? 6 : 12}>
                                                                    <Card>
                                                                        <CardActionArea onClick={this.selectPlanet.bind(this, f.planetId)}>
                                                                            <CardContent>
                                                                                <Avatar variant="rounded" style={{width: 256, height: 256}} alt={planetName} srcSet={this.planetThumbnails.get(f.planetId) ?? undefined}>
                                                                                </Avatar>
                                                                            </CardContent>
                                                                            <CardHeader title={<span>{this.state.planetId === f.planetId ? <CheckBoxIcon/> : <CheckBoxOutlineBlankIcon/>} {planetName}</span>} subheader={`(${f.numShipsAvailable} ships)`}>
                                                                            </CardHeader>
                                                                        </CardActionArea>
                                                                        <CardActions>
                                                                            <Tooltip title="Settlers">
                                                                                <Badge badgeContent={f.numSettlers} color={"primary"}>
                                                                                    <Public/>
                                                                                </Badge>
                                                                            </Tooltip>
                                                                            <Tooltip title="Traders">
                                                                                <Badge badgeContent={f.numTraders} color={"primary"}>
                                                                                    <DirectionsBoat/>
                                                                                </Badge>
                                                                            </Tooltip>
                                                                            <Tooltip title="Pirates">
                                                                                <Badge badgeContent={f.numPirates} color={"primary"}>
                                                                                    <SvgIcon>
                                                                                        <Pirate/>
                                                                                    </SvgIcon>
                                                                                </Badge>
                                                                            </Tooltip>
                                                                            <Tooltip title="Invaders">
                                                                                <Badge badgeContent={f.numInvaders} color={"primary"}>
                                                                                    <SvgIcon>
                                                                                        <Attack/>
                                                                                    </SvgIcon>
                                                                                </Badge>
                                                                            </Tooltip>
                                                                        </CardActions>
                                                                    </Card>
                                                                </Grid>
                                                            );
                                                        })
                                                    }
                                                </Grid>
                                            </Paper>
                                        </Grid>
                                    ) : null
                                }
                                {
                                    this.state.showSpawnMenu ? (
                                        <Grid item xs={12} justifyContent="center" alignItems="center" style={{marginTop: "20vh"}}>
                                            <Grid container>
                                                <Grid item xs={12}>
                                                    <Button fullWidth variant="contained"
                                                            onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={this.returnToPlanetMenu.bind(this)}>Back</Button>
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Button fullWidth variant="contained"
                                                            onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={this.spawnShip.bind(this)}>Next</Button>
                                                </Grid>
                                            </Grid>
                                            <Paper style={{maxHeight: "40vh", maxWidth: "80vw", overflow: "auto", backgroundColor: "none"}}>
                                                <Grid container spacing={2} columns={{
                                                    xs: 6,
                                                    lg: 12,
                                                }}>
                                                    {
                                                        this.spawnLocations.message ? (
                                                            <Grid item xs={12}>
                                                                <Card>
                                                                    <CardContent>
                                                                        <Typography>{this.spawnLocations.message}</Typography>
                                                                    </CardContent>
                                                                </Card>
                                                            </Grid>
                                                        ) : null
                                                    }
                                                    {
                                                        this.spawnLocations.results.map((f, i, arr) => {
                                                            return (
                                                                <Grid item xs={12} lg={arr.length >= 2 ? 6 : 12}>
                                                                    <Card>
                                                                        <CardActionArea onClick={this.selectShip.bind(this, f.id, f.shipType)}>
                                                                            <CardContent>
                                                                                <Avatar variant="rounded" style={{width: 256, height: 256}}>
                                                                                    <svg width="100" height="100">
                                                                                        <g transform="translate(50, 50)">
                                                                                            {
                                                                                                this.renderShip(this.getShowShipDrawing(f.shipType, f.shipType, this.state.faction), 1)
                                                                                            }
                                                                                        </g>
                                                                                    </svg>
                                                                                </Avatar>
                                                                            </CardContent>
                                                                            <CardHeader title={<span>{this.state.planetId === f.id && this.state.spawnShipType === f.shipType ? <CheckBoxIcon/> : <CheckBoxOutlineBlankIcon/>} {f.shipType}</span>} subheader={`(${f.price}) (${f.numShipsAvailable} ships)`}>
                                                                            </CardHeader>
                                                                        </CardActionArea>
                                                                    </Card>
                                                                </Grid>
                                                            );
                                                        })
                                                    }
                                                </Grid>
                                            </Paper>
                                        </Grid>
                                    ) : null
                                }
                            </Grid>
                            <div className="DesktopGameUi">
                                {
                                    !this.state.showLoginMenu && !this.state.showMainMenu && !this.state.showPlanetMenu && !this.state.showSpawnMenu && this.state.width >= 1024 ? (
                                        <React.Fragment>
                                            {this.renderGameUiTop()}
                                            {this.renderGameUiBottom()}
                                        </React.Fragment>
                                    ) : null
                                }
                                {
                                    !this.state.showLoginMenu && !this.state.showMainMenu && !this.state.showPlanetMenu && !this.state.showSpawnMenu && this.state.width < 1024 ? (
                                        this.renderMobileControls()
                                    ) : null
                                }
                            </div>
                            <Dialog open={this.state.showScoreboard} onClose={() => this.setState({showScoreboard: false})}>
                                <DialogTitle title="Scoreboard"/>
                                <DialogContent>
                                    <Grid container spacing={2} xs={12}>
                                        <Grid item xs={6}>
                                            <Card>
                                                <CardHeader title="Damage"/>
                                                <CardContent>
                                                    <List>
                                                        {
                                                            this.game.scoreBoard.damage.map(d => {
                                                                return (
                                                                    <ListItem key={d.playerId} dense>
                                                                        <ListItemText primary={d.name} secondary={d.damage}/>
                                                                    </ListItem>
                                                                );
                                                            })
                                                        }
                                                    </List>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Card>
                                                <CardHeader title="Loot"/>
                                                <CardContent>
                                                    <List>
                                                        {
                                                            this.game.scoreBoard.loot.map(d => {
                                                                return (
                                                                    <ListItem key={d.playerId} dense>
                                                                        <ListItemText primary={d.name} secondary={d.count}/>
                                                                    </ListItem>
                                                                );
                                                            })
                                                        }
                                                    </List>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Card>
                                                <CardHeader title="Money"/>
                                                <CardContent>
                                                    <List>
                                                        {
                                                            this.game.scoreBoard.money.map(d => {
                                                                return (
                                                                    <ListItem key={d.playerId} dense>
                                                                        <ListItemText primary={d.name} secondary={d.amount}/>
                                                                    </ListItem>
                                                                );
                                                            })
                                                        }
                                                    </List>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Card>
                                                <CardHeader title="Land"/>
                                                <CardContent>
                                                    <List>
                                                        {
                                                            this.game.scoreBoard.land.map(d => {
                                                                return (
                                                                    <ListItem key={d.playerId} dense>
                                                                        <ListItemText primary={d.name} secondary={d.amount}/>
                                                                    </ListItem>
                                                                );
                                                            })
                                                        }
                                                    </List>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Card>
                                                <CardHeader title="Bounty"/>
                                                <CardContent>
                                                    <List>
                                                        {
                                                            this.game.scoreBoard.bounty.map(d => {
                                                                return (
                                                                    <ListItem key={d.playerId} dense>
                                                                        <ListItemText primary={d.name} secondary={d.bountyAmount}/>
                                                                    </ListItem>
                                                                );
                                                            })
                                                        }
                                                    </List>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Card>
                                                <CardHeader title="Capture"/>
                                                <CardContent>
                                                    <List>
                                                        {
                                                            this.game.scoreBoard.capture.map(d => {
                                                                return (
                                                                    <ListItem key={d.playerId} dense>
                                                                        <ListItemText primary={d.name} secondary={d.count}/>
                                                                    </ListItem>
                                                                );
                                                            })
                                                        }
                                                    </List>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    </Grid>
                                </DialogContent>
                            </Dialog>
                            <Dialog open={this.state.showSettings} onClose={() => this.setState({showSettings: false})}>
                                <DialogTitle title="Settings"/>
                                <DialogContent>
                                    <Grid container spacing={2}>
                                        <Grid item>
                                            <FormControlLabel control={<Checkbox tabIndex={-1} checked={this.state.showShips}
                                                                                 onKeyDown={PixiGame.cancelSpacebar.bind(this)} onChange={this.handleShowShips.bind(this)}/>} label="Show Ships"/>
                                        </Grid>
                                        <Grid item>
                                            <FormControlLabel control={<Checkbox tabIndex={-1} checked={this.state.showItems}
                                                                                 onKeyDown={PixiGame.cancelSpacebar.bind(this)} onChange={this.handleShowItems.bind(this)}/>} label="Show Items"/>
                                        </Grid>
                                        <Grid item>
                                            <FormControlLabel control={<Checkbox tabIndex={-1} checked={this.state.showVoronoi}
                                                                                 onKeyDown={PixiGame.cancelSpacebar.bind(this)} onChange={this.handleShowVoronoi.bind(this)}/>} label="Show Voronoi"/>
                                            <RadioGroup name="Voronoi Mode" value={this.state.voronoiMode} onChange={(e, value) => this.handleChangeVoronoi(value as EVoronoiMode)}>
                                                <Grid container spacing={2}>
                                                    <Grid item xs={4}>
                                                        <FormControlLabel control={<Radio tabIndex={-1}/>} value={EVoronoiMode.KINGDOM} label="Kingdom"/>
                                                    </Grid>
                                                    <Grid item xs={4}>
                                                        <FormControlLabel control={<Radio tabIndex={-1}/>} value={EVoronoiMode.DUCHY} label="Duchy"/>
                                                    </Grid>
                                                    <Grid item xs={4}>
                                                        <FormControlLabel control={<Radio tabIndex={-1}/>} value={EVoronoiMode.COUNTY} label="County"/>
                                                    </Grid>
                                                </Grid>
                                            </RadioGroup>
                                        </Grid>
                                    </Grid>
                                </DialogContent>
                            </Dialog>
                            <Dialog open={this.state.showShips} onClose={() => this.setState({showShips: false})}>
                                <DialogTitle title="Ships"/>
                                <DialogContent>
                                    {
                                        this.state.showShips && (
                                            SHIP_DATA.map(ship => {
                                                return (
                                                    <Card key={`show-ship-${ship.shipType}`}>
                                                        <CardHeader title={ship.shipType}/>
                                                        <CardContent>
                                                            <svg width="100" height="100">
                                                                <g transform="translate(50, 50)">
                                                                    {
                                                                        this.renderShip(this.getShowShipDrawing(ship.shipType, ship.shipType), 1)
                                                                    }
                                                                </g>
                                                            </svg>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })
                                        )
                                    }
                                </DialogContent>
                            </Dialog>
                            <Dialog open={this.state.showItems} onClose={() => this.setState({showItems: false})}>
                                <DialogTitle title="Items"/>
                                <DialogContent>
                                    {
                                        this.state.showItems && (
                                            ITEM_DATA.map(item => {
                                                return (
                                                    <Card key={`show-item-${item.resourceType}`}>
                                                        <CardHeader title={item.resourceType}/>
                                                        <CardContent>
                                                            {
                                                                this.renderItem(item.resourceType)
                                                            }
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })
                                        )
                                    }
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default PixiGame;
