import { produce } from "immer";
import { ActionProduceCallback } from "../immer.helpers";
import {
    GlobalSettingsState as State,
    _useGlobalSettingsStore as useStore,
} from "./GlobalSettings.store";

class StoreClass {
    readonly use = useStore;

    get state() {
        return this.use.getState();
    }

    private setLanguageSettings(
        callback: ActionProduceCallback<State["settings"]["language"], State>
    ) {
        this.state.set(draft => {
            draft.settings.language = callback(draft.settings.language, draft);
        });
    }

    private setInterfaceSettings(
        callback: ActionProduceCallback<State["settings"]["interface"], State>
    ) {
        this.state.set(draft => {
            draft.settings.interface = callback(
                draft.settings.interface,
                draft
            );
        });
    }

    private setReportSettings(
        callback: ActionProduceCallback<State["settings"]["report"], State>
    ) {
        this.state.set(draft => {
            draft.settings.report = callback(draft.settings.report, draft);
        });
    }

    readonly actions = {
        settings: {
            language: {
                /** Updates the language state in the store ONLY.
                 *
                 * To change the application's language, use useTranslation().i18n.changeLanguage.
                 */
                setLanguage: (newLanguage: State["settings"]["language"]) => {
                    this.setLanguageSettings(() => newLanguage);
                },
            },
            interface: {
                /** Updates the theme state in the store ONLY.
                 *
                 * To change the application's theme, use useTheme().setTheme.
                 */
                setTheme: (
                    newTheme: State["settings"]["interface"]["theme"]
                ) => {
                    this.setInterfaceSettings(
                        produce(settings => {
                            settings.theme = newTheme;
                        })
                    );
                },
            },
            report: {
                setReportSettings: (
                    newSettings: State["settings"]["report"]
                ) => {
                    this.setReportSettings(() => newSettings);
                },
                updateReportSettings: (
                    patch: Partial<State["settings"]["report"]>
                ) => {
                    this.setReportSettings(
                        produce(settings => {
                            Object.assign(settings, patch);
                        })
                    );
                },
            },
        },
    };
}

const Store = new StoreClass();
export { Store as GlobalSettingsStore };
export { StoreClass as GlobalSettingsStoreClass };
