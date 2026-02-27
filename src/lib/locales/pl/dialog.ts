import { i18nDialog as Dictionary } from "@/lib/locales/translation";

const d: Dictionary = {
    "Are you sure you want to load markings data?\n\nIt will remove all existing forensic marks.":
        "Czy na pewno chcesz załadować dane dotyczące adnotacji?\n\nSpowoduje to usunięcie wszystkich istniejących adnotacji śladów.",
    "You are trying to load markings data created with a newer app version (current app version: {{appVersion}}, but you try to load: {{fileVersion}}). Please update the application.":
        "Próbujesz załadować dane adnotacji utworzone w nowszej wersji aplikacji (aktualna wersja aplikacji: {{appVersion}}, ale próbujesz załadować: {{fileVersion}}). Zaktualizuj aplikację.",
    "This markings data file was created with an older, unsupported version of the app ({{fileVersion}}, minimum supported: {{minVersion}}). Loading it might not work.\n\nDo you want to proceed?":
        "Plik danych adnotacji został utworzony w starszej, nieobsługiwanej wersji aplikacji ({{fileVersion}}, minimalna obsługiwana: {{minVersion}}). Załadowanie może się nie udać.\n\nCzy chcesz kontynuować?",
    "Marking types were exported from a different version of the application ({{version}}). Loading it might not work.\n\nAre you sure you want to load it?":
        "Typy adnotacji zostały wyeksportowane z innej wersji aplikacji ({{version}}). Ich załadowanie może nie działać.\n\nCzy na pewno chcesz je załadować?",
    "The imported marking types have conflicts with the existing ones:\n{{conflicts}}\n\nDo you want to overwrite them?":
        "Importowane typy adnotacji mają konflikty z istniejącymi:\n{{conflicts}}\n\nCzy chcesz je nadpisać?",
    "Overwrite marking types?": "Nadpisać typy adnotacji?",
    "The imported markings data contains types that are not present in the application. Would you like to:\n1. Automatically create default types for the missing ones?\n2. Cancel and manually import the types from a file?":
        "Importowane dane dotyczące adnotacji zawierają typy, które nie są obecne w aplikacji. Czy chcesz:\n1. Automatycznie utworzyć domyślne typy dla brakujących?\n2. Anulować i ręcznie zaimportować typy z pliku?",
    "Missing marking types detected": "Wykryto brakujące typy adnotacji",
    "The markings data was created with a different working mode ({{mode}}). Change the working mode to ({{mode}}) to load the data.":
        "Dane dotyczące adnotacji zostały utworzone w innym trybie pracy ({{mode}}). Zmień tryb pracy na ({{mode}}), aby załadować dane.",
    "Please select your working mode": "Proszę wybrać tryb pracy",
    "You are trying to load marking types for a non-existing working mode.":
        "Próbujesz załadować typy dla nieistniejącego trybu pracy.",
    "No marking types found in the file":
        "W pliku nie znaleziono typów adnotacji",
    "Marking types imported successfully":
        "Typy adnotacji zaimportowano pomyślnie",
    "Marking types exported successfully":
        "Typy adnotacji wyeksportowano pomyślnie",
    "Error importing marking types":
        "Błąd podczas importowania typów adnotacji",
    "Error exporting marking types":
        "Błąd podczas eksportowania typów adnotacji",
    "This action will clear the current canvas. Are you sure you want to proceed?":
        "Ta czynność spowoduje wyczyszczenie obecnego obszaru roboczego. Czy na pewno chcesz kontynuować?",
    "You have unsaved changes!\nOpening this file will cause the loss of unsaved annotations.\nAre you sure you want to load this image?":
        "Masz niezapisane zmiany!\nOtwarcie tego pliku spowoduje utratę niezapisanych adnotacji.\nCzy jesteś pewny, że chcesz załadować ten obraz?",
    "Unsaved Changes": "Niezapisane zmiany",
    "Invalid markings data file": "Nieprawidłowy plik danych adnotacji",
    "Are you sure?": "Czy jesteś pewny?",
    Warning: "Ostrzeżenie",
    "Invalid tracing data file": "Nieprawidłowy plik danych rysowania",
    "Are you sure you want to load tracing data?\n\nIt will replace current drawing.":
        "Czy na pewno chcesz wczytać dane rysowania?\n\nZastąpi one obecny rysunek.",
};

export default d;
