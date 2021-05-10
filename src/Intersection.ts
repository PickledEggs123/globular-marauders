export interface IHitTest {
    success: boolean;
    point: [number, number, number] | null;
    distance: number | null;
    time: number | null;
}

export interface IConeHitTest {
    success: boolean;
    point: [number, number] | null;
    distance: number | null;
    time: number | null;
}

/**
 * Determine the direction to aim at a moving target.
 * @param shipPosition The position of the ship right now.
 * @param shipDirection The direction of the ship right now, will extrapolate a target angle
 * @param projectileSpeed The projectile speed will affect the target angle
 * @param tOffset The offset of the t value.
 */
export const computeConeLineIntersection = (
    shipPosition: [number, number],
    shipDirection: [number, number],
    projectileSpeed: number,
    tOffset: number = 0
): IConeHitTest => {
    // line cone intersection equations
    // https://www.geometrictools.com/Documentation/IntersectionLineCone.pdf
    // cone - origin V direction D angle Y
    // line - origin P direction U
    const multiply = (a: number[], b: number[], transpose: boolean = false): number[] => {
        if (a.length === 1 && b.length === 1) {
            return [
                a[0] * b[0]
            ];
        } else if (a.length === 3 && b.length === 9) {
            return [
                a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
                a[0] * b[3] + a[1] * b[4] + a[2] * b[5],
                a[0] * b[6] + a[1] * b[7] + a[2] * b[8]
            ];
        } else if (a.length === 9 && b.length === 3) {
            return [
                a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
                a[3] * b[0] + a[4] * b[1] + a[5] * b[2],
                a[6] * b[0] + a[7] * b[1] + a[8] * b[2]
            ];
        } else if (a.length === 3 && b.length === 3 && !transpose) {
            return [
                a[0] * b[0], a[0] * b[1], a[0] * b[2],
                a[1] * b[0], a[1] * b[1], a[1] * b[2],
                a[2] * b[0], a[2] * b[1], a[2] * b[2]
            ];
        } else if (a.length === 3 && b.length === 3 && transpose) {
            return [
                a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
            ];
        } else if (a.length === 9 && b.length === 9) {
            return [
                a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
                a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
                a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
                a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
                a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
                a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
                a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
                a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
                a[6] * b[2] + a[7] * b[5] + a[8] * b[8]
            ];
        } else if (a.length === 1 && b.length === 9) {
            return [
                a[0] * b[0], a[0] * b[1], a[0] * b[2],
                a[0] * b[3], a[0] * b[4], a[0] * b[5],
                a[0] * b[6], a[0] * b[7], a[0] * b[8]
            ];
        } else if (a.length === 1 && b.length === 3) {
            return [
                a[0] * b[0], a[0] * b[1], a[0] * b[2]
            ];
        } else {
            throw new Error("Unknown multiplication values");
        }
    };
    const add = (a: number[], b: number[]): number[] => {
        if (a.length === 3 && b.length === 3) {
            return [
                a[0] + b[0],
                a[1] + b[1],
                a[2] + b[2]
            ];
        } else if (a.length === 1 && b.length === 1) {
            return [
                a[0] + b[0]
            ];
        } else {
            throw new Error("Unknown addition values");
        }
    };
    const subtract = (a: number[], b: number[]): number[] => {
        if (a.length === 9 && b.length === 9) {
            return [
                a[0] - b[0], a[1] - b[1], a[2] - b[2],
                a[3] - b[3], a[4] - b[4], a[5] - b[5],
                a[6] - b[6], a[7] - b[7], a[8] - b[8]
            ];
        } else if (a.length === 1 && b.length === 9) {
            return [
                a[0] - b[0], a[0] - b[1], a[0] - b[2],
                a[0] - b[3], a[0] - b[4], a[0] - b[5],
                a[0] - b[6], a[0] - b[7], a[0] - b[8]
            ];
        } else if (a.length === 3 && b.length === 3) {
            return [
                a[0] - b[0],
                a[1] - b[1],
                a[2] - b[2]
            ];
        } else if (a.length === 1 && b.length === 3) {
            return [
                a[0] - b[0],
                a[0] - b[1],
                a[0] - b[2]
            ];
        } else if (a.length === 3 && b.length === 1) {
            return [
                a[0] - b[0],
                a[1] - b[0],
                a[2] - b[0]
            ];
        } else if (a.length === 1 && b.length === 1) {
            return [
                a[0] - b[0]
            ];
        } else {
            throw new Error("Unknown subtraction values");
        }
    };

    // ship parameters
    const o = [shipPosition[0], shipPosition[1], 0]; // ship position relative to attacking ship
    const d = [shipDirection[0], shipDirection[1], 1];
    const yVector = [projectileSpeed, 0, 1]; // cone size parameters
    const yLength = Math.sqrt(Math.pow(yVector[0], 2) + Math.pow(yVector[1], 2) + Math.pow(yVector[2], 2));
    const yUnit = [yVector[0] / yLength, yVector[1] / yLength, yVector[2] / yLength];
    const v = [0, 0, 1]; // direction of cone facing upwards, attacking ship is not moving
    const y = multiply(v, yUnit, true)[0]; // angle of cone, speed of projectile

    // quadratic equation constants
    const a = subtract(
        multiply(
            multiply(d, v, true),
            multiply(d, v, true),
        ),
        multiply(
            multiply(d, d, true),
            [Math.pow(y, 2)]
        )
    )[0];
    const b = multiply(
        [2],
        subtract(
            multiply(
                multiply(o, v, true),
                multiply(d, v, true)
            ),
            multiply(
                multiply(o, d, true),
                [Math.pow(y, 2)]
            )
        )
    )[0];
    const c = subtract(
        multiply(
            multiply(o, v, true),
            multiply(o, v, true)
        ),
        multiply(
            multiply(o, o, true),
            [Math.pow(y, 2)]
        )
    )[0];

    // a list of possible time values
    const timeValues: number[] = [];

    // case 1
    if (c !== 0) {
        const root = Math.pow(b, 2) - 4 * a * c;
        if (root < 0) {
            // do nothing, no collision possible
        } else if (root === 0) {
            const t = -b / (2 * a);
            timeValues.push(t + tOffset);
        } else {
            // the pdf contained the wrong quadratic formula, it's not perfectly correct
            const t1 = (-b - Math.sqrt(root)) / (2 * a);
            const t2 = (-b + Math.sqrt(root)) / (2 * a);
            timeValues.push(t1 + tOffset);
            timeValues.push(t2 + tOffset);
        }
    }

    let tMin: number | null = null;
    for (const t of timeValues) {
        if (t >= 0 && (tMin === null || t < tMin)) {
            tMin = t;
        }
    }
    if (tMin === null) {
        return {
            success: false,
            point: null,
            distance: null,
            time: null
        };
    } else {
        const point = add(o, multiply([tMin], d)) as [number, number, number];
        const distance = Math.sqrt(Math.pow(point[0], 2) + Math.pow(point[1], 2));
        const time = tMin;
        return {
            success: true,
            point: [point[0], point[1]],
            distance,
            time
        };
    }
};