import * as particles from "@pixi/particle-emitter";
import PixiGame from "../../pages/PixiGame";
import {DelaunayGraph, VoronoiGraph} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";
import Quaternion from "quaternion";

export class StarFieldQuaternionParticleBehavior implements particles.behaviors.IEmitterBehavior {
    public static type: string = "starFieldQuaternion";
    public static editorConfig?: particles.behaviors.editor.BehaviorEditorConfig | undefined;

    public order = particles.behaviors.BehaviorOrder.Late;
    private game: PixiGame;

    constructor(config: {
        /**
         * The game which holds camera information.
         */
        game: PixiGame;
    }) {
        this.game = config.game;
    }

    private randomPointAroundCamera(shouldRandomize: boolean = false): Quaternion {
        const direction = Quaternion.fromAxisAngle([0, 0, 1], Math.random() * Math.PI * 2).rotateVector([1, 0, 0]);
        const radius = 1 / 8 * (shouldRandomize ? Math.random() : 1);
        return this.game.getCamera().cameraPosition.clone().mul(Quaternion.fromBetweenVectors([0, 0, 1], direction).pow(radius));
    }

    initParticles(first: particles.Particle): void {
        let next = first;

        while (next) {
            next.config.lastFoundPlayerShip = false;
            next.config.foundPlayerShip = false;
            next.config.position = this.randomPointAroundCamera(true);

            next = next.next;
        }
    }

    updateParticle(particle: particles.Particle, deltaSec: number): void {
        particle.config.lastFoundPlayerShip = particle.config.foundPlayerShip;
        particle.config.foundPlayerShip = !!this.game.findPlayerShip();
        const justSpawned = !particle.config.lastFoundPlayerShip && particle.config.foundPlayerShip;
        const justDespawned = particle.config.lastFoundPlayerShip && !particle.config.foundPlayerShip;

        let position = particle.config.position as Quaternion;

        // move star field point
        if (VoronoiGraph.angularDistanceQuaternion(this.game.getCamera().cameraPosition.clone().inverse().mul(position.clone()), 1) > Math.PI / 2 / 7) {
            position = particle.config.position = this.randomPointAroundCamera(justSpawned || justDespawned);
        }

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
