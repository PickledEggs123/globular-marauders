import {Route, Routes} from "react-router-dom";
import React from "react";

export const AppRoutes = () => (
    <Routes>
        <Route path="/"/>
        <Route path="/game-model"/>
        <Route path="/planet-generator"/>
        <Route path="/ship-wiki"/>
        <Route path="/about"/>
        <Route path="/contact"/>
        <Route index/>
    </Routes>
);