"use client";

import {initializeAppCheck} from "firebase/app-check";
import {ReCaptchaEnterpriseProvider} from "@firebase/app-check";
import {app} from "../firebase/firebase";

export const reCaptchaEnterpriseProvider = new ReCaptchaEnterpriseProvider("6LfTgfctAAAAALpiBzfe2Bv14AlViARlDrEs5DOE");

let appCheck2;
if (typeof window !== "undefined" && typeof document !== "undefined") {
    appCheck2 = initializeAppCheck(app, {
        provider: reCaptchaEnterpriseProvider,
        isTokenAutoRefreshEnabled: true,
    });
}
export const appCheck = appCheck2;

