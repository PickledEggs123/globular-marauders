import React, {useContext, useState} from "react";
import {
    AppBar, Box,
    Drawer, FormControl, FormControlLabel,
    Grid, IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText, Switch,
    Toolbar,
    Typography
} from "@mui/material";
import {
    Domain,
    Menu,
    MenuOpen,
    People,
    Person,
    PieChart,
    PlayArrow,
    Public,
    QuestionMark,
    Sailing
} from "@mui/icons-material";
import PixiGame from "./pages/PixiGame";
import {Link} from "react-router-dom";
import {ThemeContext} from "./contextes/ThemeContext";

const drawerWidth = 180;

export const WebsiteDrawer2 = ({rightSide, content}: {
    rightSide: React.ReactNode | null,
    content: React.ReactNode,
}) => {
    const {theme, toggleTheme} = useContext(ThemeContext);
    const ref = React.useRef<HTMLDivElement | null>(null);
    const [mobileOpen, setMobileOpen] = React.useState(false);

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const drawer = (
        <React.Fragment>
            <FormControl>
                <FormControlLabel
                    control={
                        <Switch
                            onClick={toggleTheme}
                            checked={theme.palette.mode === 'dark'}
                            onKeyDown={PixiGame.cancelSpacebar.bind(this)}
                        />
                    }
                    label="Toggle Theme"
                ></FormControlLabel>
            </FormControl>
            <List>
                {[{
                    link: "/",
                    icon: <Domain/>,
                    text: "Main"
                }, {
                    link: "/2d-game",
                    icon: <PlayArrow/>,
                    text: "Play 2D"
                }, {
                    link: "/game-model",
                    icon: <PieChart/>,
                    text: "Game Model"
                }, {
                    link: "/planet-generator",
                    icon: <Public/>,
                    text: "Planet Generator"
                }, {
                    link: "/ship-wiki",
                    icon: <Sailing/>,
                    text: "Ship Wiki"
                }, {
                    link: "/character-wiki",
                    icon: <People/>,
                    text: "Character Wiki"
                }, {
                    link: "/about",
                    icon: <QuestionMark/>,
                    text: "About"
                }, {
                    link: "/contact",
                    icon: <Person/>,
                    text: "Contact"
                }].map(({link, icon, text}) => (
                    <Link key={link} to={link} style={{textDecoration: "none", boxShadow: "none"}}>
                        <ListItem>
                            <ListItemIcon>
                                {icon}
                            </ListItemIcon>
                            <ListItemText><Typography variant="h6">{text}</Typography></ListItemText>
                        </ListItem>
                    </Link>
                ))}
            </List>
        </React.Fragment>
    );

    return (
        <div>
            <AppBar position="fixed" ref={ref}>
                <Toolbar>
                    <Grid container>
                        <Grid item xs={12} lg={6} display="flex">
                            <IconButton
                                aria-label="Menu"
                                onKeyDown={PixiGame.cancelSpacebar.bind(this)}
                                onClick={handleDrawerToggle}
                                sx={{ mr: 2, display: { md: 'none' } }}
                            >
                                {mobileOpen ? <MenuOpen/> : <Menu/>}
                            </IconButton>
                            <Typography variant="h4" color="inherit" component="div" sx={{ marginLeft: { xs: 0, sm: drawerWidth / 8} }} style={{flexGrow: 1}} textAlign="center">
                                Globular Marauders
                            </Typography>
                        </Grid>
                        <Grid item xs={12} lg={6} display="flex" flexDirection="row-reverse">
                            {rightSide}
                        </Grid>
                    </Grid>
                </Toolbar>
            </AppBar>
            <nav>
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{
                        keepMounted: true, // Better open performance on mobile.
                    }}
                    sx={{
                        display: { xs: 'block', md: 'none' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                >
                    {drawer}
                </Drawer>
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', md: 'block' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                    open
                >
                    {drawer}
                </Drawer>
            </nav>
            <Box sx={{ marginLeft: { xs: 0, md: drawerWidth / 8}, padding: '20px', display: 'flex', marginTop: (ref.current?.getBoundingClientRect().height ?? 40) / 8, height: `calc(100vh - ${ref.current?.getBoundingClientRect().height ?? 40}px)` }}>
                {content}
            </Box>
        </div>
    );
}

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
                                {open ? <MenuOpen/> : <Menu/>}
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
                        icon: <Domain/>,
                        text: "Main"
                    }, {
                        link: "/2d-game",
                        icon: <PlayArrow/>,
                        text: "Play 2D"
                    }, {
                        link: "/game-model",
                        icon: <PieChart/>,
                        text: "Game Model"
                    }, {
                        link: "/planet-generator",
                        icon: <Public/>,
                        text: "Planet Generator"
                    }, {
                        link: "/ship-wiki",
                        icon: <Sailing/>,
                        text: "Ship Wiki"
                    }, {
                        link: "/character-wiki",
                        icon: <People/>,
                        text: "Character Wiki"
                    }, {
                        link: "/about",
                        icon: <QuestionMark/>,
                        text: "About"
                    }, {
                        link: "/contact",
                        icon: <Person/>,
                        text: "Contact"
                    }].map(({link, icon, text}) => (
                        <Link key={link} to={link} style={{textDecoration: "none", boxShadow: "none"}}>
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
