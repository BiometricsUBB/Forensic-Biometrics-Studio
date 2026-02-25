import { i18nObject as Dictionary } from "@/lib/locales/translation";

const d: Dictionary = {
    Marking: {
        Name: "Marking",
        Keys: {
            ids: "IDs",
            label: "Label",
            angleRad: "Angle",
            origin: "Origin",
            endpoint: "Endpoint",
            markingClass: {
                Name: "Marking class",
                Keys: {
                    point: "Point",
                    ray: "Ray",
                    line_segment: "Line segment",
                    bounding_box: "Bounding box (legacy)",
                    rectangle: "Rectangle",
                    polygon: "Polygon",
                },
            },
            typeId: "Type ID",
        },
        Actions: {
            merge: {
                enabled: "Merge markings",
                disabled: "Cannot merge - matching IDs found",
            },
        },
    },
    MarkingType: {
        Name: "Marking type",
        Keys: {
            id: "ID",
            displayName: "Local name",
            name: "Type",
            markingClass: "Marking class",
            category: "Category",
            backgroundColor: "Background color",
            textColor: "Text color",
            size: "Size",
        },
    },
    Theme: {
        Name: "Theme",
        Keys: {
            system: "System",
            dark: "Dark",
            light: "Light",
            dark_gray: "Dark gray",
            light_blue: "Light blue",
            dark_blue: "Dark blue",
        },
    },
};

export default d;
