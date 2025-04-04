// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
import {initializeApp} from "firebase/app";
import {Analytics, getAnalytics} from "firebase/analytics";
import {getAuth} from "firebase/auth";
import {getVertexAI, getGenerativeModel} from "firebase/vertexai";

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
const app = initializeApp(firebaseConfig);
let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
    analytics = getAnalytics(app);
}
const auth = getAuth(app);
const vertexAI = getVertexAI(app);
const model = getGenerativeModel(vertexAI, { model: "gemini-2.0-flash" });

export { app, analytics, auth, model };
