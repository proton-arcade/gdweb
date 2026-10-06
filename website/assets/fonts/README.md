# Fonts

No font files are bundled or downloaded. The game renders all text with **fonts already
installed on your machine**, chosen to look like the chunky arcade lettering used by
Geometry Dash:

* Display / headings — `Impact, "Arial Black", Haettenschweiler, sans-serif`
* Menu chrome — `"Trebuchet MS", "Segoe UI", Tahoma, sans-serif`

Every string is drawn on the canvas with a thick black outline (`strokeText` then
`fillText`), optional gradients and optional glow — see `gd.util.drawText()` in
`website/js/util.js`.

To use a custom display font, drop the file here, load it with `@font-face` in
`website/css/style.css`, and change the `family` default in
`gd.util.drawText()`.
