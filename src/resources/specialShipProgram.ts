import * as PIXI from "pixi.js";

export const getSpecialShipProgram = () => {
    // create material
    const vertexShader = `
                precision mediump float;
                
                attribute vec3 aPosition;
                attribute vec3 aColor;
                attribute vec3 aNormal;
                
                uniform mat4 uCameraPosition;
                uniform mat4 uCameraOrientation;
                uniform mat4 uCameraPositionInv;
                uniform mat4 uCameraOrientationInv;
                uniform mat4 uRight;
                uniform float uCameraScale;
                uniform mat4 uPosition;
                uniform mat4 uOrientation;
                uniform float uScale;
                uniform float uWorldScale;
                uniform float uCorrectionFactorTheta;
                
                varying vec3 vColor;
                varying vec4 vPosition;
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
                    
                    // the camera orientation, but for only rotation
                    vec4 cameraOrientationWorldPoint = uCameraPositionInv * uCameraOrientationInv * uRight * vec4(0.0, 0.0, 1.0, 0.0);
                    vec4 cameraOrientationLocalPoint = cameraRotation * uCameraPosition * -cameraOrientationWorldPoint;
                    float crw = -atan(cameraOrientationLocalPoint.y, cameraOrientationLocalPoint.x);
                    mat4 cameraRotation2 = mat4(
                        cos(crw), -sin(crw), 0.0, 0.0,
                        sin(crw),  cos(crw), 0.0, 0.0,
                        0.0,      0.0,     1.0, 0.0,
                        0.0,      0.0,     0.0, 1.0
                    );
                    
                    // the object orientation, but only for rotation
                    vec4 orientationWorldPoint = uPosition * uOrientation * uRight * vec4(0.0, 0.0, 1.0, 0.0);
                    vec4 orientationLocalPoint = cameraRotation * uCameraPosition * -orientationWorldPoint;
                    float rw = atan(orientationLocalPoint.y, orientationLocalPoint.x);
                    mat4 objectRotation = mat4(
                        cos(rw), -sin(rw), 0.0, 0.0,
                        sin(rw),  cos(rw), 0.0, 0.0,
                        0.0,     0.0,    1.0, 0.0,
                        0.0,     0.0,    0.0, 1.0
                    );
                    
                    // compute difference of orientation
                    vec4 cameraOrientationPositionPoint = uCameraPositionInv * vec4(0.0, 0.0, 1.0, 0.0);
                    float crp = atan(cameraOrientationPositionPoint.y, cameraOrientationPositionPoint.x);
                    vec4 orientationPositionPoint = uPosition * vec4(0.0, 0.0, 1.0, 0.0);
                    float rp = atan(orientationPositionPoint.y, orientationPositionPoint.x);
                    // difference of orientation between two points on a sphere, especially around the south pole
                    float rpDiff = orientationPositionPoint.z < 0.0 ? 4.0 * (rp - crp) : 0.0;
                    // combined orientation adjustment
                    mat4 orientationDiffRotation = mat4(
                        cos(rpDiff + uCorrectionFactorTheta), -sin(rpDiff + uCorrectionFactorTheta), 0.0, 0.0,
                        sin(rpDiff + uCorrectionFactorTheta),  cos(rpDiff + uCorrectionFactorTheta), 0.0, 0.0,
                        0.0,     0.0,    1.0, 0.0,
                        0.0,     0.0,    0.0, 1.0
                    );
                    
                    vec4 translation = cameraRotation * uCameraPosition * uPosition * vec4(0, 0, uCameraScale, 1.0) - vec4(0, 0, uCameraScale, 1.0);
                    mat4 rotation = cameraRotation2 * objectRotation * orientationDiffRotation;
                    
                    vec4 pos = translation + vec4((rotation * vec4(aPosition, 1.0)).xyz * uScale * uCameraScale / uWorldScale, 1.0);
                    vPosition = pos * vec4(1.0 * uWorldScale, 1.0 * uWorldScale, 0.0625, 1) + vec4(0.0, 0.0, -0.5, 0.0);
                    gl_Position = vPosition;
                    vNormal = (rotation * vec4(aNormal, 1.0)).xyz;
                    vLightPos = normalize(vec4(0.0, 0.0, -0.1, 0.0) - translation * uCameraScale / uWorldScale).xyz;
                }
            `;
    const fragmentColorShader = `
                precision mediump float;
                
                varying vec3 vColor;
                varying vec4 vPosition;
                varying vec3 vNormal;
                varying vec3 vLightPos;
                
                void main() {
                    gl_FragColor = vec4(vColor * (0.3 + 0.7 * max(0.0, pow(dot(vLightPos, vNormal), 1.0))), 1.0);
                }
            `;
    const fragmentDepthShader = `
                precision mediump float;
                
                uniform float uCameraScale;
                
                varying vec3 vColor;
                varying vec4 vPosition;
                varying vec3 vNormal;
                
                void main() {
                    float z = clamp((-vPosition.z - 0.5) * 256.0 / uCameraScale, 0.0, 1.0);
                    gl_FragColor = vec4(z, z, z, 1.0);
                }
            `;


    const color = new PIXI.Program(vertexShader, fragmentColorShader);
    const depth = new PIXI.Program(vertexShader, fragmentDepthShader);

    return {
        color,
        depth,
    };
};