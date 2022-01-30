/**
 * Which mode the app is in.
 */
import {EResourceType} from "@pickledeggs123/globular-marauders-game/lib/src/Resource";

export enum EVoronoiMode {
    KINGDOM = "KINGDOM",
    DUCHY = "DUCHY",
    COUNTY = "COUNTY"
}

/**
 * An object which contains a texture match for a resource type.
 */
interface IResourceTypeTexturePair {
    resourceType: EResourceType | null;
    name: string;
    url: string;
}

export const RESOURCE_TYPE_TEXTURE_PAIRS: IResourceTypeTexturePair[] = [{
    resourceType: EResourceType.RUM,
    name: "rum",
    url: "images/rum.svg"
}, {
    resourceType: EResourceType.RATION,
    name: "ration",
    url: "images/ration.svg"
}, {
    resourceType: EResourceType.IRON,
    name: "iron",
    url: "images/iron.svg"
}, {
    resourceType: EResourceType.GUNPOWDER,
    name: "gunpowder",
    url: "images/gunpowder.svg"
}, {
    resourceType: EResourceType.FIREARM,
    name: "firearm",
    url: "images/firearm.svg"
}, {
    resourceType: EResourceType.MAHOGANY,
    name: "mahogany",
    url: "images/mahogany.svg"
}, {
    resourceType: EResourceType.FUR,
    name: "fur",
    url: "images/fur.svg"
}, {
    resourceType: EResourceType.RUBBER,
    name: "rubber",
    url: "images/rubber.svg"
}, {
    resourceType: EResourceType.CACAO,
    name: "cacao",
    url: "images/cacao.svg"
}, {
    resourceType: EResourceType.COFFEE,
    name: "coffee",
    url: "images/coffee.svg"
}, {
    resourceType: EResourceType.RUM,
    name: "rum",
    url: "images/rum.svg"
}, {
    resourceType: EResourceType.MOLASSES,
    name: "molasses",
    url: "images/molasses.svg"
}, {
    resourceType: EResourceType.COTTON,
    name: "cotton",
    url: "images/cotton.svg"
}, {
    resourceType: EResourceType.FLAX,
    name: "flax",
    url: "images/flax.svg"
}, {
    resourceType: EResourceType.TOBACCO,
    name: "tobacco",
    url: "images/tobacco.svg"
}];
export const DEFAULT_IMAGE: string = "images/no_image.svg";