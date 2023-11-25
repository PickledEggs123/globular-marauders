import React, {useEffect, useState} from 'react';
import {IGameMesh} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";

export const PlanetContext = React.createContext([] as IGameMesh[]);

export const PlanetMeshLoader = ({children}: {children: any}) => {
    const [planetMeshes, setPlanetMeshes] = useState<IGameMesh[]>([]);
    useEffect(() => {
        Promise.all<IGameMesh>([
            fetch("/meshes/planets/planet0.mesh.json").then(r => r.json() as unknown as IGameMesh),
            fetch("/meshes/planets/planet1.mesh.json").then(r => r.json() as unknown as IGameMesh),
            fetch("/meshes/planets/planet2.mesh.json").then(r => r.json() as unknown as IGameMesh),
            fetch("/meshes/planets/planet3.mesh.json").then(r => r.json() as unknown as IGameMesh),
            fetch("/meshes/planets/planet4.mesh.json").then(r => r.json() as unknown as IGameMesh),
            fetch("/meshes/planets/planet5.mesh.json").then(r => r.json() as unknown as IGameMesh),
            fetch("/meshes/planets/planet6.mesh.json").then(r => r.json() as unknown as IGameMesh),
            fetch("/meshes/planets/planet7.mesh.json").then(r => r.json() as unknown as IGameMesh),
            fetch("/meshes/planets/planet8.mesh.json").then(r => r.json() as unknown as IGameMesh),
            fetch("/meshes/planets/planet9.mesh.json").then(r => r.json() as unknown as IGameMesh),
        ]).then(fetchPlanetMeshes => {
            setPlanetMeshes(fetchPlanetMeshes);
        })
    }, []);
    return planetMeshes.length === 0 ? null : <PlanetContext.Provider value={planetMeshes}>{children}</PlanetContext.Provider>;
};