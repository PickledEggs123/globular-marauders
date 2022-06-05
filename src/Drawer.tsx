import React, {useState} from "react";
import {AppBar, Button, Drawer, List, ListItem, ListItemIcon, ListItemText, Toolbar, Typography} from "@mui/material";
import {Person, PieChart, PlayArrow, Public, QuestionMark} from "@mui/icons-material";
import PixiGame from "./PixiGame";
import {Link} from "react-router-dom";

export const WebsiteDrawer = ({rightSide}: {
    rightSide: React.ReactElement | null
}) => {
    const [open, setOpen] = useState<boolean>(false);
    const toggle = () => {
        setOpen(!open);
    };

    return (
        <React.Fragment>
            <AppBar className="AppBar">
                <Toolbar>
                    <Button
                        color="secondary"
                        aria-label="Menu" variant="contained"
                        onKeyDown={PixiGame.cancelSpacebar.bind(this)}
                        onClick={toggle}
                    >
                        <Typography>Home</Typography>
                    </Button>
                    <Typography variant="h1" color="inherit" style={{flexGrow: 1}} textAlign="center">
                        Globular Marauders
                    </Typography>
                    {rightSide}
                </Toolbar>
            </AppBar>
            <Drawer anchor="left" open={open} onClose={toggle}>
                <List>
                    <Link to="/">
                        <ListItem>
                            <ListItemIcon>
                                <PlayArrow/>
                            </ListItemIcon>
                            <ListItemText>Play</ListItemText>
                        </ListItem>
                    </Link>
                    <Link to="/game-model">
                        <ListItem>
                            <ListItemIcon>
                                <PieChart/>
                            </ListItemIcon>
                            <ListItemText>Game Model</ListItemText>
                        </ListItem>
                    </Link>
                    <Link to="/planet-generator">
                        <ListItem>
                            <ListItemIcon>
                                <Public/>
                            </ListItemIcon>
                            <ListItemText>Planet Generator</ListItemText>
                        </ListItem>
                    </Link>
                    <Link to="/about">
                        <ListItem>
                            <ListItemIcon>
                                <QuestionMark/>
                            </ListItemIcon>
                            <ListItemText>About</ListItemText>
                        </ListItem>
                    </Link>
                    <Link to="/contact">
                        <ListItem>
                            <ListItemIcon>
                                <Person/>
                            </ListItemIcon>
                            <ListItemText>Contact</ListItemText>
                        </ListItem>
                    </Link>
                </List>
            </Drawer>
        </React.Fragment>
    );
};
