import { vertex, fragment } from './LayerCompositeShaders';
import { Filter } from '@pixi/core';
import {Texture} from "pixi.js";
import {PixiGameBase} from "../../pages/PixiGameBase";
import {Layer} from "@pixi/layers";

/**
 * A special filter to create an outline based off of a depth texture.
 */
export class LayerCompositeFilter extends Filter
{
    /**
     * The game instance with a depth layer.
     */
    public game: PixiGameBase;
    private layerName: string;

    /**
     * @param game The game with the depth layer to render
     * @param {string} layerName The name of the layer to pick
     * @param {number} [width=200] - Width of the object you are transforming
     * @param {number} [height=200] - Height of the object you are transforming
     */
    constructor(game: PixiGameBase, layerName: string, width: number = 200, height: number = 200)
    {
        super(vertex, fragment);
        this.game = game;
        this.uniforms.texelSize = new Float32Array(2);
        this.uniforms.uColorSampler = Texture.WHITE;
        this.width = width;
        this.height = height;
        this.layerName = layerName;
    }

    /**
     * An array of values used for matrix transformation. Specified as a 9 point Array.
     */
    public updateDepth(): void
    {
        this.uniforms.uColorSampler = ((this.game as any)[this.layerName] as Layer).getRenderTexture();
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