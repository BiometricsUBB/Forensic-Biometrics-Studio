import React from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface SidebarAdjustmentsProps {
    brightness: number;
    setBrightness: (val: number) => void;
    contrast: number;
    setContrast: (val: number) => void;
    disabled: boolean;
}

export function SidebarAdjustments({
    brightness,
    setBrightness,
    contrast,
    setContrast,
    disabled,
}: SidebarAdjustmentsProps) {
    const { t } = useTranslation(["tooltip", "keywords"]);

    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-muted-foreground">
                {t("Adjustments", { ns: "keywords" })}
            </h3>
            <div className="flex flex-col items-center space-y-2">
                <Label
                    htmlFor="brightness"
                    className="text-sm font-medium self-start"
                >
                    {t("Brightness", { ns: "tooltip" })}
                </Label>
                <div className="flex items-center gap-3 w-full">
                    <Input
                        id="brightness"
                        type="range"
                        min="0"
                        max="200"
                        value={brightness}
                        onChange={e => setBrightness(Number(e.target.value))}
                        className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                        disabled={disabled}
                    />
                    <span className="text-sm text-muted-foreground min-w-[3rem] text-right">
                        {brightness}%
                    </span>
                </div>
            </div>
            <div className="flex flex-col items-center space-y-2">
                <Label
                    htmlFor="contrast"
                    className="text-sm font-medium self-start"
                >
                    {t("Contrast", { ns: "tooltip" })}
                </Label>
                <div className="flex items-center gap-3 w-full">
                    <Input
                        id="contrast"
                        type="range"
                        min="0"
                        max="200"
                        value={contrast}
                        onChange={e => setContrast(Number(e.target.value))}
                        className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                        disabled={disabled}
                    />
                    <span className="text-sm text-muted-foreground min-w-[3rem] text-right">
                        {contrast}%
                    </span>
                </div>
            </div>
        </div>
    );
}
