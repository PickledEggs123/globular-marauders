import React, {useEffect, useState} from 'react';
import {IGameMesh} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";

export const ShipContext = React.createContext([] as IGameMesh[]);

export const ShipMeshLoader = ({children}: {children: any}) => {
    const [shipMeshes, setShipMeshes] = useState<IGameMesh[]>([]);
    useEffect(() => {
        Promise.all<IGameMesh>([
            fetch("/meshes/ships/cutter.mesh.json").then(r => r.json() as unknown as IGameMesh),
            fetch("/meshes/ships/sloop.mesh.json").then(r => r.json() as unknown as IGameMesh),
            fetch("/meshes/ships/corvette.mesh.json").then(r => r.json() as unknown as IGameMesh),
            fetch("/meshes/ships/brigantine.mesh.json").then(r => r.json() as unknown as IGameMesh),
            fetch("/meshes/ships/brig.mesh.json").then(r => r.json() as unknown as IGameMesh),
            fetch("/meshes/ships/frigate.mesh.json").then(r => r.json() as unknown as IGameMesh),
            fetch("/meshes/ships/galleon.mesh.json").then(r => r.json() as unknown as IGameMesh),
        ]).then(fetchShipMeshes => {
            setShipMeshes(fetchShipMeshes);
        })
    }, []);
    return shipMeshes.length === 0 ? null : <ShipContext.Provider value={shipMeshes}>{children}</ShipContext.Provider>;
};