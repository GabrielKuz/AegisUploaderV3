from pathlib import Path
from fontTools.ttLib import TTFont
import re

# ==========================================================================
# PATHS
# ==========================================================================

# Resolve everything relative to this script
SCRIPT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = SCRIPT_DIR.parent
PUBLIC_DIR = FRONTEND_DIR / "public"

FONT_DIR = PUBLIC_DIR / "fonts"
OUTPUT = FRONTEND_DIR / "src" / "styles" / "fonts.css"

# Prefer conventional CSS weight names, then fall back to metadata.
NAMED_WEIGHTS = (
    ("extra bold", 800),
    ("extrabold", 800),
    ("semi bold", 600),
    ("semibold", 600),
    ("extra light", 200),
    ("extralight", 200),
    ("thin", 100),
    ("light", 300),
    ("regular", 400),
    ("medium", 500),
    ("bold", 700),
    ("black", 900),
)

# ==========================================================================
# FONT FAMILY NORMALIZATION
# ==========================================================================

def get_css_family(font_file: Path) -> str:
    # Return the family name that should be used by CSS.
    relative_path = font_file.relative_to(FONT_DIR)

    if not relative_path.parts:
        return font_file.parent.name

    folder = relative_path.parts[0]
    filename = font_file.stem.lower()

    if folder == "Epilogue":
        return "Epilogue"

    if folder == "GeistMonoTTP":
        return "Geist Mono"

    if folder == "OpenSans":
        if "semicondensed" in filename:
            return "Open Sans SemiCondensed"

        if "condensed" in filename:
            return "Open Sans Condensed"

        return "Open Sans"

    # Fallback for any future font folders.
    return folder


# ==========================================================================
# FONT METADATA
# ==========================================================================

def get_weight(
    font: TTFont,
    font_file: Path,
) -> int:
    # Determine CSS font weight 

    filename = font_file.stem.lower()

    # Remove separators so both forms are easily recognized
    normalized_filename = (
        filename
        .replace("-", " ")
        .replace("_", " ")
    )

    compact_filename = normalized_filename.replace(" ", "")

    for name, weight in NAMED_WEIGHTS:
        normalized_name = name.replace(" ", "")

        if (
            name in normalized_filename
            or normalized_name in compact_filename
        ):
            return weight

    if "OS/2" in font:
        weight = int(font["OS/2"].usWeightClass)

        if 1 <= weight <= 1000:
            return weight

    return 400


def get_italic(font: TTFont, font_file: Path) -> bool:
    # Determine if face is italic with metadata first and filename as fallback
    if "OS/2" in font:
        fs_selection = int(font["OS/2"].fsSelection)

        # Bit 0 of fsSelection represents italic.
        if fs_selection & 0x01:
            return True

    if "head" in font:
        mac_style = int(font["head"].macStyle)

        # Bit 1 of macStyle represents italic.
        if mac_style & 0x02:
            return True

    filename = font_file.stem.lower()

    return "italic" in filename or "oblique" in filename


def get_public_url(font_file: Path) -> str:
    # Files in Vite's public directory are served from site root
    relative_path = font_file.relative_to(PUBLIC_DIR)
    return f"/{relative_path.as_posix()}"

# ==========================================================================
# GENERATION
# ==========================================================================

def generate_fonts_css() -> None:
    if not FONT_DIR.exists():
        raise FileNotFoundError(
            f"Font directory does not exist: {FONT_DIR}"
        )

    font_files = sorted(FONT_DIR.rglob("*.ttf"))

    if not font_files:
        raise FileNotFoundError(
            f"No .ttf files were found inside: {FONT_DIR}"
        )

    # Warn immediately if font expected by global.css is missing
    expected_folders = (
        "Epilogue",
        "OpenSans",
        "GeistMonoTTP",
    )

    for folder in expected_folders:
        folder_path = FONT_DIR / folder

        if not folder_path.exists():
            print(
                f"WARNING: Expected font folder was not found: "
                f"{folder_path}"
            )

    records: list[tuple[str, int, bool, Path]] = []

    for font_file in font_files:
        font = TTFont(font_file)

        try:
            family = get_css_family(font_file)
            weight = get_weight(font, font_file)
            italic = get_italic(font, font_file)
        finally:
            font.close()

        records.append(
            (
                family,
                weight,
                italic,
                font_file,
            )
        )

    # Makes generated file easier to read
    records.sort(
        key=lambda record: (
            record[0],
            record[1],
            record[2],
            record[3].name,
        )
    )

    css_parts = [
        """/* ==========================================================================
   FONT FACES

   AUTO-GENERATED by frontend/Scripts/generateFonts.py
   DO NOT EDIT THIS FILE DIRECTLY.

   Font roles:
   - Epilogue: Application typography
   - Open Sans: Microsoft / supplemental UI typography
   - Geist Mono: IDs, UUIDs, codes, and technical values
   ========================================================================== */
"""
    ]

    previous_family: str | None = None

    for family, weight, italic, font_file in records:
        # CHANGED:
        # Add readable sections to the generated CSS.
        if family != previous_family:
            css_parts.append(
                f"""/* ==========================================================================
   {family.upper()}
   ========================================================================== */
"""
            )

            previous_family = family

        css_parts.append(
            f"""@font-face {{
  font-family: "{family}";
  src: url("{get_public_url(font_file)}") format("truetype");
  font-weight: {weight};
  font-style: {"italic" if italic else "normal"};
  font-display: swap;
}}
"""
        )

    OUTPUT.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    OUTPUT.write_text(
        "\n".join(css_parts),
        encoding="utf-8",
    )

    print()
    print(f"Generated: {OUTPUT}")
    print(f"Font files included: {len(records)}")

    families = sorted(
        {family for family, _, _, _ in records}
    )

    print("Generated families:")

    for family in families:
        print(f"  - {family}")


if __name__ == "__main__":
    generate_fonts_css()