import { NextRequest, NextResponse } from "next/server";
import {createAssessment} from "../../recaptcha";

export async function POST(req: NextRequest) {
    const { token, action } = await req.json();
    const data = await createAssessment({
        token,
        recaptchaAction: action,
    });
    // @ts-ignore
    if (data && data.riskAnalysis.score >= 0.5) {
        return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false });
}
