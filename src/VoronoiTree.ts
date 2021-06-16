import {ICameraState} from "./Interface";
import {DelaunayGraph, VoronoiCell, VoronoiGraph} from "./Graph";
import Quaternion from "quaternion";
import App from "./App";
import {Planet, Star} from "./Planet";
import {Faction} from "./Faction";
import {Server} from "./Server";

interface IVoronoiTreeNodeParent<T extends ICameraState> {
    nodes: Array<VoronoiTreeNode<T>>;
    app: Server;

    /**
     * How a voronoi tree will break down into smaller parts.
     */
    recursionNodeLevels(): number[];
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
    public neighbors: Array<VoronoiTreeNode<T>> = [];
    public items: T[] = [];
    public app: Server;

    public recursionNodeLevels(): number[] {
        return this.parent.recursionNodeLevels();
    }

    constructor(app: Server, voronoiCell: VoronoiCell, level: number, parent: IVoronoiTreeNodeParent<T>) {
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
        if (this.nodes.length === 0 && this.level < this.recursionNodeLevels().length) {
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
    public* listItems(position: [number, number, number]): Generator<T> {
        // found items
        if (this.nodes.length === 0) {
            return yield* this.items;
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
    public* listCells(): Generator<VoronoiCell> {
        // found leaf node, return voronoi cell
        if (this.level === this.recursionNodeLevels().length) {
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
     * @return int between 0 and n - 1, which is a triangle slice from the centroid to the pair of vertices.
     * @private
     */
    private static getRandomTriangleOfSphericalPolygon<T extends ICameraState>(forNode: VoronoiTreeNode<T>): number {
        const triangleAreasInPolygon: number[] = [];
        // for each pair of vertices
        for (let i = 0; i < forNode.voronoiCell.vertices.length; i++) {
            // create triangle centroid, i, i + 1
            const a = forNode.voronoiCell.centroid;
            const b = forNode.voronoiCell.vertices[i % forNode.voronoiCell.vertices.length];
            const c = forNode.voronoiCell.vertices[(i + 1) % forNode.voronoiCell.vertices.length];
            const nab = DelaunayGraph.crossProduct(a, b);
            const nbc = DelaunayGraph.crossProduct(b, c);
            const nca = DelaunayGraph.crossProduct(c, a);
            const angleA = Math.acos(DelaunayGraph.dotProduct(nab, [-nca[0], -nca[1], -nca[2]]));
            const angleB = Math.acos(DelaunayGraph.dotProduct(nbc, [-nab[0], -nab[1], -nab[2]]));
            const angleC = Math.acos(DelaunayGraph.dotProduct(nca, [-nbc[0], -nbc[1], -nbc[2]]));
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

        // pick random triangle index of voronoi cell
        const randomTriangleInPolygonRandValue = Math.random() * triangleAreasInPolygonSum;
        let randomTriangleInPolygonIndex: number = 0;
        for (let i = 0; i < triangleAreasInPolygonCum.length; i++) {
            if (triangleAreasInPolygonCum[i] > randomTriangleInPolygonRandValue) {
                randomTriangleInPolygonIndex = i;
                break;
            }
        }
        return randomTriangleInPolygonIndex;
    }

    private static rotateVoronoiCell(rotation: Quaternion, polygon: VoronoiCell): VoronoiCell {
        const o = new VoronoiCell();
        o.centroid = rotation.mul(Quaternion.fromBetweenVectors([0, 0, 1], polygon.centroid))
            .rotateVector([0, 0, 1]);
        o.vertex = rotation.mul(Quaternion.fromBetweenVectors([0, 0, 1], polygon.vertex))
            .rotateVector([0, 0, 1]);
        o.vertices = polygon.vertices.map(v => {
            return rotation.mul(Quaternion.fromBetweenVectors([0, 0, 1], v))
                .rotateVector([0, 0, 1]);
        });
        o.radius = polygon.radius;
        o.neighborIndices = polygon.neighborIndices;
        return o;
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
        let vertices: Array<[number, number, number]> = polygon.vertices;
        let tempVertices: Array<[number, number, number]> = [];

        // for each outer line, assume infinite line segment
        for (let outerIndex = 0; outerIndex < forNode.voronoiCell.vertices.length; outerIndex++) {
            const outerA = forNode.voronoiCell.vertices[outerIndex % forNode.voronoiCell.vertices.length];
            const outerB = forNode.voronoiCell.vertices[(outerIndex + 1) % forNode.voronoiCell.vertices.length];
            const outerN = DelaunayGraph.normalize(DelaunayGraph.crossProduct(outerA, outerB));

            // used to clip the polygon, the first goal is to find an inner a and outer b
            let beginClipping: boolean = false;

            // for each inner line segment
            for (let innerIndex = 0; innerIndex < vertices.length || beginClipping; innerIndex++) {
                // compute intersection with line segment and infinite culling line
                const innerA = vertices[innerIndex % vertices.length];
                const innerB = vertices[(innerIndex + 1) % vertices.length];
                const midPoint = DelaunayGraph.normalize(Server.getAveragePoint([innerA, innerB]));
                const innerN = DelaunayGraph.normalize(DelaunayGraph.crossProduct(innerA, innerB));
                const line = DelaunayGraph.normalize(DelaunayGraph.crossProduct(outerN, innerN));
                const intercept: [number, number, number] = DelaunayGraph.dotProduct(line, midPoint) >= 0 ? line : [
                    -line[0],
                    -line[1],
                    -line[2]
                ];

                if (DelaunayGraph.dotProduct(intercept, outerN) > 0.001) {
                    intercept[0] *= -1;
                    intercept[1] *= -1;
                    intercept[2] *= -1;
                }
                if (DelaunayGraph.dotProduct(intercept, outerN) > 0.001) {
                    throw new Error("BAD INTERCEPT");
                }

                // determine if to cull or to cut the polygon
                const isInnerAInside = DelaunayGraph.dotProduct(outerN, innerA) > 0;
                const isInnerBInside = DelaunayGraph.dotProduct(outerN, innerB) > 0;
                if (isInnerAInside && !isInnerBInside) {
                    // moved outside of polygon, begin clipping
                    beginClipping = true;
                    tempVertices.push(innerA, intercept);
                } else if (!isInnerAInside && !isInnerBInside) {
                    // still outside of polygon, skip this segment
                } else if (!isInnerAInside && isInnerBInside) {
                    // moved back inside polygon, perform clip
                    beginClipping = false;
                    // fix duplicate vertex bug caused by a polygon starting on a polygon clip
                    // if there is a triangle 1, 2, 3 with 1 being out of bounds, it would insert intercept 1-2, 2, 3, intercept 3-1
                    // do not insert intercept 1-2 twice, the for loop can continue past the last index
                    if (innerIndex < vertices.length) {
                        tempVertices.push(intercept);
                    }
                } else {
                    tempVertices.push(innerA);
                }
            }
            vertices = tempVertices;
            tempVertices = [];
        }

        // compute new voronoi cell
        const copy = new VoronoiCell();
        copy.vertices = vertices;
        copy.centroid = DelaunayGraph.normalize(Server.getAveragePoint(copy.vertices));
        copy.vertex = polygon.vertex;
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
        copy.neighborIndices = polygon.neighborIndices;
        return copy;
    }

    /**
     * If the voronoi tree node contains the point.
     * @param point The point to test.
     */
    public containsPoint(point: [number, number, number]): boolean {
        return this.voronoiCell.containsPoint(point);
    }

    /**
     * If the point is near by a voronoi node.
     * @param point The point to test.
     * @param radius The radius of the sphere to test.
     */
    public isNearBy(point: [number, number, number], radius: number = 1): boolean {
        return VoronoiGraph.angularDistance(point, this.voronoiCell.centroid, this.app.worldScale) <
            this.voronoiCell.radius + (Math.PI * radius / this.app.worldScale);
    }

    public static createRandomPoint<T extends ICameraState>(forNode: VoronoiTreeNode<T>): [number, number, number] {
        for (let tries = 0; tries < 10; tries++) {
            // pick a random triangle of a polygon
            const randomTriangleIndex = VoronoiTreeNode.getRandomTriangleOfSphericalPolygon<T>(forNode);

            // create a random point between tree points by computing a weighted average
            // create dirichlet distribution
            const dirichletDistribution = [Math.random(), Math.random(), Math.random()];
            const dirichletDistributionSum = dirichletDistribution.reduce((acc, v) => acc + v, 0);
            dirichletDistribution[0] /= dirichletDistributionSum;
            dirichletDistribution[1] /= dirichletDistributionSum;
            dirichletDistribution[2] /= dirichletDistributionSum;

            // get points
            const a = forNode.voronoiCell.centroid;
            const b = forNode.voronoiCell.vertices[randomTriangleIndex % forNode.voronoiCell.vertices.length];
            const c = forNode.voronoiCell.vertices[(randomTriangleIndex + 1) % forNode.voronoiCell.vertices.length];

            // compute weighted average
            const sumPoint = DelaunayGraph.add(
                DelaunayGraph.add([
                    dirichletDistribution[0] * a[0],
                    dirichletDistribution[0] * a[1],
                    dirichletDistribution[0] * a[2],
                ], [
                    dirichletDistribution[1] * b[0],
                    dirichletDistribution[1] * b[1],
                    dirichletDistribution[1] * b[2],
                ]),
                [
                    dirichletDistribution[2] * c[0],
                    dirichletDistribution[2] * c[1],
                    dirichletDistribution[2] * c[2],
                ]
            );
            const randomPoint = DelaunayGraph.normalize(sumPoint);

            if (forNode.containsPoint(randomPoint) || tries === 10 - 1) {
                return randomPoint;
            }
        }
        throw new Error("Failed to generate random point in triangle");
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
        const numRandomPoints = forNode.recursionNodeLevels()[forNode.level];
        for (let i = 0; i < numRandomPoints; i++) {
            randomPointsWithinVoronoiCell.push(VoronoiTreeNode.createRandomPoint(forNode));
        }

        // compute random nodes within voronoi cell, hierarchical voronoi tree.
        let goodPoints: VoronoiCell[] = [];
        let numSteps: number = 10;
        // if (forNode.level === 1) {
        //     goodPoints.push(forNode.voronoiCell);
        //     numSteps = 0;
        // }
        for (let step = 0; step < numSteps || (goodPoints.length !== numRandomPoints && step < numSteps * 2); step++) {
            const delaunay = new DelaunayGraph<T>(forNode.app);
            // this line is needed because inserting vertices could remove old vertices.
            while (randomPointsWithinVoronoiCell.length < numRandomPoints) {
                randomPointsWithinVoronoiCell.push(VoronoiTreeNode.createRandomPoint(forNode));
            }

            // rotate random points to the bottom of the tetrahedron
            const rotationToBottomOfTetrahedron = Quaternion.fromBetweenVectors(forNode.voronoiCell.centroid, [0, 0, -1]);
            delaunay.initializeWithPoints([
                ...delaunay.getTetrahedronPoints(),
                ...randomPointsWithinVoronoiCell.map(p => {
                    return rotationToBottomOfTetrahedron.mul(Quaternion.fromBetweenVectors([0, 0, 1], p)).rotateVector([0, 0, 1]);
                })
            ]);

            // this line is needed because inserting vertices could remove old vertices.
            while (delaunay.numRealVertices() < numRandomPoints) {
                delaunay.incrementalInsert(VoronoiTreeNode.createRandomPoint(forNode));
            }
            const outOfBoundsVoronoiCells = delaunay.getVoronoiGraph().cells;

            // perform sutherland-hodgman polygon clipping
            const points1 = outOfBoundsVoronoiCells.map((polygon) => {
                return VoronoiTreeNode.rotateVoronoiCell(rotationToBottomOfTetrahedron.clone().inverse(), polygon);
            });
            const points2 = points1.map((polygon) => VoronoiTreeNode.polygonClip<T>(forNode, polygon));
            goodPoints = points2.filter((polygon) => forNode.containsPoint(polygon.vertex));
            randomPointsWithinVoronoiCell = goodPoints.reduce((acc, v) => {
                if (acc.every(p => VoronoiGraph.angularDistance(p, v.centroid, 1) > 0.001)) {
                    acc.push(v.centroid);
                }
                return acc;
            }, [] as Array<[number, number, number]>);
        }

        // check number of points
        if (goodPoints.length !== numRandomPoints) {
            throw new Error("Incorrect number of points");
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
    public app: Server;

    public recursionNodeLevels(): number[] {
        return [30, 5, 5];
    }

    constructor(app: Server) {
        this.app = app;
    }

    /**
     * Create initial level 1 nodes for a tree. These are top level nodes.
     * @param parent The parent containing top level nodes, most likely VoronoiTree.
     */
    public createRootNodes<T extends ICameraState>(parent: IVoronoiTreeNodeParent<T>) {
        const nodes: Array<VoronoiTreeNode<T>> = [];

        // compute points
        // const goodPoints = this.app.generateGoodPoints(this.recursionNodeLevels()[0], 3);
        const goodPoints = this.app.generateTessellatedPoints(2, 0);
        for (const point of goodPoints) {
            const node = new VoronoiTreeNode<T>(parent.app, point, 1, parent);
            node.radius = point.vertices.reduce((acc, v) => Math.max(
                acc,
                VoronoiGraph.angularDistance(point.centroid, v, this.app.worldScale)
            ), 0);
            nodes.push(node);
        }
        for (let i = 0; i < goodPoints.length; i++) {
            const node = nodes[i];
            const point = goodPoints[i];
            node.neighbors = point.neighborIndices.map(index => nodes[index]);
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
    public* listItems(position: [number, number, number]): Generator<T> {
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
    public* listCells(): Generator<VoronoiCell> {
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
 * A class which manages feudal governments.
 */
export class FeudalGovernment {
    public static LIST_OF_FEUDAL_OBLIGATION_RATIOS: number[] = [
        1 / 2,
        1 / 3,
        1 / 4,
        1 / 5
    ];

    /**
     * The amount of feudal obligation to the current tier of government. Essentially the tax rate of free resources
     * for the domain of this government.
     */
    feudalObligationRatio: number = 1 / 3;

    /**
     * A function passed by the owning class to help determine the feudal government above this government.
     */
    getLordFeudalGovernment: () => FeudalGovernment | null;

    /**
     * Create an instance of a feudal government.
     * @param getLordFeudalGovernment A function which finds the lord of this feudal government.
     */
    constructor(getLordFeudalGovernment: () => FeudalGovernment | null) {
        this.getLordFeudalGovernment = getLordFeudalGovernment;
    }

    /**
     * The amount of feudal obligation to the lord, the tier above this government. The tax rate of the lord, which
     * this government will pay.
     */
    getCurrentFeudalObligationRatio() {
        if (this.getLordFeudalGovernment) {
            // has feudal lord, pay obligation
            const feudalLord = this.getLordFeudalGovernment();
            if (feudalLord) {
                return feudalLord.feudalObligationRatio;
            }
        }
        // no feudal lord, no obligation
        return 0;
    }
}

/**
 * A voronoi tree node used to generate the terrain of a kingdom. There are 5 duchies in a kingdom.
 */
export class VoronoiCounty extends VoronoiTreeNode<ICameraState> {
    duchy: VoronoiDuchy;
    faction: Faction | null = null;
    planet: Planet | null = null;
    getPlanetId: () => number;
    capital: Planet | null = null;

    constructor(
        app: Server,
        voronoiCell: VoronoiCell,
        level: number,
        parent: IVoronoiTreeNodeParent<ICameraState>,
        duchy: VoronoiDuchy,
        getPlanetId: () => number
    ) {
        super(app, voronoiCell, level, parent);
        this.duchy = duchy;
        this.getPlanetId = getPlanetId;
    }

    public generateTerrain() {
        this.planet = this.app.createPlanet(this.voronoiCell.centroid, this, this.getPlanetId());
    }

    public getNearestPlanet(position: [number, number, number]): Planet {
        if (this.planet) {
            return this.planet;
        }
        throw new Error("Could not find nearest planet");
    }

    public *getPlanets(): Generator<Planet> {
        if (this.planet) {
            yield this.planet;
        }
    }

    public claim(faction: Faction) {
        // set faction
        this.faction = faction;

        // if no capital, make only planet the capital
        if (!this.capital) {
            this.capital = this.planet;
        }

        // handle planet
        if (this.planet) {
            // remove planet from faction
            if (this.faction) {
                const planetIndex = this.faction.planetIds.findIndex(id => this.planet && id === this.planet.id);
                if (planetIndex >= 0) {
                    this.faction.planetIds.splice(planetIndex, 1);
                }
            }
            // add planet to faction
            if (!faction.planetIds.includes(this.planet.id)) {
                faction.planetIds.push(this.planet.id);
            }
        }

        // perform duchy claim
        this.duchy.claim(this, faction);
    }
}

/**
 * A voronoi tree node used to generate the terrain of a kingdom. There are 5 duchies in a kingdom.
 */
export class VoronoiDuchy extends VoronoiTreeNode<ICameraState> {
    kingdom: VoronoiKingdom;
    faction: Faction | null = null;
    capital: VoronoiCounty | null = null;
    counties: VoronoiCounty[] = [];
    stars: Star[] = [];
    getPlanetId: () => number;
    getStarId: () => number;
    color: string = "red";

    constructor(
        app: Server,
        voronoiCell: VoronoiCell,
        level: number,
        parent: IVoronoiTreeNodeParent<ICameraState>,
        kingdom: VoronoiKingdom,
        getPlanetId: () => number,
        getStarId: () => number,
        color: string
    ) {
        super(app, voronoiCell, level, parent);
        this.kingdom = kingdom;
        this.getPlanetId = getPlanetId;
        this.getStarId = getStarId;
        this.color = color;
    }

    public generateTerrain() {
        this.nodes = VoronoiTreeNode.createTreeNodes(this.parent.nodes, this);
        this.counties = this.nodes.map(n => new VoronoiCounty(n.app, n.voronoiCell, n.level, n.parent, this, this.getPlanetId));

        const tempStars = VoronoiTreeNode.createTreeNodes(this.parent.nodes, this);
        this.stars = tempStars.map(s => s.voronoiCell.centroid).map((starPosition) => {
            return this.app.buildStar.call(this.app, starPosition, this.getStarId());
        });
        for (const county of this.counties) {
            county.generateTerrain();
        }
    }

    public getNearestPlanet(position: [number, number, number]): Planet {
        for (const county of this.counties) {
            if (county.voronoiCell.containsPoint(position)) {
                return county.getNearestPlanet(position);
            }
        }
        throw new Error("Could not find nearest planet");
    }

    public *getPlanets(position?: [number, number, number]): Generator<Planet> {
        for (const county of this.counties) {
            if (!position) {
                yield * Array.from(county.getPlanets());
            } else if (position && county.isNearBy(position)) {
                yield * Array.from(county.getPlanets());
            }
        }
    }

    public *getStars(): Generator<Star> {
        yield * this.stars;
    }

    public claim(county: VoronoiCounty, faction: Faction) {
        // set faction
        this.faction = faction;

        // if no capital, make first colony the capital
        if (!this.capital) {
            this.capital = county;
        }

        // perform kingdom claim
        this.kingdom.claim(this, faction);
    }
}

/**
 * A voronoi tree node used to generate the terrain of a kingdom. There are 5 duchies in a kingdom.
 */
export class VoronoiKingdom extends VoronoiTreeNode<ICameraState> {
    terrain: VoronoiTerrain;
    neighborKingdoms: VoronoiKingdom[] = [];
    faction: Faction | null = null;
    capital: VoronoiDuchy | null = null;
    duchies: VoronoiDuchy[] = [];
    getPlanetId: () => number;
    getStarId: () => number;

    constructor(
        app: Server,
        voronoiCell: VoronoiCell,
        level: number,
        parent: IVoronoiTreeNodeParent<ICameraState>,
        terrain: VoronoiTerrain,
        getPlanetId: () => number,
        getStarId: () => number
    ) {
        super(app, voronoiCell, level, parent);
        this.terrain = terrain;
        this.getPlanetId = getPlanetId;
        this.getStarId = getStarId;
    }

    public generateTerrain() {
        this.nodes = VoronoiTreeNode.createTreeNodes(this.parent.nodes, this);
        this.duchies = this.nodes.map((n, index) => {
            let color: string;
            if (index % 3 === 0)
                color = "#ff4444";
            else if (index % 3 === 1)
                color = "#44ff44";
            else
                color = "#4444ff";
            return new VoronoiDuchy(n.app, n.voronoiCell, n.level, n.parent, this, this.getPlanetId ,this.getStarId, color)
        });
        for (const duchy of this.duchies) {
            duchy.generateTerrain();
        }
    }

    public getNearestPlanet(position: [number, number, number]): Planet {
        for (const duchy of this.duchies) {
            if (duchy.voronoiCell.containsPoint(position)) {
                return duchy.getNearestPlanet(position);
            }
        }
        throw new Error("Could not find nearest planet");
    }

    public *getPlanets(position?: [number, number, number]): Generator<Planet> {
        for (const duchy of this.duchies) {
            if (!position) {
                yield * Array.from(duchy.getPlanets());
            } else if (position && duchy.isNearBy(position)) {
                yield * Array.from(duchy.getPlanets(position));
            }
        }
    }

    public *getStars(position?: [number, number, number], radius: number = 1): Generator<Star> {
        for (const duchy of this.duchies) {
            if (!position) {
                yield * Array.from(duchy.getStars());
            } else if (position && duchy.isNearBy(position, radius)) {
                yield * Array.from(duchy.getStars());
            }
        }
    }

    public claim(duchy: VoronoiDuchy, faction: Faction) {
        // set faction
        this.faction = faction;

        // if no capital, make first colony the capital
        if (!this.capital) {
            this.capital = duchy;
        }
    }
}

/**
 * A voronoi tree used to generate terrain. There are 20 kingdoms.
 */
export class VoronoiTerrain extends VoronoiTree<ICameraState> {
    kingdoms: VoronoiKingdom[] = [];
    recursionNodeLevels(): number[] {
        return [20, 3, 3];
    }

    planetId: number = 0;
    getPlanetId = () => {
        const id = this.planetId;
        this.planetId += 1;
        return id;
    }

    starId: number = 0;
    getStarId = () => {
        const id = this.starId;
        this.starId += 1;
        return id;
    }

    public generateTerrain() {
        this.nodes = this.createRootNodes(this);
        this.kingdoms = this.nodes.map(n => new VoronoiKingdom(n.app, n.voronoiCell, n.level, n.parent, this, this.getPlanetId, this.getStarId));
        for (const kingdom of this.kingdoms) {
            kingdom.neighborKingdoms = kingdom.neighbors.map(n => n as VoronoiKingdom);
        }
        for (const kingdom of this.kingdoms) {
            kingdom.generateTerrain();
        }
    }

    public getNearestPlanet(position: [number, number, number]): Planet {
        for (const kingdom of this.kingdoms) {
            if (kingdom.voronoiCell.containsPoint(position)) {
                return kingdom.getNearestPlanet(position);
            }
        }
        throw new Error("Could not find nearest planet");
    }

    public *getPlanets(position?: [number, number, number]): Generator<Planet> {
        for (const kingdom of this.kingdoms) {
            if (!position) {
                yield * Array.from(kingdom.getPlanets());
            } else if (position && kingdom.isNearBy(position)) {
                yield * Array.from(kingdom.getPlanets(position));
            }
        }
    }

    public *getStars(position?: [number, number, number], radius: number = 1): Generator<Star> {
        for (const kingdom of this.kingdoms) {
            if (!position) {
                yield * Array.from(kingdom.getStars());
            } else if (position && kingdom.isNearBy(position, radius)) {
                yield * Array.from(kingdom.getStars(position, radius));
            }
        }
    }
}