import React, {useEffect, useRef} from "react";
import { ReactComponent as MobileGameUiTopSvg } from "../icons/ui/mobileGameUiTop.svg";

export const RenderMobileGameUiTop = (props: {bannerTopHeight: number, width: number}) => {
    const svgRef = useRef<SVGSVGElement | null>(null);

    useEffect(() => {
        svgRef.current?.setAttribute("viewBox", `0 ${1000 - Math.min(1000, props.bannerTopHeight * 2)} 1000 ${Math.min(1000, props.bannerTopHeight * 2)}`);
    }, [svgRef.current, props.bannerTopHeight, props.width]);

    return (
        <MobileGameUiTopSvg ref={svgRef} width={props.width} height={props.bannerTopHeight} style={{position: "absolute", zIndex: 0}}/>
    );
};