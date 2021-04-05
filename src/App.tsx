import React from 'react';
import './App.css';
import Quaternion from 'quaternion';

class Planet implements ICameraState {
    public id: string = "";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public color: string = "blue";
}

class Ship implements ICameraState {
    public id: string = "";
    public color: string = "purple";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public cannonLoading?: Date = undefined;
}

class SmokeCloud implements ICameraState, IExpirable {
    public id: string = "";
    public color: string = "grey";
    public position: Quaternion = Quaternion.ONE;
    public positionVelocity: Quaternion = Quaternion.ONE;
    public orientation: Quaternion = Quaternion.ONE;
    public orientationVelocity: Quaternion = Quaternion.ONE;
    public created: Date = new Date(Date.now());
    public expires: Date = new Date(Date.now() + 10000);
}

interface ICameraState {
    /**
     * The id of the camera.
     */
    id: string;
    /**
     * Position, relative to north pole.
     */
    position: Quaternion;
    /**
     * Position velocity, in north pole reference frame.
     */
    positionVelocity: Quaternion;
    /**
     * Orientation, in north pole reference frame.
     */
    orientation: Quaternion;
    /**
     * Orientation velocity, in north pole reference frame.
     */
    orientationVelocity: Quaternion;
    /**
     * The color of the camera object.
     */
    color: string;
    /**
     * The start of cannon loading.
     */
    cannonLoading?: Date;
}

interface IExpirable {
    /**
     * The date an expirable object was created.
     */
    created: Date;
    /**
     * The date an expirable object will be destroyed.
     */
    expires: Date;
}

interface IDrawable {
    id: string;
    color: string;
    position: Quaternion;
    positionVelocity: Quaternion;
    orientation: Quaternion;
    orientationVelocity: Quaternion;
    cannonLoading?: Date;
    projection: { x: number, y: number };
    reverseProjection: { x: number, y: number };
    rotatedPosition: [number, number, number];
    rotation: number;
    distance: number;
}

interface IAppProps {
}

interface IAppState {
    showNotes: boolean;
    width: number;
    height: number;
    planets: Planet[];
    ships: Ship[];
    smokeClouds: SmokeCloud[];
    zoom: number;
}

class App extends React.Component<IAppProps, IAppState> {
    state = {
        showNotes: false as boolean,
        width: 500 as number,
        height: 500 as number,
        planets: [] as Planet[],
        ships: [] as Ship[],
        smokeClouds: [] as SmokeCloud[],
        zoom: 4 as number,
    };

    private showNotesRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
    private rotateCameraInterval: any = null;
    private activeKeys: any[] = [];
    private keyDownHandlerInstance: any;
    private keyUpHandlerInstance: any;

    private static speed: number = 1 / 6000;

    private static randomRange(start: number = -1, end: number = 1): number {
        const value = Math.random();
        return start + (end - start) * value;
    }

    private static GetCameraState(viewableObject: ICameraState): ICameraState {
        return {
            id: viewableObject.id,
            color: viewableObject.color,
            position: viewableObject.position.clone(),
            positionVelocity: viewableObject.positionVelocity.clone(),
            orientation: viewableObject.orientation.clone(),
            orientationVelocity: viewableObject.orientationVelocity.clone(),
            cannonLoading: viewableObject.cannonLoading,
        };
    }

    private getFirstShip(state?: IAppState): ICameraState {
        const ship = (state || this.state).ships[0];
        if (ship) {
            return App.GetCameraState(ship);
        }
        throw new Error("Cannot find first ship");
    }

    private rotatePlanet<T extends ICameraState>(planet: T): T {
        const {
            position: cameraPosition,
            orientation: cameraOrientation,
        } = this.getFirstShip();
        const position = cameraOrientation.clone().conjugate()
            .mul(cameraPosition.clone().conjugate())
            .mul(planet.position.clone());
        const orientation = cameraOrientation.clone().conjugate()
            .mul(planet.orientation.clone());
        return {
            ...planet,
            position,
            orientation,
        };
    }

