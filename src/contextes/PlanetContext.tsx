import React, {useEffect, useState} from 'react';
import {IGameMesh} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import {Container, LinearProgress} from "@mui/material";

export const PlanetContext = React.createContext([] as IGameMesh[]);

export const PlanetMeshLoader = ({children}: {children: any}) => {
    const [planetMeshes, setPlanetMeshes] = useState<IGameMesh[]>([]);
    const [loadedCount, setLoadedCount] = useState<number>(0);
    useEffect(() => {
        (async () => {
            const fetchPlanetMeshes: IGameMesh[] = [];
            const loaders = [
                () => fetch("/meshes/planets/planet0.mesh.json").then(r => r.json() as unknown as IGameMesh),
                () => fetch("/meshes/planets/planet1.mesh.json").then(r => r.json() as unknown as IGameMesh),
                () => fetch("/meshes/planets/planet2.mesh.json").then(r => r.json() as unknown as IGameMesh),
                () => fetch("/meshes/planets/planet3.mesh.json").then(r => r.json() as unknown as IGameMesh),
                () => fetch("/meshes/planets/planet4.mesh.json").then(r => r.json() as unknown as IGameMesh),
                () => fetch("/meshes/planets/planet5.mesh.json").then(r => r.json() as unknown as IGameMesh),
                () => fetch("/meshes/planets/planet6.mesh.json").then(r => r.json() as unknown as IGameMesh),
                () => fetch("/meshes/planets/planet7.mesh.json").then(r => r.json() as unknown as IGameMesh),
                () => fetch("/meshes/planets/planet8.mesh.json").then(r => r.json() as unknown as IGameMesh),
                () => fetch("/meshes/planets/planet9.mesh.json").then(r => r.json() as unknown as IGameMesh),
            ];
            for (const loader of loaders) {
                fetchPlanetMeshes.push(await loader());
                setLoadedCount(fetchPlanetMeshes.length);
            }
            setPlanetMeshes(fetchPlanetMeshes);
        })();
    }, []);
    return planetMeshes.length === 0 ? (
        <Container>
            <span>Loading Planets ({loadedCount} / 10)...</span>
            <LinearProgress variant="determinate" value={loadedCount / 10 * 100}></LinearProgress>
            <LinearProgress variant="determinate" value={0}></LinearProgress>
        </Container>
    ): <PlanetContext.Provider value={planetMeshes}>{children}</PlanetContext.Provider>;
};