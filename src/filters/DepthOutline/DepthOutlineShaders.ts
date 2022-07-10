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

void main(void)
{
    float c11 = texture2D(uDepthSampler, vTextureCoord - texelSize).x; // top left
    float c12 = texture2D(uDepthSampler, vec2(vTextureCoord.x, vTextureCoord.y - texelSize.y)).x; // top center
    float c13 = texture2D(uDepthSampler, vec2(vTextureCoord.x + texelSize.x, vTextureCoord.y - texelSize.y)).x; // top right

    float c21 = texture2D(uDepthSampler, vec2(vTextureCoord.x - texelSize.x, vTextureCoord.y)).x; // mid left
    float c22 = texture2D(uDepthSampler, vTextureCoord).x; // mid center
    float c23 = texture2D(uDepthSampler, vec2(vTextureCoord.x + texelSize.x, vTextureCoord.y)).x; // mid right

    float c31 = texture2D(uDepthSampler, vec2(vTextureCoord.x - texelSize.x, vTextureCoord.y + texelSize.y)).x; // bottom left
    float c32 = texture2D(uDepthSampler, vec2(vTextureCoord.x, vTextureCoord.y + texelSize.y)).x; // bottom center
    float c33 = texture2D(uDepthSampler, vTextureCoord + texelSize).x; // bottom right

    vec4 depthColor = texture2D(uDepthSampler, vTextureCoord);
    vec4 color = texture2D(uColorSampler, vTextureCoord);
    vec4 oldColor = texture2D(uSampler, vMainTextureCoord);

    float sum = abs(c11 - c22) + abs(c12 - c22) + abs(c13 - c22) +
       abs(c21 - c22) + abs(c23 - c22) +
       abs(c31 - c22) + abs(c32 - c22) + abs(c33 - c22);

    bool isBackground = color.x == 0.0 && color.y == 0.0 && color.z == 0.0;

    gl_FragColor = isBackground ? oldColor : sum > 1.0 / 32.0 ? mix(color, vec4(0.0, 0.0, 0.0, 1.0), 0.5) : color;
}`;