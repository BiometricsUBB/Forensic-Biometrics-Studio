import { useEffect, useState } from "react";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { FileText, X } from "lucide-react";
import { ICON } from "@/lib/utils/const";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { MarkingsStore } from "@/lib/stores/Markings";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { WORKING_MODE } from "@/views/selectMode";
import {
    formatReportDateTime,
    getPairedByLabel,
} from "@/lib/report/report-utils";
import { generateShoeprintReportPdfWithDialog } from "@/lib/report/generate-report-shoeprint-pdf";
import { toast } from "sonner";
import { cn } from "@/lib/utils/shadcn";
import { showErrorDialog } from "@/lib/errors/showErrorDialog";
import { GlobalSettingsStore } from "@/lib/stores/GlobalSettings";
import i18n from "@/lib/locales/i18n";

type ReportShoeprintDialogProps = {
    className?: string;
};

export function ReportShoeprintDialog({
    className,
}: ReportShoeprintDialogProps) {
    const { t } = useTranslation("keywords");
    const [isOpen, setIsOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const reportDefaults = GlobalSettingsStore.use(
        state => state.settings.report
    );

    const [reportDateTime, setReportDateTime] = useState(() =>
        formatReportDateTime(new Date())
    );
    const [performedBy, setPerformedBy] = useState("");
    const [department, setDepartment] = useState("");
    const [addressLine1, setAddressLine1] = useState("");
    const [addressLine2, setAddressLine2] = useState("");
    const [addressLine3, setAddressLine3] = useState("");
    const [addressLine4, setAddressLine4] = useState("");
    const [reportLanguage, setReportLanguage] = useState(i18n.language);
    const [reportTitle, setReportTitle] = useState("");
    const [uniqueColor, setUniqueColor] = useState<"red" | "green">("red");

    useEffect(() => {
        if (!isOpen) return;
        setReportDateTime(formatReportDateTime(new Date()));
        setPerformedBy(reportDefaults?.performedBy ?? "");
        setDepartment(reportDefaults?.department ?? "");
        setAddressLine1(reportDefaults?.addressLine1 ?? "");
        setAddressLine2(reportDefaults?.addressLine2 ?? "");
        setAddressLine3(reportDefaults?.addressLine3 ?? "");
        setAddressLine4(reportDefaults?.addressLine4 ?? "");
        setReportLanguage(i18n.language);
        setReportTitle(t("Shoeprint report title", { ns: "report" }));
    }, [isOpen, reportDefaults]);

    const workingMode = WorkingModeStore.use(state => state.workingMode);
    const markingsLeft = MarkingsStore(CANVAS_ID.LEFT).use(
        state => state.markings
    );
    const markingsRight = MarkingsStore(CANVAS_ID.RIGHT).use(
        state => state.markings
    );
    const leftCount = markingsLeft.length;
    const rightCount = markingsRight.length;
    const pairedCount = getPairedByLabel(markingsLeft, markingsRight).length;

    const generateReportLabel = t("Generate report", { ns: "keywords" });

    const canGenerate =
        workingMode === WORKING_MODE.SHOEPRINT &&
        leftCount > 0 &&
        rightCount > 0 &&
        pairedCount > 0;

    const onGenerate = async () => {
        if (!canGenerate) return;
        try {
            setIsGenerating(true);
            const now = new Date();
            const timestamp = formatReportDateTime(now);
            setReportDateTime(timestamp);
            await generateShoeprintReportPdfWithDialog({
                reportDateTime: timestamp,
                reportLanguage,
                performedBy: performedBy.trim(),
                department: department.trim(),
                addressLines: [
                    addressLine1.trim(),
                    addressLine2.trim(),
                    addressLine3.trim(),
                    addressLine4.trim(),
                ],
                uniqueColor,
                reportTitle: reportTitle.trim() || undefined,
            });
            toast.success(t("Report generated", { ns: "tooltip" }));
            setIsOpen(false);
        } catch (error) {
            console.error(error);
            const message =
                error instanceof Error ? error.message : String(error);
            showErrorDialog(
                `${t("Failed to generate report", { ns: "tooltip" })}: ${message}`,
                "error"
            );
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger
                className={cn(
                    "w-full justify-start gap-2 h-auto min-h-[40px] py-2 px-3 border border-input rounded-md",
                    "hover:bg-accent hover:text-accent-foreground transition-colors",
                    "flex items-center",
                    className
                )}
                onClick={() => setIsOpen(true)}
                disabled={!canGenerate}
                title={generateReportLabel}
            >
                <FileText
                    className="flex-shrink-0"
                    size={ICON.SIZE}
                    strokeWidth={ICON.STROKE_WIDTH}
                />
                <span className="text-sm text-left leading-tight">
                    {generateReportLabel}
                </span>
            </DialogTrigger>

            <DialogPortal>
                <DialogOverlay />
                <DialogContent className="w-[640px] max-w-[92vw] max-h-[90vh] flex flex-col">
                    <DialogTitle className="text-lg font-semibold">
                        {t("Report generation", { ns: "keywords" })}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        {t("Generate PDF report", { ns: "description" })}
                    </DialogDescription>

                    <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                        <div className="grid gap-3">
                            <div className="grid gap-1 text-sm">
                                <div>
                                    {t("Shoeprint markings left", {
                                        ns: "keywords",
                                    })}
                                    : <strong>{leftCount}</strong>
                                </div>
                                <div>
                                    {t("Shoeprint markings right", {
                                        ns: "keywords",
                                    })}
                                    : <strong>{rightCount}</strong>
                                </div>
                                <div>
                                    {t("Shoeprint paired features count", { ns: "report" })}: <strong>{pairedCount}</strong>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor="shoeprint-report-title" className="text-sm font-medium">
                                        {t("Report title", { ns: "keywords" })}
                                    </label>
                                    <Input
                                        id="shoeprint-report-title"
                                        value={reportTitle}
                                        onChange={e => setReportTitle(e.target.value)}
                                        placeholder={t("Shoeprint report title", { ns: "report" })}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="shoeprint-report-language"
                                        className="text-sm font-medium"
                                    >
                                        {t("Language", { ns: "keywords" })}
                                    </label>
                                    <select
                                        id="shoeprint-report-language"
                                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                        value={reportLanguage}
                                        onChange={e =>
                                            setReportLanguage(e.target.value)
                                        }
                                    >
                                        <option value="pl">Polski</option>
                                        <option value="en">English</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium">
                                        {t("Unique features color", { ns: "keywords" })}
                                    </label>
                                    <select
                                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                        value={uniqueColor}
                                        onChange={e => setUniqueColor(e.target.value as "red" | "green")}
                                    >
                                        <option value="red">{t("Color red", { ns: "keywords" })}</option>
                                        <option value="green">{t("Color green", { ns: "keywords" })}</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="shoeprint-report-datetime"
                                        className="text-sm font-medium"
                                    >
                                        {t("Report date and time", {
                                            ns: "keywords",
                                        })}
                                    </label>
                                    <Input
                                        id="shoeprint-report-datetime"
                                        value={reportDateTime}
                                        readOnly
                                        placeholder="30.12.2025 - 15:28:31"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="shoeprint-report-performed-by"
                                        className="text-sm font-medium"
                                    >
                                        {t("Performed by", { ns: "keywords" })}
                                    </label>
                                    <Input
                                        id="shoeprint-report-performed-by"
                                        value={performedBy}
                                        onChange={e =>
                                            setPerformedBy(e.target.value)
                                        }
                                        placeholder="Jan Kowalski"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="shoeprint-report-department"
                                        className="text-sm font-medium"
                                    >
                                        {t("Department", { ns: "keywords" })}
                                    </label>
                                    <Input
                                        id="shoeprint-report-department"
                                        value={department}
                                        onChange={e =>
                                            setDepartment(e.target.value)
                                        }
                                        placeholder="Wydział Badań Traseologicznych"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="shoeprint-report-address-1"
                                        className="text-sm font-medium"
                                    >
                                        {t("Address line 1", {
                                            ns: "keywords",
                                        })}
                                    </label>
                                    <Input
                                        id="shoeprint-report-address-1"
                                        value={addressLine1}
                                        onChange={e =>
                                            setAddressLine1(e.target.value)
                                        }
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="shoeprint-report-address-2"
                                        className="text-sm font-medium"
                                    >
                                        {t("Address line 2", {
                                            ns: "keywords",
                                        })}
                                    </label>
                                    <Input
                                        id="shoeprint-report-address-2"
                                        value={addressLine2}
                                        onChange={e =>
                                            setAddressLine2(e.target.value)
                                        }
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="shoeprint-report-address-3"
                                        className="text-sm font-medium"
                                    >
                                        {t("Address line 3", {
                                            ns: "keywords",
                                        })}
                                    </label>
                                    <Input
                                        id="shoeprint-report-address-3"
                                        value={addressLine3}
                                        onChange={e =>
                                            setAddressLine3(e.target.value)
                                        }
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="shoeprint-report-address-4"
                                        className="text-sm font-medium"
                                    >
                                        {t("Address line 4", {
                                            ns: "keywords",
                                        })}
                                    </label>
                                    <Input
                                        id="shoeprint-report-address-4"
                                        value={addressLine4}
                                        onChange={e =>
                                            setAddressLine4(e.target.value)
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-between shrink-0">
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                {t("Cancel", { ns: "keywords" })}
                            </Button>
                        </DialogClose>
                        <Button
                            type="button"
                            onClick={onGenerate}
                            disabled={!canGenerate || isGenerating}
                        >
                            {isGenerating
                                ? t("Generating...", { ns: "keywords" })
                                : generateReportLabel}
                        </Button>
                    </div>

                    <DialogClose className="absolute top-3 right-3">
                        <X size={ICON.SIZE} strokeWidth={ICON.STROKE_WIDTH} />
                    </DialogClose>
                </DialogContent>
            </DialogPortal>
        </Dialog>
    );
}
