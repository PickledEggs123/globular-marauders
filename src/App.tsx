import React from "react";
import {BrowserRouter, Route, Routes} from "react-router-dom";
import {ThemeProvider} from "@mui/styles";
import {createTheme, responsiveFontSizes} from "@mui/material";
import PixiGame from "./pages/PixiGame";
import {GameModel} from "./pages/GameModel";
import {PlanetGenerator} from "./pages/PlanetGenerator";
import {About} from "./pages/About";
import {Contact} from "./pages/Contact";
import {ShipWiki} from "./pages/ShipWiki";

export const App = () => {
    let theme = createTheme();
    theme = responsiveFontSizes(theme, {
        variants: ["h1", "h2", "h3", "h4", "h5", "h6"]
    });
    return (
        <ThemeProvider theme={theme}>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<PixiGame />}/>
                    <Route path="/game-model" element={<GameModel />}/>
                    <Route path="/planet-generator" element={<PlanetGenerator />}/>
                    <Route path="/ship-wiki" element={<ShipWiki />}/>
                    <Route path="/about" element={<About />}/>
                    <Route path="/contact" element={<Contact />}/>
                    <Route index element={<PixiGame />}/>
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    );
};