import React from 'react';
import '../App.css';
import {WebsiteDrawer} from "../Drawer";
import {Card, CardContent, CardHeader, Grid, Typography} from "@mui/material";

export const About = () => {
    return (
        <div className="App">
            <WebsiteDrawer rightSide={null}/>
            <Grid container xs={12} spacing={2}>
                <Grid item xs={12}>
                    <Card>
                        <CardHeader title="Space Pirates">
                        </CardHeader>
                        <CardContent>
                            <Typography variant="body1">
                                A mix mash of a bunch of crazy ideas to be formed into a game because crazy ideas will make creating
                                a game much more fun. The game must be spherical because spherical is hard. There must be
                                space like physics which means moving forward will cause you to drift forward forever. Rotating
                                will only rotate you in one spot while you continue drifting in the same direction. It's faster
                                to turn around backwards and accelerate than it is to break. The final part is you can only
                                shoot cannon balls side ways with the exception of cannonades which can fire forward or backwards.
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12}>
                    <Card>
                        <CardHeader title="Wizards TBD">
                        </CardHeader>
                        <CardContent>
                            <Typography variant="body1">
                                In the fall of 2022, I'll even add wizards into the mix in the form of a custom
                                magic system or one borrowed from the Spelljammer universe. These polygon ships will become pirate ships
                                manned by fantastic creatures and wizards. A goblin pirate ship flying through outer space firing
                                cannon balls and casting necromancy upon elven archers. Dwarfs as we all know, prefer technology
                                and will use bigger cannon balls instead.
                            </Typography>
                            <br/>
                            <Typography variant="body1">
                                I imagine spells being tracking cannon balls with scripted events such as explosions or curses. I'll
                                create a magic system which applies different buffs and curses to your ship, friendly ships, and enemy ships.
                                This might make the game system more interesting if you can dash forward by 100 units 3 times within 30 seconds.
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12}>
                    <Card>
                        <CardHeader title="Math">
                        </CardHeader>
                        <CardContent>
                            <Typography variant="body1">
                                I studied Linear Algebra than transferred those concepts to Quaternions, with Quaternions
                                as the metric space. This means every position is a quaternion and angles are also quaternions.
                                Quaternions are a beautiful way to compute position and distance since multiplying (mentally the same as adding vectors)
                                quaternions result in spherical trigonometric functions. If everything is a rotation relative to the north pole, the
                                distance between A and B can be computed as inverse(A) * B. Using this property, we can compute
                                line segment intersections (a bullet hitting a line segment of a spaceship's hull). The code is on GitHub if you like to
                                review it.
                            </Typography>
                            <br/>
                            <Typography variant="body1">
                                The ultimate goal is to transfer these concepts into 3d with 3d quaternions. What would be fun is if every direction in 3d space
                                was actually a sphere and if you travel in one direction for long enough, you would always go back to where you started. The first
                                task would be solving this in 2d with a 3d sphere before attempting this in 3d with a 4d sphere.
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12}>
                    <Card>
                        <CardHeader title="Known Bugs">
                        </CardHeader>
                        <CardContent>
                            <Typography variant="body1">
                                The only known physics bug would be rotation being misaligned as you approach the south pole. I don't know how to fix that yet.
                                I have to think if a model which matches what is being shown on the screen and re compute orientation/rotation relative to that model.
                                The current model is that the world is a pizza pie dish with the north pole in the center and the south pole being the perimeter of the pizza dish.
                                This model maps orientation maps straight lines along the sphere as a curvy path along the sphere. Visit the game model page for more information.
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </div>
    );
}
