import * as PIXI from "pixi.js";
import {IGameMesh} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import planetMesh0 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet0.mesh.json";
import planetMesh1 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet1.mesh.json";
import planetMesh2 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet2.mesh.json";
import planetMesh3 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet3.mesh.json";
import planetMesh4 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet4.mesh.json";
import planetMesh5 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet5.mesh.json";
import planetMesh6 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet6.mesh.json";
import planetMesh7 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet7.mesh.json";
import planetMesh8 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet8.mesh.json";
import planetMesh9 from "@pickledeggs123/globular-marauders-generator/meshes/planets/planet9.mesh.json";
import Quaternion from "quaternion";
import PixiGame from "../pages/PixiGame";
import {DelaunayGraph} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";
import {PHYSICS_SCALE} from "@pickledeggs123/globular-marauders-game/lib/src/ShipType";

export class PlanetResources {
    game: PixiGame;
    constructor(game: PixiGame) {
        this.game = game;
    }

    private getFreshData() {
        // generate planets
        const planetGeometries: PIXI.Geometry[] = [];
        const jsonFiles: IGameMesh[] = [
            planetMesh0,
            planetMesh1,
            planetMesh2,
            planetMesh3,
            planetMesh4,
            planetMesh5,
            planetMesh6,
            planetMesh7,
            planetMesh8,
            planetMesh9,
        ];
        for (const gameMesh of jsonFiles) {
            const planetGeometry = new PIXI.Geometry();
            for (const attribute of gameMesh.attributes) {
                planetGeometry.addAttribute(attribute.id, attribute.buffer, attribute.size);
            }
            planetGeometry.addIndex(gameMesh.index);
            planetGeometries.push(planetGeometry);
        }
        const getPlanetGeometry = (): [PIXI.Geometry, number] => {
            const index = Math.floor(Math.random() * planetGeometries.length);
            return [planetGeometries[index], index];
        };

        // create material
        const planetVertexShader = `
                precision mediump float;
                
                attribute vec3 aPosition;
                attribute vec3 aColor;
                attribute vec3 aNormal;
                
                uniform mat4 uCameraPosition;
                uniform mat4 uCameraOrientation;
                uniform float uCameraScale;
                uniform mat4 uPosition;
                uniform mat4 uOrientation;
                uniform float uScale;
                uniform float uWorldScale;
                
                varying vec3 vColor;
                varying vec3 vNormal;
                varying vec3 vLightPos;
                
                void main() {
                    vColor = aColor;
                    
                    // the camera orientation
                    vec4 cameraOrientationPoint = uCameraOrientation * vec4(1.0, 0.0, 0.0, 0.0);
                    float cr = atan(cameraOrientationPoint.y, cameraOrientationPoint.x);
                    mat4 cameraRotation = mat4(
                        cos(cr), -sin(cr), 0.0, 0.0,
                        sin(cr),  cos(cr), 0.0, 0.0,
                        0.0,      0.0,     1.0, 0.0,
                        0.0,      0.0,     0.0, 1.0
                    );
                    
                    vec4 translation = cameraRotation * uCameraPosition * uPosition * vec4(0, 0, uCameraScale, 1.0) - vec4(0, 0, uCameraScale, 1.0);
                    mat4 rotation = cameraRotation * uOrientation;
                    
                    vec4 pos = translation + vec4((rotation * vec4(aPosition, 1.0)).xyz * uScale * uCameraScale / uWorldScale, 1.0);
                    gl_Position = pos * vec4(1.0 * uWorldScale, 1.0 * uWorldScale, 0.0625, 1);
                    vNormal = (rotation * vec4(aNormal, 1.0)).xyz;
                    vLightPos = normalize(vec4(0.0, 0.0, -0.25, 0.0) - translation * uCameraScale / uWorldScale).xyz;
                }
            `;
        const planetFragmentShader = `
                precision mediump float;
                
                varying vec3 vColor;
                varying vec3 vNormal;
                varying vec3 vLightPos;
                
                void main() {
                    gl_FragColor = vec4(vColor * (0.3 + 0.7 * max(0.0, pow(dot(vLightPos, vNormal), 3.0))), 1.0);
                }
            `;
        const planetProgram = new PIXI.Program(planetVertexShader, planetFragmentShader);

        const planetMeshes: Array<{
            id: string,
            mesh: PIXI.Mesh<PIXI.Shader>,
            faction: PIXI.Graphics,
            factionRadius: number,
            factionColor: number | null,
            settlementLevel: number,
            settlementProgress: number,
            textName: PIXI.Text,
            textTitle: PIXI.Text,
            textResource1: PIXI.Text,
            textResource2: PIXI.Text,
            textResource3: PIXI.Text,
            position: Quaternion,
            orientation: Quaternion,
            rotation: Quaternion,
            tick: number
        }> = [];

        return {
            getPlanetGeometry,
            planetProgram,
            planetMeshes,
        };
    }

