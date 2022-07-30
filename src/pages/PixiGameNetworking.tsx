import {EGameMode, PixiGameBase} from "./PixiGameBase";
import {MusicPlayer} from "../MusicPlayer";
import {
    ESoundEventType,
    ESoundType,
    Game,
    IGameInitializationFrame,
    IGameSyncFrame,
    IMessage,
    IPlayerData,
    ISpawnFaction,
    ISpawnLocationResult,
    ISpawnPlanet
} from "@pickledeggs123/globular-marauders-game/lib/src/Game";
import {ICameraState, IFormResult} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import {IMediaInstance, PlayOptions, sound} from "@pixi/sound";
import {VoronoiGraph} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";
import {DeserializeQuaternion, SerializeQuaternion} from "@pickledeggs123/globular-marauders-game/lib/src/Item";
import {PHYSICS_SCALE} from "@pickledeggs123/globular-marauders-game/lib/src/ShipType";
import SockJS from "sockjs-client";

const matchMakerService = "https://globular-marauders-matchmaker-eapfro3bmq-uc.a.run.app";

export abstract class PixiGameNetworking extends PixiGameBase {
    public music: MusicPlayer = new MusicPlayer();
    public initialized: boolean = false;
    public socket: WebSocket | undefined;
    public socketEvents: Record<string, (data: any) => void> = {};
    public spawnFactions: ISpawnFaction[] = [];
    public spawnPlanets: ISpawnPlanet[] = [];
    public spawnLocations: ISpawnLocationResult = {
        results: [],
        message: undefined
    };
    public forms: IFormResult = {
        cards: []
    };
    public hitMatchMaker: boolean = false;
    public shardIpAddress: string | null = null;
    public shardHostname: string | null = null;
    public shardPortNumber: number | null = null;
    public messages: IMessage[] = [];
    public localServerMessages: IMessage[] = [];
    public singlePlayerFormRequest: Array<{ type: string, data: { [key: string]: any } }> = [];

    // client loop stuff
    public clientLoopStart: number = performance.now();
    public clientLoopDelta: number = 1000 / 10;
    public clientLoopDeltaStart: number = performance.now();

    public numNetworkFrames: number = 0;

    continuousSounds = new Map<string, IMediaInstance>();

    public handleClientLoop() {
        const now = performance.now();
        const delta = (now - this.clientLoopDeltaStart) / this.clientLoopDelta;
        this.clientLoopDeltaStart = now;

        const movableArrays: Array<{
            array: ICameraState[]
        }> = [{
            array: Array.from(this.game.ships.values()),
        }, {
            array: Array.from(this.game.cannonBalls.values()),
        }, {
            array: Array.from(this.game.crates.values()),
        }];

        for (const {array: movableArray} of movableArrays) {
            for (const item of movableArray) {
                item.position = item.position.clone().mul(item.positionVelocity.clone().pow(delta));
                item.orientation = item.orientation.clone().mul(item.orientationVelocity.clone().pow(delta));
            }
        }
    }

    public submitForm(type: string, data: { [key: string]: any }) {
        if (this.state.gameMode === EGameMode.SINGLE_PLAYER) {
            this.singlePlayerFormRequest.push({
                type,
                data
            });
        }
    }

