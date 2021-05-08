import {IAutomatedShip} from "./Interface";
import Quaternion from "quaternion";
import {EResourceType, ICargoItem} from "./Resource";
import App from "./App";
import {EOrderResult, EOrderType, Order} from "./Order";
import {DelaunayGraph, PathFinder, VoronoiGraph} from "./Graph";
import {computeConeLineIntersection, IConeHitTest} from "./Intersection";
import {Faction} from "./Faction";
import {CannonBall, Crate} from "./Item";

/**
 * The scale of the graphics engine to physics. All graphics is a plane scaled down by this factor, then projected
 * onto the sphere.
 */
export const PHYSICS_SCALE = 1 / 1000;
/**
 * The hind class ship hull. This format allows rendering in graphics and computing the physics hull.
 */
export const HindHull: Array<[number, number]> = [
    [0, -30],
    [10, -20],
    [10, 25],
    [5, 30],
    [0, 25],
    [-5, 30],
    [-10, 25],
    [-10, -20]
];
/**
 * The hull of the corvette class ship. This format allows rendering and physics hull computations.
 */
export const CorvetteHull: Array<[number, number]> = [
    [0, -20],
    [8, -15],
    [8, 15],
    [4, 20],
    [0, 18],
    [-4, 20],
    [-8, 15],
    [-8, -15]
];
/**
 * The hull of the sloop class ships. This format allows for rendering and physics hull computations.
 */
export const SloopHull: Array<[number, number]> = [
    [0, -15],
    [5, -10],
    [5, 15],
    [3, 10],
    [0, 12],
    [-3, 10],
    [-5, 15],
    [-5, -10]
];

/**
 * Types of ships.
 */
export enum EShipType {
    /**
     * A small ship with two cannons, one on each side. Meant for trading and speed. It is cheap to build.
     * It has 4 cannonades.
     */
    SLOOP = "SLOOP",
    /**
     * A ship with four cannons, two on each side, it has 10 cannonades which automatically fire at near by ship.
     * Great for speed and harassing enemies from strange angles. Also cheap to build.
     */
    CORVETTE = "CORVETTE",
    /**
     * The cheap main battle ship which has 8 cannons, 4 on each side and no cannonades. Made to attack ships directly.
     */
    HIND = "HIND",
}

/**
 * The data format for new ships.
 */
export interface IShipData {
    shipType: EShipType;
    cost: number;
    settlementProgressFactor: number;
    cargoSize: number;
    hull: Array<[number, number]>;
    hullStrength: number;
    cannons: {
        numCannons: number;
        numCannonades: number;
        startY: number;
        endY: number;
        leftWall: number;
        rightWall: number;
    }
}

/**
 * The list of ship data.
 */
export const SHIP_DATA: IShipData[] = [{
    shipType: EShipType.HIND,
    cost: 600,
    settlementProgressFactor: 4,
    cargoSize: 3,
    hull: HindHull,
    hullStrength: 400,
    cannons: {
        numCannons: 8,
        numCannonades: 4,
        startY: 20,
        endY: -20,
        leftWall: 10,
        rightWall: -10
    }
}, {
    shipType: EShipType.CORVETTE,
    cost: 300,
    settlementProgressFactor: 2,
    cargoSize: 2,
    hull: CorvetteHull,
    hullStrength: 200,
    cannons: {
        numCannons: 4,
        numCannonades: 4,
        startY: 15,
        endY: -15,
        leftWall: 6,
        rightWall: -6
    }
}, {
    shipType: EShipType.SLOOP,
    cost: 150,
    settlementProgressFactor: 1,
    cargoSize: 1,
    hull: SloopHull,
    hullStrength: 100,
    cannons: {
        numCannons: 2,
        numCannonades: 2,
        startY: 10,
        endY: -10,
        leftWall: 4,
        rightWall: -4
    }
}];

export class Ship implements IAutomatedShip {
    public app: App;
    public id: string = "";
    public shipType: EShipType;
    public faction: Faction | null = null;
    public color: string = "purple";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public cannonLoading?: Date = undefined;
    public cannonCoolDown: number = 0;
    public cannonadeCoolDown: number[];
    public activeKeys: string[] = [];
    public pathFinding: PathFinder<Ship> = new PathFinder<Ship>(this);
    public fireControl: FireControl<Ship>;
    public orders: Order[] = [];
    public health: number = 1;
    public maxHealth: number = 1;
    public cargo: ICargoItem[] = [];

