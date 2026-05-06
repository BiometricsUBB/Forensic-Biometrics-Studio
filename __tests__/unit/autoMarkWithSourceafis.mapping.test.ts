import { describe, it, expect, beforeEach, mock } from "bun:test";

const mockMarkingTypesState = {
    types: [] as Array<{ id: string; name: string; displayName: string }>,
};

const RIDGE_ID = "e6cbde52-5a18-4236-8287-7a1daf941ba9";
const BIFURCATION_ID = "f47c4b97-2d62-4959-aa21-edebfa7a756a";
const RIDGE_NAME = "ridgeending";
const BIFURCATION_NAME = "bifurcation";

mock.module("@tauri-apps/api/path", () => ({
    join: mock(),
    tempDir: mock(),
}));

mock.module(
    "@/lib/external-tools/sourceafis/createSourceAfisExternalTool",
    () => ({
        createSourceAfisExternalTool: mock(),
        SOURCE_AFIS_TIMEOUT_MS: 30_000,
    })
);

mock.module("@/lib/stores/MarkingTypes/MarkingTypes", () => ({
    MarkingTypesStore: {
        state: mockMarkingTypesState,
    },
}));

const { resolveSourceafisTypeId } = await import(
    "@/lib/utils/viewport/autoMarkWithSourceafis"
);

beforeEach(() => {
    mockMarkingTypesState.types = [];
});

describe("resolveSourceafisTypeId", () => {
    it("maps ending to ridgeending type", () => {
        mockMarkingTypesState.types = [
            {
                id: BIFURCATION_ID,
                name: BIFURCATION_NAME,
                displayName: BIFURCATION_NAME,
            },
            {
                id: RIDGE_ID,
                name: RIDGE_NAME,
                displayName: RIDGE_NAME,
            },
        ];

        expect(resolveSourceafisTypeId("ending")).toBe(RIDGE_ID);
    });

    it("maps bifurcation to bifurcation type", () => {
        mockMarkingTypesState.types = [
            {
                id: RIDGE_ID,
                name: RIDGE_NAME,
                displayName: RIDGE_NAME,
            },
            {
                id: BIFURCATION_ID,
                name: BIFURCATION_NAME,
                displayName: BIFURCATION_NAME,
            },
        ];

        expect(resolveSourceafisTypeId("bifurcation")).toBe(BIFURCATION_ID);
    });

    it("falls back to ridgeending for unknown kind", () => {
        mockMarkingTypesState.types = [
            {
                id: "ridge-id-by-name",
                name: "ridge ending",
                displayName: "ridge ending",
            },
            {
                id: "bif-id-by-name",
                name: "bifurcation",
                displayName: "bifurcation",
            },
        ];

        expect(resolveSourceafisTypeId("unknown-kind")).toBe(
            "ridge-id-by-name"
        );
    });
});
