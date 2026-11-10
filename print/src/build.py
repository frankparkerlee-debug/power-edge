#!/usr/bin/env python3
"""
Build the PowerEdge print pieces.

    python3 print/src/build.py            # every piece
    python3 print/src/build.py door-hanger

For each piece in PIECES this writes, into print/:
  <name>.pdf             the file to send the printer (bleed included, no marks)
  <name>-proof.pdf       same, with trim (red), safe area (blue) and die cut
  <name>-<side>.png      a preview of each side

QR codes are generated here as vectors so they stay sharp at yard-sign size.
Each piece gets its own utm_source, so the site's analytics can tell a scan
from a door hanger apart from one off a yard sign.

Needs Google Chrome, Node 22+ and the Python packages qrcode and Pillow.
"""
import subprocess
import sys
from pathlib import Path

import qrcode
import qrcode.image.svg
from PIL import Image

SRC = Path(__file__).resolve().parent
OUT = SRC.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CLAIM = "https://poweredgetx.com/roof-claim-check?utm_medium=qr&utm_campaign=claim&utm_source="

QRS = {
    "qr-doorhanger.svg": CLAIM + "doorhanger",
    "qr-yardsign.svg": CLAIM + "yardsign",
    "qr-banner.svg": CLAIM + "banner",
}

# name: (page width in, page height in, side names, preview scale)
PIECES = {
    "door-hanger": (4.5, 11.25, ["front", "back"], 3),
    "appointment-card": (3.75, 2.25, ["front", "back"], 4),
    "yard-sign-24x18": (24.25, 18.25, ["front"], 1),
    "banner-72x36": (72.25, 36.25, ["front"], 0.4),
}


def make_qrs():
    for name, url in QRS.items():
        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0, box_size=10)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(image_factory=qrcode.image.svg.SvgPathImage)
        img.save(str(SRC / name))


FONTS = [
    ("Archivo", "archivo.woff2", "100 900", "62% 125%"),
    ("Inter", "inter.woff2", "100 900", None),
    ("JetBrains Mono", "jetbrains-mono.woff2", "400 800", None),
]


def make_fonts_css():
    """Embed the fonts. Linked by file, Chrome captured the page before they
    loaded and printed the headline in a fallback face."""
    import base64
    rules = []
    for family, file, weight, stretch in FONTS:
        data = base64.b64encode((SRC / "fonts" / file).read_bytes()).decode()
        rules.append(
            f'@font-face {{ font-family: "{family}"; font-weight: {weight};'
            + (f" font-stretch: {stretch};" if stretch else "")
            + f' font-display: block; src: url(data:font/woff2;base64,{data}) format("woff2"); }}'
        )
    (SRC / "_fonts.css").write_text("\n".join(rules) + "\n")


def render(page, mode, out, *size):
    """Chrome via render.mjs, which waits for the fonts before capturing."""
    subprocess.run(["node", str(SRC / "render.mjs"), str(page), mode, str(out), *map(str, size)], check=True)


def build(name):
    w, h, sides, scale = PIECES[name]
    page = SRC / f"{name}.html"
    render(page, "pdf", OUT / f"{name}.pdf")
    # Proof: the same page with trim, safe area and die cut switched on.
    proof = SRC / f"_{name}-proof.html"
    proof.write_text(page.read_text().replace("<body>", '<body class="proof">', 1))
    render(proof, "pdf", OUT / f"{name}-proof.pdf")

    # Preview: sides sit in a row on screen (see _print.css), then get cut apart.
    gap, pad = 0.25, 0.25
    css_w = round((pad * 2 + w * len(sides) + gap * (len(sides) - 1)) * 96)
    css_h = round((pad * 2 + h) * 96)
    shot = SRC / f"_{name}-shot.png"
    render(page, "png", shot, css_w, css_h, scale)
    img = Image.open(shot)
    k = img.width / css_w
    for i, side in enumerate(sides):
        x = (pad + i * (w + gap)) * 96 * k
        y = pad * 96 * k
        img.crop((round(x), round(y), round(x + w * 96 * k), round(y + h * 96 * k))).save(
            OUT / f"{name}-{side}.png")
    shot.unlink()
    proof.unlink()
    print(f"built {name}: {name}.pdf, {name}-proof.pdf, " + ", ".join(f"{name}-{s}.png" for s in sides))


if __name__ == "__main__":
    make_qrs()
    make_fonts_css()
    for n in (sys.argv[1:] or PIECES):
        if (SRC / f"{n}.html").exists():
            build(n)
        else:
            print(f"skip {n}: no {n}.html yet")
