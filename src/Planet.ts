import {ESettlementLevel, ICameraState, IExplorationGraphData, IGoldAccount} from "./Interface";
import Quaternion from "quaternion";
import {DelaunayGraph, PathingNode, VoronoiGraph} from "./Graph";
import {
    CAPITAL_GOODS,
    EResourceType,
    ICargoItem,
    IItemRecipe,
    ITEM_RECIPES,
    NATURAL_RESOURCES,
    OUTPOST_GOODS
} from "./Resource";
import {EShipType, Ship, SHIP_DATA} from "./Ship";
import App from "./App";
import {VoronoiCounty} from "./VoronoiTree";
import {ERoyalRank, Faction, LuxuryBuff} from "./Faction";
import {EOrderType, Order} from "./Order";

export interface IResourceExported {
    resourceType: EResourceType;
    amount: number;
}

export interface IResourceProduced extends IItemRecipe {
    amount: number;
}

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

    constructor(instance: App, planet: Planet, resourceType: EResourceType) {
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
                amount: this.buildingLevel
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

    constructor(instance: App, planet: Planet, recipe: IItemRecipe) {
        super(instance, planet);
        this.recipe = recipe;
        this.buildingLevel = 0;
    }

    getUpgradeCost(): number {
        // check for available room to upgrade
        const hasRoomToUpgradeManufacturing = this.recipe.ingredients.every(ingredient => {
            let amount = 0;
            for (const resource of this.planet.resources) {
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
    public instance: App;
    public id: string = "";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public color: string = "blue";
    public size: number = 3;

    constructor(instance: App) {
        this.instance = instance;
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
    public county: VoronoiCounty;
    // the resources the island can produce
    public naturalResources: EResourceType[];
    // the resources the island produces from its plantations
    public producedResources: IResourceExported[] = [];
    // the resources the island imports from trading
    public importedResources: ICargoItem[] = [];
    public manufacturedResources: IResourceProduced[] = [];
    // resources which are exported from the island
    public resources: Array<IResourceExported> = [];
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
    public readonly buildings: Building[];
    private resourceCycle: number = 0;
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

    constructor(instance: App, county: VoronoiCounty) {
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

        switch (this.getRoyalRank()) {
            case ERoyalRank.EMPEROR: {
                this.numPirateSlots = 5;
                break;
            }
            case ERoyalRank.KING: {
                this.numPirateSlots = 3;
                break;
            }
            case ERoyalRank.DUKE: {
                this.numPirateSlots = 1;
                break;
            }
            default: {
                this.numPirateSlots = 0;
                break;
            }
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

        // find worlds to trade
        const tradeWorldEntries = entries.filter(entry => {
            // settle new worlds which have not been settled yet
            const worldIsAbleToTrade = this.isAbleToTrade(entry[1].planet);
            const roomToTrade = entry[1].traderShipIds.length <= entry[1].planet.resources.length - 1;
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
            tradeWorldEntries,
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
            tradeWorldEntries,
            settlementWorldEntries,
            colonizeWorldEntries
        } = this.getPlanetExplorationEntries(ship.shipType);
        const offerVassalEntry = offerVassalEntries[0];
        const pirateWorldEntry = pirateWorldEntries[0];
        const tradeWorldEntry = tradeWorldEntries[0];
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
        } else if (tradeWorldEntry && shipData.cannons.numCannons <= 4) {
            // found a trade slot, add ship to trade
            tradeWorldEntry[1].traderShipIds.push(ship.id);

            const order = new Order(this.instance, ship, this.county.faction);
            order.orderType = EOrderType.TRADE;
            order.planetId = tradeWorldEntry[0];
            order.expireTicks = 10 * 60 * 20; // trade for 20 minutes before signing a new contract
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
    public applyLuxuryBuff(account: IGoldAccount, resourceType: EResourceType, planetId: string, amount: number) {
        const oldLuxuryBuff = this.luxuryBuffs.find(l => l.matches(resourceType, planetId));
        if (oldLuxuryBuff) {
            const percentReplenished = oldLuxuryBuff.replenish();
            oldLuxuryBuff.amount = amount;
            const goldProfit = Math.floor(oldLuxuryBuff.goldValue() * percentReplenished);
            const goldBonus = Math.floor(goldProfit * 0.2);
            this.gold -= goldBonus;
            account.gold += goldBonus;
        } else if (this.county.faction) {
            this.luxuryBuffs.push(new LuxuryBuff(this.instance, this.county.faction, this, resourceType, planetId, amount));
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
            tradeWorldEntries,
            pirateWorldEntries,
            colonizeWorldEntries
        } = this.getPlanetExplorationEntries();

        // reset demand
        for (const shipType of Object.values(EShipType)) {
            this.shipsDemand[shipType] = 0;
        }

        // compute new demand
        this.shipsDemand[EShipType.CUTTER] += tradeWorldEntries.length;
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

    public setAsStartingCapital() {
        this.size = 10;
        this.settlementProgress = 1;
        this.settlementLevel = ESettlementLevel.CAPITAL;
        this.naturalResources = [...CAPITAL_GOODS];
        this.gold = 100000;
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
            amount: 1
        })));
        // start with produced resources
        this.resources.push(...this.producedResources);
        // insert imported resources
        for (const importedResource of this.importedResources) {
            const oldResource = this.resources.find(r => r.resourceType === importedResource.resourceType);
            if (oldResource) {
                oldResource.amount += importedResource.amount;
            } else {
                this.resources.push({
                    resourceType: importedResource.resourceType,
                    amount: importedResource.amount
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
                            amount: product.amount * amount
                        });
                    }
                }
            }
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
            this.gold >= this.shipyard.quoteShip(nextShipTypeToBuild, true)
        ) {
            this.spawnShip(this, nextShipTypeToBuild, true);
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
                for (const resource of this.resources) {
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
     */
    trade(ship: Ship, unload: boolean = false) {
        // a list of items to buy from ship and sell to ship
        let goodsToTake: EResourceType[] = [];
        let goodsToOffer: IResourceExported[] = [];

        // different levels of settlements take different goods
        if (this.settlementLevel === ESettlementLevel.UNTAMED) {
            goodsToTake = CAPITAL_GOODS;
            goodsToOffer = [];
        } else if (this.settlementLevel >= ESettlementLevel.OUTPOST && this.settlementLevel <= ESettlementLevel.COLONY) {
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
                this.applyLuxuryBuff(this.instance, goodToTake, boughtGood.sourcePlanetId, boughtGood.amount);
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
        App.addRandomPositionAndOrientationToEntity(ship);
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