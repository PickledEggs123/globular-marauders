import {CAPITAL_GOODS, EResourceType, ITEM_DATA} from "./Resource";
import {EFaction, EShipType, Ship, SHIP_DATA} from "./Ship";
import {ESettlementLevel, IExplorationGraphData, IGoldAccount} from "./Interface";
import {DelaunayGraph, VoronoiGraph} from "./Graph";
import {EOrderType, Order} from "./Order";
import App from "./App";
import {Planet} from "./Planet";

/**
 * A special buff applied to factions when they accumulate luxuries.
 */
export class LuxuryBuff {
    public instance: App;
    public faction: Faction;
    public resourceType: EResourceType;
    public planetId: string;
    private expires: number = 10 * 60 * 10;
    private ticks: number = 0;

    constructor(instance: App, faction: Faction, resourceType: EResourceType, planetId: string) {
        this.instance = instance;
        this.faction = faction;
        this.resourceType = resourceType;
        this.planetId = planetId;
    }

    /**
     * Calculate the gold exchange of each faction.
     * @param app
     * @param faction
     * @param resourceType
     * @constructor
     */
    public static CalculateGoldBuff(app: App, faction: Faction, resourceType: EResourceType) {
        const totalLuxuries: number = Object.values(app.factions).reduce((acc: number, f) => {
            return acc + f.luxuryBuffs.reduce((acc2: number, l) => {
                if (l.resourceType === resourceType) {
                    return acc2 + 1;
                } else {
                    return acc2;
                }
            }, 0);
        }, 0);
        const factionLuxuries: number = faction.luxuryBuffs.reduce((acc: number, l) => {
            if (l.resourceType === resourceType) {
                return acc + 1;
            } else {
                return acc;
            }
        }, 0);
        const averageLuxuryConsumption: number = totalLuxuries / Object.values(app.factions).length;

        // get the price multiplier of the item
        let basePrice: number = 1;
        const itemData = ITEM_DATA.find(item => item.resourceType === resourceType);
        if (itemData) {
            basePrice = itemData.basePrice;
        }

        // calculate the gold exchange based on luxuries
        if (totalLuxuries > 0) {
            faction.gold += ((factionLuxuries / totalLuxuries) - averageLuxuryConsumption) * basePrice;
        }
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
            return this.expires * itemData.basePrice;
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
        const factionIndex = this.faction.luxuryBuffs.findIndex(l => l === this);
        if (factionIndex >= 0) {
            this.faction.luxuryBuffs.splice(factionIndex, 1);
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
        [EShipType.SLOOP]: 0,
        [EShipType.CORVETTE]: 0,
        [EShipType.HIND]: 0
    };
    /**
     * A number which produces unique ship id names.
     * @private
     */
    private shipIdAutoIncrement: number = 0;
    /**
     * THe number of gold accumulated by the faction, used to pay captains.
     */
    public gold: number = 100000;
    /**
     * The list of planet priorities for exploration.
     * @private
     */
    public explorationGraph: Record<string, IExplorationGraphData> = {};
    public enemyPresenceTick: number = 10 * 30;
    /**
     * A list of luxuryBuffs which improves the faction.
     */
    public luxuryBuffs: LuxuryBuff[] = [];

    public getShipAutoIncrement(): number {
        return this.shipIdAutoIncrement++;
    }

    public isEnemyPresenceTick(): boolean {
        if (this.enemyPresenceTick <= 0) {
            this.enemyPresenceTick = 10 * 30;
            return true;
        } else {
            this.enemyPresenceTick -= 1;
            return false;
        }
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

        // build exploration graph for which planets to explore and in what order
        this.buildExplorationGraph();
    }

    /**
     * Build a map of the world from the faction's point of view.
     */
    buildExplorationGraph() {
        const homeWorld = this.instance.planets.find(planet => planet.id === this.homeWorldPlanetId);
        if (homeWorld) {
            for (const planet of this.instance.planets) {
                if (planet.pathingNode && homeWorld.pathingNode && planet.id !== homeWorld.id) {
                    const path = homeWorld.pathingNode.pathToObject(planet.pathingNode);
                    if (path.length === 0) {
                        throw new Error("Found 0 length path, could not build AI map to world");
                    }
                    const distance = path.slice(-1).reduce((acc: {
                        lastPosition: [number, number, number],
                        totalDistance: number
                    }, vertex) => {
                        // detect duplicate point, or the same point twice.
                        if (DelaunayGraph.distanceFormula(acc.lastPosition, vertex) < 0.00001) {
                            return {
                                lastPosition: vertex,
                                totalDistance: acc.totalDistance
                            };
                        }

                        const segmentDistance = VoronoiGraph.angularDistance(acc.lastPosition, vertex, this.instance.worldScale);
                        return {
                            lastPosition: vertex,
                            totalDistance: acc.totalDistance + segmentDistance
                        };
                    }, {
                        lastPosition: homeWorld.position.rotateVector([0, 0, 1]),
                        totalDistance: 0
                    }).totalDistance;

                    this.explorationGraph[planet.id] = {
                        distance,
                        settlerShipIds: [],
                        traderShipIds: [],
                        pirateShipIds: [],
                        enemyStrength: 0,
                        planet
                    };
                }
            }
        }
    }

    /**
     * Apply a new luxury buff to a faction.
     * @param account A gold holding account which increases after trading.
     * @param resourceType The resource type affects the buff.
     * @param planetId The source world of the goods.
     */
    public applyLuxuryBuff(account: IGoldAccount, resourceType: EResourceType, planetId: string) {
        const oldLuxuryBuff = this.luxuryBuffs.find(l => l.matches(resourceType, planetId));
        if (oldLuxuryBuff) {
            const percentReplenished = oldLuxuryBuff.replenish();
            const goldProfit = Math.floor(oldLuxuryBuff.goldValue() * percentReplenished);
            const goldBonus = Math.floor(goldProfit * 0.2);
            this.gold -= goldBonus;
            account.gold += goldBonus;
        } else {
            this.luxuryBuffs.push(new LuxuryBuff(this.instance, this, resourceType, planetId));
        }
    }

    public getFactionNextShipType(): EShipType {
        if (this.shipsAvailable[EShipType.SLOOP] < Math.ceil(this.shipIds.length * (1 / 2))) {
            return EShipType.SLOOP;
        }
        if (this.shipsAvailable[EShipType.CORVETTE] < Math.ceil(this.shipIds.length * (1 / 3))) {
            return EShipType.CORVETTE;
        }
        if (this.shipsAvailable[EShipType.HIND] < Math.ceil(this.shipIds.length * (1 / 6))) {
            return EShipType.HIND;
        }
        return EShipType.SLOOP;
    }

    /**
     * Faction AI loop.
     */
    public handleFactionLoop() {
        // pay captains to buy new ships
        this.gold -= 0.1;
        this.instance.gold += 0.1;

        // captain new AI ships
        const factionNextShipType = this.getFactionNextShipType();
        for (const planetId of this.planetIds) {
            const planet = this.instance.planets.find(p => p.id === planetId);
            if (planet && planet.getNumShipsAvailable(factionNextShipType) > 2 && this.shipIds.length < 50 && this.gold >= planet.shipyard.quoteShip(factionNextShipType)) {
                planet.spawnShip(this, factionNextShipType, true);
            }
        }

        // handle the luxury buffs from trading
        const expiredLuxuryBuffs: LuxuryBuff[] = [];
        for (const luxuryBuff of this.luxuryBuffs) {
            const expired = luxuryBuff.expired();
            if (expired) {
                expiredLuxuryBuffs.push(luxuryBuff);
            } else {
                luxuryBuff.handleLuxuryBuffLoop();
            }
        }
        for (const expiredLuxuryBuff of expiredLuxuryBuffs) {
            expiredLuxuryBuff.remove();
        }

        // handle enemy presence loop
        if (this.isEnemyPresenceTick()) {
            for (const node of Object.values(this.explorationGraph)) {
                if (node.enemyStrength > 0) {
                    node.enemyStrength -= 1;
                }
            }
        }
    }

    /**
     * Give an order to a ship.
     * @param ship
     */
    public getOrder(ship: Ship): Order {
        const shipData = SHIP_DATA.find(s => s.shipType === ship.shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }

        const entries = Object.entries(this.explorationGraph)
            .sort((a, b) => a[1].distance - b[1].distance);

        // find worlds to pirate
        const pirateWorldEntry = entries.find(entry => {
            // settle new worlds which have not been settled yet
            const roomToPirate = entry[1].pirateShipIds.length === 0;
            const weakEnemyPresence = entry[1].enemyStrength <= 0;
            const isSettledEnoughToTrade = entry[1].planet.settlementLevel >= ESettlementLevel.OUTPOST &&
                entry[1].planet.settlementLevel <= ESettlementLevel.TERRITORY;
            const isOwnedByEnemy = Object.values(this.instance.factions).some(faction => {
                if (faction.id === this.id) {
                    // skip the faction itself
                    return false;
                } else {
                    // the faction should pirate other factions
                    return faction.planetIds.includes(entry[0]);
                }
            });
            return roomToPirate && weakEnemyPresence && isSettledEnoughToTrade && isOwnedByEnemy;
        });

        // find worlds to trade
        const tradeWorldEntry = entries.find(entry => {
            // settle new worlds which have not been settled yet
            const roomToTrade = entry[1].traderShipIds.length <= entry[1].planet.resources.length - shipData.cargoSize;
            const isSettledEnoughToTrade = entry[1].planet.settlementLevel >= ESettlementLevel.OUTPOST;
            const notTradedYet = Object.values(this.instance.factions).every(faction => {
                if (faction.id === this.id) {
                    // skip the faction itself
                    return true;
                } else {
                    // the faction should not colonize another planet colonized by another faction
                    return !faction.planetIds.includes(entry[0]);
                }
            });
            return roomToTrade && isSettledEnoughToTrade && notTradedYet;
        });

        // find worlds to settle
        const settlementWorldEntry = entries.find(entry => {
            // settle new worlds which have not been settled yet
            const roomToSettleMore = entry[1].settlerShipIds.length <=
                Planet.NUM_SETTLEMENT_PROGRESS_STEPS -
                Math.round(entry[1].planet.settlementProgress * Planet.NUM_SETTLEMENT_PROGRESS_STEPS) - shipData.settlementProgressFactor;
            const notSettledYet = Object.values(this.instance.factions).every(faction => {
                if (faction.id === this.id) {
                    // skip the faction itself
                    return true;
                } else {
                    // the faction should not colonize another planet colonized by another faction
                    return !faction.planetIds.includes(entry[0]);
                }
            });
            return roomToSettleMore && notSettledYet;
        });

        if (pirateWorldEntry && shipData.cannons.numCannons > 4) {
            // found a piracy slot, add ship to pirate
            pirateWorldEntry[1].pirateShipIds.push(ship.id);

            const order = new Order(this.instance, ship, this);
            order.orderType = EOrderType.PIRATE;
            order.planetId = pirateWorldEntry[0];
            order.expireTicks = 10 * 60 * 20; // pirate for 20 minutes before signing a new contract
            return order;
        } else if (tradeWorldEntry && shipData.cannons.numCannons <= 4) {
            // found a trade slot, add ship to trade
            tradeWorldEntry[1].traderShipIds.push(ship.id);

            const order = new Order(this.instance, ship, this);
            order.orderType = EOrderType.TRADE;
            order.planetId = tradeWorldEntry[0];
            order.expireTicks = 10 * 60 * 20; // trade for 20 minutes before signing a new contract
            return order;
        } else if (settlementWorldEntry) {
            // add ship to colonize
            settlementWorldEntry[1].settlerShipIds.push(ship.id);

            const order = new Order(this.instance, ship, this);
            order.orderType = EOrderType.SETTLE;
            order.planetId = settlementWorldEntry[0];
            return order;
        } else {
            // add ship to explore
            const order = new Order(this.instance, ship, this);
            order.orderType = EOrderType.ROAM;
            return order;
        }
    }

    public handleShipDestroyed(ship: Ship) {
        // remove ship from exploration graph
        for (const order of ship.orders) {
            if (!order.planetId) {
                continue;
            }

            const node = this.explorationGraph[order.planetId];
            const settlerIndex = node.settlerShipIds.findIndex(s => s === ship.id);
            if (settlerIndex >= 0) {
                node.settlerShipIds.splice(settlerIndex, 1);
            }
            const traderIndex = node.traderShipIds.findIndex(s => s === ship.id);
            if (traderIndex >= 0) {
                node.traderShipIds.splice(traderIndex, 1);
            }
            const pirateIndex = node.pirateShipIds.findIndex(s => s === ship.id);
            if (pirateIndex >= 0) {
                node.pirateShipIds.splice(pirateIndex, 1);
            }
        }

        // remove ship from faction registry
        const shipIndex = this.shipIds.findIndex(s => s === ship.id);
        if (shipIndex >= 0) {
            this.shipIds.splice(shipIndex, 1);
        }
        this.shipsAvailable[ship.shipType] -= 1;
    }
}