import React from 'react';
import './App.css';
import Quaternion from 'quaternion';

export interface IHitTest {
    success: boolean;
    point: [number, number, number] | null;
    distance: number | null;
    time: number | null;
}

export interface IConeHitTest {
    success: boolean;
    point: [number, number] | null;
    distance: number | null;
    time: number | null;
}

/**
 * Determine the direction to aim at a moving target.
 * @param shipPosition The position of the ship right now.
 * @param shipDirection The direction of the ship right now, will extrapolate a target angle
 * @param projectileSpeed The projectile speed will affect the target angle
 */
export const computeConeLineIntersection = (shipPosition: [number, number], shipDirection: [number, number], projectileSpeed: number): IConeHitTest => {
    // line cone intersection equations
    // https://www.geometrictools.com/Documentation/IntersectionLineCone.pdf
    // cone - origin V direction D angle Y
    // line - origin P direction U
    const multiply = (a: number[], b: number[], transpose: boolean = false): number[] => {
        if (a.length === 1 && b.length === 1) {
            return [
                a[0] * b[0]
            ];
        } else if (a.length === 3 && b.length === 9) {
            return [
                a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
                a[0] * b[3] + a[1] * b[4] + a[2] * b[5],
                a[0] * b[6] + a[1] * b[7] + a[2] * b[8]
            ];
        } else if (a.length === 9 && b.length === 3) {
            return [
                a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
                a[3] * b[0] + a[4] * b[1] + a[5] * b[2],
                a[6] * b[0] + a[7] * b[1] + a[8] * b[2]
            ];
        } else if (a.length === 3 && b.length === 3 && !transpose) {
            return [
                a[0] * b[0], a[0] * b[1], a[0] * b[2],
                a[1] * b[0], a[1] * b[1], a[1] * b[2],
                a[2] * b[0], a[2] * b[1], a[2] * b[2]
            ];
        } else if (a.length === 3 && b.length === 3 && transpose) {
            return [
                a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
            ];
        } else if (a.length === 9 && b.length === 9) {
            return [
                a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
                a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
                a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
                a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
                a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
                a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
                a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
                a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
                a[6] * b[2] + a[7] * b[5] + a[8] * b[8]
            ];
        }
        else if (a.length === 1 && b.length === 9) {
            return [
                a[0] * b[0], a[0] * b[1], a[0] * b[2],
                a[0] * b[3], a[0] * b[4], a[0] * b[5],
                a[0] * b[6], a[0] * b[7], a[0] * b[8]
            ];
        }
        else if (a.length === 1 && b.length === 3) {
            return [
                a[0] * b[0], a[0] * b[1], a[0] * b[2]
            ];
        } else {
            throw new Error("Unknown multiplication values");
        }
    };
    const add = (a: number[], b: number[]): number[] => {
        if (a.length === 3 && b.length === 3) {
            return [
                a[0] + b[0],
                a[1] + b[1],
                a[2] + b[2]
            ];
        } else if (a.length === 1 && b.length === 1) {
            return [
                a[0] + b[0]
            ];
        } else {
            throw new Error("Unknown addition values");
        }
    };
    const subtract = (a: number[], b: number[]): number[] => {
        if (a.length === 9 && b.length === 9) {
            return [
                a[0] - b[0], a[1] - b[1], a[2] - b[2],
                a[3] - b[3], a[4] - b[4], a[5] - b[5],
                a[6] - b[6], a[7] - b[7], a[8] - b[8]
            ];
        } else if (a.length === 1 && b.length === 9) {
            return [
                a[0] - b[0], a[0] - b[1], a[0] - b[2],
                a[0] - b[3], a[0] - b[4], a[0] - b[5],
                a[0] - b[6], a[0] - b[7], a[0] - b[8]
            ];
        } else if (a.length === 3 && b.length === 3) {
            return [
                a[0] - b[0],
                a[1] - b[1],
                a[2] - b[2]
            ];
        } else if (a.length === 1 && b.length === 3) {
            return [
                a[0] - b[0],
                a[0] - b[1],
                a[0] - b[2]
            ];
        } else if (a.length === 3 && b.length === 1) {
            return [
                a[0] - b[0],
                a[1] - b[0],
                a[2] - b[0]
            ];
        } else if (a.length === 1 && b.length === 1) {
            return [
                a[0] - b[0]
            ];
        } else {
            throw new Error("Unknown subtraction values");
        }
    };

    // ship parameters
    const o = [shipPosition[0], shipPosition[1], 0]; // ship position relative to attacking ship
    const d = [shipDirection[0], shipDirection[1], 1];
    const yVector = [projectileSpeed, 0, 1]; // cone size parameters
    const yLength = Math.sqrt(Math.pow(yVector[0], 2) + Math.pow(yVector[1], 2) + Math.pow(yVector[2], 2));
    const yUnit = [yVector[0] / yLength, yVector[1] / yLength, yVector[2] / yLength];
    const v = [0, 0, 1]; // direction of cone facing upwards, attacking ship is not moving
    const y = multiply(v, yUnit, true)[0]; // angle of cone, speed of projectile

    // quadratic equation constants
    const a = subtract(
        multiply(
            multiply(d, v, true),
            multiply(d, v, true),
        ),
        multiply(
            multiply(d, d, true),
            [Math.pow(y, 2)]
        )
    )[0];
    const b = multiply(
        [2],
        subtract(
            multiply(
                multiply(o, v, true),
                multiply(d, v, true)
            ),
            multiply(
                multiply(o, d, true),
                [Math.pow(y, 2)]
            )
        )
    )[0];
    const c = subtract(
        multiply(
            multiply(o, v, true),
            multiply(o, v, true)
        ),
        multiply(
            multiply(o, o, true),
            [Math.pow(y, 2)]
        )
    )[0];

    // a list of possible time values
    const timeValues: number[] = [];

    // case 1
    if (c !== 0) {
        const root = Math.pow(b, 2) - 4 * a * c;
        if (root < 0) {
            // do nothing, no collision possible
        } else if (root === 0) {
            const t = -b / (2 * a);
            timeValues.push(t);
        } else {
            // the pdf contained the wrong quadratic formula, it's not perfectly correct
            const t1 = (-b - Math.sqrt(root)) / (2 * a);
            const t2 = (-b + Math.sqrt(root)) / (2 * a);
            timeValues.push(t1);
            timeValues.push(t2);
        }
    }

    let tMin: number | null = null;
    for (const t of timeValues) {
        if (t >= 0 && (tMin === null || t < tMin)) {
            tMin = t;
        }
    }
    if (tMin === null) {
        return {
            success: false,
            point: null,
            distance: null,
            time: null
        };
    } else {
        const point = add(o, multiply([tMin], d)) as [number, number, number];
        const distance = Math.sqrt(Math.pow(point[0], 2) + Math.pow(point[1], 2));
        const time = tMin;
        return {
            success: true,
            point: [point[0], point[1]],
            distance,
            time
        };
    }
};


export interface IExpirableTicks {
    life: number;
    maxLife: number;
}

/**
 * The luxuries an island planet can have.
 */
export enum EResourceType {
    // output goods
    COTTON = "COTTON",
    FLAX = "FLAX",
    TOBACCO = "TOBACCO",
    MOLASSES = "MOLASSES",
    RUM = "RUM",
    COFFEE = "COFFEE",
    CACAO = "CACAO",
    RUBBER = "RUBBER",
    FUR = "FUR",
    MAHOGANY = "MAHOGANY",
    // capital goods
    FIREARM = "FIREARM",
    GUNPOWDER = "GUNPOWDER",
    IRON = "IRON",
    RATION = "RATION"
}

/**
 * A list of goods produced by outposts.
 */
export const OUTPOST_GOODS: EResourceType[] = [
    EResourceType.COTTON,
    EResourceType.FLAX,
    EResourceType.TOBACCO,
    EResourceType.MOLASSES,
    EResourceType.RUM,
    EResourceType.COFFEE,
    EResourceType.CACAO,
    EResourceType.RUBBER,
    EResourceType.FUR,
    EResourceType.MAHOGANY,
];

/**
 * A list of goods produced by capitals.
 */
export const CAPITAL_GOODS: EResourceType[] = [
    EResourceType.FIREARM,
    EResourceType.GUNPOWDER,
    EResourceType.IRON,
    EResourceType.RATION,
];

export interface IItemData {
    resourceType: EResourceType;
    basePrice: number;
}

export const ITEM_DATA: IItemData[] = [
    // outpost goods
    { resourceType: EResourceType.COTTON, basePrice: 1 },
    { resourceType: EResourceType.FLAX, basePrice: 1 },
    { resourceType: EResourceType.TOBACCO, basePrice: 3 },
    { resourceType: EResourceType.MOLASSES, basePrice: 1 },
    { resourceType: EResourceType.RUM, basePrice: 5 },
    { resourceType: EResourceType.COFFEE, basePrice: 2 },
    { resourceType: EResourceType.CACAO, basePrice: 2 },
    { resourceType: EResourceType.RUBBER, basePrice: 5 },
    { resourceType: EResourceType.FUR, basePrice: 5 },
    { resourceType: EResourceType.MAHOGANY, basePrice: 5 },
    // capital goods
    { resourceType: EResourceType.FIREARM, basePrice: 100 },
    { resourceType: EResourceType.GUNPOWDER, basePrice: 100 },
    { resourceType: EResourceType.IRON, basePrice: 50 },
    { resourceType: EResourceType.RATION, basePrice: 10 },
];

/**
 * The min distance in rendering to prevent disappearing ship bug.
 */
