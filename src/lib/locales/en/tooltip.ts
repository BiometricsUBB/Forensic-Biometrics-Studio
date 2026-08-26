import { i18nTooltip as Dictionary } from "@/lib/locales/translation";

const d: Dictionary = {
    "Load markings data from file": "Load markings data from file",
    "Save markings data to a JSON file": "Save markings data to a JSON file",
    "Load forensic mark image": "Load forensic mark image",
    "Fit height": "Fit height",
    "Fit width": "Fit width",
    "Fit world": "Fit world",
    "Lock viewports": "Lock viewports together",
    "Synchronize viewports with scale": "Synchronize movement speed with scale",
    "Toggle marking labels": "Toggle marking labels",
    "Toggle viewport information": "Toggle viewport information",
    "Toggle scale mode": "Toggle scale mode",
    "Edit mode": "Edit mode",
    "Export marking types": "Export marking types",
    "Import marking types": "Import marking types",
    "Markings data saved": "Markings data saved",
    "Failed to save markings data": "Failed to save markings data",
    "Image saved successfully": "Image saved successfully",
    "Failed to save image: {{error}}": "Failed to save image: {{error}}",
    "Image saved successfully, but could not be reloaded due to path restrictions":
        "Image saved successfully, but could not be reloaded due to path restrictions",
    Save: "Save",
    "Auto rotate": "Manually rotate images using current alignment lines",
    "Rotation instructions":
        "Mark a line between two identical points on each image starting from bottom, the lower point will be the rotation anchor and the upper will be used to calculate the rotation angle",
    "Calculate and align": "Calculate and align",
    "Reset rotation panel": "Reset rotation",
    "Toggle tracing mode": "Toggle tracing mode",
    "Line mode instruction":
        "Right-click to finish the current line sequence and start a new one",
    "Save tracing data to a JSON file": "Save tracing data to a JSON file",
    "Tracing data saved": "Tracing data saved successfully",
    "Failed to save tracing data": "Failed to save tracing data",
    "Load tracing data from file": "Load tracing data from file",
    "Tracing data loaded": "Tracing data loaded successfully",
    "Failed to load tracing data": "Failed to load tracing data",
    "Measurement instructions":
        "Draw a line between two points on the image to measure the distance",
    "Clear measurement": "Clear measurement",
    Unit: "Unit",
    DPI: "DPI",
    "Area instructions":
        "Click to place points. Click the first point to close the polygon.",
    Area: "Area",
    "Clear area": "Clear area",
    Drawing: "Drawing",
    Points: "Points",
    Brightness: "Brightness",
    Contrast: "Contrast",
    "Invert colors": "Invert colors",
    Desaturate: "Desaturate",
    "Desaturate channel weights":
        "Convert to black and white using adjustable Photoshop-style color ranges.",
    Reds: "Reds",
    Yellows: "Yellows",
    Greens: "Greens",
    Cyans: "Cyans",
    Blues: "Blues",
    Magentas: "Magentas",
    "Rotate 90° left": "Rotate 90° left",
    "Rotate 90° right": "Rotate 90° right",
    "Rotate 180°": "Rotate 180°",
    "Flip horizontal": "Flip horizontal",
    "Flip vertical": "Flip vertical",
    Transformations: "Transformations",
    Crop: "Crop",
    "Start crop": "Start crop",
    "Apply crop": "Apply crop",
    "Cancel crop": "Cancel crop",
    "Draw a rectangle on the image to crop it":
        "Draw a rectangle on the image to crop it",
    "Crop area selected": "Crop area selected",
    "Failed to transform image: {{error}}":
        "Failed to transform image: {{error}}",
    "Failed to crop image: {{error}}": "Failed to crop image: {{error}}",
    "Failed to scale image: {{error}}": "Failed to scale image: {{error}}",
    "DPI scale unchanged":
        "DPI: scale {{scale}}x, size unchanged ({{width}} x {{height}} px)",
    "DPI scale applied":
        "DPI: scale {{scale}}x, {{sourceWidth}} x {{sourceHeight}} px -> {{width}} x {{height}} px",
    "Target DPI": "Target DPI",
    "Reference length (mm)": "Reference length (mm)",
    "Reference length in millimeters": "Reference length in millimeters",
    "DPI reference length hint":
        "Used when tick detection on the ruler is ambiguous.",
    Levels: "Levels",
    levels_desc: "Adjust the tonal range and color balance of the image",
    Curves: "Curves",
    curves_desc: "Adjust the tonal range and color balance using curves",
    "Black Point": "Black Point",
    "White Point": "White Point",
    "Gamma (Midtones)": "Gamma (Midtones)",
    "Curves (Click: Add, Right-click: Remove)":
        "Curves (Click: Add, Right-click: Remove)",
    "Reset Zoom": "Reset Zoom",
    ImageLoadPermissionError:
        "The edited image was saved, but cannot be loaded due to path restrictions. Please try loading it manually.",
    "Generate report": "Generate report",
    "Report generated": "Report generated",
    "Failed to generate report": "Failed to generate report",
    "Rotate left": "Rotate left (-5°)",
    "Rotate right": "Rotate right (+5°)",
    "Reset rotation": "Reset rotation to 0°",
    "Synchronize rotation": "Synchronize rotation between viewports",
    "FFT Filter": "Open FFT frequency filter editor",
    "FFT Filter applied": "FFT filter applied",
    "Paint over bright spots to filter them out":
        "Paint over bright spots to filter them out",
    "Preview ready. Return to edit or save.":
        "Preview ready. Return to edit or save.",
    "Polyline requires at least 2 segments":
        "Polyline requires at least 2 segments",
    Ruler: "Ruler",
    LeftCanvasLabel: "L",
    RightCanvasLabel: "R",
    "Save ANSI/NIST (XML)": "Save ANSI/NIST (XML)",
    "Load ANSI/NIST (XML) from file": "Load ANSI/NIST (XML) from file",
    "Save ANSI/NIST (XML) data": "Save ANSI/NIST (XML) data",
    "Load ANSI/NIST (XML) data": "Load ANSI/NIST (XML) data",
    "Load Traditional ANSI/NIST (.an2, .eft)":
        "Load Traditional ANSI/NIST (.an2, .eft)",
    brightness_desc: "Adjust the overall brightness of the image",
    contrast_desc:
        "Adjust the difference between light and dark areas of the image",
    fft_desc:
        "Apply Fast Fourier Transform to filter out periodic noise and patterns",
    Disable: "Disable",
    Enable: "Enable",
    "Edit settings": "Edit settings",
    'Click "Compute" to analyse the frequency spectrum':
        'Click "Compute" to analyse the frequency spectrum',
    "Drag to reorder": "Drag to reorder",
    "Move up": "Move up",
    "Move down": "Move down",
    "Image enhancement": "Image enhancement",
    GBFEN: "GBFEN",
    SNFEN: "SNFEN",
    gbfen_desc:
        "Classical Gabor-filter-based fingerprint enhancement. Runs locally without a neural network. Best for images with clear, regular ridge structure. Fast (~10–20 s) and deterministic.",
    snfen_desc:
        "Neural-network fingerprint enhancement (Spectral-Neural Fingerprint Enhancement Network). Slower than GBFEN but handles low-quality, noisy, or low-contrast prints better. Requires the bundled TensorFlow runtime.",
    "Enhancement: GBFEN started": "GBFEN enhancement started...",
    "Enhancement: SNFEN started": "SNFEN enhancement started...",
    "Enhancement: GBFEN done in {{seconds}}s":
        "GBFEN finished in {{seconds}} s",
    "Enhancement: SNFEN done in {{seconds}}s":
        "SNFEN finished in {{seconds}} s",
    "Enhancement: using existing output":
        "Enhancement already exists — using cached output.",
    "Enhancement failed: {{error}}": "Enhancement failed: {{error}}",
    "Enhancement DPI": "DPI",
    "Enhancement DPI hint":
        "Match the scan resolution. Re-run the enhancement after changing this value.",
    "Enhancement status": "Status",
    "Enhancement: pending": "Pending...",
    "Enhancement: processing": "Processing...",
    "Enhancement: ready": "Ready",
    "Enhancement: failed": "Failed",
    "Enhancement output path": "Output file",
    "Re-run enhancement": "Re-run",
    "Took {{seconds}} s": "Took {{seconds}} s",
    Method: "Method",
    "GBFEN — Gabor-based enhancement": "GBFEN — Gabor-based enhancement",
    "SNFEN — Neural enhancement": "SNFEN — Neural enhancement",
    "Enhancing image...": "Enhancing image...",
    "Comparison finished in {{seconds}}s":
        "Comparison finished in {{seconds}}s",
    "Comparison cancelled": "Comparison cancelled",
    "Comparison failed: {{error}}": "Comparison failed: {{error}}",
    "Load an image on both canvases first":
        "Load an image on both canvases first",
    "Shoeprint canvas not ready": "The canvas is not ready.",
    "Shoeprint load images first": "Load an image on both canvases first.",
    "Shoeprint image has no path": "The image has no source path.",
    "Shoeprint not enough edge points":
        "Only {{count}} edge points were found in image {{label}}. Adjust the binarisation threshold, or use a higher-contrast image.",
    "Shoeprint regions too large for resolution":
        "The comparison regions are too large for image {{label}}. At {{dpi}} dpi the print measures only {{length}} mm, but an outsole is normally 250-320 mm, so that resolution is too high for this image. Clear the resolution to scale by image size instead, or enter the resolution the image was actually captured at.",
    "Shoeprint regions too large for print":
        "The comparison regions are too large for image {{label}}. Reduce the region radius, currently {{radius}} units for a print spanning {{width}}x{{height}} units.",
};

export default d;
