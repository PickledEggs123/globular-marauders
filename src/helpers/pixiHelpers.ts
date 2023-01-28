import {PHYSICS_SCALE} from "@pickledeggs123/globular-marauders-game/lib/src/ShipType";
import Quaternion from "quaternion";


export const GetHullPoint = ([x, y]: [number, number]): [number, number, number] => {
    const z = Math.sqrt(1 -
        Math.pow(x * PHYSICS_SCALE, 2) -
        Math.pow(y * PHYSICS_SCALE, 2)
    );
    return [x, y, z];
};

export const hexToRgb = (hex: string): [number, number, number, number] => {
    if (hex === "red") return [1, 0, 0, 1];
    if (hex === "yellow") return [1, 1, 0, 1];
    if (hex === "blue") return [0, 0, 1, 1];
    return [
        parseInt(hex.slice(1, 3), 16) / 255,
        parseInt(hex.slice(3, 5), 16) / 255,
        parseInt(hex.slice(5, 7), 16) / 255,
        1
    ];
};

// a combined polar mapping using both poles to compute the correction factor theta
export interface IPositionPolarData {
    north: [number, number];
    south: [number, number];
}

// compute polar position of position
export const convertPositionQuaternionToPositionPolar = (q: Quaternion): IPositionPolarData => {
    const point = q.rotateVector([0, 0, 1]);
    const polarCoordinateNorth = {
        angle: Math.atan2(point[1], point[0]),
        radius: Math.acos(point[2]),
    };
    const polarCoordinateSouth = {
        radius: Math.PI - Math.acos(point[2]),
    };
    // generate north polar mapping
    const coordinateNorth = {
        x: Math.cos(polarCoordinateNorth.angle) * polarCoordinateNorth.radius / Math.PI,
        y: Math.sin(polarCoordinateNorth.angle) * polarCoordinateNorth.radius / Math.PI
    };
    // generate south polar mapping
    const coordinateSouth = {
        x: -Math.cos(polarCoordinateNorth.angle) * polarCoordinateSouth.radius / Math.PI,
        y: -Math.sin(polarCoordinateNorth.angle) * polarCoordinateSouth.radius / Math.PI
    };
    return {
        north: [coordinateNorth.x, coordinateNorth.y],
        south: [coordinateSouth.x, coordinateSouth.y]
    };
};
const useNorthCoordinates = (a: IPositionPolarData) => {
    const magnitudeNorth = Math.sqrt((a.north[0] ** 2) + (a.north[1] ** 2));
    return magnitudeNorth < 0.5 || true;
};
export const isPositionPolarDifferent = (a: IPositionPolarData, b: IPositionPolarData): boolean => {
    // pick north mapping or south mapping
    // eslint-disable-next-line react-hooks/rules-of-hooks
    if (useNorthCoordinates(a)) {
        // return north mapping value
        return Math.sqrt((b.north[0] - a.north[0]) ** 2 + (b.north[1] - a.north[1]) ** 2) > 0.01;
    } else {
        // return south mapping value
        return Math.sqrt((b.south[0] - a.south[0]) ** 2 + (b.south[1] - a.south[1]) ** 2) > 0.01;
    }
};
export const computePositionPolarCorrectionFactorTheta = (a: IPositionPolarData, b: IPositionPolarData): number => {
    // pick north mapping or south mapping
    // eslint-disable-next-line react-hooks/rules-of-hooks
    if (useNorthCoordinates(a)) {
        // return north mapping value
        return Math.atan2(b.north[1] - a.north[1], b.north[0] - a.north[0]);
    } else {
        // return south mapping value
        return Math.atan2(b.south[1] - a.south[1], b.south[0] - a.south[0]);
    }
};