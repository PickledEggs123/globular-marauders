// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
import {initializeApp} from "firebase/app";
import {getAuth} from "firebase/auth";

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
const auth = getAuth(app);

export { app, auth };
