import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import {App} from './App';
import reportWebVitals from './reportWebVitals';
import * as particles from "@pixi/particle-emitter";
import {StaticQuaternionParticleBehavior} from "./resources/particles/StaticQuaternionParticleBehavior";
import {MovementQuaternionParticleBehavior} from "./resources/particles/MovementQuaternionParticleBehavior";
import {StarFieldQuaternionParticleBehavior} from "./resources/particles/StarFieldQuaternionParticleBehavior";
import {BrowserRouter} from "react-router-dom";

particles.Emitter.registerBehavior(StaticQuaternionParticleBehavior);
particles.Emitter.registerBehavior(MovementQuaternionParticleBehavior);
particles.Emitter.registerBehavior(StarFieldQuaternionParticleBehavior);

ReactDOM.render(
  <React.StrictMode>
      <BrowserRouter>
          <App/>
      </BrowserRouter>
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
