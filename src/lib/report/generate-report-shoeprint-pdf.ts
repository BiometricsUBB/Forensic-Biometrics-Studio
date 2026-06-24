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

// Shoeprint submodules
import {
    type ShoeprintReportGenerationOptions,
    PREFIX_PATTERN,
    PREFIX_GROUP,
    PREFIX_UNIQUE,
    UNIQUE_ROWS_PER_PAGE,
    IMAGE_CELL_SIZE,
    OVERVIEW_CHUNK_SIZE,
} from "./shoeprint/types";
import {
    getImageMeta,
    renderImageWithMarkings,
    cropCanvas,
    getMarkingCenter,
    getMarkingExtent,
} from "./shoeprint/render-utils";
import { createOverviewCalloutImage } from "./shoeprint/callout-placement";
import {
    toCssColor,
    escapeHtml,
    resolveFeatureTypeName,
    createFooter,
    createPage,
    createReportRoot,
    createStyles,
    createFigurePage,
    createCategoryPages,
    groupPairedByPrefix,
    ensureImagesLoaded,
} from "./shoeprint/page-builders";

const getTypePrefix = (displayName: string): string => {
    const match = displayName.match(/^([A-Z]+):/);
    return match ? `${match[1]}:` : "";
};

const getSystemId = async () => {
    try {
        const id = await invoke<string>("get_machine_id");
        return id || "unknown";
    } catch {
        return "unknown";
    }
};

// ─── Main export ──────────────────────────────────────────────────────────────

