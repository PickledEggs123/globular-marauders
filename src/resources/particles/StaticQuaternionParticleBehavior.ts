import * as particles from "@pixi/particle-emitter";
import {ICameraState} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import PixiGame from "../../pages/PixiGame";
import {DelaunayGraph} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";
import Quaternion from "quaternion";
import {PHYSICS_SCALE} from "@pickledeggs123/globular-marauders-game/lib/src/ShipType";

export class StaticQuaternionParticleBehavior implements particles.behaviors.IEmitterBehavior {
    public static type: string = "staticQuaternion";
    public static editorConfig?: particles.behaviors.editor.BehaviorEditorConfig | undefined;

    public order = particles.behaviors.BehaviorOrder.Late;
    private ship: ICameraState;
    private game: PixiGame;

    constructor(config: {
        /**
         * The item to emit particles from.
         */
        ship: ICameraState;
        /**
         * The game which holds camera information.
         */
        game: PixiGame;
    }) {
        this.ship = config.ship;
        this.game = config.game;
    }

    initParticles(first: particles.Particle): void {
        let next = first;

        while (next) {
            if (!next.config.position) {
                next.config.position = this.ship.position.clone();
            } else {
                next.config.position = this.ship.position.clone();
            }

            next = next.next;
        }
    }

    updateParticle(particle: particles.Particle, deltaSec: number): void {
        const position = particle.config.position as Quaternion;

        const textPosition = DelaunayGraph.distanceFormula(
            this.game.getCamera().cameraPosition.rotateVector([0, 0, 1]),
            position.rotateVector([0, 0, 1])
        ) < 0.001 ? [0, 0, 1] as [number, number, number] : this.game.getCamera().cameraOrientation.clone().inverse()
            .mul(this.game.getCamera().cameraPosition.clone().inverse())
            .mul(position.clone())
            .rotateVector([0, 0, 1]);
        textPosition[0] = ((-textPosition[0] * this.game.state.zoom * this.game.game.worldScale) + 1) / 2;
        textPosition[1] = ((-textPosition[1] * this.game.state.zoom * this.game.game.worldScale) + 1) / 2;
        particle.position.set(textPosition[0] * this.game.application.renderer.width, textPosition[1] * this.game.application.renderer.height);
        const initialScale = particle.scale.x;
        particle.scale.set(this.game.state.zoom * this.game.game.worldScale * 0.05 * initialScale);
        particle.visible = textPosition[2] > 0;
    }
}
