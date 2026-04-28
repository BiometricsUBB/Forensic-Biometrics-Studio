import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { ICON } from "@/lib/utils/const";

interface SidebarToolsProps {
    imageName: string | null;
    imageSize: { w: number; h: number } | null;
    onSave: () => void;
    disabled: boolean;
}

export function SidebarTools({
    imageName,
    imageSize,
    onSave,
    disabled,
}: SidebarToolsProps) {
    const { t } = useTranslation(["tooltip", "keywords"]);

    return (
        <>
            {imageName && (
                <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                        Info
                    </h3>
                    <p
                        className="text-xs text-foreground truncate"
                        title={imageName}
                    >
                        {imageName}
                    </p>
                    {imageSize && (
                        <p className="text-xs text-muted-foreground">
                            {imageSize.w} × {imageSize.h} px
                        </p>
                    )}
                </div>
            )}

            <div className="border-t border-border/30" />

            <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-muted-foreground">
                    {t("Tools", { ns: "keywords" })}
                </h3>
                <Button
                    onClick={onSave}
                    className="w-full"
                    variant="default"
                    disabled={disabled}
                >
                    <Save size={ICON.SIZE} className="mr-2" />
                    {t("Save", { ns: "tooltip" })}
                </Button>
            </div>
        </>
    );
}