    handleSoundEffects = (serverFrame: boolean) => {
        // handle sounds
        const continuousSoundCheck = new Set<string>();
        for (const soundEvent of this.game.soundEvents) {
            if (!(soundEvent.shipId === this.findPlayerShip()?.id || soundEvent.soundType === ESoundType.HIT)) {
                continue;
            }
            const playOptions: PlayOptions = {
                volume: soundEvent.shipId === this.findPlayerShip()?.id ? 1 : 0.09
            };
            switch (soundEvent.soundEventType) {
                case ESoundEventType.ONE_OFF: {
                    const soundItem = sound.find(soundEvent.soundType);
                    if (soundItem && soundItem.isLoaded) {
                        sound.play(soundEvent.soundType, playOptions);
                    }
                    break;
                }
                case ESoundEventType.CONTINUOUS: {
                    playOptions.volume! *= 0.25;
                    const key = `${soundEvent.shipId}-${soundEvent.soundType}`;
                    if (!this.continuousSounds.has(key)) {
                        const soundItem = sound.find(soundEvent.soundType);
                        if (soundItem && soundItem.isLoaded) {
                            const mediaInstance = sound.play(soundEvent.soundType, playOptions) as IMediaInstance;
                            if (!(mediaInstance as any).then) {
                                this.continuousSounds.set(key, mediaInstance);
                            }
                        }
                    }
                    continuousSoundCheck.add(key);
                    break;
                }
            }
        }
        if (!serverFrame) {
            const stoppedContinuousSounds = Array.from(this.continuousSounds.keys()).filter(key => !continuousSoundCheck.has(key));
            for (const key of stoppedContinuousSounds) {
                const mediaInstance = this.continuousSounds.get(key)!;
                mediaInstance.stop();
                this.continuousSounds.delete(key);
            }
        }
    }

    handleSendWorld = (data: IGameInitializationFrame) => {
        this.setState({
            showSpawnMenu: false,
            showPlanetMenu: false,
            showMainMenu: true,
            showLoginMenu: false,
        });
        this.game.applyGameInitializationFrame(data);
        this.initialized = true;
        setTimeout(() => {
            this.sendMessage("init-loop");
        }, 500);
    };

    handleSendFrame = (data: IGameSyncFrame) => {
        this.numNetworkFrames += 1;
        setTimeout(() => {
            this.numNetworkFrames -= 1;
        }, 1000);

        const playerData = (this.playerId && this.game.playerData.get(this.playerId)) ?? null;
        if (playerData) {
            const ship = this.game.ships.get(playerData.shipId);
            const shipData = data.ships.update.find(s => s.id === playerData.shipId);
            if (ship && shipData && !playerData.autoPilotEnabled) {
                // cancel server position if the position difference is small
                if (VoronoiGraph.angularDistance(
                    ship.position.rotateVector([0, 0, 1]),
                    DeserializeQuaternion(shipData.position).rotateVector([0, 0, 1]),
                    this.game.worldScale
                ) < PHYSICS_SCALE * 100) {
                    shipData.position = SerializeQuaternion(ship.position);
                    shipData.positionVelocity = SerializeQuaternion(ship.positionVelocity);
                    shipData.orientation = SerializeQuaternion(ship.orientation);
                    shipData.orientationVelocity = SerializeQuaternion(ship.orientationVelocity);
                    shipData.cannonLoading = ship.cannonLoading;
                    shipData.cannonCoolDown = ship.cannonCoolDown;
                    shipData.cannonadeCoolDown = ship.cannonadeCoolDown;
                }
            }
        }
        const playerShipSoundEvents = this.game.soundEvents.filter(i => {
            const playerData = this.playerId && this.game.playerData.get(this.playerId);
            if (!playerData) {
                return false;
            }

            return !!playerData.shipId && !!i.shipId && playerData.shipId === i.shipId;
        });
        this.game.applyGameSyncFrame(data);
        this.game.soundEvents.push(...playerShipSoundEvents);
        this.resetClientLoop();
        this.handleSoundEffects(true);
    };

    handleSendPlayers = (data: { players: IPlayerData[], playerId: string }) => {
        this.game.playerData = new Map<string, IPlayerData>();
        data.players.forEach((d) => {
            this.game.playerData.set(d.id, d);
        });
        this.playerId = data.playerId;
    };

    handleGenericMessage = (data: IMessage) => {
        this.messages.push(data);
    };

    handleSpawnFactions = (data: ISpawnFaction[]) => {
        this.spawnFactions = data;
    };

    handleSpawnPlanets = (data: ISpawnPlanet[]) => {
        this.spawnPlanets = data;
    };

    handleSpawnLocations = (data: ISpawnLocationResult) => {
        this.spawnLocations = data;
    };

    handleForms = (data: IFormResult) => {
        this.forms = data;
    }

    public resetClientLoop() {
        const now = performance.now();
        const difference = now - this.clientLoopStart;
        if (difference < 10) {
            return;
        }
        this.clientLoopDelta = difference;
        this.clientLoopStart = now;
    }

