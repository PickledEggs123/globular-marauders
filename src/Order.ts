/**
 * A type of order for a ship to complete. Orders are actions the ship should take on behalf of the faction.
 */
import {Ship, SHIP_DATA} from "./Ship";
import App from "./App";
import {DelaunayGraph, VoronoiGraph} from "./Graph";
import {ESettlementLevel} from "./Interface";
import {Faction} from "./Faction";
import {Planet} from "./Planet";

/**
 * Different type of orders a faction can issue its ships.
 */
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
    /**
     * Send a ship to the planet's lord so the lord can use the ship for a better purpose.
     */
    TRIBUTE = "TRIBUTE",
}

/**
 * Different results of an order a ship can report back to it's faction.
 */
export enum EOrderResult {
    /**
     * The order completed successfully without issue.
     */
    SUCCESS = "SUCCESS",
    /**
     * The order failed because of too many enemy ships.
     */
    RETREAT = "RETREAT",
}

export class Order {
    public app: App;
    public owner: Ship;
    public faction: Faction;
    public orderType: EOrderType = EOrderType.ROAM;
    public orderResult: EOrderResult = EOrderResult.SUCCESS;
    public enemyStrength: number = 0;
    public planetId: string | null = null;
    public expireTicks: number = 0;
    private stage: number = 0;
    private runningTicks: number = 0;

    constructor(app: App, owner: Ship, faction: Faction) {
        this.app = app;
        this.owner = owner;
        this.faction = faction;
    }

    public cancelOrder(enemyStrength: number) {
        this.orderResult = EOrderResult.RETREAT;
        this.enemyStrength = enemyStrength;
    }

    public isOrderCancelled(): boolean {
        return this.orderResult === EOrderResult.RETREAT;
    }

    public pickRandomPlanet() {
        const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
        const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
        const nodes = Object.values(this.app.delaunayGraph.pathingNodes);
        const randomTarget = nodes[Math.floor(Math.random() * nodes.length)];
        this.owner.pathFinding.points = nearestNode.pathToObject(randomTarget);
        this.owner.activeKeys.splice(0, this.owner.activeKeys.length);
    }

    public returnToHomeWorld() {
        const homeWorld = this.owner.planet;
        if (!homeWorld || !homeWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (RETURN TO HOME WORLD)");
        }

        const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
        const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
        this.owner.pathFinding.points = nearestNode.pathToObject(homeWorld.pathingNode);
        this.owner.activeKeys.splice(0, this.owner.activeKeys.length);
    }

    public goToColonyWorld() {
        if (!this.planetId) {
            throw new Error("Could not find planetId to path to (GO TO COLONY)");
        }
        const colonyWorld = this.app.planets.find(planet => planet.id === this.planetId);
        if (!colonyWorld || !colonyWorld.pathingNode) {
            throw new Error("Could not find colony world for pathing back to colony world (GO TO COLONY)");
        }

        const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
        const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
        this.owner.pathFinding.points = nearestNode.pathToObject(colonyWorld.pathingNode);
        this.owner.activeKeys.splice(0, this.owner.activeKeys.length);
    }

    public goToColonyWorldToPirate() {
        if (!this.planetId) {
            throw new Error("Could not find planetId to path to (PIRATE COLONY)");
        }
        const colonyWorld = this.app.planets.find(planet => planet.id === this.planetId);
        if (!colonyWorld || !colonyWorld.pathingNode) {
            throw new Error("Could not find colony world for pathing to enemy colony world (PIRATE COLONY)");
        }
        const enemyHomeWorld = colonyWorld.getLordWorld();
        if (!enemyHomeWorld || !enemyHomeWorld.pathingNode) {
            throw new Error("Could not find enemy home world (PIRATE COLONY)");
        }

        // compute hiding spot of the pirate
        const hidingSpot = DelaunayGraph.normalize(App.lerp(
            colonyWorld.position.rotateVector([0, 0, 1]),
            enemyHomeWorld.position.rotateVector([0, 0, 1]),
            0.25
        ));

        const shipPosition = this.owner.position.rotateVector([0, 0, 1]);
        const nearestNode = this.app.delaunayGraph.findClosestPathingNode(shipPosition);
        this.owner.pathFinding.points = [
            ...nearestNode.pathToObject(colonyWorld.pathingNode),
            hidingSpot
        ];
        this.owner.activeKeys.splice(0, this.owner.activeKeys.length);
    }

