"use client";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
import {Analytics, getAnalytics} from "firebase/analytics";
import {getAI, getGenerativeModel, VertexAIBackend } from "firebase/vertexai";
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import {ReCaptchaEnterpriseProvider} from "@firebase/app-check";
import {initializeAppCheck} from "firebase/app-check";

const firebaseConfig = {
    apiKey: "AIzaSyDaEhI8P6kcHnJN3mGcDtvi-a0ICMDl2a4",
    authDomain: "tyler-truong-demos.firebaseapp.com",
    databaseURL: "https://tyler-truong-demos.firebaseio.com",
    projectId: "tyler-truong-demos",
    storageBucket: "tyler-truong-demos.firebasestorage.app",
    messagingSenderId: "718992339134",
    appId: "1:718992339134:web:2979f0faa1bd18491b2eef",
    measurementId: "G-3LX0SX33N5"
};


// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];


const reCaptchaEnterpriseProvider = new ReCaptchaEnterpriseProvider("6LfTgfctAAAAACxKTzZAKBuFKkUPlYDdVCzy69sy");

const appCheck= initializeAppCheck(app, {
    provider: reCaptchaEnterpriseProvider,
    isTokenAutoRefreshEnabled: true,
});

let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
    analytics = getAnalytics(app);
}
const auth = getAuth(app);

const ai = getAI(app, { backend: new VertexAIBackend() });
const model = getGenerativeModel(ai, { model: "gemini-3.8-flash" });

export { app, analytics, auth, model, ai };