    constructor(app: App, shipType: EShipType) {
        this.app = app;
        this.fireControl = new FireControl<Ship>(this.app, this);
        this.shipType = shipType;

        const shipData = SHIP_DATA.find(s => s.shipType === this.shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }
        this.health = shipData.hullStrength;
        this.maxHealth = shipData.hullStrength;
        this.cannonadeCoolDown = new Array(shipData.cannons.numCannonades).fill(0);
    }

    /**
     * Determine if the ship is in the mission area.
     */
    isInMissionArea(): boolean {
        const order = this.orders[0];
        if (order) {
            // has an order, check first order mission area
            return order.isInMissionArea();
        } else {
            // no orders, is in mission area
            return true;
        }
    }

    /**
     * Determine if the ship has piracy orders.
     */
    hasPirateOrder(): boolean {
        return this.orders.some(o => o.orderType === EOrderType.PIRATE);
    }

    nearPirateCrate(): Crate | null {
        const crate = this.app.crates.find(c => {
            const cratePosition = c.position.clone().rotateVector([0, 0, 1]);
            const shipPosition = this.position.clone().rotateVector([0, 0, 1]);
            const distance = VoronoiGraph.angularDistance(cratePosition, shipPosition, this.app.worldScale);
            return distance < App.PROJECTILE_SPEED / this.app.worldScale * 60;
        });
        if (crate) {
            return crate;
        } else {
            return null;
        }
    }

    /**
     * Determine if the ship has pirate cargo.
     */
    hasPirateCargo(): boolean {
        return this.cargo.some(c => c.pirated);
    }

    /**
     * Apply damage to the ship. Damage will slow down the ship and enough damage will destroy it.
     * @param cannonBall
     */
    public applyDamage(cannonBall: CannonBall) {
        this.health = Math.max(0, this.health - cannonBall.damage);
    }

    /**
     * Remove an order from the ship.
     * @param order The order to remove.
     */
    public removeOrder(order: Order) {
        // clean faction data
        if (this.faction && order.planetId) {
            // clean up settle order
            if (order.orderType === EOrderType.SETTLE) {
                const index = this.faction.explorationGraph[order.planetId].settlerShipIds.findIndex(s => s === this.id);
                if (index >= 0) {
                    this.faction.explorationGraph[order.planetId].settlerShipIds.splice(index, 1);
                }
            }

            // clean up trade order
            if (order.orderType === EOrderType.TRADE) {
                const index = this.faction.explorationGraph[order.planetId].traderShipIds.findIndex(s => s === this.id);
                if (index >= 0) {
                    this.faction.explorationGraph[order.planetId].traderShipIds.splice(index, 1);
                }
            }

            // clean up pirate order
            if (order.orderType === EOrderType.PIRATE) {
                const index = this.faction.explorationGraph[order.planetId].pirateShipIds.findIndex(s => s === this.id);
                if (index >= 0) {
                    this.faction.explorationGraph[order.planetId].pirateShipIds.splice(index, 1);
                }
            }

            // handle retreated orders by not sending another ship towards that area for a while
            if (order.orderResult === EOrderResult.RETREAT) {
                this.faction.explorationGraph[order.planetId].enemyStrength = order.enemyStrength;
            }
        }

        // clean ship data
        const index2 = this.orders.findIndex(o => o === order);
        if (index2 >= 0) {
            this.orders.splice(index2, 1);
        }
    }

    /**
     * Add cargo to a ship.
     * @param crate
     */
    public pickUpCargo(crate: ICargoItem) {
        const shipData = SHIP_DATA.find(s => s.shipType === this.shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }
        if (this.cargo.length < shipData.cargoSize) {
            const cargoItem: ICargoItem = {
                resourceType: crate.resourceType,
                sourcePlanetId: crate.sourcePlanetId,
                pirated: true
            };
            this.cargo.push(cargoItem);
        }
    }

