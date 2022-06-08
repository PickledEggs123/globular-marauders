import * as PIXI from "pixi.js";

export const starResources = () => {
    // create geometry
    const starGeometry = new PIXI.Geometry();
    starGeometry.addAttribute("aPosition", (new Array(32).fill(0).reduce((acc, v, i) => {
        acc.push(Math.cos(i * Math.PI * 2 / 32), Math.sin(i * Math.PI * 2 / 32), 0);
        return acc;
    }, [0, 0, 0] as number[])), 3);
    starGeometry.addIndex((new Array(33).fill(0).reduce((acc, v, i) => {
        acc.push(0, (i % 32) + 1, ((i + 1) % 32) + 1);
        return acc;
    }, [] as number[])));

    // create material
    const starVertexShader = `
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
                gl_Position = pos * vec4(1.0 * uWorldScale, -1.0 * uWorldScale, 0.0625, 1);
            }
        `;
    const starFragmentShader = `
            precision mediump float;
            
            uniform vec4 uColor;
            
            void main() {
                gl_FragColor = uColor;
            }
        `;
    const starProgram = new PIXI.Program(starVertexShader, starFragmentShader);

    return {
        starGeometry,
        starProgram
    };
};