    // networking messages, outgoing
    public sendMessage(event: string, message: any = undefined) {
        if (this.socket) {
            this.socket.send(JSON.stringify({
                event,
                message
            }));
        } else if ([EGameMode.TUTORIAL, EGameMode.SINGLE_PLAYER].includes(this.state.gameMode) && event === "generic-message") {
            this.localServerMessages.push(message);
        }
    }

    setupNetworking(autoLogin: boolean) {
        if (this.state.gameMode !== EGameMode.MULTI_PLAYER) {
            return;
        }
        if (!this.hitMatchMaker) {
            fetch(matchMakerService).then((res) => {
                return res.json();
            }).then((data) => {
                if (data.success) {
                    this.shardIpAddress = data.ip;
                    this.shardPortNumber = data.port;
                    this.shardHostname = data.hostname;
                    this.hitMatchMaker = true;
                    setTimeout(() => {
                        this.setupNetworking(false);
                    }, 10);
                    return
                } else {
                    this.setState({
                        matchMakerFailMessage: "The match maker has failed to find a game server.",
                    });
                }
            }).catch((err) => {
                console.error(err);
                this.setState({
                    matchMakerFailMessage: "The match maker has failed to find a game server.",
                });
            });
            return;
        }

        this.socket = new SockJS(((this.shardHostname ? "https:" : null) ?? window.location.protocol) + "//" + (this.shardHostname ?? this.shardIpAddress) + ":" + (this.shardHostname ? 443 : (this.shardPortNumber ?? 4000)) + "/game");
        this.socket.onerror = (err) => {
            console.log("Failed to connect", err);
        };
        this.socket.onmessage = (message) => {
            let data: { event: string, message: any } | null = null;
            try {
                data = JSON.parse(message.data) as { event: string, message: any };
            } catch {
            }
            if (data) {
                if (data.event === "send-frame") {
                    // send a message back to stop effects of nagle algorithm
                    // do not want messages to clump or buffer
                    // old message delays 100 100 100 300 0 0 100
                    // this line fixes the bug, so it is 100 100 100 100 100 100 100
                    // clumpy messages will cause interpolation bugs
                    this.sendMessage("ack", "ACK");
                }
                const matchingHandler = this.socketEvents[data.event];
                if (matchingHandler) {
                    matchingHandler(data.message);
                }
            }
        };
        this.socket.onclose = () => {
            this.initialized = false;
            this.music.stop();
            this.game = new Game();
            this.clearMeshes = true;
            this.game.worldScale = 4;
            this.game.initializeGame();
            this.setState({
                showSpawnMenu: false,
                showPlanetMenu: false,
                showMainMenu: false,
                showLoginMenu: true,
                init: false,
            });
            setTimeout(() => {
                this.setupNetworking.call(this, true);
            }, 2000);
        };
        this.socket.onopen = () => {
            this.setState({
                init: true
            });
            if (autoLogin) {
                this.handleLogin.call(this);
            }
        };
        this.socketEvents["shard-port-number"] = ({
                                                      portNumber,
                                                      isStandalone
                                                  }: { portNumber: number, isStandalone: boolean }) => {
            if (this.shardPortNumber === null) {
                this.shardPortNumber = portNumber;
            }
            if (this.socket && !isStandalone) {
                this.socket.close();
            }
        };
        this.socketEvents["send-world"] = this.handleSendWorld;
        this.socketEvents["ack-init-loop"] = () => {
        };
        this.socketEvents["send-frame"] = this.handleSendFrame;
        this.socketEvents["send-players"] = this.handleSendPlayers;
        this.socketEvents["generic-message"] = this.handleGenericMessage;
        this.socketEvents["send-spawn-factions"] = this.handleSpawnFactions;
        this.socketEvents["send-spawn-planets"] = this.handleSpawnPlanets;
        this.socketEvents["send-spawn-locations"] = this.handleSpawnLocations;
    }

    protected handleLogin() {
        this.sendMessage("join-game", {name: this.state.userName});
        this.sendMessage("get-world");
        if (this.state.audioEnabled) {
            this.music.start();
        }
    }
}