from fontTools.ttLib import TTFont
from pathlib import Path
import re

FONT_DIR = Path("public/fonts")
OUTPUT = Path("src/styles/fonts.css")

WEIGHTS = {
    "thin": 100,
    "extralight": 200,
    "extra light": 200,
    "light": 300,
    "regular": 400,
    "normal": 400,
    "medium": 500,
    "semibold": 600,
    "semi bold": 600,
    "bold": 700,
    "extrabold": 800,
    "extra bold": 800,
    "black": 900,
}

def get_name(font, name_id):
    for record in font["name"].names:
        if record.nameID == name_id:
            try:
                return record.toUnicode()
            except:
                pass
    return None


def detect_weight(style, filename):
    text = f"{style} {filename}".lower()

    for key, value in WEIGHTS.items():
        if key in text:
            return value

    return 400


def detect_italic(style, filename):
    text = f"{style} {filename}".lower()
    return "italic" in text or "oblique" in text


css = """/* AUTO-GENERATED with frontend\\Scripts\\generateFonts.py- DO NOT EDIT */\n\n"""

for font_file in sorted(FONT_DIR.rglob("*.ttf")):
    font = TTFont(font_file)

    family = get_name(font, 1)
    style = get_name(font, 2)

    if not family:
        family = font_file.parent.name

    weight = detect_weight(
        style or "",
        font_file.stem
    )

    italic = detect_italic(
        style or "",
        font_file.stem
    )

    css += f"""@font-face {{
  font-family: "{family}";
  src: url("/{font_file.as_posix()}") format("truetype");
  font-weight: {weight};
  font-style: {"italic" if italic else "normal"};
  font-display: swap;
}}

"""

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(css, encoding="utf-8")

print(f"Generated {OUTPUT}")
