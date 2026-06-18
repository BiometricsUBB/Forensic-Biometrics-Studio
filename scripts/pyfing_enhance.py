"""pyfing_enhance - CLI wrapper for pyfing fingerprint enhancement.

Usage:
    pyfing_enhance --input <path> --output <path> --method GBFEN|SNFEN [--dpi 500]
    pyfing_enhance --check
    pyfing_enhance --version

Method pipelines:
    GBFEN  -> GMFS  + GBFOE + XSFFE + GBFEN   (classical, Gabor)
    SNFEN  -> SUFS  + SNFOE + SNFFE + SNFEN   (neural, requires TensorFlow + bundled weights)

Exit codes:
    0  success
    1  input error (missing/unreadable image)
    2  dependency missing (pyfing/cv2 not importable)
    3  processing error (pyfing pipeline raised)
    4  output write error
    5  method not available in this build (e.g. SNFEN without tensorflow)
"""

import os
import sys
import argparse
from pathlib import Path

# Hush TensorFlow CPU/oneDNN advisory output and pre-pick a backend.
# If TF is bundled we use it (so SNFEN works); else fall back to a numpy backend
# that's good enough for the GBFEN pipeline.
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
try:
    import tensorflow  # noqa: F401  pylint: disable=unused-import
    os.environ.setdefault("KERAS_BACKEND", "tensorflow")
    _TF_AVAILABLE = True
except Exception:  # noqa: BLE001
    os.environ.setdefault("KERAS_BACKEND", "numpy")
    _TF_AVAILABLE = False

VERSION = "0.1.0"

CLASSIC_PIPELINE = {
    "segmentation": "GMFS",
    "orientation": "GBFOE",
    "frequency": "XSFFE",
    "enhancement": "GBFEN",
}

NEURAL_PIPELINE = {
    "segmentation": "SUFS",
    "orientation": "SNFOE",
    "frequency": "SNFFE",
    "enhancement": "SNFEN",
}


def _emit(stage: str) -> None:
    print(f"STAGE: {stage}", file=sys.stderr, flush=True)


def _check_core_deps() -> int:
    try:
        import cv2  # noqa: F401
        import pyfing  # noqa: F401
    except ImportError as exc:
        print(
            f"ERROR: missing core dependency: {exc}. Install: pip install pyfing opencv-python-headless",
            file=sys.stderr,
        )
        return 2
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fingerprint enhancement using pyfing"
    )
    parser.add_argument("--input", help="Input grayscale fingerprint image path")
    parser.add_argument("--output", help="Output enhanced image path")
    parser.add_argument(
        "--method",
        choices=["GBFEN", "SNFEN"],
        default="GBFEN",
        help="Enhancement method",
    )
    parser.add_argument("--dpi", type=int, default=500, help="Image DPI (default: 500)")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify dependencies and exit (0=ok, 2=missing)",
    )
    parser.add_argument(
        "--version",
        action="store_true",
        help="Print version and exit",
    )
    args = parser.parse_args()

    if args.version:
        print(VERSION)
        return 0

    if args.check:
        status = _check_core_deps()
        if status != 0:
            return status
        print(
            f"INFO: tensorflow_available={_TF_AVAILABLE} keras_backend={os.environ.get('KERAS_BACKEND')}",
            file=sys.stderr,
        )
        return 0

    if not args.input or not args.output:
        print("ERROR: --input and --output required", file=sys.stderr)
        return 1

    _emit("ready")

    dep_status = _check_core_deps()
    if dep_status != 0:
        return dep_status

    if args.method == "SNFEN" and not _TF_AVAILABLE:
        print(
            "ERROR: SNFEN requires tensorflow which is not available in this build. Use GBFEN.",
            file=sys.stderr,
        )
        return 5

    pipeline = NEURAL_PIPELINE if args.method == "SNFEN" else CLASSIC_PIPELINE

    import cv2 as cv
    import pyfing as pf

    fp = cv.imread(args.input, cv.IMREAD_GRAYSCALE)
    if fp is None:
        print(f"ERROR: cannot read image: {args.input}", file=sys.stderr)
        return 1

    print(
        f"INFO: input={args.input} shape={fp.shape[1]}x{fp.shape[0]} method={args.method} dpi={args.dpi} pipeline={pipeline}",
        file=sys.stderr,
        flush=True,
    )

    try:
        _emit("segmentation")
        mask = pf.fingerprint_segmentation(
            fp, dpi=args.dpi, method=pipeline["segmentation"]
        )

        _emit("orientation")
        orientations = pf.orientation_field_estimation(
            fp, mask, dpi=args.dpi, method=pipeline["orientation"]
        )

        _emit("frequency")
        frequencies = pf.frequency_estimation(
            fp, orientations, mask, dpi=args.dpi, method=pipeline["frequency"]
        )

        _emit("enhancement")
        enhanced = pf.fingerprint_enhancement(
            fp, orientations, frequencies, mask,
            dpi=args.dpi, method=pipeline["enhancement"]
        )
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: pyfing pipeline failed: {exc}", file=sys.stderr)
        return 3

    _emit("writing")
    out_path = Path(args.output).with_suffix(".png")
    tmp_path = out_path.with_suffix(".tmp.png")
    success = cv.imwrite(str(tmp_path), enhanced)
    if not success:
        print(f"ERROR: failed to write output: {tmp_path}", file=sys.stderr)
        return 4
    tmp_path.replace(out_path)

    print(f"DONE: {out_path}", file=sys.stderr, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
