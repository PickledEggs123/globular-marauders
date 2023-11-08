// @ts-ignore
import {generatePlanet} from "@pickledeggs123/globular-marauders-generator/dist/helpers";


// eslint-disable-next-line no-restricted-globals
self.onmessage = (e: MessageEvent<string>) => {
    const seed = new Date().toISOString();
// eslint-disable-next-line no-restricted-globals
    self.postMessage(generatePlanet(0, seed));
// eslint-disable-next-line no-restricted-globals
    self.postMessage(generatePlanet(1, seed));
// eslint-disable-next-line no-restricted-globals
    self.postMessage(generatePlanet(2, seed));
}