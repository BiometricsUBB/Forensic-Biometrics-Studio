import { i18nDialog as Dictionary } from "@/lib/locales/translation";

const d: Dictionary = {
    "Are you sure you want to load markings data?\n\nIt will remove all existing forensic marks.":
        "Are you sure you want to load markings data?\n\nIt will remove all existing forensic marks.",
    "You are trying to load markings data created with a newer app version (current app version: {{appVersion}}, but you try to load: {{fileVersion}}). Please update the application.":
        "You are trying to load markings data created with a newer app version (current app version: {{appVersion}}, but you try to load: {{fileVersion}}). Please update the application.",
    "This markings data file was created with an older, unsupported version of the app ({{fileVersion}}, minimum supported: {{minVersion}}). Loading it might not work.\n\nDo you want to proceed?":
        "This markings data file was created with an older, unsupported version of the app ({{fileVersion}}, minimum supported: {{minVersion}}). Loading it might not work.\n\nDo you want to proceed?",
    "Marking types were exported from a different version of the application ({{version}}). Loading it might not work.\n\nAre you sure you want to load it?":
        "Marking types were exported from a different version of the application ({{version}}). Loading it might not work.\n\nAre you sure you want to load it?",
    "The imported marking types have conflicts with the existing ones:\n{{conflicts}}\n\nDo you want to overwrite them?":
        "The imported marking types have conflicts with the existing ones:\n{{conflicts}}\n\nDo you want to overwrite them?",
    "Overwrite marking types?": "Overwrite marking types?",
    "The imported markings data contains types that are not present in the application. Would you like to:\n1. Automatically create default types for the missing ones?\n2. Cancel and manually import the types from a file?":
        "The imported markings data contains types that are not present in the application. Would you like to:\n1. Automatically create default types for the missing ones?\n2. Cancel and manually import the types from a file?",
    "Missing marking types detected": "Missing marking types detected",
    "The markings data was created with a different working mode ({{mode}}). Change the working mode to ({{mode}}) to load the data.":
        "The markings data was created with a different working mode ({{mode}}). Change the working mode to ({{mode}}) to load the data.",
    "Please select your working mode": "Please select your working mode",
    "You are trying to load marking types for a non-existing working mode.":
        "You are trying to load marking types for a non-existing working mode.",
    "No marking types found in the file": "No marking types found in the file",
    "Marking types imported successfully":
        "Marking types imported successfully",
    "Marking types exported successfully":
        "Marking types exported successfully",
    "Error importing marking types": "Error importing marking types",
    "Error exporting marking types": "Error exporting marking types",
    "This action will clear the current canvas. Are you sure you want to proceed?":
        "This action will clear the current canvas. Are you sure you want to proceed?",
    "You have unsaved changes!\nOpening this file will cause the loss of unsaved annotations.\nAre you sure you want to load this image?":
        "You have unsaved changes!\nOpening this file will cause the loss of unsaved annotations.\nAre you sure you want to load this image?",
    "Unsaved Changes": "Unsaved Changes",
    "Invalid markings data file": "Invalid markings data file",
    "Are you sure?": "Are you sure?",
    Warning: "Warning",
    "Invalid tracing data file": "Invalid tracing data file",
    "Are you sure you want to load tracing data?\n\nIt will replace current drawing.":
        "Are you sure you want to load tracing data?\n\nIt will replace current drawing.",
};

export default d;
