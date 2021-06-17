/**
 * The direction of the market trade node/edge.
 */
import {Market, Planet, Star} from "./Planet";
import {ICameraState, ICollidable, IDirectedMarketTrade, IExpirableTicks, MoneyAccount} from "./Interface";
import {EFaction, EShipType, PHYSICS_SCALE, Ship, SHIP_DATA} from "./Ship";
import {VoronoiCounty, VoronoiKingdom, VoronoiTerrain, VoronoiTree} from "./VoronoiTree";
import {Faction, LuxuryBuff} from "./Faction";
import {CannonBall, Crate, SmokeCloud} from "./Item";
import Quaternion from "quaternion";
import {
    DelaunayGraph,
    DelaunayTile,
    ICellData,
    IDrawableTile,
    ITessellatedTriangle,
    PathingNode,
    VoronoiCell,
    VoronoiGraph
} from "./Graph";
import {IHitTest} from "./Intersection";
import {EOrderType, Order} from "./Order";

/**
 * A list of player specific data for the server to store.
 */
export interface IPlayerData {
    activeKeys: string[];
    moneyAccount: MoneyAccount;
    shipId: string;
    autoPilotEnabled: boolean;
}

/**
 * The type of message sent to and from the server.
 */
export enum EMessageType {
    SPAWN = "SPAWN",
    DEATH = "DEATH",
    AUTOPILOT = "AUTOPILOT",
    KEYBOARD = "KEYBOARD",
}

export interface IMessage {
    messageType: EMessageType;
}

export interface ISpawnMessage extends IMessage {
    messageType: EMessageType.SPAWN;
    shipType: EShipType;
    planetId: string;
}

export interface IDeathMessage extends IMessage {
    messageType: EMessageType.DEATH;
}

export interface IAutoPilotMessage extends IMessage {
    messageType: EMessageType.AUTOPILOT;
    enabled: boolean;
}

export interface IKeyboardMessage extends IMessage {
    messageType: EMessageType.KEYBOARD;
    key: string;
    enabled: boolean;
}

export class Game {
    public voronoiShips: VoronoiTree<Ship> = new VoronoiTree(this);
    public voronoiTerrain: VoronoiTerrain = new VoronoiTerrain(this);
    public factions: { [key: string]: Faction } = {};
    public ships: Ship[] = [];
    public playerShip: Ship | null = null;
    public crates: Crate[] = [];
    public planets: Planet[] = [];
    public directedMarketTrade: Record<string, Array<IDirectedMarketTrade>> = {};
    public smokeClouds: SmokeCloud[] = [];
    public cannonBalls: CannonBall[] = [];
    public luxuryBuffs: LuxuryBuff[] = [];
    public worldScale: number = 3;
    public demoAttackingShipId: string | null = null;
    public lastDemoAttackingShipTime: Date = new Date();
    public tradeTick: number = 10 * 5;
    public playerData: IPlayerData[] = [];
    public incomingMessages: IMessage[] = [];
    public outgoingMessages: IMessage[] = [];
    public isTestMode: boolean = false;

    /**
     * Velocity step size of ships.
     */
    public static VELOCITY_STEP: number = 1 / 6000;
    /**
     * The speed of the cannon ball projectiles.
     */
    public static PROJECTILE_SPEED: number = Game.VELOCITY_STEP * 100;
    /**
     * How long a cannon ball will live for in ticks.
     */
    public static PROJECTILE_LIFE: number = 40;
    /**
     * The enemy detection range.
     */
    public static PROJECTILE_DETECTION_RANGE: number = Game.PROJECTILE_SPEED * Game.PROJECTILE_LIFE * 1.2;
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
    /**
     * THe number of seconds between each trade tick.
     */
    public static TRADE_TICK_COOL_DOWN: number = 10 * 60 * 10;