    /**
     * Destroy the ship and create crates.
     */
    public destroy(): Crate[] {
        const crates: Crate[] = [];
        for (const cargo of this.cargo) {
            const randomDirection = Quaternion.fromAxisAngle([0, 0, 1], Math.random() * 2 * Math.PI - Math.PI)
                .rotateVector([1, 0, 0]);
            const randomVelocity = Quaternion.fromBetweenVectors([0, 0, 1], randomDirection).pow(App.VELOCITY_STEP / this.app.worldScale * 0.1);

            const crate = new Crate(cargo.resourceType, cargo.sourcePlanetId);
            crate.id = `${this.id}-crate-${Math.floor(Math.random() * 100000)}`;
            crate.position = this.position;
            crate.positionVelocity = this.positionVelocity.clone().pow(1 / 50).mul(randomVelocity);
            crate.orientation = Quaternion.fromAxisAngle([0, 0, 1], Math.random() * 2 * Math.PI - Math.PI);
            crate.orientationVelocity = Quaternion.fromAxisAngle([0, 0, 1], Math.random() > 0 ? App.ROTATION_STEP : -App.ROTATION_STEP);
            crates.push(crate);
        }

        // register a destroyed ship with the faction
        // incorrect behavior, the faction should think the ship is destroyed after a timeout
        if (this.faction) {
            this.faction.handleShipDestroyed(this);
        }
        return crates;
    }

    /**
     * Buy a good from the ship.
     * @param resourceType The resource to buy
     */
    public buyGoodFromShip(resourceType: EResourceType): ICargoItem | null {
        const index = this.cargo.findIndex(c => c.resourceType === resourceType);
        if (index >= 0) {
            return this.cargo.splice(index, 1)[0];
        } else {
            return null;
        }
    }

    /**
     * Sell a good to the ship.
     * @param resourceType The type of resource.
     * @param sourcePlanetId The source of the resource.
     */
    public sellGoodToShip(resourceType: EResourceType, sourcePlanetId: string): boolean {
        const shipData = SHIP_DATA.find(s => s.shipType === this.shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }
        if (this.cargo.length < shipData.cargoSize) {
            this.cargo.push({
                resourceType,
                sourcePlanetId,
                pirated: false,
            });
            return true;
        } else {
            return false;
        }
    }
}

export enum EFaction {
    DUTCH = "DUTCH",
    ENGLISH = "ENGLISH",
    FRENCH = "FRENCH",
    PORTUGUESE = "PORTUGUESE",
    SPANISH = "SPANISH",
}

/**
 * Allows the AI ship to fire at other ships in the world.
 */
export class FireControl<T extends IAutomatedShip> {
    public app: App;
    public owner: T;
    public targetShipId: string | null = null;
    public coolDown: number = 0;
    public retargetCoolDown: number = 0;
    public isAttacking: boolean = false;
    public lastStepShouldRotate: boolean = false;

    constructor(app: App, owner: T) {
        this.app = app;
        this.owner = owner;
    }

    /**
     * Get a cone hit solution towards target ship.
     * @param target
     */
    public getConeHit(target: Ship): IConeHitTest {
        const shipPositionPoint = this.owner.orientation.clone().inverse()
            .mul(this.owner.position.clone().inverse())
            .mul(target.position.clone())
            .rotateVector([0, 0, 1]);
        const shipPosition: [number, number] = [
            shipPositionPoint[0],
            shipPositionPoint[1]
        ];
        const shipDirectionPoint = this.owner.orientation.clone().inverse()
            .mul(this.owner.position.clone().inverse())
            .mul(target.position.clone())
            .mul(target.positionVelocity.clone().pow(target.health / target.maxHealth))
            .rotateVector([0, 0, 1]);
        const shipDirection: [number, number] = [
            shipDirectionPoint[0] - shipPosition[0],
            shipDirectionPoint[1] - shipPosition[1]
        ];
        const projectileSpeed = App.PROJECTILE_SPEED / this.app.worldScale;
        return computeConeLineIntersection(shipPosition, shipDirection, projectileSpeed);
    }

