import type { TFunction } from "i18next";
import {
    describeAgreement,
    type ShoeprintComparisonRun,
} from "@/lib/shoeprint/shoeprint-comparison";
import { createFooter, createPage, escapeHtml } from "./page-builders";

type ReportT = TFunction<"report">;
type KeywordsT = TFunction<"keywords">;

const formatPercent = (value: number) => `${(value * 100).toFixed(1)} %`;
const formatDegrees = (value: number) => `${value.toFixed(2)}°`;
const formatNumber = (value: number, digits = 1) => value.toFixed(digits);

/**
 * Distances come back in the working units the point clouds were reduced to.
 * When both images carried a resolution those units are physical, so they are
 * reported in millimetres; otherwise they stay unitless and the report says so.
 */
const buildDistanceFormatter = (run: ShoeprintComparisonRun) => {
    const { unitsPerMm } = run.extraction.left;
    if (run.scaleWarning !== null || !unitsPerMm) {
        return (value: number) => formatNumber(value);
    }
    return (value: number) => `${formatNumber(value / unitsPerMm)} mm`;
};

export const createComparisonPages = (
    run: ShoeprintComparisonRun,
    firstPageNumber: number,
    reportId: string,
    tReport: ReportT,
    tKeywords: KeywordsT
): HTMLElement[] => {
    const { result } = run;
    const { summary } = result;
    const formatDistance = buildDistanceFormatter(run);

    const agreement = describeAgreement(summary);
    const agreementLabel = {
        strong: tKeywords("Strong agreement"),
        moderate: tKeywords("Moderate agreement"),
        weak: tKeywords("Weak agreement"),
    }[agreement];

    const regionRows = result.regions
        .map(
            region => `
            <tr>
                <td>${region.index}</td>
                <td>${region.cliqueSize}</td>
                <td>${formatDegrees(region.rotationAngle)}</td>
                <td>${formatPercent(region.inputOverlap)}</td>
                <td>${formatPercent(region.referenceOverlap)}</td>
                <td>${formatNumber(region.medianSquaredDistance, 3)}</td>
            </tr>`
        )
        .join("");

    const pairRows = result.regionPairs
        .map(
            pair => `
            <tr>
                <td>${escapeHtml(pair.pair)}</td>
                <td>${formatDistance(pair.inputDistance)}</td>
                <td>${formatDistance(pair.referenceDistance)}</td>
                <td>${formatDistance(pair.absoluteDifference)}</td>
            </tr>`
        )
        .join("");

    const summaryPage = createPage();
    summaryPage.innerHTML = `
        <div class="section-title">${tReport("Shoeprint comparison title")}</div>

        <div style="font-size:11px; line-height:1.45; margin-bottom:6px;">
            ${tReport("Shoeprint comparison method")}
        </div>

        <div class="section-title">${tReport("Shoeprint comparison parameters")}</div>
        <div class="software-grid">
            <div class="software-row"><span class="software-label">${tKeywords("Analysis engine")}</span><span>${escapeHtml(result.engine.library)} ${escapeHtml(result.engine.libraryVersion)} / R ${escapeHtml(result.engine.rVersion)}</span></div>
            <div class="software-row"><span class="software-label">${tKeywords("Region radius")}</span><span>${formatDistance(result.parameters.circleRadius)}</span></div>
            <div class="software-row"><span class="software-label">${tKeywords("Maximum rotation angle")}</span><span>${formatDegrees(result.parameters.maxRotationAngle)}</span></div>
            <div class="software-row"><span class="software-label">${tKeywords("Random seed")}</span><span>${result.parameters.seed}</span></div>
            <div class="software-row"><span class="software-label">${tKeywords("Edge points")} (Q / K)</span><span>${result.questioned.points} / ${result.known.points}</span></div>
        </div>

        <div class="section-title">${tReport("Shoeprint comparison summary")}</div>
        <div class="software-grid">
            <div class="software-row"><span class="software-label">${tKeywords("Agreement")}</span><span>${escapeHtml(agreementLabel)}</span></div>
            <div class="software-row"><span class="software-label">${tKeywords("Mean overlap")} (Q)</span><span>${formatPercent(summary.meanInputOverlap)}</span></div>
            <div class="software-row"><span class="software-label">${tKeywords("Mean overlap")} (K)</span><span>${formatPercent(summary.meanReferenceOverlap)}</span></div>
            <div class="software-row"><span class="software-label">${tKeywords("Rotation consistency")}</span><span>${formatDegrees(summary.sdRotationAngle)}</span></div>
            <div class="software-row"><span class="software-label">${tKeywords("Triangle agreement")}</span><span>${formatDistance(summary.meanAbsoluteTriangleDifference)}</span></div>
            <div class="software-row"><span class="software-label">${tKeywords("Clique size")}</span><span>${formatNumber(summary.meanCliqueSize)}</span></div>
        </div>

        <div class="section-title">${tReport("Shoeprint comparison regions")}</div>
        <table class="table">
            <thead>
                <tr>
                    <th>${tKeywords("Region")}</th>
                    <th>${tKeywords("Clique size")}</th>
                    <th>${tKeywords("Rotation angle")}</th>
                    <th>${tKeywords("Overlap Q")}</th>
                    <th>${tKeywords("Overlap K")}</th>
                    <th>${tKeywords("Median squared distance")}</th>
                </tr>
            </thead>
            <tbody>${regionRows}</tbody>
        </table>

        <div class="section-title">${tReport("Shoeprint comparison distances")}</div>
        <table class="table">
            <thead>
                <tr>
                    <th>${tKeywords("Region")}</th>
                    <th>${tKeywords("Distance in Q")}</th>
                    <th>${tKeywords("Distance in K")}</th>
                    <th>${tKeywords("Difference")}</th>
                </tr>
            </thead>
            <tbody>${pairRows}</tbody>
        </table>

        ${
            run.scaleWarning
                ? `<div style="font-size:10px; margin-top:6px;">${tReport(run.scaleWarning)}</div>`
                : ""
        }

        <div class="note">
            <div class="note-title">${tReport("Note title")}</div>
            <div>${tReport("Shoeprint comparison disclaimer")}</div>
        </div>

        ${createFooter(firstPageNumber, reportId, tReport)}
    `;

    const pages = [summaryPage];

    if (run.plotDataUrl) {
        const figurePage = createPage();
        figurePage.innerHTML = `
            <div class="fig-label">${tReport("Shoeprint comparison title")}</div>
            <div class="fig"><img src="${run.plotDataUrl}" /></div>
            <div class="fig-caption">${tReport("Shoeprint comparison figure")}</div>
            ${createFooter(firstPageNumber + 1, reportId, tReport)}
        `;
        pages.push(figurePage);
    }

    return pages;
};
