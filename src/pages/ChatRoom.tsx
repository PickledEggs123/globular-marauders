import React, {ChangeEvent, useState} from "react";
import {Avatar, Box, Button, Container, InputAdornment, Paper, Skeleton, TextField, Tooltip, Typography} from "@mui/material";
import {useAuth} from "../contextes/auth";
import { WebsiteDrawer2 } from "../Drawer";
import {model} from "../firebase/firebase";

interface IChatMessage {
    sender: boolean;
    name: string | undefined;
    photoURL: string | undefined;
    message: string;
}

const ChatBubble = (props: IChatMessage) => {
    return (
        <Box sx={{background: props.sender ? '#cdf' : '#fff', padding: 1, margin: '8px 0px', borderRadius: 1, display: 'flex', flexDirection: props.sender ? 'row-reverse' : 'row', justifyContent: 'space-between'}}>
            <Tooltip title={props.name}>
                <Avatar sx={{width: 24, height: 24}} srcSet={props.photoURL} />
            </Tooltip>
            <Typography>{props.message}</Typography>
        </Box>
    );
};

export const ChatRoom = () => {
    const {userLoggedIn, currentUser} = useAuth();
    const [chatValue, setChatValue] = useState("");
    const [chatHistory, setChatHistory] = useState<IChatMessage[]>([]);
    const [chatDisabled, setChatDisabled] = useState<boolean>(false);
    const [context] = useState({
        chat: model.startChat({})
    });

    const handleChatChange = (event: ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();
        setChatValue(event.target.value);
    }

    const handleSendChat = async (e: React.SyntheticEvent) => {
        e.preventDefault();

        try {
            const msg = chatValue;
            setChatValue("");
            setChatDisabled(true);
            setChatHistory([
                ...chatHistory,
                {
                    sender: true,
                    name: currentUser?.displayName ?? undefined,
                    message: msg,
                    photoURL: currentUser?.photoURL ?? undefined,
                },
            ]);
            const res = await context.chat.sendMessageStream(msg);
            let text = '';
            for await (const chunk of res.stream) {
                const chunkText = chunk.text();
                text += chunkText;
                setChatHistory([
                    ...chatHistory,
                    {
                        sender: true,
                        name: currentUser?.displayName ?? undefined,
                        message: msg,
                        photoURL: currentUser?.photoURL ?? undefined,
                    },
                    {
                        sender: false,
                        name: "Gemini",
                        message: text,
                        photoURL: undefined,
                    },
                ]);
            }
        } finally {
            setChatDisabled(false);
        }
    };

    const chatRoom = userLoggedIn ? (
        <Paper sx={{padding: 2, mt: 2}}>
            {
                chatHistory.map((v, i) => {
                    return <ChatBubble
                        key={i}
                        sender={v.sender}
                        name={v.name}
                        message={v.message}
                        photoURL={v.photoURL}
                    />;
                })
            }
            <TextField value={chatValue} disabled={chatDisabled} onChange={handleChatChange} label="Chat" fullWidth sx={{paddingTop: 1}} InputProps={{
                startAdornment: (
                    <InputAdornment position="start">
                        <Tooltip title={currentUser?.displayName ?? undefined}>
                            <Avatar sx={{width: 24, height: 24}} srcSet={currentUser?.photoURL ?? undefined}/>
                        </Tooltip>
                    </InputAdornment>
                )
            }}></TextField>
            <Button fullWidth variant="contained" disabled={chatDisabled} onClick={handleSendChat}>Send</Button>
        </Paper>
    ) : (
        <Paper sx={{padding: 2, mt: 2}}>
            <Skeleton width="100%" height="10vh" />
            <Skeleton width="100%" height="10vh" />
            <Skeleton width="100%" height="10vh" />
            <TextField label="Chat" fullWidth disabled sx={{paddingTop: 1}}></TextField>
            <Typography>Please Login</Typography>
        </Paper>
    );

    return (
        <Paper style={{width: "100%", minHeight: "100vh", height: "fit-content", display: "flex", flexDirection: "column"}}>
            <WebsiteDrawer2 rightSide={null} content={
                <Container>
                    {chatRoom}
                </Container>
            }/>
        </Paper>
    )
};
