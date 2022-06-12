import * as React from "react";
import {useCallback, useState} from "react";
import {IFormCard} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import {Card, CardContent, CardHeader, Grid, Stack} from "@mui/material";
import {FieldRenderer} from "./FieldRenderer";

export const CardRenderer = ({card, submitForm}: {card: IFormCard, submitForm(type: string, data: {[key: string]: any}): void}) => {
    const [outputState, setOutputState] = useState<{[key: string]: any}>({});
    const handleOnChange = useCallback((dataField: string, value: string) => {
        setOutputState({
            ...outputState,
            [dataField]: value
        });
    }, [outputState]);
    const handleSubmit = useCallback((type: string) => {
        submitForm(type, outputState);
    }, [submitForm, outputState]);

    return (
        <Card>
            <CardHeader title={card.title}>
            </CardHeader>
            <CardContent>
                <Stack gap={2}>
                    {
                        card.fields.map(row => {
                            switch (row.length) {
                                case 1: {
                                    return (
                                        <Grid xs={12} container>
                                            <Grid item xs={12}>
                                                <FieldRenderer data={card.data} field={row[0]} onChange={handleOnChange} submit={handleSubmit}/>
                                            </Grid>
                                        </Grid>
                                    );
                                }
                                case 2: {
                                    return (
                                        <Grid xs={12} container>
                                            <Grid item xs={6}>
                                                <FieldRenderer data={card.data} field={row[0]} onChange={handleOnChange} submit={handleSubmit}/>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <FieldRenderer data={card.data} field={row[1]} onChange={handleOnChange} submit={handleSubmit}/>
                                            </Grid>
                                        </Grid>
                                    );
                                }
                                case 3: {
                                    return (
                                        <Grid xs={12} container>
                                            <Grid item xs={4}>
                                                <FieldRenderer data={card.data} field={row[0]} onChange={handleOnChange} submit={handleSubmit}/>
                                            </Grid>
                                            <Grid item xs={4}>
                                                <FieldRenderer data={card.data} field={row[1]} onChange={handleOnChange} submit={handleSubmit}/>
                                            </Grid>
                                            <Grid item xs={4}>
                                                <FieldRenderer data={card.data} field={row[2]} onChange={handleOnChange} submit={handleSubmit}/>
                                            </Grid>
                                        </Grid>
                                    );
                                }
                            }
                        })
                    }
                </Stack>
            </CardContent>
        </Card>
    )
};