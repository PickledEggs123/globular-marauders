import {v4} from "uuid";

declare global {
    let ServerIdSingleton: ServerId | undefined;
}

/**
 * Singleton class for server id in UUIDv4 format
 */
class ServerId {

    /**
     * Assign UUIDv4 and create singleton.
     */
    public constructor() {
        this.v4 = v4();
    }

    /**
     * Server Id string
     */
    public v4: string;
}

const getServerIdSingleton = (): ServerId => {
    // @ts-ignore
    if (!globalThis.ServerIdSingleton) {
        // @ts-ignore
        globalThis.ServerIdSingleton = new ServerId();
    }
    // @ts-ignore
    return globalThis.ServerIdSingleton;
}

export const ServerIdSingleton: ServerId = getServerIdSingleton();
