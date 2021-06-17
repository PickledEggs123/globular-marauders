import Quaternion from "quaternion";
import {PathFinder} from "./Graph";
import {EFaction} from "./Ship";
import {Planet} from "./Planet";
import {Crate} from "./Item";
import {Game} from "./Game";
import {EResourceType} from "./Resource";

export interface IExpirableTicks {
    life: number;
    maxLife: number;
}

export interface IAutomatedShip extends ICameraState {
    activeKeys: string[];
    app: Game;

    isInMissionArea(): boolean;

    hasPirateOrder(): boolean;

    nearPirateCrate(): Crate | null;

    hasPirateCargo(): boolean;

    getSpeedFactor(): number;
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
    /**
     * The speed factor of the object.
     */
    getSpeedFactor?(): number;
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
 * An object which stores money in a specific currency.
 */
export interface ICurrency {
    currencyId: string;
    amount: number;
}

/**
 * An object which has gold. Can be used to pay for ships.
 */
export class MoneyAccount {
    currencies: ICurrency[] = [];

    constructor(startingGold: number = 0) {
        this.currencies.push({
            currencyId: "GOLD",
            amount: startingGold
        });
    }

    public hasEnough(payments: ICurrency[]): boolean {
        return this.currencies.some(c => {
            const payment = payments.find(p => p.currencyId === c.currencyId);
            if (payment) {
                return c.amount >= payment.amount;
            } else {
                return false;
            }
        }) || payments.length === 0;
    }

    public makePayment(other: MoneyAccount, payments: ICurrency[]) {
        for (const c of this.currencies) {
            const payment = payments.find(p => p.currencyId === c.currencyId);
            if (payment && c.amount >= payment.amount) {
                this.removeMoney(payment);
                other.addMoney(payment);
            }
        }
    }

    public addMoney(payment: ICurrency) {
        const oldCurrency = this.currencies.find(c => c.currencyId === payment.currencyId);
        if (oldCurrency) {
            oldCurrency.amount += payment.amount;
        } else {
            this.currencies.push({
                currencyId: payment.currencyId,
                amount: payment.amount
            });
        }
    }

    public removeMoney(payment: ICurrency) {
        const oldCurrency = this.currencies.find(c => c.currencyId === payment.currencyId);
        if (oldCurrency) {
            oldCurrency.amount -= payment.amount;
            if (oldCurrency.amount <= 0) {
                const index = this.currencies.findIndex(c => c.currencyId === payment.currencyId);
                if (index >= 0) {
                    this.currencies.splice(index, 1);
                }
            }
        } else {
            throw new Error("Cannot make payment, not enough money");
        }
    }

    public getGold(): number {
        const oldCurrency = this.currencies.find(c => c.currencyId === "GOLD");
        if (oldCurrency) {
            return oldCurrency.amount;
        } else {
            return 0;
        }
    }
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

export enum EDirectedMarketTradeDirection {
    TO = "TO",
    FROM = "FROM",
}

/**
 * A graph edge used to compute bilateral trade deals. This edge points in one direction. If there are two edges
 * pointing in opposite direction, there can be a trade deal. An example is if it is 100 dollars to buy something at A
 * and 200 dollars to sell at B, also 2 dollars to buy at B and 5 dollars to sell at A. It is possible then to sail
 * between A and B and make money.
 */
export interface IDirectedMarketTrade {
    tradeDirection: EDirectedMarketTradeDirection;
    resourceType: EResourceType;
    profit: number;
}

/**
 * A trade deal between two planets.
 */
export interface ITradeDeal {
    toResourceType: EResourceType;
    fromResourceType: EResourceType;
    profit: number;
    planet: Planet;
}