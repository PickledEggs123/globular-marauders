import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import {App} from './App';
import reportWebVitals from './reportWebVitals';
import * as particles from "@pixi/particle-emitter";
import {StaticQuaternionParticleBehavior} from "./resources/particles/StaticQuaternionParticleBehavior";
import {MovementQuaternionParticleBehavior} from "./resources/particles/MovementQuaternionParticleBehavior";
import {StarFieldQuaternionParticleBehavior} from "./resources/particles/StarFieldQuaternionParticleBehavior";
import {BrowserRouter} from "react-router-dom";
import {CacheProvider} from "@emotion/react";
import createCache from "@emotion/cache";
import {CssBaseline} from "@mui/material";
import {theme} from "./theme";
import {ThemeProvider} from "@mui/material/styles";
import {IGameMesh} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import {PlanetMeshLoader} from "./contextes/PlanetContext";
import {ShipMeshLoader} from "./contextes/ShipContext";

particles.Emitter.registerBehavior(StaticQuaternionParticleBehavior);
particles.Emitter.registerBehavior(MovementQuaternionParticleBehavior);
particles.Emitter.registerBehavior(StarFieldQuaternionParticleBehavior);

const key = 'css';
const cache = createCache({key});

ReactDOM.render(
  <React.StrictMode>
      <CacheProvider value={cache}>
          <ThemeProvider theme={theme}>
              <CssBaseline/>
              <BrowserRouter>
                  <PlanetMeshLoader>
                      <ShipMeshLoader>
                          <App/>
                      </ShipMeshLoader>
                  </PlanetMeshLoader>
              </BrowserRouter>
          </ThemeProvider>
      </CacheProvider>
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
