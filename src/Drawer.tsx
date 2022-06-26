import React, {useState} from "react";
import {
    AppBar,
    Button,
    Drawer,
    Grid, IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Typography
} from "@mui/material";
import {Home, Person, PieChart, PlayArrow, Public, QuestionMark} from "@mui/icons-material";
import PixiGame from "./pages/PixiGame";
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
                    <Grid container columns={{
                        xs: 6,
                        lg: 12
                    }}>
                        <Grid item xs={6} display="flex">
                            <IconButton
                                aria-label="Menu"
                                onKeyDown={PixiGame.cancelSpacebar.bind(this)}
                                onClick={toggle}
                            >
                                <Home/>
                            </IconButton>
                            <Typography variant="h4" color="inherit" style={{flexGrow: 1}} textAlign="center">
                                Globular Marauders
                            </Typography>
                        </Grid>
                        <Grid item xs={6} display="flex" flexDirection="row-reverse">
                            {rightSide}
                        </Grid>
                    </Grid>
                </Toolbar>
            </AppBar>
            <Drawer anchor="left" open={open} onClose={toggle}>
                <List>
                    {[{
                        link: "/",
                        icon: <PlayArrow/>,
                        text: "Play"
                    }, {
                        link: "/game-model",
                        icon: <PieChart/>,
                        text: "Game Model"
                    }, {
                        link: "/planet-generator",
                        icon: <Public/>,
                        text: "Planet Generator"
                    }, {
                        link: "/about",
                        icon: <QuestionMark/>,
                        text: "About"
                    }, {
                        link: "/contact",
                        icon: <Person/>,
                        text: "Contact"
                    }].map(({link, icon, text}) => (
                        <Link to={link} style={{textDecoration: "none", boxShadow: "none"}}>
                            <ListItem>
                                <ListItemIcon>
                                    {icon}
                                </ListItemIcon>
                                <ListItemText><Typography variant="h6">{text}</Typography></ListItemText>
                            </ListItem>
                        </Link>
                    ))}
                </List>
            </Drawer>
        </React.Fragment>
    );
};
