import { ColorSource } from "pixi.js";
import { WORKING_MODE } from "@/views/selectMode";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";

export interface MarkingType {
    id: string;
    displayName: string;
    markingClass: MARKING_CLASS;
    backgroundColor: ColorSource;
    textColor: ColorSource;
    size: number;
    category: WORKING_MODE;
}

export const defaultBackgroundColor = "#61BD67";
export const defaultTextColor = "#0a130a";
export const defaultSize = 10;
