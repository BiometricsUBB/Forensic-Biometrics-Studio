import { i18nDialog as Dictionary } from "@/lib/locales/translation";

const d: Dictionary = {
    "Are you sure you want to load markings data?\n\nIt will remove all existing forensic marks.":
        "Czy na pewno chcesz za\u0142adowa\u0107 dane dotycz\u0105ce adnotacji?\n\nSpowoduje to usuni\u0119cie wszystkich istniej\u0105cych adnotacji \u015blad\u00f3w.",
    "You are trying to load markings data created with a newer app version (current app version: {{appVersion}}, but you try to load: {{fileVersion}}). Please update the application.":
        "Pr\u00f3bujesz za\u0142adowa\u0107 dane adnotacji utworzone w nowszej wersji aplikacji (aktualna wersja aplikacji: {{appVersion}}, ale pr\u00f3bujesz za\u0142adowa\u0107: {{fileVersion}}). Zaktualizuj aplikacj\u0119.",
    "This markings data file was created with an older, unsupported version of the app ({{fileVersion}}, minimum supported: {{minVersion}}). Loading it might not work.\n\nDo you want to proceed?":
        "Plik danych adnotacji zosta\u0142 utworzony w starszej, nieobs\u0142ugiwanej wersji aplikacji ({{fileVersion}}, minimalna obs\u0142ugiwana: {{minVersion}}). Za\u0142adowanie mo\u017ce si\u0119 nie uda\u0107.\n\nCzy chcesz kontynuowa\u0107?",
    "Marking types were exported from a different version of the application ({{version}}). Loading it might not work.\n\nAre you sure you want to load it?":
        "Typy adnotacji zosta\u0142y wyeksportowane z innej wersji aplikacji ({{version}}). Ich za\u0142adowanie mo\u017ce nie dzia\u0142a\u0107.\n\nCzy na pewno chcesz je za\u0142adowa\u0107?",
    "The imported marking types have conflicts with the existing ones:\n{{conflicts}}\n\nDo you want to overwrite them?":
        "Importowane typy adnotacji maj\u0105 konflikty z istniej\u0105cymi:\n{{conflicts}}\n\nCzy chcesz je nadpisa\u0107?",
    "Overwrite marking types?": "Nadpisa\u0107 typy adnotacji?",
    "The imported markings data contains types that are not present in the application. Would you like to:\n1. Automatically create default types for the missing ones?\n2. Cancel and manually import the types from a file?":
        "Importowane dane dotycz\u0105ce adnotacji zawieraj\u0105 typy, kt\u00f3re nie s\u0105 obecne w aplikacji. Czy chcesz:\n1. Automatycznie utworzy\u0107 domy\u015blne typy dla brakuj\u0105cych?\n2. Anulowa\u0107 i r\u0119cznie zaimportowa\u0107 typy z pliku?",
    "Missing marking types detected": "Wykryto brakuj\u0105ce typy adnotacji",
    "The markings data was created with a different working mode ({{mode}}). Change the working mode to ({{mode}}) to load the data.":
        "Dane dotycz\u0105ce adnotacji zosta\u0142y utworzone w innym trybie pracy ({{mode}}). Zmie\u0144 tryb pracy na ({{mode}}), aby za\u0142adowa\u0107 dane.",
    "Please select your working mode": "Prosz\u0119 wybra\u0107 tryb pracy",
    "You are trying to load marking types for a non-existing working mode.":
        "Pr\u00f3bujesz za\u0142adowa\u0107 typy dla nieistniej\u0105cego trybu pracy.",
    "No marking types found in the file":
        "W pliku nie znaleziono typ\u00f3w adnotacji",
    "Marking types imported successfully":
        "Typy adnotacji zaimportowano pomy\u015blnie",
    "Marking types exported successfully":
        "Typy adnotacji wyeksportowano pomy\u015blnie",
    "Error importing marking types":
        "B\u0142\u0105d podczas importowania typ\u00f3w adnotacji",
    "Error exporting marking types":
        "B\u0142\u0105d podczas eksportowania typ\u00f3w adnotacji",
    "This action will clear the current canvas. Are you sure you want to proceed?":
        "Ta czynno\u015b\u0107 spowoduje wyczyszczenie obecnego obszaru roboczego. Czy na pewno chcesz kontynuowa\u0107?",
    "You have unsaved changes!\nOpening this file will cause the loss of unsaved annotations.\nAre you sure you want to load this image?":
        "Masz niezapisane zmiany!\nOtwarcie tego pliku spowoduje utrat\u0119 niezapisanych adnotacji.\nCzy jeste\u015b pewny, \u017ce chcesz za\u0142adowa\u0107 ten obraz?",
    "Unsaved Changes": "Niezapisane zmiany",
    "Invalid markings data file": "Nieprawid\u0142owy plik danych adnotacji",
    "Are you sure?": "Czy jeste\u015b pewny?",
    Warning: "Ostrze\u017cenie",
};

export default d;
