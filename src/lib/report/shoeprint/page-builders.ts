import type { TFunction } from "i18next";
import { MarkingType } from "@/lib/markings/MarkingType";
import { PAGE, LANDSCAPE, IMAGE_CELL_SIZE } from "./types";
import type { ImageMeta, PairedFeature } from "./types";
import { renderImageWithMarkings } from "./render-utils";

type ReportT = TFunction<"report">;
export type GroupedByType = Map<
    string,
    { type: MarkingType; pairs: PairedFeature[] }
>;

export const toCssColor = (value: unknown, fallback: string) => {
    if (typeof value === "number" && Number.isFinite(value)) {
        // eslint-disable-next-line no-bitwise
        return `#${(value >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
    }
    if (typeof value === "string" && value.trim().length > 0) return value;
    return fallback;
};

export const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

export const resolveFeatureTypeName = (
    featureTypeDefinition: MarkingType | undefined,
    tReport: ReportT
) => {
    if (!featureTypeDefinition) return "-";
    const baseName =
        featureTypeDefinition.displayName?.trim() ||
        featureTypeDefinition.name?.trim() ||
        "-";
    return tReport(baseName as never, { defaultValue: baseName });
};

export const createFooter = (
    pageNumber: number,
    reportId: string,
    tReport: ReportT
) =>
    `<div class="footer"><div>${tReport("Page")} ${pageNumber}</div><div>${tReport("Report ID label")} ${reportId}</div></div>`;

export const createPage = () => {
    const page = document.createElement("div");
    page.className = "report-page";
    return page;
};

export const createReportRoot = () => {
    const root = document.createElement("div");
    root.className = "report-root";
    return root;
};

export const createStyles = () => {
    const style = document.createElement("style");
    style.textContent = `
        .report-root { position: fixed; left: -10000px; top: 0; width: ${PAGE.width}px; }
        .report-page { width: ${PAGE.width}px; height: ${PAGE.height}px; background: #fff; color: #111; font-family: "Arial", sans-serif; padding: ${PAGE.margin}px; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; }
        .report-page.landscape { width: ${LANDSCAPE.width}px; height: ${LANDSCAPE.height}px; padding: ${LANDSCAPE.margin}px; }
        .report-title { font-size: 18px; font-weight: 700; text-align: center; margin-bottom: 10px; }
        .meta-row { display: flex; gap: 16px; font-size: 11px; margin-bottom: 2px; }
        .meta-label { font-weight: 700; min-width: 180px; }
        .meta-block { font-size: 11px; margin-top: 6px; margin-bottom: 6px; }
        .section-title { font-size: 11px; font-weight: 700; margin-top: 8px; margin-bottom: 4px; }
        .software-grid { font-size: 11px; display: grid; gap: 2px; }
        .software-row { display: flex; gap: 16px; }
        .software-label { font-weight: 700; min-width: 180px; }
        .input-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 11px; }
        .input-stack { font-size: 11px; margin-bottom: 6px; }
        .input-stack .input-block-title { font-weight: 700; margin-bottom: 2px; }
        .input-block-title { font-weight: 700; margin-bottom: 4px; }
        .input-row { display: flex; gap: 8px; }
        .input-label { font-weight: 700; min-width: 120px; }
        .counts { font-size: 11px; display: flex; gap: 8px; margin-top: 4px; }
        .counts-label { font-weight: 700; }
        .note { font-size: 11px; border-top: 1px solid #ccc; padding-top: 8px; margin-top: auto; }
        .note-title { font-weight: 700; margin-bottom: 2px; }
        .fig-label { font-size: 11px; font-weight: 400; margin-bottom: 4px; }
        .fig { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid #ccc; }
        .fig img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
        .fig-caption { font-size: 11px; font-weight: 700; text-align: center; margin-top: 6px; }
        .category-title { font-size: 14px; font-weight: 700; text-align: center; margin-bottom: 8px; }
        .type-title { font-size: 11px; margin-bottom: 6px; }
        .type-images-grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; overflow: hidden; }
        .type-image-col { display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
        .img-label { font-size: 10px; font-weight: 700; text-align: center; }
        .type-image-col .fig { flex: 1; }
        .overview-grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; overflow: hidden; align-items: start; }
        .overview-grid .fig { border: none; }
        .table { table-layout: fixed; width: 100%; border-collapse: collapse; font-size: 10px; }
        .table th { border: 1px solid #ccc; padding: 5px 8px; background: #f0f0f0; font-weight: 700; text-align: center; }
        .table td { border: 1px solid #ccc; padding: 4px; vertical-align: middle; text-align: center; overflow: hidden; }
        .table td:first-child { text-align: center; width: 90px; }
        .table td:nth-child(2), .table td:nth-child(3) { width: ${IMAGE_CELL_SIZE}px; }
        .feature-cell { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 4px 0; }
        .feature-label { font-size: 20px; font-weight: 700; color: #c0392b; text-align: center; margin: 0 auto; display: block; }
        .feature-type { font-size: 9px; color: #333; text-align: center; line-height: 1.3; }
        .feature-image { width: ${IMAGE_CELL_SIZE}px; height: ${IMAGE_CELL_SIZE}px; object-fit: cover; border: 1px solid #ddd; display: block; margin: 0 auto; }
        .footer { font-size: 9px; display: flex; justify-content: space-between; border-top: 1px solid #eee; padding-top: 4px; margin-top: auto; color: #555; flex-shrink: 0; }
    `;
    return style;
};

export const createFigurePage = (
    caption: string,
    image: string,
    imageLabel: string,
    pageNumber: number,
    reportId: string,
    tReport: ReportT
) => {
    const page = createPage();
    page.innerHTML = `
        <div class="fig-label">${imageLabel}</div>
        <div class="fig"><img src="${image}" /></div>
        <div class="fig-caption">${caption}</div>
        ${createFooter(pageNumber, reportId, tReport)}
    `;
    return page;
};

export const createCategoryPages = async (
    grouped: GroupedByType,
    leftMeta: ImageMeta,
    rightMeta: ImageMeta,
    markingTypes: MarkingType[],
    categoryTitle: string,
    startPageNumber: number,
    reportId: string,
    tReport: ReportT
): Promise<HTMLElement[]> => {
    const pages: HTMLElement[] = [];
    let pageNumber = startPageNumber;
    // eslint-disable-next-line no-restricted-syntax
    for (const { type, pairs } of grouped.values()) {
        const typeName = type.displayName ?? type.name ?? "-";
        const leftMarkings = pairs.map(p => p.left);
        const rightMarkings = pairs.map(p => p.right);
        // eslint-disable-next-line no-await-in-loop
        const [leftCanvas, rightCanvas] = await Promise.all([
            renderImageWithMarkings(
                leftMeta.bytes,
                leftMarkings,
                markingTypes,
                1.6,
                { showMarkingLabels: false, markingsAlpha: 0.75 }
            ),
            renderImageWithMarkings(
                rightMeta.bytes,
                rightMarkings,
                markingTypes,
                1.6,
                { showMarkingLabels: false, markingsAlpha: 0.75 }
            ),
        ]);
        const page = createPage();
        page.innerHTML = `
            <div class="category-title">${categoryTitle}</div>
            <div class="type-title">${tReport("Shoeprint feature type prefix")} ${typeName}</div>
            <div class="type-images-grid">
                <div class="type-image-col">
                    <div class="img-label">${tReport("Image 1")}</div>
                    <div class="fig"><img src="${leftCanvas.toDataURL("image/png")}" /></div>
                </div>
                <div class="type-image-col">
                    <div class="img-label">${tReport("Image 2")}</div>
                    <div class="fig"><img src="${rightCanvas.toDataURL("image/png")}" /></div>
                </div>
            </div>
            ${createFooter(pageNumber, reportId, tReport)}
        `;
        pages.push(page);
        pageNumber += 1;
    }
    return pages;
};

export const ensureImagesLoaded = async (container: HTMLElement) => {
    const images = Array.from(container.querySelectorAll("img"));
    await Promise.all(
        images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>(resolve => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
            });
        })
    );
};

export const groupPairedByPrefix = (
    paired: PairedFeature[],
    markingTypes: MarkingType[],
    prefix: string
): GroupedByType => {
    const result: GroupedByType = new Map();
    paired.forEach(pair => {
        const type = markingTypes.find(t => t.id === pair.left.typeId);
        if (!type) return;
        const dn = type.displayName ?? type.name ?? "";
        if (!dn.startsWith(prefix)) return;
        const existing = result.get(type.id);
        if (existing) {
            existing.pairs.push(pair);
        } else {
            result.set(type.id, { type, pairs: [pair] });
        }
    });
    return result;
};
