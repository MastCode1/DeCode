#!/usr/bin/env bash
# Builds dist/decode-motion-graphics.mp4 from source:
#   1. renders the composition frame by frame (headless Chromium)
#   2. synthesises the original score
#   3. muxes picture + music
# Needs: node + playwright (Chromium), ffmpeg, python3 with numpy/scipy,
# fonttools+brotli (to expose Geist to fontconfig for the preview iframes).
set -euo pipefail
cd "$(dirname "$0")"

# system-ui / sans-serif inside the HTML previews -> Geist, as a modern OS would
FONT_DIR="$HOME/.local/share/fonts"
if ! fc-list | grep -q "Geist"; then
  mkdir -p "$FONT_DIR" "$HOME/.config/fontconfig"
  for f in fonts/*.woff2; do
    python3 -c "from fontTools.ttLib import TTFont; f=TTFont('$f'); f.flavor=None; f.save('$FONT_DIR/'+'$(basename "$f" .woff2)'+'.ttf')"
  done
  cat > "$HOME/.config/fontconfig/fonts.conf" <<'XML'
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <alias binding="strong"><family>system-ui</family><prefer><family>Geist</family></prefer></alias>
  <alias binding="strong"><family>sans-serif</family><prefer><family>Geist</family></prefer></alias>
  <alias binding="strong"><family>monospace</family><prefer><family>Geist Mono</family></prefer></alias>
</fontconfig>
XML
  fc-cache -f >/dev/null
fi

mkdir -p out dist
[ -f assets/generated-lake.png ] || node tools/render-landscape.mjs
node render.mjs out/frames.mp4
python3 music/compose.py out/music.wav
ffmpeg -v error -y -i out/frames.mp4 -i out/music.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart dist/decode-motion-graphics.mp4
echo "built dist/decode-motion-graphics.mp4"
