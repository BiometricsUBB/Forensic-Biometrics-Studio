import type { TFunction } from "i18next";
import { MarkingType } from "@/lib/markings/MarkingType";
import type { ImageMeta, PairedFeature } from "../shared/types";
import { renderImageWithMarkings } from "../shared/render-utils";
import { createPage, createFooter } from "../shared/page-builders";

export {
    toCssColor,
    escapeHtml,
    resolveFeatureTypeName,
    createFooter,
    createPage,
    createReportRoot,
    createStyles,
    createFigurePage,
    ensureImagesLoaded,
} from "../shared/page-builders";

type ReportT = TFunction<"report">;
export type GroupedByType = Map<
    string,
    { type: MarkingType; pairs: PairedFeature[] }
>;

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
    for (const { type, pairs } of grouped.values()) {
        const typeName = type.displayName ?? type.name ?? "-";
        const leftMarkings = pairs.map(p => p.left);
        const rightMarkings = pairs.map(p => p.right);
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
