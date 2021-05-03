/**
 * The luxuries an island planet can have.
 */
export enum EResourceType {
    // output goods
    COTTON = "COTTON",
    FLAX = "FLAX",
    TOBACCO = "TOBACCO",
    MOLASSES = "MOLASSES",
    RUM = "RUM",
    COFFEE = "COFFEE",
    CACAO = "CACAO",
    RUBBER = "RUBBER",
    FUR = "FUR",
    MAHOGANY = "MAHOGANY",
    // capital goods
    FIREARM = "FIREARM",
    GUNPOWDER = "GUNPOWDER",
    IRON = "IRON",
    RATION = "RATION"
}

/**
 * A list of goods produced by outposts.
 */
export const OUTPOST_GOODS: EResourceType[] = [
    EResourceType.COTTON,
    EResourceType.FLAX,
    EResourceType.TOBACCO,
    EResourceType.MOLASSES,
    EResourceType.RUM,
    EResourceType.COFFEE,
    EResourceType.CACAO,
    EResourceType.RUBBER,
    EResourceType.FUR,
    EResourceType.MAHOGANY,
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

export interface IItemData {
    resourceType: EResourceType;
    basePrice: number;
}

export const ITEM_DATA: IItemData[] = [
    // outpost goods
    {resourceType: EResourceType.COTTON, basePrice: 1},
    {resourceType: EResourceType.FLAX, basePrice: 1},
    {resourceType: EResourceType.TOBACCO, basePrice: 3},
    {resourceType: EResourceType.MOLASSES, basePrice: 1},
    {resourceType: EResourceType.RUM, basePrice: 5},
    {resourceType: EResourceType.COFFEE, basePrice: 2},
    {resourceType: EResourceType.CACAO, basePrice: 2},
    {resourceType: EResourceType.RUBBER, basePrice: 5},
    {resourceType: EResourceType.FUR, basePrice: 5},
    {resourceType: EResourceType.MAHOGANY, basePrice: 5},
    // capital goods
    {resourceType: EResourceType.FIREARM, basePrice: 100},
    {resourceType: EResourceType.GUNPOWDER, basePrice: 100},
    {resourceType: EResourceType.IRON, basePrice: 50},
    {resourceType: EResourceType.RATION, basePrice: 10},
];

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
     * If the cargo was pirated.
     */
    pirated: boolean;
}