    private convertToDrawable<T extends ICameraState>(layerPostfix: string, size: number, planet: T): IDrawable {
        const rotatedPosition = planet.position.rotateVector([0, 0, 1]);
        const projection = this.stereographicProjection(planet, size);
        const reverseProjection = this.stereographicProjection(planet, size);
        // const distance = 50 * Math.sqrt(
        //     Math.pow(rotatedPosition[0], 2) +
        //     Math.pow(rotatedPosition[1], 2) +
        //     Math.pow(1 - rotatedPosition[2], 2)
        // );
        const distance = 50 * (1 - rotatedPosition[2]);
        const orientationPoint = planet.orientation.rotateVector([1, 0, 0]);
        const rotation = Math.atan2(-orientationPoint[1], orientationPoint[0]) / Math.PI * 180;
        return {
            id: `${planet.id}${layerPostfix}`,
            color: planet.color,
            position: planet.position,
            positionVelocity: planet.positionVelocity,
            orientation: planet.orientation,
            orientationVelocity: planet.orientationVelocity,
            cannonLoading: planet.cannonLoading,
            projection,
            reverseProjection,
            rotatedPosition,
            rotation,
            distance,
        };
    }

    private stereographicProjection(planet: ICameraState, size: number = 1): {x: number, y: number} {
        const zoom = this.state.zoom;
        const vector = planet.position.rotateVector([0, 0, 1]);
        return {
            x: vector[0] * zoom * size,
            y: vector[1] * zoom * size,
        };
    }

