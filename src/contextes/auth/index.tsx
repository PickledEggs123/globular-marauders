import React, {useContext, useEffect, useState} from "react";
import {auth} from "../../firebase/firebase";
import {onAuthStateChanged, User} from "firebase/auth";

const AuthContext = React.createContext<{
    currentUser: User | null,
    userLoggedIn: boolean,
    loading: boolean,
}>({
    currentUser: null,
    userLoggedIn: false,
    loading: true
});

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: {children: React.ReactNode[] | React.ReactNode}) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userLoggedIn, setUserLoggedIn] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        return onAuthStateChanged(auth, initializeUser);
    }, []);

    async function initializeUser(user: User | null) {
        if (user) {
            setCurrentUser({...user});
            setUserLoggedIn(true);
        } else {
            setCurrentUser(null);
            setUserLoggedIn(false);
        }
        setLoading(false);
    }

    const value = {
        currentUser,
        userLoggedIn,
        loading,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}
