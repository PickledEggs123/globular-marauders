import {createTheme, ThemeProvider, CssBaseline, Theme} from '@mui/material';
import React, { FC, ReactNode, createContext } from 'react';
import {theme} from "../theme";

export const lightTheme = theme;

export const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
});

interface ThemeConfigProps {
    children: ReactNode;
}

export const ThemeContext = createContext<{
    theme: Theme,
    toggleTheme: () => void,
}>({
    theme: lightTheme,
    toggleTheme: () => undefined,
});

export const ThemeConfig: FC<ThemeConfigProps> = ({ children }) => {
    const [theme, setTheme] = React.useState(lightTheme);

    React.useEffect(() => {
        const savedTheme = sessionStorage.getItem('theme');
        if (savedTheme === 'dark') {
            setTheme(darkTheme);
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === lightTheme ? darkTheme : lightTheme;
        setTheme(newTheme);
        sessionStorage.setItem('theme', newTheme.palette.mode);
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <ThemeContext.Provider value={{theme, toggleTheme}}>
                {children}
            </ThemeContext.Provider>
        </ThemeProvider>
    );
};
