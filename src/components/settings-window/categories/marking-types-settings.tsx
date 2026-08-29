import { useTranslation } from "react-i18next";
import { useMarkingTypes } from "./marking-types/use-marking-types";
import { MarkingTypesToolbar } from "./marking-types/toolbar";
import { MarkingTypesTable } from "./marking-types/table";

export function MarkingTypesSettings() {
    const { t } = useTranslation();
    const {
        selectedCategory,
        setSelectedCategory,
        types,
        setType,
        keybindings,
        conflictingKeys,
        sensors,
        handleDragEnd,
        handleRemove,
    } = useMarkingTypes();

    return (
        <div className="flex flex-col gap-4 p-2 h-full">
            <div className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold">
                    {t("Types", { ns: "keywords" })}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {t("Manage marking types", {
                        ns: "description",
                    })}
                </p>
            </div>

            <MarkingTypesToolbar
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
            />

            {selectedCategory !== undefined && conflictingKeys.size > 0 && (
                <p className="text-sm text-destructive">
                    {t("Keybinding conflicts detected", { ns: "keybindings" })}
                </p>
            )}

            <div className="flex-1 overflow-auto">
                <MarkingTypesTable
                    selectedCategory={selectedCategory}
                    types={types}
                    keybindings={keybindings}
                    conflictingKeys={conflictingKeys}
                    sensors={sensors}
                    onDragEnd={handleDragEnd}
                    onRemove={handleRemove}
                    setType={setType}
                />
            </div>
        </div>
    );
}
