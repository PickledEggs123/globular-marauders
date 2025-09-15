import React from "react";

export const SSRLoadingScreen = ({children}: { children: React.ReactNode }) => {
    // @ts-ignore
    if (global.use_ssr) {
        return (
            <React.Fragment>
                <div style={{
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'fixed',
                }}>
                    <h1>Loading...</h1>
                </div>
                {children}
            </React.Fragment>
        )
    } else {
        return children;
    }
}
