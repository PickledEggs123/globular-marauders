import React from 'react';
import './App.css';
import Quaternion from 'quaternion';

export enum ESettlementLevel {
    UNTAMED = 0,
    OUTPOST = 1,
    COLONY = 2,
    TERRITORY = 3,
    PROVINCE = 4,
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

interface IExplorationGraphData {
    distance: number;
    settlerShipIds: string[];
    traderShipIds: string[];
    planet: Planet;
}

enum EFaction {
    DUTCH = "DUTCH",
    ENGLISH = "ENGLISH",
    FRENCH = "FRENCH",
    PORTUGUESE = "PORTUGUESE",
    SPANISH = "SPANISH",
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
    /**
     * A number which produces unique ship id names.
     * @private
     */
    private shipIdAutoIncrement: number = 0;
    /**
     * The number of wood accumulated by the faction, used to build ships.
     */
    public wood: number = 0;
    /**
     * The list of planet priorities for exploration.
     * @private
     */
    public explorationGraph: Record<string, IExplorationGraphData> = {};

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
     * Faction AI loop.
     */
    public handleFactionLoop() {
        this.wood += this.planetIds.length * (1 / 3) + 1;

        // make a new AI ship every minute.
        if (this.wood >= 10 * 60 && this.shipIds.length < 50) {
            this.wood -= 10 * 60;
            this.spawnShip();
        }
    }

    /**
     * Give an order to a ship.
     * @param ship
     */
    public getOrder(ship: Ship): Order {
        const entries = Object.entries(this.explorationGraph);
        entries.sort((a, b) => a[1].distance - b[1].distance);

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

    /**
     * Create a new ship.
     */
    public spawnShip(): Ship {
        // get the position of the faction
        const homeWorldPlanetId = this.homeWoldPlanetId;
        const homeWorld = this.instance.planets.find(p => p.id === homeWorldPlanetId);
        if (!homeWorld) {
            throw new Error("Could not find Faction HomeWorld");
        }
        const shipPoint = homeWorld.position.rotateVector([0, 0, 1]);

        // create ship
        const ship = new Ship();
        ship.id = `ship-${this.id}-${this.shipIdAutoIncrement++}`;
        App.addRandomPositionAndOrientationToEntity(ship);
        ship.position = Quaternion.fromBetweenVectors([0, 0, 1], shipPoint);
        ship.color = this.factionColor;

        // the faction ship
        this.shipIds.push(ship.id);
        this.instance.ships.push(ship);

        return ship;
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
            if (typeof(this.drawableMap[closestIndex]) === "undefined") {
                this.drawableMap[closestIndex] = [];
            }
            this.drawableMap[closestIndex].push(drawable);
        }
    }

    /**
     * Fetch the drawables from the voronoi map.
     * @param position
     */
    *fetchDrawables(position: [number, number, number]): Generator<T> {
        const closestCellIndices: number[] = [];
        for (let i = 0; i < this.cells.length; i++) {
            const cellDistance = Math.acos(DelaunayGraph.dotProduct(
                position,
                this.cells[i].centroid
            )) * 180 / Math.PI;
            if (cellDistance > 80) {
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

export class Planet implements ICameraState {
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
    private resourceCycle: number = 0;

    /**
     * Number of settlements to colonize a planet.
     */
    public static NUM_SETTLEMENT_PROGRESS_STEPS = 5;

    constructor() {
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
            ship.buyGoodFromShip(goodToTake);
        }
        for (let i = 0; i < goodsToOffer.length; i++) {
            if (ship.sellGoodToShip(goodsToOffer[this.resourceCycle % this.resources.length])) {
                this.resourceCycle = (this.resourceCycle + 1) % this.resources.length;
            }
        }
    }
}

export enum EOrderType {
    ROAM = "ROAM",
    SETTLE = "SETTLE",
    TRADE = "TRADE",
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
                Math.round(colonyWorld.settlementProgress * Planet.NUM_SETTLEMENT_PROGRESS_STEPS) + 1
            ) / Planet.NUM_SETTLEMENT_PROGRESS_STEPS;
            if (colonyWorld.settlementProgress === 1) {
                colonyWorld.settlementLevel = ESettlementLevel.OUTPOST;
            }
            this.faction.planetIds.push(this.planetId);

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
                const index = this.faction.explorationGraph[this.planetId].settlerShipIds.findIndex(s => s === this.owner.id);
                if (index >= 0) {
                    this.faction.explorationGraph[this.planetId].settlerShipIds.splice(index, 1);
                }
                this.owner.order = null;
            } else {
                // reset order
                this.stage = 0;
            }
        }
    }

