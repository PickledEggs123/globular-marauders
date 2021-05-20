import {ICameraState} from "./Interface";
import {DelaunayGraph, VoronoiCell, VoronoiGraph} from "./Graph";
import Quaternion from "quaternion";
import App from "./App";
import {Planet} from "./Planet";

interface IVoronoiTreeNodeParent<T extends ICameraState> {
    nodes: Array<VoronoiTreeNode<T>>;
    app: App;

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
    public items: T[] = [];
    public app: App;

    public recursionNodeLevels(): number[] {
        return this.parent.recursionNodeLevels();
    }

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

    public static createRandomPoint<T extends ICameraState>(forNode: VoronoiTreeNode<T>): [number, number, number] {
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
        return point.rotateVector([0, 0, 1]);
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
        for (let step = 0; step < 10; step++) {
            const delaunay = new DelaunayGraph<T>(forNode.app);
            delaunay.initializeWithPoints(randomPointsWithinVoronoiCell);
            // this line is needed because inserting vertices could remove old vertices.
            while (delaunay.numRealVertices() < numRandomPoints + 4) {
                delaunay.incrementalInsert();
            }
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

    public recursionNodeLevels(): number[] {
        return [15, 15, 15];
    }

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
        const goodPoints = this.app.generateGoodPoints(this.recursionNodeLevels()[0], 3);
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
 * A voronoi tree node used to generate the terrain of a kingdom. There are 5 duchies in a kingdom.
 */
export class VoronoiCounty extends VoronoiTreeNode<ICameraState> {
    planet: Planet | null = null;
    getPlanetId: () => number;

    constructor(app: App, voronoiCell: VoronoiCell, level: number, parent: IVoronoiTreeNodeParent<ICameraState>, getPlanetId: () => number) {
        super(app, voronoiCell, level, parent);
        this.getPlanetId = getPlanetId;
    }

    public generateTerrain() {
        this.planet = this.app.createPlanet(this.voronoiCell.centroid, this.getPlanetId());
    }

    public *getPlanets(): Generator<Planet> {
        if (this.planet) {
            yield this.planet;
        }
    }
}

/**
 * A voronoi tree node used to generate the terrain of a kingdom. There are 5 duchies in a kingdom.
 */
export class VoronoiDuchy extends VoronoiTreeNode<ICameraState> {
    counties: VoronoiCounty[] = [];
    stars: Planet[] = [];
    getPlanetId: () => number;
    getStarId: () => number;

    constructor(
        app: App,
        voronoiCell: VoronoiCell,
        level: number,
        parent: IVoronoiTreeNodeParent<ICameraState>,
        getPlanetId: () => number,
        getStarId: () => number,
    ) {
        super(app, voronoiCell, level, parent);
        this.getPlanetId = getPlanetId;
        this.getStarId = getStarId;
    }

    public generateTerrain() {
        this.nodes = VoronoiTreeNode.createTreeNodes(this.parent.nodes, this);
        this.counties = this.nodes.map(n => new VoronoiCounty(n.app, n.voronoiCell, n.level, n.parent, this.getPlanetId));

        const tempStars = VoronoiTreeNode.createTreeNodes(this.parent.nodes, this);
        this.stars = tempStars.map(s => s.voronoiCell.centroid).map((starPosition) => {
            return this.app.buildStar.call(this.app, starPosition, this.getStarId());
        });
        for (const county of this.counties) {
            county.generateTerrain();
        }
    }

    public *getPlanets(): Generator<Planet> {
        for (const county of this.counties) {
            yield * Array.from(county.getPlanets());
        }
    }

    public *getStars(): Generator<Planet> {
        yield * this.stars;
    }
}

/**
 * A voronoi tree node used to generate the terrain of a kingdom. There are 5 duchies in a kingdom.
 */
export class VoronoiKingdom extends VoronoiTreeNode<ICameraState> {
    duchies: VoronoiDuchy[] = [];
    getPlanetId: () => number;
    getStarId: () => number;

    constructor(
        app: App,
        voronoiCell: VoronoiCell,
        level: number,
        parent: IVoronoiTreeNodeParent<ICameraState>,
        getPlanetId: () => number,
        getStarId: () => number
    ) {
        super(app, voronoiCell, level, parent);
        this.getPlanetId = getPlanetId;
        this.getStarId = getStarId;
    }

    public generateTerrain() {
        this.nodes = VoronoiTreeNode.createTreeNodes(this.parent.nodes, this);
        this.duchies = this.nodes.map(n => new VoronoiDuchy(n.app, n.voronoiCell, n.level, n.parent, this.getPlanetId ,this.getStarId));
        for (const duchy of this.duchies) {
            duchy.generateTerrain();
        }
    }

    public *getPlanets(): Generator<Planet> {
        for (const duchy of this.duchies) {
            yield * Array.from(duchy.getPlanets());
        }
    }

    public *getStars(): Generator<Planet> {
        for (const duchy of this.duchies) {
            yield * Array.from(duchy.getStars());
        }
    }
}

/**
 * A voronoi tree used to generate terrain. There are 20 kingdoms.
 */
export class VoronoiTerrain extends VoronoiTree<ICameraState> {
    kingdoms: VoronoiKingdom[] = [];
    recursionNodeLevels(): number[] {
        return [15, 3, 4];
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
        this.kingdoms = this.nodes.map(n => new VoronoiKingdom(n.app, n.voronoiCell, n.level, n.parent, this.getPlanetId, this.getStarId));
        for (const kingdom of this.kingdoms) {
            kingdom.generateTerrain();
        }
    }

    public *getPlanets(): Generator<Planet> {
        for (const kingdom of this.kingdoms) {
            yield * Array.from(kingdom.getPlanets());
        }
    }

    public *getStars(): Generator<Planet> {
        for (const kingdom of this.kingdoms) {
            yield * Array.from(kingdom.getStars());
        }
    }
}