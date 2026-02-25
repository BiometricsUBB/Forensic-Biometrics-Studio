import { useTranslation } from "react-i18next";
import i18n from "@/lib/locales/i18n";
import { LANGUAGES } from "@/lib/stores/GlobalSettings";
import { cn } from "@/lib/utils/shadcn";
import { Check } from "lucide-react";
import { emitSettingsChange } from "@/lib/hooks/useSettingsSync";

const languageNames: Record<LANGUAGES, string> = {
    [LANGUAGES.ENGLISH]: "English",
    [LANGUAGES.POLISH]: "Polski",
};

export function LanguageSettings() {
    const { t } = useTranslation();

    const handleLanguageChange = async (value: LANGUAGES) => {
        i18n.changeLanguage(value);
        await emitSettingsChange({ type: "language", value });
    };

    return (
        <div className="flex flex-col gap-4 ml-1">
            <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">
                    {t("Language")}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {t("Select your preferred language", { ns: "description" })}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                {(Object.keys(LANGUAGES) as (keyof typeof LANGUAGES)[]).map(
                    key => {
                        // eslint-disable-next-line security/detect-object-injection
                        const value = LANGUAGES[key];
                        const isSelected = i18n.language === value;

                        return (
                            <button
                                type="button"
                                key={key}
                                onClick={() => handleLanguageChange(value)}
                                className={cn(
                                    "flex items-center justify-between px-4 py-3 rounded-lg transition-all",
                                    "hover:bg-secondary",
                                    "focus:outline-none",
                                    isSelected
                                        ? "bg-secondary text-primary-foreground border border-primary/30"
                                        : "text-foreground/80 border border-border/30"
                                )}
                            >
                                <span className="text-sm font-medium text-foreground">
                                    {languageNames[value]}
                                </span>
                                {isSelected && (
                                    <Check size={18} className="text-primary" />
                                )}
                            </button>
                        );
                    }
                )}
            </div>
        </div>
    );
}