    orderLoop() {
        if (this.orderType === EOrderType.ROAM) {
            this.roam();
        } else if (this.orderType === EOrderType.SETTLE) {
            this.settle();
        } else if (this.orderType === EOrderType.TRADE) {
            this.trade();
        }
    }
}

export class Ship implements IAutomatedShip {
    public id: string = "";
    public color: string = "purple";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public cannonLoading?: Date = undefined;
    public activeKeys: string[] = [];
    public pathFinding: PathFinder<Ship> = new PathFinder<Ship>(this);
    public order: Order | null = null;
    private cargo: EResourceType[] = [];

    /**
     * Buy a good from the ship.
     * @param item
     */
    public buyGoodFromShip(item: EResourceType): boolean {
        const index = this.cargo.findIndex(c => c === item);
        if (index >= 0) {
            this.cargo.splice(index, 1);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Sell a good to the ship.
     * @param item
     */
    public sellGoodToShip(item: EResourceType): boolean {
        if (this.cargo.length < 3) {
            this.cargo.push(item);
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
    public factions: { [key: string]: Faction } = {};
    public ships: Ship[] = [];
    public playerShip: Ship | null = null;
    public planets: Planet[] = [];
    public stars: Planet[] = [];
    public smokeClouds: SmokeCloud[] = [];
    public cannonBalls: SmokeCloud[] = [];

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

        const tempShip = new Ship();
        tempShip.id = "ghost-ship";
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
        const t = (+new Date() - +created) / 1000;
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
        // const distance = 50 * Math.sqrt(
        //     Math.pow(rotatedPosition[0], 2) +
        //     Math.pow(rotatedPosition[1], 2) +
        //     Math.pow(1 - rotatedPosition[2], 2)
        // );
        const distance = 5 * (1 - rotatedPosition[2] * size);
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
        const distance = planetDrawing.distance;
        const size = Math.max(0, 2 * Math.atan((planetDrawing.original.size || 1) / (2 * distance)));

        // extract faction information
        let factionColor: string | null = null;
        const ownerFaction = Object.values(this.factions).find(faction => faction.planetIds.includes(planetDrawing.original.id));
        if (ownerFaction) {
            factionColor = ownerFaction.factionColor;
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
            </>
        );
    }

    private drawStar(planetDrawing: IDrawable<Planet>) {
        const isReverseSide = planetDrawing.rotatedPosition[2] > 0;
        const x = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).x + 1) * 0.5;
        const y = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).y + 1) * 0.5;
        const distance = planetDrawing.distance;
        const size = Math.max(0, 2 * Math.atan((planetDrawing.original.size || 1) / (2 * distance)));
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
    private getShipTargetLines(planetDrawing: IDrawable<Ship>): ITargetLineData {
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

    private drawShip(planetDrawing: IDrawable<Ship>) {
        const isReverseSide = planetDrawing.rotatedPosition[2] > 0;
        const x = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).x + 1) * 0.5;
        const y = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).y + 1) * 0.5;
        const distance = planetDrawing.distance;
        const size = Math.max(0, 2 * Math.atan(1 / (2 * distance)));
        const scale = (size * this.state.zoom) / 100;

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

            targetLineData = this.getShipTargetLines.call(this, planetDrawing);
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
                    <polygon
                        points="0,-30 10,-20 10,25 5,30 0,25 -5,30 -10,25 -10,-20"
                        fill={planetDrawing.color}
                        stroke="grey"
                        strokeWidth={0.05 * size * this.state.zoom}
                        style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
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
        const size = 0.2 * Math.max(0, 2 * Math.atan(10 / (2 * distance)));
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
        } = this.ships[shipIndex];
        const smokeClouds = [
            ...this.smokeClouds.filter(smokeCloud => {
                return +smokeCloud.expires > Date.now();
            }).slice(-20)
        ];
        const cannonBalls = [
            ...this.cannonBalls.filter(cannonBall => {
                return +cannonBall.expires > Date.now();
            }).slice(-100)
        ];

        let clearPathFindingPoints: boolean = false;

        const activeKeys = getActiveKeys();
        if (activeKeys.includes("a")) {
            const rotation = Quaternion.fromAxisAngle([0, 0, 1], Math.PI).pow(App.ROTATION_STEP);
            const rotationDrag = cameraOrientationVelocity.pow(App.ROTATION_DRAG).inverse();
            cameraOrientationVelocity = cameraOrientationVelocity.clone().mul(rotation).mul(rotationDrag);
            if (VoronoiGraph.angularDistanceQuaternion(cameraOrientationVelocity) < Math.PI * 2 * App.ROTATION_STEP) {
                cameraPositionVelocity = Quaternion.ONE;
            }
        }
        if (activeKeys.includes("d")) {
            const rotation = Quaternion.fromAxisAngle([0, 0, 1], -Math.PI).pow(App.ROTATION_STEP);
            const rotationDrag = cameraOrientationVelocity.pow(App.ROTATION_DRAG).inverse();
            cameraOrientationVelocity = cameraOrientationVelocity.clone().mul(rotation).mul(rotationDrag);
            if (VoronoiGraph.angularDistanceQuaternion(cameraOrientationVelocity) < Math.PI * 2 * App.ROTATION_STEP) {
                cameraPositionVelocity = Quaternion.ONE;
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
                .mul(rotation.clone().pow(10))
                .mul(cameraPosition.clone())
                .mul(cameraOrientation.clone());
            smokeCloud.size = 1;
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
                .mul(engineBackwards.clone().pow(10))
                .mul(cameraPosition.clone())
                .mul(cameraOrientation.clone());
            smokeCloudLeft.size = 0.2;
            smokeClouds.push(smokeCloudLeft);

            // make right smoke cloud
            const smokeCloudRight = new SmokeCloud();
            smokeCloudRight.id = `${cameraId}-${Math.floor(Math.random() * 100000000)}`;
            smokeCloudRight.position = cameraPosition.clone();
            smokeCloudLeft.positionVelocity = cameraOrientation.clone().inverse()
                .mul(cameraPosition.clone().inverse())
                .mul(Quaternion.fromAxisAngle([0, 0, 1], -Math.PI / 4))
                .mul(engineBackwards.clone().pow(10))
                .mul(cameraPosition.clone())
                .mul(cameraOrientation.clone());
            smokeCloudRight.size = 0.2;
            smokeClouds.push(smokeCloudRight);
        }
        if (activeKeys.includes(" ") && !cameraCannonLoading) {
            cameraCannonLoading = new Date(Date.now());
        }
        if (!activeKeys.includes(" ") && cameraCannonLoading) {
            // cannon fire
            cameraCannonLoading = undefined;

            // fire 8 guns
            for (let i = 0; i < 8; i++) {
                // pick left or right side
                let jitterPoint: [number, number, number] = [i % 2 === 0 ? -1 : 1, 0, 0];
                // apply random jitter
                jitterPoint[1] += DelaunayGraph.randomInt() * 0.15;
                jitterPoint = DelaunayGraph.normalize(jitterPoint);
                const jitter = Quaternion.fromBetweenVectors([0, 0, 1], jitterPoint).pow(App.VELOCITY_STEP * 400);

                // create a smoke cloud
                const cannonBall = new SmokeCloud();
                cannonBall.id = `${cameraId}-${Math.floor(Math.random() * 100000000)}`;
                cannonBall.position = cameraPosition.clone();
                cannonBall.positionVelocity = cameraOrientation.clone().inverse()
                    .mul(cameraPosition.clone().inverse())
                    .mul(jitter.clone())
                    .mul(cameraPosition.clone())
                    .mul(cameraOrientation.clone());
                cannonBall.size = 1;
                cannonBall.expires = new Date(+new Date() + 1000);
                cannonBalls.push(cannonBall);
            }
        }
        if (activeKeys.includes(" ") && cameraCannonLoading && Date.now() - +cameraCannonLoading > 3000) {
            // cancel cannon fire
            cameraCannonLoading = undefined;
        }
        if (activeKeys.some(key => ["a", "s", "d", "w", " "].includes(key)) && !isAutomated) {
            clearPathFindingPoints = true;
        }
        if (cameraPositionVelocity !== Quaternion.ONE) {
            cameraPosition = cameraPosition.clone().mul(cameraPositionVelocity.clone());
        }
        if (cameraOrientationVelocity !== Quaternion.ONE) {
            cameraOrientation = cameraOrientation.clone().mul(cameraOrientationVelocity.clone());
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

    public gameLoop() {
        // move player ship if auto pilot is off
        const playerShipIndex = this.ships.findIndex(ship => ship === this.playerShip);
        if (!this.state.autoPilotEnabled && this.playerShip) {
            this.handleShipLoop(playerShipIndex, () => this.activeKeys, false);
        }

        // AI ship loop
        for (let i = 0; i < this.ships.length; i++) {
            // ship player ship if autoPilot is not enabled
            if (i === playerShipIndex && !this.state.autoPilotEnabled) {
                continue;
            }
            const ship = this.ships[i];
            if (!ship.order) {
                const faction = Object.values(this.factions).find(f => f.shipIds.includes(this.ships[i].id));
                if (faction) {
                    ship.order = faction.getOrder(ship);
                }
            }
            const shipOrder = ship.order;
            if (shipOrder) {
                shipOrder.orderLoop();
            }
            ship.pathFinding.pathFindingLoop();
            this.handleShipLoop(i, () => ship.activeKeys, true);
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
        if (!event.repeat) {
            this.activeKeys.push(event.key);
        }
    }

    private handleKeyUp(event: KeyboardEvent) {
        if (!event.repeat) {
            const index = this.activeKeys.findIndex(k => k === event.key);
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

    private static buildStars(point: [number, number, number], index: number): Planet {
        const planet = new Planet();
        planet.id = `star-${index}`;
        planet.position = Quaternion.fromBetweenVectors([0, 0, 1], point);
        if (index % 5 === 0 || index % 5 === 1) {
            planet.color = "blue";
            planet.size = 0.5;
        } else if (index % 5 === 2 || index % 5 === 3) {
            planet.color = "yellow";
            planet.size = 0.25;
        } else if (index % 5 === 4) {
            planet.color = "red";
            planet.size = 0.75;
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
        const planet = new Planet();
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

        // initialize stars
        const starPoints = App.generateGoodPoints<Planet>(100);
        this.stars.push(...starPoints.map(App.buildStars.bind(this)));
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
            planetId: this.planets[0].id
        }, {
            id: EFaction.ENGLISH,
            color: "red",
            planetId: this.planets[1].id
        }, {
            id: EFaction.FRENCH,
            color: "blue",
            planetId: this.planets[2].id
        }, {
            id: EFaction.PORTUGUESE,
            color: "green",
            planetId: this.planets[3].id
        }, {
            id: EFaction.SPANISH,
            color: "yellow",
            planetId: this.planets[4].id
        }];
        for (const factionData of factionDataList) {
            this.factions[factionData.id] = new Faction(this, factionData.id, factionData.color, factionData.planetId);
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

            if (this.playerShip) {
                if (event.shiftKey) {
                    this.playerShip.pathFinding.points.push(spherePoint);
                } else {
                    this.playerShip.pathFinding.points = [spherePoint];
                }
            }
        }
    }

    private renderGameWorld() {
        return (
            <>
                <circle
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
                    (this.cannonBalls.map(App.applyKinematics.bind(this))
                        .map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-cannonBalls", 1)) as Array<IDrawable<SmokeCloud>>)
                        .map(this.drawSmokeCloud.bind(this))
                }
                {
                    (this.ships.map(this.rotatePlanet.bind(this))
                        .map(this.convertToDrawable.bind(this, "-ships", 1)) as Array<IDrawable<Ship>>)
                        .map(this.drawShip.bind(this))
                }
            </>
        );
    }

    private renderGameControls() {
        return (
            <g id="game-controls">
                <text x="0" y="30" color="black">Zoom</text>
                <rect x="0" y="45" width="20" height="20" fill="grey" onClick={this.decrementZoom.bind(this)}/>
                <text x="25" y="60" textAnchor="center">{this.state.zoom}</text>
                <rect x="40" y="45" width="20" height="20" fill="grey" onClick={this.incrementZoom.bind(this)}/>
                <text x="5" y="60">-</text>
                <text x="40" y="60">+</text>
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
                <g id="game-status" transform={`translate(${this.state.width - 80},0)`}>
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
                <g id="game-status" transform={`translate(${this.state.width - 80},${this.state.height - 80})`}>
                    <text x="0" y="30" fontSize={8} color="black">Faction: {faction.id}</text>
                    <text x="0" y="45" fontSize={8} color="black">Planet{faction.planetIds.length > 1 ? "s" : ""}: {faction.planetIds.length}</text>
                    <text x="0" y="60" fontSize={8} color="black">Ship{faction.shipIds.length > 1 ? "s" : ""}: {faction.shipIds.length}</text>
                </g>
            );
        } else {
            return null;
        }
    }

    private selectFaction(faction: EFaction) {
        this.setState({
            faction,
            showMainMenu: false,
            showSpawnMenu: true,
        });
    }

    private renderMainMenu() {
        return (
            <g id="main-menu">
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

    private beginSpawnShip() {
        if (this.state.faction) {
            this.setState({
                showSpawnMenu: false
            });
            this.playerShip = this.factions[this.state.faction].spawnShip();
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
    }

    private renderSpawnMenu() {
        const index = 2;
        const x = this.state.width / 5 * (index + 0.5);
        const y = this.state.height / 2 + 50;
        const width = (this.state.width / 5) - 20;
        const height = 40;
        return (
            <g id="spawn-menu">
                <text
                    fill="white"
                    fontSize="28"
                    x={this.state.width / 2}
                    y={this.state.height / 2 - 14}
                    textAnchor="middle"
                >{this.state.faction}</text>
                <rect
                    stroke="white"
                    fill="transparent"
                    x={x - width / 2}
                    y={y - 20}
                    width={width}
                    height={height}
                    onClick={this.beginSpawnShip.bind(this)}
                />
                <text
                    fill="white"
                    x={x}
                    y={y + 5}
                    textAnchor="middle"
                    onClick={this.beginSpawnShip.bind(this)}
                >Spawn</text>
                <rect
                    stroke="white"
                    fill="transparent"
                    x={x - width / 2}
                    y={y - 20 + height}
                    width={width}
                    height={height}
                    onClick={this.returnToMainMenu.bind(this)}
                />
                <text
                    fill="white"
                    x={x}
                    y={y + 5 + height}
                    textAnchor="middle"
                    onClick={this.returnToMainMenu.bind(this)}
                >Back</text>
            </g>
        );
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
                            <li>Create factions which start from a home world and launch ships.</li>
                            <li>Spawn settler ships to colonize other worlds. Each world has upto 3 resources.</li>
                            <li>Spawn merchant ships to trade with colonies. Trading is simplified flying between A and B.</li>
                            <li>Add economics, price rising and falling based on supply and demand, traders will try to go towards important colonies.</li>
                            <li>Add ability to pirate merchants and raid colonies.</li>
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
