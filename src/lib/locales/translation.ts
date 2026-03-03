import { RayMarking } from "@/lib/markings/RayMarking";
import { PointMarking } from "@/lib/markings/PointMarking";
import { LineSegmentMarking } from "@/lib/markings/LineSegmentMarking";
import { MarkingType } from "@/lib/markings/MarkingType";
import { WORKING_MODE } from "@/views/selectMode";
import { BoundingBoxMarking } from "@/lib/markings/BoundingBoxMarking";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { THEMES } from "../stores/GlobalSettings";

type Recordify<T> = { [K in Extract<T, string> as `${K}`]: string };

export type i18nKeywords = Recordify<
    | "Working mode"
    | "Control"
    | "Settings"
    | "Language"
    | "Markings"
    | "Debug"
    | "Theme"
    | "Types"
    | "Remove"
    | "Add"
    | "Tools"
    | "Edit Image"
    | "Adjustments"
    | "About"
    | "Version"
    | "Description"
    | "Authors"
    | "Repository"
    | "Custom Themes"
    | "Edit Theme"
    | "Theme Name"
    | "Theme name"
    | "Colors"
    | "Save"
    | "Light"
    | "Dark"
    | "Default Theme"
    | "Export"
    | "Import"
    | "Themes exported successfully"
    | "Failed to export themes"
    | "Themes imported successfully"
    | "Invalid themes file"
    | "Failed to import themes"
    | "Filters"
    | "FeatureVisibility"
    | "Report"
    | "Report settings"
    | "Report ID"
    | "Report date and time"
    | "Performed by"
    | "Department"
    | "Address line 1"
    | "Address line 2"
    | "Address line 3"
    | "Address line 4"
    | "Use current date and time"
    | "Generate report"
    | "Report generation"
    | "Max features"
    | "Include matched only"
    | "Matched features"
    | "Selected features"
    | "Cancel"
    | "Generating..."
>;

export type i18nDescription = Recordify<
    | "Select your preferred language"
    | "Select your preferred theme"
    | "Application information"
    | "Application for forensic trace comparison"
    | "Open settings"
    | "Create and manage custom color themes"
    | "Configure report metadata"
    | "Configure default report data"
    | "Generate PDF report"
>;

export type i18nModes = Recordify<WORKING_MODE>;

export type i18nCursor = {
    Mode: Recordify<"Selection" | "Marking" | "Rotation" | "Measurement">;
};

export type i18nObject = {
    Marking: {
        Name: string;
        Keys: Omit<
            Recordify<
                | keyof RayMarking
                | keyof PointMarking
                | keyof LineSegmentMarking
                | keyof BoundingBoxMarking
            >,
            | "markingClass"
            | "calculateOriginViewportPosition"
            | "calculateEndpointViewportPosition"
        > & {
            markingClass: {
                Name: string;
                Keys: Recordify<MARKING_CLASS>;
            };
        };
        Actions: {
            merge: {
                enabled: string;
                disabled: string;
            };
        };
    };
    MarkingType: {
        Name: string;
        Keys: Recordify<keyof MarkingType>;
    };
    Theme: {
        Name: string;
        Keys: Recordify<THEMES>;
    };
    Calibration: {
        Unit: string;
        Scale: string;
    };
};

export type i18nTooltip = Recordify<
    | "Lock viewports"
    | "Synchronize viewports with scale"
    | "Save markings data to a JSON file"
    | "Load markings data from file"
    | "Load forensic mark image"
    | "Fit world"
    | "Fit height"
    | "Fit width"
    | "Toggle scale mode"
    | "Toggle marking labels"
    | "Toggle viewport information"
    | "Edit mode"
    | "Export marking types"
    | "Import marking types"
    | "Markings data saved"
    | "Failed to save markings data"
    | "Image saved successfully"
    | "Failed to save image: {{error}}"
    | "Image saved successfully, but could not be reloaded due to path restrictions"
    | "Save"
    | "Auto rotate"
    | "Rotation instructions"
    | "Calculate and align"
    | "Reset rotation panel"
    | "Measurement instructions"
    | "Clear measurement"
    | "Brightness"
    | "Contrast"
    | "Reset Zoom"
    | "ImageLoadPermissionError"
    | "Generate report"
    | "Report generated"
    | "Failed to generate report"
    | "Rotate left"
    | "Rotate right"
    | "Reset rotation"
    | "Synchronize rotation"
>;

export type i18nDialog = Recordify<
    | "Are you sure you want to load markings data?\n\nIt will remove all existing forensic marks."
    | "You are trying to load markings data created with a newer app version (current app version: {{appVersion}}, but you try to load: {{fileVersion}}). Please update the application."
    | "This markings data file was created with an older, unsupported version of the app ({{fileVersion}}, minimum supported: {{minVersion}}). Loading it might not work.\n\nDo you want to proceed?"
    | "Marking types were exported from a different version of the application ({{version}}). Loading it might not work.\n\nAre you sure you want to load it?"
    | "The imported marking types have conflicts with the existing ones:\n{{conflicts}}\n\nDo you want to overwrite them?"
    | "Overwrite marking types?"
    | "The imported markings data contains types that are not present in the application. Would you like to:\n1. Automatically create default types for the missing ones?\n2. Cancel and manually import the types from a file?"
    | "Missing marking types detected"
    | "The markings data was created with a different working mode ({{mode}}). Change the working mode to ({{mode}}) to load the data."
    | "Please select your working mode"
    | "You are trying to load marking types for a non-existing working mode."
    | "No marking types found in the file"
    | "Marking types imported successfully"
    | "Marking types exported successfully"
    | "Error importing marking types"
    | "Error exporting marking types"
    | "This action will clear the current canvas. Are you sure you want to proceed?"
    | "You have unsaved changes!\nOpening this file will cause the loss of unsaved annotations.\nAre you sure you want to load this image?"
    | "Unsaved Changes"
    | "Invalid markings data file"
    | "Are you sure?"
    | "Warning"
>;

export type i18nKeybindings = Recordify<
    | "Keybinding"
    | "None"
    | "Press a key"
    | "Press a numeric key (0-9)"
    | "Press 'Del' to remove keybinding"
    | "'{{key}}' is not a  numeric key"
>;

export type i18nReport = Recordify<
    | "Technical report title"
    | "Report ID label"
    | "Report date and time label"
    | "Performed by label"
    | "Software information"
    | "Application name"
    | "Application version"
    | "Input material"
    | "Image 1"
    | "Image 2"
    | "File name"
    | "Image dimensions"
    | "Dimensions"
    | "Size"
    | "Checksum"
    | "Matched features count"
    | "Selected features count"
    | "Figure 1"
    | "Figure 2"
    | "Figure 3"
    | "Figure 4"
    | "Image 1 label"
    | "Image 2 label"
    | "Comparative table overview"
    | "Comparative table zoom"
    | "Comparative table details"
    | "Feature"
    | "Feature type"
    | "Page"
    | "Note title"
    | "Note body"
>;
