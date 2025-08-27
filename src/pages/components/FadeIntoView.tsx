import React, {useEffect} from "react";
import {Fade} from "@mui/material";

export const FadeIntoView = ({children}: { children: React.ReactElement }) => {
    const [fadeIn, setFadeIn] = React.useState(false);
    const ref = React.useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const interval = setInterval(() => {
            const maxY = window.innerHeight;

            const m1 = ref.current?.getBoundingClientRect()?.top || 0;
            const m2 = ref.current?.getBoundingClientRect()?.bottom || 0;

            setFadeIn((m1 >= 0 && m1 <= maxY) || (m2 <= maxY && m2 >= 0));
        }, 1000);
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