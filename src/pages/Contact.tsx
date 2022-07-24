import React from 'react';
import '../App.scss';
import {WebsiteDrawer} from "../Drawer";
import {Card, CardContent, CardHeader, Container, Grid, Typography} from "@mui/material";

export const Contact = () => {
    return (
        <div className="App">
            <WebsiteDrawer rightSide={null}/>
            <Container>
                <Typography variant="h3">
                    About the Developer
                </Typography>
                <Grid container xs={12} spacing={2}>
                    <Grid item xs={12}>
                        <Card>
                            <CardHeader title="GitHub" subheader="The code to make the game">
                            </CardHeader>
                            <CardContent>
                                <Typography variant="body1">
                                    <a href="https://github.com/PickledEggs123">I can be contacted via the GitHub page which contains the source code used to make this project.</a>
                                    Notice that the code might not be posted because of possible authentication token leaks. Once I fix the authentication token leak, I'll repost the code. This is
                                    probably for the better since the command line commands you must execute and accounts you must create to run this code is not documented.
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Container>
        </div>
    );
}
