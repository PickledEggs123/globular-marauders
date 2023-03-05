import React, {Fragment} from 'react';
import '../App.scss';
import Quaternion from "quaternion";
import * as PIXI from "pixi.js";
import * as particles from "@pixi/particle-emitter";
import {Layer, Stage} from "@pixi/layers";
import {sound} from "@pixi/sound";
import {EResourceType, ITEM_DATA} from "@pickledeggs123/globular-marauders-game/lib/src/Resource";
import {
    ICameraState,
    ICameraStateWithOriginal,
    ICharacterSelectionItem,
    IDrawable,
    MIN_DISTANCE
} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import {EShipActionItemType, Ship, ShipActionItem,} from "@pickledeggs123/globular-marauders-game/lib/src/Ship";
import {EShipType, GetShipData,} from "@pickledeggs123/globular-marauders-game/lib/src/ShipType";
import {
    EClassData,
    EFaction,
    ERaceData,
    GameFactionData,
    GetSpellData,
    ISpellData,
} from "@pickledeggs123/globular-marauders-game/lib/src/EFaction";
import {
    DelaunayGraph,
    ITessellatedTriangle,
    VoronoiCell,
    VoronoiGraph
} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";
import {Planet} from "@pickledeggs123/globular-marauders-game/lib/src/Planet";
import {
    EMessageType,
    ESoundType,
    Game,
    IAutoPilotMessage,
    IChooseCrewSelectionMessage,
    IChooseFactionMessage,
    IChoosePlanetMessage,
    IJoinMessage,
    ISpawnMessage
} from "@pickledeggs123/globular-marauders-game/lib/src/Game";
import {
    Avatar,
    Badge,
    Box,
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
    IconButton,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Paper,
    Popper,
    Radio,
    RadioGroup,
    SvgIcon,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import {
    CHARACTER_TYPE_TEXTURE_PAIRS,
    DEFAULT_IMAGE,
    EVoronoiMode,
    RESOURCE_TYPE_TEXTURE_PAIRS,
    SPACE_BACKGROUND_TEXTURES
} from "../helpers/Data";
import {EGameMode, IPixiGameProps} from "./PixiGameBase";
import {
    Add,
    MusicNote,
    MusicOff,
    People,
    Public,
    Remove,
    Sailing,
    School,
    Settings,
    SmartToy,
    Tv,
    TvOff
} from "@mui/icons-material";
import ScoreboardIcon from "@mui/icons-material/Scoreboard";
import {EOrderType} from "@pickledeggs123/globular-marauders-game/lib/src/Order";
import {EInvasionPhase, Invasion} from "@pickledeggs123/globular-marauders-game/lib/src/Invasion";
import {ReactComponent as Pirate} from "../icons/pirate.svg";
import {ReactComponent as Attack} from "../icons/attack.svg";
import {ReactComponent as WasdImage} from "../icons/wasd.svg";
import {ReactComponent as MouseImage} from "../icons/mouse.svg";
import {WebsiteDrawer} from "../Drawer";
import {ITutorialScriptContext, tutorialScript} from "../scripts/tutorial";
import {CardRenderer} from "../forms/CardRenderer";
import {PixiGameNetworking} from "./PixiGameNetworking";
import cutterMeshJson from "@pickledeggs123/globular-marauders-generator/meshes/ships/cutter.mesh.json";
import sloopMeshJson from "@pickledeggs123/globular-marauders-generator/meshes/ships/sloop.mesh.json";
import corvetteMeshJson from "@pickledeggs123/globular-marauders-generator/meshes/ships/corvette.mesh.json";
import brigantineMeshJson from "@pickledeggs123/globular-marauders-generator/meshes/ships/brigantine.mesh.json";
import brigMeshJson from "@pickledeggs123/globular-marauders-generator/meshes/ships/brig.mesh.json";
import frigateMeshJson from "@pickledeggs123/globular-marauders-generator/meshes/ships/frigate.mesh.json";
import galleonMeshJson from "@pickledeggs123/globular-marauders-generator/meshes/ships/galleon.mesh.json";
import {DepthOutlineFilter} from "../filters/DepthOutline/DepthOutlineFilter";
import {RenderMobileGameUiTop} from "./RenderMobileGameUiTop";
import {RenderMobileGameUiBottom} from "./RenderMobileGameUiBottom";
import {LayerCompositeFilter} from "../filters/LayerComposite/LayerCompositeFilter";
import {ISetupScriptContext, setupScript} from "../scripts/setup";
import {Character, CharacterSelection} from "@pickledeggs123/globular-marauders-game/lib/src/Character";
import {computePositionPolarCorrectionFactorTheta} from "../helpers/pixiHelpers";

const GetFactionSubheader = (faction: EFaction): string | null => {
    return GameFactionData.find(x => x.id === faction)?.description ?? null;
}

export class PixiGame extends PixiGameNetworking {
    public application: PIXI.Application;
    public particleContainer: PIXI.Container;
    public colorLayer: Layer;
    public depthLayer: Layer;
    public projectileColorLayer: Layer;
    public textColorLayer: Layer;
    public staticStage: Stage;
    public depthOutlineFilter: DepthOutlineFilter;
    public projectileFilter: LayerCompositeFilter;
    public textFilter: LayerCompositeFilter;
    public starField: particles.Emitter | undefined;

    // game loop stuff
    activeKeys: any[] = [];
    private keyDownHandlerInstance: any;
    private keyUpHandlerInstance: any;
    private mouseWheelHandlerInstance: any;

    private mouseDownHandlerInstance: any;
    private mouseUpHandlerInstance: any;
    private mouseMoveHandlerInstance: any;

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
    public frameCounter: number = 0;

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
        loader.add("spellBallTrail", "images/sprites/cannonBallTrail.svg");
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
            this.sprites.spellBallTrail = resources.spellBallTrail.texture;
            this.sprites.glowTrail = resources.glowTrail.texture;
            this.sprites.starFieldSpeckle = resources.starFieldSpeckle.texture;

            setTimeout(() => {
                this.loadStarField();
            }, 1000);
        });
    };

    loadShipThumbnails = () => {
        this.shipThumbnails.set(EShipType.CUTTER, cutterMeshJson.image);
        this.shipThumbnails.set(EShipType.SLOOP, sloopMeshJson.image);
        this.shipThumbnails.set(EShipType.CORVETTE, corvetteMeshJson.image);
        this.shipThumbnails.set(EShipType.BRIGANTINE, brigantineMeshJson.image);
        this.shipThumbnails.set(EShipType.BRIG, brigMeshJson.image);
        this.shipThumbnails.set(EShipType.FRIGATE, frigateMeshJson.image);
        this.shipThumbnails.set(EShipType.GALLEON, galleonMeshJson.image);
    };

    handleSwitchGameMode = async (gameMode: EGameMode): Promise<void> => {
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
        await new Promise<void>((resolve) => {
            this.setState({gameMode}, () => {
                resolve();
            });
        });
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

                if (this.state.audioEnabled) {
                    this.music.stop();
                }
                break;
            }
            case EGameMode.SINGLE_PLAYER: {
                // initialize server game
                const serverGame = new Game();
                serverGame.worldScale = 4;
                serverGame.initializeGame(10);


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
                        return serverGame.getFormsForPlayer(player);
                    } else {
                        return null;
                    }
                };

                const context: ISetupScriptContext = {
                    playerData: tutorialPlayerData,
                };
                this.initialized = true;
                serverGame.scriptEvents.push(setupScript.call(this, serverGame, context));

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
                    for (const {type, data} of this.singlePlayerFormRequest) {
                        serverGame.handleFormApiRequestForPlayer(Array.from(serverGame.playerData.values())[0], {
                            buttonPath: type,
                            data
                        });
                    }
                    for (const [, message] of serverGame.outgoingMessages) {
                        this.handleGenericMessage(message);
                    }
                    this.localServerMessages.splice(0, this.localServerMessages.length);
                    this.singlePlayerFormRequest.splice(0, this.singlePlayerFormRequest.length);
                }, 100);

                if (this.state.audioEnabled) {
                    this.music.start();
                }
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
    }

    cameraPosition: Quaternion = Quaternion.ONE;
    cameraOrientation: Quaternion = Quaternion.ONE;
    private lastCameraOrientation: Quaternion = Quaternion.ONE;
    cameraCorrectionFactor: number = 0;
    cameraPositionVelocityTheta: number = Math.PI / 2;
    public getCamera() {
        return {
            cameraPosition: this.cameraPosition,
            cameraOrientation: this.cameraOrientation,
        };
    }

    handleDrawingOfText = (text: PIXI.Text, position: Quaternion, offset?: {x: number, y: number}, alwaysVisible: boolean = false) => {
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
        text.visible = (textPosition[2] > 0 && this.state.zoom * this.game.worldScale >= 6) || alwaysVisible;
    };

    updateMeshIfVisible = (item: {position: Quaternion, mesh: PIXI.Mesh<any>}) => {
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

    constructor(props: IPixiGameProps) {
        super(props);

        // setup rendering
        this.application = new PIXI.Application({
            width: this.state.width,
            height: this.state.height,
            backgroundColor: 0xff000000,
        });
        this.application.stage.sortableChildren = true;

        this.particleContainer = new PIXI.Container();
        this.particleContainer.zIndex = -15;

        // ship color
        this.staticStage = new Stage();
        this.colorLayer = new Layer();
        this.colorLayer.useRenderTexture = true;
        this.colorLayer.getRenderTexture().framebuffer.addDepthTexture();
        this.staticStage.addChild(this.colorLayer);
        this.projectileColorLayer = new Layer();
        this.projectileColorLayer.useRenderTexture = true;
        this.staticStage.addChild(this.projectileColorLayer);
        this.textColorLayer = new Layer();
        this.textColorLayer.useRenderTexture = true;
        this.staticStage.addChild(this.textColorLayer);

        // ship depth
        this.depthLayer = new Layer();
        this.depthLayer.useRenderTexture = true;
        this.depthLayer.getRenderTexture().framebuffer.addDepthTexture();
        this.staticStage.addChild(this.depthLayer);
        this.depthOutlineFilter = new DepthOutlineFilter(this, Math.floor(this.state.width / 2), Math.floor(this.state.height / 2));
        this.projectileFilter = new LayerCompositeFilter(this, "projectileColorLayer");
        this.textFilter = new LayerCompositeFilter(this, "textColorLayer");
        this.application.stage.filters = [this.depthOutlineFilter, this.projectileFilter, this.textFilter];
        this.application.stage.filterArea = this.application.screen;

        // draw app
        this.game.initializeGame();

        this.loadSoundIntoMemory();
        this.loadSpritesIntoMemory();
        this.loadShipThumbnails();

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

            // update mouseQ
            if (this.mouseMoveEvent) {
                this.mouseQ = this.findMouseQuaternion(this.mouseMoveEvent);
            }

            // sync mouse text
            if (this.isDrawMouseText && this.mouseQ && !this.mouseText) {
                const mouseText = new PIXI.Text("Fire");
                mouseText.style.fill = "white";
                mouseText.style.fontSize = 15;
                this.textColorLayer.addChild(mouseText);
                this.mouseText = mouseText;
            } else if (!this.isDrawMouseText && this.mouseText) {
                this.textColorLayer.removeChild(this.mouseText);
                this.mouseText = null;
            }
            if (this.isDrawMouseText && this.mouseQ && this.mouseText) {
                this.handleDrawingOfText(this.mouseText, this.mouseQ, undefined, true);
            }

            // sync game to Pixi renderer
            this.pixiStarResources.getResources().handleSync(pixiTick);
            this.pixiPlanetResources.getResources().handleSync(pixiTick);
            this.pixiShipResources.getResources().handleSync(pixiTick);
            this.pixiCannonBallResources.getResources().handleSync(pixiTick);
            this.pixiSpellBallResources.getResources().handleSync(pixiTick);
            this.pixiCrateResources.getResources().handleSync(pixiTick);

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

            // update each render
            this.pixiStarResources.getResources().handleRender();
            this.pixiPlanetResources.getResources().handleRender();
            this.pixiShipResources.getResources().handleRender();
            this.pixiCannonBallResources.getResources().handleRender();
            this.pixiSpellBallResources.getResources().handleRender();
            this.pixiCrateResources.getResources().handleRender();

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

            // render ship depth buffer
            this.application.renderer.render(this.staticStage);
            this.depthOutlineFilter.width = Math.floor(this.state.width / 2);
            this.depthOutlineFilter.height = Math.floor(this.state.height / 2);
            this.depthOutlineFilter.updateDepth();
            this.projectileFilter.width = Math.floor(this.state.width / 2);
            this.projectileFilter.height = Math.floor(this.state.height / 2);
            this.projectileFilter.updateDepth();
            this.textFilter.width = Math.floor(this.state.width / 2);
            this.textFilter.height = Math.floor(this.state.height / 2);
            this.textFilter.updateDepth();
        });
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

        this.game.soundEvents.splice(0, this.game.soundEvents.length);

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
        const now = performance.now();
        const delta = (now - this.clientLoopDeltaStart) / this.clientLoopDelta;
        const playerData = (this.playerId && this.game.playerData.get(this.playerId)) || null;
        if (playerData && !playerData.autoPilotEnabled) {
            if (this.game.ships.has(playerData.shipId)) {
                this.game.handleShipLoop(playerData.shipId, () => {
                    if (playerData && playerData.filterActiveKeys) {
                        return this.activeKeys.filter(x => playerData && playerData.filterActiveKeys && playerData.filterActiveKeys.includes(x));
                    } else {
                        return this.activeKeys;
                    }
                }, false, delta);
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
     * Show different settings to change the appearance of the game.
     * @private
     */
    private handleShowCharacterSelection() {
        this.setState((s) => ({
            ...s,
            showCharacterSelection: !s.showCharacterSelection,
        }));
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
     * @param key the key that was pressed
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
        // do zoom event
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

        // handle mouse input
        this.mouseDownHandlerInstance = this.downDrawTextAtMouse.bind(this);
        this.mouseUpHandlerInstance = this.upDrawTextAtMouse.bind(this);
        this.mouseMoveHandlerInstance = this.moveDrawTextAtMouse.bind(this);
        document.addEventListener("mousedown", this.mouseDownHandlerInstance);
        document.addEventListener("mouseup", this.mouseUpHandlerInstance);
        document.addEventListener("mousemove", this.mouseMoveHandlerInstance);
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
        document.removeEventListener("mousedown", this.mouseDownHandlerInstance);
        document.removeEventListener("mouseup", this.mouseUpHandlerInstance);
        document.removeEventListener("mousemove", this.mouseMoveHandlerInstance);
        this.music.stop();
    }

    public selectFaction(faction: EFaction) {
        this.setState({
            faction,
            planetId: null
        });
    }

    public sendCharacterSelection(characterSelection: ICharacterSelectionItem[]) {
        const message: IChooseCrewSelectionMessage = {
            messageType: EMessageType.CHOOSE_CREW_SELECTION,
            characterSelection
        };
        if (this.socket) {
            this.sendMessage("generic-message", message);
        }
        if (this.state.gameMode === EGameMode.SINGLE_PLAYER || this.state.gameMode === EGameMode.TUTORIAL) {
            this.localServerMessages.push(message);
        }
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

    renderCharacterUrl(characterRace: ERaceData) {
        const item = CHARACTER_TYPE_TEXTURE_PAIRS.find(i => i.characterRace === characterRace);
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

        const gaugeWidth = this.state.width < 768 ? this.state.width : this.state.width - 400;
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
        const gaugeWidth = this.state.width < 768 ? this.state.width : this.state.width - 400;
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
                    <svg style={{width: gaugeWidth, height: 44}}>
                        <rect x={0} y={0} width={((this.findPlayerShip()?.health ?? 100) + (this.findPlayerShip()?.repairTicks.reduce((acc, i) => acc + i, 0) ?? 0) ?? 100) / (this.findPlayerShip()?.maxHealth ?? 100) * (gaugeWidth)} height={44} fill="green" stroke="none"/>
                        <rect x={0} y={0} width={(this.findPlayerShip()?.health ?? 100) / (this.findPlayerShip()?.maxHealth ?? 100) * (gaugeWidth)} height={44} fill="yellow" stroke="none"/>
                        <rect x={0} y={0} width={((this.findPlayerShip()?.health ?? 100) - (this.findPlayerShip()?.burnTicks.reduce((acc, i) => acc + i, 0) ?? 0) ?? 100) / (this.findPlayerShip()?.maxHealth ?? 100) * (gaugeWidth)} height={44} fill="red" stroke="none"/>
                        <text x={(gaugeWidth) * (1 / 4)} y={18} fill="white" stroke="none" textAnchor="middle">Damage {(this.playerId && this.game.scoreBoard.damage.find(x => x.playerId === this.playerId)?.damage) ?? 0}</text>
                        <text x={(gaugeWidth) * (2 / 4)} y={18} fill="white" stroke="none" textAnchor="middle">Loot {(this.playerId && this.game.scoreBoard.loot.find(x => x.playerId === this.playerId)?.count) ?? 0}</text>
                        <text x={(gaugeWidth) * (3 / 4)} y={18} fill="white" stroke="none" textAnchor="middle">Money {(this.playerId && this.game.scoreBoard.money.find(x => x.playerId === this.playerId)?.amount) ?? 0}</text>
                        <text x={(gaugeWidth) * (1 / 4)} y={38} fill="white" stroke="none" textAnchor="middle">Land {(this.playerId && this.game.scoreBoard.land.find(x => x.playerId === this.playerId)?.amount) ?? 0}</text>
                        <text x={(gaugeWidth) * (2 / 4)} y={38} fill="white" stroke="none" textAnchor="middle">Capture {(this.playerId && this.game.scoreBoard.capture.find(x => x.playerId === this.playerId)?.count) ?? 0}</text>
                        <text x={(gaugeWidth) * (3 / 4)} y={38} fill="white" stroke="none" textAnchor="middle">Bounty {(this.playerId && this.game.scoreBoard.bounty.find(x => x.playerId === this.playerId)?.bountyAmount) ?? 0}</text>
                    </svg>
                    {
                        this.invasionGauge()
                    }
                </div>
            </React.Fragment>
        );
    }

    renderCharacterInUi(ship: Ship, v: number, i: number, ownShip: boolean) {
        const character = ship?.characters[i] as Character;
        const characterData = character.getClassData();
        const badgeContent = character.hp;
        let caption: string = "";
        const characterClass = characterData?.id ?? EClassData.FIGHTER;
        switch (characterClass) {
            case EClassData.CLERIC: {
                caption = "Cleric";
                break;
            }
            case EClassData.MAGE: {
                caption = "Mage";
                break;
            }
            case EClassData.FIGHTER: {
                caption = "Fighter";
                break;
            }
            case EClassData.PALADIN: {
                caption = "Paladin";
                break;
            }
            case EClassData.RANGER: {
                caption = "Ranger";
                break;
            }
            case EClassData.THIEF: {
                caption = "Thief";
                break;
            }
        }

        const openMagicMenu = ownShip ? () => {
            const spellItems = GetSpellData(characterClass);
            this.setState({
                spellItems
            });
        } : undefined;

        return (
            <Card key={`character-${i}`} style={{maxWidth: "fit-content"}} onClick={openMagicMenu}>
                <CardContent>
                    <Badge badgeContent={badgeContent} color={badgeContent > 9 ? "success" : badgeContent > 0 ? "warning" : "error"}>
                        <Avatar variant="rounded" style={{width: 50, height: 50}} srcSet={this.renderCharacterUrl(character.characterRace).url}>
                            {null}
                        </Avatar>
                    </Badge>
                    <br />
                    <Typography variant="caption" fontSize={12}>{caption}</Typography>
                </CardContent>
            </Card>
        );
    }

    renderGameUiBottom(): React.ReactElement | null {
        const playerShip = this.findPlayerShip();
        const characterBattle = playerShip && Array.from(this.game.characterBattles.values()).find(x => x.ships.includes(playerShip!));
        const otherShip = characterBattle?.ships.filter(x => x.faction !== playerShip?.faction)[0];
        return (
            <React.Fragment>
                <Card className="BottomRight">
                </Card>
                <Card className="BottomLeft">
                </Card>
                <Box className="Bottom" style={{display: "flex", flexWrap: "wrap", flexDirection: "column"}}>
                    <Box style={{display: "flex", flexWrap: "wrap", visibility: otherShip ? "visible" : "hidden"}}>
                        <Typography variant="h1" color="white">Enemies</Typography>
                        {
                            new Array(otherShip?.characters.length ?? 0).fill(0).map((v, i) => this.renderCharacterInUi(otherShip!, v, i, false))
                        }
                    </Box>
                    <Box style={{display: "flex", flexWrap: "wrap"}}>
                        {
                            new Array(playerShip?.characters.length ?? 0).fill(0).map((v, i) => this.renderCharacterInUi(playerShip!, v, i, true))
                        }
                        {
                            new Array(GetShipData(playerShip?.shipType ?? EShipType.CUTTER, this.game.worldScale).cargoSize).fill(0).map((v, i) => {
                                return (
                                    <Card key={`cargo-${i}`} style={{maxWidth: "fit-content"}}>
                                        <CardContent>
                                            <Badge badgeContent={playerShip?.cargo[i] ? playerShip?.cargo[i].amount : null} color={"primary"}>
                                                <Avatar variant="rounded" style={{width: 50, height: 50}} srcSet={playerShip?.cargo[i] ? this.renderItemUrl(playerShip?.cargo[i].resourceType ?? EResourceType.CACAO).url : this.renderItemUrl("UNKNOWN" as any).url}>
                                                    {null}
                                                </Avatar>
                                            </Badge>
                                            <br />
                                            <Typography variant="caption" fontSize={12}>{playerShip?.cargo[i] ? playerShip?.cargo[i].resourceType : ""}</Typography>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        }
                    </Box>
                </Box>
            </React.Fragment>
        );
    }

    renderMobileControls(): React.ReactElement | null {
        return (
            <React.Fragment>
                <svg width={200} height={200} viewBox="-30 -30 260 260" style={{position: "absolute", top: (this.state.height - 200) / 2, bottom: (this.state.height - 200) / 2, left: 0}} className="text-selection-none">
                    <circle fill="grey" stroke="white" opacity={0.3} cx={25} cy={25} r={50}
                            onTouchStart={() => this.handleZoomEvent(1, 10)} className="text-selection-none"/>
                    <circle fill="grey" stroke="white" opacity={0.3} cx={25} cy={175} r={50}
                            onTouchStart={() => this.handleZoomEvent(-1, 10)} className="text-selection-none"/>
                    <circle fill="grey" stroke="white" opacity={0.3} cx={100} cy={100} r={50}
                            onTouchStart={() => this.handleTouchDown(" ")} onTouchEnd={() => this.handleTouchUp(" ")} className="text-selection-none"/>
                </svg>
                <svg width={200} height={200} viewBox="-30 -30 260 260" style={{position: "absolute", top: (this.state.height - 200) / 2, bottom: (this.state.height - 200) / 2, right: 0}} className="text-selection-none">
                    <circle fill="grey" stroke="white" opacity={0.3} cx={100} cy={25} r={50}
                            onMouseDown={() => this.handleTouchDown("w")} onMouseUp={() => this.handleTouchUp("w")}
                            onTouchStart={() => this.handleTouchDown("w")} onTouchEnd={() => this.handleTouchUp("w")} className="text-selection-none"/>
                    <circle fill="grey" stroke="white" opacity={0.3} cx={100} cy={175} r={50}
                            onMouseDown={() => this.handleTouchDown("s")} onMouseUp={() => this.handleTouchUp("s")}
                            onTouchStart={() => this.handleTouchDown("s")} onTouchEnd={() => this.handleTouchUp("s")} className="text-selection-none"/>
                    <circle fill="grey" stroke="white" opacity={0.3} cx={25} cy={100} r={50}
                            onMouseDown={() => this.handleTouchDown("d")} onMouseUp={() => this.handleTouchUp("d")}
                            onTouchStart={() => this.handleTouchDown("d")} onTouchEnd={() => this.handleTouchUp("d")} className="text-selection-none"/>
                    <circle fill="grey" stroke="white" opacity={0.3} cx={175} cy={100} r={50}
                            onMouseDown={() => this.handleTouchDown("a")} onMouseUp={() => this.handleTouchUp("a")}
                            onTouchStart={() => this.handleTouchDown("a")} onTouchEnd={() => this.handleTouchUp("a")} className="text-selection-none"/>
                </svg>
            </React.Fragment>
        );
    }

    renderCharacterSelection() {
        const playerData = this.playerId && this.game.playerData.get(this.playerId);
        if (!playerData) {
            return (
                <Typography variant="h6">Could not find player data</Typography>
            );
        }

        const selectionData = playerData.defaultCharacterSelection;
        if (!selectionData) {
            return (
                <Typography variant="h6">Could not find selection data</Typography>
            );
        }

        const classData = GameFactionData.find(x => x.id === this.state.faction)?.races.reduce((acc, r) => {
            return [...acc, ...r.classes.reduce((acc2, c) => {
                const item: ICharacterSelectionItem = {
                    faction: this.state.faction!,
                    characterRace: r.id,
                    characterClass: c.id,
                    amount: selectionData.find(i => i.faction === this.state.faction! && i.characterRace === r.id && i.characterClass === c.id)?.amount ?? 0
                };
                return [...acc2, item];
            }, [] as ICharacterSelectionItem[])];
        }, [] as ICharacterSelectionItem[]) ?? [] as ICharacterSelectionItem[];
        const characterSelection = CharacterSelection.deserialize(classData, {items: selectionData});
        const renderGridItem = (v: ICharacterSelectionItem, i: number) => {
            const name = GameFactionData.find(x => x.id === v.faction)?.races.find(x => x.id === v.characterRace)?.classes.find(x => x.id === v.characterClass)?.name ?? "N/A";
            return (
                <Card style={{width: "fit-content"}}>
                    <CardHeader title={name}></CardHeader>
                    <CardContent>
                        <Box style={{display: "flex", flexDirection: "row", width: "fit-content"}}>
                            <Tooltip title="Decrement">
                                <IconButton
                                    onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={() => {
                                    characterSelection.removeCharacterClass(v.faction, v.characterRace, v.characterClass);
                                    this.sendCharacterSelection(characterSelection.serialize().items);
                                }}>
                                    <Remove/>
                                </IconButton>
                            </Tooltip>
                            <Typography variant="h6">{v.amount}</Typography>
                            <Tooltip title="Increment">
                                <IconButton
                                    onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={() => {
                                    characterSelection.addCharacterClass(v.faction, v.characterRace, v.characterClass);
                                    this.sendCharacterSelection(characterSelection.serialize().items);
                                }}>
                                    <Add/>
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </CardContent>
                </Card>
            );
        };

        return (
            <Box style={{display: "flex", flexWrap: "wrap"}}>
                {
                    characterSelection.items.map((v, i) => renderGridItem(v, i))
                }
            </Box>
        );
    }

    findMouseQuaternion(event: React.MouseEvent) {
        // get element coordinates
        const node = this.application.view as HTMLElement;
        const bounds = node.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;

        // if inside bounds of the play area
        const size = Math.min(this.state.width, this.state.height);
        if (x >= 0 && x <= size && y >= 0 && y <= size) {
            const clickScreenPoint: [number, number, number] = [
                ((x / size) - 0.5) * 2 / this.state.zoom / this.game.worldScale,
                ((y / size) - 0.5) * 2 / this.state.zoom / this.game.worldScale,
                0
            ];
            clickScreenPoint[0] *= -1;
            clickScreenPoint[1] *= -1;
            clickScreenPoint[2] = Math.sqrt(1 - Math.pow(clickScreenPoint[0], 2) - Math.pow(clickScreenPoint[1], 2));

            if (isNaN(clickScreenPoint[2]))
                return this.getPlayerShip().position;

            // compute sphere position
            const clickQuaternion = Quaternion.fromBetweenVectors([0, 0, 1], clickScreenPoint);
            const ship = this.getPlayerShip();
            return ship.position.clone()
                .mul(Quaternion.fromAxisAngle([0, 0, 1], this.cameraCorrectionFactor))
                .mul(ship.orientation.clone())
                .mul(clickQuaternion);
        }

        return this.getPlayerShip().position;
    }

    public performSpell(spellItem: ISpellData) {
        this.setState({
            spellItems: []
        });

        const playerShip = this.findPlayerShip();
        if (!playerShip) {
            return;
        }

        if (spellItem.hasDirection) {
            // launch a fireball at something
            this.isDrawMouseText = true;
            setTimeout(() => {
                if (this.mouseQ) {
                    const item = new ShipActionItem(spellItem.actionType, this.mouseQ.clone().inverse());
                    playerShip.actionItems.push(item);
                }
                this.isDrawMouseText = false;
            }, 2000);
        } else {
            // apply self spell immediately
            const item = new ShipActionItem(spellItem.actionType, playerShip.position.clone());
            playerShip.actionItems.push(item);
        }
    }

    isDrawMouseText: boolean = false;
    mouseQ: Quaternion = this.getPlayerShip().position;
    mouseText: PIXI.Text | null = null;
    mouseMoveEvent: React.MouseEvent | null = null;
    public downDrawTextAtMouse(e: React.MouseEvent) {
        this.isDrawMouseText = true;
    }
    public moveDrawTextAtMouse(e: React.MouseEvent) {
        this.mouseMoveEvent = e;
    }
    public upDrawTextAtMouse(e: React.MouseEvent) {
        this.isDrawMouseText = false;
    }

    render() {
        if (this.showAppBodyRef.current) {
            this.application.resizeTo = this.showAppBodyRef.current as HTMLElement;
        }

        return (
            <Paper style={{width: "100vw", minHeight: "100vh", height: "fit-content", display: "flex", flexDirection: "column"}}>
                <WebsiteDrawer rightSide={
                    <React.Fragment>
                        <Tooltip title="Settings">
                            <IconButton
                                onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={this.handleShowSettings.bind(this)}>
                                <Settings/>
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Scoreboard">
                            <IconButton
                                onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={this.handleShowScoreboard.bind(this)}>
                                <ScoreboardIcon/>
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Audio">
                            <Checkbox tabIndex={-1}
                                      checked={this.state.audioEnabled}
                                      onKeyDown={PixiGame.cancelSpacebar.bind(this)}
                                      onChange={this.handleAudioEnabled.bind(this)}
                                      icon={<MusicOff/>}
                                      checkedIcon={<MusicNote/>}
                                      color="default" />
                        </Tooltip>
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
                        <Tooltip title="Character Selection">
                            <IconButton
                                disabled={!this.state.faction}
                                onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={this.handleShowCharacterSelection.bind(this)}>
                                <People/>
                            </IconButton>
                        </Tooltip>
                    </React.Fragment>
                }/>
                <div className="AppMain" ref={this.measureAppBodyRef}>
                    <div style={{position: "absolute", top: this.state.marginTop, left: this.state.marginLeft, bottom: this.state.marginBottom, right: this.state.marginRight}}>
                        <div style={{width: this.state.width, height: this.state.height}} ref={this.showAppBodyRef}/>
                    </div>
                    <div className="AppMainContent">
                        {
                            !this.state.showLoginMenu && !this.state.showMainMenu && !this.state.showPlanetMenu && !this.state.showSpawnMenu && this.state.width < 768 ? (
                                <div className="MobileGameUi">
                                    <div style={{position: "absolute", top: 0, left: this.state.marginLeft, bottom: this.state.marginBottom + this.state.height, right: this.state.marginRight}}>
                                        <RenderMobileGameUiTop width={this.state.width} bannerTopHeight={this.state.bannerTopHeight}/>
                                        {this.renderGameUiTop()}
                                    </div>
                                    <div style={{position: "absolute", top: this.state.marginTop + this.state.height, left: this.state.marginLeft, bottom: 0, right: this.state.marginRight}}>
                                        <RenderMobileGameUiBottom width={this.state.width} bannerBottomHeight={this.state.bannerBottomHeight}/>
                                        {this.renderGameUiBottom()}
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
                                {
                                    this.state.width >= 768 ? (
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
                                    ) : null
                                }
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
                                                            <ListItemText>Play Game</ListItemText>
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
                                                            <Typography>{this.state.matchMakerFailMessage || "Connecting to server..."}</Typography>
                                                        )
                                                    }
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    ) : null
                                }
                                {
                                    this.state.showMainMenu ? (
                                        <Grid item xs={12} justifyContent="center" alignItems="center">
                                            <Grid container>
                                                <Grid item xs={12}>
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Button fullWidth variant="contained" disabled={!this.spawnFactions.length}
                                                            onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={this.goToPlanetMenu.bind(this)}>Next</Button>
                                                </Grid>
                                            </Grid>
                                            <Box style={{display: "flex", flexWrap: "wrap", maxHeight: "40vh", maxWidth: "80vw", overflow: "auto", backgroundColor: "none"}}>
                                                {
                                                    this.spawnFactions.map((f, _, arr) => {
                                                        const faction = this.game.factions.get(f.factionId);
                                                        if (!faction) {
                                                            return null;
                                                        }
                                                        return (
                                                            <Card style={{minWidth: 192, maxWidth: 256}}>
                                                                <CardActionArea onClick={this.selectFaction.bind(this, faction.id)}>
                                                                    <CardContent>
                                                                        <Avatar variant="rounded" style={{width: 128, height: 128}} alt={GameFactionData.find(x => x.id === faction.id)?.name ?? faction.id} srcSet={this.renderCharacterUrl(GameFactionData.find(x => x.id === faction.id)?.races[0].id ?? ERaceData.HUMAN).url}>
                                                                            {null}
                                                                        </Avatar>
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
                                                                            <Sailing/>
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
                                                        );
                                                    })
                                                }
                                            </Box>
                                        </Grid>
                                    ) : null
                                }
                                {
                                    this.state.showPlanetMenu ? (
                                        <Grid item xs={12} justifyContent="center" alignItems="center">
                                            <Grid container>
                                                <Grid item xs={12}>
                                                    <Button fullWidth variant="contained"
                                                            onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={this.returnToFactionMenu.bind(this)}>Back</Button>
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Button fullWidth variant="contained" disabled={!this.spawnPlanets.length}
                                                            onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={this.goToSpawnMenu.bind(this)}>Next</Button>
                                                </Grid>
                                            </Grid>
                                            <Box style={{display: "flex", flexWrap: "wrap", maxHeight: "40vh", maxWidth: "80vw", overflow: "auto", backgroundColor: "none"}}>
                                                {
                                                    this.spawnPlanets.map((f, i, arr) => {
                                                        const planet = this.game.planets.get(f.planetId);
                                                        const planetName = planet?.name ?? f.planetId;
                                                        return (
                                                            <Card style={{minWidth: 192, maxWidth: 256}}>
                                                                <CardActionArea onClick={this.selectPlanet.bind(this, f.planetId)}>
                                                                    <CardContent>
                                                                        <Avatar variant="rounded" style={{width: 128, height: 128}} alt={planetName} srcSet={this.planetThumbnails.get(f.planetId) ?? undefined}>
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
                                                                            <Sailing/>
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
                                                        );
                                                    })
                                                }
                                            </Box>
                                        </Grid>
                                    ) : null
                                }
                                {
                                    this.state.showSpawnMenu ? (
                                        <Grid item xs={12} justifyContent="center" alignItems="center">
                                            <Grid container>
                                                <Grid item xs={12}>
                                                    <Button fullWidth variant="contained"
                                                            onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={this.returnToPlanetMenu.bind(this)}>Back</Button>
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Button fullWidth variant="contained" disabled={!this.spawnLocations.results.length}
                                                            onKeyDown={PixiGame.cancelSpacebar.bind(this)} onClick={this.spawnShip.bind(this)}>Next</Button>
                                                </Grid>
                                            </Grid>
                                            <Box style={{display: "flex", flexWrap: "wrap", maxHeight: "40vh", maxWidth: "80vw", overflow: "auto", backgroundColor: "none"}}>
                                                {
                                                    this.spawnLocations.message ? (
                                                        <Card style={{minWidth: 192, maxWidth: 256}}>
                                                            <CardContent>
                                                                <Typography>{this.spawnLocations.message}</Typography>
                                                            </CardContent>
                                                        </Card>
                                                    ) : null
                                                }
                                                {
                                                    this.spawnLocations.results.map((f, i, arr) => {
                                                        return (
                                                            <Card style={{minWidth: 192, maxWidth: 256}}>
                                                                <CardActionArea onClick={this.selectShip.bind(this, f.id, f.shipType)}>
                                                                    <CardContent>
                                                                        <Avatar variant="rounded" style={{width: 128, height: 128}} alt={f.shipType} srcSet={this.shipThumbnails.get(f.shipType) ?? undefined}>
                                                                        </Avatar>
                                                                    </CardContent>
                                                                    <CardHeader title={<span>{this.state.planetId === f.id && this.state.spawnShipType === f.shipType ? <CheckBoxIcon/> : <CheckBoxOutlineBlankIcon/>} {f.shipType}</span>} subheader={`(${f.price}) (${f.numShipsAvailable} ships)`}>
                                                                    </CardHeader>
                                                                </CardActionArea>
                                                            </Card>
                                                        );
                                                    })
                                                }
                                            </Box>
                                        </Grid>
                                    ) : null
                                }
                            </Grid>
                            <div className="DesktopGameUi">
                                {
                                    !this.state.showLoginMenu && !this.state.showMainMenu && !this.state.showPlanetMenu && !this.state.showSpawnMenu && this.state.width >= 768 ? (
                                        <React.Fragment>
                                            {this.renderGameUiTop()}
                                            {this.renderGameUiBottom()}
                                        </React.Fragment>
                                    ) : null
                                }
                                {
                                    this.state.gameMode !== EGameMode.MAIN_MENU && !this.state.showLoginMenu && !this.state.showMainMenu && !this.state.showPlanetMenu && !this.state.showSpawnMenu && this.state.width < 768 ? (
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
                            <Dialog open={!!(this.state.showCharacterSelection && this.state.faction)} onClose={() => this.setState({showCharacterSelection: false})}>
                                <DialogTitle title="Character Selection"/>
                                <DialogContent>
                                    {this.renderCharacterSelection()}
                                </DialogContent>
                            </Dialog>
                            <Dialog open={this.state.spellItems.length > 0} onClose={() => this.setState({spellItems: []})}>
                                <DialogTitle title="Character Selection"/>
                                <DialogContent>
                                    {
                                        this.state.spellItems.map(spellItem => {
                                            return (
                                                <Card key={spellItem.id} onClick={this.performSpell.bind(this, spellItem)} style={{width: 196}}>
                                                    <CardHeader title={spellItem.name}/>
                                                    <CardContent>
                                                        <Typography>{spellItem.description}</Typography>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })
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
            </Paper>
        );
    }
}

export default PixiGame;
