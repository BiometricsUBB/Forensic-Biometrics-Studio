import { describe, it, expect } from "bun:test";
import { syncContainedElement } from "@/components/edit-window/hooks/useElementSync";

function makeContainer(width: number, height: number) {
    return {
        clientWidth: width,
        clientHeight: height,
    } as unknown as HTMLElement;
}

function makeElement() {
    return { style: {} } as unknown as HTMLElement;
}

describe("syncContainedElement", () => {
    it("preserves the natural display size when upscaling is disabled", () => {
        const element = makeElement();

        syncContainedElement(
            element,
            makeContainer(1000, 800),
            500,
            400,
            {},
            false,
            false
        );

        expect(element.style.width).toBe("500px");
        expect(element.style.height).toBe("400px");
    });

    it("still scales an oversized image down to fit the viewport", () => {
        const element = makeElement();

        syncContainedElement(
            element,
            makeContainer(500, 400),
            1000,
            800,
            {},
            false,
            false
        );

        expect(element.style.width).toBe("500px");
        expect(element.style.height).toBe("400px");
    });
});
