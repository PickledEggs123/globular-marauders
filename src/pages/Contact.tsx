import React from 'react';
import '../App.scss';
import {WebsiteDrawer2} from "../Drawer";
import {Paper, Card, CardContent, CardHeader, Container, Grid, Typography, CardMedia} from "@mui/material";

export const Contact = () => {
    return (
        <Paper style={{width: "100%", minHeight: "100vh", height: "fit-content", display: "flex", flexDirection: "column"}}>
            <WebsiteDrawer2 rightSide={null} content={
                <Container>
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
