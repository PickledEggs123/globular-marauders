import {EVoronoiMode} from "../helpers/Data";
import {
    Ship
} from "@pickledeggs123/globular-marauders-game/lib/src/Ship";
import {
    EShipType,
    PHYSICS_SCALE,
} from "@pickledeggs123/globular-marauders-game/lib/src/ShipType";
import {
    EFaction,
} from "@pickledeggs123/globular-marauders-game/lib/src/EFaction";
import {Game, IPlayerData} from "@pickledeggs123/globular-marauders-game/lib/src/Game";
import * as PIXI from "pixi.js";
import * as particles from "@pixi/particle-emitter";
import {ITessellatedTriangle} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";
import Quaternion from "quaternion";
import {EResourceType} from "@pickledeggs123/globular-marauders-game/lib/src/Resource";
import {Faction, Star} from "@pickledeggs123/globular-marauders-game/lib/src";
import {Planet} from "@pickledeggs123/globular-marauders-game/lib/src/Planet";
import {CannonBall, Crate} from "@pickledeggs123/globular-marauders-game/lib/src/Item";
import {ICameraState} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
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
import {PlanetResources} from "../resources/planetResources";
import {StarResources} from "../resources/starResources";
import {convertPositionQuaternionToPositionPolar, hexToRgb} from "../helpers/pixiHelpers";
import {CannonBallResources} from "../resources/cannonBallResources";
import {CrateResources} from "../resources/crateResources";
import {voronoiResources} from "../resources/voronoiResources";
import {backgroundVoronoiResources} from "../resources/backgroundVoronoiResources";
import {ShipResources} from "../resources/shipResources";
import {EMovementQuaternionParticleBehaviorType} from "../resources/particles/MovementQuaternionParticleBehavior";
import {Layer} from "@pixi/layers";

/**
 * The input parameters of the app.
 */
export interface IPixiGameProps {
    /**
     * If the app is in test mode.
     */
    isTestMode?: boolean;
    /**
     * The size of the world, initially
     */
    worldScale?: number;
}

export enum EGameMode {
    MAIN_MENU,
    TUTORIAL,
    SINGLE_PLAYER,
    MULTI_PLAYER
}

export enum EParticleState {
    STOP,
    PLAYING,
    PLAY,
    STOPPING,
}

/**
 * The state of the app.
 */
export interface IPixiGameState {
    showItems: boolean;
    width: number;
    height: number;
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    bannerTopHeight: number;
    bannerBottomHeight: number;
    bannerLeft: number;
    bannerRight: number;
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
    gameMode: EGameMode;
    keyboardImageClass: string | undefined;
    mouseImageClass: string | undefined;
    highlightAutopilotButton: boolean;
    matchMakerFailMessage: string | undefined;
}

export abstract class PixiGameBase extends React.Component<IPixiGameProps, IPixiGameState> {
    state = {
        showItems: false as boolean,
        width: 800 as number,
        height: 800 as number,
        marginTop: 0 as number,
        marginBottom: 0 as number,
        marginLeft: 0 as number,
        marginRight: 0 as number,
        bannerTopHeight: 0 as number,
        bannerBottomHeight: 0 as number,
        bannerLeft: 0 as number,
        bannerRight: 0 as number,
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
        showLoginMenu: false as boolean,
        showMainMenu: false as boolean,
        showPlanetMenu: false as boolean,
        showSpawnMenu: false as boolean,
        userName: "" as string,
        numNetworkFrames: 0 as number,
        gameMode: EGameMode.MAIN_MENU,
        keyboardImageClass: undefined,
        mouseImageClass: undefined,
        highlightAutopilotButton: false as boolean,
        matchMakerFailMessage: undefined as string | undefined,
    };
    public game: Game = new Game();
    public playerId: string | null = null;

    // ui ref
    protected showAppBodyRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    protected measureAppBodyRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();

    // pixi.js renderer
    public abstract application: PIXI.Application;

    public abstract particleContainer: PIXI.Container;

    public abstract colorLayer: Layer;
    public abstract depthLayer: Layer;
    public depthOutlineThreshold: number = 1;
    public abstract projectileColorLayer: Layer;
    public abstract textColorLayer: Layer;

    pixiStarResources = new StarResources(this as any);

    pixiPlanetResources = new PlanetResources(this as any);

