import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import i18n from "@/lib/locales/i18n";
import * as PIXI from "pixi.js";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { getCanvas } from "@/components/pixi/canvas/hooks/useCanvas";
import { MarkingsStore } from "@/lib/stores/Markings";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { GlobalSettingsStore } from "@/lib/stores/GlobalSettings";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { WORKING_MODE } from "@/views/selectMode";
import {
    formatReportDateTime,
    formatBytes,
    getPairedByLabel,
    toDataUrl,
    md5String,
} from "./report-utils";
import { IMAGE_CELL_SIZE } from "./shared/types";
import {
    getImageMeta,
    renderImageWithMarkings,
    cropCanvas,
    getMarkingCenter,
    getMarkingExtent,
} from "./shared/render-utils";
import { createOverviewCalloutImage } from "./shared/callout-placement";
import {
    toCssColor,
    escapeHtml,
    resolveFeatureTypeName,
    createFooter,
    createPage,
    createReportRoot,
    createStyles,
    createFigurePage,
    ensureImagesLoaded,
} from "./shared/page-builders";
import { resolveMetadataComparison } from "./shared/resolve-marking-metadata";

export type EarprintReportGenerationOptions = {
    reportDateTime: string;
    reportLanguage?: string;
    performedBy: string;
    department: string;
    addressLines: string[];
    reportTitle?: string;
    calloutColor?: "red" | "green";
};

const OVERVIEW_CHUNK_SIZE = 32;

const createEarprintStyles = () => {
    const style = document.createElement("style");
    style.textContent = `
        .ear-feature-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 4px; }
        .ear-feature-label { font-size: 20px; font-weight: 700; }
        .ear-feature-type { font-size: 11px; color: #333; }
        .ear-crops { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 8px 0; }
        .ear-crop-col { display: flex; flex-direction: column; gap: 4px; align-items: center; }
        .ear-crop-img { width: 240px; height: 240px; object-fit: cover; border: 1px solid #ddd; }
        .meta-table { table-layout: fixed; width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }
        .meta-table th { border: 1px solid #ccc; padding: 4px 6px; background: #f0f0f0; font-weight: 700; text-align: left; }
        .meta-table td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
        .meta-table th:first-child, .meta-table td:first-child { width: 44%; font-weight: 600; }
        .meta-empty { font-size: 11px; color: #777; margin-top: 6px; }
    `;
    return style;
};

const getSystemId = async () => {
    try {
        const id = await invoke<string>("get_machine_id");
        return id || "unknown";
    } catch {
        return "unknown";
    }
};

