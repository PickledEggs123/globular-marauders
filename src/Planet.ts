import {
    EDirectedMarketTradeDirection,
    ESettlementLevel,
    ICameraState,
    ICurrency,
    IDirectedMarketTrade,
    IExplorationGraphData,
    ITradeDeal,
    MoneyAccount
} from "./Interface";
import Quaternion from "quaternion";
import {DelaunayGraph, PathingNode, VoronoiGraph} from "./Graph";
import {
    CAPITAL_GOODS,
    CONSUMABLE_RESOURCES,
    EResourceType,
    ICargoItem,
    IItemRecipe,
    ITEM_DATA,
    ITEM_RECIPES,
    NATURAL_RESOURCES,
    OUTPOST_GOODS
} from "./Resource";
import {EShipType, Ship, SHIP_DATA} from "./Ship";
import App from "./App";
import {FeudalGovernment, VoronoiCounty} from "./VoronoiTree";
import {ERoyalRank, Faction, LuxuryBuff} from "./Faction";
import {EOrderType, Order} from "./Order";
import {Server} from "./Server";

export interface IResourceExported {
    resourceType: EResourceType;
    amount: number;
    feudalObligation: boolean;
}

export interface IResourceProduced extends IItemRecipe {
    amount: number;
}

export class ShipyardDock {
    public instance: Server;
    public planet: Planet;
    public shipyard: Shipyard;
    public progress: number = 0;
    public shipCost: number = 0;
    public shipType: EShipType | null = null;
    private sentDoneSignal: boolean = false;