    static GetCameraState(viewableObject: ICameraState): ICameraState {
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

    public initializeGame() {
        // initialize 3d terrain stuff
        this.voronoiTerrain.generateTerrain();

        // initialize planets
        this.planets = Array.from(this.voronoiTerrain.getPlanets());

        // initialize factions
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
            if (planet && !this.isTestMode) {
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

    /**
     * Get the currently selected player ship. This is a place holder method within the server class. It should return
     * identity. The client will render this result centered on the player's ship while the server will render an
     * identity ship.
     */
    public getPlayerShip(): ICameraState {
        // no faction selected, orbit the world
        const tempShip = new Ship(this, EShipType.CUTTER);
        tempShip.id = "ghost-ship";
        return Game.GetCameraState(tempShip);
    }


    /**
     * Compute a set of physics quaternions for the hull.
     * @param hullPoints A physics hull to convert to quaternions.
     * @param worldScale The size of the world.
     * @private
     */
    public static getPhysicsHull(hullPoints: Array<[number, number]>, worldScale: number): Quaternion[] {
        const hullSpherePoints = hullPoints.map(([xi, yi]): [number, number, number] => {
            const x = xi * PHYSICS_SCALE / worldScale;
            const y = -yi * PHYSICS_SCALE / worldScale;
            const z = Math.sqrt(1 - Math.pow(x, 2) - Math.pow(y, 2));
            return [x, y, z];
        });
        return hullSpherePoints.map((point) => Quaternion.fromBetweenVectors([0, 0, 1], point));
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
            const rotation = Quaternion.fromAxisAngle([0, 0, 1], Math.PI).pow(Game.ROTATION_STEP);
            const rotationDrag = cameraOrientationVelocity.pow(Game.ROTATION_DRAG).inverse();
            cameraOrientationVelocity = cameraOrientationVelocity.clone().mul(rotation).mul(rotationDrag);
            if (VoronoiGraph.angularDistanceQuaternion(cameraOrientationVelocity, 1) < Math.PI * Game.ROTATION_STEP * 0.9) {
                cameraOrientationVelocity = Quaternion.ONE;
            }
        }
        if (activeKeys.includes("d")) {
            const rotation = Quaternion.fromAxisAngle([0, 0, 1], -Math.PI).pow(Game.ROTATION_STEP);
            const rotationDrag = cameraOrientationVelocity.pow(Game.ROTATION_DRAG).inverse();
            cameraOrientationVelocity = cameraOrientationVelocity.clone().mul(rotation).mul(rotationDrag);
            if (VoronoiGraph.angularDistanceQuaternion(cameraOrientationVelocity, 1) < Math.PI * Game.ROTATION_STEP * 0.9) {
                cameraOrientationVelocity = Quaternion.ONE;
            }
        }
        if (activeKeys.includes("w")) {
            const forward = cameraOrientation.clone().rotateVector([0, 1, 0]);
            const rotation = Quaternion.fromBetweenVectors([0, 0, 1], forward).pow(Game.VELOCITY_STEP / this.worldScale);
            const rotationDrag = cameraPositionVelocity.pow(Game.VELOCITY_DRAG / this.worldScale).inverse();
            cameraPositionVelocity = cameraPositionVelocity.clone().mul(rotation).mul(rotationDrag);
            if (VoronoiGraph.angularDistanceQuaternion(cameraPositionVelocity, this.worldScale) < Math.PI / 2 * Game.VELOCITY_STEP / this.worldScale) {
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
            const rotation = cameraPositionVelocity.clone().inverse().pow(Game.BRAKE_POWER / this.worldScale);
            cameraPositionVelocity = cameraPositionVelocity.clone().mul(rotation);
            if (VoronoiGraph.angularDistanceQuaternion(cameraPositionVelocity, this.worldScale) < Math.PI / 2 * Game.VELOCITY_STEP / this.worldScale) {
                cameraPositionVelocity = Quaternion.ONE;
            }

            // get smoke cloud parameters
            const engineBackwardsPointInitial = rotation.rotateVector([0, 0, 1]);
            engineBackwardsPointInitial[2] = 0;
            const engineBackwardsPoint = DelaunayGraph.normalize(engineBackwardsPointInitial);
            const engineBackwards = Quaternion.fromBetweenVectors([0, 0, 1], engineBackwardsPoint).pow(Game.VELOCITY_STEP / this.worldScale);

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
                const fireVelocity = Quaternion.fromBetweenVectors([0, 0, 1], fireDirection).pow(Game.PROJECTILE_SPEED / this.worldScale);

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
                const fireVelocity = Quaternion.fromBetweenVectors([0, 0, 1], fireDirection).pow(Game.PROJECTILE_SPEED / this.worldScale);

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
        const midPoint = DelaunayGraph.normalize(Game.getAveragePoint([a, b]));
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
        const hull = Game.getPhysicsHull(shipData.hull, worldScale).map((q): Quaternion => {
            return ship.position.clone().mul(ship.orientation.clone()).mul(q);
        });
        for (let i = 0; i < hull.length; i++) {
            const a = hull[i % hull.length].rotateVector([0, 0, 1]);
            const b = hull[(i + 1) % hull.length].rotateVector([0, 0, 1]);
            const intercept = Game.computeIntercept(a, b, c, d);
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

    private isTradeTick(): boolean {
        if (this.tradeTick <= 0) {
            this.tradeTick = Game.TRADE_TICK_COOL_DOWN;
            return true;
        } else {
            this.tradeTick -= 1;
            return false;
        }
    }

    public handleServerLoop() {
        // handle key strokes
        while (true) {
            const message = this.incomingMessages.shift();
            if (message) {
                // has message, process message
                if (message.messageType === EMessageType.SPAWN) {
                    const spawnMessage = message as ISpawnMessage;
                    const {
                        shipType,
                        planetId
                    } = spawnMessage;
                    const planet = this.planets.find(p => p.id === planetId);
                    if (!this.playerData[0]) {
                        this.playerData.push({
                            shipId: "",
                            autoPilotEnabled: true,
                            moneyAccount: new MoneyAccount(2000),
                            activeKeys: []
                        });
                    }
                    if (planet && this.playerData[0] && this.playerData[0].moneyAccount.hasEnough(planet.shipyard.quoteShip(shipType))) {
                        this.playerShip = planet.shipyard.buyShip(this.playerData[0].moneyAccount, shipType);
                        this.playerData[0].shipId = this.playerShip.id;
                    }
                } if (message.messageType === EMessageType.AUTOPILOT) {
                    const autoPilotMessage = message as IAutoPilotMessage;
                    if (this.playerData[0]) {
                        this.playerData[0].autoPilotEnabled = autoPilotMessage.enabled;
                    }
                } else if (message.messageType === EMessageType.KEYBOARD) {
                    const keyboardMessage = message as IKeyboardMessage;
                    if (this.playerData[0]) {
                        if (keyboardMessage.enabled) {
                            if (!this.playerData[0].activeKeys.includes(keyboardMessage.key)) {
                                this.playerData[0].activeKeys.push(keyboardMessage.key);
                            }
                        } else {
                            const index = this.playerData[0].activeKeys.findIndex(k => k === keyboardMessage.key);
                            if (index >= 0) {
                                this.playerData[0].activeKeys.splice(index, 1);
                            }
                        }
                    }
                }
            } else {
                // no more messages, continue
                break;
            }
        }

        if (this.isTradeTick()) {
            Market.ComputeProfitableTradeDirectedGraph(this);
        }

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
            collideFn: (this: Game, ship: Ship, entity: ICollidable, hit: IHitTest) => void,
            useRayCast: boolean
        }> = [{
            arr: this.cannonBalls,
            collideFn(this: Game, ship: Ship, entity: ICollidable, hit: IHitTest) {
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
            collideFn(this: Game, ship: Ship, entity: ICollidable, hit: IHitTest) {
                ship.pickUpCargo(entity as Crate);
            },
            useRayCast: false
        }];
        for (const {arr: collidableArray, collideFn, useRayCast} of collidableArrays) {
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
                        const hit = Game.cannonBallCollision(entity, nearByShip, this.worldScale);
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
                if (ship.planet) {
                    ship.orders.push(ship.planet.getOrder(ship));
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

            const playerData = this.playerData.find(d => d.shipId === ship.id);
            if (playerData && !playerData.autoPilotEnabled) {
                // ship is player ship which has no auto pilot, accept player control
                this.handleShipLoop(i, () => playerData.activeKeys, false);
            } else {
                // ship is npc ship if autoPilot is not enabled
                this.handleShipLoop(i, () => ship.activeKeys, true);
            }
        }

        // remove destroyed ships
        for (const destroyedShip of destroyedShips) {
            if (destroyedShip === this.playerShip) {
                this.playerShip = null;
                this.playerData.splice(0, this.playerData.length);
                const message: IDeathMessage = {
                    messageType: EMessageType.DEATH
                };
                this.outgoingMessages.push(message);
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
                    ) < Game.PROJECTILE_DETECTION_RANGE) {
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

        // handle planet loop
        for (const planet of this.planets) {
            planet.handlePlanetLoop();
        }

        // handle AI factions
        for (const faction of Object.values(this.factions)) {
            faction.handleFactionLoop();
        }
    }

    private static MAX_TESSELLATION: number = 3;

    private static randomRange(start: number = -1, end: number = 1): number {
        const value = Math.random();
        return start + (end - start) * value;
    }

    public rotateDelaunayTriangle(camera: ICameraState, earthLike: boolean, triangle: ICellData, index: number): IDrawableTile {
        const {
            position: cameraPosition,
            orientation: cameraOrientation,
        } = camera;
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

    public* getDelaunayTileTessellation(centroid: Quaternion, vertices: Quaternion[], maxStep: number = Game.MAX_TESSELLATION, step: number = 0): Generator<ITessellatedTriangle> {
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
                let lerpPoint = Game.lerp(
                    a.rotateVector([0, 0, 1]),
                    b.rotateVector([0, 0, 1]),
                    0.5
                )
                if (DelaunayGraph.distanceFormula(lerpPoint, [0, 0, 0]) < 0.01) {
                    lerpPoint = Game.lerp(
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

    public static lerp(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
        const delta = DelaunayGraph.subtract(b, a);
        return [
            a[0] + delta[0] * t,
            a[1] + delta[1] * t,
            a[2] + delta[2] * t
        ];
    }

    /**
     * Initialize random position and orientation for an entity.
     * @param entity The entity to add random position and orientation to.
     * @private
     */
    public static addRandomPositionAndOrientationToEntity(entity: ICameraState) {
        entity.position = new Quaternion(0, Game.randomRange(), Game.randomRange(), Game.randomRange());
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
            .map(this.rotateDelaunayTriangle.bind(this, this.getPlayerShip(), false))
            .reduce((acc, tile) => {
                const tessellatedTriangles = Array.from(this.getDelaunayTileTessellation(tile.centroid, tile.vertices, tessellationLevel, 1));
                return [
                    ...acc,
                    ...tessellatedTriangles.map(t => {
                        return DelaunayGraph.normalize(
                            Game.getAveragePoint(t.vertices.map(v => v.rotateVector([0, 0, 1])))
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

        // create pathing node
        const position = planet.position.rotateVector([0, 0, 1]);
        const pathingNode = new PathingNode<any>(this);
        pathingNode.id = planetI;
        pathingNode.instance = this;
        pathingNode.position = position;

        planet.pathingNode = pathingNode;
        return planet;
    }
}