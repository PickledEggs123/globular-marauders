import {ICameraState, ICollidable, IExpirable, IExpirableTicks} from "./Interface";
import Quaternion from "quaternion";
import {EFaction} from "./Ship";
import {EResourceType, ICargoItem} from "./Resource";
import App from "./App";

export class Crate implements ICameraState, ICargoItem, IExpirableTicks, ICollidable {
    public id: string = "";
    public color: string = "brown";
    public size: number = 100;
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public resourceType: EResourceType;
    public sourcePlanetId: string;
    public amount: number;
    public pirated: boolean = false;
    public maxLife: number = 10 * 60;
    public life: number = 0;
    public factionId: EFaction | null = null;

    constructor(resourceType: EResourceType, sourcePlanetId: string, amount: number) {
        this.resourceType = resourceType;
        this.sourcePlanetId = sourcePlanetId;
        this.amount = amount;
    }
}

export class SmokeCloud implements ICameraState, IExpirable {
    public id: string = "";
    public color: string = "grey";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public size: number = 1;
    public created: Date = new Date(Date.now());
    public expires: Date = new Date(Date.now() + 10000);
}

export class CannonBall implements ICameraState, IExpirableTicks, ICollidable {
    public id: string = "";
    public color: string = "grey";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public size: number = 1;
    public damage: number = 10;
    public maxLife: number = App.PROJECTILE_LIFE;
    public life: number = 0;
    /**
     * Cannon balls have a faction, to avoid team killing teammates.
     */
    public factionId: EFaction | null;

    constructor(faction: EFaction) {
        this.factionId = faction;
    }
}