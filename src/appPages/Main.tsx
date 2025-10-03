'use client';

import React from 'react';
import '../App.scss';
import {WebsiteDrawer2} from "../Drawer";
import {Button, Card, CardContent, CardHeader, CardMedia, Container, Grid, Paper, Typography} from "@mui/material";
import Link from "next/link";
import {Carousel} from "nuka-carousel";
import {ImageExpander} from "./Main/ImageExpander";
import {FadeIntoView} from "./components/FadeIntoView";

export const Main = () => {
    return (
        <Paper style={{width: "100%", minHeight: "100vh", height: "fit-content", display: "flex", flexDirection: "column"}}>
            <WebsiteDrawer2 rightSide={null} content={
                <Container>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <FadeIntoView>
                                <Card>
                                    <ImageExpander src="/mainImages/3dGameMedia.png" alt="/mainImages/3dGameMedia.png"/>
                                    <CardHeader title="More Reasonable Planet with Ocean" subheader="Ocean pathfinding is harder than space with no obstacles">
                                    </CardHeader>
                                    <CardContent>
                                        <Typography variant="body1">
                                            I added a planet with height and terrain. I also added navigation
                                            meshes to pathfind
                                            around the land and ocean parts of the planet.
                                            This is a fully decked out ThreeJS experience with multiplayer via WebSockets and
                                            Networked-Aframe. There
                                            are bugs in Networked-Aframe such as when an NPC is killed or despawns between
                                            connecting to the network
                                            and creating the networked NPC, it will try to delete something that doesn't exist.
                                            It's not a perfect
                                            multiplayer netcode library. It mostly works.
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
                                            <Link href="/planet-generator"><Button variant="contained">Click here to play the 3d game</Button></Link>
                                        </Typography>
                                        <br/>
                                        <div style={{width: 256, margin: '0 auto'}}>
                                            <Carousel autoplay showDots wrapMode="wrap">
                                                {
                                                    [{
                                                        url: '/mainImages/3dGame1.png',
                                                    }, {
                                                        url: '/mainImages/3dGame2.png',
                                                    }, {
                                                        url: '/mainImages/3dGame3.png',
                                                    }].map(item => (
                                                        <ImageExpander key={item.url} src={item.url} alt={item.url}/>
                                                    ))
                                                }
                                            </Carousel>
                                        </div>
                                    </CardContent>
                                </Card>
                            </FadeIntoView>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FadeIntoView>
                                <Card>
                                    <ImageExpander src="/mainImages/ChatMedia.png" alt="/mainImages/ChatMedia.png"/>
                                    <CardHeader title="Gemini Powered Chatbot" subheader="Have fun chatting with AI">
                                    </CardHeader>
                                    <CardContent>
                                        <Typography variant="body1">
                                            I added an AI chatbot powered by Google Gemini. The AI is advanced enough to write poetry
                                            or code. You can ask it any question such as science, physics, legal advice, ect...
                                            <br/>
                                            <Link href="/chat"><Button variant="contained">Click here to Chat with AI</Button></Link>
                                        </Typography>
                                        <br/>
                                        <div style={{width: 256, margin: '0 auto'}}>
                                            <Carousel autoplay showDots wrapMode="wrap">
                                                {
                                                    [{
                                                        url: '/mainImages/Chat1.png',
                                                    }, {
                                                        url: '/mainImages/Chat2.png',
                                                    }, {
                                                        url: '/mainImages/Chat3.png',
                                                    }].map(item => (
                                                        <ImageExpander key={item.url} src={item.url} alt={item.url}/>
                                                    ))
                                                }
                                            </Carousel>
                                        </div>
                                    </CardContent>
                                </Card>
                            </FadeIntoView>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FadeIntoView>
                                <Card>
                                    <ImageExpander src="/mainImages/ML-Demo1.png" alt="/mainImages/ML-Demo1.png"/>
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
                            </FadeIntoView>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FadeIntoView>
                                <Typography variant="h3" style={{textAlign:'center'}}>
                                    Job Experience
                                </Typography>
                            </FadeIntoView>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FadeIntoView>
                                <Card>
                                    <CardMedia component="img" src="/mainImages/SimBlocks.png"></CardMedia>
                                    <CardHeader title="SimBlocks.io" subheader="3D Terrain for Military Simulation">
                                    </CardHeader>
                                    <CardContent>
                                        <Typography variant="body1">
                                            I worked on the OpenFlight Importer for Unity, a product for SimBlocks.io in
                                            2017 from May to November. This is solid 3D and C# experience making primitives
                                            such as planes and boxes and cylinders. Unity has a way to dynamically create
                                            geometry and OpenFlight defines the geometry, it was a matter of converting a
                                            binary file into C# and then into Unity.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </FadeIntoView>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FadeIntoView>
                                <Card>
                                    <CardMedia component="img" src="/mainImages/CNHind.png"></CardMedia>
                                    <CardHeader title="Actalent | Case New Holland Part Number Tracker" subheader="A NodeJS MySQL React platform for tracking replaced by and obsolete parts for dealerships.">
                                    </CardHeader>
                                    <CardContent>
                                        <Typography variant="body1">
                                            This is an enterprise website running on the intranet for Case New Holland.
                                            They are a tractor company similar to John Deer. They have dealerships around
                                            the world and need to know which part number is replaced by or obsoleted so
                                            service technicians can order the correct part or assembly or wire harness
                                            to repair a tractor.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </FadeIntoView>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FadeIntoView>
                                <Card>
                                    <CardMedia component="img" src="/mainImages/FreedomCommunicationTechnologies.png"></CardMedia>
                                    <CardHeader title="Actalent | Freedom Communication Technologies R9000 Prototype" subheader="A NodeJS React ElectronJS GUI for a touch screen spectrum analyzer.">
                                    </CardHeader>
                                    <CardContent>
                                        <Typography variant="body1">
                                            GUI for a spectrum analyzer prototype. The hardware maybe simulated but the
                                            UI mocks every feature required such as FM/AM/QAM/Smith Chart/PSK. It comes
                                            in multiple languages such as English, Spanish, French, Italian and Chinese.
                                            This is a team effort by 2 developers, 1 English Major handling data entry and
                                            learning development, and 1 QA learning development with Selenium. I helped
                                            write the 2d charts and Unit Tests in Jest and Mocha. I also helped with the
                                            selenium making the tests pass with flying colors.
                                        </Typography>
                                        <Typography variant="body1">
                                            The rest of the team designed every button and dropdown and the color scheme
                                            for the website. They also wrote some Jest Tests and Mocha Tests.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </FadeIntoView>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FadeIntoView>
                                <Card>
                                    <CardMedia component="img" src="/mainImages/KCLCAD.png"></CardMedia>
                                    <CardHeader title="StatusQuote.com | KCLCAD.com" subheader="A WPF OpenGL AutoCAD DWG / MAUI WebView AFrameVR ThreeJS AutoCAD DWG Application">
                                    </CardHeader>
                                    <CardContent>
                                        <Typography variant="body1">
                                            I used my skills from the spectrum analyzer and SimBlocks.io to convert CAD DWG
                                            model specifications in C# to OpenGL. This allowed me to convert a bunch of AutoLISP
                                            to OpenGL 1.0 Graphics which worked great for the catalog of 250 custom furniture and equipment
                                            and 250k models in 2d and 3d. I learned that interior designers use layers or color coding
                                            to specify clearances between equipment such a swinging door or sliding drawer.
                                        </Typography>
                                        <Typography variant="body1">
                                            Later on I spent time learning WPF, Uno, WaveEngine, MAUI, ASP.Net Core, Net Framework
                                            Net Core, DLLs, WinService, WMI, ActiveX, ThreeJS, AframeVR and WebGL. This is to convert
                                            the Room Builder which I made, Custom Blocks which I helped convert from AutoLISP to C#,
                                            NapkinSketch (a free version of AutoCAD if you cannot afford $500.00 per year for AutoCAD Lite).
                                        </Typography>
                                        <Typography variant="body1">
                                            Kevin, the now retired business owner, handled the business development in acquiring the 200 Manufactures
                                            and their 250k models. Robert, the now retired StatusQuote President, acquired the AutoLISP for CustomBlocks
                                            and wrote must of the legacy code.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </FadeIntoView>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FadeIntoView>
                                <Typography variant="h3" style={{textAlign:'center'}}>
                                    About the Developer
                                </Typography>
                            </FadeIntoView>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FadeIntoView>
                                <Card>
                                    <CardMedia component="img" src="/mainImages/DevPhoto.png"></CardMedia>
                                    <CardHeader title="Tyler Truong" subheader="The Developer">
                                    </CardHeader>
                                    <CardContent>
                                        <Typography variant="body1">
                                            I hope this is a great resume project containing a mixture of 3d graphics,
                                            react front end, and basic material styling with a NodeJS backend. It's hosted
                                            on Google Cloud Run and Google Cloud SQL.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </FadeIntoView>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FadeIntoView>
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
                            </FadeIntoView>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FadeIntoView>
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
                            </FadeIntoView>
                        </Grid>
                    </Grid>
                </Container>
            }/>
        </Paper>
    );
}

export default Main;
