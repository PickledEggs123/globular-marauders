import {createTheme, responsiveFontSizes, ThemeOptions} from "@mui/material/styles";

const themeOptions: ThemeOptions = {
    palette: {
        mode: "light",
        primary: {
            main: "#b92",
        },
        secondary: {
            main: "#ac2",
        },
        error: {
            main: "#e11",
        },
        warning: {
            main: "#dd2",
        },
        info: {
            main: "#49e",
        },
        success: {
            main: "#2c2",
        },
        divider: "rgba(0,0,0,0.67)",
        background: {
            default: "#ebb",
            paper: "#dcc",
        },
    },
    typography: {
        h1: {
            fontFamily: `"Tangerine", cursive, "Helvetica", "Arial", sans-serif`,
            fontWeightRegular: 900,
            background: "#ddc",
        },
        h2: {
            fontFamily: `"Tangerine", cursive, "Helvetica", "Arial", sans-serif`,
            fontWeightRegular: 900,
            background: "#ddc",
        },
        h3: {
            fontFamily: `"Tangerine", cursive, "Helvetica", "Arial", sans-serif`,
            fontWeightRegular: 900,
            background: "#ddc",
        },
        h4: {
            fontFamily: `"Tangerine", cursive, "Helvetica", "Arial", sans-serif`,
            fontWeightRegular: 900,
            background: "#ddc",
        },
        h5: {
            fontFamily: `"Tangerine", cursive, "Helvetica", "Arial", sans-serif`,
            fontWeightRegular: 900,
            background: "#ddc",
        },
        h6: {
            fontFamily: `"Tangerine", cursive, "Helvetica", "Arial", sans-serif`,
            fontWeightRegular: 900,
            background: "#ddc",
        },
        body1: {
            background: "#ddc",
        },
    },
    components: {
        MuiCard: {
            defaultProps: {
                raised: true,
                translate: "yes",
            },
        },
        MuiContainer: {
            defaultProps: {
                style: {
                    background: "transparent",
                },
            },
        },
        MuiGrid: {
            defaultProps: {
                style: {
                    background: "transparent",
                },
                gap: 16,
            },
        },
        MuiPaper: {
            defaultProps: {
                style: {
                    backgroundColor: "transparent !important",
                },
            },
        },
    },
};

const themeOptionsDark = createTheme({
    palette: {
        mode: 'dark',
    },
    components: {
        MuiCard: {
            defaultProps: {
                raised: true,
            },
        },
        MuiContainer: {
            defaultProps: {
                style: {
                    background: "transparent",
                },
            },
        },
        MuiGrid: {
            defaultProps: {
                style: {
                    background: "transparent",
                },
                gap: 16,
            },
        },
        MuiPaper: {
            defaultProps: {
                style: {
                    backgroundColor: "transparent !important",
                },
            },
        },
    },
});

let themeTemp = createTheme(themeOptions);
themeTemp = responsiveFontSizes(themeTemp, {
    variants: ["h1", "h2", "h3", "h4", "h5", "h6"]
});
export const theme = themeTemp;

let themeTempDark = createTheme(themeOptionsDark);
themeTempDark = responsiveFontSizes(themeTempDark, {
    variants: ["h1", "h2", "h3", "h4", "h5", "h6"]
});
export const darkTheme2 = themeTempDark;