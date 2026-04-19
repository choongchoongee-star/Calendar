"""
iPhone screenshot resizer for App Store Connect 6.9"/6.7" slot.

Input:  screenshots-raw/*.png|*.jpg|*.heic  (any iPhone portrait resolution)
Output: screenshots-appstore/*.png           (exactly 1290x2796, Lanczos upscaled)

Usage:  python resize_screenshots.py
"""

import sys
from pathlib import Path
from PIL import Image

TARGET_W, TARGET_H = 1290, 2796
ROOT = Path(__file__).parent
SRC = ROOT / "screenshots-raw"
DST = ROOT / "screenshots-appstore"

def process(path: Path) -> None:
    img = Image.open(path)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    w, h = img.size
    print(f"[{path.name}] {w}x{h} ->", end=" ")

    if (w, h) == (TARGET_W, TARGET_H):
        out = img
        print("already target size, copying")
    else:
        # Preserve aspect by scaling then center-cropping to exact target.
        # Aspect of source vs target:
        src_ratio = w / h
        dst_ratio = TARGET_W / TARGET_H
        if abs(src_ratio - dst_ratio) < 0.005:
            out = img.resize((TARGET_W, TARGET_H), Image.LANCZOS)
            print(f"{TARGET_W}x{TARGET_H} (direct resize)")
        elif src_ratio > dst_ratio:
            # Source is wider -> scale by height, crop sides
            new_w = round(h * dst_ratio)
            left = (w - new_w) // 2
            cropped = img.crop((left, 0, left + new_w, h))
            out = cropped.resize((TARGET_W, TARGET_H), Image.LANCZOS)
            print(f"{TARGET_W}x{TARGET_H} (crop sides then resize)")
        else:
            # Source is taller -> scale by width, crop top/bottom
            new_h = round(w / dst_ratio)
            top = (h - new_h) // 2
            cropped = img.crop((0, top, w, top + new_h))
            out = cropped.resize((TARGET_W, TARGET_H), Image.LANCZOS)
            print(f"{TARGET_W}x{TARGET_H} (crop top/bottom then resize)")

    DST.mkdir(exist_ok=True)
    out_path = DST / (path.stem + ".png")
    out.save(out_path, "PNG", optimize=True)

def main() -> int:
    if not SRC.exists():
        SRC.mkdir(parents=True)
        print(f"Created {SRC}. Drop iPhone screenshots there and re-run.")
        return 0

    files = sorted(
        p for p in SRC.iterdir()
        if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".heic", ".heif"}
    )
    if not files:
        print(f"No images in {SRC}. Drop iPhone screenshots there and re-run.")
        return 0

    for p in files:
        try:
            process(p)
        except Exception as e:
            print(f"  FAILED: {e}")
            return 1

    print(f"\nDone. Upload files in: {DST}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