export const MIN_DISTANCE = 1 / 10;

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
const SHIP_DATA: IShipData[] = [{
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

/**
 * An object which has gold. Can be used to pay for ships.
 */
interface IGoldAccount {
    gold: number;
}

/**
 * An object which represents cargo.
 */
interface ICargoItem {
    /**
     * The source of the cargo. Delivering cargo will apply a cargo buff to the faction, giving the faction more gold
     * for 10 minutes. Delivering cargo from the same planet will not stack the buff.
     */
    sourcePlanetId: string;
    /**
     * The type of resource. Each resource will be used to compute buffs separately. One faction can specialize in tea
     * while another can specialize in coffee. A faction which has large amounts of a single resource will force
     * other factions to pay it gold to access the luxury. Factions will be forced to tariff, embargo or declare war
     * to resolve the trade deficit.
     */
    resourceType: EResourceType;
    /**
     * If the cargo was pirated.
     */
    pirated: boolean;
}

/**
 * A type of order for a ship to complete. Orders are actions the ship should take on behalf of the faction.
 */
export enum EOrderType {
    /**
     * Explore space randomly.
     */
    ROAM = "ROAM",
    /**
     * Move settlers to a planet to colonize it.
     */
    SETTLE = "SETTLE",
    /**
     * Trade with a planet to collect luxuries.
     */
    TRADE = "TRADE",
    /**
     * Find and destroy an enemy ship, then return the cargo.
     */
    PIRATE = "PIRATE",
}

/**
 * The level of settlement of a world.
 */
export enum ESettlementLevel {
    /**
     * The world does not have any faction on it.
     */
    UNTAMED = 0,
    /**
     * The world is a small outpost which can repair ships and produce luxuries such as fur. But it cannot produce
     * ships. Ship production is too complicated for an outpost. This planet has no government.
     */
    OUTPOST = 1,
    /**
     * The world is larger and can repair ships and also produce small ships. It is able to engage in manufacturing,
     * producing more complicated goods. This planet has a small government, either a republic or a governor. Colonies
     * will send taxes with a trade ship back to the capital so the capital can issue more orders.
     */
    COLONY = 2,
    /**
     * The world is larger and can repair ships and also produce medium ships. It is able to produce complicated goods
     * and is considered a core part of the faction. This world is able to issue it's own orders to it's own local fleet,
     * similar to a capital but the capital will always override the territory. Capitals can issue general economic orders
     * to territories.
     */
    TERRITORY = 3,
    /**
     * This world is a core part of the faction and contains lots of manufacturing and investments. It is able to produce
     * large ships. Provinces can issue it's own orders to it's local fleet similar to a capital but the capital will always
     * override the province. Capitals can issue general economic orders to provinces. Provinces can issue general
     * economic orders to territories.
     */
    PROVINCE = 4,
    /**
     * This world is the capital of the faction. It is able to produce the largest ships. All orders come from the capital.
     * If the capital is captured, another province or territory can become a second capital to replace the original capital.
     */
    CAPITAL = 5,
}

/**
 * A list of planets to explore, used internally by the faction.
 */
interface IExplorationGraphData {
    distance: number;
    settlerShipIds: string[];
    traderShipIds: string[];
    pirateShipIds: string[];
    planet: Planet;
}

export enum EFaction {
    DUTCH = "DUTCH",
    ENGLISH = "ENGLISH",
    FRENCH = "FRENCH",
    PORTUGUESE = "PORTUGUESE",
    SPANISH = "SPANISH",
}

/**
 * A special buff applied to factions when they accumulate luxuries.
 */
class LuxuryBuff {
    public instance: App;
    public faction: Faction;
    public resourceType: EResourceType;
    public planetId: string;
    private expires: number = 10 * 60 * 10;
    private ticks: number = 0;

    constructor(instance: App, faction: Faction, resourceType: EResourceType, planetId: string) {
        this.instance = instance;
        this.faction = faction;
        this.resourceType = resourceType;
        this.planetId = planetId;
    }

    /**
     * Calculate the gold exchange of each faction.
     * @param app
     * @param faction
     * @param resourceType
     * @constructor
     */
    public static CalculateGoldBuff(app: App, faction: Faction, resourceType: EResourceType) {
        const totalLuxuries: number = Object.values(app.factions).reduce((acc: number, f) => {
            return acc + f.luxuryBuffs.reduce((acc2: number, l) => {
                if (l.resourceType === resourceType) {
                    return acc2 + 1;
                } else {
                    return acc2;
                }
            }, 0);
        }, 0);
        const factionLuxuries: number = faction.luxuryBuffs.reduce((acc: number, l) => {
            if (l.resourceType === resourceType) {
                return acc + 1;
            } else {
                return acc;
            }
        }, 0);
        const averageLuxuryConsumption: number = totalLuxuries / Object.values(app.factions).length;

        // get the price multiplier of the item
        let basePrice: number = 1;
        const itemData = ITEM_DATA.find(item => item.resourceType === resourceType);
        if (itemData) {
            basePrice = itemData.basePrice;
        }

        // calculate the gold exchange based on luxuries
        if (totalLuxuries > 0) {
            faction.gold += ((factionLuxuries / totalLuxuries) - averageLuxuryConsumption) * basePrice;
        }
    }

    /**
     * Increment the buff.
     */
    public handleLuxuryBuffLoop() {
        this.ticks += 1;
    }

    /**
     * Find a matching luxury buff.
     * @param resourceType
     * @param planetId
     */
    public matches(resourceType: EResourceType, planetId: string) {
        return this.resourceType === resourceType && this.planetId === planetId;
    }

    /**
     * Reset the buff timer. Returns an amount replenished. Replenishing will reward the captain with money.
     */
    public replenish() {
        const percentReplenished: number = this.ticks / this.expires;
        this.ticks = 0;
        return percentReplenished;
    }

    /**
     * The total value of the luxury buff.
     */
    public goldValue(): number {
        if (CAPITAL_GOODS.includes(this.resourceType)) {
            return 0;
        }
        const itemData = ITEM_DATA.find(item => item.resourceType === this.resourceType);
        if (itemData) {
            return this.expires * itemData.basePrice;
        }
        return this.expires;
    }

    /**
     * The buff expired.
     */
    public expired() {
        return this.ticks >= this.expires;
    }

    /**
     * Remove the buff.
     */
    public remove() {
        // remove from app
        const appIndex = this.instance.luxuryBuffs.findIndex(l => l === this);
        if (appIndex >= 0) {
            this.instance.luxuryBuffs.splice(appIndex, 1);
        }
        // remove from faction
        const factionIndex = this.faction.luxuryBuffs.findIndex(l => l === this);
        if (factionIndex >= 0) {
            this.faction.luxuryBuffs.splice(factionIndex, 1);
        }
    }
}

/**
 * A class representing a faction in the game world. Responsible for building boats, setting up trade, and colonizing islands.
 */
export class Faction {
    /**
     * An instance of app to retrieve faction data.
     */
    public instance: App;
    /**
     * The id of the faction.
     */
    public id: EFaction;
    /**
     * The color of the faction.
     */
    public factionColor: string;
    /**
     * The home world planet id.
     */
    public homeWoldPlanetId: string;
    /**
     * A list of planet ids of planets owned by this faction.
     */
    public planetIds: string[] = [];
    /**
     * A list of ship ids owned by this faction.
     */
    public shipIds: string[] = [];
    public shipsAvailable: Record<EShipType, number> = {
        [EShipType.SLOOP]: 0,
        [EShipType.CORVETTE]: 0,
        [EShipType.HIND]: 0
    };
    /**
     * A number which produces unique ship id names.
     * @private
     */
    private shipIdAutoIncrement: number = 0;
    /**
     * THe number of gold accumulated by the faction, used to pay captains.
     */
    public gold: number = 100000;
    /**
     * The list of planet priorities for exploration.
     * @private
     */
    public explorationGraph: Record<string, IExplorationGraphData> = {};
    /**
     * A list of luxuryBuffs which improves the faction.
     */
    public luxuryBuffs: LuxuryBuff[] = [];

    public getShipAutoIncrement(): number {
        return this.shipIdAutoIncrement++;
    }

    /**
     * Create a new faction.
     * @param instance The app which contains data for the faction to process.
     * @param id The id of the faction.
     * @param factionColor The color of the faction.
     * @param homeWorldPlanetId The home world of the faction.
     */
    constructor(instance: App, id: EFaction, factionColor: string, homeWorldPlanetId: string) {
        this.instance = instance;
        this.id = id;
        this.factionColor = factionColor;
        this.homeWoldPlanetId = homeWorldPlanetId;
        this.planetIds.push(homeWorldPlanetId);

        // build exploration graph for which planets to explore and in what order
        const homeWorld = instance.planets.find(planet => planet.id === homeWorldPlanetId);
        if (homeWorld) {
            for (const planet of instance.planets) {
                if (planet.pathingNode && homeWorld.pathingNode && planet.id !== homeWorld.id) {
                    const path = planet.pathingNode.pathToObject(homeWorld.pathingNode);
                    const distance = path.reduce((acc: {
                        lastPosition: [number, number, number],
                        totalDistance: number
                    }, vertex) => {
                        return {
                            lastPosition: vertex,
                            totalDistance: acc.totalDistance + VoronoiGraph.angularDistance(acc.lastPosition, vertex, this.instance.worldScale)
                        };
                    }, {
                        lastPosition: homeWorld.position.rotateVector([0, 0, 1]),
                        totalDistance: 0
                    }).totalDistance;

                    this.explorationGraph[planet.id] = {
                        distance,
                        settlerShipIds: [],
                        traderShipIds: [],
                        pirateShipIds: [],
                        planet
                    };
                }
            }
        }
    }

    /**
     * Apply a new luxury buff to a faction.
     * @param account A gold holding account which increases after trading.
     * @param resourceType The resource type affects the buff.
     * @param planetId The source world of the goods.
     */
    public applyLuxuryBuff(account: IGoldAccount, resourceType: EResourceType, planetId: string) {
        const oldLuxuryBuff = this.luxuryBuffs.find(l => l.matches(resourceType, planetId));
        if (oldLuxuryBuff) {
            const percentReplenished = oldLuxuryBuff.replenish();
            const goldProfit = Math.floor(oldLuxuryBuff.goldValue() * percentReplenished);
            const goldBonus = Math.floor(goldProfit * 0.2);
            this.gold -= goldBonus;
            account.gold += goldBonus;
        } else {
            this.luxuryBuffs.push(new LuxuryBuff(this.instance, this, resourceType, planetId));
        }
    }

    public getFactionNextShipType(): EShipType {
        if (this.shipsAvailable[EShipType.SLOOP] < Math.ceil(this.shipIds.length * (1 / 2))) {
            return EShipType.SLOOP;
        }
        if (this.shipsAvailable[EShipType.CORVETTE] < Math.ceil(this.shipIds.length * (1 / 3))) {
            return EShipType.CORVETTE;
        }
        if (this.shipsAvailable[EShipType.HIND] < Math.ceil(this.shipIds.length * (1 / 6))) {
            return EShipType.HIND;
        }
        return EShipType.SLOOP;
    }

    /**
     * Faction AI loop.
     */
    public handleFactionLoop() {
        // pay captains to buy new ships
        this.gold -= 0.1;
        this.instance.gold += 0.1;

        // captain new AI ships
        const factionNextShipType = this.getFactionNextShipType();
        for (const planetId of this.planetIds) {
            const planet = this.instance.planets.find(p => p.id === planetId);
            if (planet && planet.getNumShipsAvailable(factionNextShipType) > 2 && this.shipIds.length < 50 && this.gold >= planet.shipyard.quoteShip(factionNextShipType)) {
                planet.spawnShip(this, factionNextShipType, true);
            }
        }

        // handle the luxury buffs from trading
        const expiredLuxuryBuffs: LuxuryBuff[] = [];
        for (const luxuryBuff of this.luxuryBuffs) {
            const expired = luxuryBuff.expired();
            if (expired) {
                expiredLuxuryBuffs.push(luxuryBuff);
            } else {
                luxuryBuff.handleLuxuryBuffLoop();
            }
        }
        for (const expiredLuxuryBuff of expiredLuxuryBuffs) {
            expiredLuxuryBuff.remove();
        }
    }

    /**
     * Give an order to a ship.
     * @param ship
     */
    public getOrder(ship: Ship): Order {
        const shipData = SHIP_DATA.find(s => s.shipType === ship.shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }

        const entries = Object.entries(this.explorationGraph)
            .sort((a, b) => a[1].distance - b[1].distance);

        // find worlds to pirate
        const pirateWorldEntry = entries.find(entry => {
            // settle new worlds which have not been settled yet
            const roomToPirate = entry[1].pirateShipIds.length > 0;
            const isSettledEnoughToTrade = entry[1].planet.settlementLevel >= ESettlementLevel.OUTPOST;
            const isOwnedByEnemy = Object.values(this.instance.factions).every(faction => {
                if (faction.id === this.id) {
                    // skip the faction itself
                    return false;
                } else {
                    // the faction should pirate other factions
                    return faction.planetIds.includes(entry[0]);
                }
            });
            return roomToPirate && isSettledEnoughToTrade && isOwnedByEnemy;
        });

        // find worlds to trade
        const tradeWorldEntry = entries.find(entry => {
            // settle new worlds which have not been settled yet
            const roomToTrade = entry[1].traderShipIds.length <= entry[1].planet.resources.length - shipData.cargoSize;
            const isSettledEnoughToTrade = entry[1].planet.settlementLevel >= ESettlementLevel.OUTPOST;
            const notTradedYet = Object.values(this.instance.factions).every(faction => {
                if (faction.id === this.id) {
                    // skip the faction itself
                    return true;
                } else {
                    // the faction should not colonize another planet colonized by another faction
                    return !faction.planetIds.includes(entry[0]);
                }
            });
            return roomToTrade && isSettledEnoughToTrade && notTradedYet;
        });

        // find worlds to settle
        const settlementWorldEntry = entries.find(entry => {
            // settle new worlds which have not been settled yet
            const roomToSettleMore = entry[1].settlerShipIds.length <=
                Planet.NUM_SETTLEMENT_PROGRESS_STEPS -
                Math.round(entry[1].planet.settlementProgress * Planet.NUM_SETTLEMENT_PROGRESS_STEPS) - shipData.settlementProgressFactor;
            const notSettledYet = Object.values(this.instance.factions).every(faction => {
                if (faction.id === this.id) {
                    // skip the faction itself
                    return true;
                } else {
                    // the faction should not colonize another planet colonized by another faction
                    return !faction.planetIds.includes(entry[0]);
                }
            });
            return roomToSettleMore && notSettledYet;
        });

        if (pirateWorldEntry && shipData.cannons.numCannons > 4) {
            // found a piracy slot, add ship to pirate
            pirateWorldEntry[1].pirateShipIds.push(ship.id);

            const order = new Order(this.instance, ship, this);
            order.orderType = EOrderType.PIRATE;
            order.planetId = pirateWorldEntry[0];
            order.expireTicks = 10 * 60 * 20; // pirate for 20 minutes before signing a new contract
            return order;
        } else if (tradeWorldEntry && shipData.cannons.numCannons <= 4) {
            // found a trade slot, add ship to trade
            tradeWorldEntry[1].traderShipIds.push(ship.id);

            const order = new Order(this.instance, ship, this);
            order.orderType = EOrderType.TRADE;
            order.planetId = tradeWorldEntry[0];
            order.expireTicks = 10 * 60 * 20; // trade for 20 minutes before signing a new contract
            return order;
        } else if (settlementWorldEntry) {
            // add ship to colonize
            settlementWorldEntry[1].settlerShipIds.push(ship.id);

            const order = new Order(this.instance, ship, this);
            order.orderType = EOrderType.SETTLE;
            order.planetId = settlementWorldEntry[0];
            return order;
        } else {
            // add ship to explore
            const order = new Order(this.instance, ship, this);
            order.orderType = EOrderType.ROAM;
            return order;
        }
    }

    public handleShipDestroyed(ship: Ship) {
        // remove ship from exploration graph
        for (const order of ship.orders) {
            if (!order.planetId) {
                continue;
            }

            const node = this.explorationGraph[order.planetId];
            const settlerIndex = node.settlerShipIds.findIndex(s => s === ship.id);
            if (settlerIndex >= 0) {
                node.settlerShipIds.splice(settlerIndex, 1);
            }
            const traderIndex = node.traderShipIds.findIndex(s => s === ship.id);
            if (traderIndex >= 0) {
                node.traderShipIds.splice(traderIndex, 1);
            }
            const pirateIndex = node.pirateShipIds.findIndex(s => s === ship.id);
            if (pirateIndex >= 0) {
                node.pirateShipIds.splice(pirateIndex, 1);
            }
        }

        // remove ship from faction registry
        const shipIndex = this.shipIds.findIndex(s => s === ship.id);
        if (shipIndex >= 0) {
            this.shipIds.splice(shipIndex, 1);
        }
        this.shipsAvailable[ship.shipType] -= 1;
    }
}

interface ITargetLineData {
    targetLines: Array<[[number, number], [number, number]]>,
    targetNodes: Array<[[number, number], number]>
}

interface ITessellatedTriangle {
    vertices: Quaternion[];
}

interface IDrawableTile {
    vertices: Quaternion[];
    centroid: Quaternion;
    color: string;
    id: string;
}

interface ICellData {
    vertices: Array<[number, number, number]>;
    centroid: [number, number, number];
}

/**
 * A polygon shape on a VoronoiGraph.
 */
export class VoronoiCell implements ICellData {
    public vertices: [number, number, number][] = [];
    public centroid: [number, number, number] = [0, 0, 0];
    public radius: number = 0;
}

/**
 * A drawable VoronoiCell.
 */
export class VoronoiTile implements IDrawableTile {
    public vertices: Quaternion[] = [];
    public centroid: Quaternion = Quaternion.ONE;
    public color: string = "red";
    public id: string = "";
}

interface IVoronoiTreeNodeParent<T extends ICameraState> {
    nodes: Array<VoronoiTreeNode<T>>;
    app: App;
}

/**
 * A voronoi tree used to speed up collision detection.
 */
export class VoronoiTreeNode<T extends ICameraState> implements IVoronoiTreeNodeParent<T> {
    public nodes: Array<VoronoiTreeNode<T>> = [];
    public point: [number, number, number];
    public voronoiCell: VoronoiCell;
    public radius: number = 0;
    public level: number;
    public parent: IVoronoiTreeNodeParent<T>;
    public items: T[] = [];
    public app: App;

    /**
     * How many levels of voronoi trees will the graph show.
     */
    public static MAX_TREE_LEVEL: number = 3;

    constructor(app: App, voronoiCell: VoronoiCell, level: number, parent: IVoronoiTreeNodeParent<T>) {
        this.app = app;
        this.voronoiCell = voronoiCell;
        this.point = voronoiCell.centroid;
        this.level = level;
        this.parent = parent;
    }

    /**
     * Add an object to the voronoi tree for faster referencing when performing physics and collision, possibly even
     * networking. Send only people or ships within the player's section of a tree.
     * @param drawable
     */
    addItem(drawable: T) {
        if (this.nodes.length === 0 && this.level < VoronoiTreeNode.MAX_TREE_LEVEL) {
            this.nodes = VoronoiTreeNode.createTreeNodes<T>(this.parent.nodes, this);
        }

        // end of tree, add to tree
        if (this.nodes.length === 0) {
            this.items.push(drawable);
            return;
        }

        // recurse tree
        const position = drawable.position.clone().rotateVector([0, 0, 1]);

        let bestDistance: number | null = null;
        let bestNode: VoronoiTreeNode<T> | null = null;
        for (const node of this.nodes) {
            const distance = VoronoiGraph.angularDistance(node.point, position, this.app.worldScale);
            if (bestDistance === null || distance < bestDistance) {
                bestDistance = distance;
                bestNode = node;
            }
        }
        if (bestDistance !== null && bestNode !== null) {
            bestNode.addItem(drawable);
        }
    }

    /**
     * Remove an object from the voronoi tree.
     * @param drawable
     */
    removeItem(drawable: T) {
        // end of tree, remove from tree
        if (this.nodes.length === 0) {
            const index = this.items.findIndex(i => i === drawable);
            if (index >= 0) {
                this.items.splice(index, 1);
            }
            return;
        }

        // recurse tree
        const position = drawable.position.clone().rotateVector([0, 0, 1]);

        let bestDistance: number | null = null;
        let bestNode: VoronoiTreeNode<T> | null = null;
        for (const node of this.nodes) {
            const distance = VoronoiGraph.angularDistance(node.point, position, this.app.worldScale);
            if (bestDistance === null || distance < bestDistance) {
                bestDistance = distance;
                bestNode = node;
            }
        }
        if (bestDistance !== null && bestNode !== null) {
            bestNode.removeItem(drawable);
        }
    }

    /**
     * Return a list of items within a visible area on the voronoi tree.
     * @param position A position to find near by objects with.
     */
    public *listItems(position: [number, number, number]): Generator<T> {
        // found items
        if (this.nodes.length === 0) {
            return yield * this.items;
        }

        // recurse tree
        for (const node of this.nodes) {
            const distance = VoronoiGraph.angularDistance(node.point, position, this.app.worldScale);
            if (distance < node.radius) {
                const generator = node.listItems(position);
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

    /**
     * Return a list of voronoi cells form the tree.
     */
    public *listCells(): Generator<VoronoiCell> {
        // found leaf node, return voronoi cell
        if (this.level === VoronoiTreeNode.MAX_TREE_LEVEL) {
            return yield this.voronoiCell;
        }

        for (const node of this.nodes) {
            const generator = node.listCells();
            while (true) {
                const res = generator.next();
                if (res.done) {
                    break;
                }
                yield res.value;
            }
        }
    }

    /**
     * Return a random polygon triangle of a voronoi cell.
     * @private
     */
    private static getRandomTriangleOfSphericalPolygon<T extends ICameraState>(forNode: VoronoiTreeNode<T>): number {
        const triangleAreasInPolygon: number[] = [];
        for (let i = 1; i < forNode.voronoiCell.vertices.length - 1; i++) {
            const a = forNode.voronoiCell.vertices[0];
            const b = forNode.voronoiCell.vertices[i];
            const c = forNode.voronoiCell.vertices[i + 1];
            const nab = DelaunayGraph.crossProduct(a, b);
            const nbc = DelaunayGraph.crossProduct(b, c);
            const nca = DelaunayGraph.crossProduct(c, a);
            const angleA = DelaunayGraph.dotProduct(nab, [-nca[0], -nca[1], -nca[2]]);
            const angleB = DelaunayGraph.dotProduct(nbc, [-nab[0], -nab[1], -nab[2]]);
            const angleC = DelaunayGraph.dotProduct(nca, [-nbc[0], -nbc[1], -nbc[2]]);
            const area = angleA + angleB + angleC - Math.PI;
            triangleAreasInPolygon.push(area);
        }
        const triangleAreasInPolygonSum = triangleAreasInPolygon.reduce((sum, v) => sum + v, 0);
        const triangleAreasInPolygonCum = triangleAreasInPolygon.reduce((acc: number[], v): number[] => {
            if (acc.length > 0) {
                acc.push(acc[acc.length - 1] + v);
            } else {
                acc.push(v);
            }
            return acc;
        }, [] as number[]);
        const randomTriangleInPolygonRandValue = Math.random() * triangleAreasInPolygonSum;
        let randomTriangleInPolygonIndex: number = 0;
        for (let i = triangleAreasInPolygonCum.length - 1; i >= 0; i--) {
            if (triangleAreasInPolygonCum[i] > randomTriangleInPolygonRandValue) {
                randomTriangleInPolygonIndex = i;
                break;
            }
        }
        return randomTriangleInPolygonIndex;
    }

    /**
     * Perform Sutherland-hodgman polygon clipping on a pair of voronoi cells. This will fit a voronoi cell inside
     * another voronoi cell, on a sphere. For hierarchical voronoi tree.
     * @param forNode The outer polygon.
     * @param polygon The inner polygon.
     * @private
     */
    private static polygonClip<T extends ICameraState>(forNode: VoronoiTreeNode<T>, polygon: VoronoiCell): VoronoiCell {
        // copy data, to make the function immutable
        const vertices: Array<[number, number, number]> = [];

        // for each outer line, assume infinite line segment
        for (let outerIndex = 0; outerIndex < forNode.voronoiCell.vertices.length; outerIndex++) {
            const outerA = forNode.voronoiCell.vertices[outerIndex % forNode.voronoiCell.vertices.length];
            const outerB = forNode.voronoiCell.vertices[(outerIndex + 1) % forNode.voronoiCell.vertices.length];
            const outerN = DelaunayGraph.normalize(DelaunayGraph.crossProduct(outerA, outerB));

            // used to clip the polygon, the first goal is to find an inner a and outer b
            let beginClipping: boolean = false;

            // for each inner line segment
            for (let innerIndex = 0; innerIndex < polygon.vertices.length || beginClipping; innerIndex++) {
                // compute intersection with line segment and infinite culling line
                const innerA = polygon.vertices[innerIndex % polygon.vertices.length];
                const innerB = polygon.vertices[(innerIndex + 1) % polygon.vertices.length];
                const midPoint = DelaunayGraph.normalize(App.getAveragePoint([innerA, innerB]));
                const innerN = DelaunayGraph.normalize(DelaunayGraph.crossProduct(innerA, innerB));
                const line = DelaunayGraph.normalize(DelaunayGraph.crossProduct(outerN, innerN));
                const intercept: [number, number, number] = DelaunayGraph.dotProduct(line, midPoint) >= 0 ? line : [
                    -line[0],
                    -line[1],
                    -line[2]
                ];

                // determine if to cull or to cut the polygon
                const isInnerAInside = DelaunayGraph.dotProduct(outerN, innerA) < 0;
                const isInnerBInside = DelaunayGraph.dotProduct(outerN, innerB) < 0;
                if (isInnerAInside && !isInnerBInside) {
                    // moved outside of polygon, begin clipping
                    beginClipping = true;
                    vertices.push(innerA, intercept);
                } else if (!isInnerAInside && !isInnerBInside) {
                    // still outside of polygon, skip this segment
                } else if (!isInnerAInside && isInnerBInside) {
                    // moved back inside polygon, perform clip
                    beginClipping = false;
                    // fix duplicate vertex bug caused by a polygon starting on a polygon clip
                    // if there is a triangle 1, 2, 3 with 1 being out of bounds, it would insert intercept 1-2, 2, 3, intercept 3-1
                    // do not insert intercept 1-2 twice, the for loop can continue past the last index
                    if (innerIndex < polygon.vertices.length) {
                        vertices.push(intercept);
                    }
                } else {
                    vertices.push(innerA);
                }
            }
        }

        // compute new voronoi cell
        const copy = new VoronoiCell();
        copy.vertices = vertices;
        copy.centroid = App.getAveragePoint(copy.vertices);
        copy.radius = copy.vertices.reduce((acc: number, vertex): number => {
            return Math.max(
                acc,
                VoronoiGraph.angularDistance(
                    copy.centroid,
                    vertex,
                    forNode.app.worldScale
                )
            );
        }, 0);

        return copy;
    }

    /**
     * Create child nodes of a current child node. This will create a hierarchical voronoi graph. Voronoi cells within
     * a voronoi cells, on a sphere.
     * @param originalNodes
     * @param forNode
     */
    public static createTreeNodes<T extends ICameraState>(originalNodes: Array<VoronoiTreeNode<T>>, forNode: VoronoiTreeNode<T>) {
        const nodes: Array<VoronoiTreeNode<T>> = [];

        // generate random points within a voronoi cell.
        let randomPointsWithinVoronoiCell: Array<[number, number, number]> = [];
        for (let i = 0; i < 10; i++) {
            // pick a random triangle of a polygon
            const randomTriangleIndex = VoronoiTreeNode.getRandomTriangleOfSphericalPolygon<T>(forNode);

            // pick a random point within a spherical triangle
            //
            // the random point is in the area bounded by x = 0, y = 1 - x, and y = 0
            // start with a square
            let randomX = Math.random();
            let randomY = Math.random();
            if (randomX + randomY > 0.5) {
                // flip point back onto triangle if it is above y = 1 - x
                randomX = 1 - randomX;
                randomY = 1 - randomY;
            }

            // create x and y axis interpolation quaternions
            const a = Quaternion.fromBetweenVectors([0, 0, 1], forNode.voronoiCell.vertices[0]);
            const b = Quaternion.fromBetweenVectors([0, 0, 1], forNode.voronoiCell.vertices[randomTriangleIndex]);
            const c = Quaternion.fromBetweenVectors([0, 0, 1], forNode.voronoiCell.vertices[randomTriangleIndex + 1]);
            const x = a.clone().inverse().mul(b).pow(randomX);
            const y = a.clone().inverse().mul(c).pow(randomY);

            // interpolate point on random values
            const point = a.clone().mul(x.clone()).mul(y.clone());
            randomPointsWithinVoronoiCell.push(point.rotateVector([0, 0, 1]));
        }

        // compute random nodes within voronoi cell, hierarchical voronoi tree.
        let goodPoints: VoronoiCell[] = [];
        for (let step = 0; step < 10; step++) {
            const delaunay = new DelaunayGraph<T>(forNode.app);
            delaunay.initializeWithPoints(randomPointsWithinVoronoiCell);
            const outOfBoundsVoronoiCells = delaunay.getVoronoiGraph().cells.slice(4);

            // perform sutherland-hodgman polygon clipping
            goodPoints = outOfBoundsVoronoiCells.map((polygon) => VoronoiTreeNode.polygonClip<T>(forNode, polygon));
            randomPointsWithinVoronoiCell = goodPoints.map(v => v.centroid);
        }

        // create tree nodes
        for (const point of goodPoints) {
            // skip bad voronoi cells
            if (point.vertices.length < 3) {
                continue;
            }

            // insert good voronoi cell
            const node = new VoronoiTreeNode<T>(forNode.app, point, forNode.level + 1, forNode);
            node.radius = point.vertices.reduce((acc, v) => Math.max(
                acc,
                VoronoiGraph.angularDistance(point.centroid, v, forNode.app.worldScale)
            ), 0);
            nodes.push(node);
        }

        return nodes;
    }
}

/**
 * A voronoi tree used to speed up collision detection.
 */
export class VoronoiTree<T extends ICameraState> implements IVoronoiTreeNodeParent<T> {
    public nodes: Array<VoronoiTreeNode<T>> = [];
    public app: App;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Create initial level 1 nodes for a tree. These are top level nodes.
     * @param parent The parent containing top level nodes, most likely VoronoiTree.
     */
    public createRootNodes<T extends ICameraState>(parent: IVoronoiTreeNodeParent<T>) {
        const nodes: Array<VoronoiTreeNode<T>> = [];

        // compute points
        const goodPoints = this.app.generateGoodPoints(10);
        for (const point of goodPoints) {
            const node = new VoronoiTreeNode<T>(parent.app, point, 1, parent);
            node.radius = point.vertices.reduce((acc, v) => Math.max(
                acc,
                VoronoiGraph.angularDistance(point.centroid, v, this.app.worldScale)
            ), 0);
            nodes.push(node);
        }
        return nodes;
    }

    /**
     * Add an item to the voronoi tree for quick lookup in the future. Useful for grouping objects close together. Required
     * for good physics and collision detection. Instead of comparing 1 cannon ball to 2000 ships which would be 2000
     * physics operations, use this class to divide recursively, 2000 / 10 = 200 / 10 = 20 / 10 = 2, resulting in
     * 30 tree operations + 2 physics operations.
     * @param drawable
     */
    public addItem(drawable: T) {
        if (this.nodes.length === 0) {
            this.nodes = this.createRootNodes<T>(this);
        }

        const position = drawable.position.clone().rotateVector([0, 0, 1]);

        let bestDistance: number | null = null;
        let bestNode: VoronoiTreeNode<T> | null = null;
        for (const node of this.nodes) {
            const distance = VoronoiGraph.angularDistance(node.point, position, this.app.worldScale);
            if (bestDistance === null || distance < bestDistance) {
                bestDistance = distance;
                bestNode = node;
            }
        }
        if (bestDistance !== null && bestNode !== null) {
            bestNode.addItem(drawable);
        }
    }

    /**
     * Remove an item from the voronoi tree. Useful for resetting the tree before the movement phase.
     * @param drawable
     */
    public removeItem(drawable: T) {
        // recurse tree
        const position = drawable.position.clone().rotateVector([0, 0, 1]);

        let bestDistance: number | null = null;
        let bestNode: VoronoiTreeNode<T> | null = null;
        for (const node of this.nodes) {
            const distance = VoronoiGraph.angularDistance(node.point, position, this.app.worldScale);
            if (bestDistance === null || distance < bestDistance) {
                bestDistance = distance;
                bestNode = node;
            }
        }
        if (bestDistance !== null && bestNode !== null) {
            bestNode.removeItem(drawable);
        }
    }

    /**
     * List items near a specific position within the Voronoi Tree. Useful for finding nearest neighbors, when doing
     * physics and collision detection.
     * @param position
     */
    public *listItems(position: [number, number, number]): Generator<T> {
        // recurse tree
        for (const node of this.nodes) {
            const distance = VoronoiGraph.angularDistance(node.point, position, this.app.worldScale);
            if (distance < node.radius) {
                const generator = node.listItems(position);
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

    /**
     * Get a list of cells to print, useful for debugging the voronoi tree structure.
     */
    public *listCells(): Generator<VoronoiCell> {
        for (const node of this.nodes) {
            const generator = node.listCells();
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

/**
 * A list of voronoi cells.
 */
export class VoronoiGraph<T extends ICameraState> {
    /**
     * The app containing world scale.
     */
    app: App;
    /**
     * A list of voronoi cell used for rendering and physics.
     */
    cells: VoronoiCell[] = [];

    /**
     * A list of drawables mapped to voronoi cells to speed up rendering.
     */
    drawableMap: Record<number, Array<T>> = {};

    /**
     * A list of drawable id to drawable map for quick reference.
     */
    drawableSet: Record<string, number> = {};

    constructor(app: App) {
        this.app = app;
    }

    /**
     * The angular distance between two points.
     * @param a The first point.
     * @param b The second point.
     * @param worldScale The size of the world.
     */
    public static angularDistance(a: [number, number, number], b: [number, number, number], worldScale: number): number {
        return Math.acos(DelaunayGraph.dotProduct(
            DelaunayGraph.normalize(a),
            DelaunayGraph.normalize(b)
        )) * worldScale;
    }

    /**
     * The angular distance of a quaternion.
     * @param a A quaternion with a angular rotation.
     * @param worldScale the size of the world.
     */
    public static angularDistanceQuaternion(a: Quaternion, worldScale: number): number {
        return Math.acos(a.w) * 2 * worldScale;
    }

    /**
     * Find the closest voronoi cell index to a given position.
     * @param position The position to find.
     * @private
     */
    private findClosestVoronoiCellIndex(position: [number, number, number]): number {
        let closestDistance = Number.MAX_VALUE;
        let closestIndex = -1;
        for (let i = 0; i < this.cells.length; i++) {
            const cellDistance = VoronoiGraph.angularDistance(position, this.cells[i].centroid, this.app.worldScale);
            if (cellDistance < closestDistance) {
                closestIndex = i;
                closestDistance = cellDistance;
            }
        }

        return closestIndex;
    }

    /**
     * Add the drawable to the voronoi cell
     * @param drawable The drawable to add.
     */
    addDrawable(drawable: T) {

        const drawablePosition = drawable.position.rotateVector([0, 0, 1]);
        const closestIndex = this.findClosestVoronoiCellIndex(drawablePosition);
        if (closestIndex >= 0) {
            // if old index is different, remove old index
            const oldIndex: number | undefined = this.drawableSet[drawable.id];
            if (oldIndex !== undefined && closestIndex !== oldIndex) {
                const index = this.drawableMap[oldIndex].findIndex(d => d === drawable);
                this.drawableMap[oldIndex].splice(index, 1);
            }

            // add new mapping
            if (typeof(this.drawableMap[closestIndex]) === "undefined") {
                this.drawableMap[closestIndex] = [];
            }
            this.drawableMap[closestIndex].push(drawable);
            this.drawableSet[drawable.id] = closestIndex;
        }
    }

    /**
     * Fetch the drawables from the voronoi map.
     * @param position
     */
    *fetchDrawables(position: [number, number, number]): Generator<T> {
        const closestCellIndices: number[] = [];
        for (let i = 0; i < this.cells.length; i++) {
            const cell = this.cells[i];
            const cellDistance = Math.acos(DelaunayGraph.dotProduct(
                position,
                cell.centroid
            ));
            if (cellDistance < cell.radius) {
                closestCellIndices.push(i);
            }
        }
        for (const cellIndex of closestCellIndices) {
            if (typeof(this.drawableMap[cellIndex]) !== "undefined") {
                for (const drawable of this.drawableMap[cellIndex]) {
                    yield drawable;
                }
            }
        }
    }

    /**
     * The lloyd's relaxation of one cell.
     * @param cell The cell to compute the centroid of.
     */
    public static centroidOfCell(cell: VoronoiCell): [number, number, number] {
        // create a triangle fan of the polygon
        const triangleFanParameters: Array<{averagePoint: [number, number, number], area: number}> = [];
        for (let i = 1; i < cell.vertices.length - 1; i++) {
            const a = cell.vertices[0];
            const b = cell.vertices[i];
            const c = cell.vertices[i + 1];

            // compute triangle fan parameters
            const averagePoint = App.getAveragePoint(cell.vertices);
            const area = DelaunayGraph.dotProduct(
                DelaunayGraph.subtract(a, b),
                DelaunayGraph.subtract(c, b)
            ) / 2;
            triangleFanParameters.push({
                averagePoint,
                area
            });
        }

        // compute the centroid from a sum of triangle fan parameters
        let sumAveragePoint: [number, number, number] = [0, 0, 0];
        let sumWeight: number = 0;
        for (const triangleFanParameter of triangleFanParameters) {
            sumAveragePoint = DelaunayGraph.add(
                sumAveragePoint,
                [
                    triangleFanParameter.averagePoint[0] * triangleFanParameter.area,
                    triangleFanParameter.averagePoint[1] * triangleFanParameter.area,
                    triangleFanParameter.averagePoint[2] * triangleFanParameter.area
                ]
            );
            sumWeight += triangleFanParameter.area;
        }

        return [
            sumAveragePoint[0] / sumWeight,
            sumAveragePoint[1] / sumWeight,
            sumAveragePoint[2] / sumWeight
        ];
    }

    /**
     * Create a list of centered points, which can be used to iteratively improve randomly generated points to
     * create a good random mesh.
     */
    public lloydRelaxation(): Array<[number, number, number]> {
        // for each cell
        const relaxedPoints: Array<[number, number, number]> = [];
        for (const cell of this.cells) {
            // the sum had a division, this is the final result
            relaxedPoints.push(VoronoiGraph.centroidOfCell(cell));
        }
        return relaxedPoints;
    }
}

/**
 * A simple class storing some vertices to render on scene
 */
export class DelaunayTriangle implements ICellData {
    public vertices: [number, number, number][] = [];
    public centroid: [number, number, number] = [0, 0, 0];
}

/**
 * A class used to render a delaunay triangle tile.
 */
export class DelaunayTile implements IDrawableTile {
    public vertices: Quaternion[] = [];
    public centroid: Quaternion = Quaternion.ONE;
    public color: string = "red";
    public id: string = "";
}

interface IPathingGraph {
    vertices: Array<[number, number, number]>;
    edges: [number, number][];
    app: App;
}
interface IPathingNode<T extends IPathingGraph> {
    id: number;
    instance: T;
    closestVertex: number;
    position: [number, number, number];
    pathToObject(other: IPathingNode<T>): Array<[number, number, number]>;
}
export class PathingNode<T extends IPathingGraph> implements IPathingNode<T> {
    public id: number = -1;
    public instance: T;
    public closestVertex: number = -1;
    public position: [number, number, number] = [0, 0, 0];

    constructor(instance: T) {
        this.instance = instance;
    }


    /**
     * Compute the path to another object on the sphere using the Delaunay graph as an AI pathing graph.
     * @param other
     */
    public pathToObject(other: IPathingNode<T>): Array<[number, number, number]> {
        if (this.id < 0 || this.closestVertex < 0 || this.instance === null || this.instance.vertices.length <= 0) {
            throw new Error("Pathing data is not initialized");
        }

        // pathing parameters
        const path: Array<[number, number, number]> = [];
        const start = this.closestVertex;
        const end = other.closestVertex;
        let foundEnd: boolean = false;
        let fromArray: number[] = [start];
        const foundNodes: Array<{from: number, to: number, distance: number}> = [];

        // for upto 100 node jumps
        for (let distance = 1; distance <= 100 && !foundEnd; distance++) {
            // perform breadth first search by
            // copying fromArray and clearing the original then using the copy to iterate
            const copyOfFromArray = fromArray;
            fromArray = [];
            for (const from of copyOfFromArray) {
                // find leaving edges in delaunay
                const leavingEdges = this.instance.edges.filter(edge => {
                    return edge[0] === from;
                });
                let leavingEdgeMatched: boolean = false;

                // for each leaving edge
                for (const edge of leavingEdges) {
                    const to = edge[1];
                    // check found nodes for existing data
                    const matchingNode = foundNodes.find(node => node.to === to);
                    if (matchingNode) {
                        // existing data
                        if (distance < matchingNode.distance) {
                            // found better distance route, replace distance
                            matchingNode.distance = distance;
                            leavingEdgeMatched = true;
                        }
                    } else {
                        // found new unexplored route, record distance
                        foundNodes.push({
                            from,
                            to,
                            distance
                        });
                        leavingEdgeMatched = true;
                    }
                    if (to === end) {
                        // found the end node, terminate execution
                        foundEnd = true;
                        break;
                    }
                    if (leavingEdgeMatched && !fromArray.includes(to)) {
                        // a new leaving edge was created or an existing one was updated, continue breadth first search
                        // by adding to to the next from array
                        fromArray.push(to);
                    }
                }
            }
        }

        // find best path from end to start
        const endNode = foundNodes.find(node => node.to === end);
        if (endNode) {
            path.push(other.position);
            let position: number = end;
            for (let distance = endNode.distance; distance > 0; distance--) {
                const positionCopy: number = position;
                const nextNode = foundNodes.find(node => node.to === positionCopy && node.distance === distance);
                if (nextNode) {
                    position = nextNode.from;
                    path.push(this.instance.vertices[position]);
                } else {
                    throw new Error("Could not find next node after building A* map, pathfinding failed.");
                }
            }
            path.push(this.instance.vertices[start]);
        } else {
            throw new Error("Could not find end node after building A* map, pathfinding failed.");
        }

        // remove duplicate nodes
        if (path.length >= 2 && VoronoiGraph.angularDistance(path[path.length - 1], path[path.length - 2], this.instance.app.worldScale) < App.VELOCITY_STEP / this.instance.app.worldScale * Math.PI / 2) {
            path.pop();
        }
        return path.reverse();
    }
}

/**
 * A delaunay graph for procedural generation, automatic random landscapes.
 */
export class DelaunayGraph<T extends ICameraState> implements IPathingGraph {
    /**
     * Reference to the app containing the delaunay graph.
     */
    public app: App;
    /**
     * The vertices of the graph.
     */
    public vertices: [number, number, number][] = [];
    /**
     * The edges of the graph.
     */
    public edges: [number, number][] = [];
    /**
     * The triangles of the graph.
     */
    public triangles: number[][] = [];

    /**
     * A list of nodes such as planet to help AI travel around the map.
     */
    public pathingNodes: Record<number, PathingNode<DelaunayGraph<T>>> = {};

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Find the closest vertex index to a given position.
     * @param position The position to find.
     * @private
     */
    private findClosestVertexIndex(position: [number, number, number]): number {
        let closestDistance = Number.MAX_VALUE;
        let closestIndex = -1;
        for (let i = 0; i < this.vertices.length; i++) {
            const cellDistance = VoronoiGraph.angularDistance(position, this.vertices[i], this.app.worldScale);
            if (cellDistance < closestDistance) {
                closestIndex = i;
                closestDistance = cellDistance;
            }
        }

        return closestIndex;
    }

    private nextPathingNodeId: number = 0;
    public createPathingNode(position: [number, number, number]) {
        const closestVertex = this.findClosestVertexIndex(position);
        const pathingNode = new PathingNode<DelaunayGraph<T>>(this);
        pathingNode.id = this.nextPathingNodeId++;
        pathingNode.instance = this;
        pathingNode.closestVertex = closestVertex;
        pathingNode.position = position;
        this.pathingNodes[pathingNode.id] = pathingNode;
        return pathingNode;
    }

    /**
     * FInd the closest pathing node to a position, used to begin path finding algorithm.
     * @param position The position to find a nearby pathing node.
     */
    public findClosestPathingNode(position: [number, number, number]): PathingNode<DelaunayGraph<T>> {
        let closestDistance = Number.MAX_VALUE;
        let closestPathingNode: PathingNode<DelaunayGraph<T>> | null = null;
        const pathingNodes = Object.values(this.pathingNodes);
        for (const pathingNode of pathingNodes) {
            const cellDistance = VoronoiGraph.angularDistance(position, pathingNode.position, this.app.worldScale);
            if (cellDistance < closestDistance) {
                closestPathingNode = pathingNode;
                closestDistance = cellDistance;
            }
        }

        if (closestPathingNode === null) {
            throw new Error("Could not find closest pathing node for path finding");
        }

        return closestPathingNode;
    }

    /**
     * Initialize a basic graph, ready for incremental construction.
     */
    public initialize() {
        const north: [number, number, number] = DelaunayGraph.normalize([0, 0, 1]);
        this.vertices.push(north);

        const tetrahedronAngle = 120 / 180 * Math.PI;
        const base1: [number, number, number] = DelaunayGraph.normalize([
            Math.cos(0) * Math.sin(tetrahedronAngle),
            Math.sin(0) * Math.sin(tetrahedronAngle),
            Math.cos(tetrahedronAngle)
        ]);
        const base2: [number, number, number] = DelaunayGraph.normalize([
            Math.cos(tetrahedronAngle) * Math.sin(tetrahedronAngle),
            Math.sin(tetrahedronAngle) * Math.sin(tetrahedronAngle),
            Math.cos(tetrahedronAngle)
        ]);
        const base3: [number, number, number] = DelaunayGraph.normalize([
            Math.cos(2 * tetrahedronAngle) * Math.sin(tetrahedronAngle),
            Math.sin(2 * tetrahedronAngle) * Math.sin(tetrahedronAngle),
            Math.cos(2 * tetrahedronAngle)
        ]);
        this.vertices.push(base1, base2, base3);

        this.edges.push([0, 1], [1, 2], [2, 0]);
        this.edges.push([0, 2], [2, 3], [3, 0]);
        this.edges.push([0, 3], [3, 1], [1, 0]);
        this.edges.push([1, 3], [3, 2], [2, 1]);

        this.triangles.push([0, 1, 2]);
        this.triangles.push([3, 4, 5]);
        this.triangles.push([6, 7, 8]);
        this.triangles.push([9, 10, 11]);
    }

    public initializeWithPoints(points: Array<[number, number, number]>) {
        this.initialize();
        for (const point of points) {
            this.incrementalInsert(point);
        }
    }

    public static randomInt(): number {
        return (Math.random() * 2) - 1;
    }

    public static randomPoint(): [number, number, number] {
        // generate random vertex
        const vertex: [number, number, number] = [DelaunayGraph.randomInt(), DelaunayGraph.randomInt(), DelaunayGraph.randomInt()];
        return DelaunayGraph.normalize(vertex);
    }

    public static distanceFormula(a: [number, number, number], b: [number, number, number]): number {
        return Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2) + Math.pow(b[2] - a[2], 2));
    }

    public static normalize(a: [number, number, number]): [number, number, number] {
        const vertexLength = DelaunayGraph.distanceFormula(a, [0, 0, 0]);
        return [
            a[0] / vertexLength,
            a[1] / vertexLength,
            a[2] / vertexLength,
        ];
    }

    /**
     * Compute the cross product of two vectors. Used to compute the normal of two vectors.
     * @param a The first vector.
     * @param b The second vector.
     */
    public static crossProduct(a: [number, number, number], b: [number, number, number]): [number, number, number] {
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
        ];
    }

    /**
     * Compute the subtraction of two vectors.
     * @param a The first vector.
     * @param b The second vector.
     */
    public static subtract(a: [number, number, number], b: [number, number, number]): [number, number, number] {
        return [
            a[0] - b[0],
            a[1] - b[1],
            a[2] - b[2],
        ];
    }

    /**
     * Compute the addition of two vectors.
     * @param a The first vector.
     * @param b The second vector.
     */
    public static add(a: [number, number, number], b: [number, number, number]): [number, number, number] {
        return [
            a[0] + b[0],
            a[1] + b[1],
            a[2] + b[2],
        ];
    }

    /**
     * Compute the cross product of two vectors.
     * @param a The first vector.
     * @param b The second vector.
     */
    public static dotProduct(a: [number, number, number], b: [number, number, number]): number {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }

    /**
     * Return the triangle index of the triangle intersection.
     * @param vertex The vertex to check for triangle intersection.
     * @private
     */
    private findTriangleIntersection(vertex: [number, number, number]): number {
        return this.triangles.findIndex((triangle) => {
            // for each edge of a spherical triangle
            for (const edgeIndex of triangle) {
                // compute half plane of edge
                const startIndex = this.edges[edgeIndex][0];
                const endIndex = this.edges[edgeIndex][1];
                const start = this.vertices[startIndex];
                const end = this.vertices[endIndex];
                const normal = DelaunayGraph.normalize(DelaunayGraph.crossProduct(start, end));
                // check to see if point is on the correct side of the half plane
                if (vertex[0] * normal[0] + vertex[1] * normal[1] + vertex[2] * normal[2] < 0) {
                    // incorrect side, return false, try next triangle
                    return false;
                }
            }
            // return true, the point is inside the correct side of all edges of the triangle
            // safe to assume the point is inside the triangle
            return true;
        });
    }

    /**
     * Build the initial triangle mesh for the newly inserted vertex.
     * @param vertex The vertex that was inserted into the triangle at triangle index.
     * @param triangleIndex The triangle to insert vertex into.
     * @private
     */
    private buildInitialTriangleMeshForNewVertex(vertex: [number, number, number], triangleIndex: number) {
        this.vertices.push(vertex);
        const threeEdgeIndices = this.triangles[triangleIndex];
        const threeVertexIndices = threeEdgeIndices.map((edgeIndex: number): number => {
            // get vertex index
            return this.edges[edgeIndex][0];
        });
        this.edges.push([this.vertices.length - 1, threeVertexIndices[0]], [threeVertexIndices[1], this.vertices.length - 1]);
        this.edges.push([this.vertices.length - 1, threeVertexIndices[1]], [threeVertexIndices[2], this.vertices.length - 1]);
        this.edges.push([this.vertices.length - 1, threeVertexIndices[2]], [threeVertexIndices[0], this.vertices.length - 1]);
        this.triangles.splice(triangleIndex, 1);
        this.triangles.push([threeEdgeIndices[0], this.edges.length - 7 + 2, this.edges.length - 7 + 1]);
        this.triangles.push([threeEdgeIndices[1], this.edges.length - 7 + 4, this.edges.length - 7 + 3]);
        this.triangles.push([threeEdgeIndices[2], this.edges.length - 7 + 6, this.edges.length - 7 + 5]);
    }

    /**
     * The average point of a triangle.
     * @param triangleIndex The triangle index to find the average point for.
     */
    public getAveragePointOfTriangle(triangleIndex: number): [number, number, number] {
        let vertexCount: number = 0;
        let vertexSum: [number, number, number] = [0, 0, 0];
        for (const edgeIndex of this.triangles[triangleIndex]) {
            for (const vertexIndex of this.edges[edgeIndex]) {
                const vertex = this.vertices[vertexIndex];
                vertexSum = [
                    vertexSum[0] + vertex[0],
                    vertexSum[1] + vertex[1],
                    vertexSum[2] + vertex[2],
                ];
                vertexCount += 1;
            }
        }
        return DelaunayGraph.normalize([
            vertexSum[0] / vertexCount,
            vertexSum[1] / vertexCount,
            vertexSum[2] / vertexCount,
        ]);
    }

    private lawsonFlip(triangleIndex: number) {
        // find complement triangle that's not newly created.
        let complementTriangleIndex: number = -1;
        let complementTriangleEdgeIndex: number = -1;
        let triangleComplementEdgeIndex: number = -1;
        for (let index = 0; index < this.triangles.length - 3; index++) {
            const triangle = this.triangles[index];
            for (const edgeIndex of triangle) {
                let edgeIsReverseToTestTriangle = false;
                for (let testTriangleEdgeIndex = 0; testTriangleEdgeIndex < triangle.length; testTriangleEdgeIndex++) {
                    const testTriangleEdge = this.edges[triangle[testTriangleEdgeIndex]];
                    const triangleEdge = this.edges[edgeIndex];
                    const isComplementEdge = testTriangleEdge[0] === triangleEdge[1] && testTriangleEdge[1] === triangleEdge[0];
                    if (isComplementEdge) {
                        edgeIsReverseToTestTriangle = true;
                        triangleComplementEdgeIndex = triangle[testTriangleEdgeIndex];
                        break;
                    }
                }
                if (edgeIsReverseToTestTriangle) {
                    // found the complement triangle
                    complementTriangleIndex = index;
                    complementTriangleEdgeIndex = edgeIndex;
                }
            }
        }

        // detect if complement triangle was found
        if (complementTriangleIndex >= 0 && complementTriangleEdgeIndex >= 0 && triangleComplementEdgeIndex >= 0) {
            // try to sort the edges counter clockwise, starting with the complement edge
            const triangle = this.triangles[triangleIndex];
            const complementTriangle = this.triangles[complementTriangleIndex];
            const sortedTriangleEdges: number[] = [];
            const sortedComplementTriangleEdges: number[] = [];
            /**
             * Orient the triangle edges starting with complement edge, counter clockwise.
             * @param triangle The triangle, list of edges to orient.
             * @param sortedEdges The sorted list of edges.
             */
            const orientTriangleEdges = (triangle: number[], sortedEdges: number[]) => {
                let startRecording: boolean = false;
                for (let i = 0; i < triangle.length * 2; i++) {
                    const edgeIndex = triangle[i % triangle.length];
                    if (sortedEdges.length >= 3) {
                        break;
                    } else if (startRecording || edgeIndex === triangleComplementEdgeIndex) {
                        if (!startRecording) {
                            startRecording = true;
                        }
                        sortedEdges.push(edgeIndex);
                    }
                }
            }
            orientTriangleEdges(triangle, sortedTriangleEdges);
            orientTriangleEdges(complementTriangle, sortedComplementTriangleEdges);

            // get parallelogram vertex indices
            const vertexIndices: number[] = [
                this.edges[sortedTriangleEdges[0]][1],
                this.edges[sortedTriangleEdges[1]][1],
                this.edges[sortedComplementTriangleEdges[0]][1],
                this.edges[sortedComplementTriangleEdges[1]][1],
            ];

            // determine if a flip is necessary based on the area ratio
            const defaultAreaDiff = Math.max(
                Math.abs(Math.acos(DelaunayGraph.dotProduct(
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[0]], this.vertices[vertexIndices[1]])
                    ),
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[2]], this.vertices[vertexIndices[1]])
                    )
                ))),
                Math.abs(Math.acos(DelaunayGraph.dotProduct(
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[2]], this.vertices[vertexIndices[3]])
                    ),
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[0]], this.vertices[vertexIndices[3]])
                    )
                ))),
                Math.abs(Math.acos(DelaunayGraph.dotProduct(
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[2]], this.vertices[vertexIndices[0]])
                    ),
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[1]], this.vertices[vertexIndices[0]])
                    )
                ))),
                Math.abs(Math.acos(DelaunayGraph.dotProduct(
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[2]], this.vertices[vertexIndices[0]])
                    ),
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[3]], this.vertices[vertexIndices[0]])
                    )
                ))),
                Math.abs(Math.acos(DelaunayGraph.dotProduct(
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[0]], this.vertices[vertexIndices[2]])
                    ),
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[1]], this.vertices[vertexIndices[2]])
                    )
                ))),
                Math.abs(Math.acos(DelaunayGraph.dotProduct(
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[0]], this.vertices[vertexIndices[2]])
                    ),
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[3]], this.vertices[vertexIndices[2]])
                    )
                )))
            );
            const complementAreaDiff = Math.max(
                Math.abs(Math.acos(DelaunayGraph.dotProduct(
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[1]], this.vertices[vertexIndices[2]])
                    ),
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[3]], this.vertices[vertexIndices[2]])
                    )
                ))),
                Math.abs(Math.acos(DelaunayGraph.dotProduct(
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[3]], this.vertices[vertexIndices[0]])
                    ),
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[1]], this.vertices[vertexIndices[0]])
                    )
                ))),
                Math.abs(Math.acos(DelaunayGraph.dotProduct(
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[1]], this.vertices[vertexIndices[1]])
                    ),
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[3]], this.vertices[vertexIndices[1]])
                    )
                ))),
                Math.abs(Math.acos(DelaunayGraph.dotProduct(
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[0]], this.vertices[vertexIndices[1]])
                    ),
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[3]], this.vertices[vertexIndices[1]])
                    )
                ))),
                Math.abs(Math.acos(DelaunayGraph.dotProduct(
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[1]], this.vertices[vertexIndices[3]])
                    ),
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[2]], this.vertices[vertexIndices[3]])
                    )
                ))),
                Math.abs(Math.acos(DelaunayGraph.dotProduct(
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[0]], this.vertices[vertexIndices[3]])
                    ),
                    DelaunayGraph.normalize(
                        DelaunayGraph.subtract(this.vertices[vertexIndices[2]], this.vertices[vertexIndices[3]])
                    )
                )))
            );
            const shouldFlip = defaultAreaDiff > complementAreaDiff;

            // perform lawson flip
            if (shouldFlip) {
                this.edges[triangleComplementEdgeIndex] = [vertexIndices[3], vertexIndices[1]];
                this.triangles[triangleIndex] = [
                    triangleComplementEdgeIndex,
                    sortedTriangleEdges[2],
                    sortedTriangleEdges[1]
                ];
                this.edges[complementTriangleEdgeIndex] = [vertexIndices[1], vertexIndices[3]];
                this.triangles[complementTriangleIndex] = [
                    complementTriangleEdgeIndex,
                    sortedComplementTriangleEdges[2],
                    sortedComplementTriangleEdges[1]
                ];
            }
        }
    }

    /**
     * Perform an incremental insert into the delaunay graph, add random data points and maintain the triangle mesh.
     * @param point An optional point to insert into the delaunay graph. If no point is supplied, a random point will
     * be generated.
     */
    public incrementalInsert(point?: [number, number, number]) {
        let vertex: [number, number, number];
        let triangleIndex: number;
        if (point) {
            vertex = point;
        } else {
            vertex = DelaunayGraph.randomPoint();
        }
        triangleIndex = this.findTriangleIntersection(vertex);

        // add triangle incrementally
        this.buildInitialTriangleMeshForNewVertex(vertex, triangleIndex);

        // perform lawson's flip to balance triangles
        for (let i = 0; i < 3; i++) {
            const triangleIndex = this.triangles.length - 1 - i;
            this.lawsonFlip(triangleIndex);
        }
    }

    /**
     * Get the data from the graph, most likely for rendering.
     * @constructor
     */
    public *GetTriangles(): Generator<DelaunayTriangle> {
        for (let triangleIndex = 0; triangleIndex < this.triangles.length; triangleIndex++) {
            const triangle = this.triangles[triangleIndex];
            const data = new DelaunayTriangle();
            for (let edgeIndex = 0; edgeIndex < triangle.length; edgeIndex++) {
                const edge = this.edges[triangle[edgeIndex]];
                const vertex = this.vertices[edge[0]];
                data.vertices.push(vertex);
            }
            data.centroid = DelaunayGraph.normalize(App.getAveragePoint(data.vertices));
            yield data;
        }
    }

    public getVoronoiGraph(): VoronoiGraph<T> {
        const graph = new VoronoiGraph<T>(this.app);
        // for each vertex which becomes a voronoi cell
        // get vertex, center of a voronoi cell
        for (let vertexIndex = 0; vertexIndex < this.vertices.length; vertexIndex++) {
            // find edges which connect to the vertex
            let points: Array<[number, number, number]> = [];
            let edges: Array<{
                thetaAngle: number,
                a: [number, number, number],
                b: [number, number, number]
            }> = [];

            // build edge data for algebra
            for (let edgeIndex = 0; edgeIndex < this.edges.length; edgeIndex++) {
                const edge = this.edges[edgeIndex];
                const aIndex = edge[0];
                const bIndex = edge[1];
                // skip edges which do not match the voronoi cell vertex/center
                // we want edges starting at the vertex and leaving it
                if (aIndex !== vertexIndex) {
                    continue;
                }

                // get point
                const aVertex = this.vertices[aIndex];
                const bVertex = this.vertices[bIndex];

                // compute the theta angle to orient the edges counter clockwise
                const polarRotation = Quaternion.fromBetweenVectors([0, 0, 1], aVertex);
                const delta = DelaunayGraph.subtract(
                    polarRotation.inverse().mul(Quaternion.fromBetweenVectors([0, 0, 1], bVertex)).rotateVector([0, 0, 1]),
                    polarRotation.inverse().mul(Quaternion.fromBetweenVectors([0, 0, 1], aVertex)).rotateVector([0, 0, 1])
                );
                const thetaAngle = Math.atan2(delta[1], delta[0]);

                // compute the half plane to construct the dual graph, delaunay triangulation -> voronoi tessellation.
                const averagePoint = DelaunayGraph.normalize(App.getAveragePoint([aVertex, bVertex]));
                const rotation = Quaternion.fromAxisAngle(averagePoint, Math.PI / 2);
                const a = rotation.rotateVector(aVertex);
                const b = rotation.rotateVector(bVertex);
                edges.push({
                    a,
                    b,
                    thetaAngle
                });
            }

            if (edges.length > 0) {
                // sort counter clockwise, ascending order.
                edges = edges.sort((a, b) => b.thetaAngle - a.thetaAngle);

                // for each edge, compute a point of the voronoi cell
                for (let i = 0; i < edges.length; i++) {
                    // get counter clockwise edge pair
                    const firstEdge = edges[i % edges.length];
                    const secondEdge = edges[(i + 1) % edges.length];

                    // compute intersection point
                    const firstNormal = DelaunayGraph.normalize(
                        DelaunayGraph.crossProduct(firstEdge.a, firstEdge.b)
                    );
                    const secondNormal = DelaunayGraph.normalize(
                        DelaunayGraph.crossProduct(secondEdge.a, secondEdge.b)
                    );
                    const line = DelaunayGraph.normalize(
                        DelaunayGraph.crossProduct(firstNormal, secondNormal)
                    );
                    const point1 = line;
                    const point2: [number, number, number] = [-line[0], -line[1], -line[2]];
                    if (DelaunayGraph.dotProduct(firstEdge.a, point1) < 0) {
                        points.push(point1);
                    } else {
                        points.push(point2);
                    }
                }

                // sort points counter clockwise
                const averagePoint = this.vertices[vertexIndex];
                const averageTransform = Quaternion.fromBetweenVectors([0, 0, 1], averagePoint).inverse();
                const sortedPoints = points.sort((a, b): number => {
                    const aPoint = averageTransform.rotateVector(a);
                    const bPoint = averageTransform.rotateVector(b);
                    const aTheta = Math.atan2(aPoint[1], aPoint[0]);
                    const bTheta = Math.atan2(bPoint[1], bPoint[0]);
                    return bTheta - aTheta;
                });

                // create voronoi cell
                const cell = new VoronoiCell();
                cell.vertices.push(...sortedPoints);
                cell.centroid = DelaunayGraph.normalize(VoronoiGraph.centroidOfCell(cell));
                cell.radius = cell.vertices.reduce((acc: number, vertex): number => {
                    return Math.max(
                        acc,
                        VoronoiGraph.angularDistance(
                            cell.centroid,
                            vertex,
                            this.app.worldScale
                        )
                    );
                }, 0);
                graph.cells.push(cell);
            }
        }

        // return graph data
        return graph;
    }
}

