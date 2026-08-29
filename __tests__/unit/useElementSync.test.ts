import { syncContainedElement } from "@/components/edit-window/hooks/useElementSync";

function setContainerSize(
    container: HTMLElement,
    width: number,
    height: number
) {
    Object.defineProperties(container, {
        clientWidth: { configurable: true, value: width },
        clientHeight: { configurable: true, value: height },
    });
}

describe("syncContainedElement", () => {
    it("preserves the natural display size when upscaling is disabled", () => {
        const container = document.createElement("div");
        const element = document.createElement("img");
        setContainerSize(container, 1000, 800);

        syncContainedElement(element, container, 500, 400, {}, false, false);

        expect(element.style.width).toBe("500px");
        expect(element.style.height).toBe("400px");
    });

    it("still scales an oversized image down to fit the viewport", () => {
        const container = document.createElement("div");
        const element = document.createElement("img");
        setContainerSize(container, 500, 400);

        syncContainedElement(element, container, 1000, 800, {}, false, false);

        expect(element.style.width).toBe("500px");
        expect(element.style.height).toBe("400px");
    });
});
