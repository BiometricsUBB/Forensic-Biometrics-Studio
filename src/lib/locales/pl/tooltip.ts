import { i18nTooltip as Dictionary } from "@/lib/locales/translation";

const d: Dictionary = {
    "Load markings data from file": "Załaduj dane adnotacji z pliku",
    "Save markings data to a JSON file": "Zapisz dane adnotacji do pliku JSON",
    "Load forensic mark image": "Załaduj obraz śladu kryminalistycznego",
    "Fit height": "Dopasuj wysokość",
    "Fit width": "Dopasuj szerokość",
    "Fit world": "Dopasuj przekątną",
    "Lock viewports": "Zablokuj widoki ze sobą",
    "Synchronize viewports with scale": "Synchronizuj prędkość ruchu ze skalą",
    "Toggle marking labels": "Przełącz szczegóły adnotacji",
    "Toggle viewport information": "Przełącz informacje viewportu",
    "Toggle scale mode": "Przełącz tryb skalowania",
    "Edit mode": "Tryb edycji",
    "Export marking types": "Eksportuj typy adnotacji",
    "Import marking types": "Importuj typy adnotacji",
    "Markings data saved": "Dane adnotacji zapisano pomyślnie",
    "Failed to save markings data": "Nie udało się zapisać danych adnotacji",
    "Image saved successfully": "Obraz zapisany pomyślnie",
    "Failed to save image: {{error}}":
        "Nie udało się zapisać obrazu: {{error}}",
    "Image saved successfully, but could not be reloaded due to path restrictions":
        "Obraz zapisany pomyślnie, ale nie można go przeładować z powodu ograniczeń ścieżki",
    Save: "Zapisz",
    "Auto rotate":
        "automatycznie obróć obrazy używając aktualnych linii wyrównania",
    "Rotation instructions":
        "Oznacz linią dwa te same punkty na każdym obrazie rozpoczynając od dołu, dolny punkt będzie kotwicą obrotu a górny posłuży wyliczeniu kąta obrotu",
    "Calculate and align": "Oblicz i dopasuj",
    "Reset rotation panel": "Zresetuj rotację",
    "Toggle tracing mode": "Włącz/wyłącz tryb rysowania",
    "Line mode instruction":
        "Prawy przycisk myszy kończy linię i pozwala zacząć kolejną",
    "Save tracing data to a JSON file": "Zapisz dane rysowania do pliku JSON",
    "Tracing data saved": "Dane rysowania zapisano pomyślnie",
    "Failed to save tracing data": "Nie udało się zapisać danych rysowania",
    "Load tracing data from file": "Wczytaj dane rysowania z pliku",
    "Tracing data loaded": "Dane rysowania wczytano pomyślnie",
    "Failed to load tracing data": "Nie udało się wczytać danych rysowania",
    "Measurement instructions":
        "Narysuj linię pomiędzy dwoma punktami na obrazie, aby zmierzyć odległość",
    "Clear measurement": "Wyczyść miarkę",
    Brightness: "Jasność",
    Contrast: "Kontrast",
    Levels: "Poziomy",
    levels_desc: "Dostosuj zakres tonalny i balans kolorów obrazu",
    Curves: "Krzywe",
    curves_desc: "Dostosuj zakres tonalny i balans kolorów za pomocą krzywych",
    "Black Point": "Punkt czerni",
    "White Point": "Punkt bieli",
    "Gamma (Midtones)": "Gamma (Półcienie)",
    "Curves (Click: Add, Right-click: Remove)": "Krzywe (Kliknij: Dodaj, Prawy przycisk: Usuń)",
    "Reset Zoom": "Resetuj powiększenie",
    ImageLoadPermissionError:
        "Edytowany obraz został zapisany, ale nie można go załadować z powodu ograniczeń dostępności ścieżki. Spróbuj załadować go ręcznie.",
    "Generate report": "Generuj raport",
    "Report generated": "Raport wygenerowany",
    "Failed to generate report": "Nie udało się wygenerować raportu",
    "Rotate left": "Obróć w lewo (-5°)",
    "Rotate right": "Obróć w prawo (+5°)",
    "Reset rotation": "Zresetuj rotację do 0°",
    "Synchronize rotation": "Synchronizuj rotację między widokami",
    "FFT Filter": "Filtr FFT",
    "Paint over bright spots to filter them out":
        "Zamaluj jasne punkty, aby je odfiltrować",
    "Preview ready. Return to edit or save.":
        "Podgląd gotowy. Wróć do edycji lub zapisz.",
    "Polyline requires at least 2 segments":
        "Linia łamana wymaga co najmniej 2 segmentów",
    brightness_desc: "Dostosuj ogólną jasność obrazu",
    contrast_desc:
        "Dostosuj różnicę między jasnymi i ciemnymi obszarami obrazu",
    fft_desc:
        "Zastosuj szybką transformatę Fouriera (FFT), aby odfiltrować szum okresowy i wzorce",
    Disable: "Wyłącz",
    Enable: "Włącz",
    "Edit settings": "Edytuj ustawienia",
    'Click "Compute" to analyse the frequency spectrum':
        "Kliknij „Oblicz”, aby przeanalizować widmo częstotliwości",
    "Drag to reorder": "Przeciągnij, aby zmienić kolejność",
    "Move up": "Przesuń w górę",
    "Move down": "Przesuń w dół",
    "Image enhancement": "Wzmocnienie obrazu",
    GBFEN: "GBFEN",
    SNFEN: "SNFEN",
    gbfen_desc:
        "Klasyczne wzmocnienie linii papilarnych filtrami Gabora. Działa lokalnie, bez sieci neuronowej. Najlepsze dla obrazów o wyraźnej, regularnej teksturze grzbietów. Szybkie (~10–20 s) i deterministyczne.",
    snfen_desc:
        "Wzmocnienie linii papilarnych siecią neuronową (Spectral-Neural Fingerprint Enhancement Network). Działa wolniej niż GBFEN, ale lepiej radzi sobie z obrazami niskiej jakości, zaszumionymi lub o słabym kontraście grzbietów. Wymaga modułu TensorFlow dołączonego do aplikacji.",
    "Enhancement: GBFEN started": "Wzmacnianie GBFEN rozpoczęte...",
    "Enhancement: SNFEN started": "Wzmacnianie SNFEN rozpoczęte...",
    "Enhancement: GBFEN done in {{seconds}}s":
        "GBFEN ukończone w {{seconds}} s",
    "Enhancement: SNFEN done in {{seconds}}s":
        "SNFEN ukończone w {{seconds}} s",
    "Enhancement: using existing output":
        "Wzmocnienie już istnieje — używam zapisanego wyniku.",
    "Enhancement failed: {{error}}": "Wzmocnienie nie powiodło się: {{error}}",
    "Enhancement DPI": "Rozdzielczość (DPI)",
    "Enhancement DPI hint":
        "Ustaw zgodnie z rozdzielczością skanu. Po zmianie wartości uruchom wzmocnienie ponownie.",
    "Enhancement status": "Status",
    "Enhancement: pending": "Oczekiwanie...",
    "Enhancement: processing": "Przetwarzanie...",
    "Enhancement: ready": "Gotowe",
    "Enhancement: failed": "Błąd",
    "Enhancement output path": "Plik wyjściowy",
    "Re-run enhancement": "Uruchom ponownie",
    "Took {{seconds}} s": "Zajęło {{seconds}} s",
    Method: "Metoda",
    "GBFEN — Gabor-based enhancement": "GBFEN — wzmocnienie filtrami Gabora",
    "SNFEN — Neural enhancement": "SNFEN — wzmocnienie siecią neuronową",
    "Enhancing image...": "Wzmacnianie obrazu...",
};

export default d;
