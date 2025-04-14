// iframe-globals.d.ts

interface IFrameWindow extends Window {
    setDemo: (demo: boolean) => void;
    clearTerrain: () => void;
    addTerrain: (terrain: string) => void;
    addShip: (ship: string) => void;
    addClientSecret: (secret: string) => void;
}