interface IAutomatedShip extends ICameraState {
    activeKeys: string[];
    app: App;
    isInMissionArea(): boolean;
    hasPirateOrder(): boolean;
    hasPirateCargo(): boolean
}

/**
 * Allows the AI ship to move through the world.
 */
export class PathFinder<T extends IAutomatedShip> {
    public owner: T;
    public points: Array<[number, number, number]> = [];
    public lastStepShouldRotate: boolean = false;

    constructor(owner: T) {
        this.owner = owner;
    }

    public checkNearNode(): boolean {
        if (this.points.length <= 0) {
            return false;
        }

        const distance = VoronoiGraph.angularDistance(
            this.owner.position.clone().rotateVector([0, 0, 1]),
            this.points[0],
            this.owner.app.worldScale
        );
        return this.points.length > 1 ?
            distance < App.VELOCITY_STEP * this.owner.app.worldScale * Math.PI / 2 * 300 :
            distance < App.VELOCITY_STEP * this.owner.app.worldScale * Math.PI / 2 * 100;
    }

    public pathFindingLoop(isAttacking: boolean = false) {
        // disable pathing which is bad
        if (this.points.length >= 2) {
            this.points = this.points.slice(-1);
        }

        // if near a point
        if (this.checkNearNode()) {
            // remove first point
            this.points = this.points.slice(1);
        }

        // if there are more points
        if (this.points.length > 0 && !isAttacking) {
            // move towards points
            const positionPoint = this.owner.position.rotateVector([0, 0, 1]);
            const targetPoint = this.points[0];
            const positionDiff = Quaternion.fromBetweenVectors(positionPoint, targetPoint);
            const distance = VoronoiGraph.angularDistanceQuaternion(positionDiff, this.owner.app.worldScale);

            // compute rotation towards target
            let targetOrientationPoint = this.owner.orientation.clone().inverse()
                .mul(this.owner.position.clone().inverse())
                .mul(Quaternion.fromBetweenVectors([0, 0, 1], targetPoint))
                .rotateVector([0, 0, 1]);
            targetOrientationPoint[2] = 0;
            targetOrientationPoint = DelaunayGraph.normalize(targetOrientationPoint);
            const orientationDiffAngle = Math.atan2(targetOrientationPoint[0], targetOrientationPoint[1]);
            const orientationSpeed = VoronoiGraph.angularDistanceQuaternion(this.owner.orientationVelocity, this.owner.app.worldScale) * (orientationDiffAngle > 0 ? 1 : -1);
            const desiredOrientationSpeed = Math.max(-App.ROTATION_STEP * 10, Math.min(Math.round(
                -5 / Math.PI * orientationDiffAngle
            ), App.ROTATION_STEP * 10));

            // compute speed towards target
            const positionAngularDistance = VoronoiGraph.angularDistanceQuaternion(positionDiff, this.owner.app.worldScale);
            const speed = VoronoiGraph.angularDistanceQuaternion(this.owner.positionVelocity, this.owner.app.worldScale);
            let desiredSpeed = Math.ceil(Math.max(0, Math.min(positionAngularDistance * 10 - speed * 10, 10)));

            // perform rotation and speed up
            // use a class variable to force more tight angle correction, and a more relaxed angle check while moving
            // should result in stop and go less often.
            const shouldRotate = this.lastStepShouldRotate ?
                Math.abs(orientationDiffAngle) > 2 / 180 * Math.PI * (Math.pow(Math.PI - distance, 2) + 1) || Math.abs(desiredOrientationSpeed) >= App.ROTATION_STEP :
                Math.abs(orientationDiffAngle) > 5 / 180 * Math.PI * (Math.pow(Math.PI - distance, 2) + 1) || Math.abs(desiredOrientationSpeed) >= App.ROTATION_STEP;
            this.lastStepShouldRotate = shouldRotate;
            if (!shouldRotate) {
                desiredSpeed = 5;
            }
            const willReachTargetRotation = Math.abs(orientationDiffAngle) / Math.abs(orientationSpeed) < 5;
            const shouldSlowDown = speed > desiredSpeed || shouldRotate;
            const shouldSpeedUp = speed < desiredSpeed + 1 && !shouldRotate;
            if (shouldRotate && desiredOrientationSpeed > orientationSpeed && !willReachTargetRotation && !this.owner.activeKeys.includes("a")) {
                // press a to rotate left
                this.owner.activeKeys.push("a");
            }
            else if (shouldRotate && desiredOrientationSpeed < orientationSpeed && !willReachTargetRotation && !this.owner.activeKeys.includes("d")) {
                // press d to rotate right
                this.owner.activeKeys.push("d");
            } else if (shouldRotate && desiredOrientationSpeed > orientationSpeed && willReachTargetRotation && !this.owner.activeKeys.includes("d")) {
                const aIndex = this.owner.activeKeys.findIndex((key) => key === "a");
                if (aIndex >= 0) {
                    this.owner.activeKeys.splice(aIndex, 1);
                }

                // press d to rotate right to slow down
                this.owner.activeKeys.push("d");
            }
            else if (shouldRotate && desiredOrientationSpeed < orientationSpeed && willReachTargetRotation && !this.owner.activeKeys.includes("a")) {
                const dIndex = this.owner.activeKeys.findIndex((key) => key === "d");
                if (dIndex >= 0) {
                    this.owner.activeKeys.splice(dIndex, 1);
                }

                // press a to rotate left to slow down
                this.owner.activeKeys.push("a");
            }
            else if (!shouldRotate && orientationSpeed > 0 && willReachTargetRotation && !this.owner.activeKeys.includes("a")) {
                const dIndex = this.owner.activeKeys.findIndex((key) => key === "d");
                if (dIndex >= 0) {
                    this.owner.activeKeys.splice(dIndex, 1);
                }

                // press a to rotate left to slow down
                this.owner.activeKeys.push("a");
            }
            else if (!shouldRotate && orientationSpeed < 0 && willReachTargetRotation && !this.owner.activeKeys.includes("d")) {
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
            }

            if (shouldSpeedUp && !this.owner.activeKeys.includes("w")) {
                // press w to speed up
                this.owner.activeKeys.push("w");
            } else if (shouldSlowDown && !this.owner.activeKeys.includes("s")) {
                // press s to slow down
                this.owner.activeKeys.push("s");
            } else {
                // remove w s keys
                const wIndex = this.owner.activeKeys.findIndex((key) => key === "w");
                if (wIndex >= 0) {
                    this.owner.activeKeys.splice(wIndex, 1);
                }
                const sIndex = this.owner.activeKeys.findIndex((key) => key === "s");
                if (sIndex >= 0) {
                    this.owner.activeKeys.splice(sIndex, 1);
                }
            }
        }
    }
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
        if (!(coneHit.success && coneHit.point && coneHit.time && coneHit.time < 60)) {
            // target is moving too fast, cannot hit it
            return null;
        }
        return DelaunayGraph.normalize([
            coneHit.point[0],
            coneHit.point[1],
            0
        ]);
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
        const nearByPirateCrate = this.app.crates.find(c => {
            const cratePosition = c.position.clone().rotateVector([0, 0, 1]);
            const shipPosition = this.owner.position.clone().rotateVector([0, 0, 1]);
            const distance = VoronoiGraph.angularDistance(cratePosition, shipPosition, this.app.worldScale);
            return distance < App.PROJECTILE_SPEED / this.app.worldScale * 60;
        });
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
        if (!(coneHit.success && coneHit.point && coneHit.time && coneHit.time < 60)) {
            // target is moving too fast, cannot hit it
            this.isAttacking = false;
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
            -5 / Math.PI * orientationDiffAngle
        ), App.ROTATION_STEP * 10));

        // perform rotation and speed up
        // use a class variable to force more tight angle correction, and a more relaxed angle check while moving
        // should result in stop and go less often.
        const shouldRotate = this.lastStepShouldRotate ?
            Math.abs(orientationDiffAngle) > 2 / 180 * Math.PI || Math.abs(desiredOrientationSpeed) >= App.ROTATION_STEP :
            Math.abs(orientationDiffAngle) > 5 / 180 * Math.PI || Math.abs(desiredOrientationSpeed) >= App.ROTATION_STEP;
        this.lastStepShouldRotate = shouldRotate;
        const willReachTargetRotation = Math.abs(orientationDiffAngle) / Math.abs(orientationSpeed) < 5;
        if (shouldRotate && desiredOrientationSpeed > orientationSpeed && !willReachTargetRotation && !this.owner.activeKeys.includes("a")) {
            // press a to rotate left
            this.owner.activeKeys.push("a");
        }
        else if (shouldRotate && desiredOrientationSpeed < orientationSpeed && !willReachTargetRotation && !this.owner.activeKeys.includes("d")) {
            // press d to rotate right
            this.owner.activeKeys.push("d");
        } else if (shouldRotate && desiredOrientationSpeed > orientationSpeed && willReachTargetRotation && !this.owner.activeKeys.includes("d")) {
            const aIndex = this.owner.activeKeys.findIndex((key) => key === "a");
            if (aIndex >= 0) {
                this.owner.activeKeys.splice(aIndex, 1);
            }

            // press d to rotate right to slow down
            this.owner.activeKeys.push("d");
        }
        else if (shouldRotate && desiredOrientationSpeed < orientationSpeed && willReachTargetRotation && !this.owner.activeKeys.includes("a")) {
            const dIndex = this.owner.activeKeys.findIndex((key) => key === "d");
            if (dIndex >= 0) {
                this.owner.activeKeys.splice(dIndex, 1);
            }

            // press a to rotate left to slow down
            this.owner.activeKeys.push("a");
        }
        else if (!shouldRotate && orientationSpeed > 0 && willReachTargetRotation && !this.owner.activeKeys.includes("a")) {
            const dIndex = this.owner.activeKeys.findIndex((key) => key === "d");
            if (dIndex >= 0) {
                this.owner.activeKeys.splice(dIndex, 1);
            }

            // press a to rotate left to slow down
            this.owner.activeKeys.push("a");
        }
        else if (!shouldRotate && orientationSpeed < 0 && willReachTargetRotation && !this.owner.activeKeys.includes("d")) {
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

export class ShipyardDock {
    public instance: App;
    public planet: Planet;
    public shipyard: Shipyard;
    public progress: number = 0;
    public shipCost: number = 0;
    public shipType: EShipType | null = null;

    constructor(instance: App, planet: Planet, shipyard: Shipyard) {
        this.instance = instance;
        this.planet = planet;
        this.shipyard = shipyard;
    }

    public beginBuildingOfShip(shipType: EShipType) {
        const shipData = SHIP_DATA.find(i => i.shipType === shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }
        this.shipCost = shipData.cost;
        this.progress = 0;
        this.shipType = shipData.shipType;
    }

    /**
     * Handle the construction of a ship.
     */
    public handleShipyardDockLoop() {
        // handle ship building progress
        if (this.progress < this.shipCost) {
            this.progress += 1;

            if (this.progress >= this.shipCost) {
                // ship is done
                this.shipyard.dockIsDone(this);
            }
        }
    }

    /**
     * Determine if a shipyard is done.
     */
    public isDone(): boolean {
        return this.progress >= this.shipCost;
    }
}

/**
 * A shipyard which spawns ships.
 */
export class Shipyard {
    public instance: App;
    public planet: Planet;
    public docks: ShipyardDock[] = [];
    public numberOfDocks: number = 10;
    public numShipsAvailable: number = 0;
    public shipsAvailable: Record<EShipType, number> = {
        [EShipType.SLOOP]: 0,
        [EShipType.CORVETTE]: 0,
        [EShipType.HIND]: 0
    };
    public shipsBuilding: Record<EShipType, number> = {
        [EShipType.SLOOP]: 0,
        [EShipType.CORVETTE]: 0,
        [EShipType.HIND]: 0
    };

    constructor(instance: App, planet: Planet) {
        this.instance = instance;
        this.planet = planet;
    }

    public getNextShipTypeToBuild(): EShipType {
        if (this.shipsAvailable.SLOOP + this.shipsBuilding.SLOOP < 3) {
            return EShipType.SLOOP;
        }
        if (this.shipsAvailable.CORVETTE + this.shipsBuilding.CORVETTE < 3) {
            return EShipType.CORVETTE;
        }
        return EShipType.HIND;
    }

    /**
     * Build a new ship once in a while.
     */
    public handleShipyardLoop() {
        const nextShipTypeToBuild = this.getNextShipTypeToBuild();
        const shipData = SHIP_DATA.find(i => i.shipType === nextShipTypeToBuild);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }

        // build ship when there is enough wood and enough room
        if (this.planet.wood >= shipData.cost && this.docks.length < this.numberOfDocks) {
            this.buildShip(shipData.shipType);
        }

        // handle each dock
        for (const dock of this.docks) {
            dock.handleShipyardDockLoop();
        }
    }

    /**
     * Begin the process of building a ship.
     */
    public buildShip(shipType: EShipType) {
        const shipData = SHIP_DATA.find(i => i.shipType === shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }

        // give wood to dock and begin building of ship.
        this.planet.wood -= shipData.cost;
        const dock = new ShipyardDock(this.instance, this.planet, this);
        this.docks.push(dock);
        dock.beginBuildingOfShip(shipType);
        this.shipsBuilding[shipType] += 1;
    }

    /**
     * Event handler when a dock is done being built.
     * @param dock
     */
    public dockIsDone(dock: ShipyardDock) {
        if (!dock.shipType) {
            throw new Error("Dock must have ship type to be done");
        }
        this.shipsBuilding[dock.shipType] -= 1;
        this.numShipsAvailable += 1;
        this.shipsAvailable[dock.shipType] += 1;
    }

    /**
     * Player bought a ship from the shipyard.
     */
    public buyShip(account: IGoldAccount, shipType: EShipType, asFaction: boolean = false): Ship {
        // check gold
        const shipPrice = this.quoteShip(shipType, asFaction);
        if (account.gold < shipPrice) {
            throw new Error("Need more gold to buy this ship");
        }

        // perform gold transaction
        account.gold -= shipPrice;
        const goldToTaxes = Math.ceil(shipPrice * 0.5);
        const goldProfit = shipPrice - goldToTaxes;
        this.planet.taxes += goldToTaxes;
        this.planet.gold += goldProfit;

        // spawn the ship
        const doneDockIndex = this.docks.findIndex(d => d.isDone() && d.shipType === shipType);
        const dock = this.docks[doneDockIndex];
        if (!dock.shipType) {
            throw new Error("Dock must have ship type to be done");
        }
        this.docks.splice(doneDockIndex, 1);
        this.numShipsAvailable -= 1;
        this.shipsAvailable[dock.shipType] -= 1;
        return this.planet.createShip(dock.shipType);
    }

    /**
     * The price of the ship to buy.
     */
    public quoteShip(shipType: EShipType, asFaction: boolean = false): number {
        // factions get free ships
        if (asFaction) {
            return 0;
        }

        const shipData = SHIP_DATA.find(i => i.shipType === shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }

        const priceCeiling = Math.ceil(shipData.cost * 3);
        const priceFloor = 0;
        const price = Math.ceil(shipData.cost * (3 / (this.shipsAvailable[shipData.shipType])));
        return Math.max(priceFloor, Math.min(price, priceCeiling));
    }
}

