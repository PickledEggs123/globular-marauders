/**
 * The luxuries an island planet can have.
 */
export enum EResourceType {
    // output goods
    COTTON = "COTTON",
    FLAX = "FLAX",
    TOBACCO = "TOBACCO",
    SUGAR_CANE = "SUGAR_CANE",
    COFFEE = "COFFEE",
    CACAO = "CACAO",
    RUBBER = "RUBBER",
    FUR = "FUR",
    MAHOGANY = "MAHOGANY",
    // manufactory goods
    CLOTHING = "CLOTHING",
    ROPE = "ROPE",
    CIGAR = "CIGAR",
    MOLASSES = "MOLASSES",
    RUM = "RUM",
    FUR_APPAREL = "FUR_APPAREL",
    FURNITURE = "FURNITURE",
    // capital goods
    FIREARM = "FIREARM",
    GUNPOWDER = "GUNPOWDER",
    IRON = "IRON",
    RATION = "RATION"
}

export interface IItemRecipeItem {
    resourceType: EResourceType;
    amount: number;
}
export interface IItemRecipe {
    id: string;
    ingredients: IItemRecipeItem[];
    products: IItemRecipeItem[];
}
export interface IItemData {
    resourceType: EResourceType;
    basePrice: number;
    makes?: EResourceType;
    natural: boolean;
    consumable: boolean;
}

export const ITEM_DATA: IItemData[] = [
    // outpost goods
    {resourceType: EResourceType.COTTON, basePrice: 1, natural: true, consumable: false, makes: EResourceType.CLOTHING},
    {resourceType: EResourceType.CLOTHING, basePrice: 3, natural: false, consumable: true},
    {resourceType: EResourceType.FLAX, basePrice: 1, natural: true, consumable: false, makes: EResourceType.ROPE},
    {resourceType: EResourceType.ROPE, basePrice: 3, natural: false, consumable: true},
    {resourceType: EResourceType.TOBACCO, basePrice: 1, natural: true, consumable: false, makes: EResourceType.CIGAR},
    {resourceType: EResourceType.CIGAR, basePrice: 3, natural: false, consumable: true},
    {resourceType: EResourceType.SUGAR_CANE, basePrice: 1, natural: true, consumable: false, makes: EResourceType.MOLASSES},
    {resourceType: EResourceType.MOLASSES, basePrice: 3, natural: false, consumable: true, makes: EResourceType.RUM},
    {resourceType: EResourceType.RUM, basePrice: 5, natural: false, consumable: true},
    {resourceType: EResourceType.COFFEE, basePrice: 2, natural: true, consumable: true},
    {resourceType: EResourceType.CACAO, basePrice: 2, natural: true, consumable: false},
    {resourceType: EResourceType.RUBBER, basePrice: 2, natural: true, consumable: false},
    {resourceType: EResourceType.FUR, basePrice: 3, natural: true, consumable: false, makes: EResourceType.FUR_APPAREL},
    {resourceType: EResourceType.FUR_APPAREL, basePrice: 5, natural: false, consumable: true},
    {resourceType: EResourceType.MAHOGANY, basePrice: 3, natural: true, consumable: false, makes: EResourceType.FURNITURE},
    {resourceType: EResourceType.FURNITURE, basePrice: 5, natural: false, consumable: true},
    // capital goods
    {resourceType: EResourceType.FIREARM, basePrice: 100, natural: false, consumable: false},
    {resourceType: EResourceType.GUNPOWDER, basePrice: 100, natural: false, consumable: false},
    {resourceType: EResourceType.IRON, basePrice: 50, natural: false, consumable: false},
    {resourceType: EResourceType.RATION, basePrice: 10, natural: false, consumable: false},
];

/**
 * A list of naturally occurring resources for plantations.
 */
export const NATURAL_RESOURCES: EResourceType[] = ITEM_DATA.reduce((resourceTypes, i) => {
    if (i.natural) {
        resourceTypes.push(i.resourceType);
    }
    return resourceTypes;
}, [] as EResourceType[]);

/**
 * List of products which can be consumed by citizens.
 */
export const CONSUMABLE_RESOURCES: EResourceType[] = ITEM_DATA.reduce((resourceTypes, i) => {
    if (i.consumable) {
        resourceTypes.push(i.resourceType);
    }
    return resourceTypes;
}, [] as EResourceType[]);

/**
 * A list of goods produced by outposts.
 */
export const OUTPOST_GOODS: EResourceType[] = [
    EResourceType.COTTON,
    EResourceType.CLOTHING,
    EResourceType.FLAX,
    EResourceType.ROPE,
    EResourceType.TOBACCO,
    EResourceType.CIGAR,
    EResourceType.SUGAR_CANE,
    EResourceType.MOLASSES,
    EResourceType.RUM,
    EResourceType.COFFEE,
    EResourceType.CACAO,
    EResourceType.RUBBER,
    EResourceType.FUR,
    EResourceType.FUR_APPAREL,
    EResourceType.MAHOGANY,
    EResourceType.FURNITURE,
];
/**
 * A list of goods produced by capitals.
 */
export const CAPITAL_GOODS: EResourceType[] = [
    EResourceType.FIREARM,
    EResourceType.GUNPOWDER,
    EResourceType.IRON,
    EResourceType.RATION,
];

export const ITEM_RECIPES: IItemRecipe[] = ITEM_DATA.reduce((recipes, i) => {
    if (i.makes) {
        recipes.push({
            id: `Produce${i.makes}From${i.resourceType}`,
            ingredients: [{
                resourceType: i.resourceType,
                amount: 1
            }],
            products: [{
                resourceType: i.makes,
                amount: 1
            }]
        });
    }
    return recipes;
}, [] as IItemRecipe[]);

/**
 * An object which represents cargo.
 */
export interface ICargoItem {
    /**
     * The source of the cargo. Delivering cargo will apply a cargo buff to the faction, giving the faction more gold
     * for 10 minutes. Delivering cargo from the same planet will not stack the buff.
     */
    sourcePlanetId: string;
    /**
     * The type of resource. Each resource will be used to compute buffs separately. One faction can specialize in tea
     * while another can specialize in coffee. A faction which has large amounts of a single resource will force
     * other factions to pay it gold to access the luxury. Factions will be forced to tariff, embargo or declare war
     * to resolve the trade deficit.
     */
    resourceType: EResourceType;
    /**
     * The amount or multiplier of a resource.
     */
    amount: number;
    /**
     * If the cargo was pirated.
     */
    pirated: boolean;
}