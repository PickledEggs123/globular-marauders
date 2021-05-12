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
    private sentDoneSignal: boolean = false;

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
        }
        if (this.progress >= this.shipCost && !this.sentDoneSignal) {
            // ship is done
            this.shipyard.dockIsDone(this);
            this.sentDoneSignal = true;
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
 * The different types of upgradable buildings.
 */
export enum EBuildingType {
    /**
     * A building which produces wood.
     */
    FORESTRY = "FORESTRY",
    /**
     * A building which produces iron.
     */
    MINE = "MINE",
    /**
     * A building which produces tools and weapons.
     */
    BLACKSMITH = "BLACKSMITH",
    /**
     * The building which produces new ships
     */
    SHIPYARD = "SHIPYARD",
}

/**
 * A building on a planet which can produce resources, to help the island planet function.
 */
export abstract class Building {
    public instance: App;
    public planet: Planet;
    /**
     * The type of a building.
     */
    public abstract buildingType: EBuildingType;
    /**
     * The level of the building.
     */
    public buildingLevel: number = 1;
    /**
     * The upgrade progress of a building.
     */
    public upgradeProgress: number = 0;
    /**
     * Handle the basic function of the building.
     */
    public handleBuildingLoop(): void {
        // basic upgrade loop
        if (this.upgradeProgress > 0) {
            this.upgradeProgress -= 1;
            if (this.upgradeProgress <= 0) {
                this.buildingLevel += 1;
            }
        }
    }
    /**
     * The upgrade cost of the building.
     */
    public abstract getUpgradeCost(): number;
    /**
     * Begin the upgrade of a building.
     */
    public upgrade(): void {
        // do not upgrade a building that is already upgrading
        if (this.upgradeProgress > 0) {
            return;
        }

        // five minutes to upgrade
        const upgradeCost = this.getUpgradeCost();
        this.planet.woodConstruction -= upgradeCost;
        this.upgradeProgress = upgradeCost;
    }

    constructor(instance: App, planet: Planet) {
        this.instance = instance;
        this.planet = planet;
    }
}

/**
 * A shipyard which spawns ships.
 */
export class Shipyard extends Building {
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

    buildingType: EBuildingType = EBuildingType.SHIPYARD;

    getUpgradeCost(): number {
        // 5 minutes to begin upgrade
        return 5 * 60 * 10 * Math.pow(this.buildingLevel, Math.sqrt(2));
    }

    public getNextShipTypeToBuild(): EShipType {
        if (this.shipsAvailable.SLOOP + this.shipsBuilding.SLOOP < this.numberOfDocks * 3 / 10) {
            return EShipType.SLOOP;
        }
        if (this.shipsAvailable.CORVETTE + this.shipsBuilding.CORVETTE < this.numberOfDocks * 3 / 10) {
            return EShipType.CORVETTE;
        }
        return EShipType.HIND;
    }

    public getNumberOfDocksAtUpgradeLevel(): number {
        return this.buildingLevel * 10;
    }

    /**
     * Build a new ship once in a while.
     */
    public handleBuildingLoop() {
        super.handleBuildingLoop();

        // handle dock upgrades
        const nextNumberOfDocks = this.getNumberOfDocksAtUpgradeLevel();
        if (this.numberOfDocks !== nextNumberOfDocks) {
            this.numberOfDocks = nextNumberOfDocks;
        }

        const nextShipTypeToBuild = this.getNextShipTypeToBuild();
        const shipData = SHIP_DATA.find(i => i.shipType === nextShipTypeToBuild);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }

        // build ship when there is enough wood and enough room
        if (
            this.planet.wood >= shipData.cost &&
            this.planet.cannons >= shipData.cannons.numCannons &&
            this.planet.cannonades >= shipData.cannons.numCannonades &&
            this.docks.length < this.numberOfDocks
        ) {
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
        this.planet.cannons -= shipData.cannons.numCannons;
        this.planet.cannonades -= shipData.cannons.numCannonades;
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
        if (!(dock && dock.shipType)) {
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
        const price = Math.ceil(shipData.cost * (3 / (this.shipsAvailable[shipData.shipType] / this.getNumberOfDocksAtUpgradeLevel() * 10)));
        return Math.max(priceFloor, Math.min(price, priceCeiling));
    }
}

/**
 * A building which produces wood.
 */
export class Forestry extends Building {
    buildingType: EBuildingType = EBuildingType.FORESTRY;

    getUpgradeCost(): number {
        // forestry requires 2 minutes to begin upgrade
        return 2 * 60 * 10 * Math.pow(this.buildingLevel, Math.sqrt(2));
    }

    handleBuildingLoop() {
        super.handleBuildingLoop();

        // add wood proportional to building level
        this.planet.wood += this.buildingLevel;
        this.planet.woodConstruction += this.buildingLevel;

        // TODO: add mahogany wood for luxury furniture
    }
}

/**
 * A building which produces minerals.
 */
export class Mine extends Building {
    buildingType: EBuildingType = EBuildingType.MINE;

    getUpgradeCost(): number {
        // mine requires 2 minutes to begin upgrade
        return 2 * 60 * 10 * Math.pow(this.buildingLevel, Math.sqrt(2));
    }

    handleBuildingLoop() {
        super.handleBuildingLoop();

        // add iron proportional to building level
        this.planet.iron += this.buildingLevel;
        this.planet.ironConstruction += this.buildingLevel;

        // add coal for steel forging
        this.planet.coal += this.buildingLevel;
        this.planet.coalConstruction += this.buildingLevel;

        // TODO: add add gems for jewelry, each island will have its own specific gem
        /**
         * Gems and Jewelry is required for treasure hunting. Islands will gather a specific gem, specific to each island.
         * Gems can be sold to jeweler who will create jewelry which will be stored into treasure piles. Treasure can
         * be traded or sold on market.
         *
         * Pirates will raid islands for Jewelry, gold, and resources.
         */

        // TODO: add marble
    }
}

/**
 * A building which produces wood.
 */
export class Blacksmith extends Building {
    buildingType: EBuildingType = EBuildingType.BLACKSMITH;

    getUpgradeCost(): number {
        // blacksmith currently is not upgradable
        return Number.MAX_VALUE;
    }

    handleBuildingLoop() {
        super.handleBuildingLoop();

        // convert iron into iron cannon balls, weapons
        if (this.planet.cannons < 10 && this.planet.iron >= 40 && this.planet.coal >= 40) {
            this.planet.iron -= 40;
            this.planet.coal -= 40;
            this.planet.cannons += 1;
        } else if (this.planet.cannonades < 10 && this.planet.iron >= 10 && this.planet.coal >= 10) {
            this.planet.iron -= 10;
            this.planet.coal -= 10;
            this.planet.cannonades += 1;
        } else if (this.planet.cannons < 100 && this.planet.iron >= 40 && this.planet.coal >= 40) {
            this.planet.iron -= 40;
            this.planet.coal -= 40;
            this.planet.cannons += 1;
        } else if (this.planet.cannonades < 100 && this.planet.iron >= 10 && this.planet.coal >= 10) {
            this.planet.iron -= 10;
            this.planet.coal -= 10;
            this.planet.cannonades += 1;
        } else if (this.planet.cannons < 300 && this.planet.iron >= 40 && this.planet.coal >= 40) {
            this.planet.iron -= 40;
            this.planet.coal -= 40;
            this.planet.cannons += 1;
        }
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
    // the amount of wood available to build ships
    public wood: number = 0;
    // the amount of wood available to build buildings
    public woodConstruction: number = 0;
    // the amount of iron available to build ships
    public iron: number = 0;
    // the amount of iron available to build buildings
    public ironConstruction: number = 0;
    // the amount of coal available to build ships
    public coal: number = 0;
    // the amount of coal available to build buildings
    public coalConstruction: number = 0;
    // the number of cannons for building ships
    public cannons: number = 0;
    // the number of cannonades for building ships
    public cannonades: number = 0;
    // the amount of gold to spend
    public gold: number = 0;
    // the amount of taxes to send back to the capital
    public taxes: number = 0;
    // a building which builds ships
    public shipyard: Shipyard;
    // a building which chops down trees for wood
    public forestry: Forestry;
    // a building which mines iron, coal, gems, and marble
    public mine: Mine;
    // a building which produces weapons and tools
    public blacksmith: Blacksmith;
    // a list of buildings to upgrade
    private readonly buildings: Building[];
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

        // initialize buildings
        this.shipyard = new Shipyard(this.instance, this);
        this.forestry = new Forestry(this.instance, this);
        this.mine = new Mine(this.instance, this);
        this.blacksmith = new Blacksmith(this.instance, this);
        this.buildings = [
            this.shipyard,
            this.forestry,
            this.mine,
            this.blacksmith,
        ];
    }

    public handlePlanetLoop() {
        if (this.settlementLevel <= ESettlementLevel.OUTPOST) {
            // planets smaller than colonies do nothing
            return;
        }

        // handle buildings
        for (const building of this.buildings) {
            building.handleBuildingLoop();
        }

        // handle upgrades of buildings
        const {
            nextBuilding,
            nextBuildingCost
        } = this.getNextBuildingUpgrade();
        if (this.woodConstruction >= nextBuildingCost) {
            nextBuilding.upgrade();
        }
    }

    /**
     * Determine the next building to upgrade.
     */
    getNextBuildingUpgrade(): {
        nextBuilding: Building,
        nextBuildingCost: number
    } {
        // find cheapest building to upgrade
        let nextBuilding: Building | null = null;
        let nextBuildingCost: number | null = null;
        for (const building of this.buildings) {
            // skip buildings which are upgrading.
            if (building.upgradeProgress > 0) {
                continue;
            }
            const buildingCost = building.getUpgradeCost();
            if (!nextBuildingCost || (nextBuildingCost && buildingCost < nextBuildingCost)) {
                nextBuilding = building;
                nextBuildingCost = buildingCost;
            }
        }
        if (nextBuilding && nextBuildingCost) {
            return {
                nextBuilding,
                nextBuildingCost
            };
        } else {
            throw new Error("Could not find a building to get upgrade costs");
        }
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
                const faction = Object.values(this.instance.factions).find(f => f.homeWorldPlanetId === this.id);
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