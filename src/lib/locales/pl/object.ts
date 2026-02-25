import { i18nObject as Dictionary } from "@/lib/locales/translation";

const d: Dictionary = {
    Marking: {
        Name: "Adnotacja",
        Keys: {
            ids: "ID-y",
            label: "Znacznik",
            angleRad: "K\u0105t",
            origin: "\u0179r\u00f3d\u0142o",
            endpoint: "Koniec",
            markingClass: {
                Name: "Klasa adnotacji",
                Keys: {
                    point: "Punkt",
                    ray: "Linia skierowana",
                    line_segment: "Odcinek",
                    bounding_box: "Prostok\u0105t (legacy)",
                    rectangle: "Prostok\u0105t",
                    polygon: "Wielok\u0105t",
                },
            },
            typeId: "ID typu",
        },
        Actions: {
            merge: {
                enabled: "Po\u0142\u0105cz adnotacje",
                disabled: "Nie mo\u017cna po\u0142\u0105czy\u0107 - znaleziono pasuj\u0105ce ID",
            },
        },
    },
    MarkingType: {
        Name: "Typ adnotacji",
        Keys: {
            id: "ID",
            displayName: "Nazwa lokalna",
            name: "Nazwa",
            markingClass: "Klasa adnotacji",
            category: "Kategoria",
            backgroundColor: "Kolor t\u0142a",
            textColor: "Kolor tekstu",
            size: "Rozmiar",
        },
    },
    Theme: {
        Name: "Motyw",
        Keys: {
            system: "System",
            dark: "Ciemny",
            light: "Jasny",
            dark_gray: "Ciemny szary",
            light_blue: "Jasny niebieski",
            dark_blue: "Ciemny niebieski",
        },
    },
};

export default d;
