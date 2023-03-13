import React from "react";
import {Route, Routes} from "react-router-dom";
import {ThemeProvider, createTheme, responsiveFontSizes, ThemeOptions} from "@mui/material/styles";
import PixiGame from "./pages/PixiGame";
import {GameModel} from "./pages/GameModel";
import {PlanetGenerator} from "./pages/PlanetGenerator";
import {About} from "./pages/About";
import {Contact} from "./pages/Contact";
import {ShipWiki} from "./pages/ShipWiki";
import {CharacterWiki} from "./pages/CharacterWiki";

const themeOptions: ThemeOptions = {
    palette: {
        mode: "light",
        primary: {
            main: "#b92",
        },
        secondary: {
            main: "#ac2",
        },
        error: {
            main: "#e11",
        },
        warning: {
            main: "#dd2",
        },
        info: {
            main: "#49e",
        },
        success: {
            main: "#2c2",
        },
        divider: "rgba(0,0,0,0.34)",
        background: {
            default: "#eed",
            paper: "#ddc",
        },
    },
};
let theme = createTheme(themeOptions);
theme = responsiveFontSizes(theme, {
    variants: ["h1", "h2", "h3", "h4", "h5", "h6"]
});

export const App = () => {
    return (
        <ThemeProvider theme={theme}>
            <Routes>
                <Route path="/" element={<PixiGame />}/>
                <Route path="/game-model" element={<GameModel />}/>
                <Route path="/planet-generator" element={<PlanetGenerator />}/>
                <Route path="/ship-wiki" element={<ShipWiki />}/>
                <Route path="/character-wiki" element={<CharacterWiki />}/>
                <Route path="/about" element={<About />}/>
                <Route path="/contact" element={<Contact />}/>
                <Route index element={<PixiGame />}/>
            </Routes>
        </ThemeProvider>
    );
};