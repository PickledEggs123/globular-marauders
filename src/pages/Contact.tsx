import React from 'react';
import '../App.css';
import {WebsiteDrawer} from "../Drawer";
import {Card, CardContent, CardHeader, Grid, Typography} from "@mui/material";

export const Contact = () => {
    return (
        <div className="App">
            <WebsiteDrawer rightSide={null}/>
            <Grid container xs={12} spacing={2}>
                <Grid item xs={12}>
                    <Card>
                        <CardHeader title="GitHub">
                        </CardHeader>
                        <CardContent>
                            <Typography variant="body1">
                                <a href="https://github.com/PickledEggs123">I can be contacted via the GitHub page which contains the source code used to make this project.</a>
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </div>
    );
}
