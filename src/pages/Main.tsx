import React from 'react';
import '../App.scss';
import {WebsiteDrawer} from "../Drawer";
import {
    Paper,
    Card,
    CardContent,
    CardHeader,
    Container,
    Grid,
    Typography,
    Box,
    Button,
    CardMedia
} from "@mui/material";
import {Link} from "react-router-dom";
import Carousel from "react-material-ui-carousel";

export const Main = () => {
    return (
        <Paper style={{width: "100%", minHeight: "100vh", height: "fit-content", display: "flex", flexDirection: "column"}}>
            <WebsiteDrawer rightSide={null}/>
            <Container>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        <Card>
                            <CardMedia component="img" src="/mainImages/MainGameMedia.png"></CardMedia>
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
                                <div style={{width: 256, margin: '0 auto'}}>
                                    <Carousel>
                                        {
                                            [{
                                                url: '/mainImages/MainGame1.png',
                                            }, {
                                                url: '/mainImages/MainGame2.png',
                                            }, {
                                                url: '/mainImages/MainGame3.png',
                                            }].map(item => (
                                                <Box key={item.url} component="img" alt="2d Game Image 1" src={item.url} sx={{width: "100%"}}/>
                                            ))
                                        }
                                    </Carousel>
                                </div>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Card>
                            <CardMedia component="img" src="/mainImages/3dGameMedia.png"></CardMedia>
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
                                <div style={{width: 256, margin: '0 auto'}}>
                                    <Carousel>
                                        {
                                            [{
                                                url: '/mainImages/3dGame1.png',
                                            }, {
                                                url: '/mainImages/3dGame2.png',
                                            }, {
                                                url: '/mainImages/3dGame3.png',
                                            }].map(item => (
                                                <Box key={item.url} component="img" alt="3d Game Image 1" src={item.url} sx={{width: "100%"}}/>
                                            ))
                                        }
                                    </Carousel>
                                </div>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Container>
        </Paper>
    );
}
