import React from "react";
import {Route, Routes} from "react-router-dom";
import {GameModel} from "./pages/GameModel";
import {PlanetGenerator} from "./pages/PlanetGenerator";
import {About} from "./pages/About";
import {ShipWiki} from "./pages/ShipWiki";
import {CharacterWiki} from "./pages/CharacterWiki";
import {ShipMeshLoader} from "./contextes/ShipContext";
import {Main} from "./pages/Main";
import {ChatRoom} from "./pages/ChatRoom";


export const App = () => {
    return (
        <Routes>
            <Route path="/" element={<Main/>}/>
            <Route path="/chat" element={<ChatRoom/>}/>
            <Route path="/game-model" element={<GameModel/>}/>
            <Route path="/planet-generator" element={<PlanetGenerator/>}/>
            <Route path="/3d" element={<PlanetGenerator/>}/>
            <Route path="/ship-wiki" element={
                // @ts-ignore
                global.use_ssr ? (
                    <ShipWiki />
                ) : (
                    <ShipMeshLoader>
                        <ShipWiki />
                    </ShipMeshLoader>
                )
            }/>
            <Route path="/character-wiki" element={<CharacterWiki/>}/>
            <Route path="/about" element={<About/>}/>
            <Route path="/contact" element={<Main/>}/>
            <Route index element={<Main/>}/>
        </Routes>
    );
};