export class Planet implements ICameraState {
    public instance: App;
    public id: string = "";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public color: string = "blue";
    public size: number = 3;
    public settlementProgress: number = 0;
    public settlementLevel: ESettlementLevel = ESettlementLevel.UNTAMED;
    public pathingNode: PathingNode<DelaunayGraph<Planet>> | null = null;
    public resources: EResourceType[];
    public wood: number = 0;
    public gold: number = 0;
    public taxes: number = 0;
    public shipyard: Shipyard;
    private resourceCycle: number = 0;

    /**
     * Number of settlements to colonize a planet.
     */
    public static NUM_SETTLEMENT_PROGRESS_STEPS = 20;

    /**
     * Get the number of ships available.
     */
    public getNumShipsAvailable(shipType: EShipType): number {
        return this.shipyard.shipsAvailable[shipType];
    }

    constructor(instance: App) {
        this.instance = instance;

        // initialize the natural resources
        this.resources = [];
        const numResources = Math.floor(Math.random() * 2 + 1);
        const resourceValues = Object.values(OUTPOST_GOODS);
        for (let i = 0; i < 100 && this.resources.length < numResources; i++) {
            const randomResource = resourceValues[Math.floor(Math.random() * resourceValues.length)];
            if (!this.resources.includes(randomResource)) {
                this.resources.push(randomResource);
            }
        }

        // initialize the shipyard
        this.shipyard = new Shipyard(this.instance, this);
    }