    /**
     * Compute unit vector towards target ship.
     */
    public getTargetVector(): [number, number, number] | null {
        const target = this.app.ships.find(s => s.id === this.targetShipId);
        if (!target) {
            return null;
        }
        const coneHit = this.getConeHit(target);
        if (!(coneHit.success && coneHit.point && coneHit.time && coneHit.time < App.PROJECTILE_LIFE)) {
            // target is moving too fast, cannot hit it
            return null;
        }
        return DelaunayGraph.normalize([
            coneHit.point[0],
            coneHit.point[1],
            0
        ]);
    }

    public integrateOrientationSpeedFrames(orientationSpeed: number): number {
        const n = Math.floor(orientationSpeed / App.ROTATION_STEP / 2);
        return Math.max(5, (n * (n - 1)) / 2 * 0.8);
    }

    /**
     * Handle the fire control of the ship. Will aim at ships, ect...
     */
    public fireControlLoop() {
        // retarget another ship occasionally
        if (!this.targetShipId) {
            this.retargetCoolDown = 10;
        } else {
            if (this.retargetCoolDown > 0) {
                this.retargetCoolDown -= 1;
            } else {
                this.retargetCoolDown = 10;
            }
        }

        const target = this.app.ships.find(s => s.id === this.targetShipId);
        if (!target) {
            // no targets, cancel attack
            this.targetShipId = null;
            this.owner.activeKeys.splice(0, this.owner.activeKeys.length);
            this.isAttacking = false;
            return;
        }

        const isInMissionArea = this.owner.isInMissionArea();
        if (!isInMissionArea) {
            // outside of mission area, cancel attack to return to mission area
            this.owner.activeKeys.splice(0, this.owner.activeKeys.length);
            this.isAttacking = false;
            return;
        }

        const hasPirateOrder = this.owner.hasPirateOrder();
        const nearByPirateCrate = this.owner.nearPirateCrate();
        const hasPirateCargo = this.owner.hasPirateCargo();
        if (hasPirateOrder && hasPirateCargo) {
            // has pirate cargo, return to home base, cancel attack
            this.owner.activeKeys.splice(0, this.owner.activeKeys.length);
            this.isAttacking = false;
            return;
        }
        if (nearByPirateCrate && hasPirateOrder && this.owner.pathFinding) {
            // nearby pirate cargo, get the cargo.
            this.owner.pathFinding.points = [
                nearByPirateCrate.position.clone().rotateVector([0, 0, 1])
            ];
            this.isAttacking = false;
            return;
        }

        // there are targets, begin attack
        //
        // compute moving projectile path to hit target
        const coneHit = this.getConeHit(target);
        let detectionConeSizeInTicks = App.PROJECTILE_DETECTION_RANGE / App.PROJECTILE_SPEED / this.app.worldScale;
        if (this.owner.hasPirateOrder()) {
            // pirates get close to attack
            detectionConeSizeInTicks *= 0.1;
        }
        if (!(coneHit.success && coneHit.point && coneHit.time && coneHit.time < detectionConeSizeInTicks)) {
            // target is moving too fast, cannot hit it
            this.isAttacking = false;

            // move closer to target to attack it
            if (this.owner.pathFinding) {
                if (this.owner.pathFinding.points.length > 1) {
                    this.owner.pathFinding.points.shift();
                    this.owner.pathFinding.points.unshift(target.position.rotateVector([0, 0, 1]));
                } else if (this.owner.pathFinding.points.length === 1) {
                    this.owner.pathFinding.points.unshift(target.position.rotateVector([0, 0, 1]));
                } else {
                    this.owner.pathFinding.points.push(target.position.rotateVector([0, 0, 1]));
                }
            }
            return;
        }

        // all cancel attack parameters are false, begin attack
        this.isAttacking = true;

        // compute rotation towards target
        let targetOrientationPoint: [number, number, number] = [
            coneHit.point[0],
            coneHit.point[1],
            0
        ];
        targetOrientationPoint = DelaunayGraph.normalize(targetOrientationPoint);
        let orientationDiffAngle = targetOrientationPoint[0] >= 0 ?
            Math.atan2(-targetOrientationPoint[1], -targetOrientationPoint[0]) :
            Math.atan2(targetOrientationPoint[1], targetOrientationPoint[0]);
        orientationDiffAngle = (orientationDiffAngle - Math.PI / 2) % (Math.PI * 2);
        const orientationSpeed = VoronoiGraph.angularDistanceQuaternion(this.owner.orientationVelocity, 1) * (orientationDiffAngle > 0 ? 1 : -1);
        const desiredOrientationSpeed = Math.max(-App.ROTATION_STEP * 10, Math.min(Math.round(
            -(360 / 4) / Math.PI * orientationDiffAngle
        ), App.ROTATION_STEP * 10));

        // perform rotation and speed up
        // use a class variable to force more tight angle correction, and a more relaxed angle check while moving
        // should result in stop and go less often.
        const shouldRotate = this.lastStepShouldRotate ?
            Math.abs(orientationDiffAngle) > 2 / 180 * Math.PI || Math.abs(desiredOrientationSpeed) >= App.ROTATION_STEP :
            Math.abs(orientationDiffAngle) > 5 / 180 * Math.PI || Math.abs(desiredOrientationSpeed) >= App.ROTATION_STEP;
        this.lastStepShouldRotate = shouldRotate;
        const willReachTargetRotation = Math.abs(orientationDiffAngle) / Math.abs(orientationSpeed) < this.integrateOrientationSpeedFrames(orientationSpeed);
        if (shouldRotate && desiredOrientationSpeed > orientationSpeed && !willReachTargetRotation && !this.owner.activeKeys.includes("a")) {
            // press a to rotate left
            this.owner.activeKeys.push("a");
        } else if (shouldRotate && desiredOrientationSpeed < orientationSpeed && !willReachTargetRotation && !this.owner.activeKeys.includes("d")) {
            // press d to rotate right
            this.owner.activeKeys.push("d");
        } else if (shouldRotate && desiredOrientationSpeed > orientationSpeed && willReachTargetRotation && !this.owner.activeKeys.includes("d")) {
            const aIndex = this.owner.activeKeys.findIndex((key) => key === "a");
            if (aIndex >= 0) {
                this.owner.activeKeys.splice(aIndex, 1);
            }

            // press d to rotate right to slow down
            this.owner.activeKeys.push("d");
        } else if (shouldRotate && desiredOrientationSpeed < orientationSpeed && willReachTargetRotation && !this.owner.activeKeys.includes("a")) {
            const dIndex = this.owner.activeKeys.findIndex((key) => key === "d");
            if (dIndex >= 0) {
                this.owner.activeKeys.splice(dIndex, 1);
            }

            // press a to rotate left to slow down
            this.owner.activeKeys.push("a");
        } else if (!shouldRotate && orientationSpeed > 0 && willReachTargetRotation && !this.owner.activeKeys.includes("a")) {
            const dIndex = this.owner.activeKeys.findIndex((key) => key === "d");
            if (dIndex >= 0) {
                this.owner.activeKeys.splice(dIndex, 1);
            }

            // press a to rotate left to slow down
            this.owner.activeKeys.push("a");
        } else if (!shouldRotate && orientationSpeed < 0 && willReachTargetRotation && !this.owner.activeKeys.includes("d")) {
            const aIndex = this.owner.activeKeys.findIndex((key) => key === "a");
            if (aIndex >= 0) {
                this.owner.activeKeys.splice(aIndex, 1);
            }

            // press d to rotate right to slow down
            this.owner.activeKeys.push("d");
        } else {
            // remove a d keys
            const aIndex = this.owner.activeKeys.findIndex((key) => key === "a");
            if (aIndex >= 0) {
                this.owner.activeKeys.splice(aIndex, 1);
            }
            const dIndex = this.owner.activeKeys.findIndex((key) => key === "d");
            if (dIndex >= 0) {
                this.owner.activeKeys.splice(dIndex, 1);
            }

            if (!this.owner.activeKeys.includes(" ") && this.coolDown <= 0) {
                // press space bar to begin firing
                this.owner.activeKeys.push(" ");
            } else if (this.owner.activeKeys.includes(" ") && this.coolDown <= 0) {
                // release space bar to fire cannons
                const spaceIndex = this.owner.activeKeys.findIndex((key) => key === " ");
                if (spaceIndex >= 0) {
                    this.owner.activeKeys.splice(spaceIndex, 1);
                }

                this.coolDown = 20;
            } else if (this.coolDown > 0) {
                // wait to cool down cannons
                this.coolDown -= 1;
            }
        }
    }
}