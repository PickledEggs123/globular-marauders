import {CAPITAL_GOODS, EResourceType, ITEM_DATA} from "./Resource";
import {EFaction, EShipType, Ship} from "./Ship";
import App, {Server} from "./App";
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
    public instance: Server;
    public faction: Faction;
    public planet: Planet;
    public resourceType: EResourceType;
    public planetId: string;
    public amount: number;
    private expires: number = 10 * 60 * 10;
    private ticks: number = 0;

    constructor(instance: Server, faction: Faction, planet: Planet, resourceType: EResourceType, planetId: string, amount: number) {
        this.instance = instance;
        this.faction = faction;
        this.planet = planet;
        this.resourceType = resourceType;
        this.planetId = planetId;
        this.amount = amount;
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
        const indexInApp = this.instance.luxuryBuffs.findIndex(l => l === this);
        if (indexInApp >= 0) {
            this.instance.luxuryBuffs.splice(indexInApp, 1);
        }
        // remove from planet
        const indexInPlanet = this.planet.luxuryBuffs.findIndex(l => l === this);
        if (indexInPlanet >= 0) {
            this.planet.luxuryBuffs.splice(indexInPlanet, 1);
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

    public static MAX_SHIPS: number = 100;

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