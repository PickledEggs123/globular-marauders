import React, {useEffect, useState} from 'react';
import {IGameMesh} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import {Container, LinearProgress} from "@mui/material";

export const ShipContext = React.createContext([] as IGameMesh[]);

export const ShipMeshLoader = ({children}: {children: any}) => {
    const [shipMeshes, setShipMeshes] = useState<IGameMesh[]>([]);
    const [loadedCount, setLoadedCount] = useState<number>(0);
    useEffect(() => {
        (async () => {
            const fetchShipMeshes: IGameMesh[] = [];
            const loaders = [
                () => fetch("/meshes/ships/cutter.mesh.json").then(r => r.json() as unknown as IGameMesh),
                () => fetch("/meshes/ships/sloop.mesh.json").then(r => r.json() as unknown as IGameMesh),
                () => fetch("/meshes/ships/corvette.mesh.json").then(r => r.json() as unknown as IGameMesh),
                () => fetch("/meshes/ships/brigantine.mesh.json").then(r => r.json() as unknown as IGameMesh),
                () => fetch("/meshes/ships/brig.mesh.json").then(r => r.json() as unknown as IGameMesh),
                () => fetch("/meshes/ships/frigate.mesh.json").then(r => r.json() as unknown as IGameMesh),
                () => fetch("/meshes/ships/galleon.mesh.json").then(r => r.json() as unknown as IGameMesh),
            ];
            for (const loader of loaders) {
                fetchShipMeshes.push(await loader());
                setLoadedCount(fetchShipMeshes.length);
            }
            setShipMeshes(fetchShipMeshes);
        })();
    }, []);
    return shipMeshes.length === 0 ? (
        <Container>
            <span>Loading Ships ({loadedCount} / 7)...</span>
            <LinearProgress variant="determinate" value={100}></LinearProgress>
            <LinearProgress variant="determinate" value={loadedCount / 7 * 100}></LinearProgress>
        </Container>
    ) : <ShipContext.Provider value={shipMeshes}>{children}</ShipContext.Provider>;
};