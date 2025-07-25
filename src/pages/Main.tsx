import React from 'react';
import '../App.scss';
import {WebsiteDrawer2} from "../Drawer";
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
import {Carousel} from "nuka-carousel";
import {ImageExpander} from "./Main/ImageExpander";

export const Main = () => {
    return (
        <Paper style={{width: "100%", minHeight: "100vh", height: "fit-content", display: "flex", flexDirection: "column"}}>
            <WebsiteDrawer2 rightSide={null} content={
                <Container>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Card>
                                <ImageExpander src="/mainImages/3dGameMedia.png" alt="/mainImages/3dGameMedia.png"/>
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
                                        <Link to="/planet-generator"><Button variant="contained">Click here to play the 3d game</Button></Link>
                                    </Typography>
                                    <br/>
                                    <div style={{width: 256, margin: '0 auto'}}>
                                        <Carousel autoplay showDots>
                                            {
                                                [{
                                                    url: '/mainImages/3dGame1.png',
                                                }, {
                                                    url: '/mainImages/3dGame2.png',
                                                }, {
                                                    url: '/mainImages/3dGame3.png',
                                                }].map(item => (
                                                    <ImageExpander src={item.url} alt={item.url}/>
                                                ))
                                            }
                                        </Carousel>
                                    </div>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Card>
                                <ImageExpander src="/mainImages/MainGameMedia.png" alt="/mainImages/MainGameMedia.png"/>
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
                                        <Link to="/2d"><Button variant="contained">Click here to play the latest version</Button></Link>
                                    </Typography>
                                    <br/>
                                    <div style={{width: 256, margin: '0 auto'}}>
                                        <Carousel autoplay showDots>
                                            {
                                                [{
                                                    url: '/mainImages/MainGame1.png',
                                                }, {
                                                    url: '/mainImages/MainGame2.png',
                                                }, {
                                                    url: '/mainImages/MainGame3.png',
                                                }].map(item => (
                                                    <ImageExpander src={item.url} alt={item.url}/>
                                                ))
                                            }
                                        </Carousel>
                                    </div>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Card>
                                <ImageExpander src="/mainImages/ChatMedia.png" alt="/mainImages/ChatMedia.png"/>
                                <CardHeader title="Gemini Powered Chatbot" subheader="Have fun chatting with AI">
                                </CardHeader>
                                <CardContent>
                                    <Typography variant="body1">
                                        I added an AI chatbot powered by Google Gemini. The AI is advanced enough to write poetry
                                        or code. You can ask it any question such as science, physics, legal advice, ect...
                                        <br/>
                                        <Link to="/chat"><Button variant="contained">Click here to Chat with AI</Button></Link>
                                    </Typography>
                                    <br/>
                                    <div style={{width: 256, margin: '0 auto'}}>
                                        <Carousel autoplay showDots>
                                            {
                                                [{
                                                    url: '/mainImages/Chat1.png',
                                                }, {
                                                    url: '/mainImages/Chat2.png',
                                                }, {
                                                    url: '/mainImages/Chat3.png',
                                                }].map(item => (
                                                    <ImageExpander src={item.url} alt={item.url}/>
                                                ))
                                            }
                                        </Carousel>
                                    </div>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Card>
                                <CardHeader title="ML Demo from college" subheader="I haven't updated my ml skills in a while...">
                                </CardHeader>
                                <CardContent>
                                    <Typography variant="body1">
                                        Some code I have from college that I reimplemented into JavaScript and Next.JS.
                                        It's not much but it has SVM using Voronoi and random triangles. It has a much
                                        better working language detector which is a little buggy on small amount of text
                                        because it was trained using a single book or two.
                                        <a href="https://tyler-truong-ml-demo.com/about">Tyler Truong ML Demo</a>
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                    <Typography variant="h3">
                        About the Developer
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Card>
                                <CardMedia component="img" src="/mainImages/DevPhoto.png"></CardMedia>
                                <CardHeader title="Tyler Truong" subheader="The Developer">
                                </CardHeader>
                                <CardContent>
                                    <Typography variant="body1">
                                        I hope this is a great resume project containing a mixture of 3d graphics, react front end, and basic material styling.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Card>
                                <CardMedia component="img" src="/mainImages/linkedin.png"></CardMedia>
                                <CardHeader title="LinkedIn" subheader="Full Resume">
                                </CardHeader>
                                <CardContent>
                                    <Typography variant="body1">
                                        <a href="https://www.linkedin.com/in/tyler-truong-b48867104/">My LinkedIn Profile.</a>
                                        The Icon is from FlatIcon.com with <a href="https://www.flaticon.com/free-icon/linkedin_174857">this link pointing towards the icon</a>
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Card>
                                <CardMedia component="img" src="/mainImages/GitHub_Logo.png"></CardMedia>
                                <CardHeader title="GitHub" subheader="The code to make the game">
                                </CardHeader>
                                <CardContent>
                                    <Typography variant="body1">
                                        <a href="https://github.com/PickledEggs123">I can be contacted via the GitHub page which contains the source code used to make this project.</a>
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Container>
            }/>
        </Paper>
    );
}
