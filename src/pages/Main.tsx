import React from 'react';
import '../App.scss';
import {WebsiteDrawer} from "../Drawer";
import {Paper, Card, CardContent, CardHeader, Container, Grid, Typography, Box, Button} from "@mui/material";
import {Image} from "@mui/icons-material";
import {Link} from "react-router-dom";

export const Main = () => {
    return (
        <Paper style={{width: "100vw", minHeight: "100vh", height: "fit-content", display: "flex", flexDirection: "column"}}>
            <WebsiteDrawer rightSide={null}/>
            <Container>
                <Typography variant="h3">
                    Globular Marauders
                </Typography>
                <Grid container xs={12} spacing={2}>
                    <Grid item xs={12}>
                        <Card>
                            <CardHeader title="The Early Prototype" subheader="Asteroid style movement but you fire side ways">
                            </CardHeader>
                            <CardContent>
                                <Typography variant="body1">
                                    I decided on a spherical geometry using quaternions as the basis of all math instead
                                    of vectors.
                                    Here's some prototypes with early mathematics such as Voronoi Tesselation using
                                    quaternions.
                                    I also did movement and rotation with quaternions. The graphics were very basic in
                                    the
                                    beginning of the project.
                                    <br/>
                                    <Link to="/2d-game"><Button>Click here to play the latest version</Button></Link>
                                </Typography>
                                <br/>
                                <Grid container xs={12} spacing={2}>
                                    <Grid item xs={4}>
                                        <Box component="img" alt="2d Game Image 1" src="/mainImages/MainGame1.png" sx={{width: "100%"}}/>
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Box component="img" alt="2d Game Image 2" src="/mainImages/MainGame2.png" sx={{width: "100%"}}/>
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Box component="img" alt="2d Game Image 3" src="/mainImages/MainGame3.png" sx={{width: "100%"}}/>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12}>
                        <Card>
                            <CardHeader title="More Reasonable Planet with Ocean" subheader="Ocean pathfinding is harder than space with no obstacles">
                            </CardHeader>
                            <CardContent>
                                <Typography variant="body1">
                                    With more skills, I added a planet with height and terrain. I also added navigation
                                    meshes to pathfind
                                    around the land and ocean parts of the planet. Instead of being in space, now it's
                                    on a single planet.
                                    This is a fully decked out ThreeJS experience with multiplayer via EasyRTC and
                                    Networked-Aframe. There
                                    are bugs in Networked-Aframe such as when an NPC is killed or despawns between
                                    connecting to the network
                                    and creating the networked NPC, it will try to delete something that doesn't exist.
                                    It's not a perfect
                                    multiplayer netcode library.
                                </Typography>
                                <br/>
                                <Typography variant="body1">
                                    Clicking on water will move the ship. Using the keyboard will also move the ship.
                                    Clicking on land will
                                    spawn foot soldiers or knights. The knights will launch arrows at the native NPCs on
                                    the islands. Killing
                                    native NPCs or clicking buildings will spawn gold coins. The next step is to make
                                    ships fire cannon balls
                                    and add the ability to control multiple ships and multiple NPCs.
                                    <br/>
                                    <Link to="/planet-generator"><Button>Click here to play the 3d game</Button></Link>
                                </Typography>
                                <br/>
                                <Grid container xs={12} spacing={2}>
                                    <Grid item xs={4}>
                                        <Box component="img" alt="3d Game Image 1" src="/mainImages/3dGame1.png"
                                             sx={{width: "100%"}}/>
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Box component="img" alt="3d Game Image 2" src="/mainImages/3dGame2.png"
                                             sx={{width: "100%"}}/>
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Box component="img" alt="3d Game Image 3" src="/mainImages/3dGame3.png"
                                             sx={{width: "100%"}}/>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Container>
        </Paper>
    );
}
