import React, {useState} from 'react';
import {Container, Modal, Paper, Typography} from "@mui/material";

export const ImageExpander = ({src, alt}: {src: string, alt: string}) => {
    const [open, setOpen] = useState(false);
    return (
        open ? (
            <Modal open={true} onClose={() => setOpen(false)} style={{width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column"}}>
                <Container>
                    <Paper>
                        <Typography variant="h3">Image Expanded</Typography>
                    </Paper>
                    <img src={src} alt={alt} onClick={() => setOpen(false)} style={{width: "100%", aspectRatio: "1/1"}}/>
                </Container>
            </Modal>
        ) : (
            <img src={src} alt={alt} onClick={() => setOpen(true)} style={{width: "100%", aspectRatio: "1/1"}}/>
        )
    )
};
