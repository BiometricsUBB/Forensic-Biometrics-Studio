import React, { useState, Suspense, lazy, useEffect } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils/shadcn";
import SelectMode from "@/views/selectMode";
import { Menu } from "@/components/menu/menu";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { useSettingsSync } from "@/lib/hooks/useSettingsSync";
import { useCustomTheme } from "@/lib/hooks/useCustomTheme";
import { CustomThemeStore } from "@/lib/stores/CustomTheme";
import { GlobalSettingsStore } from "@/lib/stores/GlobalSettings";

const decodeUnicodeEscapes = (value: string) => {
    let current = value;
    const pattern = /\\u([0-9a-fA-F]{4})/g;
    for (let i = 0; i < 10; i += 1) {
        if (!pattern.test(current)) break;
        current = current.replace(pattern, (_m, hex) =>
            String.fromCharCode(parseInt(hex, 16))
        );
    }
    return current;
};

const Homepage = lazy(() =>
    import("@/components/tabs/homepage/homepage").then(module => ({
        default: module.Homepage,
    }))
);

const enum TABS {
    HOMEPAGE = "homepage",
    SELECT_MODE = "select_mode",
}

export default function App() {
    const [currentTab, setCurrentTab] = useState<TABS>(TABS.SELECT_MODE);
    const { setWorkingMode } = WorkingModeStore.use();

    useEffect(() => {
        CustomThemeStore.rehydrate();
        GlobalSettingsStore.use.persist?.rehydrate();
        const report = GlobalSettingsStore.state.settings.report;
        if (report) {
            const normalized = {
                ...report,
                performedBy: decodeUnicodeEscapes(report.performedBy ?? ""),
                department: decodeUnicodeEscapes(report.department ?? ""),
                addressLine1: decodeUnicodeEscapes(report.addressLine1 ?? ""),
                addressLine2: decodeUnicodeEscapes(report.addressLine2 ?? ""),
                addressLine3: decodeUnicodeEscapes(report.addressLine3 ?? ""),
                addressLine4: decodeUnicodeEscapes(report.addressLine4 ?? ""),
            };
            GlobalSettingsStore.actions.settings.report.setReportSettings(
                normalized
            );
        }
    }, []);

    useSettingsSync();
    useCustomTheme();

    return (
        <main
            data-testid="page-container"
            className="flex w-full min-h-dvh h-full  flex-col items-center justify-between bg-[hsl(var(--background))] relative overflow-hidden"
        >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {currentTab === TABS.SELECT_MODE ? (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/20 blur-[150px]" />
                ) : (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[75%] h-[85%] brightness-150 rounded-2xl bg-primary/20 blur-[150px]" />
                )}
            </div>
            <Menu />
            <Tabs
                value={currentTab}
                onValueChange={tab => setCurrentTab(tab as TABS)}
                className="w-full flex flex-col items-center flex-grow"
            >
                <TabsContent
                    forceMount
                    value={TABS.SELECT_MODE}
                    className={cn("w-full h-full relative flex flex-grow", {
                        hidden: currentTab !== TABS.SELECT_MODE,
                    })}
                >
                    <SelectMode
                        setCurrentWorkingMode={type => {
                            setWorkingMode(type);
                            setCurrentTab(TABS.HOMEPAGE);
                        }}
                    />
                </TabsContent>

                <TabsContent
                    forceMount
                    value={TABS.HOMEPAGE}
                    className={cn(
                        "flex flex-col justify-center items-center flex-grow w-full",
                        {
                            hidden: currentTab !== TABS.HOMEPAGE,
                        }
                    )}
                >
                    <Suspense fallback={<div>Loading...</div>}>
                        <Homepage />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </main>
    );
}