    public handlePlanetLoop() {
        if (this.settlementLevel <= ESettlementLevel.OUTPOST) {
            // planets smaller than colonies do nothing
            return;
        }

        // collect wood
        this.wood += (this.settlementLevel / 5);

        // handle ship building
        this.shipyard.handleShipyardLoop();
    }

    /**
     * The planet will trade with a ship.
     * @param ship
     * @param unload if the ship will not take cargo
     */
    trade(ship: Ship, unload: boolean = false) {
        // a list of items to buy from ship and sell to ship
        let goodsToTake: EResourceType[] = [];
        let goodsToOffer: EResourceType[] = [];

        // different levels of settlements take different goods
        if (this.settlementLevel === ESettlementLevel.UNTAMED) {
            goodsToTake = CAPITAL_GOODS;
            goodsToOffer = [];
        } else if (this.settlementLevel === ESettlementLevel.OUTPOST) {
            goodsToTake = CAPITAL_GOODS;
            goodsToOffer = this.resources;
        } else if (this.settlementLevel === ESettlementLevel.CAPITAL) {
            // the capital will take outpost goods an pirated goods
            goodsToTake = Array.from(new Set([
                ...OUTPOST_GOODS,
                ...ship.cargo.filter(c => c.pirated).map(c => c.resourceType)
            ]));
            goodsToOffer = this.resources;
        }

        // do not take cargo, because the ship is beginning a piracy mission
        if (unload) {
            goodsToOffer = [];
        }

        // trade with the ship
        for (const goodToTake of goodsToTake) {
            const boughtGood = ship.buyGoodFromShip(goodToTake);
            if (boughtGood) {
                const faction = Object.values(this.instance.factions).find(f => f.homeWoldPlanetId === this.id);
                if (faction) {
                    faction.applyLuxuryBuff(this.instance, goodToTake, boughtGood.sourcePlanetId);
                }
            }
        }
        for (let i = 0; i < goodsToOffer.length; i++) {
            if (ship.sellGoodToShip(goodsToOffer[this.resourceCycle % this.resources.length], this.id)) {
                this.resourceCycle = (this.resourceCycle + 1) % this.resources.length;
            }
        }
    }

