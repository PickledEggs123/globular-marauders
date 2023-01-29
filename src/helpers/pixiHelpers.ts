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
    rotationOffset: number;
}

// compute polar position of position
export const convertPositionQuaternionToPositionPolar = (q: Quaternion): IPositionPolarData => {
    const point = q.rotateVector([0, 0, 1]);
    const polarCoordinate = {
        angle: Math.atan2(point[1], point[0]),
        radius: Math.acos(point[2]),
    };
    // generate north polar mapping
    const coordinate = {
        x: Math.cos(polarCoordinate.angle) * polarCoordinate.radius / Math.PI,
        y: Math.sin(polarCoordinate.angle) * polarCoordinate.radius / Math.PI
    };
    return {
        north: [coordinate.x, coordinate.y],
        rotationOffset: polarCoordinate.angle,
    };
};
const useNorthCoordinates = (a: IPositionPolarData) => {
    const magnitudeNorth = Math.sqrt((a.north[0] ** 2) + (a.north[1] ** 2));
    return magnitudeNorth < 0.8
};
export const isPositionPolarDifferent = (a: IPositionPolarData, b: IPositionPolarData): boolean => {
    // pick north mapping or south mapping
    // eslint-disable-next-line react-hooks/rules-of-hooks
    if (useNorthCoordinates(a)) {
        // return north mapping value
        return Math.sqrt((b.north[0] - a.north[0]) ** 2 + (b.north[1] - a.north[1]) ** 2) > 0.01;
    } else {
        // return south mapping value
        return Math.abs(b.rotationOffset - a.rotationOffset) > Math.PI / 40;
    }
};
export const computePositionPolarCorrectionFactorTheta = (a: IPositionPolarData, b: IPositionPolarData, cameraPosition: Quaternion): number => {
    // pick north mapping or south mapping
    // eslint-disable-next-line react-hooks/rules-of-hooks
    if (useNorthCoordinates(a)) {
        // return north mapping value
        return Math.atan2(b.north[1] - a.north[1], b.north[0] - a.north[0]);
    } else {
        // return south mapping value
        const cameraPositionPoint = cameraPosition.rotateVector([0, 0, 1]);
        const cameraRotationOffset = Math.atan2(cameraPositionPoint[1], cameraPositionPoint[0]);
        return 2 * (b.rotationOffset - cameraRotationOffset) - Math.PI / 2;
    }
};