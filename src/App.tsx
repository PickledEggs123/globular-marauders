import React from 'react';
import './App.css';
import Quaternion from 'quaternion';

/**
 * A simple class storing some vertices to render on scene
 */
class DelaunayTriangle {
    public vertices: [number, number, number][] = [];
}

/**
 * A class used to render a delaunay triangle tile.
 */
class DelaunayTile {
    public vertices: Quaternion[] = [];
    public color: string = "red";
    public id: string = "";
}

/**
 * A delaunay graph for procedural generation, automatic random landscapes.
 */
class DelaunayGraph {
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
     * Initialize a basic graph, ready for incremental construction.
     */
    public initialize() {
        const north: [number, number, number] = [0, 0, 1];
        this.vertices.push(north);

        const tetrahedronAngle = 120 / 180 * Math.PI;
        const base1: [number, number, number] = [
            Math.cos(0) * Math.sin(tetrahedronAngle),
            Math.sin(0) * Math.sin(tetrahedronAngle),
            Math.cos(tetrahedronAngle)
        ];
        const base2: [number, number, number] = [
            Math.cos(tetrahedronAngle) * Math.sin(tetrahedronAngle),
            Math.sin(tetrahedronAngle) * Math.sin(tetrahedronAngle),
            Math.cos(tetrahedronAngle)
        ];
        const base3: [number, number, number] = [
            Math.cos(2 * tetrahedronAngle) * Math.sin(tetrahedronAngle),
            Math.sin(2 * tetrahedronAngle) * Math.sin(tetrahedronAngle),
            Math.cos(2 * tetrahedronAngle)
        ];
        this.vertices.push(base1, base2, base3);

        this.edges.push([0, 1], [1, 2], [2, 0]);
        this.edges.push([0, 2], [2, 3], [3, 0]);
        this.edges.push([0, 3], [3, 1], [1, 0]);
        this.edges.push([1, 3], [3, 2], [2, 1]);

        this.triangles.push([0, 1, 2]);
        this.triangles.push([3, 4, 5]);
        this.triangles.push([6, 7, 8]);
        this.triangles.push([9, 10, 11]);
        for (let triangleIndex = 0; triangleIndex < this.triangles.length; triangleIndex++) {
            this.orientTriangle(triangleIndex);
        }
    }

    private randomInt(): number {
        return (Math.random() * 2) - 1;
    }

    private randomPoint(): [number, number, number] {
        // generate random vertex
        const vertex: [number, number, number] = [this.randomInt(), this.randomInt(), this.randomInt()];
        return this.normalize(vertex);
    }