    pixiShipResources = new ShipResources(this as any);

    pixiCannonBallResources = new CannonBallResources(this as any);

    pixiCrateResources = new CrateResources(this as any);

    pixiVoronoiResources = voronoiResources();

    pixiBackgroundVoronoiResources = backgroundVoronoiResources();

    clearMeshes: boolean = false;

    planetThumbnails: Map<string, string> = new Map<string, string>();

    shipThumbnails: Map<EShipType, string> = new Map<EShipType, string>();



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
            uColor: hexToRgb(star.color),
            uScale: 2 * star.size * PHYSICS_SCALE,
            uWorldScale: this.game.worldScale,
        };
        const shader = new PIXI.Shader(this.pixiStarResources.getResources().starProgram, uniforms);
        const mesh = new PIXI.Mesh(this.pixiStarResources.getResources().starGeometry, shader);
        mesh.zIndex = -10;

        this.application.stage.addChild(mesh);
        this.pixiStarResources.getResources().starMeshes.push({
            id: star.id,
            mesh,
            position: star.position.clone(),
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
        const rotation: Quaternion = Quaternion.fromAxisAngle([Math.cos(randomRotationAngle), Math.sin(randomRotationAngle), 0], Math.PI * 2 / 1000);
        const settlementLevel = planet.settlementLevel;
        const settlementProgress = planet.settlementProgress;

        // create mesh
        const uniforms = {
            uCameraPosition: cameraPosition.clone().inverse().toMatrix4(),
            uCameraOrientation: cameraOrientation.clone().inverse().toMatrix4(),
            uCameraScale: this.state.zoom,
            uPosition: planet.position.toMatrix4(),
            uOrientation: orientation.toMatrix4(),
            uScale: 10 * planet.size * PHYSICS_SCALE,
            uWorldScale: this.game.worldScale,
        };
        const shader = new PIXI.Shader(this.pixiPlanetResources.getResources().planetProgram, uniforms);
        const state = PIXI.State.for2d();
        state.depthTest = true;
        const [geometry, meshIndex] = this.pixiPlanetResources.getResources().getPlanetGeometry();
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
        mesh.zIndex = -20;

        const faction = new PIXI.Graphics();
        faction.zIndex = -25;
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

        this.colorLayer.addChild(mesh);
        this.application.stage.addChild(faction);
        this.textColorLayer.addChild(textName);
        this.textColorLayer.addChild(textTitle);
        this.textColorLayer.addChild(textResource1);
        this.textColorLayer.addChild(textResource2);
        this.textColorLayer.addChild(textResource3);
        this.pixiPlanetResources.getResources().planetMeshes.push({
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
        const correctionFactorTheta = 0;

        const getUniforms = () => ({
            uCameraPosition: cameraPosition.clone().inverse().toMatrix4(),
            uCameraOrientation: cameraOrientation.clone().inverse().toMatrix4(),
            uCameraPositionInv: cameraPosition.clone().toMatrix4(),
            uCameraOrientationInv: cameraOrientation.clone().toMatrix4(),
            uCorrectionFactorTheta: correctionFactorTheta,
            uRight: Quaternion.fromBetweenVectors([0, 0, 1], [1, 0, 0]).toMatrix4(),
            uCameraScale: this.state.zoom,
            uPosition: position.toMatrix4(),
            uOrientation: orientation.toMatrix4(),
            uScale: PHYSICS_SCALE,
            uWorldScale: this.game.worldScale,
        });

        // create mesh
        const uniforms = getUniforms();
        const shader = new PIXI.Shader(this.pixiShipResources.getResources().shipProgram, uniforms);
        const state = PIXI.State.for2d();
        state.depthTest = true;
        const mesh = new PIXI.Mesh(this.pixiShipResources.getResources().shipGeometryMap.get(ship.faction?.id ?? EFaction.DUTCH)?.get(ship.shipType) as any, shader, state);
        mesh.zIndex = -3;

        // create depth mesh
        const depthUniforms = getUniforms();
        const depthShader = new PIXI.Shader(this.pixiShipResources.getResources().shipDepthProgram, depthUniforms);
        const depthState = PIXI.State.for2d();
        depthState.depthTest = true;
        const depthMesh = new PIXI.Mesh(this.pixiShipResources.getResources().shipGeometryMap.get(ship.faction?.id ?? EFaction.DUTCH)?.get(ship.shipType) as any, depthShader, depthState);
        depthMesh.zIndex = -3;

        const text = new PIXI.Text(ship.shipType);
        text.style.fill = "white";
        text.style.fontSize = 15;

        const trailContainer = new PIXI.Container();
        trailContainer.zIndex = -5;
        const trail = new particles.Emitter(trailContainer, {
            emit: false,
            autoUpdate: true,
            lifetime: {
                min: 3,
                max: 5
            },
            particlesPerWave: 1,
            frequency: 0.1,
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
                                    time: 0.2
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
                                    value: 1,
                                    time: 0
                                },
                                {
                                    value: 0.3,
                                    time: 1
                                }
                            ],
                        },
                    }
                },
                {
                    type: 'movementQuaternion',
                    config: {
                        ship,
                        game: this,
                        movementType: EMovementQuaternionParticleBehaviorType.BACKWARDS,
                        speed: Game.VELOCITY_STEP / Game.VELOCITY_DRAG / 5
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
                        texture: this.sprites.smokeTrail
                    }
                }
            ]
        });

        const line = new PIXI.Graphics();
        line.zIndex = -4;

        const cannonBallLeft = new PIXI.Graphics();
        cannonBallLeft.zIndex = -4;

        const cannonBallRight = new PIXI.Graphics();
        cannonBallRight.zIndex = -4;

        const health = new PIXI.Graphics();
        health.zIndex = -4;
        health.alpha = 0.5;

        const healthColor = this.pixiShipResources.getResources().getColor(ship.faction?.factionColor ?? ship.color).slice(0, 3).reduce((acc: number, v: number, i: number) => acc | (Math.floor(v * 255) << (2 - i) * 8), 0xff000000);

        const isPlayer = this.getPlayerShip().id === ship.id;
        const isEnemy = this.findPlayerShip()?.faction?.id !== ship.faction?.id;

        this.colorLayer.addChild(mesh);
        this.depthLayer.addChild(depthMesh);
        this.textColorLayer.addChild(text);
        this.projectileColorLayer.addChild(trailContainer);
        this.application.stage.addChild(line);
        this.application.stage.addChild(cannonBallLeft);
        this.application.stage.addChild(cannonBallRight);
        this.application.stage.addChild(health);
        this.pixiShipResources.getResources().shipMeshes.push({
            id: ship.id,
            mesh,
            depthMesh,
            text,
            trailContainer,
            trail,
            trailState: EParticleState.STOP,
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
            positionPolarNew: convertPositionQuaternionToPositionPolar(position),
            positionPolarOld: convertPositionQuaternionToPositionPolar(position),
            correctionFactorTheta: 0,
            orientation,
            positionVelocity,
            positionVelocityTheta: Math.PI / 2,
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
        const uColor = factionColor != null ? [((factionColor & 0xff0000) >> 16) / 0xff, ((factionColor & 0x00ff00) >> 8) / 0xff, (factionColor & 0x0000ff) / 0xff, 1] : [0.75, 0.75, 0.75, 1];
        const uniforms = {
            uCameraPosition: cameraPosition.clone().inverse().toMatrix4(),
            uCameraOrientation: cameraOrientation.clone().inverse().toMatrix4(),
            uCameraScale: this.state.zoom,
            uPosition: position.toMatrix4(),
            uColor,
            uScale: 5 * PHYSICS_SCALE,
            uWorldScale: this.game.worldScale,
        };
        const shader = new PIXI.Shader(this.pixiCannonBallResources.getResources().cannonBallProgram, uniforms);
        const mesh = new PIXI.Mesh(this.pixiCannonBallResources.getResources().cannonBallGeometry, shader);
        mesh.zIndex = -1;



        const trailContainer = new PIXI.Container();
        trailContainer.zIndex = -5;
        const trail = new particles.Emitter(trailContainer, {
            emit: true,
            autoUpdate: true,
            lifetime: {
                min: 0.2,
                max: 0.2
            },
            particlesPerWave: 1,
            frequency: 0.0066,
            spawnChance: 0.8,
            maxParticles: 30,
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
                                    value: 0.8,
                                    time: 0
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
                                    value: 0.5,
                                    time: 0
                                },
                                {
                                    value: 0.3,
                                    time: 1
                                }
                            ],
                        },
                    }
                },
                {
                    type: 'staticQuaternion',
                    config: {
                        ship: cannonBall,
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
                        texture: this.sprites.cannonBallTrail
                    }
                },
                {
                    type: 'color',
                    config: {
                        color: {
                            list: [
                                {
                                    time: 0,
                                    value: {
                                        r: uColor[0] * 255,
                                        g: uColor[1] * 255,
                                        b: uColor[2] * 255,
                                        a: uColor[3] * 255,
                                    }
                                },
                                {
                                    time: 1,
                                    value: {
                                        r: uColor[0] * 255,
                                        g: uColor[1] * 255,
                                        b: uColor[2] * 255,
                                        a: 0,
                                    }
                                }
                            ]
                        },
                    }
                },
            ]
        });

        this.projectileColorLayer.addChild(mesh);
        this.projectileColorLayer.addChild(trailContainer);
        this.pixiCannonBallResources.getResources().cannonBallMeshes.push({
            id: cannonBall.id,
            mesh,
            trailContainer,
            trail,
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
        const meshShader = new PIXI.Shader(this.pixiCrateResources.getResources().crateProgram, meshUniforms);
        const mesh = new PIXI.Mesh(this.pixiCrateResources.getResources().crateGeometry, meshShader);
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
        const imageShader = new PIXI.Shader(this.pixiCrateResources.getResources().crateImageProgram, imageUniforms);
        const image = new PIXI.Mesh(this.pixiCrateResources.getResources().crateImageGeometry, imageShader);
        mesh.zIndex = -4;



        const trailContainer = new PIXI.Container();
        trailContainer.zIndex = -5;
        const trail = new particles.Emitter(trailContainer, {
            emit: true,
            autoUpdate: true,
            lifetime: {
                min: 2,
                max: 3
            },
            particlesPerWave: 3,
            frequency: 0.1,
            spawnChance: 0.66,
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
                                    time: 0.2
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
                                    value: 1,
                                    time: 0
                                },
                                {
                                    value: 0.3,
                                    time: 1
                                }
                            ],
                        },
                    }
                },
                {
                    type: 'movementQuaternion',
                    config: {
                        ship: crate,
                        game: this,
                        movementType: EMovementQuaternionParticleBehaviorType.RANDOM,
                        speed: Game.VELOCITY_STEP / Game.VELOCITY_DRAG / 10
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
                        texture: this.sprites.glowTrail
                    }
                },
                {
                    type: 'color',
                    config: {
                        color: {
                            list: [
                                {
                                    time: 0,
                                    value: {
                                        r: 51,
                                        g: 221,
                                        b: 255,
                                        a: 255,
                                    }
                                },
                                {
                                    time: 1,
                                    value: {
                                        r: 51,
                                        g: 221,
                                        b: 255,
                                        a: 0,
                                    }
                                }
                            ]
                        },
                    }
                },
            ]
        });

        const text = new PIXI.Text(resourceType);
        text.style.fill = "white";
        text.style.fontSize = 12;

        this.projectileColorLayer.addChild(mesh);
        this.projectileColorLayer.addChild(image);
        this.projectileColorLayer.addChild(trailContainer);
        this.textColorLayer.addChild(text);
        this.pixiCrateResources.getResources().crateMeshes.push({
            id: crate.id,
            mesh,
            image,
            trailContainer,
            trail,
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
        mesh.zIndex = -28;

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
        const height = this.measureAppBodyRef.current ? this.measureAppBodyRef.current.getBoundingClientRect().height: window.innerHeight;
        const size = Math.min(width, height);
        const verticalSpace = height - size;
        const horizontalSpace = width - size;
        const bannerTopHeight = verticalSpace / 2;
        const bannerBottomHeight = verticalSpace / 2;
        const bannerLeft = horizontalSpace / 2;
        const bannerRight = horizontalSpace / 2;

        this.setState({
            marginTop: verticalSpace / 2,
            marginBottom: verticalSpace / 2,
            marginLeft: horizontalSpace / 2,
            marginRight: horizontalSpace / 2,
            width: size,
            height: size,
            bannerTopHeight,
            bannerBottomHeight,
            bannerLeft,
            bannerRight,
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

    public findPlayerShip(): Ship | null {
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