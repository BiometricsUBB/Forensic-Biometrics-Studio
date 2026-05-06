import {
    MenubarCheckboxItem,
    MenubarContent,
    MenubarMenu,
    MenubarPortal,
    MenubarTrigger,
} from "@/components/ui/menubar";
import { WORKING_MODE } from "@/views/selectMode";
import { MarkingsStore } from "@/lib/stores/Markings";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { useTranslation } from "react-i18next";
import { confirm } from "@tauri-apps/plugin-dialog";
import { Sprite } from "pixi.js";
import { useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useGlobalViewport } from "@/components/pixi/viewport/hooks/useGlobalViewport";

export function ModeMenu() {
    const { t } = useTranslation();
    const { workingMode, setWorkingMode } = WorkingModeStore.use();
    const viewportLeft = useGlobalViewport(CANVAS_ID.LEFT, {
        autoUpdate: true,
    });
    const viewportRight = useGlobalViewport(CANVAS_ID.RIGHT, {
        autoUpdate: true,
    });

    const onCheckedChange = useCallback(
        async (mode: WORKING_MODE) => {
            if (workingMode === mode) return;

            const isCanvasDirty =
                viewportLeft?.children.length || viewportRight?.children.length;

            if (isCanvasDirty) {
                const confirmed = await confirm(
                    t(
                        "This action will clear the current canvas. Are you sure you want to proceed?",
                        { ns: "dialog" }
                    ),
                    {
                        kind: "warning",
                        title: t("Warning", { ns: "dialog" }),
                    }
                );

                if (!confirmed) return;
            }

            // Destroy current image sprites
            (
                viewportLeft?.children.find(x => x instanceof Sprite) as
                    | Sprite
                    | undefined
            )?.destroy({
                children: true,
                texture: true,
                baseTexture: true,
            });
            (
                viewportRight?.children.find(x => x instanceof Sprite) as
                    | Sprite
                    | undefined
            )?.destroy({
                children: true,
                texture: true,
                baseTexture: true,
            });

            MarkingsStore(CANVAS_ID.LEFT).actions.markings.reset();
            MarkingsStore(CANVAS_ID.RIGHT).actions.markings.reset();
            MarkingsStore(CANVAS_ID.LEFT).actions.labelGenerator.reset();
            MarkingsStore(CANVAS_ID.RIGHT).actions.labelGenerator.reset();

            setWorkingMode(mode);
        },
        [workingMode, viewportLeft, viewportRight, t, setWorkingMode]
    );

    useEffect(() => {
        const unlisten = listen<string>("native-menu-mode-change", event => {
            const candidate = event.payload as WORKING_MODE;
            if (Object.values(WORKING_MODE).includes(candidate)) {
                onCheckedChange(candidate);
            }
        });
        return () => {
            unlisten.then(fn => fn());
        };
    }, [onCheckedChange]);

    return (
        <MenubarMenu>
            <MenubarTrigger>
                {t("Working mode")}:{" "}
                {workingMode ? t(workingMode, { ns: "modes" }) : ""}
            </MenubarTrigger>
            <MenubarPortal>
                <MenubarContent>
                    {Object.values(WORKING_MODE).map(mode => (
                        <MenubarCheckboxItem
                            key={mode}
                            checked={workingMode === mode}
                            onCheckedChange={() => onCheckedChange(mode)}
                        >
                            {t(mode, { ns: "modes" })}
                        </MenubarCheckboxItem>
                    ))}
                </MenubarContent>
            </MenubarPortal>
        </MenubarMenu>
    );
}