    private distanceFormula(a: [number, number, number], b: [number, number, number]): number {
        return Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2) + Math.pow(b[2] - a[2], 2));
    }

    private normalize(a: [number, number, number]): [number, number, number] {
        const vertexLength = this.distanceFormula(a, [0, 0, 0]);
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
        return this.triangles.findIndex((triangle, triangleIndex) => {
            // for each edge of a spherical triangle
            for (const edgeIndex of triangle) {
                // compute half plane of edge
                const startIndex = this.edges[edgeIndex][0];
                const endIndex = this.edges[edgeIndex][1];
                const start = this.vertices[startIndex];
                const end = this.vertices[endIndex];
                const normal = this.normalize(DelaunayGraph.crossProduct(start, end));
                // check to see if point is on the correct side of the half plane
                if (vertex[0] * normal[0] + vertex[1] * normal[1] + vertex[2] * normal[2] < 0) {
                    // incorrect side, return false, try next triangle
                    console.log(triangleIndex, "Is incorrect, not inside triangle", edgeIndex, normal, vertex);
                    return false;
                }
            }
            // return true, the point is inside the correct side of all edges of the triangle
            // safe to assume the point is inside the triangle
            console.log(triangleIndex, "Is Correct, inside triangle");
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

        // for (let i = 0; i < 1; i++) {
        //     const triangleIndex1 = this.triangles.length - 1 - i;
        //     for (const edgeIndex of this.triangles[triangleIndex1]) {
        //         const edge = this.edges[edgeIndex];
        //         const firstVertexIndex = edge[0];
        //         const secondVertexIndex = edge[1];
        //         const firstVertex = this.vertices[firstVertexIndex];
        //         const secondVertex = this.vertices[secondVertexIndex];
        //         console.log("TRIANGLE", triangleIndex1, "EDGE", edgeIndex, "VERTEX", firstVertexIndex, firstVertex);
        //         console.log("TRIANGLE", triangleIndex1, "EDGE", edgeIndex, "VERTEX", secondVertexIndex, secondVertex);
        //     }
        // }
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
        return [
            vertexSum[0] / vertexCount,
            vertexSum[1] / vertexCount,
            vertexSum[2] / vertexCount,
        ];
    }

    public orientTriangle(triangleIndex: number) {
        // compute a reference frame around the north pole to the triangle
        const averagePoint = this.getAveragePointOfTriangle(triangleIndex);
        const averageQuaternionFrame = Quaternion.fromBetweenVectors([0, 0, 1], averagePoint);

        // the theta angle counter clockwise of each edge
        const edgeThetas: number[] = [];

        // orient the vertices of each edge of the triangle
        for (const edgeIndex of this.triangles[triangleIndex]) {
            // determine rotation angle of start to end point
            const edge = this.edges[edgeIndex];
            const startIndex = edge[0];
            const endIndex = edge[1];
            const start = this.vertices[startIndex];
            const end = this.vertices[endIndex];

            // move two vertices from the triangle into reference around the north pole
            const startRotatePoint = averageQuaternionFrame.clone().conjugate().mul(
                Quaternion.fromBetweenVectors([0, 0, 1], start)
            ).rotateVector([0, 0, 1]);
            const endRotatePoint = averageQuaternionFrame.clone().conjugate().mul(
                Quaternion.fromBetweenVectors([0, 0, 1], end)
            ).rotateVector([0, 0, 1]);

            // compute the rotation of the two points
            const startToEndQuaternion = Quaternion.fromBetweenVectors(startRotatePoint, endRotatePoint);
            const startToEndRotatePoint = startToEndQuaternion.rotateVector([1, 0, 0]);
            const polarDiffAngle = Math.atan2(startToEndRotatePoint[1], startToEndRotatePoint[0]);

            // found negative angle, swap points so the edge always has the same orientation, counter clockwise
            // console.log("POLAR DIFF ANGLE NEG", polarDiffAngle, "POINTS", start, end, "ROTATED POINTS", startRotatePoint, endRotatePoint);
            if (polarDiffAngle < 0) {
                const tmp = edge[0];
                edge[0] = edge[1];
                edge[1] = tmp;
            }

            // compute theta angle of the edge
            const edgeThetaPoint = polarDiffAngle >= 0 ? startRotatePoint : endRotatePoint;
            const edgeThetaAngle = Math.atan2(edgeThetaPoint[1], edgeThetaPoint[0]);
            edgeThetas.push(edgeThetaAngle);
        }

        // sort edges by their theta angle
        const sortOrder: number[] = [];
        while (true) {
            const lowestValue = edgeThetas.reduce((acc: number, value: number): number => {
                return value === Number.MIN_VALUE ? acc : Math.min(acc, value);
            }, Number.MAX_VALUE);
            const lowestIndex = edgeThetas.findIndex(value => value === lowestValue);
            if (lowestIndex >= 0) {
                sortOrder.push(lowestIndex);
                edgeThetas[lowestIndex] = Number.MIN_VALUE;
            } else {
                break;
            }
        }

        // orient the triangles so edges are counter clockwise
        this.triangles[triangleIndex] = sortOrder.map(sortIndex => this.triangles[triangleIndex][sortIndex]);
    }

    /**
     * Perform an incremental insert into the delaunay graph, add random data points and maintain the triangle mesh.
     */
    public incrementalInsert() {
        const vertex = this.randomPoint();

        // find triangle collision
        const triangleIndex = this.findTriangleIntersection(vertex);
        console.log("TRIANGLE MESH", triangleIndex);

        // add triangle incrementally
        this.buildInitialTriangleMeshForNewVertex(vertex, triangleIndex);

        // orient triangles correctly
        for (let i = 0; i < 3; i++) {
            const triangleIndex = this.triangles.length - 1 - i;
            this.orientTriangle(triangleIndex);
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
}

class Planet implements ICameraState {
    public id: string = "";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public color: string = "blue";
}

class Ship implements ICameraState {
    public id: string = "";
    public color: string = "purple";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public cannonLoading?: Date = undefined;
}

class SmokeCloud implements ICameraState, IExpirable {
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

interface IDrawable {
    id: string;
    color: string;
    position: Quaternion;
    positionVelocity: Quaternion;
    orientation: Quaternion;
    orientationVelocity: Quaternion;
    cannonLoading?: Date;
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
    planets: Planet[];
    ships: Ship[];
    smokeClouds: SmokeCloud[];
    zoom: number;
}

class App extends React.Component<IAppProps, IAppState> {
    state = {
        showNotes: false as boolean,
        width: 500 as number,
        height: 500 as number,
        planets: [] as Planet[],
        ships: [] as Ship[],
        smokeClouds: [] as SmokeCloud[],
        zoom: 4 as number,
    };

    private showNotesRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    private rotateCameraInterval: any = null;
    private activeKeys: any[] = [];
    private keyDownHandlerInstance: any;
    private keyUpHandlerInstance: any;
    private delaunayGraph: DelaunayGraph = new DelaunayGraph();

    private static speed: number = 1 / 6000;

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
        };
    }

    private getFirstShip(state?: IAppState): ICameraState {
        const ship = (state || this.state).ships[0];
        if (ship) {
            return App.GetCameraState(ship);
        }
        throw new Error("Cannot find first ship");
    }

    private rotateDelaunayTriangle(triangle: DelaunayTriangle, index: number): DelaunayTile {
        const {
            position: cameraPosition,
            orientation: cameraOrientation,
        } = this.getFirstShip();
        const vertices = triangle.vertices.reduce((acc: Quaternion[], v, index, arr): Quaternion[] => {
            // interpolate vertices to get more data points for round surfaces
            const start = cameraOrientation.clone().conjugate()
                .mul(cameraPosition.clone().conjugate())
                .mul(Quaternion.fromBetweenVectors([0, 0, 1], v));
            const end = cameraOrientation.clone().conjugate()
                .mul(cameraPosition.clone().conjugate())
                .mul(Quaternion.fromBetweenVectors([0, 0, 1], arr[(index + 1) % arr.length]));
            // number of sub steps for each edge of a spherical polygon
            const steps = 1;
            const diff = Quaternion.fromBetweenVectors(
                start.rotateVector([0, 0, 1]),
                end.rotateVector([0, 0, 1])
            ).pow(1 / steps);
            for (let i = 0; i < steps; i++) {
                acc.push(start.clone().mul(diff.clone().pow(i)));
            }
            return acc;
        }, []);
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

    private rotatePlanet<T extends ICameraState>(planet: T): T {
        const {
            position: cameraPosition,
            orientation: cameraOrientation,
        } = this.getFirstShip();
        const position = cameraOrientation.clone().conjugate()
            .mul(cameraPosition.clone().conjugate())
            .mul(planet.position.clone());
        const orientation = cameraOrientation.clone().conjugate()
            .mul(planet.orientation.clone());
        return {
            ...planet,
            position,
            orientation,
        };
    }

    private convertToDrawable<T extends ICameraState>(layerPostfix: string, size: number, planet: T): IDrawable {
        const rotatedPosition = planet.position.rotateVector([0, 0, 1]);
        const projection = this.stereographicProjection(planet, size);
        const reverseProjection = this.stereographicProjection(planet, size);
        // const distance = 50 * Math.sqrt(
        //     Math.pow(rotatedPosition[0], 2) +
        //     Math.pow(rotatedPosition[1], 2) +
        //     Math.pow(1 - rotatedPosition[2], 2)
        // );
        const distance = 50 * (1 - rotatedPosition[2]);
        const orientationPoint = planet.orientation.rotateVector([1, 0, 0]);
        const rotation = Math.atan2(-orientationPoint[1], orientationPoint[0]) / Math.PI * 180;
        return {
            id: `${planet.id}${layerPostfix}`,
            color: planet.color,
            position: planet.position,
            positionVelocity: planet.positionVelocity,
            orientation: planet.orientation,
            orientationVelocity: planet.orientationVelocity,
            cannonLoading: planet.cannonLoading,
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

    private drawPlanet(planetDrawing: IDrawable) {
        const isReverseSide = planetDrawing.rotatedPosition[2] > 0;
        const x = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).x + 1) * 0.5;
        const y = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).y + 1) * 0.5;
        const distance = planetDrawing.distance;
        const size = 2 * Math.atan(10 / (2 * distance));
        return (
            <circle
                key={planetDrawing.id}
                cx={x * this.state.width}
                cy={(1 - y) * this.state.height}
                r={size * this.state.zoom}
                fill={planetDrawing.color}
                stroke="grey"
                strokeWidth={0.2 * size * this.state.zoom}
                style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
            />
        );
    }

    private drawShip(planetDrawing: IDrawable) {
        const isReverseSide = planetDrawing.rotatedPosition[2] > 0;
        const x = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).x + 1) * 0.5;
        const y = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).y + 1) * 0.5;
        const distance = planetDrawing.distance;
        const size = 2 * Math.atan(1 / (2 * distance));
        const scale = (size * this.state.zoom) / 100;
        let velocityX = 0;
        let velocityY = 0;
        const isPlayerShip = planetDrawing.id === "ship-0-ships";
        if (isPlayerShip) {
            const velocityPosition = [0, 0, 1];
            const velocityLength = Math.sqrt(velocityPosition.reduce((sum: number, value: number): number => {
                return sum + Math.pow(value, 2);
            }, 0));
            const velocityAngle = Math.atan2(velocityPosition[1], velocityPosition[0]);
            const orientationPosition = planetDrawing.position.clone().conjugate()
                .mul(planetDrawing.orientation.clone().conjugate())
                .rotateVector([1, 0, 0]);
            const orientationAngle = Math.atan2(orientationPosition[1], orientationPosition[0]);
            if (velocityLength > 0) {
                velocityX = velocityLength * Math.cos(velocityAngle + orientationAngle);
                velocityY = velocityLength * Math.sin(velocityAngle + orientationAngle);
            }
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
        if (isPlayerShip && planetDrawing.cannonLoading) {
            cannonLoadingPercentage = (Date.now() - +planetDrawing.cannonLoading) / 3000;
        }
        return (
            <g key={planetDrawing.id} transform={`translate(${x * this.state.width},${(1 - y) * this.state.height})`}>
                {
                    isPlayerShip && (
                        <line
                            x1={0}
                            y1={0}
                            x2={this.state.width * 0.5 * velocityX}
                            y2={this.state.height * 0.5 * velocityY}
                            stroke="white"
                            strokeWidth={2}
                            strokeDasharray="1,5"
                        />
                    )
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
                        isPlayerShip && planetDrawing.cannonLoading && (
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

    private drawSmokeCloud(planetDrawing: IDrawable) {
        const isReverseSide = planetDrawing.rotatedPosition[2] > 0;
        const x = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).x + 1) * 0.5;
        const y = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).y + 1) * 0.5;
        const distance = planetDrawing.distance;
        const size = 0.2 * 2 * Math.atan(10 / (2 * distance));
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

    private drawDelaunayTile(tile: DelaunayTile) {
        const rotatedPoints = tile.vertices.map((v: Quaternion): [number, number, number] => {
            return v.rotateVector([0, 0, 1]);
        });
        const points: Array<{x: number, y: number}> = rotatedPoints.map(point => {
            return {
                x: point[0] * this.state.zoom,
                y: point[1] * this.state.zoom,
            };
        }).map(p => {
            return {
                x: (p.x + 1) * 0.5,
                y: (p.y + 1) * 0.5,
            };
        });

        // determine if the triangle is facing the camera, do not draw triangles facing away from the camera
        const triangleNormal = DelaunayGraph.crossProduct(
            DelaunayGraph.subtract(rotatedPoints[1], rotatedPoints[0]),
            DelaunayGraph.subtract(rotatedPoints[2], rotatedPoints[0]),
        );
        const triangleFacingCamera = DelaunayGraph.dotProduct([0, 0, 1], triangleNormal) < 0;

        if (triangleFacingCamera) {
            return (
                <polygon
                    key={tile.id}
                    points={points.map(p => `${p.x * this.state.width},${p.y * this.state.height}`).join(" ")}
                    fill={tile.color}
                    stroke="white"
                    strokeDasharray="5,5"
                    style={{opacity: 0.1}}
                />
            );
        } else {
            return null;
        }
    }

    private gameLoop() {
        this.setState((state) => {
            if (state.ships.length === 0) {
                return state;
            }
            let {
                id: cameraId,
                position: cameraPosition,
                positionVelocity: cameraPositionVelocity,
                orientation: cameraOrientation,
                orientationVelocity: cameraOrientationVelocity,
                cannonLoading: cameraCannonLoading,
            } = this.getFirstShip(state);
            const smokeClouds = [
                ...state.smokeClouds.filter(smokeCloud => {
                    return +smokeCloud.expires > Date.now();
                }).slice(-20)
            ];

            if (this.activeKeys.includes("a")) {
                const rotation = Quaternion.fromAxisAngle([0, 0, 1], Math.PI).pow(1/300);
                cameraOrientationVelocity = cameraOrientationVelocity.clone().mul(rotation);
            }
            if (this.activeKeys.includes("d")) {
                const rotation = Quaternion.fromAxisAngle([0, 0, 1], -Math.PI).pow(1/300);
                cameraOrientationVelocity = cameraOrientationVelocity.clone().mul(rotation);
            }
            if (this.activeKeys.includes("w")) {
                const forward = cameraOrientation.clone().rotateVector([0, 1, 0]);
                const rotation = Quaternion.fromBetweenVectors([0, 0, 1], forward).pow(App.speed);
                cameraPositionVelocity = cameraPositionVelocity.clone().mul(rotation);
                const smokeCloud = new SmokeCloud();
                smokeCloud.id = `${cameraId}-${Math.floor(Math.random() * 100000000)}`;
                smokeCloud.position = cameraPosition;
                smokeCloud.positionVelocity = rotation.clone().conjugate().pow(100);
                smokeCloud.size = 1;
                smokeClouds.push(smokeCloud);
            }
            if (this.activeKeys.includes("s")) {
                const backward = cameraOrientation.clone().rotateVector([0, -1, 0]);
                const rotation = Quaternion.fromBetweenVectors([0, 0, 1], backward).pow(App.speed * 0.3);
                cameraPositionVelocity = cameraPositionVelocity.clone().mul(rotation);

                const smokeCloudLeft = new SmokeCloud();
                smokeCloudLeft.id = `${cameraId}-${Math.floor(Math.random() * 100000000)}`;
                smokeCloudLeft.position = cameraPosition;
                smokeCloudLeft.positionVelocity = rotation.clone().conjugate().mul(Quaternion.fromAxisAngle([0, 0, 1], -Math.PI / 4)).pow(100);
                smokeCloudLeft.size = 0.2;
                smokeClouds.push(smokeCloudLeft);
                const smokeCloudRight = new SmokeCloud();
                smokeCloudRight.id = `${cameraId}-${Math.floor(Math.random() * 100000000)}`;
                smokeCloudRight.position = cameraPosition;
                smokeCloudRight.positionVelocity = rotation.clone().conjugate().mul(Quaternion.fromAxisAngle([0, 0, 1], Math.PI / 4)).pow(100);
                smokeCloudRight.size = 0.2;
                smokeClouds.push(smokeCloudRight);
            }
            if (this.activeKeys.includes(" ") && !cameraCannonLoading) {
                cameraCannonLoading = new Date(Date.now());
            }
            if (!this.activeKeys.includes(" ") && cameraCannonLoading) {
                // cannon fire
                cameraCannonLoading = undefined;
            }
            if (this.activeKeys.includes(" ") && cameraCannonLoading && Date.now() - +cameraCannonLoading > 3000) {
                // cancel cannon fire
                cameraCannonLoading = undefined;
            }
            if (cameraPositionVelocity !== Quaternion.ONE) {
                cameraPosition = cameraPosition.clone().mul(cameraPositionVelocity.clone());
            }
            if (cameraOrientationVelocity !== Quaternion.ONE) {
                cameraOrientation = cameraOrientation.clone().mul(cameraOrientationVelocity.clone());
            }
            if (cameraPosition !== this.getFirstShip(state).position && false) {
                const diffQuaternion = this.getFirstShip(state).position.clone().conjugate().mul(cameraPosition.clone());
                cameraOrientation = cameraOrientation.clone().mul(diffQuaternion);
            }
            const ship: Ship = {
                ...state.ships[0],
                position: cameraPosition,
                orientation: cameraOrientation,
                positionVelocity: cameraPositionVelocity,
                orientationVelocity: cameraOrientationVelocity,
                cannonLoading: cameraCannonLoading,
            };
            return {
                ...state,
                ships: [ship, ...state.ships.slice(1, state.ships.length)],
                smokeClouds,
            };
        });
    }

    private handleShowNotes() {
        if (this.showNotesRef.current) {
            this.setState({
                ...this.state,
                showNotes: this.showNotesRef.current.checked,
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

    componentDidMount() {
        // initialize 3d terrain stuff
        this.delaunayGraph.initialize();
        for (let i = 0; i < 3; i++) {
            this.delaunayGraph.incrementalInsert();
        }

        // initialize planets and ships
        const planets: Planet[] = [];
        for (let i = 0; i < 150; i++) {
            const planet = new Planet();
            planet.id = `planet-${i}`;
            planet.position = new Quaternion(0, App.randomRange(), App.randomRange(), App.randomRange());
            planet.position = planet.position.normalize();
            planet.orientation = Quaternion.fromAxisAngle([0, 0, 1], Math.random() * 2 * Math.PI);
            const colorValue = Math.random();
            if (colorValue > 0.75)
                planet.color = "red";
            else if (colorValue > 0.5)
                planet.color = "green";
            else if (colorValue > 0.25)
                planet.color = "tan";
            planets.push(planet);
        }

        // initialize planets and ships
        const ships: Ship[] = [];
        for (let i = 0; i < 200; i++) {
            const ship = new Ship();
            ship.id = `ship-${i}`;
            ship.position = new Quaternion(0, App.randomRange(), App.randomRange(), App.randomRange());
            ship.position = ship.position.normalize();
            ship.orientation = Quaternion.fromAxisAngle([0, 0, 1], Math.random() * 2 * Math.PI);
            if (i === 0) {
                const colorValue = Math.random();
                if (colorValue > 0.75)
                    ship.color = "red";
                else if (colorValue > 0.5)
                    ship.color = "green";
                else if (colorValue > 0.25)
                    ship.color = "tan";
            }
            ships.push(ship);
        }
        this.setState({
            ...this.state,
            planets: [...planets],
            ships: [...ships],
        });

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

    render() {
        return (
            <div className="App">
                <h1>
                    Globular Marauders
                </h1>
                <div>
                    <input type="checkbox" ref={this.showNotesRef} checked={this.state.showNotes} onChange={this.handleShowNotes.bind(this)}/>
                    <span>Show Notes</span>
                </div>
                {
                    this.state.showNotes && (
                        <ul>
                            <li>Started 3/28/2021</li>
                            <li>Create 3d sphere world which has different planets. -- DONE 3/28/2021</li>
                            <li>Project 3d world onto a small area for viewing, yet still able to navigate in a circle like a 3d sphere. -- DONE 3/28/2021</li>
                            <li>Create camera system centered around a small ship. Rotating will rotate camera/world. -- DONE 3/30/2021</li>
                            <li>Add projectiles or cannon balls and small frictionless motion in space.</li>
                            <li>Add gravity around planets.</li>
                            <li>Improve random distribution of planets using Voronoi and Lloyd Relaxation.</li>
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
                    <circle
                        cx={this.state.width * 0.5}
                        cy={this.state.height * 0.5}
                        r={Math.min(this.state.width, this.state.height) * 0.5}
                        fill="black"
                    />
                    {
                        [
                            ...this.state.planets.map(this.rotatePlanet.bind(this))
                                .map(this.convertToDrawable.bind(this, "-layer1", 1)),
                            ...this.state.planets.map(this.rotatePlanet.bind(this))
                                .map(this.convertToDrawable.bind(this, "-layer2", 0.5)),
                            ...this.state.planets.map(this.rotatePlanet.bind(this))
                                .map(this.convertToDrawable.bind(this, "-layer3", 0.25)),
                            ...this.state.planets.map(this.rotatePlanet.bind(this))
                                .map(this.convertToDrawable.bind(this, "-layer4", 0.125))
                        ].sort((a: any, b: any) => b.distance - a.distance).map(this.drawPlanet.bind(this))
                    }
                    {
                        Array.from(this.delaunayGraph.GetTriangles())
                            .map(this.rotateDelaunayTriangle.bind(this))
                            .map(this.drawDelaunayTile.bind(this))
                    }
                    {
                        this.state.smokeClouds.map(this.rotatePlanet.bind(this))
                            .map(this.convertToDrawable.bind(this, "-smokeClouds", 1))
                            .map(this.drawSmokeCloud.bind(this))
                    }
                    {
                        this.state.ships.map(this.rotatePlanet.bind(this))
                            .map(this.convertToDrawable.bind(this, "-ships", 1))
                            .map(this.drawShip.bind(this))
                    }
                    <g>
                        <text x="0" y="30" color="black">Zoom</text>
                        <rect x="0" y="45" width="20" height="20" fill="grey" onClick={this.decrementZoom.bind(this)}/>
                        <text x="25" y="60" textAnchor="center">{this.state.zoom}</text>
                        <rect x="40" y="45" width="20" height="20" fill="grey" onClick={this.incrementZoom.bind(this)}/>
                        <text x="5" y="60">-</text>
                        <text x="40" y="60">+</text>
                    </g>
                </svg>
            </div>
        );
    }
}

export default App;
