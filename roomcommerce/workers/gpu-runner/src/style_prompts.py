"""
style_prompts.py — Style Preset Prompt Taxonomy
Satisfies: FR-201

All 8 approved interior-design style presets with carefully tuned positive
prompts for SDXL ControlNet inpainting, plus a universal negative prompt
that penalises common diffusion hallucinations.
"""
from typing import Dict

# ---------------------------------------------------------------------------
# Positive prompts — one per style preset (FR-201)
# ---------------------------------------------------------------------------
STYLE_PRESET_PROMPTS: Dict[str, str] = {
    "JAPANDI": (
        "Architectural photography of an interior living room in Japandi style, "
        "minimalist low-profile oak furniture, warm linen upholstery, beige and warm off-white tones, "
        "paper lantern pendant light, clean geometric lines, tranquil aesthetic, 8k resolution, soft natural light."
    ),
    "MID_CENTURY_MODERN": (
        "Editorial interior design of a Mid-Century Modern room, iconic tapered walnut wood furniture, "
        "olive and burnt orange accents, structured credenza, tailored upholstery, architectural balance, "
        "professional interior photography, 8k resolution."
    ),
    "SCANDINAVIAN": (
        "Bright airy Scandinavian room, light ash wood, textured wool rug, white walls, "
        "monochromatic accents, clean functionality, hygge atmosphere, diffused daylight, "
        "editorial interior photography, 8k resolution."
    ),
    "INDUSTRIAL": (
        "Loft interior in refined Industrial design, matte black steel frames, reclaimed wood coffee table, "
        "distressed leather seating, exposed brick accents, modern Edison lighting, structured architectural space, "
        "professional interior photography, 8k resolution."
    ),
    "MINIMALIST": (
        "Ultra-clean minimalist interior, monolithic forms, uncluttered negative space, "
        "warm limestone textures, recessed lighting, serene uncluttered living environment, "
        "professional interior photography, 8k resolution."
    ),
    "CONTEMPORARY": (
        "High-end contemporary interior, soft curved bouclé seating, travertine marble side table, "
        "sculptural ceramics, neutral palette with subtle brass accents, editorial lighting, "
        "professional interior photography, 8k resolution."
    ),
    "BOHEMIAN": (
        "Elevated modern bohemian living space, layered natural jute rugs, rattan accents, "
        "terracotta pots, lush indoor plants, textured woven throws, warm sunlit interior, "
        "editorial interior photography, 8k resolution."
    ),
    "MODERN_FARMHOUSE": (
        "Refined modern farmhouse interior, rustic timber beams, slipcovered linen sofa, "
        "black iron hardware, warm white shiplap, vintage textured pottery, welcoming domestic light, "
        "professional interior photography, 8k resolution."
    ),
}

# ---------------------------------------------------------------------------
# Universal negative prompt — penalises diffusion hallucinations
# ---------------------------------------------------------------------------
NEGATIVE_PROMPT: str = (
    "fictional furniture, impossible geometry, floating objects, warped legs, cartoon, 3d render, "
    "blurry, oversaturated, neon purple glow, distorted perspective, extra limbs, humans, clutter."
)
