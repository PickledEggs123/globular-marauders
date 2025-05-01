import React, {useContext, useRef, useState} from "react";
import {
    AppBar, Button, Container,
    Drawer, FormControl, FormControlLabel,
    Grid, IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText, Modal, Paper, Switch,
    Toolbar,
    Typography,
    TextField, Tabs, Tab, InputAdornment
} from "@mui/material";
import {
    Chat,
    Domain, Email, Google,
    Menu,
    MenuOpen, Password,
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
import {
    doCreateUserWithEmailAndPassword,
    doSignInWithEmailAndPassword,
    doSignInWIthGoogle,
    doSignOut
} from "./contextes/auth/auth";
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
    const [tabValue, setTabValue] = useState(0);
    const [email, setEmail] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const toggleLoginModal = () => {
        setShowLoginModal(!showLoginModal);
    };

    const handleTabChange = (event: React.SyntheticEvent, tab: number) => {
        setTabValue(tab);
    };

    const emailAccountSubmit = async (event: React.SyntheticEvent) => {
        event.preventDefault();

        switch (tabValue) {
            case 0: {
                await doSignInWithEmailAndPassword(email, currentPassword);
                break;
            }
            case 1: {
                await doCreateUserWithEmailAndPassword(email, newPassword);
                break;
            }
        }
    };

    const drawer = (
        <React.Fragment>
            <Button variant="contained" onClick={toggleLoginModal}>{userLoggedIn ? "Logout" : "Login"}</Button>
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
                    link: "/chat",
                    icon: <Chat/>,
                    text: "Chat"
                }, {
                    link: "/3d",
                    icon: <Public/>,
                    text: "Play 3D"
                }, {
                    link: "/2d",
                    icon: <PlayArrow/>,
                    text: "Play 2D"
                }, {
                    link: "/game-model",
                    icon: <PieChart/>,
                    text: "Game Model"
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
                                    <Tabs centered
                                        variant="fullWidth"
                                        value={tabValue}
                                        onChange={handleTabChange}
                                    >
                                        <Tab label="Sign In" />
                                        <Tab label="Create Account" />
                                    </Tabs>
                                    <form onSubmit={emailAccountSubmit}>
                                        <TextField value={email} onChange={(event) => setEmail(event.target.value)} name="email" label="Email" variant="outlined" margin="normal" fullWidth type="email" autoComplete="email" InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start"><Email/></InputAdornment>
                                            )
                                        }} />
                                        {
                                            tabValue === 0 ? (
                                                <React.Fragment key={0}>
                                                    <TextField value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} name="password" label="Password" variant="outlined" margin="normal" fullWidth type="password" autoComplete="current-password" InputProps={{
                                                        startAdornment: (
                                                            <InputAdornment position="start"><Password/></InputAdornment>
                                                        )
                                                    }} />
                                                    <Button type="submit" variant="contained">Sign In With Email</Button>
                                                </React.Fragment>
                                            ) : (
                                                <React.Fragment key={1}>
                                                    <TextField value={newPassword} onChange={(event) => setNewPassword(event.target.value)} name="password" label="New Password" variant="outlined" margin="normal" fullWidth type="password" autoComplete="new-password" InputProps={{
                                                        startAdornment: (
                                                            <InputAdornment position="start"><Password/></InputAdornment>
                                                        )
                                                    }} />
                                                    <Button type="submit" variant="contained">Create Email Account</Button>
                                                </React.Fragment>
                                            )
                                        }
                                    </form>
                                    <Grid container>
                                        <Grid item xs={12} md={6}>
                                            <Typography>Sign In With Google</Typography>
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <IconButton onClick={doSignInWIthGoogle}><Google/></IconButton>
                                        </Grid>
                                    </Grid>
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
            <Paper style={{display: 'flex', flexDirection: 'column'}}  sx={{ marginLeft: { xs: 0, md: drawerWidth / 8}, padding: '20px', display: 'flex', marginTop: (ref.current?.getBoundingClientRect().height ?? 40) / 8, height: `calc(100vh - ${ref.current?.getBoundingClientRect().height ?? 40}px)` }}>
                {content}
            </Paper>
        </div>
    );
};
