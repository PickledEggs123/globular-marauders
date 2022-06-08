import React from "react";
import {BrowserRouter, Route, Routes} from "react-router-dom";
import PixiGame from "./pages/PixiGame";
import {GameModel} from "./pages/GameModel";
import {PlanetGenerator} from "./pages/PlanetGenerator";
import {About} from "./pages/About";
import {Contact} from "./pages/Contact";

export const App = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<PixiGame />}/>
                <Route path="/game-model" element={<GameModel />}/>
                <Route path="/planet-generator" element={<PlanetGenerator />}/>
                <Route path="/about" element={<About />}/>
                <Route path="/contact" element={<Contact />}/>
                <Route index element={<PixiGame />}/>
            </Routes>
        </BrowserRouter>
    )
};