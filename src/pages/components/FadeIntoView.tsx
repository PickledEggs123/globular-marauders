import React, {useEffect} from "react";
import {Fade} from "@mui/material";

export const FadeIntoView = ({children}: { children: React.ReactElement }) => {
    const [fadeIn, setFadeIn] = React.useState(false);
    const ref = React.useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const interval = setInterval(() => {
            const maxY = window.innerHeight || document.documentElement.clientHeight;

            const m1 = ref.current?.getBoundingClientRect()?.top || NaN;
            const m2 = ref.current?.getBoundingClientRect()?.bottom || NaN;
            const height = ref.current?.getBoundingClientRect()?.height || NaN;

            setFadeIn(m1 + height * 0.75 >= 0 && m2 - height * 0.75 <= maxY);
        }, 50);
        return () => {
            clearInterval(interval);
        }
    }, []);

    return (
        <Fade ref={ref} translate={"yes"} in={fadeIn}>
            {children}
        </Fade>
    )
}