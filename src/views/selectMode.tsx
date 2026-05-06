import React from "react";
import { useTranslation } from "react-i18next";
import {
    ArrowRight,
    Ear,
    Fingerprint,
    Footprints,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/shadcn";

export enum WORKING_MODE {
    FINGERPRINT = "FINGERPRINT",
    EAR = "EAR",
    SHOEPRINT = "SHOEPRINT",
}

interface ISelectModeProps {
    setCurrentWorkingMode: (mode: WORKING_MODE) => void;
}

const MODE_ICONS: Record<WORKING_MODE, LucideIcon> = {
    [WORKING_MODE.FINGERPRINT]: Fingerprint,
    [WORKING_MODE.EAR]: Ear,
    [WORKING_MODE.SHOEPRINT]: Footprints,
};

export default function SelectMode({
    setCurrentWorkingMode,
}: ISelectModeProps) {
    const { t } = useTranslation();
    const modes = Object.values(WORKING_MODE);

    return (
        <main className="relative z-10 w-full flex flex-col items-center justify-center px-8">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(circle_at_1px_1px,hsl(var(--foreground)/0.12)_1px,transparent_0)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_75%_65%_at_center,black,transparent_90%)]"
            />

            <svg
                aria-hidden="true"
                viewBox="0 0 200 200"
                className="pointer-events-none absolute -top-48 -right-40 size-96 -z-10 text-primary/30"
            >
                <g fill="none" stroke="currentColor" strokeWidth="1">
                    <circle cx="100" cy="100" r="30" />
                    <circle cx="100" cy="100" r="50" strokeDasharray="2 4" />
                    <circle cx="100" cy="100" r="72" />
                    <circle
                        cx="100"
                        cy="100"
                        r="92"
                        strokeDasharray="1 6"
                        transform="rotate(0.5 100 100)"
                    />
                </g>
                <g stroke="currentColor" strokeWidth="1" strokeLinecap="round">
                    <line x1="100" y1="4" x2="100" y2="14" />
                    <line x1="100" y1="186" x2="100" y2="196" />
                    <line x1="4" y1="100" x2="14" y2="100" />
                    <line x1="186" y1="100" x2="196" y2="100" />
                </g>
                <circle cx="100" cy="100" r="2" fill="currentColor" />
            </svg>

            <svg
                aria-hidden="true"
                viewBox="0 0 120 120"
                className="pointer-events-none absolute bottom-8 left-8 size-32 -z-10 text-primary/15"
            >
                <g
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                >
                    <path d="M10 10 L10 30 M10 10 L30 10" />
                    <path d="M110 10 L110 30 M110 10 L90 10" />
                    <path d="M10 110 L10 90 M10 110 L30 110" />
                    <path d="M110 110 L110 90 M110 110 L90 110" />
                </g>
            </svg>

            <div className="w-full max-w-2xl">
                <header className="text-center mb-14 animate-in fade-in slide-in-from-bottom-2 duration-700 fill-mode-both">
                    <p className="font-mono text-[11px] tracking-[0.3em] text-muted-foreground uppercase mb-5">
                        Forensic Biometrics Studio
                    </p>
                    <h1 className="text-5xl font-semibold text-foreground tracking-tight leading-[1.05]">
                        {t("Please select your working mode", { ns: "dialog" })}
                    </h1>
                </header>

                <div className="flex flex-col gap-2">
                    {modes.map((mode, index) => {
                        const Icon = MODE_ICONS[mode];
                        return (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => setCurrentWorkingMode(mode)}
                                aria-label={t(mode, { ns: "modes" })}
                                style={{
                                    animationDelay: `${150 + index * 90}ms`,
                                }}
                                className={cn(
                                    "group relative flex items-stretch overflow-hidden h-20",
                                    "rounded-md border border-border bg-card/40 backdrop-blur-xs",
                                    "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both",
                                    "transition-[transform,border-color,background-color] duration-300 ease-out",
                                    "hover:border-primary hover:bg-card/70",
                                    "active:scale-[0.995]",
                                    "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                )}
                            >
                                <div
                                    aria-hidden="true"
                                    className={cn(
                                        "flex items-center justify-center w-20 shrink-0 border-r border-border",
                                        "bg-primary/10 text-primary",
                                        "transition-colors duration-300",
                                        "group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary"
                                    )}
                                >
                                    <Icon size={26} strokeWidth={1.75} />
                                </div>

                                <div className="flex-1 flex items-center justify-between pl-6 pr-5">
                                    <span className="text-xl font-medium text-foreground tracking-tight">
                                        {t(mode, { ns: "modes" })}
                                    </span>
                                    <ArrowRight
                                        size={18}
                                        strokeWidth={2}
                                        aria-hidden="true"
                                        className="text-muted-foreground -translate-x-2 transition-all duration-300 ease-out group-hover:text-primary group-hover:translate-x-0"
                                    />
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </main>
    );
}
