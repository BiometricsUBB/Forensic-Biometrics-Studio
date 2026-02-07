import {
    i18nKeywords,
    i18nKeybindings,
    i18nCursor,
    i18nObject,
    i18nTooltip,
    i18nDialog,
    i18nModes,
    i18nDescription,
    i18nReport,
} from "@/lib/locales/translation";

declare module "i18next" {
    interface CustomTypeOptions {
        defaultNS: [
            "keywords",
            "keybindings",
            "cursor",
            "object",
            "tooltip",
            "description",
            "dialog",
            "modes",
        ];
        resources: {
            keywords: i18nKeywords;
            keybindings: i18nKeybindings;
            cursor: i18nCursor;
            object: i18nObject;
            tooltip: i18nTooltip;
            description: i18nDescription;
            dialog: i18nDialog;
            modes: i18nModes;
            report: i18nReport;
        };
    }
}