    private drawPlanet(planetDrawing: IDrawable) {
        const isReverseSide = planetDrawing.rotatedPosition[2] > 0;
        const x = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).x + 1) * 0.5;
        const y = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).y + 1) * 0.5;
        const distance = planetDrawing.distance;
        const size = 2 * Math.atan(10 / (2 * distance));
        return (
            <circle
                key={planetDrawing.id}
                cx={x * this.state.width}
                cy={(1 - y) * this.state.height}
                r={size * this.state.zoom}
                fill={planetDrawing.color}
                stroke="grey"
                strokeWidth={0.2 * size * this.state.zoom}
                style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
            />
        );
    }

    private drawShip(planetDrawing: IDrawable) {
        const isReverseSide = planetDrawing.rotatedPosition[2] > 0;
        const x = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).x + 1) * 0.5;
        const y = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).y + 1) * 0.5;
        const distance = planetDrawing.distance;
        const size = 2 * Math.atan(1 / (2 * distance));
        const scale = (size * this.state.zoom) / 100;
        let velocityX = 0;
        let velocityY = 0;
        const isPlayerShip = planetDrawing.id === "ship-0-ships";
        if (isPlayerShip) {
            const velocityPosition = [0, 0, 1];
            const velocityLength = Math.sqrt(velocityPosition.reduce((sum: number, value: number): number => {
                return sum + Math.pow(value, 2);
            }, 0));
            const velocityAngle = Math.atan2(velocityPosition[1], velocityPosition[0]);
            const orientationPosition = planetDrawing.position.clone().conjugate()
                .mul(planetDrawing.orientation.clone().conjugate())
                .rotateVector([1, 0, 0]);
            const orientationAngle = Math.atan2(orientationPosition[1], orientationPosition[0]);
            if (velocityLength > 0) {
                velocityX = velocityLength * Math.cos(velocityAngle + orientationAngle);
                velocityY = velocityLength * Math.sin(velocityAngle + orientationAngle);
            }
        }
        const rightCannonPointTop: [number, number] = [
            Math.max(this.state.width / 2, this.state.height / 2) * Math.cos((10 / 180 * Math.PI)) * this.state.zoom,
            Math.max(this.state.width / 2, this.state.height / 2) * Math.sin((10 / 180 * Math.PI)) * this.state.zoom,
        ]
        const rightCannonPointBottom: [number, number] = [
            Math.max(this.state.width / 2, this.state.height / 2) * Math.cos(-(10 / 180 * Math.PI)) * this.state.zoom,
            Math.max(this.state.width / 2, this.state.height / 2) * Math.sin(-(10 / 180 * Math.PI)) * this.state.zoom,
        ];
        const leftCannonPointTop: [number, number] = [
            Math.max(this.state.width / 2, this.state.height / 2) * Math.cos(Math.PI - (10 / 180 * Math.PI)) * this.state.zoom,
            Math.max(this.state.width / 2, this.state.height / 2) * Math.sin(Math.PI - (10 / 180 * Math.PI)) * this.state.zoom,
        ]
        const leftCannonPointBottom: [number, number] = [
            Math.max(this.state.width / 2, this.state.height / 2) * Math.cos(Math.PI + (10 / 180 * Math.PI)) * this.state.zoom,
            Math.max(this.state.width / 2, this.state.height / 2) * Math.sin(Math.PI + (10 / 180 * Math.PI)) * this.state.zoom,
        ];
        let cannonLoadingPercentage = 0;
        if (isPlayerShip && planetDrawing.cannonLoading) {
            cannonLoadingPercentage = (Date.now() - +planetDrawing.cannonLoading) / 3000;
        }
        return (
            <g key={planetDrawing.id} transform={`translate(${x * this.state.width},${(1 - y) * this.state.height})`}>
                {
                    isPlayerShip && (
                        <line
                            x1={0}
                            y1={0}
                            x2={this.state.width * 0.5 * velocityX}
                            y2={this.state.height * 0.5 * velocityY}
                            stroke="white"
                            strokeWidth={2}
                            strokeDasharray="1,5"
                        />
                    )
                }
                <g transform={`rotate(${planetDrawing.rotation}) scale(${scale})`}>
                    <polygon
                        points="0,-30 10,-20 10,25 5,30 0,25 -5,30 -10,25 -10,-20"
                        fill={planetDrawing.color}
                        stroke="grey"
                        strokeWidth={0.05 * size * this.state.zoom}
                        style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
                    />
                    {
                        isPlayerShip && planetDrawing.cannonLoading && (
                            <>
                                <polygon
                                    points={`10,-20 ${rightCannonPointBottom[0]},${rightCannonPointBottom[1]} ${rightCannonPointTop[0]},${rightCannonPointTop[1]} 10,20`}
                                    fill="grey"
                                    stroke="white"
                                    strokeWidth={0.05 * size * this.state.zoom}
                                    style={{opacity: 0.3}}
                                />
                                <polygon
                                    points={`-10,-20 ${leftCannonPointBottom[0]},${leftCannonPointBottom[1]} ${leftCannonPointTop[0]},${leftCannonPointTop[1]} -10,20`}
                                    fill="grey"
                                    stroke="white"
                                    strokeWidth={0.05 * size * this.state.zoom}
                                    style={{opacity: 0.3}}
                                />
                                <polygon
                                    points={`10,-20 ${rightCannonPointBottom[0] * cannonLoadingPercentage},${rightCannonPointBottom[1] * cannonLoadingPercentage} ${rightCannonPointTop[0] * cannonLoadingPercentage},${rightCannonPointTop[1] * cannonLoadingPercentage} 10,20`}
                                    fill="white"
                                    style={{opacity: 0.3}}
                                />
                                <polygon
                                    points={`-10,-20 ${leftCannonPointBottom[0] * cannonLoadingPercentage},${leftCannonPointBottom[1] * cannonLoadingPercentage} ${leftCannonPointTop[0] * cannonLoadingPercentage},${leftCannonPointTop[1] * cannonLoadingPercentage} -10,20`}
                                    fill="white"
                                    style={{opacity: 0.3}}
                                />
                            </>
                        )
                    }
                </g>
            </g>
        );
    }

    private drawSmokeCloud(planetDrawing: IDrawable) {
        const isReverseSide = planetDrawing.rotatedPosition[2] > 0;
        const x = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).x + 1) * 0.5;
        const y = ((isReverseSide ? planetDrawing.reverseProjection : planetDrawing.projection).y + 1) * 0.5;
        const distance = planetDrawing.distance;
        const size = 0.2 * 2 * Math.atan(10 / (2 * distance));
        return (
            <circle
                key={planetDrawing.id}
                cx={x * this.state.width}
                cy={(1 - y) * this.state.height}
                r={size * this.state.zoom}
                fill={planetDrawing.color}
                stroke="darkgray"
                strokeWidth={0.02 * size * this.state.zoom}
                style={{opacity: (planetDrawing.rotatedPosition[2] + 1) * 2 * 0.5 + 0.5}}
            />
        );
    }

    private gameLoop() {
        this.setState((state) => {
            if (state.ships.length === 0) {
                return state;
            }
            let {
                id: cameraId,
                position: cameraPosition,
                positionVelocity: cameraPositionVelocity,
                orientation: cameraOrientation,
                orientationVelocity: cameraOrientationVelocity,
                cannonLoading: cameraCannonLoading,
            } = this.getFirstShip(state);
            const smokeClouds = [
                ...state.smokeClouds.filter(smokeCloud => {
                    return +smokeCloud.expires > Date.now();
                }).slice(-20)
            ];

            if (this.activeKeys.includes("a")) {
                const rotation = Quaternion.fromAxisAngle([0, 0, 1], Math.PI).pow(1/300);
                cameraOrientationVelocity = cameraOrientationVelocity.clone().mul(rotation);
            }
            if (this.activeKeys.includes("d")) {
                const rotation = Quaternion.fromAxisAngle([0, 0, 1], -Math.PI).pow(1/300);
                cameraOrientationVelocity = cameraOrientationVelocity.clone().mul(rotation);
            }
            if (this.activeKeys.includes("w")) {
                const forward = cameraOrientation.clone().rotateVector([0, 1, 0]);
                const rotation = Quaternion.fromBetweenVectors([0, 0, 1], forward).pow(App.speed);
                cameraPositionVelocity = cameraPositionVelocity.clone().mul(rotation);
                const smokeCloud = new SmokeCloud();
                smokeCloud.id = `${cameraId}-${Math.floor(Math.random() * 100000000)}`;
                smokeCloud.position = cameraPosition;
                smokeCloud.positionVelocity = rotation.conjugate();
                smokeClouds.push(smokeCloud);
            }
            if (this.activeKeys.includes("s")) {
                const backward = cameraOrientation.clone().rotateVector([0, -1, 0]);
                const rotation = Quaternion.fromBetweenVectors([0, 0, 1], backward).pow(App.speed);
                cameraPositionVelocity = cameraPositionVelocity.clone().mul(rotation);
            }
            if (this.activeKeys.includes(" ") && !cameraCannonLoading) {
                cameraCannonLoading = new Date(Date.now());
            }
            if (!this.activeKeys.includes(" ") && cameraCannonLoading) {
                // cannon fire
                cameraCannonLoading = undefined;
            }
            if (this.activeKeys.includes(" ") && cameraCannonLoading && Date.now() - +cameraCannonLoading > 3000) {
                // cancel cannon fire
                cameraCannonLoading = undefined;
            }
            if (cameraPositionVelocity !== Quaternion.ONE) {
                cameraPosition = cameraPosition.clone().mul(cameraPositionVelocity.clone());
            }
            if (cameraOrientationVelocity !== Quaternion.ONE) {
                cameraOrientation = cameraOrientation.clone().mul(cameraOrientationVelocity.clone());
            }
            if (cameraPosition !== this.getFirstShip(state).position && false) {
                const diffQuaternion = this.getFirstShip(state).position.clone().conjugate().mul(cameraPosition.clone());
                cameraOrientation = cameraOrientation.clone().mul(diffQuaternion);
            }
            const ship: Ship = {
                ...state.ships[0],
                position: cameraPosition,
                orientation: cameraOrientation,
                positionVelocity: cameraPositionVelocity,
                orientationVelocity: cameraOrientationVelocity,
                cannonLoading: cameraCannonLoading,
            };
            return {
                ...state,
                ships: [ship, ...state.ships.slice(1, state.ships.length)],
                smokeClouds,
            };
        });
    }

    private handleShowNotes() {
        if (this.showNotesRef.current) {
            this.setState({
                ...this.state,
                showNotes: this.showNotesRef.current.checked,
            });
        }
    }

    private handleKeyDown(event: KeyboardEvent) {
        if (!event.repeat) {
            this.activeKeys.push(event.key);
        }
    }

    private handleKeyUp(event: KeyboardEvent) {
        if (!event.repeat) {
            const index = this.activeKeys.findIndex(k => k === event.key);
            this.activeKeys.splice(index, 1);
        }
    }

    private incrementZoom() {
        const zoom = Math.min(this.state.zoom * 2, 32);
        this.setState({
            ...this.state,
            zoom
        });
    }

    private decrementZoom() {
        const zoom = Math.max(this.state.zoom / 2, 1);
        this.setState({
            ...this.state,
            zoom
        });
    }

    componentDidMount() {
        const planets: Planet[] = [];
        for (let i = 0; i < 150; i++) {
            const planet = new Planet();
            planet.id = `planet-${i}`;
            planet.position = new Quaternion(0, App.randomRange(), App.randomRange(), App.randomRange());
            planet.position = planet.position.normalize();
            planet.orientation = Quaternion.fromAxisAngle([0, 0, 1], Math.random() * 2 * Math.PI);
            const colorValue = Math.random();
            if (colorValue > 0.75)
                planet.color = "red";
            else if (colorValue > 0.5)
                planet.color = "green";
            else if (colorValue > 0.25)
                planet.color = "tan";
            planets.push(planet);
        }
        const ships: Ship[] = [];
        for (let i = 0; i < 200; i++) {
            const ship = new Ship();
            ship.id = `ship-${i}`;
            ship.position = new Quaternion(0, App.randomRange(), App.randomRange(), App.randomRange());
            ship.position = ship.position.normalize();
            ship.orientation = Quaternion.fromAxisAngle([0, 0, 1], Math.random() * 2 * Math.PI);
            if (i === 0) {
                const colorValue = Math.random();
                if (colorValue > 0.75)
                    ship.color = "red";
                else if (colorValue > 0.5)
                    ship.color = "green";
                else if (colorValue > 0.25)
                    ship.color = "tan";
            }
            ships.push(ship);
        }
        this.setState({
            ...this.state,
            planets: [...planets],
            ships: [...ships],
        });

        this.rotateCameraInterval = setInterval(this.gameLoop.bind(this), 100);
        this.keyDownHandlerInstance = this.handleKeyDown.bind(this);
        this.keyUpHandlerInstance = this.handleKeyUp.bind(this);
        document.addEventListener("keydown", this.keyDownHandlerInstance);
        document.addEventListener("keyup", this.keyUpHandlerInstance);
    }

    componentWillUnmount() {
        if (this.rotateCameraInterval) {
            clearInterval(this.rotateCameraInterval);
        }
        document.removeEventListener("keydown", this.keyDownHandlerInstance);
        document.removeEventListener("keyup", this.keyUpHandlerInstance);
    }

    render() {
        return (
            <div className="App">
                <h1>
                    Globular Marauders
                </h1>
                <div>
                    <span>Zoom</span>
                    <button onClick={this.decrementZoom.bind(this)}>-</button>
                    <span>{this.state.zoom}</span>
                    <button onClick={this.incrementZoom.bind(this)}>+</button>
                </div>
                <div>
                    <input type="checkbox" ref={this.showNotesRef} checked={this.state.showNotes} onChange={this.handleShowNotes.bind(this)}/>
                    <span>Show Notes</span>
                </div>
                {
                    this.state.showNotes && (
                        <ul>
                            <li>Started 3/28/2021</li>
                            <li>Create 3d sphere world which has different planets. -- DONE 3/28/2021</li>
                            <li>Project 3d world onto a small area for viewing, yet still able to navigate in a circle like a 3d sphere. -- DONE 3/28/2021</li>
                            <li>Create camera system centered around a small ship. Rotating will rotate camera/world. -- DONE 3/30/2021</li>
                            <li>Add projectiles or cannon balls and small frictionless motion in space.</li>
                            <li>Add gravity around planets.</li>
                            <li>Improve random distribution of planets using Voronoi and Lloyd Relaxation.</li>
                            <li>Create factions which start from a home world and launch ships.</li>
                            <li>Spawn settler ships to colonize other worlds. Each world has upto 3 resources.</li>
                            <li>Spawn merchant ships to trade with colonies. Trading is simplified flying between A and B.</li>
                            <li>Add economics, price rising and falling based on supply and demand, traders will try to go towards important colonies.</li>
                            <li>Add ability to pirate merchants and raid colonies.</li>
                            <li>Factions will plan invasions of enemy colonies, merchants, and capitals.</li>
                            <li>Add multiplayer...</li>
                            <li>Play Styles:
                                <ul>
                                    <li>Pirate/Marauder will attack kingdoms and other pirates.</li>
                                    <li>Bounty Hunter will find pirates in the outskirts of the trade empire.</li>
                                    <li>Warship will attach kingdoms in large battles over colonies and capitals.</li>
                                </ul>
                            </li>
                            <li>
                                Places:
                                <ul>
                                    <li>Capitals: Home of a kingdom.</li>
                                    <li>Colony: New world island which makes money and repairs ships.</li>
                                    <li>Undiscovered Islands: Locations to build colonies.</li>
                                </ul>
                            </li>
                            <li>
                                Ships:
                                <ul>
                                    <li>Settler: Colonize</li>
                                    <li>Merchant: Trade</li>
                                    <li>Warship: Attack</li>
                                </ul>
                            </li>
                            <li>Make multiple rooms/worlds for large amounts of players.</li>
                        </ul>
                    )
                }
                <svg width={this.state.width} height={this.state.height}>
                    <circle
                        cx={this.state.width * 0.5}
                        cy={this.state.height * 0.5}
                        r={Math.min(this.state.width, this.state.height) * 0.5}
                        fill="black"
                    />
                    {
                        [
                            ...this.state.planets.map(this.rotatePlanet.bind(this))
                                .map(this.convertToDrawable.bind(this, "-layer1", 1)),
                            ...this.state.planets.map(this.rotatePlanet.bind(this))
                                .map(this.convertToDrawable.bind(this, "-layer2", 0.5)),
                            ...this.state.planets.map(this.rotatePlanet.bind(this))
                                .map(this.convertToDrawable.bind(this, "-layer3", 0.25)),
                            ...this.state.planets.map(this.rotatePlanet.bind(this))
                                .map(this.convertToDrawable.bind(this, "-layer4", 0.125))
                        ].sort((a: any, b: any) => b.distance - a.distance).map(this.drawPlanet.bind(this))
                    }
                    {
                        this.state.ships.map(this.rotatePlanet.bind(this))
                            .map(this.convertToDrawable.bind(this, "-ships", 1))
                            .map(this.drawShip.bind(this))
                    }
                    {
                        this.state.smokeClouds.map(this.rotatePlanet.bind(this))
                            .map(this.convertToDrawable.bind(this, "-smokeClouds", 1))
                            .map(this.drawSmokeCloud.bind(this))
                    }
                </svg>
            </div>
        );
    }
}

export default App;
