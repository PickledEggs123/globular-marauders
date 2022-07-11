import { vertex, fragment } from './DepthOutlineShaders';
import { Filter } from '@pixi/core';
import {Texture} from "pixi.js";
import {PixiGameBase} from "../../pages/PixiGameBase";

/**
 * A special filter to create an outline based off of a depth texture.
 */
export class DepthOutlineFilter extends Filter
{
    /**
     * The game instance with a depth layer.
     */
    public game: PixiGameBase;

    /**
     * @param game The game with the depth layer to render
     * @param {number} [width=200] - Width of the object you are transforming
     * @param {number} [height=200] - Height of the object you are transforming
     */
    constructor(game: PixiGameBase, width: number = 200, height: number = 200)
    {
        super(vertex, fragment);
        this.game = game;
        this.uniforms.texelSize = new Float32Array(2);
        this.uniforms.uThreshold = this.game.depthOutlineThreshold ?? 1;
        this.uniforms.uColorSampler = Texture.WHITE;
        this.uniforms.uDepthSampler = Texture.WHITE;
        this.width = width;
        this.height = height;
    }

    /**
     * An array of values used for matrix transformation. Specified as a 9 point Array.
     */
    public updateDepth(): void
    {
        this.uniforms.uThreshold = this.game.depthOutlineThreshold ?? 1;
        this.uniforms.uColorSampler = this.game.colorLayer.getRenderTexture();
        this.uniforms.uDepthSampler = this.game.depthLayer.getRenderTexture();
    }

    /**
     * Width of the object you are transforming
     */
    get width(): number
    {
        return 1 / this.uniforms.texelSize[0];
    }
    set width(value: number)
    {
        this.uniforms.texelSize[0] = 1 / value;
    }

    /**
     * Height of the object you are transforming
     */
    get height(): number
    {
        return 1 / this.uniforms.texelSize[1];
    }
    set height(value: number)
    {
        this.uniforms.texelSize[1] = 1 / value;
    }
}