    public beginSettlementMission() {
        const homeWorld = this.owner.planet;
        if (!homeWorld || !homeWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (SETTLE)");
        }

        homeWorld.trade(this.owner);
    }

    public endSettlementMission() {
        const homeWorld = this.owner.planet;
        if (!homeWorld || !homeWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (SETTLE)");
        }

        homeWorld.trade(this.owner, true);
    }

    public beginTradeMission() {
        const homeWorld = this.owner.planet;
        if (!homeWorld || !homeWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (TRADE)");
        }

        homeWorld.trade(this.owner);
    }

    public transferToNewLord() {
        const newLordWorld = this.app.planets.find(planet => planet.id === this.planetId);
        if (!newLordWorld || !newLordWorld.pathingNode) {
            throw new Error("Could not find lord world for pathing back to home world (TRIBUTE)");
        }

        newLordWorld.tribute(this.owner);
    }

    public beginPirateMission() {
        const homeWorld = this.owner.planet;
        if (!homeWorld || !homeWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (PIRATE)");
        }

        homeWorld.trade(this.owner, true);
    }

    public updateSettlementProgress() {
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

        const wasSettledByAnotherFactionYet = Object.values(this.app.factions).some(f => {
            return !!(this.planetId && f.planetIds.includes(this.planetId) && f.id !== this.faction.id);
        });
        if (!wasSettledByAnotherFactionYet) {
            colonyWorld.settlementProgress = (
                Math.round(colonyWorld.settlementProgress * Planet.NUM_SETTLEMENT_PROGRESS_STEPS) + shipData.settlementProgressFactor
            ) / Planet.NUM_SETTLEMENT_PROGRESS_STEPS;
            if (colonyWorld.settlementProgress >= 1 && colonyWorld.settlementLevel < ESettlementLevel.OUTPOST) {
                colonyWorld.settlementLevel = ESettlementLevel.OUTPOST;
            } else if (colonyWorld.settlementProgress >= 5 && colonyWorld.settlementLevel < ESettlementLevel.COLONY) {
                colonyWorld.settlementLevel = ESettlementLevel.COLONY;
            }
            if (!this.faction.planetIds.includes(this.planetId)) {
                this.faction.planetIds.push(this.planetId);
                colonyWorld.claim(this.faction)
            }

            // trade with homeWorld
            colonyWorld.trade(this.owner);
        }
    }

    public tradeWithColony() {
        if (!this.planetId) {
            throw new Error("Could not find planetId to path to (TRADE)");
        }
        const colonyWorld = this.app.planets.find(planet => planet.id === this.planetId);
        if (!colonyWorld || !colonyWorld.pathingNode) {
            throw new Error("Could not find home world for pathing back to home world (TRADE)");
        }

        colonyWorld.trade(this.owner);
    }

    private roam() {
        // cancel order by going back to home world
        if (this.isOrderCancelled()) {
            this.stage = 3;

            // return to home world
            this.returnToHomeWorld();
        }

        // pick random planets
        if (this.stage === 0 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // return to home world
            this.returnToHomeWorld();
        } else  if (this.stage === 1 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            this.beginPirateMission();

            // explore a random planet
            this.pickRandomPlanet();
        } else if (this.stage === 2 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // return to home world
            this.returnToHomeWorld();
        } else if (this.stage === 3 && this.owner.pathFinding.points.length === 0) {
            // end order
            this.owner.removeOrder(this);
        }
    }

    private settle() {
        // cancel order by going back to home world
        if (this.isOrderCancelled()) {
            this.stage = 3;

            // return to home world
            this.returnToHomeWorld();
        }

        // fly to a specific planet
        if (this.stage === 0 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // return to home world
            this.returnToHomeWorld();
        } else if (this.stage === 1 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // trade with homeWorld
            this.beginSettlementMission();

            // find colony world
            this.goToColonyWorld();
        } else if (this.stage === 2 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1

            // update settlement progress
            this.updateSettlementProgress();

            // return to home world
            this.returnToHomeWorld();
        } else if (this.stage === 3 && this.owner.pathFinding.points.length === 0) {
            this.endSettlementMission();

            // end order
            this.owner.removeOrder(this);
        }
    }