    constructor(instance: Server, planet: Planet, shipyard: Shipyard) {
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
     * A building which produces a natural resource.
     */
    PLANTATION = "PLANTATION",
    /**
     * A building which produces a refined product.
     */
    MANUFACTORY = "MANUFACTORY",
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
    public instance: Server;
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
                this.planet.recomputeResources();
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

    constructor(instance: Server, planet: Planet) {
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
        [EShipType.CUTTER]: 0,
        [EShipType.SLOOP]: 0,
        [EShipType.CORVETTE]: 0,
        [EShipType.BRIGANTINE]: 0,
        [EShipType.BRIG]: 0,
        [EShipType.FRIGATE]: 0
    };
    public shipsBuilding: Record<EShipType, number> = {
        [EShipType.CUTTER]: 0,
        [EShipType.SLOOP]: 0,
        [EShipType.CORVETTE]: 0,
        [EShipType.BRIGANTINE]: 0,
        [EShipType.BRIG]: 0,
        [EShipType.FRIGATE]: 0
    };

    buildingType: EBuildingType = EBuildingType.SHIPYARD;

    getUpgradeCost(): number {
        // 5 minutes to begin upgrade
        return 5 * 60 * 10 * Math.pow(this.buildingLevel + 1, Math.sqrt(2));
    }

    public getNextShipTypeToBuild(): EShipType {
        if (this.shipsAvailable.CUTTER + this.shipsBuilding.CUTTER < this.numberOfDocks * 3 / 10) {
            return EShipType.CUTTER;
        }
        if (this.shipsAvailable.SLOOP + this.shipsBuilding.SLOOP < this.numberOfDocks * 3 / 10) {
            return EShipType.SLOOP;
        }
        return EShipType.CORVETTE;
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
    public buyShip(account: MoneyAccount, shipType: EShipType, asFaction: boolean = false): Ship {
        // check gold
        const shipPrice = this.quoteShip(shipType, asFaction);
        if (!account.hasEnough(shipPrice)) {
            throw new Error("Need more gold to buy this ship");
        }

        // perform gold transaction
        if (!this.planet.moneyAccount) {
            throw new Error("Shipyard building ships without money account");
        }
        PlanetaryMoneyAccount.MakePaymentWithTaxes(account, this.planet.moneyAccount, shipPrice, 0.5);

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
    public quoteShip(shipType: EShipType, asFaction: boolean = false): ICurrency[] {
        // factions get free ships
        if (asFaction) {
            return [];
        }

        const shipData = SHIP_DATA.find(i => i.shipType === shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }

        const priceCeiling = Math.ceil(shipData.cost * 3);
        const priceFloor = 0;
        const price = Math.ceil(shipData.cost * (3 / (this.shipsAvailable[shipData.shipType] / this.getNumberOfDocksAtUpgradeLevel() * 10)));
        const goldAmount = Math.max(priceFloor, Math.min(price, priceCeiling));
        return [{
            currencyId: "GOLD",
            amount: goldAmount
        }];
    }
}

/**
 * A building which produces wood.
 */
export class Forestry extends Building {
    buildingType: EBuildingType = EBuildingType.FORESTRY;

    getUpgradeCost(): number {
        // forestry requires 2 minutes to begin upgrade
        return 2 * 60 * 10 * Math.pow(this.buildingLevel + 1, Math.sqrt(2));
    }

    handleBuildingLoop() {
        super.handleBuildingLoop();

        // add wood proportional to building level
        this.planet.wood += this.buildingLevel;
        this.planet.woodConstruction += this.buildingLevel;
    }
}

/**
 * A building which produces natural resources.
 */
export class Plantation extends Building {
    buildingType: EBuildingType = EBuildingType.PLANTATION;
    resourceType: EResourceType;

    constructor(instance: Server, planet: Planet, resourceType: EResourceType) {
        super(instance, planet);
        this.resourceType = resourceType;
    }

    getUpgradeCost(): number {
        // forestry requires 2 minutes to begin upgrade
        return 2 * 60 * 10 * Math.pow(this.buildingLevel + 1, Math.sqrt(2));
    }

    handleBuildingLoop() {
        super.handleBuildingLoop();

        // add wood proportional to building level
        const oldProducedResource = this.planet.producedResources.find(r => r.resourceType === this.resourceType);
        if (oldProducedResource) {
            // upgrade resources array
            oldProducedResource.amount = this.buildingLevel;
        } else {
            // add new resources array
            this.planet.producedResources.push({
                resourceType: this.resourceType,
                amount: this.buildingLevel,
                feudalObligation: false,
            });
        }
    }
}

/**
 * A building which produces manufactured resources.
 */
export class Manufactory extends Building {
    buildingType: EBuildingType = EBuildingType.MANUFACTORY;
    recipe: IItemRecipe;

    constructor(instance: Server, planet: Planet, recipe: IItemRecipe) {
        super(instance, planet);
        this.recipe = recipe;
        this.buildingLevel = 0;
    }

    getUpgradeCost(): number {
        // check for available room to upgrade
        const hasRoomToUpgradeManufacturing = this.recipe.ingredients.every(ingredient => {
            let amount = 0;
            for (const resource of this.planet.marketResources) {
                if (resource.resourceType === ingredient.resourceType) {
                    amount += resource.amount;
                }
            }
            return amount >= ingredient.amount * (this.buildingLevel + 1);
        });

        if (hasRoomToUpgradeManufacturing) {
            // factory requires 5 minutes to begin upgrade
            return 5 * 60 * 10 * Math.pow(this.buildingLevel + 1, Math.sqrt(2));
        } else {
            return Number.MAX_VALUE;
        }
    }

    handleBuildingLoop() {
        super.handleBuildingLoop();

        // add wood proportional to building level
        const oldManufacturedResource = this.planet.manufacturedResources.find(r => r.id === this.recipe.id);
        if (oldManufacturedResource) {
            // upgrade resources array
            oldManufacturedResource.amount = this.buildingLevel;
        } else {
            // add new resources array
            this.planet.manufacturedResources.push({
                ...this.recipe,
                amount: this.buildingLevel
            });
        }
    }
}

/**
 * A building which produces minerals.
 */
export class Mine extends Building {
    buildingType: EBuildingType = EBuildingType.MINE;

    getUpgradeCost(): number {
        // mine requires 2 minutes to begin upgrade
        return 2 * 60 * 10 * Math.pow(this.buildingLevel + 1, Math.sqrt(2));
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

export class Star implements ICameraState {
    public instance: Server;
    public id: string = "";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public color: string = "blue";
    public size: number = 3;

    constructor(instance: Server) {
        this.instance = instance;
    }
}

/**
 * The currency system of a planetary economy. Each instance oc planetary economy will link to this which contains
 * the global amount of currency. Increasing currency will allow for short term purchase of goods or as payment of
 * captains after winning a battle. But too much currency will cause prices to double and triple.
 */
export class PlanetaryCurrencySystem {
    /**
     * The name of the currency. Each kingdom will contain it's own paper money, only redeemable in that kingdom. There
     * could be off shore markets which will convert foreign money to local money for a loss. Gold is special in that
     * it can be minted only if Gold ore is discovered. Paper money can be minted at any moment and in any amount.
     */
    public name: string;
    /**
     * The global amount of a currency.
     */
    public globalAmount: number = 0;

    /**
     * Create a currency system.
     * @param name The name of the currency.
     */
    constructor(name: string) {
        this.name = name;
    }

    /**
     * Add more currency to the system. Should be called before giving money to a captain who helped in a battle. Planets
     * need to determine the correct amount of reward.
     * @param amount
     */
    public addCurrency(amount: number) {
        this.globalAmount += amount;
    }

    /**
     * Remove currency from the system. Should be called after collecting taxes. Planets need to determine the correct
     * amount of taxes.
     * @param amount
     */
    public removeCurrency(amount: number) {
        this.globalAmount -= amount;
    }
}

export interface IEconomyDemand {
    resourceType: EResourceType;
    amount: number;
}

/**
 * Compute the demand of a planet over time.
 */
export class PlanetaryEconomyDemand {
    planet: Planet;

    demands: IEconomyDemand[] = [];

    demandTick: number = 0;

    public static DEMAND_TICK_COOL_DOWN: number = 60 * 10;

    constructor(planet: Planet) {
        this.planet = planet;
        for (const resourceType of Object.values(EResourceType)) {
            this.demands.push({
                resourceType,
                amount: 0
            });
        }
    }

    isDemandTick(): boolean {
        if (this.demandTick <= 0) {
            this.demandTick = PlanetaryEconomyDemand.DEMAND_TICK_COOL_DOWN;
            return true;
        } else {
            this.demandTick -= 1;
            return false;
        }
    }

    handleEconomyDemand() {
        // increase demand over time based on settlement progress / population
        if (this.isDemandTick()) {
            const manufactories = this.planet.buildings.filter(b => b.buildingType === EBuildingType.MANUFACTORY);
            for (const demand of this.demands) {
                // reset demand
                demand.amount = 0;

                // add demand for consumables
                if (CONSUMABLE_RESOURCES.includes(demand.resourceType)) {
                    demand.amount += this.planet.settlementProgress;
                }

                // add demand for industrial ingredients
                for (const b of manufactories) {
                    if (b instanceof Manufactory) {
                        const m = b as Manufactory;
                        const ingredient = m.recipe.ingredients.find(i => i.resourceType === demand.resourceType);
                        if (ingredient) {
                            demand.amount += ingredient.amount * m.buildingLevel;
                        }
                    }
                }
            }
        }
    }

    getDemandMultiplierForResource(resourceType: EResourceType) {
        const demand = this.demands.find(d => d.resourceType === resourceType);
        if (demand) {
            return Math.log(demand.amount + 1) / Math.log(3);
        } else {
            return 0;
        }
    }
}

/**
 * A class which stores how many goods are in the economy of a planet, duchy, kingdom, or empire.
 */
export class PlanetaryEconomySystem {
    /**
     * The resources of an economy.
     */
    resources: Array<IResourceExported> = [];
    /**
     * The sum of resource unit value.
     */
    resourceUnitSum: number = 0;
    /**
     * The planets of an economy.
     */
    planets: Planet[] = [];

    /**
     * Add a resource to the economy.
     */
    addResource(resource: IResourceExported) {
        this.resources.push(resource);
        this.resourceUnitSum += resource.amount;
    }

    /**
     * Remove all resources from the economy.
     */
    clearResources() {
        this.resources.splice(0, this.resources.length);
        this.resourceUnitSum = 0;
    }

    /**
     * Recompute the resources of a planet.
     */
    recomputeResources() {
        this.clearResources();
        for (const planet of this.planets) {
            for (const marketResource of planet.marketResources) {
                this.addResource(marketResource);
            }
        }
    }

    /**
     * Add a planet to the economy.
     * @param planet
     */
    addPlanet(planet: Planet) {
        this.planets.push(planet);
    }

    /**
     * Remove a planet from the economy.
     * @param planet The planet to remove.
     */
    removePlanet(planet: Planet) {
        const index = this.planets.findIndex(p => p === planet);
        if (index >= 0) {
            this.planets.splice(index, 1);
        }
    }

    /**
     * Get the unit value of a planet.
     * @param planet
     */
    getPlanetUnitValue(planet: Planet): number {
        return PlanetaryMoneyAccount.BASE_VALUE_PER_PLANET +
            planet.buildings.reduce((acc, building) => {
                return acc + building.buildingLevel * PlanetaryMoneyAccount.VALUE_MULTIPLE_PER_BUILDING_LEVEL;
            }, 0);
    }

    /**
     * Get the number of planet units in an economy.
     */
    getPlanetUnitValueSum(): number {
        return this.planets.reduce((acc, planet) => {
            return acc + this.getPlanetUnitValue(planet);
        }, 0);
    }

    /**
     * Determine the supply of a resource.
     * @param resourceType
     */
    getResourceTypeValueSum(resourceType: EResourceType): number {
        const v = this.resources.reduce((acc, r) => r.resourceType === resourceType ? acc + r.amount : acc, 0);
        return 0.2 + v * 0.2;
    }

    /**
     * Determine the supply of all resources.
     */
    getResourceTypesValueSum(): number {
        let sum = 0;
        for (const resourceType of Object.values(EResourceType)) {
            sum += this.getResourceTypeValueSum(resourceType);
        }
        return sum;
    }

    /**
     * Get the sum of the economy.
     */
    getEconomyValueSum(): number {
        return this.getPlanetUnitValueSum() + this.getResourceTypesValueSum();
    }
}

/**
 * The price of a resource on that planet. Used to determine the market prices of each resource.
 * A market class will be used to find the best deals within the area.
 */
export interface IMarketPrice {
    resourceType: EResourceType;
    price: number;
}

/**
 * A class which simulates the economy of an island.
 */
export class PlanetaryMoneyAccount {
    /**
     * The planet the economy is for.
     */
    public planet: Planet;
    /**
     * The currency of the planetary economy account. Each kingdom has it's own paper money. All kingdoms will respect
     * gold. Pirates which rob a ship with only paper money will either convert paper money or spend paper money in the
     * same place it committed the robbery at. Might be a fun mechanic, trying to pirate a ship, and sink it before being
     * reported, to then spend the money or find someone to convert the money.
     */
    public currencySystem: PlanetaryCurrencySystem;
    /**
     * The economy system for the planetary economy account. Store the sum of resources for each item in the kingdom.
     */
    public economySystem: PlanetaryEconomySystem;

    /**
     * The amount of gold coins ready to spend. Only used by gold.
     */
    public cash: MoneyAccount = new MoneyAccount();
    /**
     * The amount of gold coins reserved for taxes, back to the duke, king, or emperor. Only used by gold.
     */
    public taxes: MoneyAccount = new MoneyAccount();
    /**
     * The amount of gold coins held for reserve by the planetary government. Only used by gold.
     */
    public reserve: MoneyAccount = new MoneyAccount();
    /**
     * The amount of gold coins held by citizens after they are paid for their work.
     */
    public citizenCash: MoneyAccount = new MoneyAccount();
    /**
     * The demands of the citizens, changes the price of goods.
     */
    public citizenDemand: PlanetaryEconomyDemand;
    /**
     * A list of prices for each resource.
     */
    public resourcePrices: IMarketPrice[] = [];

    /**
     * The multiple per crate.
     */
    public static VALUE_MULTIPLE_PER_CRATE: number = 100;
    /**
     * The multiple per level of building on planet.
     */
    public static VALUE_MULTIPLE_PER_BUILDING_LEVEL: number = 1000;
    /**
     * The multiple per planet empty planet.
     */
    public static BASE_VALUE_PER_PLANET: number = 1000;

    /**
     * Create a new planetary economy account;
     * @param planet The planet of the economy.
     * @param currencySystem The currency of the money account.
     * @param economySystem The economy of the money account.
     */
    constructor(planet: Planet, currencySystem: PlanetaryCurrencySystem, economySystem: PlanetaryEconomySystem) {
        this.planet = planet;
        this.currencySystem = currencySystem;
        this.economySystem = economySystem;
        this.citizenDemand = new PlanetaryEconomyDemand(this.planet);
    }

    /**
     * Economy update
     * ===
     * Below is a list of a requirements of the feudal economy of the game, "Globular Marauders". The goals of the
     * economy is to have inflationary effects and a mercantile mindset for fun. By keeping track of various data
     * about the currency, prices will go up and down randomly to simulate a working economy. Losing wars will result
     * in high prices or high taxes, stupidly printing money will result in higher taxes, Running out of gold will
     * hurt the empire.
     *
     * Properties of the ideal video game economy
     * ---
     * Gold is neither created or destroyed, only transferred, unless there's a gold mine.
     * Cash is neither created or destroyed in sales, unless it's grants from a victorious invasion or taxes.
     *
     * Kingdoms will try to pay players to colonize, pirate and invade.
     * - [ ] Kingdoms will create budget and tax plans
     * - [ ] Possible future, players can argue over tax plans in between battles
     * - [ ] Player republics might be fun
     * Kingdoms will try to pay AIs to colonize and trade.
     * Kingdoms will create schemes for world conquest by moving gold around.
     * Players will collect gold and cash for larger ships, royal titles, and a score board retirement.
     * Merchants will collect gold and cash for a citizens cash retirement on a planet.
     * Citizens will collect gold and cash for a making and buying things.
     *
     * Kingdom -> Player
     * ===
     * Players will capture planets will get rewarded with a grant, no taxes.
     * ---
     * Why? When expanding the empire, the
     * new subjects will need their own copy of the imperial currency, so new currency must be created or issued,
     * who better to issue newly minted imperial money to then the players which captured or colonized planets.
     * Loosing land will result in inflation.
     * - [X] Compute planet reward to determining surplus or deficit of currency
     * - [ ] Compute tax plan for planet deficits
     *   - Added taxes based on percentage for ships sold
     *
     * Players will pirate or trade cargo with taxable money.
     *  ---
     * This money will be included as part of the tax target in the future. Too much untaxed cargo will result
     * in inflation.
     * - [X] Compute resource reward to determine payment for cargo.
     * - [ ] Compute tax plan for cargo
     *
     * Savings goal
     * ---
     * Kingdoms are trying to keep as much money in reserve to pay merchants, pirates, and captains to do the empire
     * building. Kingdoms will determine an amount of gold to circulate and try to keep the rest in reserve. Kingdoms
     * will also institute tariff measures if their reserve gold is low.
     * - [ ] Create tariffs
     *
     * Kingdoms will issue cash (paper currency) and collect taxes, to destroy old cash. Their goal is to keep the
     * amount of circulation balanced to avoid inflation. A great way to cause inflation is to lose land, which results
     * in higher prices or higher taxes.
     * - [X] Create paper cash system
     *
     * Gold is based on the global conquest base line, what percentage of the world does the empire own, then distribute
     * that amount of gold.
     * - [X] Create gold system
     *
     * Cash is based on the price target base line, If prices are too low, distribute more money, if prices are too
     * high, try raising taxes (strange). For example:
     * 1. Kingdom captured a duchy (3 planets), 9 planets (kingdom) is now 12, need to expand currency by 12 / 9 to
     * keep the same constant price, or "give imperial money to new empire so they can use imperial money instead
     * of their original money".
     * 2. Kingdom lost a duchy (3 planets), 9 planets (kingdom) is now 6, need to tax away 3 / 9 of the money to
     * keep the same constant price, or "live with the high prices of a failed state". High prices will cause shortages
     * because players who could afford large ships now have to hold smaller ships, and pay the difference in taxes
     * until the economy returns to normal price level, or pay everyone more money but for less things. (weird).
     * 3. Gold on captured planets will transferred to their new owners so very little monetary balancing has to be
     * done.
     * 4. Losing land is very bad.
     *
     * Barter is part of feudal/colonial obligations, no money involved.
     * - [X] Create feudal obligation system
     *
     * Player -> Kingdom
     * ===
     * Players will buy repairs and ships from planets. Might also buy a title to a planet. Might help upgrade something
     * on the planet.
     *
     * Repairs are offered by planets which send taxes to the local ruler and the empire.
     * - [ ] Create repairs and modifications
     * Ships are offered by planets which send taxes to the local ruler and the empire.
     * - [ ] Create better ship prices, which are part tax plan, maybe K/D ratio can be used for tax bracket.
     * Titles are player own-able objects which can be purchased or given as a gift.
     * - Players which capture planets are given ownership
     * - [ ] Players can own planet and manage planet governance directives
     * - Players which colonize planets are given ownership
     * - When they leave the game, ownership is transferred to the empire
     * - [ ] Players which leave will transfer ownership to second in command
     *   - [ ] If they return before 30 minutes, they get ownership again
     *   - [ ] If they wait more than 30 minutes, second in command becomes official
     *   - [ ] If they're no players in succession, the empire receives ownership
     *   - [ ] The empire can gift or sell titles back to players
     * - Players can sell ownership to other players
     *   - [ ] Players can sell titles to other players or back to the empire
     *
     * Savings goal
     * ---
     * Players are saving money to own larger ships and collect titles. The highest title a player may own is king.
     * Maybe one day, players might be emperors which divide out gold.
     *
     * Kingdom -> Trader -> Kingdom
     * ===
     * Traders will use gold, cash, or barter to trade goods between planets.
     *
     * Gold
     * ---
     * Gold requires reserve, difficult to not run out of gold on one side. Need to keep trade balance. Running out of
     * gold will prevent people from buying. Traders traveling between kingdoms might use gold. One goal of the game
     * is to take all of the gold from a kingdom.
     *
     * Gold requires a trade plan to keep the trade balance unless the kingdom requires a resource it does not have,
     * then it will trade at a trade imbalance. Running out of gold will result in bad effects. No more mercenaries.
     * - [ ] Add gold traders which trade between empires, since gold is a universal transfer of value.
     *
     * Cash
     * ---
     * Cash can be generated as needed, but not enough product sold from Kingdom to Trader will result in too much cash.
     * People will buy too much, resulting in a shortage or increase prices.
     *
     * Cash does not require a trade plan to keep trade balance, When someone sells something to the economy, they
     * receive a cash payment which can be used to buy something from the other planet.
     * - [ ] Add cash traders which trade between gold less colonies, since colonies might share the same cash.
     * - [ ] Add international cash traders which perform cash conversions at a 50% profit.
     *   - Take 1000 cash and give 500 other cash,
     *     go to other kingdom,
     *     buy specific good,
     *     go back home,
     *     sell good for 1000 cash.
     *     - Useful for pirates who don't want to trade in foreign currency.
     *     - Maybe the gold traders are traveling between Kingdom capitals and empires
     *     - Maybe the cash traders are traveling within the kingdom.
     *     - More likely to run into a cash trader
     *       - Cargo sold for cash or gold
     *       - Cash sold for other cash or gold
     *       - Pirates spend cash and gold on rum to rank in the pirate leader boards
     *
     * Barter
     * ---
     * Barter trading resources without money, might be imbalanced towards one side, like a colonial system.
     *
     * Used for imperial tribute, trading without money with the advantage towards the empire.
     * - [X] Partially working, need to finish imperial tribute.
     *   - [X] Add feudal obligation ratio
     *
     * Royal Merchants
     * ---
     * Royal merchants are ships owned by the crown, which trade resources for profit for the crown. All profits
     * will go to the crown. Usually, the Royal merchants are limited to the imperial realm.
     * - [-] Partially working, Royal merchants should collect tribute and perform royal commerce.
     *   - [ ] Perform royal commerce.
     *
     * Independent Merchants
     * ---
     * Players or merchant ships of players which trade resources for profit, Independent merchants can trade across
     * imperial borders.
     * This will mean ships will not attack independent merchants unless the independent merchant damages them.
     * Independent merchants might cause gold deficits.
     * - [ ] Independent merchants
     * - [ ] Independent merchant fleets owned by players
     * - [ ] Merchants which escape from pirates should report piracy
     * - [ ] Pirates can disguise as independent merchants until their close enough to attack.
     * - [ ] Perform independent commerce.
     *
     * Savings goal
     * ---
     * Merchants want to collect money for retirement. When a merchant has enough money, they will sell their ship
     * and take all the cash they collected and put it into the citizens account.
     *  - [ ] Create merchant retirement once merchant reaches a specific amount of profit.
     *
     * Kingdom -> Citizens -> Kingdom
     * ===
     * Citizens are the local workers which produce goods and buy goods. Having more citizens will increase demand
     * and consumption.
     * Citizens also buy goods which increases the demand for traders, which increases the demand for pirates.
     *
     * Paying Citizens
     * ---
     * You pay citizens to work. With money, citizens will work. Gold not necessary, cash payments is good enough.
     * - [ ] Money goes into citizens bank account for their work
     *
     * Citizens with money will accumulate a set of desires for products, citizens will always have food, but the
     * desire is for luxuries such as coffee, tea, furs, rum. This means each planet should have a desire counter
     * which ticks up in time and once a desire has been satisfied, it resets. The money paid for a desire is
     * the Dirichlet of desire multiplied by the total citizen money. Dirichlet is a list of probabilities between
     * 0 and 1 summing to 1. [0.2, 0.2, 0.2, 0.2, 0.2] is a Dirichlet distribution. Traders will queue the best
     * to worse probabilities.
     * - [ ] Implement citizen desire class which keeps track of desire/demand
     * - [ ] Merchants will pick the largest desire and trade, largest desire will provide the most profit.
     *
     * Selling Goods
     * ---
     * Citizens will use the money they accumulated to buy cargo, sold by traders. Citizens will demand a diverse
     * set of goods. Traders will collect the most desired good in the order of desire.
     *
     * Citizens will get paid for 1/2, 1/3, 1/4, 1/5 the value of the final product. This money will go into the
     * citizens bank account. Payment happens once a trade happens.
     *
     * This means merchants must know the amount of resources to buy, to pay the kingdom, to pay the citizens, so the
     * kingdom can give the goods to the merchant, which will return to their original port, to sell the good, to
     * collect payment and profit.
     *
     * Savings goal
     * ---
     * Citizens want to work to collect money to spend it on luxuries.
     * Kingdom cash -> Citizens cash -> Kingdom cash / Merchant profit -> Citizens cash / Merchant Retirement.
     * Feels like kingdoms might run out of money somehow.
     * - [ ] Poor planets will offer merchants a good retirement to attract large lump sums of money. Last ditch
     *       attempt at balancing the economy of an empire. Imagine the poor planet offering more land acres than
     *       a rich planet, some people might prefer more land then expensive city accommodations.
     *
     * Feudal and Market ratio
     * ===
     * Feudal lords can set a ratio between 1/2, 1/3, 1/4, 1/5 of feudal obligations of their vassals, which must send
     * raw goods to the feudal lord. Count -> Duke -> King -> Emperor.
     *
     * At a 1 / 3rd feudal obligation.
     * Counts get 1 resource,  keep 2 / 3 of resources, 0.66.
     * Duke get (3 / 3) + 2 * (1 / 3) = 5 / 3 of resources, keep 10 / 9 of resources, 1.11.
     * King get (3 / 3) + 2 * (1 / 3) + 2 * (5 / 9) = 25 / 9 of resources, keep 50 / 27 of resources, 1.85.
     * Emperor get (3 / 3) + 2 * (1 / 3) + 2 * (5 / 9) + 2 * (25 / 27) = 125 / 27 of resources, 4.63.
     * - [X] Add feudal obligations
     *
     * Royal Merchants
     * ---
     * Resources acquired through feudal obligation can be used to collect money from citizens across the empire as
     * a second form of tax.
     */

    /**
     * --------------------------------------------------------------------------------------------------------------
     * The following section is dedicated to rewarding players for capturing cargo and planets. This is money
     * moving from kingdom to players. Need to compute taxes which is money from players to kingdoms.
     * --------------------------------------------------------------------------------------------------------------
     */
    /**
     * The intrinsic value of a resource.
     * @param resourceType The resource type to check.
     */
    public computeValueForResourceType(resourceType: EResourceType): number {
        const itemData = ITEM_DATA.find(i => i.resourceType === resourceType);
        if (!itemData) {
            throw new Error("Could not find Resource Type");
        }
        return itemData.basePrice;
    }

    /**
     * The prices of the game is based on monetary theory which accounts for inflation and deflation.
     * The formula is M * V = P * Q (money * velocity multiplier = price * quantity). A new price
     * can be computed based on (price = money * velocity multiplier / quantity). Attacking supply will lower the denominator
     * which will cause price to increase. Issuing more money via quests and not enough taxes will also cause money to
     * increase which will increase the price. To decrease price, more taxes or more supply is needed. In theory, areas
     * with more supply (lower prices) will transfer goods to areas with less supply (higher prices). Medieval embargoes,
     * medieval hoarding, and medieval price gouging might be an amusing mechanic.
     *
     * Note: DO NOT FORGET THAT LUXURY BUFFS CAN BE PERCENTAGES OF THE PRICE. REPLENISHING 90% of 100 is 90 gold.
     */
    public computePriceForResourceType(resourceType: EResourceType) {
        const supplySide = (
            this.currencySystem.globalAmount *
            this.computeValueForResourceType(resourceType) *
            PlanetaryMoneyAccount.VALUE_MULTIPLE_PER_CRATE
        ) / (
            this.economySystem.getEconomyValueSum()
        );
        const demandSide = this.citizenDemand.getDemandMultiplierForResource(resourceType);
        return Math.ceil(supplySide * demandSide);
    }

    /**
     * The prices of the game is based on monetary theory which accounts for inflation and deflation.
     * The formula is M * V = P * Q (money * velocity multiplier = price * quantity). A new price
     * can be computed based on (price = money * velocity multiplier / quantity). Attacking supply will lower the denominator
     * which will cause price to increase. Issuing more money via quests and not enough taxes will also cause money to
     * increase which will increase the price. To decrease price, more taxes or more supply is needed. In theory, areas
     * with more supply (lower prices) will transfer goods to areas with less supply (higher prices). Medieval embargoes,
     * medieval hoarding, and medieval price gouging might be an amusing mechanic.
     *
     * Note: DO NOT FORGET THAT LUXURY BUFFS CAN BE PERCENTAGES OF THE PRICE. REPLENISHING 90% of 100 is 90 gold.
     */
    public computePriceForResourceTypeInForeignCurrency(resourceType: EResourceType, currencySystem: PlanetaryCurrencySystem) {
        const supplySide = (
            currencySystem.globalAmount *
            this.computeValueForResourceType(resourceType) *
            PlanetaryMoneyAccount.VALUE_MULTIPLE_PER_CRATE
        ) / (
            this.economySystem.getEconomyValueSum()
        );
        const demandSide = this.citizenDemand.getDemandMultiplierForResource(resourceType);
        return Math.ceil(supplySide * demandSide);
    }

    /**
     * Determine price for a planet.
     * @param planet
     */
    public computePriceForPlanet(planet: Planet) {
        return Math.ceil(
            (
                this.currencySystem.globalAmount *
                this.economySystem.getPlanetUnitValue(planet)
            ) / (
                this.economySystem.getEconomyValueSum()
            )
        );
    }

    /**
     * Determine the reward amount for a set of captured planets. Useful for invasion forces. Kingdoms will reward
     * captains using this formula.
     */
    public determineRewardAmountFromPlanets(planets: Planet[]) {
        let sum = 0;
        for (const planet of planets) {
            sum += this.computePriceForPlanet(planet);
        }
        return Math.ceil(sum);
    }

    /**
     * Determine the reward amount for a set of captured cargo. Useful for pirates. Kingdoms will reward pirates
     * using this formula.
     * @param resources
     */
    public determineRewardAmountFromResources(resources: ICargoItem[]) {
        let sum = 0;
        for (const resource of resources) {
            sum += this.computePriceForResourceType(resource.resourceType) * resource.amount;
        }
        return Math.ceil(sum);
    }

    /**
     * --------------------------------------
     * The following section is for payments
     * --------------------------------------
     */

    /**
     * Pay for something on a planet with taxes.
     * @param account The money account to transfer from.
     * @param other The other money account to use.
     * @param payment The payment to make.
     * @param taxes The percent tax between 0 and 1.
     */
    public static MakePaymentWithTaxes(account: MoneyAccount, other: PlanetaryMoneyAccount, payment: ICurrency[], taxes: number = 0) {
        const taxesPayment = payment.map(p => ({currencyId: p.currencyId, amount: Math.ceil(p.amount * taxes)}));
        const profitPayment = payment.reduce((acc, p) => {
            const taxes = taxesPayment.find(t => t.currencyId === p.currencyId);
            if (taxes && p.amount > taxes.amount) {
                acc.push({
                    currencyId: p.currencyId,
                    amount: p.amount - taxes.amount
                });
            }
            return acc;
        }, [] as ICurrency[]);
        account.makePayment(other.taxes, taxesPayment);
        account.makePayment(other.cash, profitPayment);
    }

    /**
     * --------------------------------------------------------------------------------------------------------------
     * The following section is for market prices. Determining which ships go between which planets, carrying stuff.
     * --------------------------------------------------------------------------------------------------------------
     */
    /**
     * Compute the new market prices for the planet.
     */
    computeNewMarketPrices() {
        this.resourcePrices.splice(0, this.resourcePrices.length);
        for (const resourceType of Object.values(EResourceType)) {
            this.resourcePrices.push({
                resourceType,
                price: this.computePriceForResourceType(resourceType),
            });
        }
    }

    /**
     * ---------------------------------------
     * The game loop of the planetary economy
     * ---------------------------------------
     */

    public handlePlanetaryEconomy() {
        this.citizenDemand.handleEconomyDemand();
        this.computeNewMarketPrices();
    }
}

/**
 * Class used to determine which planets to buy resources from. Used by each planet to determine where to buy stuff.
 */
export class Market {
    /**
     * Used to get a list of planets near the current planet.
     * @param planet
     */
    static *GetPlanetsWithinNeighborhood(planet: Planet): Generator<Planet> {
        const planetKingdom = planet.county.duchy.kingdom;
        for (const neighborKingdom of planetKingdom.neighborKingdoms) {
            yield * Array.from(neighborKingdom.getPlanets());
        }
    }

    /**
     * Used to determine which planets to buy a resource from, for the cheapest price.
     * @param planet
     * @param resourceType
     * @returns A sorted list of the highest profit to lowest profit trade routes.
     */
    static GetLowestPriceForResource(planet: Planet, resourceType: EResourceType): Array<[number, Planet]> {
        if (!planet.currencySystem) {
            throw new Error("Could not find currency system to compute prices in");
        }

        const neighborhoodPlanets = Array.from(Market.GetPlanetsWithinNeighborhood(planet));

        // get best planet and lowest price
        const profits: Array<[number, Planet]> = [];
        for (const neighborPlanet of neighborhoodPlanets) {
            if (neighborPlanet.moneyAccount) {
                const price = neighborPlanet.moneyAccount.computePriceForResourceTypeInForeignCurrency(resourceType, planet.currencySystem);
                if (price > 0) {
                    profits.push([price, neighborPlanet]);
                }
            }
        }
        return profits;
    }

    static GetBiggestPriceDifferenceInImportsForPlanet(homePlanet: Planet): Array<[EResourceType, number, Planet]> {
        // get best resource, planet, and profit
        const profitableResources: Array<[EResourceType, number, Planet]> = [];
        for (const resourceType of Object.values(EResourceType)) {
            // get best planet and profit for resource
            const profits = Market.GetLowestPriceForResource(homePlanet, resourceType);
            for (const [price, planet] of profits) {
                profitableResources.push([resourceType, price, planet]);
            }
        }
        return profitableResources;
    }

    static ComputeProfitableTradeDirectedGraph(instance: Server) {
        // setup best profitable trades for the entire game
        for (const planet of instance.planets) {
            if (planet.moneyAccount) {
                planet.bestProfitableTrades = Market.GetBiggestPriceDifferenceInImportsForPlanet(planet).slice(0, 30);
            }
        }

        // compute a directed edge graph of the trades
        for (let i = 0; i < instance.planets.length; i++) {
            for (let j = i + 1; j < instance.planets.length; j++) {
                const a = instance.planets[i];
                const b = instance.planets[j];
                const data = [] as Array<IDirectedMarketTrade>;
                for (const [resourceType, profit, planet] of a.bestProfitableTrades) {
                    if (planet.id === b.id) {
                        data.push({
                            tradeDirection: EDirectedMarketTradeDirection.TO,
                            resourceType,
                            profit,
                        });
                    }
                }
                for (const [resourceType, profit, planet] of b.bestProfitableTrades) {
                    if (planet.id === a.id) {
                        data.push({
                            tradeDirection: EDirectedMarketTradeDirection.FROM,
                            resourceType,
                            profit,
                        });
                    }
                }
                instance.directedMarketTrade[`${a.id}#${b.id}`] = data;
            }
        }

        // compute possible trade deals, pair each directed edge into a series of bilateral trade deals
        for (const planet of instance.planets) {
            planet.possibleTradeDeals = [];
        }
        for (let i = 0; i < instance.planets.length; i++) {
            for (let j = i + 1; j < instance.planets.length; j++) {
                const a = instance.planets[i];
                const b = instance.planets[j];
                const data = instance.directedMarketTrade[`${a.id}#${b.id}`];
                const toTrades = data.filter(t => t.tradeDirection === EDirectedMarketTradeDirection.TO);
                const fromTrades = data.filter(t => t.tradeDirection === EDirectedMarketTradeDirection.FROM);
                for (const toTrade of toTrades) {
                    for (const fromTrade of fromTrades) {
                        a.possibleTradeDeals.push({
                            toResourceType: toTrade.resourceType,
                            fromResourceType: fromTrade.resourceType,
                            profit: toTrade.profit + fromTrade.profit,
                            planet: b,
                        });
                        b.possibleTradeDeals.push({
                            toResourceType: fromTrade.resourceType,
                            fromResourceType: toTrade.resourceType,
                            profit: toTrade.profit + fromTrade.profit,
                            planet: a,
                        });
                    }
                }
            }
        }
        for (const planet of instance.planets) {
            planet.possibleTradeDeals.sort((a, b) => a.profit - b.profit);
        }
    }
}

export class Planet implements ICameraState {
    public instance: Server;

    // planet properties
    public id: string = "";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public color: string = "blue";
    public size: number = 3;

    // population properties
    public settlementProgress: number = 0;
    public settlementLevel: ESettlementLevel = ESettlementLevel.UNTAMED;

    // ai pathing
    public pathingNode: PathingNode<DelaunayGraph<Planet>> | null = null;

    // feudal hierarchy
    public county: VoronoiCounty;

    // resource properties
    // the resources the island can produce
    public naturalResources: EResourceType[];
    // the resources the island produces from its plantations
    public producedResources: IResourceExported[] = [];
    // the resources the island imports from trading
    public importedResources: ICargoItem[] = [];
    // the resources the island manufactures, it removes raw material and adds refined product
    public manufacturedResources: IResourceProduced[] = [];
    // the resources which are exported from the island, not the final output
    public resources: Array<IResourceExported> = [];
    // the resources which are reserved for market use, paid in gold or cash
    public marketResources: Array<IResourceExported> = [];
    // the resources which are reserved for the feudal lord, free of charge
    public feudalObligationResources: Array<IResourceExported> = [];
    // used to cycle through exports for feudal obligation resources since those are free of charge
    private feudalObligationResourceCycle: number = 0;
    // used to determine free market trade, a list of directed trade routes, a pair of trade routes will allow a ship
    // to take both directions of the trade route
    public bestProfitableTrades: Array<[EResourceType, number, Planet]> = [];
    // a list of possible trade deals
    public possibleTradeDeals: Array<ITradeDeal> = [];
    // a list of registered trade deals
    public registeredTradeDeals: Array<ITradeDeal> = [];
    // a list of market resources which are owned by something
    public registeredMarketResources: Array<[Ship, IResourceExported]> = [];
    // a list of available market resources for trading
    public availableMarketResources: Array<IResourceExported> = [];

    // construction and ship building properties
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

    // government and economy properties
    // the feudal government of the planet
    public feudalGovernment: FeudalGovernment | null = null;
    // economy of the planet
    public economySystem: PlanetaryEconomySystem | null = null;
    // currency of the planet
    public currencySystem: PlanetaryCurrencySystem | null = null;
    // money account keeping track of money
    public moneyAccount: PlanetaryMoneyAccount | null = null;

    // real estate properties, used to manufacture stuff
    // a building which builds ships
    public shipyard: Shipyard;
    // a building which chops down trees for wood
    public forestry: Forestry;
    // a building which mines iron, coal, gems, and marble
    public mine: Mine;
    // a building which produces weapons and tools
    public blacksmith: Blacksmith;
    // a list of buildings to upgrade
    public readonly buildings: Building[];

    // property used to initialize buildings
    private numTicks: number = 0;

    /**
     * Number of settlements to colonize a planet.
     */
    public static NUM_SETTLEMENT_PROGRESS_STEPS = 4;

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
    public numPirateSlots: number = 0;
    public pirateSlots: string[] = [];
    public static ENEMY_PRESENCE_TICK_COOL_DOWN: number = 10 * 30;
    public static SHIP_DEMAND_TICK_COOL_DOWN: number = 30 * 10;
    public shipDemandTickCoolDown: number = 0;
    public shipsDemand: Record<EShipType, number> = {
        [EShipType.CUTTER]: 0,
        [EShipType.SLOOP]: 0,
        [EShipType.CORVETTE]: 0,
        [EShipType.BRIGANTINE]: 0,
        [EShipType.BRIG]: 0,
        [EShipType.FRIGATE]: 0
    };

    /**
     * Get the number of ships available.
     */
    public getNumShipsAvailable(shipType: EShipType): number {
        return this.shipyard.shipsAvailable[shipType];
    }

    constructor(instance: Server, county: VoronoiCounty) {
        this.instance = instance;
        this.county = county;

        // initialize the natural resources
        this.naturalResources = [];
        const numResources = Math.floor(Math.random() * 2 + 1);
        const resourceValues = Object.values(NATURAL_RESOURCES);
        for (let i = 0; i < 100 && this.naturalResources.length < numResources; i++) {
            const randomResource = resourceValues[Math.floor(Math.random() * resourceValues.length)];
            if (!this.naturalResources.includes(randomResource)) {
                this.naturalResources.push(randomResource);
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
            this.blacksmith
        ];
    }

    public claim(faction: Faction) {
        this.county.claim(faction);

        // build exploration graph for which planets to explore and in what order
        this.buildExplorationGraph();

        this.feudalGovernment = new FeudalGovernment(this.findFeudalLord.bind(this));

        // remove the previous economic system
        if (this.economySystem) {
            this.economySystem.removePlanet(this);
            this.economySystem = null;
        }

        switch (this.getRoyalRank()) {
            case ERoyalRank.EMPEROR: {
                // emperors have more pirates and their own economy
                this.numPirateSlots = 5;
                this.economySystem = new PlanetaryEconomySystem();
                this.economySystem.addPlanet(this);
                this.currencySystem = new PlanetaryCurrencySystem(`${faction.id} Bucks`);
                break;
            }
            case ERoyalRank.KING: {
                // kings have some pirates and their own economy
                this.numPirateSlots = 3;
                this.economySystem = new PlanetaryEconomySystem();
                this.economySystem.addPlanet(this);
                this.currencySystem = new PlanetaryCurrencySystem(`${faction.id} Bucks - ${Math.floor(Math.random() * 1000)}`);
                break;
            }
            case ERoyalRank.DUKE: {
                // dukes have few pirates and barrow their lords currency, but have their own economy
                this.numPirateSlots = 1;

                const lordPlanet = this.getLordWorld();
                if (!lordPlanet.currencySystem) {
                    throw new Error("Couldn't find currency system to copy from king to duke");
                }
                this.economySystem = new PlanetaryEconomySystem();
                this.economySystem.addPlanet(this);
                this.currencySystem = lordPlanet.currencySystem;
                break;
            }
            case ERoyalRank.COUNT: {
                // counts do not have pirates, they also copy their lords economy and currency
                this.numPirateSlots = 0;

                const lordPlanet = this.getLordWorld();
                if (!lordPlanet.economySystem) {
                    throw new Error("Couldn't find economy system to copy from king to duke");
                }
                if (!lordPlanet.currencySystem) {
                    throw new Error("Couldn't find currency system to copy from king to duke");
                }
                this.economySystem = lordPlanet.economySystem;
                this.economySystem.addPlanet(this);
                this.currencySystem = lordPlanet.currencySystem;
                break;
            }
            default: {
                // everything else does not have pirates for now
                this.numPirateSlots = 0;
                break;
            }
        }

        if (this.currencySystem && this.economySystem) {
            this.moneyAccount = new PlanetaryMoneyAccount(this, this.currencySystem, this.economySystem);
        }
    }

    /**
     * Build a map of the world from the faction's point of view.
     */
    buildExplorationGraph() {
        const homeWorld = this;
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
     * Compute a list of possible tasks for the planet's fleet to perform.
     */
    public getPlanetExplorationEntries(shipType?: EShipType) {
        // sort by importance
        const entries = Object.entries(this.explorationGraph)
            .sort((a, b) => {
                // check for lords domain or the lords duchy
                // dukes and kings should prioritize their local duchy
                const aIsDuchyDomain = this.isDuchyDomain(a[1].planet);
                const bIsDuchyDomain = this.isDuchyDomain(b[1].planet);
                if (aIsDuchyDomain && !bIsDuchyDomain) {
                    return -1;
                } else if (!aIsDuchyDomain && bIsDuchyDomain) {
                    return 1;
                }
                const isKing = (
                    this.getRoyalRank() === ERoyalRank.EMPEROR ||
                    this.getRoyalRank() === ERoyalRank.KING
                );
                if (isKing) {
                    // kings should prioritize new duchy capitals for their vassal dukes.
                    const aIsUnclaimedDuchyOfKingdom = this.isUnclaimedSisterDuchyOfKingdom(a[1].planet);
                    const bIsUnclaimedDuchyOfKingdom = this.isUnclaimedSisterDuchyOfKingdom(b[1].planet);
                    if (aIsUnclaimedDuchyOfKingdom && !bIsUnclaimedDuchyOfKingdom) {
                        return -1;
                    } else if (!aIsUnclaimedDuchyOfKingdom && bIsUnclaimedDuchyOfKingdom) {
                        return 1;
                    }
                }
                // prioritize the remaining counties in kingdom
                const aIsKingdomDomain = this.isKingdomDomain(a[1].planet);
                const bIsKingdomDomain = this.isKingdomDomain(b[1].planet);
                if (aIsKingdomDomain && !bIsKingdomDomain) {
                    return -1;
                } else if (!aIsKingdomDomain && bIsKingdomDomain) {
                    return 1;
                }
                const isEmperor = this.getRoyalRank() === ERoyalRank.EMPEROR;
                if (isEmperor) {
                    // emperors should prioritize new kingdom capitals for their vassal kings.
                    const aIsUnclaimedKingdomOfEmpire = this.isUnclaimedSisterKingdomOfEmpire(a[1].planet);
                    const bIsUnclaimedKingdomOfEmpire = this.isUnclaimedSisterKingdomOfEmpire(b[1].planet);
                    if (aIsUnclaimedKingdomOfEmpire && !bIsUnclaimedKingdomOfEmpire) {
                        return -1;
                    } else if (!aIsUnclaimedKingdomOfEmpire && bIsUnclaimedKingdomOfEmpire) {
                        return 1;
                    }
                }
                // prioritize imperial vassals
                const aIsVassal = this.isVassal(a[1].planet);
                const bIsVassal = this.isVassal(b[1].planet);
                if (aIsVassal && !bIsVassal) {
                    return -1;
                } else if (!aIsVassal && bIsVassal) {
                    return 1;
                }
                // prioritize settlement progress
                const settlementDifference = b[1].planet.settlementProgress - a[1].planet.settlementProgress;
                if (settlementDifference !== 0){
                    return settlementDifference;
                }
                // prioritize unclaimed land
                const aIsUnclaimed = a[1].planet.isUnclaimed();
                const bIsUnclaimed = b[1].planet.isUnclaimed();
                if (aIsUnclaimed && !bIsUnclaimed) {
                    return -1;
                } else if (!aIsUnclaimed && bIsUnclaimed) {
                    return 1;
                }
                // prioritize enemy counties
                const aIsCountyCapital = a[1].planet.isCountyCapital();
                const bIsCountyCapital = b[1].planet.isCountyCapital();
                if (aIsCountyCapital && !bIsCountyCapital) {
                    return -1;
                } else if (!aIsCountyCapital && bIsCountyCapital) {
                    return 1;
                }
                // prioritize enemy duchies
                const aIsDuchyCapital = a[1].planet.isDuchyCapital();
                const bIsDuchyCapital = b[1].planet.isDuchyCapital();
                if (aIsDuchyCapital && !bIsDuchyCapital) {
                    return -1;
                } else if (!aIsDuchyCapital && bIsDuchyCapital) {
                    return 1;
                }
                // prioritize enemy kingdoms
                const aIsKingdomCapital = a[1].planet.isKingdomCapital();
                const bIsKingdomCapital = b[1].planet.isKingdomCapital();
                if (aIsKingdomCapital && !bIsKingdomCapital) {
                    return -1;
                } else if (!aIsKingdomCapital && bIsKingdomCapital) {
                    return 1;
                }

                // rank by distance
                return a[1].distance - b[1].distance;
            });

        const homeFaction = this.county.faction;

        // find vassals to help
        const offerVassalEntries = entries.filter(entry => {
            const worldIsAbleToTrade = this.isAbleToTrade(entry[1].planet);
            // the vassal planet does not have enough ships
            const doesNotHaveEnoughShips = shipType &&
                entry[1].planet.shipsAvailable[shipType] < entry[1].planet.shipsDemand[shipType];
            return worldIsAbleToTrade && doesNotHaveEnoughShips;
        });

        // find worlds to pirate
        const pirateWorldEntries = entries.filter(entry => {
            const largeEnoughToPirate = this.isAbleToPirate();
            // settle new worlds which have not been settled yet
            const roomToPirate = entry[1].pirateShipIds.length === 0 && this.pirateSlots.length < this.numPirateSlots;
            const weakEnemyPresence = entry[1].enemyStrength <= 0;
            const isSettledEnoughToTrade = entry[1].planet.settlementLevel >= ESettlementLevel.OUTPOST &&
                entry[1].planet.settlementLevel <= ESettlementLevel.TERRITORY;
            const isOwnedByEnemy = Object.values(this.instance.factions).some(faction => {
                if (homeFaction && entry[1].planet.county.faction && entry[1].planet.county.faction.id === homeFaction.id) {
                    // do not pirate own faction
                    return false;
                } else {
                    // the faction should pirate other factions
                    return faction.planetIds.includes(entry[0]);
                }
            });
            return largeEnoughToPirate && roomToPirate && weakEnemyPresence && isSettledEnoughToTrade && isOwnedByEnemy;
        });

        // find vassals to trade
        const tradeVassalEntries = entries.filter(entry => {
            // settle new worlds which have not been settled yet
            const worldIsAbleToTrade = this.isAbleToTrade(entry[1].planet);
            const roomToTrade = entry[1].traderShipIds.length <= entry[1].planet.feudalObligationResources.length - 1;
            const isSettledEnoughToTrade = entry[1].planet.settlementLevel >= ESettlementLevel.OUTPOST;
            const notTradedYet = Object.values(this.instance.factions).every(faction => {
                if (homeFaction && entry[1].planet.county.faction && entry[1].planet.county.faction.id === homeFaction.id) {
                    // trade with own faction
                    return true;
                } else {
                    // the faction should not colonize another planet colonized by another faction
                    return !faction.planetIds.includes(entry[0]);
                }
            });
            return worldIsAbleToTrade && roomToTrade && isSettledEnoughToTrade && notTradedYet;
        });

        // find neighbors to market trade
        const tradeDealEntries = entries.reduce((acc, entry) => {
            const bestTradeDeal = this.getBestTradeDeal(entry[1].planet);
            if (bestTradeDeal) {
                acc.push([entry, bestTradeDeal]);
            }
            return acc;
        }, [] as Array<[[string, IExplorationGraphData], ITradeDeal]>);

        // find worlds to settle
        const settlementWorldEntries = entries.filter(entry => {
            const worldIsAbleToSettle = this.isAbleToSettle(entry[1].planet);
            // settle new worlds which have not been settled yet
            const roomToSettleMore = entry[1].settlerShipIds.length <=
                Planet.NUM_SETTLEMENT_PROGRESS_STEPS -
                Math.round(entry[1].planet.settlementProgress * Planet.NUM_SETTLEMENT_PROGRESS_STEPS) - 1;
            const notSettledYet = Object.values(this.instance.factions).every(faction => {
                if (homeFaction && homeFaction.planetIds.includes(entry[1].planet.id)) {
                    // settle with own faction
                    return true;
                } else {
                    // the faction should not colonize another planet colonized by another faction
                    return !faction.planetIds.includes(entry[0]);
                }
            });
            return worldIsAbleToSettle && roomToSettleMore && notSettledYet;
        });

        // find worlds to colonize
        const colonizeWorldEntries = entries.filter(entry => {
            // colonize settled worlds by sending more people
            const worldIsAbleToSettle = this.isAbleToSettle(entry[1].planet);
            const roomToSettleMore = entry[1].settlerShipIds.length <=
                Planet.NUM_SETTLEMENT_PROGRESS_STEPS * 5 -
                Math.round(entry[1].planet.settlementProgress * Planet.NUM_SETTLEMENT_PROGRESS_STEPS) - 1;
            const notSettledYet = Object.values(this.instance.factions).every(faction => {
                if (homeFaction && homeFaction.planetIds.includes(entry[1].planet.id)) {
                    // settle with own faction
                    return true;
                } else {
                    // the faction should not colonize another planet colonized by another faction
                    return !faction.planetIds.includes(entry[0]);
                }
            });
            return worldIsAbleToSettle && roomToSettleMore && notSettledYet;
        });

        return {
            offerVassalEntries,
            pirateWorldEntries,
            tradeVassalEntries,
            tradeDealEntries,
            settlementWorldEntries,
            colonizeWorldEntries
        };
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

        // select the first task in each category for a ship to do
        const {
            offerVassalEntries,
            pirateWorldEntries,
            tradeVassalEntries,
            tradeDealEntries,
            settlementWorldEntries,
            colonizeWorldEntries
        } = this.getPlanetExplorationEntries(ship.shipType);
        const offerVassalEntry = offerVassalEntries[0];
        const pirateWorldEntry = pirateWorldEntries[0];
        const tradeVassalWorldEntry = tradeVassalEntries[0];
        const tradeDealEntry = tradeDealEntries[0];
        const settlementWorldEntry = settlementWorldEntries[0];
        const colonizeWorldEntry = colonizeWorldEntries[0];

        if (!this.county.faction) {
            throw new Error("No faction assigned to planet");
        }

        if (pirateWorldEntry && shipData.cannons.numCannons > 4) {
            // found a piracy slot, add ship to pirate
            pirateWorldEntry[1].pirateShipIds.push(ship.id);
            this.pirateSlots.push(ship.id);

            const order = new Order(this.instance, ship, this.county.faction);
            order.orderType = EOrderType.PIRATE;
            order.planetId = pirateWorldEntry[0];
            order.expireTicks = 10 * 60 * 20; // pirate for 20 minutes before signing a new contract
            return order;
        } else if (tradeVassalWorldEntry && shipData.cannons.numCannons <= 4) {
            // found a trade slot, add ship to trade
            tradeVassalWorldEntry[1].traderShipIds.push(ship.id);

            const order = new Order(this.instance, ship, this.county.faction);
            order.orderType = EOrderType.FEUDAL_TRADE;
            order.planetId = tradeVassalWorldEntry[0];
            order.expireTicks = 10 * 60 * 20; // trade for 20 minutes before signing a new contract
            return order;
        } else if (tradeDealEntry && shipData.cannons.numCannons <= 4) {
            // found a trade slot, add ship to trade
            tradeDealEntry[0][1].traderShipIds.push(ship.id);
            tradeDealEntry[0][1].planet.registeredTradeDeals.push(tradeDealEntry[1]);
            tradeDealEntry[1].planet.registeredTradeDeals.push({
                fromResourceType: tradeDealEntry[1].toResourceType,
                toResourceType: tradeDealEntry[1].fromResourceType,
                profit: tradeDealEntry[1].profit,
                planet: tradeDealEntry[0][1].planet
            });

            const order = new Order(this.instance, ship, this.county.faction);
            order.orderType = EOrderType.FAIR_TRADE;
            order.planetId = tradeVassalWorldEntry[0];
            order.expireTicks = 10 * 60 * 20; // trade for 20 minutes before signing a new contract
            order.tradeDeal = tradeDealEntry[1];
            return order;
        } else if (colonizeWorldEntry) {
            // add ship to colonize
            colonizeWorldEntry[1].settlerShipIds.push(ship.id);

            const order = new Order(this.instance, ship, this.county.faction);
            order.orderType = EOrderType.SETTLE;
            order.planetId = colonizeWorldEntry[0];
            return order;
        } else if (settlementWorldEntry) {
            // add ship to settle
            settlementWorldEntry[1].settlerShipIds.push(ship.id);

            const order = new Order(this.instance, ship, this.county.faction);
            order.orderType = EOrderType.SETTLE;
            order.planetId = settlementWorldEntry[0];
            return order;
        } else if (offerVassalEntry) {
            // offer a ship to a vassal
            const order = new Order(this.instance, ship, this.county.faction);
            order.orderType = EOrderType.TRIBUTE;
            order.planetId = offerVassalEntry[0];
            return order;
        } else if (
            this.county.capital &&
            this.county.capital !== this
        ) {
            // tribute count
            const order = new Order(this.instance, ship, this.county.faction);
            order.orderType = EOrderType.TRIBUTE;
            order.planetId = this.county.capital.id;
            return order;
        } else if (
            this.county.duchy.capital &&
            this.county.duchy.capital.planet &&
            this.county.duchy.capital !== this.county
        ) {
            // tribute duke
            const order = new Order(this.instance, ship, this.county.faction);
            order.orderType = EOrderType.TRIBUTE;
            order.planetId = this.county.duchy.capital.planet.id;
            return order;
        } else if (
            this.county.duchy.kingdom.capital &&
            this.county.duchy.kingdom.capital.capital &&
            this.county.duchy.kingdom.capital.capital.planet &&
            this.county.duchy.kingdom.capital !== this.county.duchy
        ) {
            // tribute king
            const order = new Order(this.instance, ship, this.county.faction);
            order.orderType = EOrderType.TRIBUTE;
            order.planetId = this.county.duchy.kingdom.capital.capital.planet.id;
            return order;
        } else if (
            this.county.duchy.kingdom.faction &&
            this.county.faction &&
            this.county.duchy.kingdom.faction === this.county.faction &&
            this.getRoyalRank() === ERoyalRank.KING
        ) {
            // tribute emperor
            const order = new Order(this.instance, ship, this.county.faction);
            order.orderType = EOrderType.TRIBUTE;
            order.planetId = this.county.duchy.kingdom.faction.homeWorldPlanetId;
            return order;
        } else {
            // add ship to explore
            const order = new Order(this.instance, ship, this.county.faction);
            order.orderType = EOrderType.ROAM;
            return order;
        }
    }

    public getRoyalRank(): ERoyalRank {
        if (this.county.capital === this) {
            if (this.county.duchy.capital === this.county) {
                if (this.county.duchy.kingdom.capital === this.county.duchy) {
                    if (this.county.duchy.kingdom.faction && this.county.duchy.kingdom.faction.homeWorldPlanetId === this.id) {
                        return ERoyalRank.EMPEROR;
                    } else {
                        return ERoyalRank.KING;
                    }
                } else {
                    return ERoyalRank.DUKE;
                }
            } else {
                return ERoyalRank.COUNT;
            }
        } else {
            return ERoyalRank.UNCLAIMED;
        }
    }

    public isDuchyDomain(other: Planet): boolean {
        return this.county.duchy === other.county.duchy;
    }

    public isKingdomDomain(other: Planet): boolean {
        return this.county.duchy.kingdom === other.county.duchy.kingdom;
    }

    public isSisterDuchyOfKingdom(other: Planet): boolean {
        return this.isKingdomDomain(other) && !this.isDuchyDomain(other);
    }

    public isUnclaimedSisterDuchyOfKingdom(other: Planet): boolean {
        return this.isSisterDuchyOfKingdom(other) && !other.county.duchy.capital;
    }

    public isSisterKingdomOfEmpire(other: Planet): boolean {
        return !this.isKingdomDomain(other);
    }

    public isUnclaimedSisterKingdomOfEmpire(other: Planet): boolean {
        return this.isSisterKingdomOfEmpire(other) && !other.county.duchy.kingdom.capital;
    }

    public isImperialCapital(): boolean {
        return this.getRoyalRank() === ERoyalRank.EMPEROR;
    }

    public isKingdomCapital(): boolean {
        return this.getRoyalRank() === ERoyalRank.KING;
    }

    public isDuchyCapital(): boolean {
        return this.getRoyalRank() === ERoyalRank.DUKE;
    }

    public isCountyCapital(): boolean {
        return this.getRoyalRank() === ERoyalRank.COUNT;
    }

    public *getCountiesOfDomain(): Generator<VoronoiCounty> {
        switch (this.getRoyalRank()) {
            case ERoyalRank.EMPEROR: {
                const faction = this.county.duchy.kingdom.faction;
                if (faction) {
                    const imperialCapital = this.instance.planets.find(p => p.id === faction.homeWorldPlanetId);
                    if (imperialCapital) {
                        // if all counties have a capital, return true
                        const imperialKingdom = imperialCapital.county.duchy.kingdom;
                        for (const duchy of imperialKingdom.duchies) {
                            for (const county of duchy.counties) {
                                yield county;
                            }
                        }
                    }
                }
                break;
            }
            case ERoyalRank.KING: {
                for (const duchy of this.county.duchy.kingdom.duchies) {
                    for (const county of duchy.counties) {
                        yield county;
                    }
                }
                break;
            }
            case ERoyalRank.DUKE: {
                for (const county of this.county.duchy.counties) {
                    yield county;
                }
                break;
            }
            case ERoyalRank.COUNT:
            default: {
                break;
            }
        }
    }

    public *getPlanetsOfDomain(): Generator<Planet> {
        for (const county of Array.from(this.getCountiesOfDomain())) {
            if (county.capital) {
                yield county.capital;
            }
        }
    }

    public isDomainFull(): boolean {
        for (const county of Array.from(this.getCountiesOfDomain())) {
            if (!county.capital) {
                return false;
            }
        }
        return true;
    }

    public isAbleToPirate(): boolean {
        switch (this.getRoyalRank()) {
            case ERoyalRank.EMPEROR:
            case ERoyalRank.KING:
            case ERoyalRank.DUKE: {
                // emperor, king, and dukes can pirate
                return this.isDomainFull();
            }
            case ERoyalRank.COUNT:
            default: {
                // counts do not pirate
                return false;
            }
        }
    }

    public isAbleToTrade(other: Planet): boolean {
        switch (this.getRoyalRank()) {
            case ERoyalRank.EMPEROR: {
                // emperors only trade with kingdom capitals
                return (this.isVassal(other) && other.isKingdomCapital()) ||
                    (this.isKingdomDomain(other) && other.isDuchyCapital()) ||
                    (this.isDuchyDomain(other) && other.isCountyCapital());
            }
            case ERoyalRank.KING: {
                // kings only trade with duchy capitals
                return (this.isKingdomDomain(other) && other.isDuchyCapital()) ||
                    (this.isDuchyDomain(other) && other.isCountyCapital());
            }
            case ERoyalRank.DUKE: {
                // dukes only trade with county capitals
                return this.isDuchyDomain(other) && other.isCountyCapital();
            }
            case ERoyalRank.COUNT:
            default: {
                // counts do not trade
                return false;
            }
        }
    }

    public getBestTradeDeal(other: Planet): ITradeDeal | null {
        for (const tradeDeal of this.possibleTradeDeals) {
            // ignore registered trade deals
            const isRegistered = this.registeredTradeDeals.some(t => {
                return t.fromResourceType === tradeDeal.fromResourceType &&
                    t.toResourceType === tradeDeal.toResourceType &&
                    t.planet === tradeDeal.planet;
            });
            if (isRegistered) {
                continue;
            }

            const localHasResource = this.availableMarketResources.some(r => r.resourceType === tradeDeal.fromResourceType);
            const remoteHasResource = other.availableMarketResources.some(r => r.resourceType === tradeDeal.toResourceType);
            if (localHasResource && remoteHasResource) {
                return tradeDeal;
            }
        }
        return null;
    }

    public isAbleToSettle(other: Planet): boolean {
        switch (this.getRoyalRank()) {
            case ERoyalRank.EMPEROR: {
                // emperors can settle anywhere
                return true;
            }
            case ERoyalRank.KING: {
                // kings only settle within their domain
                return this.isKingdomDomain(other);
            }
            case ERoyalRank.DUKE: {
                // dukes only settle within their domain
                return this.isDuchyDomain(other);
            }
            case ERoyalRank.COUNT:
            default: {
                // counts do not settle
                return false;
            }
        }
    }

    public isUnclaimed(): boolean {
        return this.getRoyalRank() === ERoyalRank.UNCLAIMED;
    }

    public isVassal(other: Planet): boolean {
        switch (this.getRoyalRank()) {
            case ERoyalRank.EMPEROR: {
                return !!(this.county.duchy.kingdom.faction &&
                    other.county.duchy.kingdom.faction &&
                    this.county.duchy.kingdom.faction === other.county.duchy.kingdom.faction);
            }
            case ERoyalRank.KING: {
                return this.county.duchy.kingdom === other.county.duchy.kingdom;
            }
            case ERoyalRank.DUKE: {
                return this.county.duchy === other.county.duchy;
            }
            case ERoyalRank.COUNT: {
                return this.county === other.county;
            }
            default: {
                return false;
            }
        }
    }

    public getLordWorld(): Planet {
        switch (this.getRoyalRank()) {
            case ERoyalRank.EMPEROR: {
                return this;
            }
            case ERoyalRank.KING: {
                const planet = this.instance.planets.find(p => {
                    return this.county.duchy.kingdom.faction &&
                        p.id === this.county.duchy.kingdom.faction.homeWorldPlanetId;
                });
                if (!planet) {
                    throw new Error("Could not find imperial capital");
                }
                return planet;
            }
            case ERoyalRank.DUKE: {
                const planet = this.county.duchy.kingdom.capital?.capital?.planet;
                if (!planet) {
                    throw new Error("Could not find kingdom capital");
                }
                return planet;
            }
            case ERoyalRank.COUNT: {
                const planet = this.county.duchy.capital?.planet;
                if (!planet) {
                    throw new Error("Could not find duchy capital");
                }
                return planet;
            }
            default: {
                throw new Error("Planet is not part of royal hierarchy");
            }
        }
    }

    /**
     * Apply a new luxury buff to a faction.
     * @param account A gold holding account which increases after trading.
     * @param resourceType The resource type affects the buff.
     * @param planetId The source world of the goods.
     * @param amount The amount multiplier of the resource.
     */
    public applyLuxuryBuff(account: MoneyAccount, resourceType: EResourceType, planetId: string, amount: number) {
        // update luxury buff
        const oldLuxuryBuff = this.luxuryBuffs.find(l => l.matches(resourceType, planetId));
        // let percentReplenished = 1;
        if (oldLuxuryBuff) {
            // percentReplenished = oldLuxuryBuff.replenish();
            oldLuxuryBuff.replenish();
            oldLuxuryBuff.amount = amount;
        } else if (this.county.faction) {
            this.luxuryBuffs.push(new LuxuryBuff(this.instance, this.county.faction, this, resourceType, planetId, amount));
        }

        // update economy
        if (this.economySystem && this.moneyAccount) {
            this.economySystem.recomputeResources();

            // merchant is not paid for feudal obligation missions
            // // pay merchant
            // const goldAmount = Math.floor(this.moneyAccount.computePriceForResourceType(resourceType) * amount * percentReplenished);
            // const payment: ICurrency[] = [{
            //     currencyId: "GOLD",
            //     amount: goldAmount,
            // }];
            // this.moneyAccount.cash.makePayment(account, payment);
        }
    }

    public isEnemyPresenceTick(): boolean {
        if (this.enemyPresenceTick <= 0) {
            this.enemyPresenceTick = Planet.ENEMY_PRESENCE_TICK_COOL_DOWN;
            return true;
        } else {
            this.enemyPresenceTick -= 1;
            return false;
        }
    }

    public isShipDemandTick(): boolean {
        if (this.shipDemandTickCoolDown <= 0) {
            this.shipDemandTickCoolDown = Planet.SHIP_DEMAND_TICK_COOL_DOWN;
            return true;
        } else {
            this.shipDemandTickCoolDown -= 1;
            return false;
        }
    }

    public computeShipDemand() {
        const {
            tradeVassalEntries,
            pirateWorldEntries,
            colonizeWorldEntries
        } = this.getPlanetExplorationEntries();

        // reset demand
        for (const shipType of Object.values(EShipType)) {
            this.shipsDemand[shipType] = 0;
        }

        // compute new demand
        this.shipsDemand[EShipType.CUTTER] += tradeVassalEntries.reduce((acc, t) => {
            const numberOfCuttersNeededForPlanet = t[1].planet.feudalObligationResources.length;
            return acc + numberOfCuttersNeededForPlanet;
        }, 0);
        this.shipsDemand[EShipType.CORVETTE] = Math.min(this.numPirateSlots, pirateWorldEntries.length) +
            Math.max(0, Math.min(colonizeWorldEntries.length, 10));
    }

    public getNextShipTypeToBuild(): EShipType {
        // build next ship based on local ship demand
        for (const shipType of Object.values(EShipType)) {
            if (this.shipsAvailable[shipType] < this.shipsDemand[shipType]) {
                return shipType;
            }
        }

        // build next ship based on vassal ship demand
        for (const shipType of Object.values(EShipType)) {
            for (const planet of Array.from(this.getPlanetsOfDomain())) {
                if (planet.shipsAvailable[shipType] < planet.shipsDemand[shipType]) {
                    return shipType;
                }
            }
        }

        // build next ship based on lord ship demand
        for (const shipType of Object.values(EShipType)) {
            let lordWorld = this.getLordWorld();
            for (let i = 0; i < 100; i++) {
                if (lordWorld.shipsAvailable[shipType] < lordWorld.shipsDemand[shipType]) {
                    return shipType;
                }
                const nextLordWorld = this.getLordWorld();
                if (nextLordWorld === lordWorld) {
                    break;
                } else {
                    lordWorld = nextLordWorld;
                }
            }
        }

        // build a distribution of ship types when there is no demand
        if (this.shipsAvailable[EShipType.CUTTER] < Math.ceil(this.shipIds.length * (1 / 2))) {
            return EShipType.CUTTER;
        }
        if (this.shipsAvailable[EShipType.SLOOP] < Math.ceil(this.shipIds.length * (1 / 3))) {
            return EShipType.SLOOP;
        }
        if (this.shipsAvailable[EShipType.CORVETTE] < Math.ceil(this.shipIds.length * (1 / 6))) {
            return EShipType.CORVETTE;
        }
        return EShipType.CUTTER;
    }

    public buildInitialResourceBuildings() {
        this.buildings.push(
            ...this.naturalResources.map(naturalResource => new Plantation(this.instance, this, naturalResource))
        );
    }

    public findFeudalLord(): FeudalGovernment | null {
        switch (this.getRoyalRank()) {
            default:
            case ERoyalRank.EMPEROR: {
                // non royal governments and emperors do not have feudal lords.
                return null;
            }
            case ERoyalRank.KING:
            case ERoyalRank.DUKE:
            case ERoyalRank.COUNT: {
                // kings, dukes, and counts have feudal lords
                const planet = this.getLordWorld();
                if (planet.feudalGovernment) {
                    return planet.feudalGovernment;
                } else {
                    return null;
                }
            }
        }
    }

    public setAsStartingCapital() {
        this.size = 10;
        this.settlementProgress = 1;
        this.settlementLevel = ESettlementLevel.CAPITAL;
        this.naturalResources = [...CAPITAL_GOODS];
    }

    // rebuild the resources array based on events such as less or more items
    public recomputeResources() {
        if (this.settlementLevel < ESettlementLevel.OUTPOST || this.settlementLevel >= ESettlementLevel.CAPITAL) {
            // do not update resources if an unsettled world or capital world
            return;
        }

        // update resources array
        this.resources.splice(0, this.resources.length);
        // start with capital goods
        this.resources.push(...this.naturalResources.filter(r => CAPITAL_GOODS.includes(r)).map(resourceType => ({
            resourceType,
            amount: 1,
            feudalObligation: false,
        })));
        // start with produced resources
        this.resources.push(...this.producedResources);
        // compute imported resources
        this.importedResources.splice(0, this.importedResources.length);
        for (const luxuryBuff of this.luxuryBuffs) {
            this.importedResources.push({
                resourceType: luxuryBuff.resourceType,
                amount: luxuryBuff.amount,
                sourcePlanetId: luxuryBuff.planetId,
                pirated: false,
            });
        }
        // insert imported resources
        for (const importedResource of this.importedResources) {
            const oldResource = this.resources.find(r => r.resourceType === importedResource.resourceType);
            if (oldResource) {
                oldResource.amount += importedResource.amount;
            } else {
                this.resources.push({
                    resourceType: importedResource.resourceType,
                    amount: importedResource.amount,
                    feudalObligation: false,
                });
            }
        }
        // subtract manufactured resources
        for (const manufacturedResource of this.manufacturedResources) {
            // the amount of recipes that can be produced
            let amount: number = manufacturedResource.amount;
            for (const ingredient of manufacturedResource.ingredients) {
                const oldResource = this.resources.find(i => i.resourceType === ingredient.resourceType);
                if (oldResource) {
                    // compute recipe amount
                    amount = Math.min(amount, Math.floor(oldResource.amount / (ingredient.amount * manufacturedResource.amount)));
                } else {
                    // resource not found, 0 recipe amount
                    amount = 0;
                }
            }
            // if there is at least one recipe amount
            if (amount > 0) {
                for (const ingredient of manufacturedResource.ingredients) {
                    const oldResource = this.resources.find(i => i.resourceType === ingredient.resourceType);
                    if (oldResource) {
                        oldResource.amount -= ingredient.amount * amount;
                    }
                }
                for (const product of manufacturedResource.products) {
                    const oldResource = this.resources.find(i => i.resourceType === product.resourceType);
                    if (oldResource) {
                        oldResource.amount += product.amount * amount;
                    } else {
                        this.resources.push({
                            resourceType: product.resourceType,
                            amount: product.amount * amount,
                            feudalObligation: false,
                        });
                    }
                }
            }
        }

        // setup feudal obligations and market goods
        let feudalObligationAmount = this.feudalGovernment ?
            Math.ceil(this.resources.reduce((acc, r) => {
                return acc + r.amount;
            }, 0) * this.feudalGovernment.getCurrentFeudalObligationRatio()) :
            0;
        this.feudalObligationResources.splice(0, this.feudalObligationResources.length);
        const splitResource = (resource: IResourceExported, amount: number) => {
            if (amount >= resource.amount) {
                this.feudalObligationResources.push({
                    ...resource,
                    feudalObligation: true,
                });
            } else if (amount <= 0) {
                this.marketResources.push({
                    ...resource,
                    feudalObligation: false,
                });
            } else {
                const feudalAmount = amount;
                const marketAmount = resource.amount - feudalAmount;
                this.feudalObligationResources.push({
                    resourceType: resource.resourceType,
                    amount: feudalAmount,
                    feudalObligation: true,
                });
                this.marketResources.push({
                    resourceType: resource.resourceType,
                    amount: marketAmount,
                    feudalObligation: false,
                });
            }
        };
        for (const resource of this.resources) {
            splitResource(resource, feudalObligationAmount);
            feudalObligationAmount -= resource.amount;
        }
    }

    public handlePlanetLoop() {
        if (this.settlementLevel < ESettlementLevel.OUTPOST) {
            // planets smaller than colonies do nothing
            return;
        }

        // recompute resources for the first few ticks to initialize the planet economy
        if (this.numTicks < 5) {
            this.recomputeResources();
        }
        this.numTicks += 1;

        // handle buildings
        for (const building of this.buildings) {
            if (
                (this.settlementLevel >= ESettlementLevel.OUTPOST && building.buildingType === EBuildingType.PLANTATION) ||
                (this.settlementLevel >= ESettlementLevel.OUTPOST && building.buildingType === EBuildingType.MANUFACTORY) ||
                (this.settlementLevel >= ESettlementLevel.OUTPOST && building.buildingType === EBuildingType.FORESTRY)
            ) {
                // outposts have working plantations but no shipyards or other general infrastructure
                building.handleBuildingLoop();
            } else if (this.settlementLevel >= ESettlementLevel.COLONY) {
                // colonies and larger settlements have general infrastructure
                building.handleBuildingLoop();
            }
        }

        // handle construction of new buildings
        const nextBuildingToBuild = this.getNextBuildingToBuild();
        if (nextBuildingToBuild) {
            this.buildings.push(nextBuildingToBuild)
        }

        // handle upgrades of buildings
        const {
            nextBuilding: nextBuildingToUpgrade,
            nextBuildingCost: nextUpgradeCost
        } = this.getNextBuildingUpgrade();
        if (this.woodConstruction >= nextUpgradeCost) {
            nextBuildingToUpgrade.upgrade();
        }

        // handle ship demand loop
        if (this.isShipDemandTick()) {
            this.computeShipDemand();
        }

        // captain new AI ships
        const nextShipTypeToBuild = this.getNextShipTypeToBuild();
        if (
            (this.getRoyalRank() === ERoyalRank.EMPEROR ? true : this.shipIds.length < 3) &&
            this.county.faction &&
            this.getNumShipsAvailable(nextShipTypeToBuild) > 2 &&
            this.county.faction.shipIds.length < Faction.MAX_SHIPS &&
            this.moneyAccount &&
            this.moneyAccount.cash.hasEnough(this.shipyard.quoteShip(nextShipTypeToBuild, true))
        ) {
            this.spawnShip(this.moneyAccount.cash, nextShipTypeToBuild, true);
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

        // handle resource economy
        if (this.moneyAccount) {
            this.moneyAccount.handlePlanetaryEconomy();
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
        const pirateSlotIndex = this.pirateSlots.findIndex(s => s === ship.id);
        if (pirateSlotIndex >= 0) {
            this.pirateSlots.splice(pirateSlotIndex, 1);
        }
        this.shipsAvailable[ship.shipType] -= 1;
    }

    public tribute(ship: Ship) {
        // remove ship from old planet's roster
        if (ship.planet) {
            ship.planet.handleShipDestroyed(ship);
        }

        // add ship to new planet roster
        this.addNewShip(ship);
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
            // skip buildings which are not plantation if the settlement is smaller than a colony
            if (
                (building.buildingType === EBuildingType.PLANTATION && this.settlementLevel < ESettlementLevel.OUTPOST) ||
                (building.buildingType === EBuildingType.MANUFACTORY && this.settlementLevel < ESettlementLevel.OUTPOST)
            ) {
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
     * Determine the next building to build.
     */
    getNextBuildingToBuild(): Building | null {
        // find next manufactory to build
        const recipe = ITEM_RECIPES.find(recipe => {
            return recipe.ingredients.every(ingredient => {
                let amount = 0;
                for (const resource of this.marketResources) {
                    if (resource.resourceType === ingredient.resourceType) {
                        amount += resource.amount;
                    }
                }
                return amount >= ingredient.amount;
            });
        });
        const existingBuilding = this.buildings.find(b => b.buildingType === EBuildingType.MANUFACTORY && (b as Manufactory).recipe === recipe);
        if (recipe && !existingBuilding) {
            return new Manufactory(this.instance, this, recipe);
        } else {
            return null;
        }
    }

    /**
     * The planet will trade with a ship.
     * @param ship
     * @param unload if the ship will not take cargo
     * @param specificBuy a specific resource to buy
     */
    trade(ship: Ship, unload: boolean = false, specificBuy: EResourceType | null = null) {
        // a list of items to buy from ship and sell to ship
        let goodsToTake: EResourceType[] = [];
        let goodsToOffer: IResourceExported[] = [];

        // different levels of settlements take different goods
        if (this.settlementLevel === ESettlementLevel.UNTAMED) {
            goodsToTake = CAPITAL_GOODS;
            goodsToOffer = [];
        } else if (this.settlementLevel >= ESettlementLevel.OUTPOST && this.settlementLevel <= ESettlementLevel.PROVINCE) {
            goodsToTake = CAPITAL_GOODS;
            goodsToOffer = this.feudalObligationResources;
        } else if (this.settlementLevel === ESettlementLevel.CAPITAL) {
            // the capital will take outpost goods an pirated goods
            goodsToTake = Array.from(new Set([
                ...OUTPOST_GOODS,
                ...ship.cargo.filter(c => c.pirated).map(c => c.resourceType)
            ]));
            goodsToOffer = this.feudalObligationResources;
        }

        // buy a specific good for fair trade
        if (specificBuy) {
            goodsToOffer = this.marketResources.filter(r => r.resourceType === specificBuy);
        }

        // do not take cargo, because the ship is beginning a piracy mission
        if (unload) {
            goodsToOffer = [];
        }

        // trade with the ship
        for (const goodToTake of goodsToTake) {
            const boughtGood = ship.buyGoodFromShip(goodToTake);
            if (boughtGood && this.moneyAccount) {
                this.applyLuxuryBuff(this.moneyAccount.cash, goodToTake, boughtGood.sourcePlanetId, boughtGood.amount);
            }
        }
        for (let i = 0; i < goodsToOffer.length; i++) {
            if (ship.sellGoodToShip(goodsToOffer[this.feudalObligationResourceCycle % this.feudalObligationResources.length], this.id)) {
                this.feudalObligationResourceCycle = (this.feudalObligationResourceCycle + 1) % this.feudalObligationResources.length;
            }
        }
    }

    /**
     * Create a new ship.
     */
    public spawnShip(account: MoneyAccount, shipType: EShipType, asFaction: boolean = false): Ship {
        // check ship availability
        if (this.shipyard.shipsAvailable[shipType] === 0) {
            throw new Error("No ships available");
        }

        // perform gold transaction, paying 50% taxes to the faction
        return this.shipyard.buyShip(account, shipType, asFaction);
    }

    addNewShip(ship: Ship) {
        this.shipIds.push(ship.id);
        this.shipsAvailable[ship.shipType] += 1;
        ship.planet = this;
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
        ship.planet = this;
        ship.id = `ship-${this.id}-${faction.getShipAutoIncrement()}`;
        Server.addRandomPositionAndOrientationToEntity(ship);
        ship.position = Quaternion.fromBetweenVectors([0, 0, 1], shipPoint);
        ship.color = faction.factionColor;

        // the faction ship
        faction.shipIds.push(ship.id);
        faction.instance.ships.push(ship);
        faction.shipsAvailable[ship.shipType] += 1;
        this.addNewShip(ship);

        return ship;
    }
}