import { useTheme } from "@/lib/hooks/useTheme";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { GlobalSettingsStore, LANGUAGES } from "../stores/GlobalSettings";

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

const normalizeReportSettings = () => {
    const current = GlobalSettingsStore.state.settings.report;
    if (!current) return;
    const normalized = {
        performedBy: decodeUnicodeEscapes(current.performedBy ?? ""),
        department: decodeUnicodeEscapes(current.department ?? ""),
        addressLine1: decodeUnicodeEscapes(current.addressLine1 ?? ""),
        addressLine2: decodeUnicodeEscapes(current.addressLine2 ?? ""),
        addressLine3: decodeUnicodeEscapes(current.addressLine3 ?? ""),
        addressLine4: decodeUnicodeEscapes(current.addressLine4 ?? ""),
    };
    GlobalSettingsStore.actions.settings.report.setReportSettings({
        ...current,
        ...normalized,
    });
};

export const useAppMount = () => {
    const [hasMounted, setHasMounted] = useState(false);
    const { setTheme } = useTheme();
    const theme = GlobalSettingsStore.use(state => {
        return state.settings.interface.theme;
    });

    const { i18n } = useTranslation();
    const language = GlobalSettingsStore.use(state => {
        return state.settings.language;
    });

    useEffect(() => {
        setTheme(theme);
    }, [setTheme, theme]);

    useEffect(() => {
        const setLanguage = (lng: LANGUAGES) => {
            i18n.changeLanguage(lng);
        };
        setLanguage(language);
    }, [i18n, language]);

    useEffect(() => {
        const callback = async () => {
            await invoke("close_splashscreen_if_exists");
            await invoke("show_main_window_if_hidden");
        };
        callback();
        normalizeReportSettings();
        setHasMounted(true);
    }, []);

    return hasMounted;
};