    private trade() {
        // cancel order by going back to home world
        if (this.isOrderCancelled()) {
            this.stage = 3;

            // return to home world
            this.returnToHomeWorld();
        }

        // fly to a specific planet
        if (this.stage === 0 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // return to home world
            this.returnToHomeWorld();
        } else if (this.stage === 1 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // trade with homeWorld
            this.beginTradeMission();

            // find colony world
            this.goToColonyWorld();
        } else if (this.stage === 2 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // trade with colony world
            this.tradeWithColony();

            // return to home world
            this.returnToHomeWorld();
        } else if (this.stage === 3 && this.owner.pathFinding.points.length === 0) {
            // check if order expired
            if (this.runningTicks >= this.expireTicks || this.isOrderCancelled()) {
                // end order
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
        // cancel order by going back to home world
        if (this.isOrderCancelled()) {
            this.stage = 3;

            // return to home world
            this.returnToHomeWorld();
        }

        // pirated cargo is a shortcut to piracy, skipping the assigned planet piracy
        const hasPiratedCargo = this.owner.hasPirateCargo();
        const isNearPirateCrate = !!this.owner.nearPirateCrate();

        // pirates will wait until the expiration time to pirate ships
        const pirateOrderExpired = this.runningTicks >= this.expireTicks;

        // shortcut to returning pirated cargo, required by the player since the player can shortcut the piracy mission
        if (hasPiratedCargo && this.stage < 2) {
            this.stage = 2;
        }

        // fly to a specific planet
        if (this.stage === 0 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // return to home world
            this.returnToHomeWorld();
        } else if (this.stage === 1 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // trade with homeWorld
            this.beginPirateMission();

            // find colony world
            this.goToColonyWorldToPirate();
        } else if (this.stage === 2) {
            if (hasPiratedCargo || pirateOrderExpired) {
                this.stage += 1;

                // wait at colony world
                // get cargo

                // return to home world
                this.returnToHomeWorld();
            } else if (!this.owner.fireControl.isAttacking && !isNearPirateCrate && this.owner.pathFinding.points.length === 0) {
                // wait at colony world
                this.goToColonyWorldToPirate();
            }
        } else if (this.stage === 3 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // trade with homeWorld
            this.beginPirateMission();

            // end order
            this.owner.removeOrder(this);
        }
    }

    /**
     * An order for the current smaller planet to give a free ship to the larger lord planet.
     * @private
     */
    private tribute() {
        // fly to a specific planet
        if (this.stage === 0 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // return to home world
            this.returnToHomeWorld();
        } else if (this.stage === 1 && this.owner.pathFinding.points.length === 0) {
            this.stage += 1;

            // end order
            this.owner.removeOrder(this);

            // transfer to lord
            this.transferToNewLord();
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
        } else if (this.orderType === EOrderType.TRIBUTE) {
            this.tribute();
        }
        this.runningTicks += 1;
    }

    /**
     * Determine if the ship is in the mission area.
     */
    public isInMissionArea(): boolean {
        switch (this.orderType) {
            case EOrderType.TRIBUTE:
            case EOrderType.SETTLE:
            case EOrderType.TRADE: {
                // trade and settler ships are suppose to be between the colony world and home world, trading
                // attack only when between colony world and home world
                const colonyWorld = this.app.planets.find(planet => planet.id === this.planetId);
                if (!colonyWorld || !colonyWorld.pathingNode) {
                    throw new Error("Could not find home world for pathing back to home world (MISSION AREA)");
                }
                const homeWorld = this.owner.planet;
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
                // pirate has cargo, do not attack
                if (this.owner.hasPirateCargo()) {
                    return false;
                }

                // pirates can attack at any time
                return true;
            }
            case EOrderType.ROAM:
            default: {
                // roaming and default, attacking is allowed anywhere
                return true;
            }
        }
    }
}