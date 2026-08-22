import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils/shadcn";
import {
    describeAgreement,
    type ShoeprintComparisonRun,
} from "@/lib/shoeprint/shoeprint-comparison";

const REGION_COLOURS = ["#d62728", "#ff7f0e", "#2ca02c"];

const formatPercent = (value: number) => `${(value * 100).toFixed(1)} %`;
const formatDegrees = (value: number) => `${value.toFixed(2)}°`;
const formatUnits = (value: number) => value.toFixed(1);

type ComparisonResultsProps = {
    run: ShoeprintComparisonRun;
};

export function ComparisonResults({ run }: ComparisonResultsProps) {
    const { t } = useTranslation(["keywords", "report"], {
        useSuspense: false,
    });
    const { result } = run;
    const { summary } = result;

    const agreement = describeAgreement(summary);
    const agreementLabel = {
        strong: t("Strong agreement", { ns: "keywords" }),
        moderate: t("Moderate agreement", { ns: "keywords" }),
        weak: t("Weak agreement", { ns: "keywords" }),
    }[agreement];

    const agreementClass = {
        strong: "text-emerald-600 dark:text-emerald-400",
        moderate: "text-amber-600 dark:text-amber-400",
        weak: "text-rose-600 dark:text-rose-400",
    }[agreement];

    const headline = [
        {
            label: t("Mean overlap", { ns: "keywords" }),
            value: formatPercent(summary.meanInputOverlap),
        },
        {
            label: t("Rotation consistency", { ns: "keywords" }),
            value: formatDegrees(summary.sdRotationAngle),
        },
        {
            label: t("Triangle agreement", { ns: "keywords" }),
            value: formatUnits(summary.meanAbsoluteTriangleDifference),
        },
        {
            label: t("Clique size", { ns: "keywords" }),
            value: summary.meanCliqueSize.toFixed(1),
        },
    ];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-3 rounded-md border border-border/60 p-3">
                <span className="text-sm">
                    {t("Agreement", { ns: "keywords" })}
                </span>
                <strong className={cn("text-base", agreementClass)}>
                    {agreementLabel}
                </strong>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {headline.map(item => (
                    <div
                        key={item.label}
                        className="rounded-md border border-border/60 p-2"
                    >
                        <div className="text-xs text-muted-foreground">
                            {item.label}
                        </div>
                        <div className="text-sm font-semibold tabular-nums">
                            {item.value}
                        </div>
                    </div>
                ))}
            </div>

            <div>
                <h3 className="mb-1 text-sm font-semibold">
                    {t("Matched regions", { ns: "keywords" })}
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="py-1.5 text-left font-semibold">
                                    {t("Region", { ns: "keywords" })}
                                </th>
                                <th className="py-1.5 text-right font-semibold">
                                    {t("Clique size", { ns: "keywords" })}
                                </th>
                                <th className="py-1.5 text-right font-semibold">
                                    {t("Rotation angle", { ns: "keywords" })}
                                </th>
                                <th className="py-1.5 text-right font-semibold">
                                    {t("Overlap Q", { ns: "keywords" })}
                                </th>
                                <th className="py-1.5 text-right font-semibold">
                                    {t("Overlap K", { ns: "keywords" })}
                                </th>
                                <th className="py-1.5 text-right font-semibold">
                                    {t("Median squared distance", {
                                        ns: "keywords",
                                    })}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.regions.map(region => (
                                <tr
                                    key={region.index}
                                    className="border-b border-border/30"
                                >
                                    <td className="py-1">
                                        <span
                                            className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                                            style={{
                                                backgroundColor:
                                                    REGION_COLOURS[
                                                        region.index - 1
                                                    ] ?? "#64748b",
                                            }}
                                        />
                                        {region.index}
                                    </td>
                                    <td className="py-1 text-right tabular-nums">
                                        {region.cliqueSize}
                                    </td>
                                    <td className="py-1 text-right tabular-nums">
                                        {formatDegrees(region.rotationAngle)}
                                    </td>
                                    <td className="py-1 text-right tabular-nums">
                                        {formatPercent(region.inputOverlap)}
                                    </td>
                                    <td className="py-1 text-right tabular-nums">
                                        {formatPercent(region.referenceOverlap)}
                                    </td>
                                    <td className="py-1 text-right tabular-nums">
                                        {region.medianSquaredDistance.toFixed(
                                            3
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div>
                <h3 className="mb-1 text-sm font-semibold">
                    {t("Region distances", { ns: "keywords" })}
                </h3>
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="py-1.5 text-left font-semibold">
                                {t("Region", { ns: "keywords" })}
                            </th>
                            <th className="py-1.5 text-right font-semibold">
                                {t("Distance in Q", { ns: "keywords" })}
                            </th>
                            <th className="py-1.5 text-right font-semibold">
                                {t("Distance in K", { ns: "keywords" })}
                            </th>
                            <th className="py-1.5 text-right font-semibold">
                                {t("Difference", { ns: "keywords" })}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {result.regionPairs.map(pair => (
                            <tr
                                key={pair.pair}
                                className="border-b border-border/30"
                            >
                                <td className="py-1">{pair.pair}</td>
                                <td className="py-1 text-right tabular-nums">
                                    {formatUnits(pair.inputDistance)}
                                </td>
                                <td className="py-1 text-right tabular-nums">
                                    {formatUnits(pair.referenceDistance)}
                                </td>
                                <td className="py-1 text-right tabular-nums">
                                    {formatUnits(pair.absoluteDifference)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {run.scaleWarning && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                    {t(run.scaleWarning, { ns: "report" })}
                </p>
            )}

            {run.plotDataUrl && (
                <div>
                    <h3 className="mb-1 text-sm font-semibold">
                        {t("Comparison figure", { ns: "keywords" })}
                    </h3>
                    <img
                        src={run.plotDataUrl}
                        alt={t("Comparison figure", { ns: "keywords" })}
                        className="w-full rounded border border-border bg-white"
                    />
                </div>
            )}

            <p className="text-xs text-muted-foreground">
                {t("Shoeprint comparison disclaimer", { ns: "report" })}
            </p>
        </div>
    );
}
