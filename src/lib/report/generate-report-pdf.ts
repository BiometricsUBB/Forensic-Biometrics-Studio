import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import { save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { getVersion } from "@tauri-apps/api/app";
import { join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import i18n from "@/lib/locales/i18n";
import type { TFunction } from "i18next";
import * as PIXI from "pixi.js";
import SparkMD5 from "spark-md5";
import { drawMarking } from "@/components/pixi/overlays/markings/marking.utils";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { getCanvas } from "@/components/pixi/canvas/hooks/useCanvas";
import { MarkingsStore } from "@/lib/stores/Markings";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { GlobalSettingsStore } from "@/lib/stores/GlobalSettings";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { WORKING_MODE } from "@/views/selectMode";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { MarkingType } from "@/lib/markings/MarkingType";
import {
    clamp,
    formatReportDateTime,
    formatBytes,
    getMatchedFeatures,
    getPairedByLabel,
} from "./report-utils";

type ReportGenerationOptions = {
    includeMatchedOnly: boolean;
    reportDateTime: string;
    reportLanguage?: string;
    performedBy: string;
    department: string;
    addressLines: string[];
};

type ImageMeta = {
    name: string;
    width: number;
    height: number;
    sizeBytes: number;
    checksum: string;
    bytes: Uint8Array;
};

type RenderedImages = {
    originalDataUrl: string;
    allMarkingsCanvas: HTMLCanvasElement;
    selectedMarkingsCanvas: HTMLCanvasElement;
};

const PAGE = {
    width: 794,
    height: 1123,
    margin: 95,
};
const LANDSCAPE = {
    width: PAGE.height,
    height: PAGE.width,
    margin: 70,
};

const IMAGE_CELL_SIZE = 200;
const ROWS_PER_PAGE = 4;
const FULL_CIRCLE = Math.PI * 2;
const CLOCKWISE_START_ANGLE = -Math.PI / 4;

const getMimeTypeFromName = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".bmp")) return "image/bmp";
    return "application/octet-stream";
};

const toDataUrl = (bytes: Uint8Array, name: string) =>
    new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(
            new Blob([bytes], { type: getMimeTypeFromName(name) })
        );
    });

const md5Bytes = (bytes: Uint8Array) => {
    const buffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    );
    return SparkMD5.ArrayBuffer.hash(buffer);
};

const md5String = (value: string) => SparkMD5.hash(value);