    /**
     * Create a new ship.
     */
    public spawnShip(account: IGoldAccount, shipType: EShipType, asFaction: boolean = false): Ship {
        // check ship availability
        if (this.shipyard.shipsAvailable[shipType] === 0) {
            throw new Error("No ships available");
        }

        // perform gold transaction, paying 50% taxes to the faction
        return this.shipyard.buyShip(account, shipType, asFaction);
    }

    createShip(shipType: EShipType): Ship {
        // get the position of the planet
        const planetWorld = this.instance.planets.find(p => p.id === this.id);
        if (!planetWorld) {
            throw new Error("Could not find planet to spawn ship");
        }
        const shipPoint = planetWorld.position.rotateVector([0, 0, 1]);

        // get faction of the ship
        const faction = Object.values(this.instance.factions).find(f => f.planetIds.includes(this.id));
        if (!faction) {
            throw new Error("Could not find faction to spawn ship");
        }

        // create ship
        const ship = new Ship(this.instance, shipType);
        ship.faction = faction;
        ship.id = `ship-${this.id}-${faction.getShipAutoIncrement()}`;
        App.addRandomPositionAndOrientationToEntity(ship);
        ship.position = Quaternion.fromBetweenVectors([0, 0, 1], shipPoint);
        ship.color = faction.factionColor;

        // the faction ship
        faction.shipIds.push(ship.id);
        faction.instance.ships.push(ship);
        faction.shipsAvailable[ship.shipType] += 1;

        return ship;
    }
}

export class Order {
    public app: App;
    public owner: Ship;
    public faction: Faction;
    public orderType: EOrderType = EOrderType.ROAM;
    public planetId: string | null = null;
    public expireTicks: number = 0;
    private stage: number = 0;
    private runningTicks: number = 0;

    constructor(app: App, owner: Ship, faction: Faction) {
        this.app = app;
        this.owner = owner;
        this.faction = faction;
    }

    private roam() {
        const homeWorld = this.app.planets.find(planet => planet.id === this.faction.homeWoldPlanetId);
        if (!homeWorld || !homeWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (ROAM)");
        }

        // pick random planets
        if (this.stage === 0 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // explore a random planet
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            const nodes = Object.values(this.app.delaunayGraph.pathingNodes);
            const randomTarget = nodes[Math.floor(Math.random() * nodes.length)];
            this.owner.pathFinding.points = nearestNode.pathToObject(randomTarget);
        } else if (this.stage === 1 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // return to home world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(homeWorld.pathingNode);
        } else if (this.stage === 2 && this.owner.pathFinding.points.length === 0) {
            // end order
            this.owner.removeOrder(this);
        }
    }

    private settle() {
        const shipData = SHIP_DATA.find(s => s.shipType === this.owner.shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }

        if (!this.planetId) {
            throw new Error("Could not find planetId to path to (SETTLE)");
        }
        const colonyWorld = this.app.planets.find(planet => planet.id === this.planetId);
        if (!colonyWorld || !colonyWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (SETTLE)");
        }
        const homeWorld = this.app.planets.find(planet => planet.id === this.faction.homeWoldPlanetId);
        if (!homeWorld || !homeWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (SETTLE)");
        }

        // fly to a specific planet
        if (this.stage === 0 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // return to home world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(homeWorld.pathingNode);
        } else if (this.stage === 1 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // trade with homeWorld
            homeWorld.trade(this.owner);

            // find colony world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(colonyWorld.pathingNode);
        } else if (this.stage === 2 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1

            // update settlement progress
            const wasSettledByAnotherFactionYet = Object.values(this.app.factions).some(f => {
                return !!(this.planetId && f.planetIds.includes(this.planetId) && f.id !== this.faction.id);
            });
            if (!wasSettledByAnotherFactionYet) {
                colonyWorld.settlementProgress = (
                    Math.round(colonyWorld.settlementProgress * Planet.NUM_SETTLEMENT_PROGRESS_STEPS) + shipData.settlementProgressFactor
                ) / Planet.NUM_SETTLEMENT_PROGRESS_STEPS;
                if (colonyWorld.settlementProgress === 1) {
                    colonyWorld.settlementLevel = ESettlementLevel.OUTPOST;
                }
                if (!this.faction.planetIds.includes(this.planetId)) {
                    this.faction.planetIds.push(this.planetId);
                }

                // trade with homeWorld
                colonyWorld.trade(this.owner);
            }

            // return to home world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(homeWorld.pathingNode);
        } else if (this.stage === 3 && this.owner.pathFinding.points.length === 0) {
            // end order
            const index = this.faction.explorationGraph[this.planetId].settlerShipIds.findIndex(s => s === this.owner.id);
            if (index >= 0) {
                this.faction.explorationGraph[this.planetId].settlerShipIds.splice(index, 1);
            }
            this.owner.removeOrder(this);
        }
    }

