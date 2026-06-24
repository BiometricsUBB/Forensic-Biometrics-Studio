# PyInstaller spec for pyfing_enhance sidecar
# Build: pyinstaller scripts/pyfing_enhance.spec
#
# Notes:
#   - keras + tensorflow-cpu MUST stay bundled because SNFEN is a hard requirement
#     (uses pyfing's neural pipeline: SUFS + SNFOE + SNFFE + SNFEN).
#   - pyfing/models/*.weights.h5 must be collected as data files; they are loaded
#     at runtime via importlib.resources from the pyfing package directory.
#   - torch / jax / matplotlib / Qt are excluded — pyfing doesn't need them.
# pylint: disable=undefined-variable

import os
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

EXCLUDED_MODULES = [
    "torch",
    "torchvision",
    "torchaudio",
    "jax",
    "jaxlib",
    "tkinter",
    "matplotlib",
    "PIL",
    "PyQt5",
    "PyQt6",
    "PySide2",
    "PySide6",
    "pytest",
    "IPython",
    "jupyter",
    "notebook",
    "pandas",
    "sklearn",
    "tensorboard",
]

# Collect all bundled neural-network weight files shipped inside pyfing.
pyfing_datas = collect_data_files("pyfing", includes=["models/*"])

# Make sure all pyfing submodules end up in the bundle (it's a small package).
pyfing_hidden = collect_submodules("pyfing")

a = Analysis(
    ['pyfing_enhance.py'],
    pathex=[],
    binaries=[],
    datas=pyfing_datas,
    hiddenimports=[
        'cv2',
        'numpy',
        'keras',
        'tensorflow',
        'tensorflow_intel',
    ] + pyfing_hidden,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=EXCLUDED_MODULES,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='pyfing_enhance',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
