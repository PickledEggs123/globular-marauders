import React, {useContext, useRef, useState} from "react";
import {
    AppBar, Box, Button, Container,
    Drawer, FormControl, FormControlLabel,
    Grid, IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText, Modal, Paper, Switch,
    Toolbar,
    Typography,
    TextField,
} from "@mui/material";
import {
    Domain, Google,
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
import {doSignInWIthGoogle, doSignOut} from "./contextes/auth/auth";
import {useAuth} from "./contextes/auth";

const drawerWidth = 180;

export const WebsiteDrawer2 = ({rightSide, content}: {
    rightSide: React.ReactNode | null,
    content: React.ReactNode,
}) => {
    const {userLoggedIn, currentUser} = useAuth();
    const {theme, toggleTheme} = useContext(ThemeContext);
    const ref = useRef<HTMLDivElement | null>(null);
    const [mobileOpen, setMobileOpen] = useState<boolean>(false);
    const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const toggleLoginModal = () => {
        setShowLoginModal(!showLoginModal);
    };

    const drawer = (
        <React.Fragment>
            <Button variant="contained" onClick={toggleLoginModal}>Login</Button>
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
            <Modal open={showLoginModal} onClose={toggleLoginModal} aria-labelledby="login screen" aria-describedby="A list of login providers">
                <Container>
                    <Paper sx={{margin: '24px 24px', textAlign: 'center'}}>
                        {
                            userLoggedIn ? (
                                <React.Fragment>
                                    <Typography variant="h3">Login Info</Typography>
                                    <Typography>Display Name: {currentUser?.displayName ?? "N/A"}</Typography>
                                    <Typography>Email: {currentUser?.email ?? "N/A"}</Typography>
                                    <Typography>Phone Number: {currentUser?.phoneNumber ?? "N/A"}</Typography>
                                    <Button variant="contained" onClick={doSignOut}>Sign Out</Button>
                                </React.Fragment>
                            ) : (
                                <React.Fragment>
                                    <Typography variant="h3">Login Types</Typography>
                                    <FormControl>
                                        <FormControlLabel control={<TextField/>} label="Email"></FormControlLabel>
                                        <FormControlLabel control={<TextField/>} label="Password"></FormControlLabel>
                                        <Button variant="contained">Sign In</Button>
                                        <Grid container>
                                            <Grid item xs={12} md={6}>
                                                <Typography>Sign In With Google</Typography>
                                            </Grid>
                                            <Grid item xs={12} md={6}>
                                                <IconButton onClick={doSignInWIthGoogle}><Google/></IconButton>
                                            </Grid>
                                        </Grid>
                                    </FormControl>
                                </React.Fragment>
                            )
                        }
                    </Paper>
                </Container>
            </Modal>
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
