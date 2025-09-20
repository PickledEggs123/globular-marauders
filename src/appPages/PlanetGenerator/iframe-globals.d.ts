// iframe-globals.d.ts

interface IFrameWindow extends Window {
    setDemo: (demo: boolean) => void;
    clearTerrain: () => void;
    addTerrain: (terrain: string) => void;
    addShip: (ship: string) => Promise<void>;
    addPirateShipSpawnPoint: (data: string) => void;
    addClientSecret: (secret: string) => void;
}
