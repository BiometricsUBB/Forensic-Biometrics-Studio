import { produce } from "immer";
import { ActionProduceCallback } from "../immer.helpers";
import {
    CustomThemeState as State,
    _useCustomThemeStore as useStore,
} from "./CustomTheme.store";
import { CustomTheme, ThemeColors } from "./CustomTheme.types";

class StoreClass {
    readonly use = useStore;

    get state() {
        return this.use.getState();
    }

    private setThemes(callback: ActionProduceCallback<State["themes"], State>) {
        this.state.set(draft => {
            draft.themes = callback(draft.themes, draft);
        });
    }

    readonly actions = {
        addTheme: (theme: CustomTheme) => {
            this.setThemes(
                produce(themes => {
                    themes.push(theme);
                })
            );
        },

        removeTheme: (themeId: string) => {
            this.setThemes(themes => themes.filter(t => t.id !== themeId));
            if (this.state.activeThemeId === themeId) {
                this.state.set(draft => {
                    draft.activeThemeId = null;
                });
            }
        },

        updateTheme: (
            themeId: string,
            updates: Partial<Omit<CustomTheme, "id" | "createdAt">>
        ) => {
            this.setThemes(
                produce(themes => {
                    const index = themes.findIndex(t => t.id === themeId);
                    if (index !== -1 && themes[index]) {
                        const existingTheme = themes[index];
                        themes[index] = {
                            ...existingTheme,
                            ...updates,
                            updatedAt: Date.now(),
                        };
                    }
                })
            );
        },

        updateThemeColor: (
            themeId: string,
            colorKey: keyof ThemeColors,
            value: string
        ) => {
            this.setThemes(
                produce(themes => {
                    const theme = themes.find(t => t.id === themeId);
                    if (theme) {
                        theme.colors[colorKey] = value;
                        theme.updatedAt = Date.now();
                    }
                })
            );
        },

        setActiveTheme: (themeId: string | null) => {
            this.state.set(draft => {
                draft.activeThemeId = themeId;
            });
        },

        importThemes: (themes: CustomTheme[]) => {
            this.setThemes(
                produce(currentThemes => {
                    themes.forEach(theme => {
                        const existingIndex = currentThemes.findIndex(
                            t => t.id === theme.id
                        );
                        if (existingIndex !== -1) {
                            currentThemes[existingIndex] = theme;
                        } else {
                            currentThemes.push(theme);
                        }
                    });
                })
            );
        },

        clearAllThemes: () => {
            this.state.set(draft => {
                draft.themes = [];
                draft.activeThemeId = null;
            });
        },
    };

    getThemeById(themeId: string): CustomTheme | undefined {
        return this.state.themes.find(t => t.id === themeId);
    }

    getActiveTheme(): CustomTheme | undefined {
        if (!this.state.activeThemeId) return undefined;
        return this.getThemeById(this.state.activeThemeId);
    }

    async rehydrate(): Promise<void> {
        await this.use.persist.rehydrate();
    }

    get hasHydrated(): boolean {
        return this.state.hydrated;
    }
}

const Store = new StoreClass();
export { Store as CustomThemeStore };
export { StoreClass as CustomThemeStoreClass };
