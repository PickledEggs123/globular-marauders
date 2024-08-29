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
            default: "#eed",
            paper: "#ddc",
        },
    },
    typography: {
        h1: {
            fontFamily: `"Tangerine", cursive, "Helvetica", "Arial", sans-serif`,
            fontWeightRegular: 900,
        },
        h2: {
            fontFamily: `"Tangerine", cursive, "Helvetica", "Arial", sans-serif`,
            fontWeightRegular: 900,
        },
        h3: {
            fontFamily: `"Tangerine", cursive, "Helvetica", "Arial", sans-serif`,
            fontWeightRegular: 900,
        },
        h4: {
            fontFamily: `"Tangerine", cursive, "Helvetica", "Arial", sans-serif`,
            fontWeightRegular: 900,
        },
        h5: {
            fontFamily: `"Tangerine", cursive, "Helvetica", "Arial", sans-serif`,
            fontWeightRegular: 900,
        },
        h6: {
            fontFamily: `"Tangerine", cursive, "Helvetica", "Arial", sans-serif`,
            fontWeightRegular: 900,
        },
    },
    components: {
        MuiCard: {
            defaultProps: {
                raised: true,
            },
        },
    },
};

let themeTemp = createTheme(themeOptions);
themeTemp = responsiveFontSizes(themeTemp, {
    variants: ["h1", "h2", "h3", "h4", "h5", "h6"]
});
export const theme = themeTemp;