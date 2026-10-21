import { NextRequest, NextResponse } from "next/server";
import {createAssessment} from "../../recaptcha";

export async function POST(req: NextRequest) {
    try {
        const { token, action } = await req.json();
        const data = await createAssessment({
            token,
            recaptchaAction: action,
        });
        // @ts-ignore
        if (typeof data === "number" && data >= 0.5) {
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ success: false });
    } catch (error) {
        // @ts-ignore
        return NextResponse.json({ success: false, error: error?.message ?? error });
    }
}