    cachedResources: any;
    public getResources() {
        if (this.cachedResources) {
            return this.cachedResources;
        }

        const {
            getPlanetGeometry,
            planetProgram,
            planetMeshes,
        } = this.getFreshData();

        const handleSync = (pixiTick: number) => {
            for (const planet of Array.from(this.game.game.voronoiTerrain.getPlanets(this.game.cameraPosition.rotateVector([0, 0, 1])))) {
                const planetMesh = this.cachedResources.planetMeshes.find((p: any) => p.id === planet.id);
                if (planetMesh) {
                    planetMesh.orientation = planetMesh.rotation.clone().mul(planetMesh.orientation.clone());
                    const ownerFaction = Array.from(this.game.game.factions.values()).find(faction => faction.planetIds.includes(planet.id));
                    planetMesh.factionColor = this.game.getFactionColor(ownerFaction);
                    planetMesh.settlementLevel = planet.settlementLevel;
                    planetMesh.settlementProgress = planet.settlementProgress;
                    planetMesh.tick = pixiTick;
                } else {
                    this.game.addPlanet({
                        planet,
                        cameraPosition: this.game.cameraPosition,
                        cameraOrientation: this.game.cameraOrientation,
                        tick: pixiTick
                    });
                }
            }
            for (const item of this.cachedResources.planetMeshes.filter((m: any) => m.tick !== pixiTick || this.game.clearMeshes)) {
                this.game.colorLayer.removeChild(item.mesh);
                this.game.application.stage.removeChild(item.faction);
                this.game.textColorLayer.removeChild(item.textName);
                this.game.textColorLayer.removeChild(item.textTitle);
                this.game.textColorLayer.removeChild(item.textResource1);
                this.game.textColorLayer.removeChild(item.textResource2);
                this.game.textColorLayer.removeChild(item.textResource3);
            }
            this.cachedResources.planetMeshes = this.cachedResources.planetMeshes.filter((m: any) => m.tick === pixiTick && !this.game.clearMeshes);
        };

        const handleRender = () => {
            for (const item of this.cachedResources.planetMeshes) {
                item.orientation = item.orientation.clone().mul(item.rotation.clone());

                const shader = item.mesh.shader;
                shader.uniforms.uCameraPosition = this.game.cameraPosition.clone().inverse().toMatrix4();
                shader.uniforms.uCameraOrientation = this.game.cameraOrientation.clone().inverse().toMatrix4();
                shader.uniforms.uCameraScale = this.game.state.zoom;
                shader.uniforms.uOrientation = item.orientation.toMatrix4();
                this.game.updateMeshIfVisible(item);

                if (item.factionColor) {
                    const startPoint = DelaunayGraph.distanceFormula(
                        this.game.cameraPosition.rotateVector([0, 0, 1]),
                        item.position.rotateVector([0, 0, 1])
                    ) < 0.0001 ? [0, 0, 1] : this.game.cameraOrientation.clone().inverse()
                        .mul(this.game.cameraPosition.clone().inverse())
                        .mul(item.position.clone())
                        .rotateVector([0, 0, 1]);
                    const centerX = ((-startPoint[0] * this.game.state.zoom * this.game.game.worldScale) + 1) / 2 * this.game.application.renderer.width;
                    const centerY = ((-startPoint[1] * this.game.state.zoom * this.game.game.worldScale) + 1) / 2 * this.game.application.renderer.height;
                    const settlementProgressSlice = Math.max(0, Math.min(item.settlementProgress, 1)) * Math.PI * 2;
                    const settlementProgressSlice2 = Math.max(0, Math.min(item.settlementProgress - 1, 1) / 4) * Math.PI * 2;
                    const radius = item.factionRadius * this.game.state.zoom * this.game.game.worldScale * this.game.application.renderer.width;
                    const radius2 = (item.factionRadius + 3 * PHYSICS_SCALE) * this.game.state.zoom * this.game.game.worldScale * this.game.application.renderer.width;

                    // inner circle
                    item.faction.clear();
                    item.faction.position.set(centerX, centerY);
                    item.faction.beginFill(item.factionColor);
                    item.faction.moveTo(0, 0);
                    item.faction.lineTo(radius, 0);
                    item.faction.arc(0, 0, radius, 0, settlementProgressSlice);
                    item.faction.lineTo(0, 0);
                    item.faction.endFill();

                    // outer circle
                    item.faction.beginFill(item.factionColor);
                    item.faction.moveTo(0, 0);
                    item.faction.lineTo(radius2, 0);
                    item.faction.arc(0, 0, radius2, 0, settlementProgressSlice2);
                    item.faction.lineTo(0, 0);
                    item.faction.endFill();

                    item.faction.visible = startPoint[2] > 0 &&
                        centerX >= 0 &&
                        centerX <= this.game.application.renderer.width &&
                        centerY >= 0 &&
                        centerY <= this.game.application.renderer.height;
                } else {
                    item.faction.visible = false;
                }

                this.game.handleDrawingOfText(item.textName, item.position, {x: 0, y: item.factionRadius / PHYSICS_SCALE * 2 + 40 - 160});
                this.game.handleDrawingOfText(item.textTitle, item.position, {x: 0, y: item.factionRadius / PHYSICS_SCALE * 2 + 60 - 160});
                this.game.handleDrawingOfText(item.textResource1, item.position, {x: 0, y: item.factionRadius / PHYSICS_SCALE * 2 + 80 - 160});
                this.game.handleDrawingOfText(item.textResource2, item.position, {x: 0, y: item.factionRadius / PHYSICS_SCALE * 2 + 100 - 160});
                this.game.handleDrawingOfText(item.textResource3, item.position, {x: 0, y: item.factionRadius / PHYSICS_SCALE * 2 + 120 - 160});
            }
        };

        this.cachedResources = {
            getPlanetGeometry,
            planetProgram,
            planetMeshes,
            handleSync,
            handleRender
        };
        return this.cachedResources;
    }
}