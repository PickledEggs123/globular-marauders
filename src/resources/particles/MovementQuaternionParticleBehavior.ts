import * as particles from "@pixi/particle-emitter";
import {ICameraState} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import PixiGame from "../../pages/PixiGame";
import {DelaunayGraph} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";
import Quaternion from "quaternion";
import {Game} from "@pickledeggs123/globular-marauders-game/lib/src/Game";

export enum EMovementQuaternionParticleBehaviorType {
    RANDOM = "random",
    FOREWARDS = "forewards",
    BACKWARDS = "backwards",
}

export class MovementQuaternionParticleBehavior implements particles.behaviors.IEmitterBehavior {
    public static type: string = "movementQuaternion";
    public static editorConfig?: particles.behaviors.editor.BehaviorEditorConfig | undefined;

    public order = particles.behaviors.BehaviorOrder.Late;
    private ship: ICameraState;
    private game: PixiGame;
    private movementType: EMovementQuaternionParticleBehaviorType;
    private speed: number;

    constructor(config: {
        /**
         * The item to emit particles from.
         */
        ship: ICameraState;
        /**
         * The game which holds camera information.
         */
        game: PixiGame;
        /**
         * The type of movement
         */
        movementType: string | EMovementQuaternionParticleBehaviorType;
        /**
         * The speed of the particles
         */
        speed?: number;
    }) {
        this.ship = config.ship;
        this.game = config.game;
        switch (config.movementType) {
            case EMovementQuaternionParticleBehaviorType.RANDOM: {
                this.movementType = EMovementQuaternionParticleBehaviorType.RANDOM;
                break;
            }
            case EMovementQuaternionParticleBehaviorType.FOREWARDS: {
                this.movementType = EMovementQuaternionParticleBehaviorType.FOREWARDS;
                break;
            }
            case EMovementQuaternionParticleBehaviorType.BACKWARDS: {
                this.movementType = EMovementQuaternionParticleBehaviorType.BACKWARDS;
                break;
            }
            default: {
                this.movementType = EMovementQuaternionParticleBehaviorType.RANDOM;
                break;
            }
        }
        this.speed = config.speed ?? Game.VELOCITY_STEP;
    }

    initParticles(first: particles.Particle): void {
        let next = first;

        while (next) {
            next.config.position = this.ship.position.clone();

            switch (this.movementType) {
                case EMovementQuaternionParticleBehaviorType.RANDOM: {
                    next.config.positionVelocity = Quaternion.fromBetweenVectors([0, 0, 1], Quaternion.fromAxisAngle([0, 0, 1], Math.random() * Math.PI * 2).rotateVector([1, 0, 0])).pow(this.speed);
                    break;
                }
                case EMovementQuaternionParticleBehaviorType.FOREWARDS: {
                    next.config.positionVelocity = Quaternion.fromBetweenVectors([0, 0, 1], this.ship.orientation.clone().rotateVector([0, 1, 0])).pow(this.speed);
                    break;
                }
                case EMovementQuaternionParticleBehaviorType.BACKWARDS: {
                    next.config.positionVelocity = Quaternion.fromBetweenVectors([0, 0, 1], this.ship.orientation.clone().rotateVector([0, -1, 0])).pow(this.speed);
                    break;
                }
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

        particle.config.position = position.mul(particle.config.positionVelocity);
    }
}
