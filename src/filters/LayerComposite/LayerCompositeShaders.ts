export const vertex = `attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;

varying vec2 vTextureCoord;
varying vec2 vMainTextureCoord;

void main(void)
{
    gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    vTextureCoord = vec2(aTextureCoord.x, aTextureCoord.y);
    vMainTextureCoord = vec2(aTextureCoord.x,aTextureCoord.y);
}`;

export const fragment = `precision mediump float;

varying mediump vec2 vTextureCoord;
varying mediump vec2 vMainTextureCoord;

uniform sampler2D uSampler;
uniform sampler2D uDepthSampler;
uniform sampler2D uColorSampler;
uniform vec2 texelSize;
uniform float uThreshold;

void main(void)
{
    vec4 color = texture2D(uColorSampler, vTextureCoord);
    vec4 oldColor = texture2D(uSampler, vMainTextureCoord);

    bool isBackground = color.x == 0.0 && color.y == 0.0 && color.z == 0.0;

    gl_FragColor = isBackground ? oldColor : mix(color, vec4(oldColor.x, oldColor.y, oldColor.z, 1.0), 1.0 - color.w);
}`;