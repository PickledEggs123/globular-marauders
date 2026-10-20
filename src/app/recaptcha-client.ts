"use client";

import {initializeAppCheck} from "firebase/app-check";
import {ReCaptchaEnterpriseProvider} from "@firebase/app-check";
import {app} from "../firebase/firebase";

export const reCaptchaEnterpriseProvider = new ReCaptchaEnterpriseProvider("6LfTgfctAAAAACxKTzZAKBuFKkUPlYDdVCzy69sy");

if (window.location.hostname === "localhost") {
// @ts-ignore
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

export const appCheck= initializeAppCheck(app, {
    provider: reCaptchaEnterpriseProvider,
    isTokenAutoRefreshEnabled: true,
});
