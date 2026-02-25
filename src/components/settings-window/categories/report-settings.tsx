import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { GlobalSettingsStore } from "@/lib/stores/GlobalSettings";
import { emitSettingsChange } from "@/lib/hooks/useSettingsSync";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_REPORT_SETTINGS = {
    performedBy: "Jan Kowalski",
    department: "Wydział Badań Daktyloskopijnych i Traseologicznych",
    addressLine1: "ul. Miła 1",
    addressLine2: "02-520 Warszawa",
    addressLine3: "",
    addressLine4: "",
};

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

const stripDiacritics = (value: string) => value;

export function ReportSettings() {
    const { t } = useTranslation();
    const reportSettings =
        GlobalSettingsStore.use(state => state.settings.report) ??
        DEFAULT_REPORT_SETTINGS;

    useEffect(() => {
        const current = GlobalSettingsStore.state.settings.report;
        if (!current) {
            GlobalSettingsStore.actions.settings.report.setReportSettings(
                DEFAULT_REPORT_SETTINGS
            );
            return;
        }
        const normalized = { ...DEFAULT_REPORT_SETTINGS, ...current };
        const decoded = {
            ...normalized,
            performedBy: decodeUnicodeEscapes(
                decodeUnicodeEscapes(normalized.performedBy ?? "")
            ),
            department: decodeUnicodeEscapes(
                decodeUnicodeEscapes(normalized.department ?? "")
            ),
            addressLine1: decodeUnicodeEscapes(
                decodeUnicodeEscapes(normalized.addressLine1 ?? "")
            ),
            addressLine2: decodeUnicodeEscapes(
                decodeUnicodeEscapes(normalized.addressLine2 ?? "")
            ),
            addressLine3: decodeUnicodeEscapes(
                decodeUnicodeEscapes(normalized.addressLine3 ?? "")
            ),
            addressLine4: decodeUnicodeEscapes(
                decodeUnicodeEscapes(normalized.addressLine4 ?? "")
            ),
        };
        const needsUpdate =
            current.addressLine3 === undefined ||
            current.addressLine4 === undefined ||
            current.addressLine2 === undefined ||
            current.addressLine1 === undefined ||
            current.department === undefined ||
            current.performedBy === undefined;
        GlobalSettingsStore.actions.settings.report.setReportSettings(decoded);
    }, []);

    const updateReportSettings = async (
        patch: Partial<typeof reportSettings>
    ) => {
        const next = { ...reportSettings, ...patch };
        GlobalSettingsStore.actions.settings.report.setReportSettings(next);
        await emitSettingsChange({ type: "report", value: next });
    };

    return (
        <div className="flex flex-col gap-4 ml-1">
            <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">
                    {t("Report settings")}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {t("Configure default report data", { ns: "description" })}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="report-performed-by">
                        {t("Performed by", { ns: "keywords" })}
                    </Label>
                    <Input
                        id="report-performed-by"
                        value={decodeUnicodeEscapes(reportSettings.performedBy ?? "")}
                        onChange={e =>
                            updateReportSettings({
                                performedBy: e.target.value,
                            })
                        }
                        placeholder="Jan Kowalski"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="report-department">
                        {t("Department", { ns: "keywords" })}
                    </Label>
                    <Input
                        id="report-department"
                        value={decodeUnicodeEscapes(reportSettings.department ?? "")}
                        onChange={e =>
                            updateReportSettings({
                                department: e.target.value,
                            })
                        }
                        placeholder="Wydzia\u0142 Bada\u0144 Daktyloskopijnych i Traseologicznych"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="report-address-1">
                        {t("Address line 1", { ns: "keywords" })}
                    </Label>
                    <Input
                        id="report-address-1"
                        value={decodeUnicodeEscapes(reportSettings.addressLine1 ?? "")}
                        onChange={e =>
                            updateReportSettings({
                                addressLine1: e.target.value,
                            })
                        }
                        placeholder="ul. Mi\u0142a 1"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="report-address-2">
                        {t("Address line 2", { ns: "keywords" })}
                    </Label>
                    <Input
                        id="report-address-2"
                        value={decodeUnicodeEscapes(reportSettings.addressLine2 ?? "")}
                        onChange={e =>
                            updateReportSettings({
                                addressLine2: e.target.value,
                            })
                        }
                        placeholder="02-520 Warszawa"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="report-address-3">
                        {t("Address line 3", { ns: "keywords" })}
                    </Label>
                    <Input
                        id="report-address-3"
                        value={decodeUnicodeEscapes(reportSettings.addressLine3 ?? "")}
                        onChange={e =>
                            updateReportSettings({
                                addressLine3: e.target.value,
                            })
                        }
                        placeholder=""
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="report-address-4">
                        {t("Address line 4", { ns: "keywords" })}
                    </Label>
                    <Input
                        id="report-address-4"
                        value={decodeUnicodeEscapes(reportSettings.addressLine4 ?? "")}
                        onChange={e =>
                            updateReportSettings({
                                addressLine4: e.target.value,
                            })
                        }
                        placeholder=""
                    />
                </div>
            </div>
        </div>
    );
}
