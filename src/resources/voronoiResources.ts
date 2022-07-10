import {ITessellatedTriangle} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";
import * as PIXI from "pixi.js";

export const voronoiResources = () => {
    // create geometry
    const getVoronoiGeometry = (tile: ITessellatedTriangle): PIXI.Geometry => {
        const voronoiGeometry = new PIXI.Geometry();
        voronoiGeometry.addAttribute("aPosition", (tile.vertices.reduce((acc, v) => {
            acc.push(...v.rotateVector([0, 0, 1]));
            return acc;
        }, [] as number[])), 3);
        const indices: number[] = [];
        for (let i = 0; i < tile.vertices.length - 2; i++) {
            indices.push(0, i + 1, i + 2);
        }
        voronoiGeometry.addIndex(indices);
        return voronoiGeometry;
    };

    // create material
    const voronoiVertexShader = `
            precision mediump float;
            
            attribute vec3 aPosition;
            
            uniform mat4 uCameraPosition;
            uniform mat4 uCameraOrientation;
            uniform float uCameraScale;
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
                vec4 pos = cameraRotation * uCameraPosition * vec4(-aPosition * uCameraScale, 1.0);
                gl_Position = pos * vec4(1.0 * uWorldScale, 1.0 * uWorldScale, 0.0625, 1);
            }
        `;
    const voronoiFragmentShader = `
            precision mediump float;
            
            uniform vec4 uColor;
            
            void main() {
                gl_FragColor = uColor;
            }
        `;
    const voronoiProgram = new PIXI.Program(voronoiVertexShader, voronoiFragmentShader);

    return {
        getVoronoiGeometry,
        voronoiProgram
    };
};
