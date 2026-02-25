import React from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";

export enum WORKING_MODE {
    FINGERPRINT = "FINGERPRINT",
    EAR = "EAR",
    SHOEPRINT = "SHOEPRINT",
}

interface ISelectModeProps {
    setCurrentWorkingMode: (mode: WORKING_MODE) => void;
}

export default function SelectMode({
    setCurrentWorkingMode,
}: ISelectModeProps) {
    const { t } = useTranslation();

    return (
        <main className="w-full flex flex-col items-center justify-center">
            <div
                className="absolute inset-0 top-2 bg-cover bg-center z-0 blur-sm"
                aria-hidden="true"
            />
            <div className="bg-background border z-10 p-4 shadow-md">
                <h1 className="text-2xl text-center font-bold text-foreground">
                    Biometrics Studio
                </h1>
                <Separator />
                <p className="text-xs text-center text-muted-foreground">
                    {t("Please select your working mode", { ns: "dialog" })}
                </p>
                <div className="flex flex-col gap-2 mt-6">
                    {Object.values(WORKING_MODE).map(mode => (
                        <Button
                            key={mode}
                            variant="outline"
                            size="lg"
                            className="w-full"
                            onClick={() => {
                                setCurrentWorkingMode(mode);
                            }}
                        >
                            {t(mode, { ns: "modes" })}
                        </Button>
                    ))}
                </div>
            </div>
        </main>
    );
}
