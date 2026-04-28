import React from "react";
import { Plus, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ICON } from "@/lib/utils/const";
import { MODIFIER_REGISTRY } from "@/lib/imageModifiers/registry";
import { ModifierType } from "@/lib/imageModifiers/types";

import { ModifierIcon } from "./ModifierList";

interface AddModifierButtonProps {
    onAdd: (type: ModifierType) => void;
    disabled?: boolean;
}

export function AddModifierButton({ onAdd, disabled }: AddModifierButtonProps) {
    const { t } = useTranslation(["tooltip", "keywords"]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    disabled={disabled}
                    id="add-modifier-button"
                >
                    <Plus size={ICON.SIZE} strokeWidth={ICON.STROKE_WIDTH} />
                    {t("Add", { ns: "keywords" })}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                side="left"
                sideOffset={12}
                className="w-56"
            >
                {MODIFIER_REGISTRY.map(def => (
                    <DropdownMenuItem
                        key={def.type}
                        id={`add-modifier-${def.type}`}
                        onSelect={() => onAdd(def.type)}
                        className="flex items-center gap-2 cursor-pointer"
                    >
                        <ModifierIcon type={def.type} size={14} />
                        <span className="flex-1">
                            {t(def.labelKey as never, {
                                ns: "tooltip",
                                defaultValue: def.labelKey,
                            })}
                        </span>
                        <div
                            role="button"
                            tabIndex={0}
                            className="text-muted-foreground hover:text-foreground p-0.5 ml-2 cursor-help"
                            title={t(`${def.type}_desc` as never, {
                                ns: "tooltip",
                                defaultValue: `Information about ${def.labelKey}`,
                            })}
                            onClick={e => e.stopPropagation()}
                            onKeyDown={e => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.stopPropagation();
                                }
                            }}
                        >
                            <Info size={14} />
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
