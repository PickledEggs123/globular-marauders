import * as PIXI from "pixi.js";
import {GetHullPoint} from "../helpers/pixiHelpers";
import {getSpecialShipProgram} from "./specialShipProgram";
import * as particles from "@pixi/particle-emitter";
import Quaternion from "quaternion";
import {EResourceType} from "@pickledeggs123/globular-marauders-game/lib/src/Resource";
import PixiGame from "../pages/PixiGame";

export class CrateResources {
    game: PixiGame;
    constructor(game: PixiGame) {
        this.game = game;
    }

    private static getFreshData() {
        // generate crates
        const crateGeometry = new PIXI.Geometry();
        const crateGeometryData: { position: number[], color: number[], index: number[] } = {
            position: [
                ...GetHullPoint([0, 0]),
                ...GetHullPoint([0.1, 0.1]),
                ...GetHullPoint([0, 1]),
                ...GetHullPoint([0.1, 0.9]),
                ...GetHullPoint([1, 0]),
                ...GetHullPoint([0.9, 0.1]),
                ...GetHullPoint([1, 1]),
                ...GetHullPoint([0.9, 0.9]),
                ...GetHullPoint([0.1, 0.8]),
                ...GetHullPoint([0.2, 0.9]),
                ...GetHullPoint([0.8, 0.1]),
                ...GetHullPoint([0.9, 0.2]),

                ...GetHullPoint([0.1, 0.1]),
                ...GetHullPoint([0.1, 0.8]),
                ...GetHullPoint([0.2, 0.9]),
                ...GetHullPoint([0.9, 0.9]),
                ...GetHullPoint([0.8, 0.1]),
                ...GetHullPoint([0.9, 0.2])
            ].map(i => i * 2 - 1),
            color: [
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,
                0.2, 0.2, 0.0,

                0.5, 0.5, 0.3,
                0.5, 0.5, 0.3,
                0.5, 0.5, 0.3,
                0.5, 0.5, 0.3,
                0.5, 0.5, 0.3,
                0.5, 0.5, 0.3,
            ],
            index: [
                0, 1, 2,
                1, 2, 3,
                2, 3, 6,
                3, 6, 7,
                6, 7, 4,
                7, 4, 5,
                4, 5, 0,
                5, 1, 0,

                3, 9, 8,
                9, 11, 8,
                8, 11, 10,
                10, 11, 5,

                12, 13, 16,
                15, 17, 14
            ]
        };
        crateGeometry.addAttribute("aPosition", crateGeometryData.position, 3);
        crateGeometry.addAttribute("aColor", crateGeometryData.color, 3);
        crateGeometry.addIndex(crateGeometryData.index);

        // create crate image geometry
        const crateImageGeometry = new PIXI.Geometry();
        const crateImageGeometryData: { position: number[], uv: number[], index: number[] } = {
            position: [
                ...GetHullPoint([0, 0]),
                ...GetHullPoint([1, 0]),
                ...GetHullPoint([0, 1]),
                ...GetHullPoint([1, 1]),
            ].map(i => i * 2 - 1),
            uv: [
                0, 0,
                1, 0,
                0, 1,
                1, 1,
            ],
            index: [
                0, 1, 2,
                1, 3, 2,
            ]
        };
        crateImageGeometry.addAttribute("aPosition", crateImageGeometryData.position, 3);
        crateImageGeometry.addAttribute("aUv", crateImageGeometryData.uv, 2);
        crateImageGeometry.addIndex(crateImageGeometryData.index);

        // create material
        const crateProgram = getSpecialShipProgram();

        // create material
        const crateImageVertexShader = `
                precision mediump float;
                
                attribute vec3 aPosition;
                attribute vec2 aUv;
                
                uniform mat4 uCameraPosition;
                uniform mat4 uCameraOrientation;
                uniform float uCameraScale;
                uniform mat4 uPosition;
                uniform mat4 uOrientation;
                uniform float uScale;
                uniform float uWorldScale;
                
                varying highp vec2 vUv;
                
                void main() {
                    vUv = aUv;
                    
                    vec4 cameraOrientationPoint = uCameraOrientation * vec4(1.0, 0.0, 0.0, 0.0);
                    float cr = atan(cameraOrientationPoint.y, cameraOrientationPoint.x);
                    mat4 cameraRotation = mat4(
                        cos(cr), -sin(cr), 0.0, 0.0,
                        sin(cr),  cos(cr), 0.0, 0.0,
                        0.0,      0.0,     1.0, 0.0,
                        0.0,      0.0,     0.0, 1.0
                    );
                    
                    vec4 orientationPoint = uOrientation * vec4(1.0, 0.0, 0.0, 0.0);
                    float r = atan(orientationPoint.y, orientationPoint.x);
                    mat4 objectRotation = mat4(
                        cos(r), -sin(r), 0.0, 0.0,
                        sin(r),  cos(r), 0.0, 0.0,
                        0.0,     0.0,    1.0, 0.0,
                        0.0,     0.0,    0.0, 1.0
                    );
                    
                    vec4 translation = cameraRotation * uCameraPosition * uPosition * vec4(0, 0, uCameraScale, 1.0) - vec4(0, 0, uCameraScale, 1.0);
                    mat4 rotation = cameraRotation * objectRotation;
                    
                    vec4 pos = translation + vec4((rotation * vec4(aPosition, 1.0)).xyz * uScale * uCameraScale / uWorldScale, 1.0);
                    gl_Position = pos * vec4(1.0 * uWorldScale, -1.0 * uWorldScale, 0.0625, 1);
                }
            `;
        const crateImageFragmentShader = `
                precision mediump float;
                
                uniform sampler2D uSampler;
                
                varying highp vec2 vUv;
                
                void main() {
                    gl_FragColor = texture2D(uSampler, vUv);
                }
            `;
        const crateImageProgram = new PIXI.Program(crateImageVertexShader, crateImageFragmentShader);

        const crateMeshes: Array<{
            id: string,
            mesh: PIXI.Mesh<PIXI.Shader>,
            image: PIXI.Mesh<PIXI.Shader>,
            trailContainer: PIXI.Container,
            trail: particles.Emitter,
            text: PIXI.Text,
            position: Quaternion,
            orientation: Quaternion,
            rotation: Quaternion,
            resourceType: EResourceType,
            tick: number
        }> = [];

        return {
            crateGeometry,
            crateProgram,
            crateImageGeometry,
            crateImageProgram,
            crateMeshes,
        };
    }

