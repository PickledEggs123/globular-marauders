/**
 * A type of order for a ship to complete. Orders are actions the ship should take on behalf of the faction.
 */
import {Ship, SHIP_DATA} from "./Ship";
import App from "./App";
import {VoronoiGraph} from "./Graph";
import {ESettlementLevel} from "./Interface";
import {Faction} from "./Faction";
import {Planet} from "./Planet";

export enum EOrderType {
    /**
     * Explore space randomly.
     */
    ROAM = "ROAM",
    /**
     * Move settlers to a planet to colonize it.
     */
    SETTLE = "SETTLE",
    /**
     * Trade with a planet to collect luxuries.
     */
    TRADE = "TRADE",
    /**
     * Find and destroy an enemy ship, then return the cargo.
     */
    PIRATE = "PIRATE",
}

export class Order {
    public app: App;
    public owner: Ship;
    public faction: Faction;
    public orderType: EOrderType = EOrderType.ROAM;
    public planetId: string | null = null;
    public expireTicks: number = 0;
    private stage: number = 0;
    private runningTicks: number = 0;

    constructor(app: App, owner: Ship, faction: Faction) {
        this.app = app;
        this.owner = owner;
        this.faction = faction;
    }

    private roam() {
        const homeWorld = this.app.planets.find(planet => planet.id === this.faction.homeWoldPlanetId);
        if (!homeWorld || !homeWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (ROAM)");
        }

        // pick random planets
        if (this.stage === 0 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // explore a random planet
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            const nodes = Object.values(this.app.delaunayGraph.pathingNodes);
            const randomTarget = nodes[Math.floor(Math.random() * nodes.length)];
            this.owner.pathFinding.points = nearestNode.pathToObject(randomTarget);
        } else if (this.stage === 1 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // return to home world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(homeWorld.pathingNode);
        } else if (this.stage === 2 && this.owner.pathFinding.points.length === 0) {
            // end order
            this.owner.removeOrder(this);
        }
    }

    private settle() {
        const shipData = SHIP_DATA.find(s => s.shipType === this.owner.shipType);
        if (!shipData) {
            throw new Error("Could not find ship type");
        }

        if (!this.planetId) {
            throw new Error("Could not find planetId to path to (SETTLE)");
        }
        const colonyWorld = this.app.planets.find(planet => planet.id === this.planetId);
        if (!colonyWorld || !colonyWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (SETTLE)");
        }
        const homeWorld = this.app.planets.find(planet => planet.id === this.faction.homeWoldPlanetId);
        if (!homeWorld || !homeWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (SETTLE)");
        }

        // fly to a specific planet
        if (this.stage === 0 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // return to home world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(homeWorld.pathingNode);
        } else if (this.stage === 1 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // trade with homeWorld
            homeWorld.trade(this.owner);

            // find colony world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(colonyWorld.pathingNode);
        } else if (this.stage === 2 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1

            // update settlement progress
            const wasSettledByAnotherFactionYet = Object.values(this.app.factions).some(f => {
                return !!(this.planetId && f.planetIds.includes(this.planetId) && f.id !== this.faction.id);
            });
            if (!wasSettledByAnotherFactionYet) {
                colonyWorld.settlementProgress = (
                    Math.round(colonyWorld.settlementProgress * Planet.NUM_SETTLEMENT_PROGRESS_STEPS) + shipData.settlementProgressFactor
                ) / Planet.NUM_SETTLEMENT_PROGRESS_STEPS;
                if (colonyWorld.settlementProgress === 1) {
                    colonyWorld.settlementLevel = ESettlementLevel.OUTPOST;
                }
                if (!this.faction.planetIds.includes(this.planetId)) {
                    this.faction.planetIds.push(this.planetId);
                }

                // trade with homeWorld
                colonyWorld.trade(this.owner);
            }

            // return to home world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(homeWorld.pathingNode);
        } else if (this.stage === 3 && this.owner.pathFinding.points.length === 0) {
            // end order
            const index = this.faction.explorationGraph[this.planetId].settlerShipIds.findIndex(s => s === this.owner.id);
            if (index >= 0) {
                this.faction.explorationGraph[this.planetId].settlerShipIds.splice(index, 1);
            }
            this.owner.removeOrder(this);
        }
    }

    private trade() {
        if (!this.planetId) {
            throw new Error("Could not find planetId to path to (TRADE)");
        }
        const colonyWorld = this.app.planets.find(planet => planet.id === this.planetId);
        if (!colonyWorld || !colonyWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (TRADE)");
        }
        const homeWorld = this.app.planets.find(planet => planet.id === this.faction.homeWoldPlanetId);
        if (!homeWorld || !homeWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (TRADE)");
        }

        // fly to a specific planet
        if (this.stage === 0 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // return to home world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(homeWorld.pathingNode);
        } else if (this.stage === 1 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // trade with homeWorld
            homeWorld.trade(this.owner);

            // find colony world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(colonyWorld.pathingNode);
        } else if (this.stage === 2 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // trade with colony world
            colonyWorld.trade(this.owner);

            // return to home world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(homeWorld.pathingNode);
        } else if (this.stage === 3 && this.owner.pathFinding.points.length === 0) {
            // check if order expired
            if (this.runningTicks >= this.expireTicks) {
                // end order
                const index = this.faction.explorationGraph[this.planetId].traderShipIds.findIndex(s => s === this.owner.id);
                if (index >= 0) {
                    this.faction.explorationGraph[this.planetId].traderShipIds.splice(index, 1);
                }
                this.owner.removeOrder(this);
            } else {
                // reset order
                this.stage = 0;
            }
        }
    }

