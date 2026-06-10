/* eslint-disable security/detect-object-injection */
import * as PIXI from "pixi.js";
import i18n from "@/lib/locales/i18n";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { getCanvas } from "@/components/pixi/canvas/hooks/useCanvas";
import { MarkingsStore } from "@/lib/stores/Markings";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { GlobalSettingsStore } from "@/lib/stores/GlobalSettings";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { WORKING_MODE } from "@/views/selectMode";
import { computeSignatureParams } from "@/lib/signature/signature-params";
import { compareSignatures } from "@/lib/signature/signature-comparison";
import { formatBytes } from "./report-utils";
import {
    buildReportIdentity,
    createFigurePage,
    createFooter,
    createPage,
    createReportRoot,
    createStyles,
    getImageMeta,
    renderImageWithMarkings,
    renderPagesToPdf,
    type ReportMetadataOptions,
} from "./generate-report-pdf";

type SignatureReportOptions = ReportMetadataOptions & {
    reportLanguage?: string;
};

const NA_KEY = "Not available";

/**
 * Generates a PDF report for the signature (Grafotype) working mode:
 * a parameter summary (A/B), conformity verification, the rank-correlation
 * breakdown and the annotated signature images.
 */
/* eslint-disable sonarjs/cognitive-complexity */
export const generateSignatureReportPdfWithDialog = async (
    options: SignatureReportOptions
) => {
    let stage = "init";
    const previousLanguage = i18n.language;
    let languageChanged = false;
    try {
        stage = "check-working-mode";
        if (WorkingModeStore.state.workingMode !== WORKING_MODE.SIGNATURE) {
            throw new Error(
                "Signature report is available only in the signature working mode."
            );
        }

        stage = "prepare-language";
        const reportLanguage =
            options.reportLanguage ||
            GlobalSettingsStore.state.settings.language ||
            i18n.language ||
            "pl";
        if (reportLanguage !== previousLanguage) {
            await i18n.changeLanguage(reportLanguage);
            languageChanged = true;
        }
        await i18n.loadNamespaces(["report", "keywords"]);
        const tReport = i18n.getFixedT(reportLanguage, "report");
        const tKeywords = i18n.getFixedT(reportLanguage, "keywords");

        stage = "get-viewports";
        const leftViewport = getCanvas(CANVAS_ID.LEFT, true).viewport;
        const rightViewport = getCanvas(CANVAS_ID.RIGHT, true).viewport;
        if (!leftViewport || !rightViewport) {
            throw new Error("Viewports are not ready.");
        }

        stage = "get-sprites";
        const leftSprite = leftViewport.children.find(
            x => x instanceof PIXI.Sprite
        ) as PIXI.Sprite | undefined;
        const rightSprite = rightViewport.children.find(
            x => x instanceof PIXI.Sprite
        ) as PIXI.Sprite | undefined;
        if (!leftSprite || !rightSprite) {
            throw new Error("Load both images before generating the report.");
        }

        stage = "compute-params";
        const markingsLeft = MarkingsStore(CANVAS_ID.LEFT).state.markings;
        const markingsRight = MarkingsStore(CANVAS_ID.RIGHT).state.markings;
        const { types } = MarkingTypesStore.state;
        const paramsA = computeSignatureParams(markingsLeft, types);
        const paramsB = computeSignatureParams(markingsRight, types);
        if (!paramsA.hasOutline || !paramsB.hasOutline) {
            throw new Error(
                "Draw a signature outline (polygon) on both images before generating the report."
            );
        }
        const comparison = compareSignatures(paramsA, paramsB);

        stage = "read-image-meta";
        const leftMeta = await getImageMeta(leftSprite);
        const rightMeta = await getImageMeta(rightSprite);

        stage = "render-overlays";
        const leftOverlay = await renderImageWithMarkings(
            leftMeta.bytes,
            markingsLeft,
            types,
            1.6
        );
        const rightOverlay = await renderImageWithMarkings(
            rightMeta.bytes,
            markingsRight,
            types,
            1.6
        );

        stage = "report-metadata";
        const {
            reportId,
            reportDateTime,
            performedBy,
            department,
            address,
            appVersion,
        } = await buildReportIdentity(options, leftMeta, rightMeta);

        const na = tReport(NA_KEY);
        const fmtInt = (value: number | null) =>
            value === null ? na : String(Math.round(value));
        const fmt2 = (value: number | null) =>
            value === null ? na : value.toFixed(2);
        const fmtPct = (value: number | null) =>
            value === null ? na : `${value.toFixed(2)} %`;

        stage = "build-dom";
        const root = createReportRoot();
        root.appendChild(createStyles());

        const addressHtml =
            address.length > 0
                ? address.map(line => `<div>${line}</div>`).join("")
                : "<div>-</div>";

        const pages: HTMLElement[] = [];

        const page1 = createPage();
        page1.innerHTML = `
        <div class="report-title">${tReport("Signature verification report title")}</div>
        <div class="meta-grid">
            <div>${tReport("Report ID label")} <strong>${reportId}</strong></div>
            <div>${tReport("Report date and time label")} ${reportDateTime}</div>
            <div>${tReport("Performed by label")}</div>
            <div class="meta-block">
                <div>${performedBy || "-"}</div>
                <div>${department || "-"}</div>
                ${addressHtml}
            </div>
        </div>

        <div class="section-title">${tReport("Software information")}</div>
        <div class="software-grid">
            <div>${tReport("Application name")} Biometrics-Studio</div>
            <div>${tReport("Application version")} ${appVersion}</div>
        </div>

        <div class="section-title">${tReport("Input material")}</div>
        <div class="input-grid">
            <div class="meta-block">
                <div><strong>${tReport("Image 1")} (${tReport("Sample A")}):</strong></div>
                <div>${tReport("File name")} ${leftMeta.name}</div>
                <div>${tReport("Image dimensions")} ${leftMeta.width} x ${leftMeta.height} px</div>
                <div>${tReport("Size")} ${formatBytes(leftMeta.sizeBytes)}</div>
                <div>${tReport("Checksum")} ${leftMeta.checksum}</div>
            </div>
            <div class="meta-block">
                <div><strong>${tReport("Image 2")} (${tReport("Sample B")}):</strong></div>
                <div>${tReport("File name")} ${rightMeta.name}</div>
                <div>${tReport("Image dimensions")} ${rightMeta.width} x ${rightMeta.height} px</div>
                <div>${tReport("Size")} ${formatBytes(rightMeta.sizeBytes)}</div>
                <div>${tReport("Checksum")} ${rightMeta.checksum}</div>
            </div>
        </div>
        ${createFooter(1, reportId, tReport)}
    `;
        pages.push(page1);

        const paramRows: Array<[string, string, string, string]> = [
            [
                "N",
                tKeywords("Segments count"),
                String(paramsA.segmentCount),
                String(paramsB.segmentCount),
            ],
            [
                "F",
                tKeywords("Outline area"),
                fmtInt(paramsA.area),
                fmtInt(paramsB.area),
            ],
            [
                "P",
                tKeywords("Outline perimeter"),
                fmtInt(paramsA.perimeter),
                fmtInt(paramsB.perimeter),
            ],
            [
                "Wk",
                tKeywords("Shape coefficient"),
                fmt2(paramsA.shapeCoefficient),
                fmt2(paramsB.shapeCoefficient),
            ],
            [
                "W1",
                tKeywords("Axis W1 length"),
                fmtInt(paramsA.w1),
                fmtInt(paramsB.w1),
            ],
            [
                "W2",
                tKeywords("Axis W2 length"),
                fmtInt(paramsA.w2),
                fmtInt(paramsB.w2),
            ],
            [
                "Pw",
                tKeywords("Size proportion"),
                fmt2(paramsA.sizeProportion),
                fmt2(paramsB.sizeProportion),
            ],
            [
                "G",
                tKeywords("Grafotype"),
                fmt2(paramsA.grafotype),
                fmt2(paramsB.grafotype),
            ],
        ];
        const paramRowsHtml = paramRows
            .map(
                ([symbol, label, a, b]) =>
                    `<tr><td>${symbol} — ${label}</td><td>${a}</td><td>${b}</td></tr>`
            )
            .join("");

        const { spearman } = comparison;
        const correlationText = spearman
            ? `R = ${spearman.r.toFixed(3)} (Rkr = ${
                  spearman.rkr === null ? na : spearman.rkr.toFixed(3)
              }, N = ${spearman.n}, α = 0.05) — ${
                  spearman.significant
                      ? tKeywords("significant")
                      : tKeywords("not significant")
              }`
            : na;

        const summaryPage = createPage();
        summaryPage.innerHTML = `
        <div class="section-title">${tReport("Parameters summary")}</div>
        <table class="table">
            <thead>
                <tr>
                    <th>${tKeywords("Parameters")}</th>
                    <th>${tReport("Sample A")}</th>
                    <th>${tReport("Sample B")}</th>
                </tr>
            </thead>
            <tbody>${paramRowsHtml}</tbody>
        </table>
        <div class="counts">
            <div>${tKeywords("Shape coefficient agreement")}: <strong>${fmtPct(comparison.shapeAgreement)}</strong></div>
            <div>${tKeywords("Grafotype agreement")}: <strong>${fmtPct(comparison.grafotypeAgreement)}</strong></div>
            <div>${tKeywords("Rank correlation")}: <strong>${correlationText}</strong></div>
        </div>
        ${createFooter(pages.length + 1, reportId, tReport)}
    `;
        pages.push(summaryPage);

        if (spearman) {
            const correlationRows = paramsA.segments
                .map((lengthA, i) => {
                    const lengthB = paramsB.segments[i] ?? 0;
                    return `<tr>
                        <td>${i + 1}</td>
                        <td>${Math.round(lengthA)}</td>
                        <td>${spearman.ranksA[i]}</td>
                        <td>${Math.round(lengthB)}</td>
                        <td>${spearman.ranksB[i]}</td>
                    </tr>`;
                })
                .join("");
            const correlationPage = createPage();
            correlationPage.innerHTML = `
            <div class="section-title">${tReport("Rank correlation analysis")}</div>
            <table class="table">
                <thead>
                    <tr>
                        <th>Lp</th>
                        <th>${tReport("Segment length")} A</th>
                        <th>${tReport("Rank")} A</th>
                        <th>${tReport("Segment length")} B</th>
                        <th>${tReport("Rank")} B</th>
                    </tr>
                </thead>
                <tbody>${correlationRows}</tbody>
            </table>
            <div class="counts">
                <div>${tKeywords("Rank correlation")}: <strong>${correlationText}</strong></div>
            </div>
            ${createFooter(pages.length + 1, reportId, tReport)}
        `;
            pages.push(correlationPage);
        }

        pages.push(
            createFigurePage(
                tReport("Signature A figure"),
                leftOverlay.toDataURL("image/png"),
                `${tReport("Image 1")} (${tReport("Sample A")})`,
                pages.length + 1,
                reportId,
                tReport
            )
        );
        pages.push(
            createFigurePage(
                tReport("Signature B figure"),
                rightOverlay.toDataURL("image/png"),
                `${tReport("Image 2")} (${tReport("Sample B")})`,
                pages.length + 1,
                reportId,
                tReport
            )
        );

        stage = "render-pdf";
        try {
            await renderPagesToPdf(
                root,
                pages,
                tKeywords("Generate report"),
                `signature-report-${reportId}.pdf`
            );
        } finally {
            if (languageChanged) {
                await i18n.changeLanguage(previousLanguage);
            }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line no-console
        console.error(
            `[signature-report] failed at ${stage}: ${message}`,
            error
        );
        throw new Error(`Report failed at ${stage}: ${message}`);
    }
};
/* eslint-enable sonarjs/cognitive-complexity */
