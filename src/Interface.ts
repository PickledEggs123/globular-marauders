import Quaternion from "quaternion";
import App from "./App";
import {PathFinder} from "./Graph";
import {EFaction} from "./Ship";
import {Planet} from "./Planet";
import {Crate} from "./Item";

export interface IExpirableTicks {
    life: number;
    maxLife: number;
}

export interface IAutomatedShip extends ICameraState {
    activeKeys: string[];
    app: App;

    isInMissionArea(): boolean;

    hasPirateOrder(): boolean;

    nearPirateCrate(): Crate | null;

    hasPirateCargo(): boolean
}

export interface ICollidable extends ICameraState {
    size: number;
    factionId: EFaction | null;
}

export interface ICameraState {
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
export interface ICameraStateWithOriginal<T extends ICameraState> extends ICameraState {
    original: T;
}

export interface IExpirable {
    /**
     * The date an expirable object was created.
     */
    created: Date;
    /**
     * The date an expirable object will be destroyed.
     */
    expires: Date;
}

export interface IDrawable<T extends ICameraState> {
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
} /**
 * The level of settlement of a world.
 */
/**
 * The min distance in rendering to prevent disappearing ship bug.
 */
export const MIN_DISTANCE = 1 / 10;

/**
 * An object which has gold. Can be used to pay for ships.
 */
export interface IGoldAccount {
    gold: number;
}

export enum ESettlementLevel {
    /**
     * The world does not have any faction on it.
     */
    UNTAMED = 0,
    /**
     * The world is a small outpost which can repair ships and produce luxuries such as fur. But it cannot produce
     * ships. Ship production is too complicated for an outpost. This planet has no government.
     */
    OUTPOST = 1,
    /**
     * The world is larger and can repair ships and also produce small ships. It is able to engage in manufacturing,
     * producing more complicated goods. This planet has a small government, either a republic or a governor. Colonies
     * will send taxes with a trade ship back to the capital so the capital can issue more orders.
     */
    COLONY = 2,
    /**
     * The world is larger and can repair ships and also produce medium ships. It is able to produce complicated goods
     * and is considered a core part of the faction. This world is able to issue it's own orders to it's own local fleet,
     * similar to a capital but the capital will always override the territory. Capitals can issue general economic orders
     * to territories.
     */
    TERRITORY = 3,
    /**
     * This world is a core part of the faction and contains lots of manufacturing and investments. It is able to produce
     * large ships. Provinces can issue it's own orders to it's local fleet similar to a capital but the capital will always
     * override the province. Capitals can issue general economic orders to provinces. Provinces can issue general
     * economic orders to territories.
     */
    PROVINCE = 4,
    /**
     * This world is the capital of the faction. It is able to produce the largest ships. All orders come from the capital.
     * If the capital is captured, another province or territory can become a second capital to replace the original capital.
     */
    CAPITAL = 5,
}

/**
 * A list of planets to explore, used internally by the faction.
 */
export interface IExplorationGraphData {
    distance: number;
    settlerShipIds: string[];
    traderShipIds: string[];
    pirateShipIds: string[];
    enemyStrength: number;
    planet: Planet;
}