Roboto (Apache License 2.0), from the Google Fonts release published as
@expo-google-fonts/roboto.

Bundled because the generated invoice and packing slip print amounts in rupees:
the PDF core fonts have no U+20B9 glyph, so every amount would render as a box.
Both weights are the full latin face, not a subset, for the same reason — the
webfont subsets Google serves drop the rupee sign.
