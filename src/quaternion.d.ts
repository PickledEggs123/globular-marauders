/// <reference types="node" />

declare module 'quaternion' {
    export class Quaternion {
        public w: number;
        public x: number;
        public y: number;
        public z: number;

        public constructor();
        public constructor(w: number, x: number, y: number, z: number);
        public constructor(w: number, [x, y, z]: [number, number, number]);
        public constructor({w, x, y, z}: {w: number, x: number, y: number, z: number});
        public constructor({re, im: {x, y, z}}: {re: number, im: {x: number, y: number, z: number}});
        public constructor([w, x, y, z]: [number, number, number, number]);
        public constructor([x, y, z]: [number, number, number]);
        public constructor(w: number);
        public constructor(str: string);

        public add(other: Quaternion): Quaternion;
        public sub(other: Quaternion): Quaternion;
        public neg(): Quaternion;
        public norm(): Quaternion;
        public normSq(): Quaternion;
        public normalize(): Quaternion;
        public mul(other: Quaternion): Quaternion;
        public scale(scale: number): Quaternion;
        public dot(other: Quaternion): Quaternion;
        public inverse(): Quaternion;
        public div(other: Quaternion): Quaternion;
        public conjugate(): Quaternion;
        public pow(power: number): Quaternion;
        public exp(): Quaternion;
        public log(): Quaternion;
        public real(): number;
        public imag(): Quaternion;
        public equals(other: Quaternion): Quaternion;
        public isFinite(): boolean;
        public isNan(): boolean;
        public toString(): string;
        public toMatrix(): number[];
        public toMatrix4(): number[];
        public toVector(): [number, number, number,number];
        public clone(): Quaternion;
        public rotateVector(v: [number, number, number]): [number, number,number];
        public slerp(other: Quaternion): (percentage: number) => Quaternion;
        public static fromAxisAngle(axis: [number, number, number], angle: number): Quaternion;
        public static fromEuler(a: number, b: number, c: number, order: string = "ZXY");
        public static fromBetweenVectors(a: [number, number, number], b: [number, number, number]): Quaternion;

        public static ZERO: Quaternion;
        public static ONE: Quaternion;
        public static I: Quaternion;
        public static J: Quaternion;
        public static K: Quaternion;
        public static EPSILON: Quaternion;
    }

    export = Quaternion;
}
