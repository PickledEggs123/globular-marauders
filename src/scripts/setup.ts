import {
    EMessageType, Game, IAutoPilotMessage,
    IPlayerData
} from "@pickledeggs123/globular-marauders-game/lib/src/Game";
import PixiGame from "../pages/PixiGame";

export interface ISetupScriptContext {
    playerData: IPlayerData;
}

export const setupScript = function (this: PixiGame, serverGame: Game, context: ISetupScriptContext) {
    const {
        playerData,
    } = context;

    return (function*(this: PixiGame) {
        const waitFor = (numTicks: number): IterableIterator<void> => {
            return (function*(this: PixiGame) {
                for (let i = 0; i < numTicks; i++) {
                    yield;
                }
            }).call(this);
        };

        const actions: Array<IterableIterator<void>> = [
            waitFor(10),
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
                    this.game.outgoingMessages.push([playerData.id, message]);
                });
                yield;
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