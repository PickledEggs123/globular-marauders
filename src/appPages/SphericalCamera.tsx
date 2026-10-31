'use client';

import React from 'react';
import '../App.scss';
import {WebsiteDrawer2} from "../Drawer";
import {
    Card,
    CardContent,
    CardHeader,
    Container,
    Grid,
    Paper,
    Typography
} from "@mui/material";
import {createStyles, makeStyles} from "@mui/styles";


const useStyles = makeStyles((theme) =>
    createStyles({
        responsiveIframe: {
            width: "100%",
            aspectRatio: "1 / 1",
            border: "none",
            margin: 0,
            padding: 0,
        }
    })
);

export const SphericalCamera = () => {
    const classes = useStyles();

    return (
        <Paper style={{width: "100%", minHeight: "100vh", height: "fit-content", display: "flex", flexDirection: "column"}}>
            <WebsiteDrawer2 rightSide={
                null
            } content={
                <Container>
                    <Typography variant="h3">
                        Procedural Planet Generator
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Card>
                                <CardHeader title="Spherical Camera" subheader="Move around the sphere without polar lock or gimbal lock"></CardHeader>
                                <CardContent>
                                    {/* @ts-ignore */}
                                    <iframe title="3d game" className={classes.responsiveIframe} allowFullScreen="yes"
                                            allowvr="yes"
                                            src="/spherical-fps-controller-demo.html"/>
                                    <br/>
                                    <Typography variant="body1">
                                        Move around a sphere without polar lock or gimbal lock, thanks to matrix make basis.
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

export default SphericalCamera;
