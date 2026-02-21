// iframe-globals.d.ts

interface IFrameWindow extends Window {
    clearTerrain: () => void;
    addTerrain: (terrain: string) => void;
    addShip: (ship: string) => Promise<void>;
    addPirateShipSpawnPoint: (data: string) => void;
    addClientSecret: (secret: string) => void;
}