    cachedResources: any;
    public getResources() {
        if (this.cachedResources) {
            return this.cachedResources;
        }

        const {
            crateGeometry,
            crateProgram,
            crateImageGeometry,
            crateImageProgram,
            crateMeshes,
        } = CrateResources.getFreshData();

        const removeExtraRotation = (q: Quaternion): Quaternion => {
            return Quaternion.fromBetweenVectors([0, 0, 1], q.rotateVector([0, 0, 1]));
        };

        const handleSync = (pixiTick: number) => {
            for (const [, crate] of Array.from(this.game.game.crates)) {
                const createMesh = this.cachedResources.crateMeshes.find((c: any) => c.id === crate.id);
                if (createMesh) {
                    createMesh.position = removeExtraRotation(crate.position);
                    createMesh.orientation = crate.orientation;
                    createMesh.tick = pixiTick;
                } else {
                    this.game.addCrate({
                        crate,
                        cameraPosition: this.game.cameraPosition,
                        cameraOrientation: this.game.cameraOrientation,
                        tick: pixiTick
                    });
                }
            }
            for (const item of this.cachedResources.crateMeshes.filter((m: any) => m.tick !== pixiTick || this.game.clearMeshes)) {
                this.game.application.stage.removeChild(item.mesh);
                this.game.application.stage.removeChild(item.trailContainer);
                this.game.application.stage.removeChild(item.image);
                this.game.application.stage.removeChild(item.text);
            }
            this.cachedResources.crateMeshes = this.cachedResources.crateMeshes.filter((m: any) => m.tick === pixiTick && !this.game.clearMeshes);
        };

        const handleRender = () => {
            for (const item of this.cachedResources.crateMeshes) {
                item.orientation = item.orientation.clone().mul(item.rotation.clone());

                const meshShader = item.mesh.shader;
                meshShader.uniforms.uCameraPosition = this.game.cameraPosition.clone().inverse().toMatrix4();
                meshShader.uniforms.uCameraOrientation = this.game.cameraOrientation.clone().inverse().toMatrix4();
                meshShader.uniforms.uCameraScale = this.game.state.zoom;
                meshShader.uniforms.uPosition = removeExtraRotation(item.position).toMatrix4();
                meshShader.uniforms.uOrientation = this.game.convertOrientationToDisplay(item.orientation).toMatrix4();
                this.game.updateMeshIfVisible(item);

                const imageShader = item.image.shader;
                imageShader.uniforms.uCameraPosition = this.game.cameraPosition.clone().inverse().toMatrix4();
                imageShader.uniforms.uCameraOrientation = this.game.cameraOrientation.clone().inverse().toMatrix4();
                imageShader.uniforms.uCameraScale = this.game.state.zoom;
                imageShader.uniforms.uPosition = removeExtraRotation(item.position).toMatrix4();
                imageShader.uniforms.uOrientation = this.game.convertOrientationToDisplay(item.orientation).toMatrix4();
                this.game.updateMeshIfVisible({...item, mesh: item.image});

                this.game.handleDrawingOfText(item.text, item.position);
            }
        };

        this.cachedResources = {
            crateGeometry,
            crateProgram,
            crateImageGeometry,
            crateImageProgram,
            crateMeshes,
            handleSync,
            handleRender,
        };
        return this.cachedResources;
    }
}