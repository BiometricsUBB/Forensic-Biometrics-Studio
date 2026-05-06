import { GlobalSettingsStore } from "@/lib/stores/GlobalSettings";
import { useEffect, useState } from "react";

function getColor(property: string) {
    return getComputedStyle(document.body).getPropertyValue(property);
}

function getColors() {
    const keys = ["background", "foreground"] as const;
    return Object.fromEntries(
        keys.map(key => [key, `hsl(${getColor(`--${key}`)})`])
    ) as Record<(typeof keys)[number], string>;
}

export const useColors = () => {
    const { theme } = GlobalSettingsStore.use(state => ({
        theme: state.settings.interface.theme,
    }));

    const [colors, setColors] = useState(getColors());

    useEffect(() => {
        setColors(getColors());
    }, [theme]);

    return colors;
};
