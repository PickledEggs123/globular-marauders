import React from "react";
import {Route, Routes} from "react-router-dom";
import PixiGame from "./pages/PixiGame";
import {GameModel} from "./pages/GameModel";
import {PlanetGenerator} from "./pages/PlanetGenerator";
import {About} from "./pages/About";
import {Contact} from "./pages/Contact";
import {ShipWiki} from "./pages/ShipWiki";
import {CharacterWiki} from "./pages/CharacterWiki";
import {ShipContext} from "./contextes/ShipContext";
import {PlanetContext} from "./contextes/PlanetContext";
import {Main} from "./pages/Main";


export const App = () => {
    return (
        <Routes>
            <Route path="/" element={<Main />}/>
            <Route path="/2d-game" element={<ShipContext.Consumer>{shipContext => <PlanetContext.Consumer>{planetContext => <PixiGame shipContext={shipContext} planetContext={planetContext} />}</PlanetContext.Consumer>}</ShipContext.Consumer>}/>
            <Route path="/game-model" element={<GameModel />}/>
            <Route path="/planet-generator" element={<PlanetGenerator />}/>
            <Route path="/ship-wiki" element={<ShipWiki />}/>
            <Route path="/character-wiki" element={<CharacterWiki />}/>
            <Route path="/about" element={<About />}/>
            <Route path="/contact" element={<Contact />}/>
            <Route index element={<Main />}/>
        </Routes>
    );
};