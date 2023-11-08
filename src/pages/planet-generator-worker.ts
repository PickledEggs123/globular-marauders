// @ts-ignore
import {generatePlanet} from "@pickledeggs123/globular-marauders-generator/dist/helpers";


// eslint-disable-next-line no-restricted-globals
self.onmessage = (e: MessageEvent<string>) => {
// eslint-disable-next-line no-restricted-globals
    self.postMessage(generatePlanet(0));
// eslint-disable-next-line no-restricted-globals
    self.postMessage(generatePlanet(1));
// eslint-disable-next-line no-restricted-globals
    self.postMessage(generatePlanet(2));
}