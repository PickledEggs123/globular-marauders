import {CAPITAL_GOODS, EResourceType, ITEM_DATA} from "./Resource";
import {EFaction, EShipType, Ship} from "./Ship";
import App from "./App";
import {Planet} from "./Planet";

export enum ERoyalRank {
    EMPEROR = "EMPEROR",
    KING = "KING",
    DUKE = "DUKE",
    COUNT = "COUNT",
    UNCLAIMED = "UNCLAIMED",
}

/**
 * A special buff applied to factions when they accumulate luxuries.
 */
export class LuxuryBuff {
    public instance: App;
    public faction: Faction;
    public planet: Planet;
    public resourceType: EResourceType;
    public planetId: string;
    public amount: number;
    private expires: number = 10 * 60 * 10;
    private ticks: number = 0;

    constructor(instance: App, faction: Faction, planet: Planet, resourceType: EResourceType, planetId: string, amount: number) {
        this.instance = instance;
        this.faction = faction;
        this.planet = planet;
        this.resourceType = resourceType;
        this.planetId = planetId;
        this.amount = amount;
    }

    /**
     * Calculate the gold exchange of each faction.
     * @param app
     * @param faction
     * @param resourceType
     * @constructor
     */
    public static CalculateGoldBuff(app: App, faction: Faction, resourceType: EResourceType) {
        // const totalLuxuries: number = Object.values(app.factions).reduce((acc: number, f) => {
        //     return acc + f.luxuryBuffs.reduce((acc2: number, l) => {
        //         if (l.resourceType === resourceType) {
        //             return acc2 + 1;
        //         } else {
        //             return acc2;
        //         }
        //     }, 0);
        // }, 0);
        // const factionLuxuries: number = faction.luxuryBuffs.reduce((acc: number, l) => {
        //     if (l.resourceType === resourceType) {
        //         return acc + 1;
        //     } else {
        //         return acc;
        //     }
        // }, 0);
        // const averageLuxuryConsumption: number = totalLuxuries / Object.values(app.factions).length;
        //
        // // get the price multiplier of the item
        // let basePrice: number = 1;
        // const itemData = ITEM_DATA.find(item => item.resourceType === resourceType);
        // if (itemData) {
        //     basePrice = itemData.basePrice;
        // }
        //
        // // calculate the gold exchange based on luxuries
        // if (totalLuxuries > 0) {
        //     faction.gold += ((factionLuxuries / totalLuxuries) - averageLuxuryConsumption) * basePrice;
        // }
    }

    /**
     * Increment the buff.
     */
    public handleLuxuryBuffLoop() {
        this.ticks += 1;
    }

    /**
     * Find a matching luxury buff.
     * @param resourceType
     * @param planetId
     */
    public matches(resourceType: EResourceType, planetId: string) {
        return this.resourceType === resourceType && this.planetId === planetId;
    }

    /**
     * Reset the buff timer. Returns an amount replenished. Replenishing will reward the captain with money.
     */
    public replenish() {
        const percentReplenished: number = this.ticks / this.expires;
        this.ticks = 0;
        return percentReplenished;
    }

    /**
     * The total value of the luxury buff.
     */
    public goldValue(): number {
        if (CAPITAL_GOODS.includes(this.resourceType)) {
            return 0;
        }
        const itemData = ITEM_DATA.find(item => item.resourceType === this.resourceType);
        if (itemData) {
            return this.expires * itemData.basePrice * this.amount;
        }
        return this.expires;
    }

    /**
     * The buff expired.
     */
    public expired() {
        return this.ticks >= this.expires;
    }

    /**
     * Remove the buff.
     */
    public remove() {
        // remove from app
        const appIndex = this.instance.luxuryBuffs.findIndex(l => l === this);
        if (appIndex >= 0) {
            this.instance.luxuryBuffs.splice(appIndex, 1);
        }
        // remove from faction
        const factionIndex = this.planet.luxuryBuffs.findIndex(l => l === this);
        if (factionIndex >= 0) {
            this.planet.luxuryBuffs.splice(factionIndex, 1);
        }
    }
}

/**
 * A class representing a faction in the game world. Responsible for building boats, setting up trade, and colonizing islands.
 */
export class Faction {
    /**
     * An instance of app to retrieve faction data.
     */
    public instance: App;
    /**
     * The id of the faction.
     */
    public id: EFaction;
    /**
     * The color of the faction.
     */
    public factionColor: string;
    /**
     * The home world planet id.
     */
    public homeWorldPlanetId: string;
    /**
     * A list of planet ids of planets owned by this faction.
     */
    public planetIds: string[] = [];
    /**
     * A list of ship ids owned by this faction.
     */
    public shipIds: string[] = [];
    public shipsAvailable: Record<EShipType, number> = {
        [EShipType.CUTTER]: 0,
        [EShipType.SLOOP]: 0,
        [EShipType.CORVETTE]: 0,
        [EShipType.BRIGANTINE]: 0,
        [EShipType.BRIG]: 0,
        [EShipType.FRIGATE]: 0
    };
    /**
     * A number which produces unique ship id names.
     * @private
     */
    private shipIdAutoIncrement: number = 0;

    public getShipAutoIncrement(): number {
        return this.shipIdAutoIncrement++;
    }

    /**
     * Create a new faction.
     * @param instance The app which contains data for the faction to process.
     * @param id The id of the faction.
     * @param factionColor The color of the faction.
     * @param homeWorldPlanetId The home world of the faction.
     */
    constructor(instance: App, id: EFaction, factionColor: string, homeWorldPlanetId: string) {
        this.instance = instance;
        this.id = id;
        this.factionColor = factionColor;
        this.homeWorldPlanetId = homeWorldPlanetId;
        this.planetIds.push(homeWorldPlanetId);
    }

    /**
     * Faction AI loop.
     */
    public handleFactionLoop() {
    }

    public handleShipDestroyed(ship: Ship) {
        // remove ship from faction registry
        const shipIndex = this.shipIds.findIndex(s => s === ship.id);
        if (shipIndex >= 0) {
            this.shipIds.splice(shipIndex, 1);
        }
        this.shipsAvailable[ship.shipType] -= 1;
    }
}