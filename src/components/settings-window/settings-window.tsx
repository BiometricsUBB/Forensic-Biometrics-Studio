import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { WindowControls } from "@/components/menu/window-controls";
import { MacOSTitleBarSpacer } from "@/components/menu/macos-titlebar-spacer";
import { IS_MACOS } from "@/lib/utils/platform";
import { Menubar } from "@/components/ui/menubar";
import { cn } from "@/lib/utils/shadcn";
import { ICON } from "@/lib/utils/const";
import {
    Languages,
    Palette,
    Info,
    Settings,
    Tags,
    FileText,
} from "lucide-react";
import { CustomThemeStore } from "@/lib/stores/CustomTheme";
import { applyCustomTheme } from "@/lib/hooks/useCustomTheme";
import { GlobalSettingsStore } from "@/lib/stores/GlobalSettings";
import { LanguageSettings } from "./categories/language-settings";
import { ThemeSettings } from "./categories/theme-settings";
import { AboutSettings } from "./categories/about-settings";
import { MarkingTypesSettings } from "./categories/marking-types-settings";
import { ReportSettings } from "./categories/report-settings";

export enum SETTINGS_CATEGORY {
    LANGUAGE = "language",
    THEME = "theme",
    MARKING_TYPES = "marking-types",
    REPORT = "report",
    ABOUT = "about",
}

interface CategoryItem {
    id: SETTINGS_CATEGORY;
    labelKey: "Language" | "Theme" | "Types" | "Report" | "About";
    icon: React.ReactNode;
}

const categories: CategoryItem[] = [
    {
        id: SETTINGS_CATEGORY.LANGUAGE,
        labelKey: "Language",
        icon: <Languages size={ICON.SIZE} strokeWidth={ICON.STROKE_WIDTH} />,
    },
    {
        id: SETTINGS_CATEGORY.THEME,
        labelKey: "Theme",
        icon: <Palette size={ICON.SIZE} strokeWidth={ICON.STROKE_WIDTH} />,
    },
    {
        id: SETTINGS_CATEGORY.MARKING_TYPES,
        labelKey: "Types",
        icon: <Tags size={ICON.SIZE} strokeWidth={ICON.STROKE_WIDTH} />,
    },
    {
        id: SETTINGS_CATEGORY.REPORT,
        labelKey: "Report",
        icon: <FileText size={ICON.SIZE} strokeWidth={ICON.STROKE_WIDTH} />,
    },
    {
        id: SETTINGS_CATEGORY.ABOUT,
        labelKey: "About",
        icon: <Info size={ICON.SIZE} strokeWidth={ICON.STROKE_WIDTH} />,
    },
];

export function SettingsWindow() {
    const { t } = useTranslation();

    // Parse URL params to get initial category
    const urlParams = new URLSearchParams(window.location.search);
    const initialCategory = urlParams.get(
        "category"
    ) as SETTINGS_CATEGORY | null;

    const [activeCategory, setActiveCategory] = useState<SETTINGS_CATEGORY>(
        initialCategory &&
            Object.values(SETTINGS_CATEGORY).includes(initialCategory)
            ? initialCategory
            : SETTINGS_CATEGORY.LANGUAGE
    );

    useEffect(() => {
        const init = async () => {
            await CustomThemeStore.rehydrate();
            await GlobalSettingsStore.use.persist?.rehydrate?.();
            const activeTheme = CustomThemeStore.getActiveTheme();
            if (activeTheme) {
                applyCustomTheme(activeTheme);
            }
            await new Promise(resolve => setTimeout(resolve, 0));
            await invoke("show_current_window");
        };
        init();
    }, []);

    useEffect(() => {
        const unlisten = listen<string>("settings-category-change", event => {
            const category = event.payload as SETTINGS_CATEGORY;
            if (Object.values(SETTINGS_CATEGORY).includes(category)) {
                setActiveCategory(category);
            }
        });
        return () => {
            unlisten.then(fn => fn());
        };
    }, []);

    const renderCategoryContent = () => {
        switch (activeCategory) {
            case SETTINGS_CATEGORY.LANGUAGE:
                return <LanguageSettings />;
            case SETTINGS_CATEGORY.THEME:
                return <ThemeSettings />;
            case SETTINGS_CATEGORY.MARKING_TYPES:
                return <MarkingTypesSettings />;
            case SETTINGS_CATEGORY.REPORT:
                return <ReportSettings />;
            case SETTINGS_CATEGORY.ABOUT:
                return <AboutSettings />;
            default:
                return null;
        }
    };

    return (
        <main
            data-testid="settings-window"
            className="flex size-full min-h-dvh flex-col items-center justify-between bg-[hsl(var(--background))] relative overflow-hidden"
        >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[75%] h-[85%] brightness-150 rounded-2xl bg-primary/20 blur-[150px]" />
            </div>

            <Menubar
                className={cn(
                    "flex justify-between w-screen items-center",
                    IS_MACOS
                        ? "h-9 pt-3 [&_button]:h-7 [&_button]:px-2"
                        : "min-h-14"
                )}
                data-tauri-drag-region
            >
                <div className="flex grow items-center" data-tauri-drag-region>
                    <MacOSTitleBarSpacer />
                    <div
                        className="flex items-center px-2"
                        data-tauri-drag-region
                    >
                        <Settings
                            size={ICON.SIZE}
                            strokeWidth={ICON.STROKE_WIDTH}
                            className="text-foreground"
                        />
                    </div>
                    <span
                        className="text-sm font-medium text-foreground"
                        data-tauri-drag-region
                    >
                        {t("Settings", { ns: "keywords" })}
                    </span>
                </div>
                <WindowControls />
            </Menubar>

            <div className="flex flex-1 w-full overflow-hidden p-2 gap-2">
                <div className="flex flex-col gap-1 max-w-45">
                    {categories.map(category => (
                        <button
                            type="button"
                            key={category.id}
                            onClick={() => setActiveCategory(category.id)}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-150 text-left border",
                                "hover:bg-secondary",
                                "focus:outline-hidden",
                                activeCategory === category.id
                                    ? "bg-primary/20 text-foreground border-primary/30"
                                    : "text-foreground/80 border-transparent"
                            )}
                        >
                            {category.icon}
                            <span className="text-sm font-medium">
                                {t(category.labelKey)}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="flex-1 bg-background backdrop-blur-xs border border-border rounded-xl p-2 overflow-y-auto">
                    {renderCategoryContent()}
                </div>
            </div>
        </main>
    );
}
