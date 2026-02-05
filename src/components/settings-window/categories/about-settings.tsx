import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";

export function AboutSettings() {
    const { t } = useTranslation();

    const appVersion = "0.6.5";
    const appName = "Biometrics Studio";

    return (
        <div className="flex flex-col gap-6 ml-1">
            <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">
                    {t("About")}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {t("Application information", { ns: "description" })}
                </p>
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1 p-4 rounded-lg border border-border/30 bg-background/50">
                    <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/logo.svg"
                            alt="Logo"
                            className="logo pointer-events-none select-none"
                            height={32}
                            width={32}
                        />
                        <div>
                            <h3 className="text-base font-semibold text-foreground">
                                {appName}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {t("Version", { ns: "keywords" })}: {appVersion}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-medium text-foreground">
                        {t("Description", { ns: "keywords" })}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                        {t("Application for forensic trace comparison", {
                            ns: "description",
                        })}
                    </p>
                </div>

                <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-medium text-foreground">
                        {t("Repository", { ns: "keywords" })}
                    </h4>
                    <a
                        href="https://github.com/BiometricsUBB/Biometrics-Studio"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:underline"
                    >
                        <ExternalLink size={14} />
                        GitHub
                    </a>
                </div>

                <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-medium text-foreground">
                        {t("Authors", { ns: "keywords" })}
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                        <li>Cyprian Zdebski</li>
                        <li>Konrad Boryś</li>
                        <li>Marcel Gańczarczyk</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