export const generateEarprintReportPdfWithDialog = async (
    options: EarprintReportGenerationOptions
) => {
    let stage = "init";
    const previousLanguage = i18n.language;
    let languageChanged = false;
    try {
        stage = "check-working-mode";
        const { workingMode } = WorkingModeStore.state;
        if (workingMode !== WORKING_MODE.EAR) {
            throw new Error(
                "Report generation is available only for earprints."
            );
        }

        stage = "setup-i18n";
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
        const leftCanvas = getCanvas(CANVAS_ID.LEFT, true);
        const rightCanvas = getCanvas(CANVAS_ID.RIGHT, true);
        const leftViewport = leftCanvas.viewport;
        const rightViewport = rightCanvas.viewport;
        if (!leftViewport || !rightViewport)
            throw new Error("Viewports are not ready.");

        stage = "get-sprites";
        const leftSprite = leftViewport.children.find(
            x => x instanceof PIXI.Sprite
        ) as PIXI.Sprite | undefined;
        const rightSprite = rightViewport.children.find(
            x => x instanceof PIXI.Sprite
        ) as PIXI.Sprite | undefined;
        if (!leftSprite || !rightSprite)
            throw new Error("Load both images before generating the report.");

        stage = "collect-markings";
        const markingsLeft = MarkingsStore(CANVAS_ID.LEFT).state.markings;
        const markingsRight = MarkingsStore(CANVAS_ID.RIGHT).state.markings;
        const markingTypes = MarkingTypesStore.state.types;

        const paired = getPairedByLabel(markingsLeft, markingsRight);

        stage = "read-image-meta";
        const leftMeta = await getImageMeta(leftSprite);
        const rightMeta = await getImageMeta(rightSprite);

        stage = "image-data-urls";
        const leftOriginal = await toDataUrl(leftMeta.bytes, leftMeta.name);
        const rightOriginal = await toDataUrl(rightMeta.bytes, rightMeta.name);

        stage = "render-overlays";
        const [leftAllCanvas, rightAllCanvas] = await Promise.all([
            renderImageWithMarkings(
                leftMeta.bytes,
                markingsLeft,
                markingTypes,
                1.6,
                {
                    showMarkingLabels: true,
                }
            ),
            renderImageWithMarkings(
                rightMeta.bytes,
                markingsRight,
                markingTypes,
                1.6,
                { showMarkingLabels: true }
            ),
        ]);

        stage = "feature-crops";
        const BATCH_SIZE = 4;
        const featureCrops: Array<{ left: string; right: string }> = [];
        for (let i = 0; i < paired.length; i += BATCH_SIZE) {
            const batch = paired.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(
                batch.map(async feature => {
                    const [leftWithCanvas, rightWithCanvas] = await Promise.all(
                        [
                            renderImageWithMarkings(
                                leftMeta.bytes,
                                [feature.left],
                                markingTypes,
                                1.6,
                                { showMarkingLabels: false, markingsAlpha: 0.5 }
                            ),
                            renderImageWithMarkings(
                                rightMeta.bytes,
                                [feature.right],
                                markingTypes,
                                1.6,
                                { showMarkingLabels: false, markingsAlpha: 0.5 }
                            ),
                        ]
                    );
                    const leftCenter = getMarkingCenter(feature.left);
                    const rightCenter = getMarkingCenter(feature.right);
                    const maxExtent = Math.max(
                        getMarkingExtent(feature.left),
                        getMarkingExtent(feature.right)
                    );
                    const targetSize = Math.max(
                        80,
                        Math.min(
                            IMAGE_CELL_SIZE * 1.4,
                            Math.round(maxExtent / 0.6)
                        )
                    );
                    const leftCrop = cropCanvas(
                        leftWithCanvas,
                        leftCenter.x,
                        leftCenter.y,
                        targetSize
                    );
                    const rightCrop = cropCanvas(
                        rightWithCanvas,
                        rightCenter.x,
                        rightCenter.y,
                        targetSize
                    );
                    return {
                        left: leftCrop.toDataURL("image/png"),
                        right: rightCrop.toDataURL("image/png"),
                    };
                })
            );
            featureCrops.push(...batchResults);
        }

        stage = "report-metadata";
        const reportSettings = GlobalSettingsStore.state.settings.report;
        const reportDateTime =
            options.reportDateTime?.trim() || formatReportDateTime(new Date());
        const systemId = await getSystemId();
        const reportId = md5String(
            [
                reportDateTime,
                leftMeta.sizeBytes,
                leftMeta.checksum,
                rightMeta.sizeBytes,
                rightMeta.checksum,
                systemId,
            ].join("|")
        );

        const performedBy =
            options.performedBy?.trim() || reportSettings?.performedBy || "-";
        const department =
            options.department?.trim() || reportSettings?.department || "-";
        const addressFallback = [
            reportSettings?.addressLine1,
            reportSettings?.addressLine2,
            reportSettings?.addressLine3,
            reportSettings?.addressLine4,
        ]
            .map(line => line?.trim())
            .filter(Boolean) as string[];
        const addressLines =
            options.addressLines?.map(line => line.trim()).filter(Boolean) ??
            [];
        const address =
            addressLines.length > 0 ? addressLines : addressFallback;
        const addressHtml =
            address.length > 0
                ? address.map(line => `<div>${escapeHtml(line)}</div>`).join("")
                : "<div>-</div>";

        const appVersion = await getVersion();

        stage = "build-dom";
        const root = createReportRoot();
        root.appendChild(createStyles());
        root.appendChild(createEarprintStyles());

        const page1 = createPage();
        page1.innerHTML = `
        <div class="report-title">${escapeHtml(options.reportTitle?.trim() || tReport("Earprint report title"))}</div>

        <div class="meta-block">
            <div class="meta-row"><span class="meta-label">${tReport("Report ID label")}</span><span>${reportId}</span></div>
            <div class="meta-row"><span class="meta-label">${tReport("Report date and time label")}</span><span>${reportDateTime}</span></div>
        </div>

        <div class="meta-block">
            <div style="font-weight:700;font-size:11px;margin-bottom:3px;">${tReport("Performed by label")}</div>
            <div style="font-size:11px;">${escapeHtml(performedBy)}</div>
            <div style="font-size:11px;">${escapeHtml(department)}</div>
            ${addressHtml}
        </div>

        <div class="section-title">${tReport("Software information")}</div>
        <div class="software-grid">
            <div class="software-row"><span class="software-label">${tReport("Application name")}</span><span>Forensic Biometrics Studio</span></div>
            <div class="software-row"><span class="software-label">${tReport("Application version")}</span><span>${appVersion}</span></div>
        </div>

        <div class="section-title">${tReport("Input material")}</div>
        <div class="input-stack">
            <div class="input-block-title">${tReport("Image 1")}:</div>
            <div class="input-row"><span class="input-label">${tReport("File name")}</span><span>${escapeHtml(leftMeta.name)}</span></div>
            <div class="input-row"><span class="input-label">${tReport("Image dimensions")}</span><span>${leftMeta.width} x ${leftMeta.height} px</span></div>
            <div class="input-row"><span class="input-label">${tReport("Size")}</span><span>${formatBytes(leftMeta.sizeBytes)}</span></div>
            <div class="input-row"><span class="input-label">${tReport("Checksum")}</span><span>${leftMeta.checksum}</span></div>
        </div>
        <div class="input-stack">
            <div class="input-block-title">${tReport("Image 2")}:</div>
            <div class="input-row"><span class="input-label">${tReport("File name")}</span><span>${escapeHtml(rightMeta.name)}</span></div>
            <div class="input-row"><span class="input-label">${tReport("Image dimensions")}</span><span>${rightMeta.width} x ${rightMeta.height} px</span></div>
            <div class="input-row"><span class="input-label">${tReport("Size")}</span><span>${formatBytes(rightMeta.sizeBytes)}</span></div>
            <div class="input-row"><span class="input-label">${tReport("Checksum")}</span><span>${rightMeta.checksum}</span></div>
        </div>

        <div class="counts">
            <div class="input-row"><span class="input-label">${tReport("Earprint paired features count")}</span><span>${paired.length}</span></div>
        </div>

        <div class="note">
            <div class="note-title">${tReport("Note title")}</div>
            <div>${tReport("Note body")}</div>
        </div>

        ${createFooter(1, reportId, tReport)}
        `;

        const pages: HTMLElement[] = [page1];

        pages.push(
            createFigurePage(
                tReport("Figure 1"),
                leftOriginal,
                tReport("Image 1 label"),
                2,
                reportId,
                tReport
            )
        );
        pages.push(
            createFigurePage(
                tReport("Figure 2"),
                leftAllCanvas.toDataURL("image/png"),
                tReport("Image 1 label"),
                3,
                reportId,
                tReport
            )
        );
        pages.push(
            createFigurePage(
                tReport("Figure 3"),
                rightOriginal,
                tReport("Image 2 label"),
                4,
                reportId,
                tReport
            )
        );
        pages.push(
            createFigurePage(
                tReport("Figure 4"),
                rightAllCanvas.toDataURL("image/png"),
                tReport("Image 2 label"),
                5,
                reportId,
                tReport
            )
        );

        if (paired.length === 0) {
            const noFeaturesPage = createPage();
            noFeaturesPage.innerHTML = `
                <div class="section-title">${tReport("Comparative table overview")}</div>
                <div style="font-size:12px; margin-top: 16px;">${tReport("Earprint no features")}</div>
                ${createFooter(pages.length + 1, reportId, tReport)}
            `;
            pages.push(noFeaturesPage);
        } else {
            const calloutColor =
                options.calloutColor === "green" ? "#2ecc71" : "#cc0000";

            for (let i = 0; i < paired.length; i += OVERVIEW_CHUNK_SIZE) {
                const chunk = paired.slice(i, i + OVERVIEW_CHUNK_SIZE);
                const [leftOverview, rightOverview] = await Promise.all([
                    createOverviewCalloutImage(
                        leftMeta.bytes,
                        chunk.map(x => x.left),
                        calloutColor
                    ),
                    createOverviewCalloutImage(
                        rightMeta.bytes,
                        chunk.map(x => x.right),
                        calloutColor
                    ),
                ]);
                const overviewPage = createPage();
                overviewPage.innerHTML = `
                    <div class="category-title">${tReport("Comparative table overview")}</div>
                    <div class="overview-grid">
                        <div class="fig"><img src="${leftOverview}" /></div>
                        <div class="fig"><img src="${rightOverview}" /></div>
                    </div>
                    ${createFooter(pages.length + 1, reportId, tReport)}
                `;
                pages.push(overviewPage);
            }

            paired.forEach((feature, idx) => {
                const featureTypeDefinition = markingTypes.find(
                    t => t.id === feature.left.typeId
                );
                const featureType = resolveFeatureTypeName(
                    featureTypeDefinition,
                    tReport
                );
                const markerRing = toCssColor(
                    featureTypeDefinition?.backgroundColor,
                    "#c0392b"
                );
                const crop = featureCrops[idx];
                const comparison = resolveMetadataComparison(
                    feature.left,
                    feature.right,
                    featureTypeDefinition
                );

                const metaTableHtml =
                    comparison.length > 0
                        ? `
                        <table class="meta-table">
                            <thead>
                                <tr>
                                    <th>${tReport("Earprint attribute")}</th>
                                    <th>${tReport("Image 1")}</th>
                                    <th>${tReport("Image 2")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${comparison
                                    .map(
                                        row => `
                                    <tr>
                                        <td>${escapeHtml(row.fieldLabel)}</td>
                                        <td>${escapeHtml(row.leftLabel)}</td>
                                        <td>${escapeHtml(row.rightLabel)}</td>
                                    </tr>`
                                    )
                                    .join("")}
                            </tbody>
                        </table>`
                        : `<div class="meta-empty">${tReport("Earprint no features")}</div>`;

                const page = createPage();
                page.innerHTML = `
                    <div class="section-title">${tReport("Comparative table details")}</div>
                    <div class="ear-feature-head">
                        <span class="ear-feature-label" style="color:${markerRing};">${escapeHtml(String(feature.left.label))}</span>
                        <span class="ear-feature-type">${tReport("Feature type")} <strong>${escapeHtml(featureType)}</strong></span>
                    </div>
                    <div class="ear-crops">
                        <div class="ear-crop-col">
                            <div class="img-label">${tReport("Image 1")}</div>
                            ${crop ? `<img class="ear-crop-img" src="${crop.left}" />` : ""}
                        </div>
                        <div class="ear-crop-col">
                            <div class="img-label">${tReport("Image 2")}</div>
                            ${crop ? `<img class="ear-crop-img" src="${crop.right}" />` : ""}
                        </div>
                    </div>
                    <div class="section-title">${tReport("Earprint feature characteristics")}</div>
                    ${metaTableHtml}
                    ${createFooter(pages.length + 1, reportId, tReport)}
                `;
                pages.push(page);
            });
        }

        pages.forEach(page => root.appendChild(page));
        document.body.appendChild(root);

        try {
            stage = "render-html";
            await ensureImagesLoaded(root);

            stage = "render-pdf";
            const pdf = await PDFDocument.create();
            const renderedPages = await Promise.all(
                pages.map(page =>
                    html2canvas(page, { scale: 2, backgroundColor: "#ffffff" })
                )
            );
            await renderedPages.reduce(
                async (chainPromise, canvas) => {
                    const chain = await chainPromise;
                    const pngBytes = canvas.toDataURL("image/png");
                    const image = await pdf.embedPng(pngBytes);
                    const p = pdf.addPage([canvas.width, canvas.height]);
                    p.drawImage(image, {
                        x: 0,
                        y: 0,
                        width: canvas.width,
                        height: canvas.height,
                    });
                    chain.push(p);
                    return chain;
                },
                Promise.resolve([] as ReturnType<typeof pdf.addPage>[])
            );

            stage = "save-pdf";
            const pdfBytes = await pdf.save();
            const filePath = await save({
                title: tKeywords("Generate report"),
                filters: [{ name: "PDF", extensions: ["pdf"] }],
                canCreateDirectories: true,
                defaultPath: `earprint-report-${reportId}.pdf`,
            });
            if (!filePath) return;
            await writeFile(filePath, pdfBytes);
        } finally {
            root.remove();
            if (languageChanged) {
                await i18n.changeLanguage(previousLanguage);
            }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
            `[earprint-report] failed at ${stage}: ${message}`,
            error
        );
        throw new Error(`Earprint report failed at ${stage}: ${message}`, {
            cause: error,
        });
    }
};
