import React, {useEffect, useRef} from "react";
import { ReactComponent as MobileGameUiBottomSvg } from "../icons/ui/mobileGameUiBottom.svg";

export const RenderMobileGameUiBottom = (props: {bannerBottomHeight: number, width: number}) => {
    const svgRef = useRef<SVGSVGElement | null>(null);

    useEffect(() => {
        svgRef.current?.setAttribute("viewBox", `0 0 1000 ${Math.min(1000, props.bannerBottomHeight * 2)}`);
    }, [svgRef.current, props.bannerBottomHeight, props.width]);

    return (
        <MobileGameUiBottomSvg ref={svgRef} width={props.width} height={props.bannerBottomHeight} style={{position: "absolute", zIndex: 0}}/>
    );
};