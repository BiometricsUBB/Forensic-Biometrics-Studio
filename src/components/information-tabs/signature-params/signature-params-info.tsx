import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useCanvasContext } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { MarkingsStore } from "@/lib/stores/Markings";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { computeSignatureParams } from "@/lib/signature/signature-params";

const NO_VALUE = "—";

const formatInteger = (value: number | null) =>
    value === null ? NO_VALUE : Math.round(value).toLocaleString();

const formatDecimal = (value: number | null) =>
    value === null ? NO_VALUE : value.toFixed(2);

export function SignatureParamsInfo() {
    const { t } = useTranslation();
    const { id } = useCanvasContext();

    const { markings } = MarkingsStore(id).use(
        state => ({
            markings: state.markings || [],
            hash: state.markingsHash,
        }),
        (oldState, newState) => oldState.hash === newState.hash
    );
    const types = MarkingTypesStore.use(state => state.types);

    const params = useMemo(
        () => computeSignatureParams(markings, types),
        [markings, types]
    );

    const rows = [
        {
            symbol: "N",
            label: t("Segments count"),
            value: params.hasOutline ? String(params.segmentCount) : NO_VALUE,
        },
        {
            symbol: "F",
            label: t("Outline area"),
            value: formatInteger(params.area),
        },
        {
            symbol: "P",
            label: t("Outline perimeter"),
            value: formatInteger(params.perimeter),
        },
        {
            symbol: "Wk",
            label: t("Shape coefficient"),
            value: formatDecimal(params.shapeCoefficient),
        },
        {
            symbol: "W1",
            label: t("Axis W1 length"),
            value: formatInteger(params.w1),
        },
        {
            symbol: "W2",
            label: t("Axis W2 length"),
            value: formatInteger(params.w2),
        },
        {
            symbol: "Pw",
            label: t("Size proportion"),
            value: formatDecimal(params.sizeProportion),
        },
        {
            symbol: "G",
            label: t("Grafotype"),
            value: formatDecimal(params.grafotype),
        },
    ];

    return (
        <div className="w-full h-full overflow-auto p-2">
            <table className="w-full text-sm border-collapse">
                <tbody>
                    {rows.map(row => (
                        <tr
                            key={row.symbol}
                            className="border-b border-border/30"
                        >
                            <td className="py-1 pr-2 font-mono text-xs text-muted-foreground w-8">
                                {row.symbol}
                            </td>
                            <td className="py-1 pr-2 text-muted-foreground">
                                {row.label}
                            </td>
                            <td className="py-1 text-right font-medium tabular-nums">
                                {row.value}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
