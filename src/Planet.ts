import {ESettlementLevel, ICameraState, IGoldAccount} from "./Interface";
import Quaternion from "quaternion";
import {DelaunayGraph, PathingNode} from "./Graph";
import {CAPITAL_GOODS, EResourceType, OUTPOST_GOODS} from "./Resource";
import {EShipType, Ship, SHIP_DATA} from "./Ship";
import App from "./App";

export class ShipyardDock {
    public instance: App;
    public planet: Planet;
    public shipyard: Shipyard;
    public progress: number = 0;
    public shipCost: number = 0;
    public shipType: EShipType | null = null;

    constructor(instance: App, planet: Planet, shipyard: Shipyard) {
        this.instance = instance;
        this.planet = planet;
        this.shipyard = shipyard;
    }

    public beginBuildingOfShip(shipType: EShipType) {
        const shipData = SHIP_DATA.find(i => i.shipType === shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }
        this.shipCost = shipData.cost;
        this.progress = 0;
        this.shipType = shipData.shipType;
    }

    /**
     * Handle the construction of a ship.
     */
    public handleShipyardDockLoop() {
        // handle ship building progress
        if (this.progress < this.shipCost) {
            this.progress += 1;

            if (this.progress >= this.shipCost) {
                // ship is done
                this.shipyard.dockIsDone(this);
            }
        }
    }

    /**
     * Determine if a shipyard is done.
     */
    public isDone(): boolean {
        return this.progress >= this.shipCost;
    }
}

/**
 * A shipyard which spawns ships.
 */
export class Shipyard {
    public instance: App;
    public planet: Planet;
    public docks: ShipyardDock[] = [];
    public numberOfDocks: number = 10;
    public numShipsAvailable: number = 0;
    public shipsAvailable: Record<EShipType, number> = {
        [EShipType.SLOOP]: 0,
        [EShipType.CORVETTE]: 0,
        [EShipType.HIND]: 0
    };
    public shipsBuilding: Record<EShipType, number> = {
        [EShipType.SLOOP]: 0,
        [EShipType.CORVETTE]: 0,
        [EShipType.HIND]: 0
    };

    constructor(instance: App, planet: Planet) {
        this.instance = instance;
        this.planet = planet;
    }

    public getNextShipTypeToBuild(): EShipType {
        if (this.shipsAvailable.SLOOP + this.shipsBuilding.SLOOP < 3) {
            return EShipType.SLOOP;
        }
        if (this.shipsAvailable.CORVETTE + this.shipsBuilding.CORVETTE < 3) {
            return EShipType.CORVETTE;
        }
        return EShipType.HIND;
    }

    /**
     * Build a new ship once in a while.
     */
    public handleShipyardLoop() {
        const nextShipTypeToBuild = this.getNextShipTypeToBuild();
        const shipData = SHIP_DATA.find(i => i.shipType === nextShipTypeToBuild);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }

        // build ship when there is enough wood and enough room
        if (this.planet.wood >= shipData.cost && this.docks.length < this.numberOfDocks) {
            this.buildShip(shipData.shipType);
        }

        // handle each dock
        for (const dock of this.docks) {
            dock.handleShipyardDockLoop();
        }
    }

    /**
     * Begin the process of building a ship.
     */
    public buildShip(shipType: EShipType) {
        const shipData = SHIP_DATA.find(i => i.shipType === shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }

        // give wood to dock and begin building of ship.
        this.planet.wood -= shipData.cost;
        const dock = new ShipyardDock(this.instance, this.planet, this);
        this.docks.push(dock);
        dock.beginBuildingOfShip(shipType);
        this.shipsBuilding[shipType] += 1;
    }

    /**
     * Event handler when a dock is done being built.
     * @param dock
     */
    public dockIsDone(dock: ShipyardDock) {
        if (!dock.shipType) {
            throw new Error("Dock must have ship type to be done");
        }
        this.shipsBuilding[dock.shipType] -= 1;
        this.numShipsAvailable += 1;
        this.shipsAvailable[dock.shipType] += 1;
    }

    /**
     * Player bought a ship from the shipyard.
     */
    public buyShip(account: IGoldAccount, shipType: EShipType, asFaction: boolean = false): Ship {
        // check gold
        const shipPrice = this.quoteShip(shipType, asFaction);
        if (account.gold < shipPrice) {
            throw new Error("Need more gold to buy this ship");
        }

        // perform gold transaction
        account.gold -= shipPrice;
        const goldToTaxes = Math.ceil(shipPrice * 0.5);
        const goldProfit = shipPrice - goldToTaxes;
        this.planet.taxes += goldToTaxes;
        this.planet.gold += goldProfit;

        // spawn the ship
        const doneDockIndex = this.docks.findIndex(d => d.isDone() && d.shipType === shipType);
        const dock = this.docks[doneDockIndex];
        if (!dock.shipType) {
            throw new Error("Dock must have ship type to be done");
        }
        this.docks.splice(doneDockIndex, 1);
        this.numShipsAvailable -= 1;
        this.shipsAvailable[dock.shipType] -= 1;
        return this.planet.createShip(dock.shipType);
    }

    /**
     * The price of the ship to buy.
     */
    public quoteShip(shipType: EShipType, asFaction: boolean = false): number {
        // factions get free ships
        if (asFaction) {
            return 0;
        }

        const shipData = SHIP_DATA.find(i => i.shipType === shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }

        const priceCeiling = Math.ceil(shipData.cost * 3);
        const priceFloor = 0;
        const price = Math.ceil(shipData.cost * (3 / (this.shipsAvailable[shipData.shipType])));
        return Math.max(priceFloor, Math.min(price, priceCeiling));
    }
}

