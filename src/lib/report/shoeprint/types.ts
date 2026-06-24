export * from "../shared/types";

export type ShoeprintReportGenerationOptions = {
    reportDateTime: string;
    reportLanguage?: string;
    performedBy: string;
    department: string;
    addressLines: string[];
    uniqueColor?: "red" | "green";
    reportTitle?: string;
};

export const UNIQUE_ROWS_PER_PAGE = 2;
export const PREFIX_PATTERN = "P:";
export const PREFIX_GROUP = "G:";
export const PREFIX_UNIQUE = "U:";
export const OVERVIEW_CHUNK_SIZE = 32;