const toCssColor = (value: unknown, fallback: string) => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return `#${(value >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        return value;
    }
    return fallback;
};

const getSystemId = async () => {
    try {
        const id = await invoke<string>("get_machine_id");
        return id || "unknown";
    } catch {
        return "unknown";
    }
};

const getSpritePath = async (sprite: PIXI.Sprite) => {
    // @ts-expect-error custom property
    const path = sprite.path as string | null;
    const name = sprite.name;
    if (!path || !name) return null;
    return join(path, name);
};

const getImageMeta = async (sprite: PIXI.Sprite) => {
    const fullPath = await getSpritePath(sprite);
    if (!fullPath) {
        throw new Error("Missing image path for report generation.");
    }
    const bytes = await readFile(fullPath);
    const bitmap = await createImageBitmap(new Blob([bytes]));
    const checksum = md5Bytes(bytes);

    return {
        name: sprite.name ?? "image",
        width: bitmap.width,
        height: bitmap.height,
        sizeBytes: bytes.byteLength,
        checksum,
        bytes,
    } satisfies ImageMeta;
};

const renderImageWithMarkings = async (
    imageBytes: Uint8Array,
    markings: MarkingClass[],
    markingTypes: MarkingType[],
    sizeScale: number,
    options?: {
        showMarkingLabels?: boolean;
        markingsAlpha?: number;
    }
) => {
    const bitmap = await createImageBitmap(new Blob([imageBytes]));
    const { width, height } = bitmap;
    const showMarkingLabels = options?.showMarkingLabels ?? true;
    const markingsAlpha = options?.markingsAlpha ?? 1;

    const app = new PIXI.Application({
        width,
        height,
        backgroundAlpha: 0,
        antialias: true,
        preserveDrawingBuffer: true,
    });

    const sprite = new PIXI.Sprite(PIXI.Texture.from(bitmap));
    sprite.position.set(0, 0);
    app.stage.addChild(sprite);

    const g = new PIXI.Graphics();
    g.alpha = markingsAlpha;
    app.stage.addChild(g);

    const scaledTypes = markingTypes.map(type => ({
        ...type,
        size: Math.max(2, type.size * sizeScale),
    }));

    markings.forEach(marking => {
        const type = scaledTypes.find(t => t.id === marking.typeId);
        if (!type) return;
        drawMarking(
            g,
            false,
            marking,
            type,
            1,
            1,
            showMarkingLabels,
            0,
            width / 2,
            height / 2
        );
    });

    const canvas = app.renderer.extract.canvas(app.stage);
    app.destroy(true, { children: true, texture: true, baseTexture: true });
    return canvas as HTMLCanvasElement;
};

const cropCanvas = (
    source: HTMLCanvasElement,
    centerX: number,
    centerY: number,
    size: number
) => {
    const safeSize = Math.max(1, Math.min(size, source.width, source.height));
    const half = safeSize / 2;
    const sx = clamp(centerX - half, 0, source.width - safeSize);
    const sy = clamp(centerY - half, 0, source.height - safeSize);
    const canvas = document.createElement("canvas");
    canvas.width = safeSize;
    canvas.height = safeSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to create canvas context.");
    ctx.drawImage(source, sx, sy, safeSize, safeSize, 0, 0, safeSize, safeSize);
    return canvas.toDataURL("image/png");
};

const createOverviewCalloutImage = async (
    imageBytes: Uint8Array,
    features: MarkingClass[]
) => {
    const bitmap = await createImageBitmap(new Blob([imageBytes]));
    const { width, height } = bitmap;
    const numberCircleRadius = Math.max(
        12,
        Math.round(Math.min(width, height) * 0.02)
    );
    const margin = Math.max(84, Math.round(Math.min(width, height) * 0.22));
    const canvas = document.createElement("canvas");
    canvas.width = width + margin * 2;
    canvas.height = height + margin * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to create canvas context.");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, margin, margin);

    const centerX = margin + width / 2;
    const centerY = margin + height / 2;
    const baseLabelRadiusX = width / 2 + margin * 0.74;
    const baseLabelRadiusY = height / 2 + margin * 0.74;
    const labelSpacing = numberCircleRadius * 2 + 10;
    const fontSize = Math.max(12, Math.round(numberCircleRadius * 1.1));
    const placedLabels: Array<{ x: number; y: number }> = [];
    const placementOrder = [...features]
        .sort((a, b) => a.label - b.label)
        .map((feature, index, arr) => {
            const angle =
                CLOCKWISE_START_ANGLE +
                (index / Math.max(1, arr.length)) * FULL_CIRCLE;
            return { feature, angle };
        });
    const angularOffsets = [0, 0.08, -0.08, 0.16, -0.16, 0.24, -0.24];

    ctx.strokeStyle = "#cc0000";
    ctx.fillStyle = "#cc0000";
    ctx.lineWidth = 2.2;
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    placementOrder.forEach(({ feature, angle: slotAngle }) => {
        const fx = feature.origin.x + margin;
        const fy = feature.origin.y + margin;
        const baseAngle = slotAngle;
        const baseCos = Math.cos(baseAngle);
        const baseSin = Math.sin(baseAngle);

        let lx = centerX + baseCos * baseLabelRadiusX;
        let ly = centerY + baseSin * baseLabelRadiusY;

        let placed = false;
        for (let ring = 0; ring < 12 && !placed; ring += 1) {
            const radialBoost = ring * (numberCircleRadius + 6);
            angularOffsets.some(angleOffset => {
                const angle = baseAngle + angleOffset;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const candidateX =
                    centerX + cos * (baseLabelRadiusX + radialBoost);
                const candidateY =
                    centerY + sin * (baseLabelRadiusY + radialBoost);
                const safeX = clamp(
                    candidateX,
                    numberCircleRadius + 2,
                    canvas.width - numberCircleRadius - 2
                );
                const safeY = clamp(
                    candidateY,
                    numberCircleRadius + 2,
                    canvas.height - numberCircleRadius - 2
                );
                const isOutsideImage =
                    safeX < margin ||
                    safeX > margin + width ||
                    safeY < margin ||
                    safeY > margin + height;
                const overlapsExisting = placedLabels.some(
                    existing =>
                        Math.hypot(existing.x - safeX, existing.y - safeY) <
                        labelSpacing
                );
                if (isOutsideImage && !overlapsExisting) {
                    lx = safeX;
                    ly = safeY;
                    placed = true;
                    return true;
                }
                return false;
            });
        }
        placedLabels.push({ x: lx, y: ly });

        ctx.beginPath();
        ctx.moveTo(fx, fy);
        const dx = lx - fx;
        const dy = ly - fy;
        const length = Math.max(1, Math.hypot(dx, dy));
        const lineEndX = lx - (dx / length) * numberCircleRadius;
        const lineEndY = ly - (dy / length) * numberCircleRadius;
        ctx.lineTo(lineEndX, lineEndY);
        ctx.stroke();

        const label = String(feature.label);
        ctx.beginPath();
        ctx.fillStyle = "#ffffff";
        ctx.arc(lx, ly, numberCircleRadius, 0, FULL_CIRCLE);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#cc0000";
        ctx.fillText(label, lx, ly + 0.5);
    });

    return canvas.toDataURL("image/png");
};

const ensureImagesLoaded = async (container: HTMLElement) => {
    const images = Array.from(container.querySelectorAll("img"));
    await Promise.all(
        images.map(img =>
            img.complete
                ? Promise.resolve()
                : new Promise<void>(resolve => {
                      img.onload = () => resolve();
                      img.onerror = () => resolve();
                  })
        )
    );
};

const createPage = () => {
    const page = document.createElement("div");
    page.className = "report-page";
    return page;
};

const createLandscapePage = () => {
    const page = document.createElement("div");
    page.className = "report-page landscape";
    return page;
};

const createReportRoot = () => {
    const root = document.createElement("div");
    root.className = "report-root";
    return root;
};

const createStyles = () => {
    const style = document.createElement("style");
    style.textContent = `
        .report-root { position: fixed; left: -10000px; top: 0; width: ${PAGE.width}px; }
        .report-page { width: ${PAGE.width}px; height: ${PAGE.height}px; background: #fff; color: #111; font-family: "Arial", sans-serif; padding: ${PAGE.margin}px; box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; }
        .report-page.landscape { width: ${LANDSCAPE.width}px; height: ${LANDSCAPE.height}px; padding: ${LANDSCAPE.margin}px; }
        .report-title { font-size: 18px; font-weight: 700; text-align: center; margin-bottom: 6px; }
        .section-title { font-size: 12px; font-weight: 700; margin-top: 4px; }
        .meta-grid { display: grid; grid-template-columns: 1fr; gap: 6px; font-size: 11px; }
        .meta-block { display: grid; gap: 2px; }
        .software-grid, .input-grid { display: grid; gap: 4px; font-size: 11px; }
        .counts { display: grid; gap: 2px; font-size: 11px; }
        .fig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; }
        .fig { display: grid; gap: 4px; font-size: 10px; text-align: center; }
        .fig img { width: 100%; height: auto; border: 1px solid #ddd; }
        .overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .overview-grid.landscape { grid-template-columns: 1fr 1fr; align-items: center; }
        .overview-grid img { width: 100%; height: auto; border: 1px solid #ddd; }
        .zoom img { width: 100%; height: auto; border: 1px solid #ddd; }
        .note { font-size: 11px; border-top: 1px solid #ddd; padding-top: 6px; }
        .table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .table th, .table td { border: 1px solid #ccc; padding: 4px; vertical-align: middle; }
        .feature-cell { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
        .feature-index {
            width: 22px;
            height: 22px;
            border-radius: 999px;
            background: #ffffff;
            color: var(--marker-text, #7a0000);
            border: 2px solid var(--marker-ring, #cc0000);
            box-shadow: 0 0 0 1px var(--marker-outline, #7a0000);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            line-height: 1;
            font-weight: 700;
            font-family: Arial, sans-serif;
            transform: translateY(2px);
        }
        .feature-index-value {
            display: inline-block;
            line-height: 1;
            transform: translateY(-7px);
        }
        .feature-type { font-size: 9px; }
        .feature-image { width: ${IMAGE_CELL_SIZE}px; height: ${IMAGE_CELL_SIZE}px; object-fit: cover; border: 1px solid #ddd; }
        .footer { margin-top: auto; font-size: 10px; display: flex; justify-content: space-between; }
    `;
    return style;
};

type ReportT = TFunction<"report">;

const createFooter = (
    pageNumber: number,
    reportId: string,
    tReport: ReportT
) => `
    <div class="footer">
        <div>${tReport("Page")} ${pageNumber}</div>
        <div>${tReport("Report ID label")} ${reportId}</div>
    </div>
`;

const createFigurePage = (
    title: string,
    image: string,
    imageLabel: string,
    pageNumber: number,
    reportId: string,
    tReport: ReportT
) => {
    const page = createPage();
    page.innerHTML = `
        <div class="meta-block">${imageLabel}</div>
        <div class="fig">
            <img src="${image}" />
        </div>
        <div class="section-title">${title}</div>
        ${createFooter(pageNumber, reportId, tReport)}
    `;
    return page;
};

export const generateReportPdfWithDialog = async (
    options: ReportGenerationOptions
) => {
    let stage = "init";
    const previousLanguage = i18n.language;
    let languageChanged = false;
    try {
        stage = "check-working-mode";
        const workingMode = WorkingModeStore.state.workingMode;
        if (workingMode !== WORKING_MODE.FINGERPRINT) {
            throw new Error(
                "Report generation is available only for fingerprints."
            );
        }

        stage = "get-viewports";
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
        const leftCanvas = getCanvas(CANVAS_ID.LEFT, true);
        const rightCanvas = getCanvas(CANVAS_ID.RIGHT, true);
        const leftViewport = leftCanvas.viewport;
        const rightViewport = rightCanvas.viewport;

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

        stage = "collect-markings";
        const markingsLeft = MarkingsStore(CANVAS_ID.LEFT).state.markings;
        const markingsRight = MarkingsStore(CANVAS_ID.RIGHT).state.markings;
        const markingTypes = MarkingTypesStore.state.types;

        const matched = options.includeMatchedOnly
            ? getMatchedFeatures(markingsLeft, markingsRight)
            : getPairedByLabel(markingsLeft, markingsRight);

        stage = "read-image-meta";
        const leftMeta = await getImageMeta(leftSprite);
        const rightMeta = await getImageMeta(rightSprite);
        const selectedFeatures = matched;

        stage = "image-data-urls";
        const leftOriginal = await toDataUrl(leftMeta.bytes, leftMeta.name);
        const rightOriginal = await toDataUrl(rightMeta.bytes, rightMeta.name);

        stage = "render-overlays";
        const leftAllCanvas = await renderImageWithMarkings(
            leftMeta.bytes,
            markingsLeft,
            markingTypes,
            1.6
        );
        const rightAllCanvas = await renderImageWithMarkings(
            rightMeta.bytes,
            markingsRight,
            markingTypes,
            1.6
        );

        const leftSelectedCanvas = await renderImageWithMarkings(
            leftMeta.bytes,
            selectedFeatures.map(x => x.left),
            markingTypes,
            1.6
        );
        const rightSelectedCanvas = await renderImageWithMarkings(
            rightMeta.bytes,
            selectedFeatures.map(x => x.right),
            markingTypes,
            1.6
        );
        const detailCrops = await Promise.all(
            selectedFeatures.map(async feature => {
                const [leftSingleCanvas, rightSingleCanvas] = await Promise.all(
                    [
                        renderImageWithMarkings(
                            leftMeta.bytes,
                            [feature.left],
                            markingTypes,
                            1.6,
                            { showMarkingLabels: false, markingsAlpha: 0.45 }
                        ),
                        renderImageWithMarkings(
                            rightMeta.bytes,
                            [feature.right],
                            markingTypes,
                            1.6,
                            { showMarkingLabels: false, markingsAlpha: 0.45 }
                        ),
                    ]
                );

                return {
                    left: cropCanvas(
                        leftSingleCanvas,
                        feature.left.origin.x,
                        feature.left.origin.y,
                        IMAGE_CELL_SIZE
                    ),
                    right: cropCanvas(
                        rightSingleCanvas,
                        feature.right.origin.x,
                        feature.right.origin.y,
                        IMAGE_CELL_SIZE
                    ),
                };
            })
        );

        const leftImages: RenderedImages = {
            originalDataUrl: leftOriginal,
            allMarkingsCanvas: leftAllCanvas,
            selectedMarkingsCanvas: leftSelectedCanvas,
        };
        const rightImages: RenderedImages = {
            originalDataUrl: rightOriginal,
            allMarkingsCanvas: rightAllCanvas,
            selectedMarkingsCanvas: rightSelectedCanvas,
        };

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

        const decodeUnicodeEscapes = (value: string) =>
            value.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) =>
                String.fromCharCode(parseInt(hex, 16))
            );
        const stripDiacritics = (value: string) => value;

        const performedBy = stripDiacritics(
            decodeUnicodeEscapes(
                options.performedBy?.trim() ||
                    reportSettings?.performedBy ||
                    "-"
            )
        );
        const department = stripDiacritics(
            decodeUnicodeEscapes(
                options.department?.trim() || reportSettings?.department || "-"
            )
        );
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
        const address = (
            addressLines.length > 0 ? addressLines : addressFallback
        ).map(line => stripDiacritics(decodeUnicodeEscapes(line)));

        const appVersion = await getVersion();

        stage = "build-dom";
        const root = createReportRoot();
        root.appendChild(createStyles());

        const addressHtml =
            address.length > 0
                ? address.map(line => `<div>${line}</div>`).join("")
                : "<div>-</div>";

        const page1 = createPage();
        page1.innerHTML = `
        <div class="report-title">${tReport("Technical report title")}</div>
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
                <div><strong>${tReport("Image 1")}:</strong></div>
                <div>${tReport("File name")} ${leftMeta.name}</div>
                <div>${tReport("Image dimensions")} ${leftMeta.width} x ${leftMeta.height} px</div>
                <div>${tReport("Size")} ${formatBytes(leftMeta.sizeBytes)}</div>
                <div>${tReport("Checksum")} ${leftMeta.checksum}</div>
            </div>
            <div class="meta-block">
                <div><strong>${tReport("Image 2")}:</strong></div>
                <div>${tReport("File name")} ${rightMeta.name}</div>
                <div>${tReport("Image dimensions")} ${rightMeta.width} x ${rightMeta.height} px</div>
                <div>${tReport("Size")} ${formatBytes(rightMeta.sizeBytes)}</div>
                <div>${tReport("Checksum")} ${rightMeta.checksum}</div>
            </div>
        </div>

        <div class="counts">
            <div>${tReport("Matched features count")} ${matched.length}</div>
            <div>${tReport("Selected features count")} ${selectedFeatures.length}</div>
        </div>

        <div class="note">
            <div class="section-title">${tReport("Note title")}</div>
            <div>${tReport("Note body")}</div>
        </div>

        ${createFooter(1, reportId, tReport)}
    `;

        const pages: HTMLElement[] = [page1];

        pages.push(
            createFigurePage(
                tReport("Figure 1"),
                leftImages.originalDataUrl,
                tReport("Image 1 label"),
                pages.length + 1,
                reportId,
                tReport
            )
        );
        pages.push(
            createFigurePage(
                tReport("Figure 2"),
                leftImages.allMarkingsCanvas.toDataURL("image/png"),
                tReport("Image 1 label"),
                pages.length + 1,
                reportId,
                tReport
            )
        );
        pages.push(
            createFigurePage(
                tReport("Figure 3"),
                rightImages.originalDataUrl,
                tReport("Image 2 label"),
                pages.length + 1,
                reportId,
                tReport
            )
        );
        pages.push(
            createFigurePage(
                tReport("Figure 4"),
                rightImages.allMarkingsCanvas.toDataURL("image/png"),
                tReport("Image 2 label"),
                pages.length + 1,
                reportId,
                tReport
            )
        );

        const leftOverview = await createOverviewCalloutImage(
            leftMeta.bytes,
            selectedFeatures.map(x => x.left)
        );
        const rightOverview = await createOverviewCalloutImage(
            rightMeta.bytes,
            selectedFeatures.map(x => x.right)
        );

        const overviewPage = createLandscapePage();
        overviewPage.innerHTML = `
        <div class="section-title">${tReport("Comparative table overview")}</div>
        <div class="overview-grid landscape">
            <img src="${leftOverview}" />
            <img src="${rightOverview}" />
        </div>
        ${createFooter(pages.length + 1, reportId, tReport)}
    `;
        pages.push(overviewPage);

        // Zoom page removed per requirement.

        const detailsStartIndex = pages.length;
        selectedFeatures.forEach((feature, idx) => {
            const pageIndex = Math.floor(idx / ROWS_PER_PAGE);
            const targetIndex = detailsStartIndex + pageIndex;
            if (!pages[targetIndex]) {
                const page = createPage();
                page.innerHTML = `
                <div class="section-title">${tReport("Comparative table details")}</div>
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
                pages[targetIndex] = page;
            }

            const tableBody = pages[targetIndex].querySelector(
                "tbody"
            ) as HTMLTableSectionElement | null;
            if (!tableBody) return;

            const featureTypeDefinition = markingTypes.find(
                type => type.id === feature.left.typeId
            );
            const featureType = featureTypeDefinition?.name;
            const markerRing = toCssColor(
                featureTypeDefinition?.backgroundColor,
                "#cc0000"
            );
            const markerOutline = toCssColor(
                featureTypeDefinition?.textColor,
                "#7a0000"
            );
            const leftCrop = detailCrops[idx].left;
            const rightCrop = detailCrops[idx].right;

            const row = document.createElement("tr");
            row.innerHTML = `
            <td>
                    <div class="feature-cell">
                        <div
                            class="feature-index"
                            style="--marker-ring: ${markerRing}; --marker-outline: ${markerOutline}; --marker-text: ${markerOutline};"
                        >
                            <span class="feature-index-value">${feature.left.label}</span>
                        </div>
                    <div class="feature-type">${tReport("Feature type")} ${featureType ?? "-"}</div>
                </div>
            </td>
            <td><img class="feature-image" src="${leftCrop}" /></td>
            <td><img class="feature-image" src="${rightCrop}" /></td>
        `;
            tableBody.appendChild(row);
        });

        pages.forEach(page => root.appendChild(page));
        document.body.appendChild(root);
        try {
            stage = "render-html";
            await ensureImagesLoaded(root);

            stage = "render-pdf";
            const pdf = await PDFDocument.create();
            const renderedPages = await Promise.all(
                pages.map(page =>
                    html2canvas(page, {
                        scale: 2,
                        backgroundColor: "#ffffff",
                    })
                )
            );

            for (const canvas of renderedPages) {
                const pngBytes = canvas.toDataURL("image/png");
                const image = await pdf.embedPng(pngBytes);
                const page = pdf.addPage([canvas.width, canvas.height]);
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: canvas.width,
                    height: canvas.height,
                });
            }

            stage = "save-pdf";
            const pdfBytes = await pdf.save();

            const filePath = await save({
                title: tKeywords("Generate report"),
                filters: [{ name: "PDF", extensions: ["pdf"] }],
                canCreateDirectories: true,
                defaultPath: `report-${reportId}.pdf`,
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
        console.error(`[report] failed at ${stage}: ${message}`, error);
        throw new Error(`Report failed at ${stage}: ${message}`);
    }
};
