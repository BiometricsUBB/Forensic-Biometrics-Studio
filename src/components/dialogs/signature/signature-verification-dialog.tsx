import { useMemo, useState } from "react";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, X } from "lucide-react";
import { ICON } from "@/lib/utils/const";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { MarkingsStore } from "@/lib/stores/Markings";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { computeSignatureParams } from "@/lib/signature/signature-params";
import {
    compareSignatures,
    getComparisonReadiness,
} from "@/lib/signature/signature-comparison";
import { showErrorDialog } from "@/lib/errors/showErrorDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils/shadcn";

type SignatureVerificationDialogProps = {
    className?: string;
};

const NO_VALUE = "—";
const formatInteger = (value: number | null) =>
    value === null ? NO_VALUE : Math.round(value).toLocaleString();
const formatDecimal = (value: number | null) =>
    value === null ? NO_VALUE : value.toFixed(2);
const formatPercent = (value: number | null) =>
    value === null ? NO_VALUE : `${value.toFixed(2)} %`;

export function SignatureVerificationDialog({
    className,
}: SignatureVerificationDialogProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const leftHash = MarkingsStore(CANVAS_ID.LEFT).use(
        state => state.markingsHash
    );
    const rightHash = MarkingsStore(CANVAS_ID.RIGHT).use(
        state => state.markingsHash
    );
    const types = MarkingTypesStore.use(state => state.types);

    const { paramsA, paramsB, comparison, readiness } = useMemo(() => {
        const a = computeSignatureParams(
            MarkingsStore(CANVAS_ID.LEFT).state.markings,
            types
        );
        const b = computeSignatureParams(
            MarkingsStore(CANVAS_ID.RIGHT).state.markings,
            types
        );
        return {
            paramsA: a,
            paramsB: b,
            comparison: compareSignatures(a, b),
            readiness: getComparisonReadiness(a, b),
        };
        // leftHash/rightHash drive recomputation as markings change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leftHash, rightHash, types]);

    const verificationLabel = t("Verification result", { ns: "keywords" });

    const handleOpen = () => {
        if (!readiness.ready) {
            const popupMessage = t(
                "To compute the verification result, draw a signature outline (polygon) on both image A and image B.",
                { ns: "dialog" }
            );
            showErrorDialog(popupMessage, "warning");
            toast.warning(popupMessage);
            return;
        }
        setIsOpen(true);
    };

    const paramRows = [
        {
            symbol: "N",
            label: t("Segments count"),
            a: String(paramsA.segmentCount),
            b: String(paramsB.segmentCount),
        },
        {
            symbol: "F",
            label: t("Outline area"),
            a: formatInteger(paramsA.area),
            b: formatInteger(paramsB.area),
        },
        {
            symbol: "P",
            label: t("Outline perimeter"),
            a: formatInteger(paramsA.perimeter),
            b: formatInteger(paramsB.perimeter),
        },
        {
            symbol: "Wk",
            label: t("Shape coefficient"),
            a: formatDecimal(paramsA.shapeCoefficient),
            b: formatDecimal(paramsB.shapeCoefficient),
        },
        {
            symbol: "W1",
            label: t("Axis W1 length"),
            a: formatInteger(paramsA.w1),
            b: formatInteger(paramsB.w1),
        },
        {
            symbol: "W2",
            label: t("Axis W2 length"),
            a: formatInteger(paramsA.w2),
            b: formatInteger(paramsB.w2),
        },
        {
            symbol: "Pw",
            label: t("Size proportion"),
            a: formatDecimal(paramsA.sizeProportion),
            b: formatDecimal(paramsB.sizeProportion),
        },
        {
            symbol: "G",
            label: t("Grafotype"),
            a: formatDecimal(paramsA.grafotype),
            b: formatDecimal(paramsB.grafotype),
        },
    ];

    const { spearman } = comparison;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <button
                type="button"
                onClick={handleOpen}
                title={verificationLabel}
                className={cn(
                    "w-full justify-start gap-2 h-auto min-h-[40px] py-2 px-3 border border-input rounded-md",
                    "hover:bg-accent hover:text-accent-foreground transition-colors",
                    "flex items-center",
                    className
                )}
            >
                <ClipboardCheck
                    className="flex-shrink-0"
                    size={ICON.SIZE}
                    strokeWidth={ICON.STROKE_WIDTH}
                />
                <span className="text-sm text-left leading-tight">
                    {verificationLabel}
                </span>
            </button>

            <DialogPortal>
                <DialogOverlay />
                <DialogContent className="w-[640px] max-w-[92vw] max-h-[90vh] flex flex-col">
                    <DialogTitle className="text-lg font-semibold">
                        {verificationLabel}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {verificationLabel}
                    </DialogDescription>

                    <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 flex flex-col gap-4">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left py-1.5 font-semibold">
                                        {t("Parameters", { ns: "keywords" })}
                                    </th>
                                    <th className="text-right py-1.5 font-semibold">
                                        A
                                    </th>
                                    <th className="text-right py-1.5 font-semibold">
                                        B
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paramRows.map(row => (
                                    <tr
                                        key={row.symbol}
                                        className="border-b border-border/30"
                                    >
                                        <td className="py-1">
                                            <span className="font-mono text-xs text-muted-foreground mr-2">
                                                {row.symbol}
                                            </span>
                                            {row.label}
                                        </td>
                                        <td className="py-1 text-right tabular-nums">
                                            {row.a}
                                        </td>
                                        <td className="py-1 text-right tabular-nums">
                                            {row.b}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="grid gap-2 rounded-md border border-border/60 p-3 text-sm">
                            <div className="flex justify-between">
                                <span>{t("Shape coefficient agreement")}</span>
                                <strong className="tabular-nums">
                                    {formatPercent(comparison.shapeAgreement)}
                                </strong>
                            </div>
                            <div className="flex justify-between">
                                <span>{t("Grafotype agreement")}</span>
                                <strong className="tabular-nums">
                                    {formatPercent(
                                        comparison.grafotypeAgreement
                                    )}
                                </strong>
                            </div>
                            <div className="flex justify-between">
                                <span>{t("Rank correlation")}</span>
                                <strong className="tabular-nums">
                                    {spearman
                                        ? `R = ${spearman.r.toFixed(3)}`
                                        : NO_VALUE}
                                </strong>
                            </div>
                            {spearman && (
                                <div className="flex justify-between text-muted-foreground">
                                    <span>
                                        {t("Critical value")} (N = {spearman.n},
                                        α = 0.05)
                                    </span>
                                    <span className="tabular-nums">
                                        Rkr ={" "}
                                        {spearman.rkr === null
                                            ? NO_VALUE
                                            : spearman.rkr.toFixed(3)}{" "}
                                        —{" "}
                                        {spearman.significant
                                            ? t("significant")
                                            : t("not significant")}
                                    </span>
                                </div>
                            )}
                        </div>

                        {(paramsA.sizeProportion === null ||
                            paramsB.sizeProportion === null) && (
                            <p className="text-xs text-muted-foreground">
                                {t(
                                    "Axes W1 and W2 are required to compute size proportion and grafotype"
                                )}
                            </p>
                        )}
                        {!comparison.sameSegmentCount && (
                            <p className="text-xs text-muted-foreground">
                                {t(
                                    "Rank correlation requires the same number of outline segments in both samples"
                                )}
                            </p>
                        )}
                    </div>

                    <DialogClose className="absolute top-3 right-3">
                        <X size={ICON.SIZE} strokeWidth={ICON.STROKE_WIDTH} />
                    </DialogClose>
                </DialogContent>
            </DialogPortal>
        </Dialog>
    );
}