/* eslint-disable sonarjs/cognitive-complexity */
export const generateShoeprintReportPdfWithDialog = async (
    options: ShoeprintReportGenerationOptions
) => {
    let stage = "init";
    const previousLanguage = i18n.language;
    let languageChanged = false;
    try {
        stage = "check-working-mode";
        const { workingMode } = WorkingModeStore.state;
        if (workingMode !== WORKING_MODE.SHOEPRINT) {
            throw new Error(
                "Report generation is available only for shoeprints."
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

        const reportPaired = paired.filter(p => {
            const type = markingTypes.find(t => t.id === p.left.typeId);
            if (!type) return false;
            const dn = type.displayName ?? type.name ?? "";
            const prefix = getTypePrefix(dn);
            return (
                prefix === PREFIX_PATTERN ||
                prefix === PREFIX_GROUP ||
                prefix === PREFIX_UNIQUE
            );
        });

        const patternGrouped = groupPairedByPrefix(
            reportPaired,
            markingTypes,
            PREFIX_PATTERN
        );
        const groupGrouped = groupPairedByPrefix(
            reportPaired,
            markingTypes,
            PREFIX_GROUP
        );
        const uniquePaired = reportPaired.filter(p => {
            const type = markingTypes.find(t => t.id === p.left.typeId);
            const dn = type?.displayName ?? type?.name ?? "";
            return getTypePrefix(dn) === PREFIX_UNIQUE;
        });

        stage = "read-image-meta";
        const leftMeta = await getImageMeta(leftSprite);
        const rightMeta = await getImageMeta(rightSprite);

        stage = "image-data-urls";
        const leftOriginal = await toDataUrl(leftMeta.bytes, leftMeta.name);
        const rightOriginal = await toDataUrl(rightMeta.bytes, rightMeta.name);

        stage = "render-overlays";
        const leftAllCanvas = await renderImageWithMarkings(
            leftMeta.bytes,
            markingsLeft,
            markingTypes,
            1.6,
            { showMarkingLabels: true }
        );
        const rightAllCanvas = await renderImageWithMarkings(
            rightMeta.bytes,
            markingsRight,
            markingTypes,
            1.6,
            { showMarkingLabels: true }
        );

        stage = "unique-crops";

        const [leftOrigCanvas, rightOrigCanvas] = await Promise.all([
            renderImageWithMarkings(leftMeta.bytes, [], markingTypes, 1.6),
            renderImageWithMarkings(rightMeta.bytes, [], markingTypes, 1.6),
        ]);

        const BATCH_SIZE = 4;
        const uniqueCrops: Array<{
            leftWith: string;
            rightWith: string;
            leftOrig: string;
            rightOrig: string;
        }> = [];

        for (let i = 0; i < uniquePaired.length; i += BATCH_SIZE) {
            const batch = uniquePaired.slice(i, i + BATCH_SIZE);
            // eslint-disable-next-line no-await-in-loop
            const batchResults = await Promise.all(
                batch.map(async feature => {
                    const [leftWithCanvas, rightWithCanvas] = await Promise.all(
                        [
                            renderImageWithMarkings(
                                leftMeta.bytes,
                                [feature.left],
                                markingTypes,
                                1.6,
                                {
                                    showMarkingLabels: false,
                                    markingsAlpha: 0.45,
                                }
                            ),
                            renderImageWithMarkings(
                                rightMeta.bytes,
                                [feature.right],
                                markingTypes,
                                1.6,
                                {
                                    showMarkingLabels: false,
                                    markingsAlpha: 0.45,
                                }
                            ),
                        ]
                    );

                    const leftCenter = getMarkingCenter(feature.left);
                    const rightCenter = getMarkingCenter(feature.right);
                    const leftExtent = getMarkingExtent(feature.left);
                    const rightExtent = getMarkingExtent(feature.right);
                    const maxExtent = Math.max(leftExtent, rightExtent);
                    const targetSize = Math.max(
                        60,
                        Math.min(IMAGE_CELL_SIZE, Math.round(maxExtent / 0.7))
                    );

                    const leftWith = cropCanvas(
                        leftWithCanvas,
                        leftCenter.x,
                        leftCenter.y,
                        targetSize
                    );
                    const rightWith = cropCanvas(
                        rightWithCanvas,
                        rightCenter.x,
                        rightCenter.y,
                        targetSize
                    );
                    const leftOrig = cropCanvas(
                        leftOrigCanvas,
                        leftCenter.x,
                        leftCenter.y,
                        targetSize
                    );
                    const rightOrig = cropCanvas(
                        rightOrigCanvas,
                        rightCenter.x,
                        rightCenter.y,
                        targetSize
                    );

                    return {
                        leftWith: leftWith.toDataURL("image/png"),
                        rightWith: rightWith.toDataURL("image/png"),
                        leftOrig: leftOrig.toDataURL("image/png"),
                        rightOrig: rightOrig.toDataURL("image/png"),
                    };
                })
            );
            uniqueCrops.push(...batchResults);
        }

        stage = "report-metadata";
        const reportSettings = GlobalSettingsStore.state.settings.report;
        const reportDateTime =
            options.reportDateTime?.trim() || formatReportDateTime(new Date());
        const systemId = await getSystemId();
        const reportIdInput = [
            reportDateTime,
            leftMeta.sizeBytes,
            leftMeta.checksum,
            rightMeta.sizeBytes,
            rightMeta.checksum,
            systemId,
        ].join("|");
        const reportId = md5String(reportIdInput);

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

        const appVersion = await getVersion();

        stage = "build-dom";
        const root = createReportRoot();
        root.appendChild(createStyles());

        const addressHtml =
            address.length > 0
                ? address.map(line => `<div>${escapeHtml(line)}</div>`).join("")
                : "<div>-</div>";

        const page1 = createPage();
        page1.innerHTML = `
        <div class="report-title">${escapeHtml(options.reportTitle?.trim() || tReport("Shoeprint report title"))}</div>
    
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
            <div class="software-row"><span class="software-label">${tReport("Application name")}</span><span>Biometrics-Studio</span></div>
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
            <div class="input-row"><span class="input-label">${tReport("Shoeprint paired features count")}</span><span>${reportPaired.length}</span></div>
        </div>
    
        <div class="note">
            <div class="note-title">${tReport("Note title")}</div>
            <div>${tReport("Note body")}</div>
        </div>
    
        ${createFooter(1, reportId, tReport)}
        `;

        const pages: HTMLElement[] = [page1];

        // Pages 2-5: Fig 1-4
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
                tReport("Shoeprint figure 3"),
                rightOriginal,
                tReport("Image 2 label"),
                4,
                reportId,
                tReport
            )
        );
        pages.push(
            createFigurePage(
                tReport("Shoeprint figure 4"),
                rightAllCanvas.toDataURL("image/png"),
                tReport("Image 2 label"),
                5,
                reportId,
                tReport
            )
        );

        // P: pages - one page per type
        const patternPages = await createCategoryPages(
            patternGrouped,
            leftMeta,
            rightMeta,
            markingTypes,
            tReport("Shoeprint pattern features title"),
            pages.length + 1,
            reportId,
            tReport
        );
        patternPages.forEach(p => pages.push(p));

        // G: pages - one page per type
        const groupPages = await createCategoryPages(
            groupGrouped,
            leftMeta,
            rightMeta,
            markingTypes,
            tReport("Shoeprint group features title"),
            pages.length + 1,
            reportId,
            tReport
        );
        groupPages.forEach(p => pages.push(p));

        // U: overview pages (chunked to max OVERVIEW_CHUNK_SIZE per page)
        if (uniquePaired.length > 0) {
            const calloutColor =
                options.uniqueColor === "green" ? "#2ecc71" : "#cc0000";

            for (let i = 0; i < uniquePaired.length; i += OVERVIEW_CHUNK_SIZE) {
                const chunk = uniquePaired.slice(i, i + OVERVIEW_CHUNK_SIZE);
                // eslint-disable-next-line no-await-in-loop
                const leftOverview = await createOverviewCalloutImage(
                    leftMeta.bytes,
                    chunk.map(x => x.left),
                    calloutColor
                );
                // eslint-disable-next-line no-await-in-loop
                const rightOverview = await createOverviewCalloutImage(
                    rightMeta.bytes,
                    chunk.map(x => x.right),
                    calloutColor
                );
                const overviewPage = createPage();
                overviewPage.innerHTML = `
                    <div class="category-title">${tReport("Shoeprint comparative table overview")}</div>
                    <div class="overview-grid">
                        <div class="fig"><img src="${leftOverview}" /></div>
                        <div class="fig"><img src="${rightOverview}" /></div>
                    </div>
                    ${createFooter(pages.length + 1, reportId, tReport)}
                `;
                pages.push(overviewPage);
            }

            const detailsStartIndex = pages.length;
            uniquePaired.forEach((feature, idx) => {
                const pageIndex = Math.floor(idx / UNIQUE_ROWS_PER_PAGE);
                const targetIndex = detailsStartIndex + pageIndex;
                // eslint-disable-next-line security/detect-object-injection
                if (!pages[targetIndex]) {
                    const page = createPage();
                    page.innerHTML = `
                        <div class="section-title">${tReport("Shoeprint comparative table details")}</div>
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>${tReport("Feature")}</th>
                                    <th>${tReport("Image 1")}</th>
                                    <th>${tReport("Image 2")}</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                        ${createFooter(targetIndex + 1, reportId, tReport)}
                    `;
                    // eslint-disable-next-line security/detect-object-injection
                    pages[targetIndex] = page;
                }

                // eslint-disable-next-line security/detect-object-injection
                const tableBody = pages[targetIndex].querySelector(
                    "tbody"
                ) as HTMLTableSectionElement | null;
                if (!tableBody) return;

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
                // eslint-disable-next-line security/detect-object-injection
                const crop = uniqueCrops[idx];
                if (!crop) return;

                // Row 1: with marking overlay
                const row1 = document.createElement("tr");
                row1.innerHTML = `
                    <td rowspan="2">
                        <div class="feature-cell">
                            <div class="feature-label" style="color: ${markerRing};">${escapeHtml(String(feature.left.label))}</div>
                            <div class="feature-type">${tReport("Feature type")}:<br/><strong>${escapeHtml(featureType)}</strong></div>
                        </div>
                    </td>
                    <td><img class="feature-image" src="${crop.leftWith}" /></td>
                    <td><img class="feature-image" src="${crop.rightWith}" /></td>
                `;
                tableBody.appendChild(row1);

                // Row 2: original without marking
                const row2 = document.createElement("tr");
                row2.innerHTML = `
                    <td><img class="feature-image" src="${crop.leftOrig}" /></td>
                    <td><img class="feature-image" src="${crop.rightOrig}" /></td>
                `;
                tableBody.appendChild(row2);
            });
        } else {
            const noUniquePage = createPage();
            noUniquePage.innerHTML = `
                <div class="section-title">${tReport("Shoeprint comparative table overview")}</div>
                <div style="font-size:12px; margin-top: 16px;">${tReport("Shoeprint no unique features")}</div>
                ${createFooter(pages.length + 1, reportId, tReport)}
            `;
            pages.push(noUniquePage);
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
                defaultPath: `shoeprint-report-${reportId}.pdf`,
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
        // eslint-disable-next-line no-console
        console.error(
            `[shoeprint-report] failed at ${stage}: ${message}`,
            error
        );
        throw new Error(`Shoeprint report failed at ${stage}: ${message}`, {
            cause: error,
        });
    }
};
/* eslint-enable sonarjs/cognitive-complexity */