export class Planet implements ICameraState {
    public instance: App;
    public id: string = "";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public color: string = "blue";
    public size: number = 3;
    public settlementProgress: number = 0;
    public settlementLevel: ESettlementLevel = ESettlementLevel.UNTAMED;
    public pathingNode: PathingNode<DelaunayGraph<Planet>> | null = null;
    public resources: EResourceType[];
    public wood: number = 0;
    public gold: number = 0;
    public taxes: number = 0;
    public shipyard: Shipyard;
    private resourceCycle: number = 0;

    /**
     * Number of settlements to colonize a planet.
     */
    public static NUM_SETTLEMENT_PROGRESS_STEPS = 20;

    /**
     * Get the number of ships available.
     */
    public getNumShipsAvailable(shipType: EShipType): number {
        return this.shipyard.shipsAvailable[shipType];
    }

    constructor(instance: App) {
        this.instance = instance;

        // initialize the natural resources
        this.resources = [];
        const numResources = Math.floor(Math.random() * 2 + 1);
        const resourceValues = Object.values(OUTPOST_GOODS);
        for (let i = 0; i < 100 && this.resources.length < numResources; i++) {
            const randomResource = resourceValues[Math.floor(Math.random() * resourceValues.length)];
            if (!this.resources.includes(randomResource)) {
                this.resources.push(randomResource);
            }
        }

        // initialize the shipyard
        this.shipyard = new Shipyard(this.instance, this);
    }

    public handlePlanetLoop() {
        if (this.settlementLevel <= ESettlementLevel.OUTPOST) {
            // planets smaller than colonies do nothing
            return;
        }

        // collect wood
        this.wood += (this.settlementLevel / 5);

        // handle ship building
        this.shipyard.handleShipyardLoop();
    }

    /**
     * The planet will trade with a ship.
     * @param ship
     * @param unload if the ship will not take cargo
     */
    trade(ship: Ship, unload: boolean = false) {
        // a list of items to buy from ship and sell to ship
        let goodsToTake: EResourceType[] = [];
        let goodsToOffer: EResourceType[] = [];

        // different levels of settlements take different goods
        if (this.settlementLevel === ESettlementLevel.UNTAMED) {
            goodsToTake = CAPITAL_GOODS;
            goodsToOffer = [];
        } else if (this.settlementLevel === ESettlementLevel.OUTPOST) {
            goodsToTake = CAPITAL_GOODS;
            goodsToOffer = this.resources;
        } else if (this.settlementLevel === ESettlementLevel.CAPITAL) {
            // the capital will take outpost goods an pirated goods
            goodsToTake = Array.from(new Set([
                ...OUTPOST_GOODS,
                ...ship.cargo.filter(c => c.pirated).map(c => c.resourceType)
            ]));
            goodsToOffer = this.resources;
        }

        // do not take cargo, because the ship is beginning a piracy mission
        if (unload) {
            goodsToOffer = [];
        }

        // trade with the ship
        for (const goodToTake of goodsToTake) {
            const boughtGood = ship.buyGoodFromShip(goodToTake);
            if (boughtGood) {
                const faction = Object.values(this.instance.factions).find(f => f.homeWoldPlanetId === this.id);
                if (faction) {
                    faction.applyLuxuryBuff(this.instance, goodToTake, boughtGood.sourcePlanetId);
                }
            }
        }
        for (let i = 0; i < goodsToOffer.length; i++) {
            if (ship.sellGoodToShip(goodsToOffer[this.resourceCycle % this.resources.length], this.id)) {
                this.resourceCycle = (this.resourceCycle + 1) % this.resources.length;
            }
        }
    }

    /**
     * Create a new ship.
     */
    public spawnShip(account: IGoldAccount, shipType: EShipType, asFaction: boolean = false): Ship {
        // check ship availability
        if (this.shipyard.shipsAvailable[shipType] === 0) {
            throw new Error("No ships available");
        }

        // perform gold transaction, paying 50% taxes to the faction
        return this.shipyard.buyShip(account, shipType, asFaction);
    }

    createShip(shipType: EShipType): Ship {
        // get the position of the planet
        const planetWorld = this.instance.planets.find(p => p.id === this.id);
        if (!planetWorld) {
            throw new Error("Could not find planet to spawn ship");
        }
        const shipPoint = planetWorld.position.rotateVector([0, 0, 1]);

        // get faction of the ship
        const faction = Object.values(this.instance.factions).find(f => f.planetIds.includes(this.id));
        if (!faction) {
            throw new Error("Could not find faction to spawn ship");
        }

        // create ship
        const ship = new Ship(this.instance, shipType);
        ship.faction = faction;
        ship.id = `ship-${this.id}-${faction.getShipAutoIncrement()}`;
        App.addRandomPositionAndOrientationToEntity(ship);
        ship.position = Quaternion.fromBetweenVectors([0, 0, 1], shipPoint);
        ship.color = faction.factionColor;

        // the faction ship
        faction.shipIds.push(ship.id);
        faction.instance.ships.push(ship);
        faction.shipsAvailable[ship.shipType] += 1;

        return ship;
    }
}