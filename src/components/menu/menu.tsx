import { Menubar } from "@/components/ui/menubar";
import { SettingsMenu } from "@/components/menu/settings-menu";
import { cn } from "@/lib/utils/shadcn";
import { ICON } from "@/lib/utils/const";
import { ModeMenu } from "@/components/menu/mode-menu";
import { WindowControls } from "@/components/menu/window-controls";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";

export function Menu() {
    const workingMode = WorkingModeStore.use(state => state.workingMode);

    return (
        <Menubar
            className={cn(
                "flex justify-between w-screen items-center min-h-[40px]"
            )}
            data-tauri-drag-region
        >
            <div className="flex grow-1 items-center">
                <div className="flex items-center px-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/logo.svg"
                        alt="Logo"
                        className="logo pointer-events-none select-none"
                        height={ICON.SIZE}
                        width={ICON.SIZE}
                    />
                </div>
                <SettingsMenu />
                {workingMode && (
                    <div className="flex flex-row items-center [&>*]:h-full">
                        <ModeMenu />
                    </div>
                )}
            </div>
            <WindowControls />
        </Menubar>
    );
}
