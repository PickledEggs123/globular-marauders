import * as PIXI from "pixi.js";
import * as particles from "@pixi/particle-emitter";
import Quaternion from "quaternion";
import PixiGame from "../pages/PixiGame";

export class SpellBallResources {
    game: PixiGame;
    constructor(game: PixiGame) {
        this.game = game;
    }

    private getFreshData() {
        // create geometry
        const spellBallGeometry = new PIXI.Geometry();
        spellBallGeometry.addAttribute("aPosition", (new Array(32).fill(0).reduce((acc, v, i) => {
            acc.push(Math.cos(i * Math.PI * 2 / 32), Math.sin(i * Math.PI * 2 / 32), 0);
            return acc;
        }, [0, 0, 0] as number[])), 3);
        spellBallGeometry.addIndex((new Array(33).fill(0).reduce((acc, v, i) => {
            acc.push(0, (i % 32) + 1, ((i + 1) % 32) + 1);
            return acc;
        }, [] as number[])));

        // create material
        const spellBallVertexShader = `
            precision mediump float;
            
            attribute vec3 aPosition;
            
            uniform mat4 uCameraPosition;
            uniform mat4 uCameraOrientation;
            uniform float uCameraScale;
            uniform mat4 uPosition;
            uniform float uScale;
            uniform float uWorldScale;
            
            void main() {
                vec4 cameraOrientationPoint = uCameraOrientation * vec4(1.0, 0.0, 0.0, 0.0);
                float cr = atan(cameraOrientationPoint.y, cameraOrientationPoint.x);
                mat4 cameraRotation = mat4(
                    cos(cr), -sin(cr), 0.0, 0.0,
                    sin(cr),  cos(cr), 0.0, 0.0,
                    0.0,      0.0,     1.0, 0.0,
                    0.0,      0.0,     0.0, 1.0
                );
                
                vec4 pos = cameraRotation * uCameraPosition * uPosition * vec4(aPosition * uScale * uCameraScale / uWorldScale + vec3(0, 0, uCameraScale), 1.0) - vec4(0, 0, uCameraScale, 0);
                gl_Position = pos * vec4(1.0 * uWorldScale, 1.0 * uWorldScale, 0.0625, 1);
            }
        `;
        const spellBallFragmentShader = `
            precision mediump float;
            
            uniform vec4 uColor;
            
            void main() {
                gl_FragColor = uColor;
            }
        `;
        const spellBallProgram = new PIXI.Program(spellBallVertexShader, spellBallFragmentShader);

        const spellBallMeshes: Array<{
            id: string,
            mesh: PIXI.Mesh<PIXI.Shader>,
            trailContainer: PIXI.Container,
            trail: particles.Emitter,
            position: Quaternion,
            positionVelocity: Quaternion,
            tick: number
        }> = [];

        return {
            spellBallGeometry,
            spellBallProgram,
            spellBallMeshes,
        };
    }

    cachedResources: any;
    public getResources() {
        if (this.cachedResources) {
            return this.cachedResources;
        }

        const {
            spellBallGeometry,
            spellBallProgram,
            spellBallMeshes,
        } = this.getFreshData();

        const removeExtraRotation = (q: Quaternion): Quaternion => {
            return Quaternion.fromBetweenVectors([0, 0, 1], q.rotateVector([0, 0, 1]));
        };

        const handleSync = (pixiTick: number) => {
            for (const [, spellBall] of Array.from(this.game.game.spellBalls)) {
                const spellBallMesh = this.cachedResources.spellBallMeshes.find((c: any) => c.id === spellBall.id);
                if (spellBallMesh) {
                    spellBallMesh.position = removeExtraRotation(spellBall.position);
                    spellBallMesh.positionVelocity = removeExtraRotation(spellBall.positionVelocity);
                    spellBallMesh.tick = pixiTick;
                } else {
                    this.game.addSpellBall({
                        spellBall,
                        cameraPosition: this.game.cameraPosition,
                        cameraOrientation: this.game.cameraOrientation,
                        tick: pixiTick
                    });
                }
            }
            for (const item of this.cachedResources.spellBallMeshes.filter((m: any) => m.tick !== pixiTick || this.game.clearMeshes)) {
                this.game.projectileColorLayer.removeChild(item.mesh);
                this.game.projectileColorLayer.removeChild(item.trailContainer);
            }
            this.cachedResources.spellBallMeshes = this.cachedResources.spellBallMeshes.filter((m: any) => m.tick === pixiTick && !this.game.clearMeshes);
        };

        const handleRender = () => {
            for (const item of this.cachedResources.spellBallMeshes) {
                item.position = item.position.clone().mul(item.positionVelocity.clone().pow(1/60));

                const shader = item.mesh.shader;
                shader.uniforms.uCameraPosition = this.game.cameraPosition.clone().inverse().toMatrix4();
                shader.uniforms.uCameraOrientation = this.game.cameraOrientation.clone().inverse().toMatrix4();
                shader.uniforms.uCameraScale = this.game.state.zoom;
                shader.uniforms.uPosition = removeExtraRotation(item.position).toMatrix4();
                this.game.updateMeshIfVisible(item);
            }
        };

        this.cachedResources = {
            spellBallGeometry,
            spellBallProgram,
            spellBallMeshes,
            handleSync,
            handleRender,
        };
        return this.cachedResources;
    }
}