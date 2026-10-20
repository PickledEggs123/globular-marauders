"use client";

import {auth} from "../../firebase/firebase";
import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    GoogleAuthProvider
} from "firebase/auth";

const googleProvider = new GoogleAuthProvider();

export const doCreateUserWithEmailAndPassword = async (email: string, password: string) => {
    return createUserWithEmailAndPassword(auth, email, password);
};

export const doSignInWithEmailAndPassword = async (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
}

export const doSignInWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        console.log("Successfully logged in:", result.user);
    } catch (error) {
        // @ts-ignore
        console.error("Login failed:", error.message);
    }
};

export const doSignOut = async () => {
    try {
        await signOut(auth);
        console.log("Logged out successfully");
    } catch (error) {
        // @ts-ignore
        console.error("Logout failed:", error.message);
    }
};

export const doPasswordReset = async (email: string) => {
    return sendPasswordResetEmail(auth, email);
};

export const doSendEmailVerification = async () => {
    if (auth.currentUser) {
        return sendEmailVerification(auth.currentUser, {
            url: `${window.location.origin}/`,
        });
    }
};
