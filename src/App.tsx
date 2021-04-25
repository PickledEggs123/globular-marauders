import React from 'react';
import './App.css';
import Quaternion from 'quaternion';

export interface IHitTest {
    success: boolean;
    point: [number, number, number] | null;
    distance: number | null;
    time: number | null;
}

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
    hullStrength: 60,
    cannons: {
        numCannons: 8,
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
    hullStrength: 30,
    cannons: {
        numCannons: 4,
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
    hullStrength: 20,
    cannons: {
        numCannons: 2,
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
    COCOA = "COCOA",
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
    EResourceType.COCOA,
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

/**
 * A list of planets to explore, used internally by the faction.
 */
interface IExplorationGraphData {
    distance: number;
    settlerShipIds: string[];
    traderShipIds: string[];
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
    public static CalculateBuff(app: App, faction: Faction, resourceType: EResourceType) {
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

        // calculate the gold exchange based on luxuries
        if (totalLuxuries > 0) {
            faction.gold += (factionLuxuries / totalLuxuries) - averageLuxuryConsumption;
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
     * Reset the buff timer.
     */
    public replenish() {
        this.ticks = 0;
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
    public id: string;
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
    public gold: number = 10000;
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
    constructor(instance: App, id: string, factionColor: string, homeWorldPlanetId: string) {
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
                            totalDistance: acc.totalDistance + VoronoiGraph.angularDistance(acc.lastPosition, vertex)
                        };
                    }, {
                        lastPosition: homeWorld.position.rotateVector([0, 0, 1]),
                        totalDistance: 0
                    }).totalDistance;

                    this.explorationGraph[planet.id] = {
                        distance,
                        settlerShipIds: [],
                        traderShipIds: [],
                        planet
                    };
                }
            }
        }
    }

    /**
     * Apply a new luxury buff to a faction.
     * @param resourceType The resource type affects the buff.
     * @param planetId The source world of the goods.
     */
    public applyLuxuryBuff(resourceType: EResourceType, planetId: string) {
        const oldLuxuryBuff = this.luxuryBuffs.find(l => l.matches(resourceType, planetId));
        if (oldLuxuryBuff) {
            oldLuxuryBuff.replenish();
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
        this.instance.gold += 0.2;

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
        const entries = Object.entries(this.explorationGraph)
            .sort((a, b) => a[1].distance - b[1].distance);

        // find worlds to trade
        const tradeWorldEntry = entries.find(entry => {
            // settle new worlds which have not been settled yet
            const roomToTrade = entry[1].settlerShipIds.length < entry[1].planet.resources.length;
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
            const roomToSettleMore = entry[1].settlerShipIds.length <
                Planet.NUM_SETTLEMENT_PROGRESS_STEPS -
                Math.round(entry[1].planet.settlementProgress * Planet.NUM_SETTLEMENT_PROGRESS_STEPS);
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

        if (tradeWorldEntry) {
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
    color: string;
    id: string;
}

interface ICellData {
    vertices: Array<[number, number, number]>;
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
    public color: string = "red";
    public id: string = "";
}

/**
 * A list of voronoi cells.
 */
export class VoronoiGraph<T extends ICameraState> {
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

    /**
     * The angular distance between two points.
     * @param a The first point.
     * @param b The second point.
     */
    public static angularDistance(a: [number, number, number], b: [number, number, number]): number {
        return Math.acos(DelaunayGraph.dotProduct(
            DelaunayGraph.normalize(a),
            DelaunayGraph.normalize(b)
        ));
    }

    /**
     * The angular distance of a quaternion.
     * @param a A quaternion with a angular rotation.
     */
    public static angularDistanceQuaternion(a: Quaternion): number {
        return Math.acos(a.w) * 2;
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
            const cellDistance = VoronoiGraph.angularDistance(position, this.cells[i].centroid);
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
}

/**
 * A class used to render a delaunay triangle tile.
 */
export class DelaunayTile implements IDrawableTile {
    public vertices: Quaternion[] = [];
    public color: string = "red";
    public id: string = "";
}

interface IPathingGraph {
    vertices: Array<[number, number, number]>;
    edges: [number, number][];
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
        if (path.length >= 2 && VoronoiGraph.angularDistance(path[path.length - 1], path[path.length - 2]) < App.VELOCITY_STEP * Math.PI / 2) {
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

    /**
     * Find the closest vertex index to a given position.
     * @param position The position to find.
     * @private
     */
    private findClosestVertexIndex(position: [number, number, number]): number {
        let closestDistance = Number.MAX_VALUE;
        let closestIndex = -1;
        for (let i = 0; i < this.vertices.length; i++) {
            const cellDistance = VoronoiGraph.angularDistance(position, this.vertices[i]);
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
            const cellDistance = VoronoiGraph.angularDistance(position, pathingNode.position);
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
            yield data;
        }
    }

    public getVoronoiGraph(): VoronoiGraph<T> {
        const graph = new VoronoiGraph<T>();
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

                // create voronoi cell
                const cell = new VoronoiCell();
                cell.vertices.push(...points);
                cell.centroid = VoronoiGraph.centroidOfCell(cell);
                cell.radius = cell.vertices.reduce((acc: number, vertex): number => {
                    return Math.max(
                        acc,
                        VoronoiGraph.angularDistance(
                            cell.centroid,
                            vertex
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
}

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
            this.points[0]
        );
        return this.points.length > 1 ? distance < App.VELOCITY_STEP * Math.PI / 2 * 300 : distance < App.VELOCITY_STEP * Math.PI / 2 * 100;
    }

    public pathFindingLoop() {
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
        if (this.points.length > 0) {
            // move towards points
            const positionPoint = this.owner.position.rotateVector([0, 0, 1]);
            const targetPoint = this.points[0];
            const positionDiff = Quaternion.fromBetweenVectors(positionPoint, targetPoint);
            const distance = VoronoiGraph.angularDistanceQuaternion(positionDiff);

            // compute rotation towards target
            let targetOrientationPoint = this.owner.orientation.clone().inverse()
                .mul(this.owner.position.clone().inverse())
                .mul(Quaternion.fromBetweenVectors([0, 0, 1], targetPoint))
                .rotateVector([0, 0, 1]);
            targetOrientationPoint[2] = 0;
            targetOrientationPoint = DelaunayGraph.normalize(targetOrientationPoint);
            const orientationDiffAngle = Math.atan2(targetOrientationPoint[0], targetOrientationPoint[1]);
            const orientationSpeed = VoronoiGraph.angularDistanceQuaternion(this.owner.orientationVelocity) * (orientationDiffAngle > 0 ? 1 : -1);
            const desiredOrientationSpeed = Math.max(-App.ROTATION_STEP * 10, Math.min(Math.round(
                -5 / Math.PI * orientationDiffAngle
            ), App.ROTATION_STEP * 10));

            // compute speed towards target
            const positionAngularDistance = VoronoiGraph.angularDistanceQuaternion(positionDiff);
            const speed = VoronoiGraph.angularDistanceQuaternion(this.owner.positionVelocity);
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

    constructor(instance: App, planet: Planet) {
        this.instance = instance;
        this.planet = planet;
    }

    public getNextShipTypeToBuild(): EShipType {
        if (this.shipsAvailable.SLOOP < 3) {
            return EShipType.SLOOP;
        }
        if (this.shipsAvailable.CORVETTE < 3) {
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
    }

    /**
     * Event handler when a dock is done being built.
     * @param dock
     */
    public dockIsDone(dock: ShipyardDock) {
        if (!dock.shipType) {
            throw new Error("Dock must have ship type to be done");
        }
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
     */
    trade(ship: Ship) {
        // a list of items to buy from ship and sell to ship
        let goodsToTake: EResourceType[] = [];
        let goodsToOffer: EResourceType[] = [];

        // different levels of settlements take different goods
        if (this.settlementLevel === ESettlementLevel.OUTPOST) {
            goodsToTake = CAPITAL_GOODS;
            goodsToOffer = this.resources;
        } else if (this.settlementLevel === ESettlementLevel.CAPITAL) {
            goodsToTake = OUTPOST_GOODS;
            goodsToOffer = this.resources;
        }

        // trade with the ship
        for (const goodToTake of goodsToTake) {
            const boughtGood = ship.buyGoodFromShip(goodToTake);
            if (boughtGood) {
                const faction = Object.values(this.instance.factions).find(f => f.homeWoldPlanetId === this.id);
                if (faction) {
                    faction.applyLuxuryBuff(goodToTake, boughtGood.sourcePlanetId);
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
        const ship = new Ship(shipType);
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
            this.owner.order = null;
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

            // find colony world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(colonyWorld.pathingNode);
        } else if (this.stage === 1 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1

            // update settlement progress
            colonyWorld.settlementProgress = (
                Math.round(colonyWorld.settlementProgress * Planet.NUM_SETTLEMENT_PROGRESS_STEPS) + shipData.settlementProgressFactor
            ) / Planet.NUM_SETTLEMENT_PROGRESS_STEPS;
            if (colonyWorld.settlementProgress === 1) {
                colonyWorld.settlementLevel = ESettlementLevel.OUTPOST;
            }
            if (!this.faction.planetIds.includes(this.planetId)) {
                this.faction.planetIds.push(this.planetId);
            }

            // return to home world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(homeWorld.pathingNode);
        } else if (this.stage === 2 && this.owner.pathFinding.points.length === 0) {
            // end order
            const index = this.faction.explorationGraph[this.planetId].settlerShipIds.findIndex(s => s === this.owner.id);
            if (index >= 0) {
                this.faction.explorationGraph[this.planetId].settlerShipIds.splice(index, 1);
            }
            this.owner.order = null;
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
            throw new Error("Could not find home world for pathing back to home world (ROAM)");
        }

        // fly to a specific planet
        if (this.stage === 0 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // trade with homeWorld
            homeWorld.trade(this.owner);

            // find colony world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(colonyWorld.pathingNode);
        } else if (this.stage === 1 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // trade with colony world
            colonyWorld.trade(this.owner);

            // return to home world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(homeWorld.pathingNode);
        } else if (this.stage === 2 && this.owner.pathFinding.points.length === 0) {
            // check if order expired
            if (this.runningTicks >= this.expireTicks) {
                // end order
                const index = this.faction.explorationGraph[this.planetId].traderShipIds.findIndex(s => s === this.owner.id);
                if (index >= 0) {
                    this.faction.explorationGraph[this.planetId].traderShipIds.splice(index, 1);
                }
                this.owner.order = null;
            } else {
                // reset order
                this.stage = 0;
            }
        }
    }

    handleOrderLoop() {
        if (this.orderType === EOrderType.ROAM) {
            this.roam();
        } else if (this.orderType === EOrderType.SETTLE) {
            this.settle();
        } else if (this.orderType === EOrderType.TRADE) {
            this.trade();
        }
        this.runningTicks += 1;
    }
}

export class Ship implements IAutomatedShip {
    public id: string = "";
    public shipType: EShipType;
    public color: string = "purple";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public cannonLoading?: Date = undefined;
    public activeKeys: string[] = [];
    public pathFinding: PathFinder<Ship> = new PathFinder<Ship>(this);
    public order: Order | null = null;
    public health: number = 1;
    public maxHealth: number = 1;
    private cargo: ICargoItem[] = [];

    constructor(shipType: EShipType) {
        this.shipType = shipType;

        const shipData = SHIP_DATA.find(s => s.shipType === this.shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }
        this.health = shipData.hullStrength;
        this.maxHealth = shipData.hullStrength;
    }

    /**
     * Apply damage to the ship. Damage will slow down the ship and enough damage will destroy it.
     * @param cannonBall
     */
    public applyDamage(cannonBall: CannonBall) {
        this.health = Math.max(0, this.health - 1);
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
                sourcePlanetId
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

export class CannonBall implements ICameraState {
    public id: string = "";
    public color: string = "grey";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public size: number = 1;
    public maxLife: number = 10 * 5;
    public life: number = 0;
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
    private showDelaunayRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    private showVoronoiRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    private autoPilotEnabledRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    public rotateCameraInterval: any = null;
    private activeKeys: any[] = [];
    private keyDownHandlerInstance: any;
    private keyUpHandlerInstance: any;
    public delaunayGraph: DelaunayGraph<Planet> = new DelaunayGraph<Planet>();
    private delaunayData: DelaunayTriangle[] = [];
    public voronoiGraph: VoronoiGraph<Planet> = new VoronoiGraph();
    public voronoiShips: VoronoiGraph<Ship> = new VoronoiGraph();
    public factions: { [key: string]: Faction } = {};
    public ships: Ship[] = [];
    public playerShip: Ship | null = null;
    public planets: Planet[] = [];
    public stars: Planet[] = [];
    public smokeClouds: SmokeCloud[] = [];
    public cannonBalls: CannonBall[] = [];
    public luxuryBuffs: LuxuryBuff[] = [];
    public gold: number = 100000;

    /**
     * Velocity step size of ships.
     */
    public static VELOCITY_STEP: number = 1 / 6000;
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

        const tempShip = new Ship(EShipType.SLOOP);
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
        const numSecondsToCircle = 120;
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
        const vertices = triangle.vertices.map((v): Quaternion => {
            if (v[2] < -0.99) {
                return Quaternion.fromAxisAngle([0, 1, 0], Math.PI * 0.99);
            }
            const q = Quaternion.fromBetweenVectors([0, 0, 1], v);
            return cameraOrientation.clone().inverse()
                .mul(cameraPosition.clone().inverse())
                .mul(q);
        });
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
        const distance = Math.max(MIN_DISTANCE, 5 * (1 - rotatedPosition[2] * size));
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
        const zoom = this.state.zoom;
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
                            points={`0,0 ${this.getPointsOfAngularProgress.call(this, planetDrawing.original.settlementProgress, size * this.state.zoom * 1.35)}`}
                        />
                    )
                }
                <circle
                    key={`${planetDrawing.id}-planet`}
                    cx={x * this.state.width}
                    cy={(1 - y) * this.state.height}
                    r={size * this.state.zoom}
                    fill={planetDrawing.color}
                    stroke="grey"
                    strokeWidth={0.2 * size * this.state.zoom}
                    style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
                />
                {
                    planetVisible && (
                        <>
                            <text
                                key={`${planetDrawing.id}-planet-title`}
                                x={planetX + size * this.state.zoom + 10}
                                y={planetY}
                                fill="white"
                                fontSize="6"
                            >{planetTitle}</text>
                            {
                                planetDrawing.original.resources.map((resource, index) => {
                                    return (
                                        <text
                                            key={`${planetDrawing.id}-planet-resource-${index}`}
                                            x={planetX + size * this.state.zoom + 10}
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
                    r={size * this.state.zoom}
                    fill={planetDrawing.color}
                    stroke="grey"
                    strokeWidth={0.2 * size * this.state.zoom}
                    style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
                />
                <line
                    x1={(x + 0.01) * this.state.width}
                    y1={(1 - y) * this.state.height}
                    x2={(x - 0.01) * this.state.width}
                    y2={(1 - y) * this.state.height}
                    stroke={planetDrawing.color}
                    strokeWidth={0.2 * size * this.state.zoom}
                    style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
                />
                <line
                    x1={x * this.state.width}
                    y1={(1 - y + 0.01) * this.state.height}
                    x2={x * this.state.width}
                    y2={(1 - y - 0.01) * this.state.height}
                    stroke={planetDrawing.color}
                    strokeWidth={0.2 * size * this.state.zoom}
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
     * @private
     */
    private static getPhysicsHull(hullPoints: Array<[number, number]>): Quaternion[] {
        const hullSpherePoints = hullPoints.map(([xi, yi]): [number, number, number] => {
            const x = xi * PHYSICS_SCALE;
            const y = -yi * PHYSICS_SCALE;
            const z = Math.sqrt(1 - Math.pow(x, 2) - Math.pow(y, 2));
            return [x, y, z];
        });
        return hullSpherePoints.map((point) => Quaternion.fromBetweenVectors([0, 0, 1], point));
    }

    /**
     * Draw a physics hull.
     * @param planetDrawing
     * @param size
     * @param hullPoints
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

        const hullQuaternions = App.getPhysicsHull(hullPoints);
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
                points={rotatedHullPoints.map(([x, y]) => `${(x * this.state.zoom + 1) * 0.5 * this.state.width},${(1 - (y * this.state.zoom + 1) * 0.5) * this.state.height}`).join(" ")}
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
                    strokeWidth={0.05 * size * this.state.zoom}
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
                                strokeWidth={0.05 * size * this.state.zoom}
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
                                strokeWidth={0.05 * size * this.state.zoom}
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
        const scale = size * this.state.zoom;

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
            Math.max(this.state.width / 2, this.state.height / 2) * Math.cos((10 / 180 * Math.PI)) * this.state.zoom,
            Math.max(this.state.width / 2, this.state.height / 2) * Math.sin((10 / 180 * Math.PI)) * this.state.zoom,
        ]
        const rightCannonPointBottom: [number, number] = [
            Math.max(this.state.width / 2, this.state.height / 2) * Math.cos(-(10 / 180 * Math.PI)) * this.state.zoom,
            Math.max(this.state.width / 2, this.state.height / 2) * Math.sin(-(10 / 180 * Math.PI)) * this.state.zoom,
        ];
        const leftCannonPointTop: [number, number] = [
            Math.max(this.state.width / 2, this.state.height / 2) * Math.cos(Math.PI - (10 / 180 * Math.PI)) * this.state.zoom,
            Math.max(this.state.width / 2, this.state.height / 2) * Math.sin(Math.PI - (10 / 180 * Math.PI)) * this.state.zoom,
        ]
        const leftCannonPointBottom: [number, number] = [
            Math.max(this.state.width / 2, this.state.height / 2) * Math.cos(Math.PI + (10 / 180 * Math.PI)) * this.state.zoom,
            Math.max(this.state.width / 2, this.state.height / 2) * Math.sin(Math.PI + (10 / 180 * Math.PI)) * this.state.zoom,
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
                                x1={this.state.width * a[0] * this.state.zoom}
                                y1={this.state.height * -a[1] * this.state.zoom}
                                x2={this.state.width * b[0] * this.state.zoom}
                                y2={this.state.height * -b[1] * this.state.zoom}
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
                                    cx={this.state.width * a[0] * this.state.zoom}
                                    cy={this.state.height * -a[1] * this.state.zoom}
                                    stroke="blue"
                                    fill="none"
                                />
                                <text
                                    key={`target-value-${value}`}
                                    textAnchor="middle"
                                    x={this.state.width * a[0] * this.state.zoom}
                                    y={this.state.height * -a[1] * this.state.zoom + 5}
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
                                    strokeWidth={0.05 * size * this.state.zoom}
                                    style={{opacity: 0.3}}
                                />
                                <polygon
                                    points={`-10,-20 ${leftCannonPointBottom[0]},${leftCannonPointBottom[1]} ${leftCannonPointTop[0]},${leftCannonPointTop[1]} -10,20`}
                                    fill="grey"
                                    stroke="white"
                                    strokeWidth={0.05 * size * this.state.zoom}
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
                r={size * this.state.zoom}
                fill={planetDrawing.color}
                stroke="darkgray"
                strokeWidth={0.02 * size * this.state.zoom}
                style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
            />
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

    private static MAX_TESSELLATION: number = 2;

    private *getDelaunayTileTessellation(vertices: Quaternion[], maxStep: number = App.MAX_TESSELLATION, step: number = 0): Generator<ITessellatedTriangle> {
        if (step === maxStep) {
            // max step, return current level of tessellation
            const data: ITessellatedTriangle = {
                vertices,
            };
            return yield data;
        } else if (vertices.length > 3) {
            // perform triangle fan
            for (let i = 1; i < vertices.length - 1; i++) {
                yield * Array.from(this.getDelaunayTileTessellation([
                    vertices[0],
                    vertices[i],
                    vertices[i + 1]
                ], maxStep, step + 1));
            }

        } else {
            // perform triangle tessellation

            // compute mid points used in tessellation
            const midPoints: Quaternion[] = [];
            for (let i = 0; i < vertices.length; i++) {
                const a: Quaternion = vertices[i % vertices.length].clone();
                const b: Quaternion = vertices[(i + 1) % vertices.length].clone();
                const midPoint = Quaternion.fromBetweenVectors(
                    [0, 0, 1],
                    DelaunayGraph.normalize(App.lerp(
                        a.rotateVector([0, 0, 1]),
                        b.rotateVector([0, 0, 1]),
                        0.5
                    ))
                );
                midPoints.push(midPoint);
            }

            // return recursive tessellation of triangle into 4 triangles
            yield * Array.from(this.getDelaunayTileTessellation([
                vertices[0],
                midPoints[0],
                midPoints[2]
            ], maxStep, step + 1));
            yield * Array.from(this.getDelaunayTileTessellation([
                vertices[1],
                midPoints[1],
                midPoints[0]
            ], maxStep, step + 1));
            yield * Array.from(this.getDelaunayTileTessellation([
                vertices[2],
                midPoints[2],
                midPoints[1]
            ], maxStep, step + 1));
            yield * Array.from(this.getDelaunayTileTessellation([
                midPoints[0],
                midPoints[1],
                midPoints[2]
            ], maxStep, step + 1));
        }
    }

    private getDelaunayTileMidPoint(tile: DelaunayTile): {x: number, y: number} {
        const rotatedPoints = tile.vertices.map((v: Quaternion): [number, number, number] => {
            return v.rotateVector([0, 0, 1]);
        });
        const averagePoint = DelaunayGraph.normalize(App.getAveragePoint(rotatedPoints));
        return {
            x: (averagePoint[0] * this.state.zoom + 1) * 0.5,
            y: (averagePoint[1] * this.state.zoom + 1) * 0.5,
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
                x: (p.x - 0.5) * this.state.zoom * 1.1 + 0.5,
                y: (p.y - 0.5) * this.state.zoom * 1.1 + 0.5,
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
        const tessellationMesh = Array.from(this.getDelaunayTileTessellation(tile.vertices));
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
            shipType,
            health,
            maxHealth
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
            if (VoronoiGraph.angularDistanceQuaternion(cameraOrientationVelocity) < Math.PI * App.ROTATION_STEP * 0.9) {
                cameraOrientationVelocity = Quaternion.ONE;
            }
        }
        if (activeKeys.includes("d")) {
            const rotation = Quaternion.fromAxisAngle([0, 0, 1], -Math.PI).pow(App.ROTATION_STEP);
            const rotationDrag = cameraOrientationVelocity.pow(App.ROTATION_DRAG).inverse();
            cameraOrientationVelocity = cameraOrientationVelocity.clone().mul(rotation).mul(rotationDrag);
            if (VoronoiGraph.angularDistanceQuaternion(cameraOrientationVelocity) < Math.PI * App.ROTATION_STEP * 0.9) {
                cameraOrientationVelocity = Quaternion.ONE;
            }
        }
        if (activeKeys.includes("w")) {
            const forward = cameraOrientation.clone().rotateVector([0, 1, 0]);
            const rotation = Quaternion.fromBetweenVectors([0, 0, 1], forward).pow(App.VELOCITY_STEP);
            const rotationDrag = cameraPositionVelocity.pow(App.VELOCITY_DRAG).inverse();
            cameraPositionVelocity = cameraPositionVelocity.clone().mul(rotation).mul(rotationDrag);
            if (VoronoiGraph.angularDistanceQuaternion(cameraPositionVelocity) < Math.PI / 2 * App.VELOCITY_STEP) {
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
            const rotation = cameraPositionVelocity.clone().inverse().pow(App.BRAKE_POWER);
            cameraPositionVelocity = cameraPositionVelocity.clone().mul(rotation);
            if (VoronoiGraph.angularDistanceQuaternion(cameraPositionVelocity) < Math.PI / 2 * App.VELOCITY_STEP) {
                cameraPositionVelocity = Quaternion.ONE;
            }

            // get smoke cloud parameters
            const engineBackwardsPointInitial = rotation.rotateVector([0, 0, 1]);
            engineBackwardsPointInitial[2] = 0;
            const engineBackwardsPoint = DelaunayGraph.normalize(engineBackwardsPointInitial);
            const engineBackwards = Quaternion.fromBetweenVectors([0, 0, 1], engineBackwardsPoint).pow(App.VELOCITY_STEP);

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
        if (activeKeys.includes(" ") && !cameraCannonLoading) {
            cameraCannonLoading = new Date(Date.now());
        }
        if (!activeKeys.includes(" ") && cameraCannonLoading) {
            // cannon fire
            cameraCannonLoading = undefined;

            // fire 8 guns
            for (let i = 0; i < shipData.cannons.numCannons; i++) {
                // pick left or right side
                let jitterPoint: [number, number, number] = [i % 2 === 0 ? -1 : 1, 0, 0];
                // apply random jitter
                jitterPoint[1] += DelaunayGraph.randomInt() * 0.15;
                jitterPoint = DelaunayGraph.normalize(jitterPoint);
                const jitter = Quaternion.fromBetweenVectors([0, 0, 1], jitterPoint).pow(App.VELOCITY_STEP * 60);

                // create a smoke cloud
                const cannonBall = new CannonBall();
                cannonBall.id = `${cameraId}-${Math.floor(Math.random() * 100000000)}`;
                cannonBall.position = cameraPosition.clone();
                cannonBall.positionVelocity = cameraPosition.clone().inverse()
                    .mul(cameraOrientation.clone())
                    .mul(jitter.clone())
                    .mul(cameraPositionVelocity.clone())
                    .mul(cameraOrientation.clone().inverse())
                    .mul(cameraPosition.clone());
                cannonBall.position = cannonBall.position.clone().mul(cannonBall.positionVelocity.pow(3))
                cannonBall.size = 10;
                cannonBalls.push(cannonBall);
            }
        }
        if (activeKeys.includes(" ") && cameraCannonLoading && Date.now() - +cameraCannonLoading > 3000) {
            // cancel cannon fire
            cameraCannonLoading = undefined;
        }
        // if (activeKeys.some(key => ["a", "s", "d", "w", " "].includes(key)) && !isAutomated) {
        //     clearPathFindingPoints = true;
        // }
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

        this.ships[shipIndex].position = cameraPosition;
        this.ships[shipIndex].orientation = cameraOrientation;
        this.ships[shipIndex].positionVelocity = cameraPositionVelocity;
        this.ships[shipIndex].orientationVelocity = cameraOrientationVelocity;
        this.ships[shipIndex].cannonLoading = cameraCannonLoading;
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
     * @private
     */
    public static cannonBallCollision(cannonBall: CannonBall, ship: Ship): IHitTest {
        const shipData = SHIP_DATA.find(s => s.shipType === ship.shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }

        const c = cannonBall.position.clone().rotateVector([0, 0, 1]);
        const d = cannonBall.position.clone().mul(cannonBall.positionVelocity.clone()).rotateVector([0, 0, 1]);
        const cannonBallDistance = VoronoiGraph.angularDistance(c, d);

        let hitPoint: [number, number, number] | null = null;
        let hitDistance: number | null = null;
        const hull = App.getPhysicsHull(shipData.hull).map((q): Quaternion => {
            return ship.position.clone().mul(ship.orientation.clone()).mul(q);
        });
        for (let i = 0; i < hull.length; i++) {
            const a = hull[i % hull.length].rotateVector([0, 0, 1]);
            const b = hull[(i + 1) % hull.length].rotateVector([0, 0, 1]);
            const intercept = App.computeIntercept(a, b, c, d);
            const segmentLength = VoronoiGraph.angularDistance(a, b);
            const interceptSegmentLength = VoronoiGraph.angularDistance(a, intercept) + VoronoiGraph.angularDistance(intercept, b);
            const isInsideSegment = interceptSegmentLength - PHYSICS_SCALE * cannonBall.size * 2 <= segmentLength;
            const interceptVelocityLength = VoronoiGraph.angularDistance(c, intercept) + VoronoiGraph.angularDistance(intercept, d);
            const isInsideVelocity = interceptVelocityLength - PHYSICS_SCALE <= cannonBallDistance;
            const interceptDistance = VoronoiGraph.angularDistance(c, intercept);
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
        
        // expire cannon balls
        const expiredCannonBalls: CannonBall[] = [];
        for (const cannonBall of this.cannonBalls) {
            const isExpired = cannonBall.life >= cannonBall.maxLife;
            if (isExpired) {
                expiredCannonBalls.push(cannonBall);
            }
        }
        for (const expiredCannonBall of expiredCannonBalls) {
            const index = this.cannonBalls.findIndex(s => s === expiredCannonBall);
            if (index >= 0) {
                this.cannonBalls.splice(index, 1);
            }
        }
        // move cannon balls
        for (const cannonBall of this.cannonBalls) {
            cannonBall.position = cannonBall.position.clone().mul(cannonBall.positionVelocity.clone());
            cannonBall.orientation = cannonBall.orientation.clone().mul(cannonBall.orientationVelocity.clone());
            cannonBall.life += 1;
        }
        // handle physics and collision detection
        const cannonBallsToRemove = [];
        for (const cannonBall of this.cannonBalls) {
            // get nearby ships
            const position = cannonBall.position.rotateVector([0, 0, 1]);
            const nearByShips = Array.from(this.voronoiShips.fetchDrawables(position));

            // compute closest ship
            let bestHit: IHitTest | null = null;
            let bestShip: Ship | null = null;
            for (const nearByShip of nearByShips) {
                const hit = App.cannonBallCollision(cannonBall, nearByShip);
                if (hit.success && hit.time && (!bestHit || (bestHit && bestHit.time && hit.time < bestHit.time))) {
                    bestHit = hit;
                    bestShip = nearByShip;
                }
            }

            // apply damage
            if (bestHit && bestShip) {
                bestShip.applyDamage(cannonBall);
                cannonBallsToRemove.push(cannonBall);
            }
        }
        // remove collided cannon balls
        for (const cannonBallToRemove of cannonBallsToRemove) {
            const index = this.cannonBalls.findIndex(c => c === cannonBallToRemove);
            if (index >= 0) {
                this.cannonBalls.splice(index, 1);
            }
        }

        // move player ship if auto pilot is off
        const playerShipIndex = this.ships.findIndex(ship => ship === this.playerShip);
        if (!this.state.autoPilotEnabled && this.playerShip) {
            this.handleShipLoop(playerShipIndex, () => this.activeKeys, false);
        }

        // AI ship loop
        for (let i = 0; i < this.ships.length; i++) {
            const ship = this.ships[i];
            if (!ship.order) {
                const faction = Object.values(this.factions).find(f => f.shipIds.includes(this.ships[i].id));
                if (faction) {
                    ship.order = faction.getOrder(ship);
                }
            }
            const shipOrder = ship.order;
            if (shipOrder) {
                shipOrder.handleOrderLoop();
            }
            ship.pathFinding.pathFindingLoop();
            // ship player ship if autoPilot is not enabled
            if (!(i === playerShipIndex && !this.state.autoPilotEnabled)) {
                this.handleShipLoop(i, () => ship.activeKeys, true);
            }
        }

        // update collision acceleration structures
        for (const ship of this.ships) {
            this.voronoiShips.addDrawable(ship);
        }

        // handle luxury buffs
        for (const resourceType of Object.values(EResourceType)) {
            for (const faction of Object.values(this.factions)) {
                LuxuryBuff.CalculateBuff(this, faction, resourceType);
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

    private static generateGoodPoints<T extends ICameraState>(numPoints: number = 10): Array<[number, number, number]> {
        let delaunayGraph = new DelaunayGraph<T>();
        let voronoiGraph = new VoronoiGraph<T>();
        delaunayGraph.initialize();
        for (let i = 0; i < numPoints; i++) {
            delaunayGraph.incrementalInsert();
        }
        for (let step = 0; step < 10; step++) {
            voronoiGraph = delaunayGraph.getVoronoiGraph();
            const lloydPoints = voronoiGraph.lloydRelaxation();
            delaunayGraph = new DelaunayGraph<T>();
            delaunayGraph.initializeWithPoints(lloydPoints);
        }
        voronoiGraph = delaunayGraph.getVoronoiGraph();
        return voronoiGraph.lloydRelaxation();
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
        for (let i = 0; i < 20; i++) {
            this.delaunayGraph.incrementalInsert();
        }
        for (let step = 0; step < 10; step++) {
            this.voronoiGraph = this.delaunayGraph.getVoronoiGraph();
            const lloydPoints = this.voronoiGraph.lloydRelaxation();
            this.delaunayGraph = new DelaunayGraph<Planet>();
            this.delaunayGraph.initializeWithPoints(lloydPoints);
        }
        this.delaunayData = Array.from(this.delaunayGraph.GetTriangles());
        this.voronoiGraph = this.delaunayGraph.getVoronoiGraph();
        const planetPoints = this.voronoiGraph.lloydRelaxation();

        // initialize ship acceleration structure
        const delaunayShip = new DelaunayGraph<Ship>();
        delaunayShip.initializeWithPoints(planetPoints);
        this.voronoiShips = delaunayShip.getVoronoiGraph();

        // initialize stars
        const starPoints = App.generateGoodPoints<Planet>(100);
        this.stars.push(...starPoints.map(this.buildStars.bind(this)));
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
                for (let numShipsToStartWith = 0; numShipsToStartWith < 5; numShipsToStartWith++) {
                    const dock = new ShipyardDock(this, planet, planet.shipyard);
                    const shipType = planet.shipyard.getNextShipTypeToBuild();
                    const shipData = SHIP_DATA.find(s => s.shipType === shipType);
                    if (!shipData) {
                        throw new Error("Could not find ship type");
                    }
                    dock.shipType = shipType;
                    dock.shipCost = shipData.cost;
                    dock.progress = shipData.cost - 1;
                    planet.shipyard.docks.push(dock);
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
                ((x / size) - 0.5) * 2 / this.state.zoom,
                ((y / size) - 0.5) * 2 / this.state.zoom,
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
                {
                    ([
                        ...(this.state.zoom >= 2 ? this.stars : Array.from(this.voronoiGraph.fetchDrawables(
                            this.getPlayerShip().position.rotateVector([0, 0, 1])
                        ))).map(this.rotatePlanet.bind(this))
                            .map(this.convertToDrawable.bind(this, "-star2", 0.5)),
                        ...(this.state.zoom >= 4 ? this.stars : Array.from(this.voronoiGraph.fetchDrawables(
                            this.getPlayerShip().position.rotateVector([0, 0, 1])
                        ))).map(this.rotatePlanet.bind(this))
                            .map(this.convertToDrawable.bind(this, "-star3", 0.25)),
                        ...(this.state.zoom >= 8 ? this.stars : Array.from(this.voronoiGraph.fetchDrawables(
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
                    (this.ships.map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-ships", 1)) as Array<IDrawable<Ship>>)
                        .map(this.drawShip.bind(this))
                }
                {
                    (this.ships.map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-physics-hulls", 1)) as Array<IDrawable<Ship>>)
                        .map(this.renderPhysicsHull.bind(this))
                }
            </>
        );
    }

    private renderGameControls() {
        return (
            <g key="game-controls" id="game-controls">
                <text x="0" y="30" fill="black">Zoom</text>
                <rect x="0" y="45" width="20" height="20" fill="grey" onClick={this.decrementZoom.bind(this)}/>
                <text x="25" y="60" textAnchor="center">{this.state.zoom}</text>
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
                this.playerShip.pathFinding.points[0]
            ) :
            0;

        const order = this.playerShip && this.playerShip.order;
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
        const original: Ship = new Ship(shipType);
        original.id = id;
        if (factionType) {
            const faction = Object.values(this.factions).find(f => f.id === factionType);
            if (faction) {
                original.color = faction.factionColor;
            }
        }
        return this.convertToDrawable("draw-ships", 1, this.rotatePlanet(original));
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
                            <li>Make cannon balls damage merchant ships.</li>
                            <li>Add ability to pirate merchants and raid colonies.</li>
                            <li>Add AI pirates and pirate hunters.</li>
                            <li>Improve Voronoi generation to improve AI movement.</li>
                            <li>Factions will plan invasions of enemy colonies, merchants, and capitals.</li>
                            <li>Add multiplayer...</li>
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
                        this.renderFactionStatus()
                    }
                </svg>
            </div>
        );
    }
}

export default App;
