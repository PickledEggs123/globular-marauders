import React, {useState} from 'react';
import '../App.scss';
import {WebsiteDrawer} from "../Drawer";
import {
    Paper,
    Avatar,
    Card,
    CardActionArea,
    CardContent,
    CardHeader,
    Container,
    Grid,
    Typography, Box, CardMedia
} from "@mui/material";
import {
    ERaceData,
    GameFactionData,
    IClassData,
    IRaceData
} from "@pickledeggs123/globular-marauders-game/lib/src/EFaction";
import {CHARACTER_TYPE_TEXTURE_PAIRS, DEFAULT_IMAGE} from "../helpers/Data";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import {CheckBoxOutlineBlank} from "@mui/icons-material";

export const CharacterWiki = () => {
    const classDatas = GameFactionData.reduce((acc, f) => [...acc, ...f.races], [] as IRaceData[]).reduce((acc, r) => [...acc, ...r.classes.map((i): [ERaceData, IClassData] => [r.id, i])], [] as Array<[ERaceData, IClassData]>);
    const firstClassDatas = classDatas[0];
    const [selectedCharacterClass, setSelectedCharacterClass] = useState<[ERaceData, IClassData]>(firstClassDatas);

    const renderCharacterUrl = (characterRace: ERaceData) => {
        const item = CHARACTER_TYPE_TEXTURE_PAIRS.find(i => i.characterRace === characterRace);
        if (item) {
            return {url: item.url, name: item.name};
        } else {
            return {url: DEFAULT_IMAGE, name: "missing"};
        }
    };

    return (
        <Paper style={{width: "100vw", minHeight: "100vh", height: "fit-content", display: "flex", flexDirection: "column"}}>
            <WebsiteDrawer rightSide={null}/>
            <Container>
                <Typography variant="h3">
                    Character Data
                </Typography>
                <Grid container spacing={2} columns={{
                    xs: 4,
                    lg: 12
                }}>
                    <Grid item xs={12}>
                        <Card>
                            <CardMedia component="img" alt={selectedCharacterClass[1].name} srcSet={renderCharacterUrl(selectedCharacterClass[0])?.url ?? undefined}>
                            </CardMedia>
                            <CardHeader title={selectedCharacterClass[1].name}>
                            </CardHeader>
                            <CardContent>
                                <Typography variant="body1">
                                    {selectedCharacterClass[1].description}
                                </Typography>
                                <Box style={{display: "flex", flexWrap: "wrap", justifyContent: "space-between"}}>
                                    <Card>
                                        <CardHeader title="Character Type">
                                        </CardHeader>
                                        <CardContent>
                                            <Typography>Is Magic: {selectedCharacterClass[1].isMagic ? "true" : "false"}</Typography>
                                            <Typography>Is Range: {selectedCharacterClass[1].isRange ? "true" : "false"}</Typography>
                                            <Typography>Is Melee: {selectedCharacterClass[1].isMelee ? "true" : "false"}</Typography>
                                            <Typography>Is Stealth: {selectedCharacterClass[1].isStealth ? "true" : "false"}</Typography>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader title="Character Armor">
                                        </CardHeader>
                                        <CardContent>
                                            <Typography>Magic Armor: {selectedCharacterClass[1].magicAttackArmor}</Typography>
                                            <Typography>Range Armor: {selectedCharacterClass[1].rangeAttackArmor}</Typography>
                                            <Typography>Melee Armor: {selectedCharacterClass[1].meleeAttackArmor}</Typography>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader title="Character Hit Chance">
                                        </CardHeader>
                                        <CardContent>
                                            <Typography>Magic Hit Chance: {selectedCharacterClass[1].magicAttackHit}</Typography>
                                            <Typography>Range Hit Chance: {selectedCharacterClass[1].rangeAttackHit}</Typography>
                                            <Typography>Melee Hit Chance: {selectedCharacterClass[1].meleeAttackHit}</Typography>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader title="Character Hit Damage">
                                        </CardHeader>
                                        <CardContent>
                                            <Typography>Magic Hit Damage: {selectedCharacterClass[1].magicAttackDamage}</Typography>
                                            <Typography>Range Hit Damage: {selectedCharacterClass[1].rangeAttackDamage}</Typography>
                                            <Typography>Melee Hit Damage: {selectedCharacterClass[1].meleeAttackDamage}</Typography>
                                        </CardContent>
                                    </Card>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12}>
                        <Typography variant="h3">
                            Available Characters
                        </Typography>
                    </Grid>
                    {
                        classDatas.map(classData => {
                            return (
                                <Grid item xs={4}>
                                    <Card>
                                        <CardActionArea onClick={() => {
                                            setSelectedCharacterClass(classData);
                                        }}>
                                            <CardMedia component="img" alt={classData[1].name} srcSet={renderCharacterUrl(classData[0])?.url ?? undefined}>
                                            </CardMedia>
                                            <CardHeader title={classData[1].name}>
                                            </CardHeader>
                                            <CardContent>
                                                {classData[1].name === selectedCharacterClass[1].name ? <CheckBoxIcon/> : <CheckBoxOutlineBlank/>}
                                                <Typography variant="body1">
                                                    {classData[1].description}
                                                </Typography>
                                            </CardContent>
                                        </CardActionArea>
                                    </Card>
                                </Grid>
                            );
                        })
                    }
                </Grid>
            </Container>
        </Paper>
    );
}
