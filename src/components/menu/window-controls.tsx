import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Minus, Maximize, Minimize, X } from "lucide-react";
import { ICON } from "@/lib/utils/const";
import { IS_MACOS, IS_WINDOWS } from "@/lib/utils/platform";

export function WindowControls() {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        if (IS_MACOS) return undefined;

        const updateMaximized = async () => {
            setIsMaximized(await getCurrentWindow().isMaximized());
        };

        const unlisten = getCurrentWindow().listen(
            "tauri://resize",
            updateMaximized
        );

        return () => {
            unlisten.then(fn => fn());
        };
    }, []);

    const minimizeWindow = useCallback(async () => {
        await getCurrentWindow()?.minimize();
    }, []);

    const maximizeWindow = useCallback(async () => {
        await getCurrentWindow().toggleMaximize();
    }, []);

    const closeWindow = useCallback(async () => {
        await getCurrentWindow().close();
    }, []);

    if (IS_MACOS) return null;

    return (
        <div id="windowControls" className="flex">
            <Toggle
                pressed={false}
                onMouseDown={e => e.stopPropagation()}
                onDoubleClick={e => e.stopPropagation()}
                onClickCapture={minimizeWindow}
            >
                <Minus size={ICON.SIZE / 1.5} strokeWidth={ICON.STROKE_WIDTH} />
            </Toggle>
            {IS_WINDOWS && (
                <Toggle
                    pressed={false}
                    onMouseDown={e => e.stopPropagation()}
                    onDoubleClick={e => e.stopPropagation()}
                    onClickCapture={maximizeWindow}
                >
                    {isMaximized ? (
                        <Minimize
                            size={ICON.SIZE / 1.5}
                            strokeWidth={ICON.STROKE_WIDTH}
                        />
                    ) : (
                        <Maximize
                            size={ICON.SIZE / 1.5}
                            strokeWidth={ICON.STROKE_WIDTH}
                        />
                    )}
                </Toggle>
            )}
            <Toggle
                pressed={false}
                onMouseDown={e => e.stopPropagation()}
                onDoubleClick={e => e.stopPropagation()}
                onClickCapture={closeWindow}
                className="hover:bg-destructive hover:text-destructive-foreground"
            >
                <X size={ICON.SIZE / 1.5} strokeWidth={ICON.STROKE_WIDTH} />
            </Toggle>
        </div>
    );
}
