import { ColorSource } from "pixi.js";
import { WORKING_MODE } from "@/views/selectMode";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";

export type MarkingAttributeOption = {
    id: string;
    label: string;
};

export type MarkingSizeRange = {
    id: string;
    label: string;
    min?: number;
    max?: number;
};

export enum MARKING_ATTRIBUTE_KIND {
    CHOICE = "choice",
    SIZE = "size",
}

export type MarkingChoiceAttribute = {
    id: string;
    kind: MARKING_ATTRIBUTE_KIND.CHOICE;
    label: string;
    options: MarkingAttributeOption[];
};

export type MarkingSizeAttribute = {
    id: string;
    kind: MARKING_ATTRIBUTE_KIND.SIZE;
    label: string;
    unit?: string;
    ranges?: MarkingSizeRange[];
};

export type MarkingAttribute = MarkingChoiceAttribute | MarkingSizeAttribute;

export interface MarkingType {
    id: string;
    name: string;
    displayName: string;
    markingClass: MARKING_CLASS;
    backgroundColor: ColorSource;
    textColor: ColorSource;
    size: number;
    category: WORKING_MODE;
    attributes?: MarkingAttribute[];
}

export const defaultBackgroundColor = "#61BD67";
export const defaultTextColor = "#0a130a";
export const defaultSize = 10;