    private trade() {
        if (!this.planetId) {
            throw new Error("Could not find planetId to path to (TRADE)");
        }
        const colonyWorld = this.app.planets.find(planet => planet.id === this.planetId);
        if (!colonyWorld || !colonyWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (TRADE)");
        }
        const homeWorld = this.app.planets.find(planet => planet.id === this.faction.homeWoldPlanetId);
        if (!homeWorld || !homeWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (TRADE)");
        }

        // fly to a specific planet
        if (this.stage === 0 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // return to home world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(homeWorld.pathingNode);
        } else if (this.stage === 1 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // trade with homeWorld
            homeWorld.trade(this.owner);

            // find colony world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(colonyWorld.pathingNode);
        } else if (this.stage === 2 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // trade with colony world
            colonyWorld.trade(this.owner);

            // return to home world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(homeWorld.pathingNode);
        } else if (this.stage === 3 && this.owner.pathFinding.points.length === 0) {
            // check if order expired
            if (this.runningTicks >= this.expireTicks) {
                // end order
                const index = this.faction.explorationGraph[this.planetId].traderShipIds.findIndex(s => s === this.owner.id);
                if (index >= 0) {
                    this.faction.explorationGraph[this.planetId].traderShipIds.splice(index, 1);
                }
                this.owner.removeOrder(this);
            } else {
                // reset order
                this.stage = 0;
            }
        }
    }

    /**
     * An order automatically created after destroying a ship and picking up its cargo. The order is to return to
     * the home world to deliver the pirated cargo.
     * @private
     */
    private pirate() {
        // pirated cargo is a shortcut to piracy, skipping the assigned planet piracy
        const hasPiratedCargo = this.owner.hasPirateCargo();

        // pirates will wait until the expiration time to pirate ships
        const pirateOrderExpired = this.runningTicks >= this.expireTicks;

        if (!this.planetId && !hasPiratedCargo) {
            throw new Error("Could not find planetId to path to (PIRATE)");
        }
        const colonyWorld = this.app.planets.find(planet => this.planetId && planet.id === this.planetId);
        if ((!colonyWorld || !colonyWorld.pathingNode) && !hasPiratedCargo) {
            throw new Error("Could not find home world for pathing back to home world (PIRATE)");
        }
        const homeWorld = this.app.planets.find(planet => planet.id === this.faction.homeWoldPlanetId);
        if (!homeWorld || !homeWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (PIRATE)");
        }

        // shortcut to returning pirated cargo, required by the player since the player can shortcut the piracy mission
        if (hasPiratedCargo && this.stage < 2) {
            this.stage = 2;
        }

        // fly to a specific planet
        if (this.stage === 0 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // return to home world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(homeWorld.pathingNode);
        } else if (this.stage === 1 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // trade with homeWorld
            homeWorld.trade(this.owner, true);

            // find colony world
            if (colonyWorld && colonyWorld.pathingNode) {
                const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
                const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
                this.owner.pathFinding.points = nearestNode.pathToObject(colonyWorld.pathingNode);
            }
        } else if (this.stage === 2 && (hasPiratedCargo || pirateOrderExpired)) {
            this.stage += 1;

            // wait at colony world
            // get cargo

            // return to home world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(homeWorld.pathingNode);
        } else if (this.stage === 3 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // trade with homeWorld
            homeWorld.trade(this.owner, true);

            // end order
            this.owner.removeOrder(this);
        }
    }

    /**
     * Determine what a ship should do.
     */
    public handleOrderLoop() {
        if (this.orderType === EOrderType.ROAM) {
            this.roam();
        } else if (this.orderType === EOrderType.SETTLE) {
            this.settle();
        } else if (this.orderType === EOrderType.TRADE) {
            this.trade();
        } else if (this.orderType === EOrderType.PIRATE) {
            this.pirate();
        }
        this.runningTicks += 1;
    }

    /**
     * Determine if the ship is in the mission area.
     */
    public isInMissionArea(): boolean {
        switch (this.orderType) {
            case EOrderType.SETTLE:
            case EOrderType.TRADE: {
                // trade and settler ships are suppose to be between the colony world and home world, trading
                const colonyWorld = this.app.planets.find(planet => planet.id === this.planetId);
                if (!colonyWorld || !colonyWorld.pathingNode) {
                    throw new Error("Could not find home world for pathing back to home world (MISSION AREA)");
                }
                const homeWorld = this.app.planets.find(planet => planet.id === this.faction.homeWoldPlanetId);
                if (!homeWorld || !homeWorld.pathingNode) {
                    throw new Error("Could not find home world for pathing back to home world (MISSION AREA)");
                }

                const homeWorldPosition = homeWorld.position.clone().rotateVector([0, 0, 1]);
                const colonyWorldPosition = colonyWorld.position.clone().rotateVector([0, 0, 1]);
                const shipPosition = this.owner.position.clone().rotateVector([0, 0, 1]);
                const distanceOfTradeRoute = VoronoiGraph.angularDistance(homeWorldPosition, colonyWorldPosition, this.app.worldScale);
                const distanceToHomeWorld = VoronoiGraph.angularDistance(homeWorldPosition, shipPosition, this.app.worldScale);
                const distanceToColonyWorld = VoronoiGraph.angularDistance(shipPosition, colonyWorldPosition, this.app.worldScale);
                return distanceToHomeWorld + distanceToColonyWorld < distanceOfTradeRoute * 1.5;
            }
            case EOrderType.PIRATE: {
                // pirate cargo mission area is the home world
                if (this.owner.hasPirateCargo()) {
                    return false;
                }

                // pirates are suppose to be near the colony world, to attack weak trade ships
                const colonyWorld = this.app.planets.find(planet => planet.id === this.planetId);
                if (!colonyWorld || !colonyWorld.pathingNode) {
                    throw new Error("Could not find home world for pathing back to home world (MISSION AREA)");
                }
                const homeWorld = this.app.planets.find(planet => planet.id === this.faction.homeWoldPlanetId);
                if (!homeWorld || !homeWorld.pathingNode) {
                    throw new Error("Could not find home world for pathing back to home world (MISSION AREA)");
                }

                const homeWorldPosition = homeWorld.position.clone().rotateVector([0, 0, 1]);
                const colonyWorldPosition = colonyWorld.position.clone().rotateVector([0, 0, 1]);
                const shipPosition = this.owner.position.clone().rotateVector([0, 0, 1]);
                const distanceOfTradeRoute = VoronoiGraph.angularDistance(homeWorldPosition, colonyWorldPosition, this.app.worldScale);
                const distanceToHomeWorld = VoronoiGraph.angularDistance(homeWorldPosition, shipPosition, this.app.worldScale);
                const distanceToColonyWorld = VoronoiGraph.angularDistance(shipPosition, colonyWorldPosition, this.app.worldScale);
                return distanceToHomeWorld + distanceToColonyWorld < distanceOfTradeRoute * 1.5 && distanceToColonyWorld > distanceToHomeWorld;
            }
            case EOrderType.ROAM:
            default: {
                // roaming and default is always in mission area
                return true;
            }
        }
    }
}

interface ICollidable extends ICameraState {
    size: number;
    factionId: EFaction | null;
}

export class Crate implements ICameraState, ICargoItem, IExpirableTicks, ICollidable {
    public id: string = "";
    public color: string = "brown";
    public size: number = 1;
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public resourceType: EResourceType;
    public sourcePlanetId: string;
    public pirated: boolean = false;
    public maxLife: number = 10 * 60;
    public life: number = 0;
    public factionId: EFaction | null = null;

