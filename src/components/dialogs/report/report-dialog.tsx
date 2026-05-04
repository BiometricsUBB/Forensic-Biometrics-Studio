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
import { FileText, X, Check } from "lucide-react";
import { ICON } from "@/lib/utils/const";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { MarkingsStore } from "@/lib/stores/Markings";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { WORKING_MODE } from "@/views/selectMode";
import {
    formatReportDateTime,
    getMatchedFeatures,
    getPairedByLabel,
} from "@/lib/report/report-utils";
import { generateReportPdfWithDialog } from "@/lib/report/generate-report-pdf";
import { toast } from "sonner";
import { cn } from "@/lib/utils/shadcn";
import { showErrorDialog } from "@/lib/errors/showErrorDialog";
import { GlobalSettingsStore } from "@/lib/stores/GlobalSettings";
import i18n from "@/lib/locales/i18n";

type ReportDialogProps = {
    className?: string;
};

export function ReportDialog({ className }: ReportDialogProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [includeMatchedOnly, setIncludeMatchedOnly] = useState(true);

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

    const markingsLeft = MarkingsStore(CANVAS_ID.LEFT).use(state => state.markings);
    const markingsRight = MarkingsStore(CANVAS_ID.RIGHT).use(state => state.markings);

    const allFeatures = useMemo(() => {
        const labels = new Set([...markingsLeft.map(m => m.label), ...markingsRight.map(m => m.label)]);
        return Array.from(labels).sort((a, b) => a - b);
    },[markingsLeft, markingsRight]);

    const[selectedLabels, setSelectedLabels] = useState<number[]>([]);

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
        setSelectedLabels(allFeatures);
    }, [isOpen, reportDefaults, allFeatures]);

    const toggleFeature = (label: number) => {
        setSelectedLabels(prev => 
            prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
        );
    };

    const matchedFeaturesCount = useMemo(() => 
        getMatchedFeatures(markingsLeft, markingsRight).length,[markingsLeft, markingsRight]);

    const generateReportLabel = t("Generate report", { ns: "keywords" });
    const workingMode = WorkingModeStore.use(state => state.workingMode);
    const canGenerate =
        workingMode === WORKING_MODE.FINGERPRINT &&
        markingsLeft.length > 0 &&
        markingsRight.length > 0;

    const onGenerate = async () => {
        if (!canGenerate) return;
        try {
            setIsGenerating(true);
            const now = new Date();
            const timestamp = formatReportDateTime(now);
            await generateReportPdfWithDialog({
                includeMatchedOnly,
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
                selectedLabels,
            });
            toast.success(t("Report generated", { ns: "tooltip" }));
            setIsOpen(false);
        } catch (error) {
            // eslint-disable-next-line no-console
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
                <DialogOverlay className="bg-black/40 backdrop-blur-sm" />
                <DialogContent className="w-[880px] max-w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border shadow-2xl">
                    
                    <div className="flex flex-col gap-1.5 p-6 sm:px-8 pb-4 border-b border-border bg-muted/10 shrink-0">
                        <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                            {t("Report generation", { ns: "keywords" })}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            {t("Generate PDF report", { ns: "description" })}
                        </DialogDescription>
                    </div>

                    <div className="flex-1 min-h-0 overflow-hidden p-6 sm:px-8 grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-8 bg-background">
                        
                        <div className="flex flex-col space-y-5 pb-2">
                            <div className="grid grid-cols-2 gap-4">
    <div className="flex flex-col justify-end space-y-1.5">
        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            {t("Language", { ns: "keywords" })}
        </label>
        <select
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm hover:border-primary/50 focus:ring-2 focus:ring-primary focus:outline-none transition-all cursor-pointer"
            value={reportLanguage}
            onChange={e => setReportLanguage(e.target.value)}
        >
            <option value="pl">Polski</option>
            <option value="en">English</option>
        </select>
    </div>

    <div className="flex flex-col justify-end space-y-1.5">
        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            {t("Report date and time", { ns: "keywords" })}
        </label>
        <Input 
            value={reportDateTime} 
            readOnly 
            className="flex h-10 w-full rounded-md border border-input/60 bg-muted/40 cursor-not-allowed text-sm shadow-sm text-muted-foreground" 
        />
    </div>
</div>

                            <div className="flex flex-col space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                    {t("Performed by", { ns: "keywords" })}
                                </label>
                                <Input 
                                    value={performedBy} 
                                    onChange={e => setPerformedBy(e.target.value)} 
                                    className="flex h-10 w-full rounded-md border border-input bg-background shadow-sm hover:border-primary/50 transition-colors" 
                                />
                            </div>

                            <div className="flex flex-col space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                    {t("Department", { ns: "keywords" })}
                                </label>
                                <Input 
                                    value={department} 
                                    onChange={e => setDepartment(e.target.value)} 
                                    className="flex h-10 w-full rounded-md border border-input bg-background shadow-sm hover:border-primary/50 transition-colors" 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-1">
                                <div className="flex flex-col space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                        {t("Address line 1", { ns: "keywords" })}
                                    </label>
                                    <Input 
                                        value={addressLine1} 
                                        onChange={e => setAddressLine1(e.target.value)} 
                                        className="flex h-10 w-full rounded-md border border-input bg-background shadow-sm hover:border-primary/50 transition-colors" 
                                    />
                                </div>
                                <div className="flex flex-col space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                        {t("Address line 2", { ns: "keywords" })}
                                    </label>
                                    <Input 
                                        value={addressLine2} 
                                        onChange={e => setAddressLine2(e.target.value)} 
                                        className="flex h-10 w-full rounded-md border border-input bg-background shadow-sm hover:border-primary/50 transition-colors" 
                                    />
                                </div>
                                <div className="flex flex-col space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                        {t("Address line 3", { ns: "keywords" })}
                                    </label>
                                    <Input 
                                        value={addressLine3} 
                                        onChange={e => setAddressLine3(e.target.value)} 
                                        className="flex h-10 w-full rounded-md border border-input bg-background shadow-sm hover:border-primary/50 transition-colors" 
                                    />
                                </div>
                                <div className="flex flex-col space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                        {t("Address line 4", { ns: "keywords" })}
                                    </label>
                                    <Input 
                                        value={addressLine4} 
                                        onChange={e => setAddressLine4(e.target.value)} 
                                        className="flex h-10 w-full rounded-md border border-input bg-background shadow-sm hover:border-primary/50 transition-colors" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col space-y-4 min-h-0">
                            <div className="bg-card p-4 rounded-lg border border-border flex justify-between items-center shadow-sm shrink-0">
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                        {t("Matched features", { ns: "keywords" })}
                                    </span>
                                    <span className="text-2xl font-bold text-foreground">
                                        {matchedFeaturesCount}
                                    </span>
                                </div>
                                <div className="w-px h-10 bg-border"></div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                        {t("Selected features", { ns: "keywords" })}
                                    </span>
                                    <span className="text-2xl font-bold text-primary">
                                        {selectedLabels.length} <span className="text-muted-foreground text-lg">/ {allFeatures.length}</span>
                                    </span>
                                </div>
                            </div>
                            
                            <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium w-max hover:text-primary transition-colors shrink-0">
                                <div className="relative flex items-center justify-center">
                                    <input
                                        type="checkbox"
                                        className="peer appearance-none w-4 h-4 border border-input rounded-sm bg-background checked:bg-primary checked:border-primary transition-all cursor-pointer shadow-sm"
                                        checked={includeMatchedOnly}
                                        onChange={e => setIncludeMatchedOnly(e.target.checked)}
                                    />
                                    <Check className="absolute w-3 h-3 text-primary-foreground opacity-0 peer-checked:opacity-100 pointer-events-none" strokeWidth={3} />
                                </div>
                                {t("Include matched only", { ns: "keywords" })}
                            </label>

                            <div className="flex-1 min-h-0 rounded-lg border border-border bg-muted/5 p-2 overflow-y-auto custom-scrollbar shadow-inner">
                                <div className="grid grid-cols-2 gap-2">
                                    {allFeatures.map((label) => {
                                        const left = markingsLeft.find(m => m.label === label);
                                        const right = markingsRight.find(m => m.label === label);
                                        const isSelected = selectedLabels.includes(label);

                                        return (
                                            <div 
                                                key={label}
                                                onClick={() => toggleFeature(label)}
                                                className={cn(
                                                    "flex flex-col gap-2 p-3 rounded-md border cursor-pointer transition-all duration-200 select-none bg-background",
                                                    isSelected 
                                                        ? "border-primary ring-1 ring-primary/20 shadow-sm" 
                                                        : "border-border hover:border-primary/50 hover:bg-muted/30 opacity-80"
                                                )}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className={cn(
                                                        "w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors shadow-sm", 
                                                        isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-card border-input"
                                                    )}>
                                                        {isSelected && <Check size={12} strokeWidth={3} />}
                                                    </div>
                                                    <span className={cn(
                                                        "text-sm font-semibold truncate",
                                                        isSelected ? "text-foreground" : "text-muted-foreground"
                                                    )}>
                                                        {t("Feature", { ns: "keywords" })} #{label}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between pl-6.5 text-xs font-medium">
                                                    <span className={cn("px-1.5 py-0.5 rounded-sm border", left ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-muted/50 border-border/50 text-muted-foreground")}>
                                                        L: {left ? "OK" : "—"}
                                                    </span>
                                                    <span className={cn("px-1.5 py-0.5 rounded-sm border", right ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-muted/50 border-border/50 text-muted-foreground")}>
                                                        R: {right ? "OK" : "—"}
                                                    </span>
                                                </div>
                                            </div>  
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 sm:px-8 border-t border-border bg-muted/10 flex justify-end gap-3 shrink-0">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" className="w-28 shadow-sm">
                                {t("Cancel", { ns: "keywords" })}
                            </Button>
                        </DialogClose>
                        <Button
                            type="button"
                            onClick={onGenerate}
                            className="w-44 shadow-sm"
                            disabled={!canGenerate || isGenerating || selectedLabels.length === 0}
                        >
                            {isGenerating
                                ? t("Generating...", { ns: "keywords" })
                                : generateReportLabel}
                        </Button>
                    </div>

                    <DialogClose className="absolute top-6 right-6 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none text-muted-foreground hover:bg-muted p-1">
                        <X size={20} strokeWidth={ICON.STROKE_WIDTH} />
                    </DialogClose>
                </DialogContent>
            </DialogPortal>
        </Dialog>
    );
}