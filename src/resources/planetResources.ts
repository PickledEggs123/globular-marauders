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

export const planetResources = () => {
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
                
                uniform mat4 uCameraPosition;
                uniform mat4 uCameraOrientation;
                uniform float uCameraScale;
                uniform mat4 uPosition;
                uniform mat4 uOrientation;
                uniform float uScale;
                uniform float uWorldScale;
                
                varying vec3 vColor;
                
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
                    mat4 rotation = uOrientation;
                    
                    vec4 pos = translation + vec4((rotation * vec4(aPosition, 1.0)).xyz * uScale * uCameraScale / uWorldScale, 1.0);
                    gl_Position = pos * vec4(1.0 * uWorldScale, -1.0 * uWorldScale, 0.0625, 1);
                }
            `;
    const planetFragmentShader = `
                precision mediump float;
                
                varying vec3 vColor;
                
                void main() {
                    gl_FragColor = vec4(vColor, 1.0);
                }
            `;
    const planetProgram = new PIXI.Program(planetVertexShader, planetFragmentShader);

    return {
        getPlanetGeometry,
        planetProgram
    };
};

