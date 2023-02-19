/**
 * Which mode the app is in.
 */
import {EResourceType} from "@pickledeggs123/globular-marauders-game/lib/src/Resource";
import {ERaceData} from "@pickledeggs123/globular-marauders-game/lib/src/EFaction";

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
    resourceType: EResourceType.RATION,             // done
    name: "ration",
    url: "images/ration.svg"
}, {
    resourceType: EResourceType.IRON,               // done
    name: "iron",
    url: "images/iron.svg"
}, {
    resourceType: EResourceType.GUNPOWDER,          // done
    name: "gunpowder",
    url: "images/gunpowder.svg"
}, {
    resourceType: EResourceType.FIREARM,            // done
    name: "firearm",
    url: "images/firearm.svg"
}, {
    resourceType: EResourceType.MAHOGANY,           // done
    name: "mahogany",
    url: "images/mahogany.svg"
}, {
    resourceType: EResourceType.FUR,                // done
    name: "fur",
    url: "images/fur.svg"
}, {
    resourceType: EResourceType.RUBBER,             // done
    name: "rubber",
    url: "images/rubber.svg"
}, {
    resourceType: EResourceType.CACAO,              // done
    name: "cacao",
    url: "images/cacao.svg"
}, {
    resourceType: EResourceType.COFFEE,             // done
    name: "coffee",
    url: "images/coffee.svg"
}, {
    resourceType: EResourceType.RUM,                // done
    name: "rum",
    url: "images/rum.svg"
}, {
    resourceType: EResourceType.MOLASSES,           // done
    name: "molasses",
    url: "images/molasses.svg"
}, {
    resourceType: EResourceType.COTTON,             // done
    name: "cotton",
    url: "images/cotton.svg"
}, {
    resourceType: EResourceType.FLAX,               // done
    name: "flax",
    url: "images/flax.svg"
}, {
    resourceType: EResourceType.TOBACCO,            // done
    name: "tobacco",
    url: "images/tobacco.svg"
}, {
    resourceType: EResourceType.SUGAR_CANE,         // done
    name: "sugarcane",
    url: "images/sugarcane.svg"
}, {
    resourceType: EResourceType.CLOTHING,           // done
    name: "clothing",
    url: "images/clothing.svg"
}, {
    resourceType: EResourceType.ROPE,               // done
    name: "rope",
    url: "images/rope.svg"
}, {
    resourceType: EResourceType.CIGAR,              // done
    name: "cigar",
    url: "images/cigar.svg"
}, {
    resourceType: EResourceType.FUR_APPAREL,        // done
    name: "fur_apparel",
    url: "images/fur_apparel.svg"
}, {
    resourceType: EResourceType.FURNITURE,          // done
    name: "furniture",
    url: "images/furniture.svg"
}];

/**
 * An object which contains a texture match for a resource type.
 */
interface ICharacterTypeTexturePair {
    characterRace: ERaceData | null;
    name: string;
    url: string;
}

export const CHARACTER_TYPE_TEXTURE_PAIRS: ICharacterTypeTexturePair[] = [{
    characterRace: ERaceData.DWARF,
    name: "dwarf",
    url: "images/characters/dwarf.svg"
}, {
    characterRace: ERaceData.ELF,
    name: "dwarf",
    url: "images/characters/elf.svg"
}, {
    characterRace: ERaceData.HALF_ELF,
    name: "dwarf",
    url: "images/characters/elf.svg"
}, {
    characterRace: ERaceData.HUMAN,
    name: "dwarf",
    url: "images/characters/human.svg"
}, {
    characterRace: ERaceData.HALFLING,
    name: "dwarf",
    url: "images/characters/halfling.svg"
}, {
    characterRace: ERaceData.GOBLIN,
    name: "dwarf",
    url: "images/characters/goblin.svg"
}, {
    characterRace: ERaceData.HOBGOBLIN,
    name: "dwarf",
    url: "images/characters/hobgoblin.svg"
}, {
    characterRace: ERaceData.BUGBEAR,
    name: "dwarf",
    url: "images/characters/bugbear.svg"
}];

export const DEFAULT_IMAGE: string = "images/no_image.svg";

export const SPACE_BACKGROUND_TEXTURES: string[] = [
    "images/space/AlphaCentauriStar.jpg",
    "images/space/AndromedaGalaxySHO.jpg",
    "images/space/CatsEyeNebulaSHO.jpg",
    "images/space/EtaCarinaSHO.jpg",
    "images/space/GalaxyRGB1.jpg",
    "images/space/GlobularClusterLRGB1.jpg",
    "images/space/GreatBarredSpiralGalaxyLRGB.jpg",
    "images/space/HeartNebulaSHO.jpg",
    "images/space/HelixNebulaSHO.jpg",
    "images/space/LargeMagellanicCloudSHO.jpg",
    "images/space/LeoTripletLGB.jpg",
    "images/space/OrionNebulaSHO.jpg",
    "images/space/OwlNebulaSHO.jpg",
    "images/space/PleiadesRGB.jpg",
    "images/space/RosettaNebulaSHO.jpg",
    "images/space/ThorsHelmetSHO.jpg"
];