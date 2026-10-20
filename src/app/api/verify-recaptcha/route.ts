import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const { token } = await req.json();
    const response = await fetch(
        `https://www.google.com/recaptcha/api/siteverify?secret=6LewlvgtAAAAALEjOEEs0nqfvj3Vh_ybzdSvhTYs&response=${token}`
    );
    const data = await response.json();
    if (data.success) {
        return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false });
}
