import React from "react";
import {BrowserRouter, Route, Routes} from "react-router-dom";
import PixiGame from "./PixiGame";
import {GameModel} from "./GameModel";
import {PlanetGenerator} from "./PlanetGenerator";
import {About} from "./About";
import {Contact} from "./Contact";

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