import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IS_DEV_ENVIRONMENT } from "@/lib/utils/const";
import useResizeObserver from "@/lib/hooks/useResizeObserver";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MarkingsInfo } from "./markings-info/markings-info";
import { DebugInfo } from "./debug-info/debug-info";

const enum TABS {
    MARKINGS = "markings",
    DEBUG = "debug",
}

export function InformationTabs() {
    const { t } = useTranslation();

    const initialTab = TABS.MARKINGS;
    const [tableHeight, setTableHeight] = useState(0);

    const ref = useResizeObserver<HTMLDivElement>(target => {
        const tabpanel = target.querySelector(
            '[role="tabpanel"]'
        ) as HTMLElement | null;
        if (tabpanel === null) return;

        const virtuosoScroller = tabpanel.querySelector(
            '[data-test-id="virtuoso-scroller"]'
        ) as HTMLElement | null;
        if (virtuosoScroller === null) return;

        setTableHeight(
            target.offsetTop + target.clientHeight - virtuosoScroller.offsetTop
        );
    });

    return (
        <Tabs
            ref={ref}
            defaultValue={initialTab}
            className="w-full flex flex-col items-center flex-grow p-1.5"
        >
            <TabsList className="w-fit flex space-x-1">
                <TabsTrigger value={TABS.MARKINGS}>{t("Markings")}</TabsTrigger>

                {IS_DEV_ENVIRONMENT && (
                    <TabsTrigger value={TABS.DEBUG}>{t("Debug")}</TabsTrigger>
                )}
            </TabsList>
            <TabsContent
                value={TABS.MARKINGS}
                className="w-full overflow-hidden"
            >
                <MarkingsInfo tableHeight={tableHeight} />
            </TabsContent>

            {IS_DEV_ENVIRONMENT && (
                <TabsContent
                    value={TABS.DEBUG}
                    className="w-full overflow-auto"
                >
                    <DebugInfo />
                </TabsContent>
            )}
        </Tabs>
    );
}
