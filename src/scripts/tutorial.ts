import {
    EMessageType, Game, IAutoPilotMessage,
    IChooseFactionMessage,
    IChoosePlanetMessage,
    IMessage, IPlayerData, ISpawnLocationResult, ISpawnMessage, ISpawnPlanet
} from "@pickledeggs123/globular-marauders-game/lib/src/Game";
import {EShipType} from "@pickledeggs123/globular-marauders-game/lib/src/ShipType";
import {Sound} from "@pixi/sound";
import {EInvasionPhase, Invasion} from "@pickledeggs123/globular-marauders-game/lib/src/Invasion";
import {EFaction} from "@pickledeggs123/globular-marauders-game/lib/src/EFaction";
import {Planet} from "@pickledeggs123/globular-marauders-game/lib/src/Planet";
import {EOrderType, Order} from "@pickledeggs123/globular-marauders-game/lib/src/Order";
import {VoronoiGraph} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";
import Quaternion from "quaternion";
import {EAutomatedShipBuffType, IAutomatedShipBuff} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import {EResourceType} from "@pickledeggs123/globular-marauders-game/lib/src/Resource";
import {Ship} from "@pickledeggs123/globular-marauders-game/lib/src/Ship";
import PixiGame from "../pages/PixiGame";

export interface ITutorialScriptContext {
    tutorialPlayerData: IPlayerData;
    sendPlayers: () => {players: IPlayerData[], playerId: string};
    sendSpawnPlanets: () => ISpawnPlanet[] | null;
    sendSpawnLocations: () => ISpawnLocationResult | null;
}

