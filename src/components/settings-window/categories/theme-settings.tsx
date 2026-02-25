import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/lib/hooks/useTheme";
import { THEMES } from "@/lib/stores/GlobalSettings";
import { cn } from "@/lib/utils/shadcn";
import {
    Check,
    Sun,
    Moon,
    Monitor,
    Plus,
    Trash2,
    Edit2,
    Download,
    Upload,
    X,
    Save,
} from "lucide-react";
import { emitSettingsChange } from "@/lib/hooks/useSettingsSync";
import { useCustomTheme } from "@/lib/hooks/useCustomTheme";
import {
    CustomTheme,
    ThemeColors,
    THEME_COLOR_LABELS,
    createDefaultTheme,
} from "@/lib/stores/CustomTheme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";

const themeIcons: Record<THEMES, React.ReactNode> = {
    [THEMES.LIGHT]: <Sun size={18} />,
    [THEMES.DARK]: <Moon size={18} />,
    [THEMES.SYSTEM]: <Monitor size={18} />,
    [THEMES.DARK_GRAY]: <Moon size={18} />,
    [THEMES.DARK_BLUE]: <Moon size={18} />,
    [THEMES.LIGHT_BLUE]: <Sun size={18} />,
};

function hslToHex(hsl: string): string {
    const parts = hsl.split(" ");
    if (parts.length < 3) return "#000000";

    const h = parseFloat(parts[0] ?? "0") || 0;
    const s = (parseFloat(parts[1] ?? "0") || 0) / 100;
    const l = (parseFloat(parts[2] ?? "0") || 0) / 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    const colorMap = [
        [c, x, 0],
        [x, c, 0],
        [0, c, x],
        [0, x, c],
        [x, 0, c],
        [c, 0, x],
    ] as const;

    const sector = Math.floor(h / 60) % 6;
    const [r, g, b] = colorMap[sector] ?? [0, 0, 0];

    const toHex = (n: number) => {
        const hex = Math.round((n + m) * 255).toString(16);
        return hex.length === 1 ? `0${hex}` : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return "0 0% 0%";

    const r = parseInt(result[1] ?? "0", 16) / 255;
    const g = parseInt(result[2] ?? "0", 16) / 255;
    const b = parseInt(result[3] ?? "0", 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
                break;
            case g:
                h = ((b - r) / d + 2) * 60;
                break;
            case b:
                h = ((r - g) / d + 4) * 60;
                break;
            default:
                h = 0;
        }
    }

    return `${h.toFixed(2)} ${(s * 100).toFixed(2)}% ${(l * 100).toFixed(2)}%`;
}

interface ColorPickerProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
}

function ColorPicker({ label, value, onChange }: ColorPickerProps) {
    const hexValue = hslToHex(value);

    return (
        <div className="flex items-center justify-between gap-2 py-1">
            <span className="text-xs text-foreground/80 flex-1">{label}</span>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={hexValue}
                    onChange={e => onChange(hexToHsl(e.target.value))}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-border appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-none"
                />
                <span className="text-xs text-muted-foreground w-20 font-mono">
                    {hexValue}
                </span>
            </div>
        </div>
    );
}

interface ThemeEditorProps {
    theme: CustomTheme;
    onClose: () => void;
}

function ThemeEditor({ theme, onClose }: ThemeEditorProps) {
    const { t } = useTranslation();
    const { updateTheme, updateThemeColor, setActiveTheme } = useCustomTheme();
    const [name, setName] = useState(theme.name);

    useEffect(() => {
        setActiveTheme(theme.id);
        emitSettingsChange({ type: "customTheme", theme });
    }, [theme, setActiveTheme]);

    const handleColorChange = (key: keyof ThemeColors, value: string) => {
        updateThemeColor(theme.id, key, value);
        const updatedTheme = {
            ...theme,
            colors: { ...theme.colors, [key]: value },
        };
        emitSettingsChange({ type: "customTheme", theme: updatedTheme });
    };

    const handleSave = () => {
        updateTheme(theme.id, { name });
        onClose();
    };

    const colorKeys = Object.keys(THEME_COLOR_LABELS) as (keyof ThemeColors)[];

    return (
        <div className="flex flex-col gap-4 ml-1">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">{t("Edit Theme")}</h3>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X size={16} />
                </Button>
            </div>

            <div className="flex flex-col gap-2 ml-1">
                <label htmlFor="theme-name" className="text-sm font-medium">
                    {t("Theme Name")}
                </label>
                <Input
                    id="theme-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t("Theme name")}
                />
            </div>

            <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto pr-2">
                <h4 className="text-sm font-medium mb-2">{t("Colors")}</h4>
                {colorKeys.map(key => (
                    <ColorPicker
                        key={key}
                        // eslint-disable-next-line security/detect-object-injection
                        label={THEME_COLOR_LABELS[key]}
                        // eslint-disable-next-line security/detect-object-injection
                        value={theme.colors[key]}
                        onChange={value => handleColorChange(key, value)}
                    />
                ))}
            </div>

            <Button onClick={handleSave} className="w-full">
                <Save size={16} className="mr-2" />
                {t("Save")}
            </Button>
        </div>
    );
}