    constructor(resourceType: EResourceType, sourcePlanetId: string) {
        this.resourceType = resourceType;
        this.sourcePlanetId = sourcePlanetId;
    }
}

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
        const index = this.orders.findIndex(o => o === order);
        if (index >= 0) {
            this.orders.splice(index, 1);
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
            crate.positionVelocity = this.positionVelocity.clone().pow(1 / 10).mul(randomVelocity);
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

export class SmokeCloud implements ICameraState, IExpirable {
    public id: string = "";
    public color: string = "grey";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public size: number = 1;
    public created: Date = new Date(Date.now());
    public expires: Date = new Date(Date.now() + 10000);
}

export class CannonBall implements ICameraState, IExpirableTicks, ICollidable {
    public id: string = "";
    public color: string = "grey";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public size: number = 1;
    public damage: number = 10;
    public maxLife: number = 10 * 5;
    public life: number = 0;
    /**
     * Cannon balls have a faction, to avoid team killing teammates.
     */
    public factionId: EFaction | null;

    constructor(faction: EFaction) {
        this.factionId = faction;
    }
}

interface ICameraState {
    /**
     * The id of the camera.
     */
    id: string;
    /**
     * Position, relative to north pole.
     */
    position: Quaternion;
    /**
     * Position velocity, in north pole reference frame.
     */
    positionVelocity: Quaternion;
    /**
     * Orientation, in north pole reference frame.
     */
    orientation: Quaternion;
    /**
     * Orientation velocity, in north pole reference frame.
     */
    orientationVelocity: Quaternion;
    /**
     * The color of the camera object.
     */
    color: string;
    /**
     * The start of cannon loading.
     */
    cannonLoading?: Date;
    /**
     * The pathfinding component of the drawable.
     */
    pathFinding?: PathFinder<any>;
    /**
     * The size of the object.
     */
    size?: number;
}

/**
 * A combined camera state with original data, for rendering.
 */
interface ICameraStateWithOriginal<T extends ICameraState> extends ICameraState {
    original: T;
}

interface IExpirable {
    /**
     * The date an expirable object was created.
     */
    created: Date;
    /**
     * The date an expirable object will be destroyed.
     */
    expires: Date;
}

interface IDrawable<T extends ICameraState> {
    id: string;
    color: string;
    position: Quaternion;
    positionVelocity: Quaternion;
    orientation: Quaternion;
    orientationVelocity: Quaternion;
    original: T
    projection: { x: number, y: number };
    reverseProjection: { x: number, y: number };
    rotatedPosition: [number, number, number];
    rotation: number;
    distance: number;
}

interface IAppProps {
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
    autoPilotEnabled: boolean;
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
        autoPilotEnabled: true as boolean,
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
    public rotateCameraInterval: any = null;
    private activeKeys: any[] = [];
    private keyDownHandlerInstance: any;
    private keyUpHandlerInstance: any;
    public delaunayGraph: DelaunayGraph<Planet> = new DelaunayGraph<Planet>(this);
    private delaunayData: DelaunayTriangle[] = [];
    public voronoiGraph: VoronoiGraph<Planet> = new VoronoiGraph(this);
    public voronoiShips: VoronoiTree<Ship> = new VoronoiTree(this);
    public voronoiShipsCells: VoronoiCell[] = [];
    public factions: { [key: string]: Faction } = {};
    public ships: Ship[] = [];
    public playerShip: Ship | null = null;
    public crates: Crate[] = [];
    public planets: Planet[] = [];
    public stars: Planet[] = [];
    public smokeClouds: SmokeCloud[] = [];
    public cannonBalls: CannonBall[] = [];
    public luxuryBuffs: LuxuryBuff[] = [];
    public gold: number = 2000;
    public worldScale: number = 2;

    /**
     * Velocity step size of ships.
     */
    public static VELOCITY_STEP: number = 1 / 6000;
    /**
     * The speed of the cannon ball projectiles.
     */
    public static PROJECTILE_SPEED: number = App.VELOCITY_STEP * 60;
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

        const tempShip = new Ship(this, EShipType.SLOOP);
        tempShip.id = "ghost-ship";
        if (this.state.faction) {
            // faction selected, orbit the faction's home world
            const faction = Object.values(this.factions).find(f => f.id === this.state.faction);
            const ship = this.ships.find(s => faction && faction.shipIds.length > 0 && s.id === faction.shipIds[faction.shipIds.length - 1]);
            if (ship) {
                return App.GetCameraState(ship);
            }
        }

        // no faction selected, orbit the world
        const numSecondsToCircle = 120 * this.worldScale;
        const millisecondsPerSecond = 1000;
        const circleSlice = numSecondsToCircle * millisecondsPerSecond;
        const circleFraction = (+new Date() % circleSlice) / circleSlice;
        const angle = circleFraction * (Math.PI * 2);
        tempShip.position = Quaternion.fromAxisAngle([1, 0, 0], -angle);
        return App.GetCameraState(tempShip);
    }

    private rotateDelaunayTriangle(triangle: ICellData, index: number): IDrawableTile {
        const {
            position: cameraPosition,
            orientation: cameraOrientation,
        } = this.getPlayerShip();
        const pointToQuaternion = (v: [number, number, number]): Quaternion => {
            if (v[2] < -0.99) {
                return Quaternion.fromAxisAngle([0, 1, 0], Math.PI * 0.99);
            }
            const q = Quaternion.fromBetweenVectors([0, 0, 1], v);
            return cameraOrientation.clone().inverse()
                .mul(cameraPosition.clone().inverse())
                .mul(q);
        };
        const vertices = triangle.vertices.map(pointToQuaternion);
        let color: string = "red";
        if (index % 4 === 0) {
            color = "red";
        } else if (index % 4 === 1) {
            color = "green";
        } else if (index % 4 === 2) {
            color = "blue";
        } else if (index % 4 === 3) {
            color = "yellow";
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

    private drawPlanet(planetDrawing: IDrawable<Planet>) {
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
                const settlementEntry = Object.entries(ESettlementLevel).find(e => e[1] === planetDrawing.original.settlementLevel);
                planetTitle = `${ownerFaction.id}${settlementEntry ? ` ${settlementEntry[0]}` : ""}`;
            }

            planetX = x * this.state.width;
            planetY = (1 - y) * this.state.height;
            planetVisible = !isReverseSide;
        }

        return (
            <>
                {
                    planetDrawing.original.settlementProgress > 0 && factionColor && (
                        <polygon
                            key={`${planetDrawing.id}-settlement-progress`}
                            transform={`translate(${x * this.state.width},${(1 - y) * this.state.height})`}
                            fill={factionColor}
                            points={`0,0 ${this.getPointsOfAngularProgress.call(this, planetDrawing.original.settlementProgress, size * (this.state.zoom * this.worldScale) * 1.35)}`}
                        />
                    )
                }
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
                {
                    planetVisible && (
                        <>
                            <text
                                key={`${planetDrawing.id}-planet-title`}
                                x={planetX + size * (this.state.zoom * this.worldScale) + 10}
                                y={planetY}
                                fill="white"
                                fontSize="6"
                            >{planetTitle}</text>
                            {
                                planetDrawing.original.resources.map((resource, index) => {
                                    return (
                                        <text
                                            key={`${planetDrawing.id}-planet-resource-${index}`}
                                            x={planetX + size * (this.state.zoom * this.worldScale) + 10}
                                            y={planetY + (index + 1) * 10}
                                            fill="white"
                                            fontSize="6"
                                        >{resource}</text>
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

    private drawCrate(planetDrawing: IDrawable<Crate>) {
        const isReverseSide = planetDrawing.rotatedPosition[2] > 0;
        const x = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).x + 1) * 0.5;
        const y = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).y + 1) * 0.5;
        const distance = planetDrawing.distance;
        const size = 0.1 * Math.max(0, 2 * Math.atan(planetDrawing.original.size / (2 * distance)));
        return (
            <g
                key={planetDrawing.id}
                transform={`translate(${x * this.state.width},${(1 - y) * this.state.height})`}
            >
                <g transform={`scale(0.2)`}>
                    {
                        this.renderItem(planetDrawing.original.resourceType)
                    }
                </g>
                <text
                    stroke="white"
                    x={size * (this.state.zoom * this.worldScale) + 10}
                    y={0}
                >
                    {planetDrawing.original.resourceType}
                </text>
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

    private static MAX_TESSELLATION: number = 4;

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
                );
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
            return v.rotateVector([0, 0, -1]);
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

    private drawDelaunayTessellatedTriangle(tile: DelaunayTile, triangle: ITessellatedTriangle, index: number, arr: ITessellatedTriangle[]) {
        const {
            points,
            rotatedPoints
        } = this.getPointsAndRotatedPoints(triangle.vertices);

        // determine if the triangle is facing the camera, do not draw triangles facing away from the camera
        const triangleNormal = DelaunayGraph.crossProduct(
            DelaunayGraph.subtract(rotatedPoints[1], rotatedPoints[0]),
            DelaunayGraph.subtract(rotatedPoints[2], rotatedPoints[0]),
        );

        const triangleFacingCamera = DelaunayGraph.dotProduct([0, 0, 1], triangleNormal) < 0;

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
                        style={{opacity: 0.1}}
                    />
                    {
                        averageDrawingPoint && (
                            <text
                                x={averageDrawingPoint.x * this.state.width}
                                y={averageDrawingPoint.y * this.state.height}
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

    private drawDelaunayTile(tile: IDrawableTile) {
        const tessellationMesh = Array.from(this.getDelaunayTileTessellation(tile.centroid, tile.vertices));
        return (
            <g key={tile.id}>
                {
                    tessellationMesh.map(this.drawDelaunayTessellatedTriangle.bind(this, tile))
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
            health,
            maxHealth,
            faction
        } = this.ships[shipIndex];
        const shipData = SHIP_DATA.find(i => i.shipType === shipType);
        if (!shipData) {
            throw new Error("Could not find Ship Type");
        }
        const smokeClouds = [
            ...this.smokeClouds.slice(-20)
        ];
        const cannonBalls = [
            ...this.cannonBalls.slice(-100)
        ];

        let clearPathFindingPoints: boolean = false;

        const activeKeys = getActiveKeys();
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
                cannonBall.position = cannonBall.position.clone().mul(cannonBall.positionVelocity.pow(3))
                cannonBall.size = 10;
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
                cannonBall.position = cannonBall.position.clone().mul(cannonBall.positionVelocity.pow(3))
                cannonBall.size = 3;
                cannonBall.damage = 2;
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
            cameraPosition = cameraPosition.clone().mul(cameraPositionVelocity.clone().pow(health / maxHealth));
        }
        if (cameraOrientationVelocity !== Quaternion.ONE) {
            cameraOrientation = cameraOrientation.clone().mul(cameraOrientationVelocity.clone().pow(health / maxHealth));
        }
        if (cameraPosition !== this.ships[shipIndex].position && false) {
            const diffQuaternion = this.ships[shipIndex].position.clone().inverse().mul(cameraPosition.clone());
            cameraOrientation = cameraOrientation.clone().mul(diffQuaternion);
        }
        if (cannonCoolDown > 0) {
            cannonCoolDown -= 1;
        }

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
            collideFn: (ship: Ship, entity: ICollidable) => void
        }> = [{
            arr: this.cannonBalls,
            collideFn(ship: Ship, entity: ICollidable) {
                ship.applyDamage(entity as CannonBall);
            }
        }, {
            arr: this.crates,
            collideFn(ship: Ship, entity: ICollidable) {
                ship.pickUpCargo(entity as Crate);
            }
        }];
        for (const { arr: collidableArray, collideFn } of collidableArrays) {
            const entitiesToRemove = [];
            for (const entity of collidableArray) {
                // get nearby ships
                const position = entity.position.rotateVector([0, 0, 1]);
                const nearByShips = Array.from(this.voronoiShips.listItems(position));

                // compute closest ship
                let bestHit: IHitTest | null = null;
                let bestShip: Ship | null = null;
                for (const nearByShip of nearByShips) {
                    const hit = App.cannonBallCollision(entity, nearByShip, this.worldScale);
                    if (hit.success && hit.time && (!bestHit || (bestHit && bestHit.time && hit.time < bestHit.time))) {
                        bestHit = hit;
                        bestShip = nearByShip;
                    }
                }

                // apply damage
                const teamDamage = bestShip && bestShip.faction && entity.factionId && bestShip.faction.id === entity.factionId;
                if (bestHit && bestShip && !teamDamage) {
                    collideFn(bestShip, entity);
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
                for (const nearByShip of nearByShips) {
                    if (!(nearByShip.faction && ship.faction && nearByShip.faction.id === ship.faction.id)) {
                        if (VoronoiGraph.angularDistance(
                            nearByShip.position.clone().rotateVector([0, 0, 1]),
                            shipPosition,
                            this.worldScale
                        ) < App.PROJECTILE_SPEED / this.worldScale * 100) {
                            nearByEnemyShips.push(nearByShip);
                        }
                    }
                }

                // find closest target
                let closestTarget: Ship | null = null;
                let closestDistance: number | null = null;
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
                }

                // set closest target
                if (closestTarget) {
                    ship.fireControl.targetShipId = closestTarget.id;
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
            // cache a copy of the data since it updates often
            if (this.showVoronoiRef.current.checked) {
                this.voronoiShipsCells = Array.from(this.voronoiShips.listCells());
            }

            this.setState({
                ...this.state,
                showVoronoi: this.showVoronoiRef.current.checked,
            });
        }
    }

    private handleAutoPilotEnabled() {
        if (this.autoPilotEnabledRef.current) {
            this.setState({
                ...this.state,
                autoPilotEnabled: this.autoPilotEnabledRef.current.checked,
            });
        }
    }

    private handleKeyDown(event: KeyboardEvent) {
        if (!this.activeKeys.includes(event.key)) {
            this.activeKeys.push(event.key);
        }
    }

    private handleKeyUp(event: KeyboardEvent) {
        const index = this.activeKeys.findIndex(k => k === event.key);
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

    public generateGoodPoints<T extends ICameraState>(numPoints: number = 10): VoronoiCell[] {
        let delaunayGraph = new DelaunayGraph<T>(this);
        let voronoiGraph = new VoronoiGraph<T>(this);
        delaunayGraph.initialize();
        for (let i = 0; i < numPoints; i++) {
            delaunayGraph.incrementalInsert();
        }
        for (let step = 0; step < 10; step++) {
            voronoiGraph = delaunayGraph.getVoronoiGraph();
            const lloydPoints = voronoiGraph.lloydRelaxation();
            delaunayGraph = new DelaunayGraph<T>(this);
            delaunayGraph.initializeWithPoints(lloydPoints.slice(4));
        }
        voronoiGraph = delaunayGraph.getVoronoiGraph();
        return voronoiGraph.cells.slice(4);
    }

    private buildStars(point: [number, number, number], index: number): Planet {
        const planet = new Planet(this);
        planet.id = `star-${index}`;
        planet.position = Quaternion.fromBetweenVectors([0, 0, 1], point);
        if (index % 5 === 0 || index % 5 === 1) {
            planet.color = "blue";
            planet.size = 5;
        } else if (index % 5 === 2 || index % 5 === 3) {
            planet.color = "yellow";
            planet.size = 2.5;
        } else if (index % 5 === 4) {
            planet.color = "red";
            planet.size = 7.5;
        }
        return planet;
    }

    /**
     * Create a planet.
     * @param planetPoint The point the planet is created at.
     * @param planetI The index of the planet.
     * @private
     */
    private createPlanet(planetPoint: [number, number, number], planetI: number): Planet {
        const planet = new Planet(this);
        planet.id = `planet-${planetI}`;
        planet.position = Quaternion.fromBetweenVectors([0, 0, 1], planetPoint);
        planet.position = planet.position.normalize();
        planet.orientation = Quaternion.fromAxisAngle([0, 0, 1], Math.random() * 2 * Math.PI);
        const colorValue = Math.random();
        if (colorValue > 0.75)
            planet.color = "red";
        else if (colorValue > 0.5)
            planet.color = "green";
        else if (colorValue > 0.25)
            planet.color = "tan";
        if (planetI < 5) {
            planet.size = 10;
            planet.settlementProgress = 1;
            planet.settlementLevel = ESettlementLevel.CAPITAL;
            planet.resources = [...CAPITAL_GOODS];
        }
        planet.pathingNode = this.delaunayGraph.createPathingNode(planet.position.rotateVector([0, 0, 1]));
        return planet;
    }

    componentDidMount() {
        // initialize 3d terrain stuff
        this.delaunayGraph.initialize();
        for (let i = 0; i < 20 * Math.pow(2, this.worldScale); i++) {
            this.delaunayGraph.incrementalInsert();
        }
        for (let step = 0; step < 10 * Math.pow(2, this.worldScale); step++) {
            this.voronoiGraph = this.delaunayGraph.getVoronoiGraph();
            const lloydPoints = this.voronoiGraph.lloydRelaxation();
            this.delaunayGraph = new DelaunayGraph<Planet>(this);
            this.delaunayGraph.initializeWithPoints(lloydPoints);
        }
        this.delaunayData = Array.from(this.delaunayGraph.GetTriangles());
        this.voronoiGraph = this.delaunayGraph.getVoronoiGraph();
        const planetPoints = this.voronoiGraph.lloydRelaxation();

        // initialize stars
        const starPoints = this.generateGoodPoints<Planet>(100);
        this.stars.push(...starPoints.map((cell, index) => this.buildStars.call(this, cell.centroid, index)));
        for (const star of this.stars) {
            this.voronoiGraph.addDrawable(star);
        }

        // initialize planets
        const planets: Planet[] = [];
        let planetI = 0;
        for (const planetPoint of planetPoints) {
            const planet = this.createPlanet(planetPoint, planetI++);
            planets.push(planet);
        }
        this.planets = planets;

        // initialize factions
        const factionDataList = [{
            id: EFaction.DUTCH,
            color: "orange",
            // the forth planet is always in a random location
            // the dutch are a republic which means players can vote on things
            // but the dutch are weaker compared to the kingdoms
            planetId: this.planets[4].id
        }, {
            id: EFaction.ENGLISH,
            color: "red",
            planetId: this.planets[0].id
        }, {
            id: EFaction.FRENCH,
            color: "blue",
            planetId: this.planets[1].id
        }, {
            id: EFaction.PORTUGUESE,
            color: "green",
            planetId: this.planets[2].id
        }, {
            id: EFaction.SPANISH,
            color: "yellow",
            planetId: this.planets[3].id
        }];
        for (const factionData of factionDataList) {
            this.factions[factionData.id] = new Faction(this, factionData.id, factionData.color, factionData.planetId);
            const planet = this.planets.find(p => p.id === factionData.planetId);
            if (planet) {
                for (let numShipsToStartWith = 0; numShipsToStartWith < 10; numShipsToStartWith++) {
                    const shipType = planet.shipyard.getNextShipTypeToBuild();
                    const shipData = SHIP_DATA.find(s => s.shipType === shipType);
                    if (!shipData) {
                        throw new Error("Could not find ship type");
                    }
                    planet.wood += shipData.cost;
                    planet.shipyard.buildShip(shipType);
                    const dock = planet.shipyard.docks[planet.shipyard.docks.length - 1];
                    if (dock) {
                        dock.progress = dock.shipCost - 1;
                    }
                }
            }
        }

        this.rotateCameraInterval = setInterval(this.gameLoop.bind(this), 100);
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
    }

    handleSvgClick(event: React.MouseEvent) {
        // get element coordinates
        const node = event.target as HTMLElement;
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
        }
    }

    private renderGameWorld() {
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
                        this.delaunayData.map(this.rotateDelaunayTriangle.bind(this))
                            .map(this.drawDelaunayTile.bind(this)) :
                        null
                }
                {
                    this.state.showVoronoi ?
                        this.voronoiGraph.cells.map(this.rotateDelaunayTriangle.bind(this))
                            .map(this.drawDelaunayTile.bind(this)) :
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
                        ...((this.state.zoom * this.worldScale) >= 2 ? this.stars : Array.from(this.voronoiGraph.fetchDrawables(
                            this.getPlayerShip().position.rotateVector([0, 0, 1])
                        ))).map(this.rotatePlanet.bind(this))
                            .map(this.convertToDrawable.bind(this, "-star2", 0.5)),
                        ...((this.state.zoom * this.worldScale) >= 4 ? this.stars : Array.from(this.voronoiGraph.fetchDrawables(
                            this.getPlayerShip().position.rotateVector([0, 0, 1])
                        ))).map(this.rotatePlanet.bind(this))
                            .map(this.convertToDrawable.bind(this, "-star3", 0.25)),
                        ...((this.state.zoom * this.worldScale) >= 8 ? this.stars : Array.from(this.voronoiGraph.fetchDrawables(
                            this.getPlayerShip().position.rotateVector([0, 0, 1])
                        ))).map(this.rotatePlanet.bind(this))
                            .map(this.convertToDrawable.bind(this, "-star4", 0.125))
                    ] as Array<IDrawable<Planet>>)
                        .sort((a: any, b: any) => b.distance - a.distance)
                        .map(this.drawStar.bind(this))
                }
                {
                    (this.planets.map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-planet", 1)) as Array<IDrawable<Planet>>)
                        .map(this.drawPlanet.bind(this))
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
                        .map(this.drawCrate.bind(this))
                }
                {
                    (this.ships.map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-ships", 1)) as Array<IDrawable<Ship>>)
                        .map(this.drawShip.bind(this))
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
            <g key="game-controls" id="game-controls">
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
                <g key="game-status" id="game-status" transform={`translate(${this.state.width - 80},0)`}>
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
                <g key="cargo-status" id="cargo-status" transform={`translate(${this.state.width / 2},${this.state.height - 50})`}>
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
                <g key="faction-status" id="faction-status" transform={`translate(${this.state.width - 80},${this.state.height - 80})`}>
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
                <g key="player-status" id="player-status" transform={`translate(0,${this.state.height - 80})`}>
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
            <g key="main-menu" id="main-menu">
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

    private returnToMainMenu() {
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
            <g key="spawn-menu" id="spawn-menu">
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
                                    fill="transparent"
                                    x={x * (index + 0.5) - width / 2}
                                    y={y - 20 - 50}
                                    width={width}
                                    height={height + 50}
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
                <div style={{display: "flex"}}>
                    <div style={{display: "inline-block"}}>
                        <input type="checkbox" ref={this.showNotesRef} checked={this.state.showNotes} onChange={this.handleShowNotes.bind(this)}/>
                        <span>Show Notes</span>
                    </div>
                    <div style={{display: "inline-block"}}>
                        <input type="checkbox" ref={this.showShipsRef} checked={this.state.showShips} onChange={this.handleShowShips.bind(this)}/>
                        <span>Show Ships</span>
                    </div>
                    <div style={{display: "inline-block"}}>
                        <input type="checkbox" ref={this.showItemsRef} checked={this.state.showItems} onChange={this.handleShowItems.bind(this)}/>
                        <span>Show Items</span>
                    </div>
                    <div style={{display: "inline-block"}}>
                        <input type="checkbox" ref={this.showDelaunayRef} checked={this.state.showDelaunay} onChange={this.handleShowDelaunay.bind(this)}/>
                        <span>Show Delaunay</span>
                    </div>
                    <div style={{display: "inline-block"}}>
                        <input type="checkbox" ref={this.showVoronoiRef} checked={this.state.showVoronoi} onChange={this.handleShowVoronoi.bind(this)}/>
                        <span>Show Voronoi</span>
                    </div>
                    <div style={{display: "inline-block"}}>
                        <input type="checkbox" ref={this.autoPilotEnabledRef} checked={this.state.autoPilotEnabled} onChange={this.handleAutoPilotEnabled.bind(this)}/>
                        <span>AutoPilot Enabled</span>
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
                            <li>Add upgradable buildings to island planets, so they can spend profit to make the island planet better.</li>
                            <li>Add tax trading and construction trading between colonies and capitals.</li>
                            <li>Add ability to pirate merchants and raid colonies. -- DONE 4/30/2021</li>
                            <li>Add ability for AI to aim at player. -- DONE 5/1/2021</li>
                            <li>Add AI pirates and pirate hunters.</li>
                            <li>Improve Voronoi generation to improve AI movement.</li>
                            <li>Factions will plan invasions of enemy colonies, merchants, and capitals.</li>
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
                <svg width={this.state.width} height={this.state.height}>
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