export const tutorialScript = function (this: PixiGame, context: ITutorialScriptContext) {
    const {
        tutorialPlayerData,
        sendSpawnPlanets,
        sendSpawnLocations,
    } = context;
    return (function*(this: PixiGame) {
        const sendMessage = (message: IMessage) => {
            this.game.outgoingMessages.push(["pirateDude", message]);
        };
        const waitForValue = (check: () => boolean, save: () => void): IterableIterator<void> => {
            return (function*(this: PixiGame) {
                while (true) {
                    if (!(check())) {
                        yield;
                        continue;
                    }
                    save();
                    break;
                }
            }).call(this);
        };
        const waitFor = (numTicks: number): IterableIterator<void> => {
            return (function*(this: PixiGame) {
                for (let i = 0; i < numTicks; i++) {
                    yield;
                }
            }).call(this);
        };

        const context: {
            planetId: string | undefined;
            shipType: EShipType | undefined;
            tutorialSound: Sound | undefined;
            tutorialSoundComplete: boolean;
            invasion: Invasion | undefined;
        } = {
            planetId: undefined,
            shipType: undefined,
            tutorialSound: undefined,
            tutorialSoundComplete: false,
            invasion: undefined,
        };
        const handlePlaySound = () => {
            const instance = context.tutorialSound!.play();
            context.tutorialSoundComplete = false;
            if ("on" in instance) {
                instance.on("end", () => {
                    context.tutorialSoundComplete = true;
                });
            } else {
                instance.then((i) => {
                    i.on("end", () => {
                        context.tutorialSoundComplete = true;
                    });
                });
            }
        };
        const setMouseImageClass = (mouseImageClass: string | undefined) => {
            return (function*(this: PixiGame) {
                this.setState({mouseImageClass});
                yield;
            }).call(this);
        };
        const setKeyboardImageClass = (keyboardImageClass: string | undefined) => {
            return (function*(this: PixiGame) {
                this.setState({keyboardImageClass});
                yield;
            }).call(this);
        };
        const giveTradeMission = (): IterableIterator<void> => {
            return (function*(this: PixiGame) {
                const dutchFaction = this.game.factions.get(EFaction.DUTCH)!;
                const dutchHomeWorld = this.game.planets.get(dutchFaction.homeWorldPlanetId)!;
                const dutchColonies = dutchHomeWorld.county.duchy.kingdom.duchies.reduce((acc: Planet[], d): Planet[] => {
                    acc.push(...d.counties.reduce((acc2: Planet[], c): Planet[] => {
                        if (c.planet && c.planet !== dutchHomeWorld) {
                            acc2.push(c.planet);
                        }
                        return acc2;
                    }, [] as Planet[]));
                    return acc;
                }, [] as Planet[]);
                const randomColony = dutchColonies[Math.floor(dutchColonies.length * Math.random())];
                const ship = this.findPlayerShip()!;
                ship.orders.forEach(o => o.cancelOrder(0));
                const tradeOrder = new Order(this.game, ship, ship.faction!);
                tradeOrder.orderType = EOrderType.SETTLE;
                tradeOrder.planetId = randomColony.id;
                ship.orders.push(tradeOrder);
                yield;
            }).call(this);
        };

        const actions: Array<IterableIterator<void>> = [
            // login as tutorial player
            //
            // pick dutch
            (function*(this: PixiGame) {
                const chooseFactionMessage: IChooseFactionMessage = {
                    messageType: EMessageType.CHOOSE_FACTION,
                    factionId: EFaction.DUTCH,
                };
                sendMessage(chooseFactionMessage);
                yield;
            }).call(this),
            // pick first planet
            waitForValue(() => {
                const spawnPlanets = sendSpawnPlanets();
                return !!spawnPlanets && !!spawnPlanets[0];
            }, () => {
                const spawnPlanets = sendSpawnPlanets();
                context.planetId = spawnPlanets![0].planetId;
            }),
            (function*(this: PixiGame) {
                const choosePlanetMessage: IChoosePlanetMessage = {
                    messageType: EMessageType.CHOOSE_PLANET,
                    planetId: context.planetId!,
                };
                sendMessage(choosePlanetMessage);
                yield;
            }).call(this),
            // disable autopilot
            (function*(this: PixiGame) {
                this.setState({
                    ...this.state,
                    autoPilotEnabled: false,
                }, () => {
                    const message: IAutoPilotMessage = {
                        messageType: EMessageType.AUTOPILOT,
                        enabled: false
                    };
                    this.game.outgoingMessages.push(["pirateDude", message]);
                });
                yield;
            }).call(this),
            // disable keyboard
            (function*(this: PixiGame) {
                tutorialPlayerData.filterActiveKeys = [];
                yield;
            }).call(this),
            // pick spawn location
            waitForValue(() => {
                const spawnLocations = sendSpawnLocations();
                return !!spawnLocations && !!spawnLocations.results[0];
            }, () => {
                const spawnLocations = sendSpawnLocations();
                context.shipType = spawnLocations!.results[0]!.shipType;
            }),
            (function*(this: PixiGame) {
                const spawnMessage: ISpawnMessage = {
                    messageType: EMessageType.SPAWN,
                    planetId: context.planetId!,
                    shipType: context.shipType!
                };
                sendMessage(spawnMessage);
                yield;
            }).call(this),

            // zoom tutorial
            //
            // play intro
            (function*(this: PixiGame) {
                context.tutorialSound = Sound.from({
                    url: "audio/tutorial/TutorialWelcomeZoom.m4a",
                    autoplay: true,
                });
                handlePlaySound();
                yield;
            }).call(this),
            setMouseImageClass("middle-wheel"),
            waitForValue(() => {
                return this.state.zoom * this.game.worldScale <= 2;
            }, () => {}),
            waitForValue(() => {
                return this.state.zoom * this.game.worldScale >= 8;
            }, () => {}),
            setMouseImageClass(undefined),
            (function*(this: PixiGame) {
                if (!context.tutorialSoundComplete) {
                    context.tutorialSound!.stop();
                }
                yield;
            }).call(this),

            // movement tutorial
            //
            // play movement
            (function*(this: PixiGame) {
                tutorialPlayerData.filterActiveKeys = ["w"];
                yield;
            }).call(this),
            setKeyboardImageClass("w"),
            (function*(this: PixiGame) {
                context.tutorialSound = Sound.from({
                    url: "audio/tutorial/TutorialMovement.m4a",
                    autoplay: true,
                });
                handlePlaySound();
                yield;
            }).call(this),
            // speed up
            waitForValue(() => {
                return this.activeKeys.includes("w");
            }, () => {}),
            waitFor(10),
            // drift forward
            waitForValue(() => {
                return !this.activeKeys.includes("w");
            }, () => {}),
            waitFor(10),
            // slow down
            (function*(this: PixiGame) {
                tutorialPlayerData.filterActiveKeys = ["w", "s"];
                yield;
            }).call(this),
            setKeyboardImageClass("s"),
            waitForValue(() => {
                return this.activeKeys.includes("s");
            }, () => {}),
            waitFor(10),
            // stop
            waitForValue(() => {
                return !!this.findPlayerShip() && VoronoiGraph.angularDistanceQuaternion(this.findPlayerShip()!.positionVelocity, this.game.worldScale) <= Game.VELOCITY_STEP * Math.PI / 2 * 3;
            }, () => {}),
            (function*(this: PixiGame) {
                if (!context.tutorialSoundComplete) {
                    context.tutorialSound!.stop();
                }
                yield;
            }).call(this),

            // rotate tutorial
            //
            // play rotate
            (function*(this: PixiGame) {
                tutorialPlayerData.filterActiveKeys = ["w", "s", "d"];
                yield;
            }).call(this),
            setKeyboardImageClass("a"),
            (function*(this: PixiGame) {
                context.tutorialSound = Sound.from({
                    url: "audio/tutorial/TutorialRotate.m4a",
                    autoplay: true,
                });
                handlePlaySound();
                yield;
            }).call(this),
            // speed up
            waitForValue(() => {
                return this.activeKeys.includes("d");
            }, () => {}),
            waitFor(10),
            // drift left
            waitForValue(() => {
                return !this.activeKeys.includes("d");
            }, () => {}),
            waitFor(10),
            // slow down
            (function*(this: PixiGame) {
                tutorialPlayerData.filterActiveKeys = ["w", "a", "s", "d"];
                yield;
            }).call(this),
            setKeyboardImageClass("d"),
            waitForValue(() => {
                return this.activeKeys.includes("a");
            }, () => {}),
            waitFor(10),
            // stop
            waitForValue(() => {
                return !!this.findPlayerShip() && VoronoiGraph.angularDistanceQuaternion(this.findPlayerShip()!.orientationVelocity, 1) < Game.ROTATION_STEP * Math.PI / 2;
            }, () => {}),
            (function*(this: PixiGame) {
                if (!context.tutorialSoundComplete) {
                    context.tutorialSound!.stop();
                }
                yield;
            }).call(this),

            // movement and rotation done
            setKeyboardImageClass(undefined),
            (function*(this: PixiGame) {
                context.tutorialSound = Sound.from({
                    url: "audio/tutorial/TutorialRotateDone.m4a",
                    autoplay: true,
                });
                handlePlaySound();
                yield;
            }).call(this),
            (function*(this: PixiGame) {
                while (!context.tutorialSoundComplete) {
                    yield;
                }
            }).call(this),

            // press space bar
            (function*(this: PixiGame) {
                tutorialPlayerData.filterActiveKeys = ["w", "a", "s", "d", " "];
                yield;
            }).call(this),
            setKeyboardImageClass("space"),
            (function*(this: PixiGame) {
                context.tutorialSound = Sound.from({
                    url: "audio/tutorial/TutorialPressSpacebar.m4a",
                    autoplay: true,
                });
                handlePlaySound();
                yield;
            }).call(this),
            // space bar
            waitForValue(() => {
                return this.activeKeys.includes(" ");
            }, () => {}),
            setKeyboardImageClass(undefined),
            (function*(this: PixiGame) {
                if (!context.tutorialSoundComplete) {
                    context.tutorialSound!.stop();
                }
                yield;
            }).call(this),

            // attack enemy ship
            (function*(this: PixiGame) {
                tutorialPlayerData.filterActiveKeys = undefined;
                yield;
            }).call(this),
            (function*(this: PixiGame) {
                context.tutorialSound = Sound.from({
                    url: "audio/tutorial/TutorialPleaseDestroyEnemyShip.m4a",
                    autoplay: true,
                });
                handlePlaySound();
                yield;
            }).call(this),
            (function*(this: PixiGame) {
                const englishFaction = this.game.factions.get(EFaction.ENGLISH)!;
                const englishHomeWorld = this.game.planets.get(englishFaction.homeWorldPlanetId)!;
                englishHomeWorld.spawnEventShip(tutorialPlayerData.moneyAccount, EShipType.CUTTER, (ship) => {
                    const playerShip = this.getPlayerShip()!;
                    ship.position = playerShip.position.clone().mul(Quaternion.fromBetweenVectors([0, 0, 1], playerShip.orientation.rotateVector([1, 0, 0])).pow(Game.VELOCITY_STEP * 300));
                    const disabledBuff: IAutomatedShipBuff = {
                        buffType: EAutomatedShipBuffType.DISABLED,
                        expireTicks: 24 * 60 * 60 * 10,
                    };
                    const order = new Order(this.game, ship, ship.faction!);
                    order.orderType = EOrderType.ROAM;
                    order.expireTicks = 24 * 60 * 60 * 10;
                    ship.orders[0] = order;
                    ship.buffs.push(disabledBuff);
                    ship.cargo[0] = {
                        sourcePlanetId: englishHomeWorld.id,
                        resourceType: EResourceType.CACAO,
                        amount: 1,
                        pirated: false,
                    };
                });
                yield;
            }).call(this),
            // destroyed ship
            waitForValue(() => {
                const englishFaction = this.game.factions.get(EFaction.ENGLISH)!;
                return englishFaction.shipIds.length === 0;
            }, () => {}),
            (function*(this: PixiGame) {
                if (!context.tutorialSoundComplete) {
                    context.tutorialSound!.stop();
                }
                yield;
            }).call(this),

            // deliver pirate cargo
            (function*(this: PixiGame) {
                context.tutorialSound = Sound.from({
                    url: "audio/tutorial/TutorialDropOffLoot.m4a",
                    autoplay: true,
                });
                handlePlaySound();
                yield;
            }).call(this),
            // picked up cargo
            waitForValue(() => {
                return !!this.findPlayerShip()!.cargo[0];
            }, () => {}),
            (function*(this: PixiGame) {
                if (!context.tutorialSoundComplete) {
                    context.tutorialSound!.stop();
                }
                yield;
            }).call(this),
            (function*(this: PixiGame) {
                context.tutorialSound = Sound.from({
                    url: "audio/tutorial/TutorialPirate.m4a",
                    autoplay: true,
                });
                handlePlaySound();
                yield;
            }).call(this),
            // delivered cargo
            waitForValue(() => {
                return !this.findPlayerShip()!.cargo[0];
            }, () => {}),
            (function*(this: PixiGame) {
                if (!context.tutorialSoundComplete) {
                    context.tutorialSound!.stop();
                }
                yield;
            }).call(this),

            // trade mission
            (function*(this: PixiGame) {
                context.tutorialSound = Sound.from({
                    url: "audio/tutorial/TutorialTrading.m4a",
                    autoplay: true,
                });
                handlePlaySound();
                yield;
            }).call(this),
            giveTradeMission(),
            waitForValue(() => {
                return !this.findPlayerShip()!.orders.some(o => o.orderType === EOrderType.SETTLE);
            }, () => {}),
            giveTradeMission(),
            (function*(this: PixiGame) {
                if (!context.tutorialSoundComplete) {
                    context.tutorialSound!.stop();
                }
                yield;
            }).call(this),

            // auto pilot mission
            (function*(this: PixiGame) {
                context.tutorialSound = Sound.from({
                    url: "audio/tutorial/TutorialAutoPilot.m4a",
                    autoplay: true,
                });
                handlePlaySound();
                yield;
            }).call(this),
            (function*(this: PixiGame) {
                tutorialPlayerData.filterActiveKeys = [];
                this.setState({
                    highlightAutopilotButton: true
                });
                yield;
            }).call(this),
            waitForValue(() => {
                return tutorialPlayerData.autoPilotEnabled;
            }, () => {}),
            (function*(this: PixiGame) {
                tutorialPlayerData.filterActiveKeys = undefined;
                this.setState({
                    highlightAutopilotButton: false
                });
                yield;
            }).call(this),
            (function*(this: PixiGame) {
                if (!context.tutorialSoundComplete) {
                    context.tutorialSound!.stop();
                }
                yield;
            }).call(this),

            // auto pilot enabled
            (function*(this: PixiGame) {
                context.tutorialSound = Sound.from({
                    url: "audio/tutorial/TutorialAutoPilotEnabled.m4a",
                    autoplay: true,
                });
                handlePlaySound();
                yield;
            }).call(this),
            waitForValue(() => {
                return !this.findPlayerShip()!.orders.some(o => o.orderType === EOrderType.SETTLE);
            }, () => {}),
            giveTradeMission(),
            waitForValue(() => {
                return !this.findPlayerShip()!.orders.some(o => o.orderType === EOrderType.SETTLE);
            }, () => {}),
            (function*(this: PixiGame) {
                if (!context.tutorialSoundComplete) {
                    context.tutorialSound!.stop();
                }
                yield;
            }).call(this),

            // invasion mode
            (function*(this: PixiGame) {
                context.tutorialSound = Sound.from({
                    url: "audio/tutorial/TutorialInvasion.m4a",
                    autoplay: true,
                });
                handlePlaySound();
                yield;
            }).call(this),
            (function*(this: PixiGame) {
                const dutchFaction = this.game.factions.get(EFaction.DUTCH)!;
                const dutchHomeWorld = this.game.planets.get(dutchFaction.homeWorldPlanetId)!;

                const englishFaction = this.game.factions.get(EFaction.ENGLISH)!;
                const englishHomeWorld = this.game.planets.get(englishFaction.homeWorldPlanetId)!;

                context.invasion = new Invasion(this.game, dutchFaction, englishFaction, englishHomeWorld.id);
                this.game.invasions.set(englishHomeWorld.id, context.invasion!);

                const configureFriendlyShip = (ship: Ship) => {
                    const playerShip = this.getPlayerShip()!;
                    if (playerShip !== ship) {
                        ship.position = playerShip.position.clone().mul(Quaternion.fromBetweenVectors([0, 0, 1], playerShip.orientation.rotateVector([1, 0, 0])).pow(Game.VELOCITY_STEP * 300));
                    }
                    const order = new Order(this.game, ship, ship.faction!);
                    order.orderType = EOrderType.INVADE;
                    order.expireTicks = 10 * 60 * 10;
                    order.planetId = englishHomeWorld.id;
                    ship.orders.forEach(o => o.cancelOrder(0));
                    ship.orders.push(order);
                };
                dutchHomeWorld.spawnEventShip(dutchHomeWorld.moneyAccount!.cash!, EShipType.CUTTER, configureFriendlyShip);
                dutchHomeWorld.spawnEventShip(dutchHomeWorld.moneyAccount!.cash!, EShipType.CUTTER, configureFriendlyShip);
                dutchHomeWorld.spawnEventShip(dutchHomeWorld.moneyAccount!.cash!, EShipType.CUTTER, configureFriendlyShip);
                dutchHomeWorld.spawnEventShip(dutchHomeWorld.moneyAccount!.cash!, EShipType.SLOOP, configureFriendlyShip);
                dutchHomeWorld.spawnEventShip(dutchHomeWorld.moneyAccount!.cash!, EShipType.SLOOP, configureFriendlyShip);
                dutchHomeWorld.spawnEventShip(dutchHomeWorld.moneyAccount!.cash!, EShipType.CORVETTE, configureFriendlyShip);
                configureFriendlyShip(this.findPlayerShip()!);

                englishHomeWorld.spawnEventShip(englishHomeWorld.moneyAccount!.cash!, EShipType.CUTTER, () => {});
                englishHomeWorld.spawnEventShip(englishHomeWorld.moneyAccount!.cash!, EShipType.CUTTER, () => {});
                englishHomeWorld.spawnEventShip(englishHomeWorld.moneyAccount!.cash!, EShipType.SLOOP, () => {});
                yield;
            }).call(this),
            // destroyed ship
            waitForValue(() => {
                return context.invasion!.invasionPhase === EInvasionPhase.CAPTURED;
            }, () => {}),
            (function*(this: PixiGame) {
                if (!context.tutorialSoundComplete) {
                    context.tutorialSound!.stop();
                }
                yield;
            }).call(this),

            // end of tutorial
            (function*(this: PixiGame) {
                context.tutorialSound = Sound.from({
                    url: "audio/tutorial/TutorialDone.m4a",
                    autoplay: true,
                });
                handlePlaySound();
                yield;
            }).call(this),
            (function*(this: PixiGame) {
                while (!context.tutorialSoundComplete) {
                    yield;
                }
            }).call(this),
        ];

        while (actions.length > 0) {
            const result = actions[0]!.next();
            if (result.done) {
                actions.shift();
            } else {
                yield;
            }
        }
    }).call(this);
};