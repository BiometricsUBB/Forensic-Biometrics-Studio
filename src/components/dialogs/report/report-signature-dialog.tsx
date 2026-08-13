import { useEffect, useMemo, useState } from "react";
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
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { WORKING_MODE } from "@/views/selectMode";
import { formatReportDateTime } from "@/lib/report/report-utils";
import { computeSignatureParams } from "@/lib/signature/signature-params";
import { generateSignatureReportPdfWithDialog } from "@/lib/report/generate-signature-report-pdf";
import { toast } from "sonner";
import { cn } from "@/lib/utils/shadcn";
import { showErrorDialog } from "@/lib/errors/showErrorDialog";
import { GlobalSettingsStore } from "@/lib/stores/GlobalSettings";
import i18n from "@/lib/locales/i18n";

type ReportSignatureDialogProps = {
    className?: string;
};

export function ReportSignatureDialog({
    className,
}: ReportSignatureDialogProps) {
    const { t } = useTranslation();
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
    }, [isOpen, reportDefaults]);

    const workingMode = WorkingModeStore.use(state => state.workingMode);
    const isSignatureMode = workingMode === WORKING_MODE.SIGNATURE;

    const leftHash = MarkingsStore(CANVAS_ID.LEFT).use(
        state => state.markingsHash
    );
    const rightHash = MarkingsStore(CANVAS_ID.RIGHT).use(
        state => state.markingsHash
    );
    const markingTypes = MarkingTypesStore.use(state => state.types);

    const signatureReady = useMemo(() => {
        if (!isSignatureMode) return false;
        const left = computeSignatureParams(
            MarkingsStore(CANVAS_ID.LEFT).state.markings,
            markingTypes
        );
        const right = computeSignatureParams(
            MarkingsStore(CANVAS_ID.RIGHT).state.markings,
            markingTypes
        );
        return left.hasOutline && right.hasOutline;
        // leftHash/rightHash change on any marking mutation (add/remove/retype/move),
        // so readiness never goes stale when the marking count is unchanged.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [isSignatureMode, markingTypes, leftHash, rightHash]);

    const generateReportLabel = t("Generate report", { ns: "keywords" });
    const canGenerate = isSignatureMode && signatureReady;

    const onGenerate = async () => {
        if (!canGenerate) return;
        try {
            setIsGenerating(true);
            const now = new Date();
            const timestamp = formatReportDateTime(now);
            setReportDateTime(timestamp);
            await generateSignatureReportPdfWithDialog({
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
            });
            toast.success(t("Report generated", { ns: "tooltip" }));
            setIsOpen(false);
        } catch (error) {
            console.error(error);
            const message =
                error instanceof Error ? error.message : String(error);
            toast.error(
                `${t("Failed to generate report", { ns: "tooltip" })}: ${message}`
            );
            showErrorDialog(message, "error");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger
                className={cn(
                    "w-full justify-start gap-2 h-auto min-h-10 py-2 px-3 border border-input rounded-md",
                    "hover:bg-accent hover:text-accent-foreground transition-colors",
                    "flex items-center",
                    className
                )}
                onClick={() => setIsOpen(true)}
                disabled={!canGenerate}
                title={generateReportLabel}
            >
                <FileText
                    className="shrink-0"
                    size={ICON.SIZE}
                    strokeWidth={ICON.STROKE_WIDTH}
                />
                <span className="text-sm text-left leading-tight">
                    {generateReportLabel}
                </span>
            </DialogTrigger>

            <DialogPortal>
                <DialogOverlay />
                <DialogContent className="w-160 max-w-[92vw] max-h-[90vh] flex flex-col">
                    <DialogTitle className="text-lg font-semibold">
                        {t("Report generation", { ns: "keywords" })}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        {t("Generate PDF report", { ns: "description" })}
                    </DialogDescription>

                    <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                        <div className="grid gap-3">
                            <div className="grid grid-cols-1 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="report-language"
                                        className="text-sm font-medium"
                                    >
                                        {t("Language", { ns: "keywords" })}
                                    </label>
                                    <select
                                        id="report-language"
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
                                    <label
                                        htmlFor="report-datetime"
                                        className="text-sm font-medium"
                                    >
                                        {t("Report date and time", {
                                            ns: "keywords",
                                        })}
                                    </label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="report-datetime"
                                            value={reportDateTime}
                                            readOnly
                                            placeholder="30.12.2025 - 15:28:31"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="report-performed-by"
                                        className="text-sm font-medium"
                                    >
                                        {t("Performed by", { ns: "keywords" })}
                                    </label>
                                    <Input
                                        id="report-performed-by"
                                        value={performedBy}
                                        onChange={e =>
                                            setPerformedBy(e.target.value)
                                        }
                                        placeholder="Jan Kowalski"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="report-department"
                                        className="text-sm font-medium"
                                    >
                                        {t("Department", { ns: "keywords" })}
                                    </label>
                                    <Input
                                        id="report-department"
                                        value={department}
                                        onChange={e =>
                                            setDepartment(e.target.value)
                                        }
                                        placeholder="Wydział Badań Daktyloskopijnych i Traseologicznych"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="report-address-1"
                                        className="text-sm font-medium"
                                    >
                                        {t("Address line 1", {
                                            ns: "keywords",
                                        })}
                                    </label>
                                    <Input
                                        id="report-address-1"
                                        value={addressLine1}
                                        onChange={e =>
                                            setAddressLine1(e.target.value)
                                        }
                                        placeholder="ul. Miła 1"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="report-address-2"
                                        className="text-sm font-medium"
                                    >
                                        {t("Address line 2", {
                                            ns: "keywords",
                                        })}
                                    </label>
                                    <Input
                                        id="report-address-2"
                                        value={addressLine2}
                                        onChange={e =>
                                            setAddressLine2(e.target.value)
                                        }
                                        placeholder="02-520 Warszawa"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="report-address-3"
                                        className="text-sm font-medium"
                                    >
                                        {t("Address line 3", {
                                            ns: "keywords",
                                        })}
                                    </label>
                                    <Input
                                        id="report-address-3"
                                        value={addressLine3}
                                        onChange={e =>
                                            setAddressLine3(e.target.value)
                                        }
                                        placeholder=""
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="report-address-4"
                                        className="text-sm font-medium"
                                    >
                                        {t("Address line 4", {
                                            ns: "keywords",
                                        })}
                                    </label>
                                    <Input
                                        id="report-address-4"
                                        value={addressLine4}
                                        onChange={e =>
                                            setAddressLine4(e.target.value)
                                        }
                                        placeholder=""
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
