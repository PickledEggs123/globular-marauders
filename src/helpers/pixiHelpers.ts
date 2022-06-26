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

// compute polar position of position
export const convertPositionQuaternionToPositionPolar = (q: Quaternion): [number, number] => {
    const point = q.rotateVector([0, 0, 1]);
    const polarCoordinate = {
        angle: Math.atan2(point[1], point[0]),
        radius: Math.acos(point[2])
    };
    const coordinate = {
        x: Math.cos(polarCoordinate.angle) * polarCoordinate.radius / Math.PI,
        y: Math.sin(polarCoordinate.angle) * polarCoordinate.radius / Math.PI
    };
    return [coordinate.x, coordinate.y];
};
export const isPositionPolarDifferent = (a: [number, number], b: [number, number]): boolean => {
    return Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) > 0.0001;
};
export const computePositionPolarCorrectionFactorTheta = (a: [number, number], b: [number, number]): number => {
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
};