    /**
     * An order automatically created after destroying a ship and picking up its cargo. The order is to return to
     * the home world to deliver the pirated cargo.
     * @private
     */
    private pirate() {
        // pirated cargo is a shortcut to piracy, skipping the assigned planet piracy
        const hasPiratedCargo = this.owner.hasPirateCargo();

        // pirates will wait until the expiration time to pirate ships
        const pirateOrderExpired = this.runningTicks >= this.expireTicks;

        if (!this.planetId && !hasPiratedCargo) {
            throw new Error("Could not find planetId to path to (PIRATE)");
        }
        const colonyWorld = this.app.planets.find(planet => this.planetId && planet.id === this.planetId);
        if ((!colonyWorld || !colonyWorld.pathingNode) && !hasPiratedCargo) {
            throw new Error("Could not find home world for pathing back to home world (PIRATE)");
        }
        const homeWorld = this.app.planets.find(planet => planet.id === this.faction.homeWoldPlanetId);
        if (!homeWorld || !homeWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (PIRATE)");
        }

        // shortcut to returning pirated cargo, required by the player since the player can shortcut the piracy mission
        if (hasPiratedCargo && this.stage < 2) {
            this.stage = 2;
        }

        // fly to a specific planet
        if (this.stage === 0 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // return to home world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(homeWorld.pathingNode);
        } else if (this.stage === 1 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // trade with homeWorld
            homeWorld.trade(this.owner, true);

            // find colony world
            if (colonyWorld && colonyWorld.pathingNode) {
                const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
                const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
                this.owner.pathFinding.points = nearestNode.pathToObject(colonyWorld.pathingNode);
            }
        } else if (this.stage === 2 && (hasPiratedCargo || pirateOrderExpired)) {
            this.stage += 1;

            // wait at colony world
            // get cargo

            // return to home world
            const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
            const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
            this.owner.pathFinding.points = nearestNode.pathToObject(homeWorld.pathingNode);
        } else if (this.stage === 3 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // trade with homeWorld
            homeWorld.trade(this.owner, true);

            // end order
            this.owner.removeOrder(this);
        }
    }

    /**
     * Determine what a ship should do.
     */
    public handleOrderLoop() {
        if (this.orderType === EOrderType.ROAM) {
            this.roam();
        } else if (this.orderType === EOrderType.SETTLE) {
            this.settle();
        } else if (this.orderType === EOrderType.TRADE) {
            this.trade();
        } else if (this.orderType === EOrderType.PIRATE) {
            this.pirate();
        }
        this.runningTicks += 1;
    }

    /**
     * Determine if the ship is in the mission area.
     */
    public isInMissionArea(): boolean {
        switch (this.orderType) {
            case EOrderType.SETTLE:
            case EOrderType.TRADE: {
                // trade and settler ships are suppose to be between the colony world and home world, trading
                const colonyWorld = this.app.planets.find(planet => planet.id === this.planetId);
                if (!colonyWorld || !colonyWorld.pathingNode) {
                    throw new Error("Could not find home world for pathing back to home world (MISSION AREA)");
                }
                const homeWorld = this.app.planets.find(planet => planet.id === this.faction.homeWoldPlanetId);
                if (!homeWorld || !homeWorld.pathingNode) {
                    throw new Error("Could not find home world for pathing back to home world (MISSION AREA)");
                }

                const homeWorldPosition = homeWorld.position.clone().rotateVector([0, 0, 1]);
                const colonyWorldPosition = colonyWorld.position.clone().rotateVector([0, 0, 1]);
                const shipPosition = this.owner.position.clone().rotateVector([0, 0, 1]);
                const distanceOfTradeRoute = VoronoiGraph.angularDistance(homeWorldPosition, colonyWorldPosition, this.app.worldScale);
                const distanceToHomeWorld = VoronoiGraph.angularDistance(homeWorldPosition, shipPosition, this.app.worldScale);
                const distanceToColonyWorld = VoronoiGraph.angularDistance(shipPosition, colonyWorldPosition, this.app.worldScale);
                return distanceToHomeWorld + distanceToColonyWorld < distanceOfTradeRoute * 1.5;
            }
            case EOrderType.PIRATE: {
                // pirate cargo mission area is the home world
                if (this.owner.hasPirateCargo()) {
                    return false;
                }

                // pirates are suppose to be near the colony world, to attack weak trade ships
                const colonyWorld = this.app.planets.find(planet => planet.id === this.planetId);
                if (!colonyWorld || !colonyWorld.pathingNode) {
                    throw new Error("Could not find home world for pathing back to home world (MISSION AREA)");
                }
                const homeWorld = this.app.planets.find(planet => planet.id === this.faction.homeWoldPlanetId);
                if (!homeWorld || !homeWorld.pathingNode) {
                    throw new Error("Could not find home world for pathing back to home world (MISSION AREA)");
                }

                const homeWorldPosition = homeWorld.position.clone().rotateVector([0, 0, 1]);
                const colonyWorldPosition = colonyWorld.position.clone().rotateVector([0, 0, 1]);
                const shipPosition = this.owner.position.clone().rotateVector([0, 0, 1]);
                const distanceOfTradeRoute = VoronoiGraph.angularDistance(homeWorldPosition, colonyWorldPosition, this.app.worldScale);
                const distanceToHomeWorld = VoronoiGraph.angularDistance(homeWorldPosition, shipPosition, this.app.worldScale);
                const distanceToColonyWorld = VoronoiGraph.angularDistance(shipPosition, colonyWorldPosition, this.app.worldScale);
                return distanceToHomeWorld + distanceToColonyWorld < distanceOfTradeRoute * 1.5 && distanceToColonyWorld > distanceToHomeWorld;
            }
            case EOrderType.ROAM:
            default: {
                // roaming and default is always in mission area
                return true;
            }
        }
    }
}