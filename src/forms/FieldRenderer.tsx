import {EFormFieldType, IFormField} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import * as React from "react";
import {useState} from "react";
import {Button, TextField} from "@mui/material";

export const FieldRenderer = ({data, field, onChange, submit}: {
    data: { [key: string]: any },
    field: IFormField,
    onChange(dataField: string, value: string): void,
    submit(type: string): void
}) => {
    const [internalValue, setInternalValue] = useState<string>("0");
    const value = field.isReadOnly ? data[field.dataField ?? ""] ?? 0 : internalValue;
    switch (field.type) {
        case EFormFieldType.NUMBER: {
            return (
                <TextField label={field.label} inputProps={{
                    readOnly: field.isReadOnly
                }} value={value} onChange={(e) => {
                    if (field.dataField) {
                        setInternalValue(e.target.value);
                        onChange(field.dataField, e.target.value);
                    }
                }}></TextField>
            );
        }
        case EFormFieldType.BUTTON: {
            return (
                <Button onClick={() => {
                    if (field.buttonPath) {
                        submit(field.buttonPath);
                    }
                }}>{field.label}</Button>
            );
        }
    }
}