import Quaternion from "quaternion";
import {IAutomatedShip, ICameraState} from "./Interface";
import App from "./App";

export interface ITessellatedTriangle {
    vertices: Quaternion[];
}

export interface IDrawableTile {
    vertices: Quaternion[];
    centroid: Quaternion;
    color: string;
    id: string;
}

export interface ICellData {
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
            if (typeof (this.drawableMap[closestIndex]) === "undefined") {
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
    * fetchDrawables(position: [number, number, number]): Generator<T> {
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
            if (typeof (this.drawableMap[cellIndex]) !== "undefined") {
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
        const triangleFanParameters: Array<{ averagePoint: [number, number, number], area: number }> = [];
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
        const foundNodes: Array<{ from: number, to: number, distance: number }> = [];

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
    public* GetTriangles(): Generator<DelaunayTriangle> {
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