export function ThemeSettings() {
    const { t } = useTranslation();
    const { theme: resolvedTheme, setTheme } = useTheme();
    const {
        themes: customThemes,
        activeThemeId,
        setActiveTheme,
        addTheme,
        removeTheme,
    } = useCustomTheme();
    const [editingTheme, setEditingTheme] = useState<CustomTheme | null>(null);

    const handleThemeChange = async (value: THEMES) => {
        setTheme(value);
        setActiveTheme(null);
        await emitSettingsChange({ type: "theme", value });
        await emitSettingsChange({ type: "customTheme", theme: null });
    };

    const handleSelectCustomTheme = async (themeId: string) => {
        const theme = customThemes.find(t => t.id === themeId);
        setActiveTheme(themeId);
        await emitSettingsChange({ type: "customTheme", theme: theme ?? null });
    };

    const handleCreateTheme = () => {
        const isDark =
            resolvedTheme === THEMES.DARK ||
            (resolvedTheme === THEMES.SYSTEM &&
                window.matchMedia("(prefers-color-scheme: dark)").matches);
        const baseTheme = isDark ? "dark" : "light";
        const newTheme = createDefaultTheme(baseTheme);
        addTheme(newTheme);
        setEditingTheme(newTheme);
    };

    const handleExportThemes = async () => {
        try {
            const filePath = await save({
                filters: [{ name: "JSON", extensions: ["json"] }],
                defaultPath: "custom-themes.json",
            });

            if (filePath) {
                const data = JSON.stringify(customThemes, null, 2);
                await writeTextFile(filePath, data);
                toast.success(t("Themes exported successfully"));
            }
        } catch {
            toast.error(t("Failed to export themes"));
        }
    };

    const handleImportThemes = async () => {
        try {
            const filePath = await open({
                filters: [{ name: "JSON", extensions: ["json"] }],
                multiple: false,
            });

            if (filePath) {
                const content = await readTextFile(filePath as string);
                const importedThemes = JSON.parse(content) as CustomTheme[];

                if (Array.isArray(importedThemes)) {
                    importedThemes.forEach(theme => {
                        addTheme(theme);
                    });
                    toast.success(t("Themes imported successfully"));
                } else {
                    toast.error(t("Invalid themes file"));
                }
            }
        } catch {
            toast.error(t("Failed to import themes"));
        }
    };

    if (editingTheme) {
        const currentTheme = customThemes.find(t => t.id === editingTheme.id);
        if (currentTheme) {
            return (
                <ThemeEditor
                    theme={currentTheme}
                    onClose={() => setEditingTheme(null)}
                />
            );
        }
    }

    return (
        <div className="flex flex-col gap-4 overflow-y-auto ml-1">
            <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">
                    {t("Theme")}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {t("Select your preferred theme", { ns: "description" })}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                {(Object.keys(THEMES) as (keyof typeof THEMES)[]).map(key => {
                    // eslint-disable-next-line security/detect-object-injection
                    const value = THEMES[key];
                    const isSelected =
                        resolvedTheme === value && activeThemeId === null;

                    return (
                        <button
                            type="button"
                            key={key}
                            onClick={() => handleThemeChange(value)}
                            className={cn(
                                "flex items-center justify-between px-4 py-3 rounded-lg transition-all",
                                "hover:bg-secondary",
                                "focus:outline-none",
                                isSelected
                                    ? "bg-secondary text-primary-foreground border border-primary/30"
                                    : "text-foreground/80 border border-border/30"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-foreground/70">
                                    {themeIcons[value]}
                                </span>
                                <span className="text-sm font-medium text-foreground">
                                    {t(`Theme.Keys.${value}`, { ns: "object" })}
                                </span>
                            </div>
                            {isSelected && (
                                <Check size={18} className="text-primary" />
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="border-t border-border/30 pt-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">
                        {t("Custom Themes")}
                    </h3>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCreateTheme}
                    >
                        <Plus size={14} className="mr-1" />
                        {t("Add")}
                    </Button>
                </div>

                {customThemes.length > 0 && (
                    <div className="flex flex-col gap-2">
                        {customThemes.map(theme => (
                            <div
                                key={theme.id}
                                className={cn(
                                    "flex items-center justify-between px-4 py-3 rounded-lg transition-all",
                                    "border hover:bg-primary/10",
                                    activeThemeId === theme.id
                                        ? "bg-primary/20 border-primary/50"
                                        : "border-border/30"
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleSelectCustomTheme(theme.id)
                                    }
                                    className="flex-1 text-left"
                                >
                                    <span className="text-sm font-medium text-foreground">
                                        {theme.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                        ({theme.baseTheme})
                                    </span>
                                </button>
                                <div className="flex items-center gap-1">
                                    {activeThemeId === theme.id && (
                                        <Check
                                            size={18}
                                            className="text-primary mr-2"
                                        />
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setEditingTheme(theme)}
                                    >
                                        <Edit2 size={14} />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground"
                                        onClick={() => removeTheme(theme.id)}
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {customThemes.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                        {t("Create and manage custom color themes", {
                            ns: "description",
                        })}
                    </p>
                )}

                <div className="flex gap-2 mt-3">
                    {customThemes.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportThemes}
                        >
                            <Download size={14} className="mr-1" />
                            {t("Export")}
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleImportThemes}
                    >
                        <Upload size={14} className="mr-1" />
                        {t("Import")}
                    </Button>
                </div>
            </div>
        </div>
    );
}
