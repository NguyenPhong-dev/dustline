#!/usr/bin/env bash
# Builds desktop/dist/Dustline.app for macOS from the browser game and an official Electron release.
# No Node.js or npm needed: it downloads Electron's prebuilt app, checks its SHA-256, adds the game,
# renames the bundle to Dustline and signs it for local use.
#
# Usage: desktop/build-mac.sh [arm64|x64]    (defaults to this Mac's processor)
set -euo pipefail

ELECTRON_VERSION="44.4.3"
BUNDLE_ID="io.github.dustline"

ARCH="${1:-$(uname -m)}"
[ "$ARCH" = "x86_64" ] && ARCH="x64"
case "$ARCH" in arm64|x64) ;; *) echo "Unknown architecture: $ARCH (use arm64 or x64)"; exit 1 ;; esac

HERE="$(cd "$(dirname "$0")" && pwd)"
GAME="$(cd "$HERE/.." && pwd)"
CACHE="$HERE/.cache"
OUT="$HERE/dist"
APP="$OUT/Dustline.app"
ZIP="electron-v${ELECTRON_VERSION}-darwin-${ARCH}.zip"
BASE="https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}"

mkdir -p "$CACHE" "$OUT"
if [ ! -f "$CACHE/$ZIP" ]; then
  echo "Downloading $ZIP from github.com/electron/electron"
  curl -fL --progress-bar -o "$CACHE/$ZIP.part" "$BASE/$ZIP"
  mv "$CACHE/$ZIP.part" "$CACHE/$ZIP"
fi
curl -fsSL -o "$CACHE/SHASUMS256-$ELECTRON_VERSION.txt" "$BASE/SHASUMS256.txt"
expected=$(awk -v f="$ZIP" '{ n = $2; sub(/^\*/, "", n); if (n == f) print $1 }' "$CACHE/SHASUMS256-$ELECTRON_VERSION.txt")
actual=$(shasum -a 256 "$CACHE/$ZIP" | awk '{ print $1 }')
if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
  echo "Checksum mismatch for $ZIP, deleting it. Run the script again to re-download."
  rm -f "$CACHE/$ZIP"
  exit 1
fi
echo "Checksum OK"

rm -rf "$APP" "$OUT/unpack"
mkdir -p "$OUT/unpack"
ditto -x -k "$CACHE/$ZIP" "$OUT/unpack"
mv "$OUT/unpack/Electron.app" "$APP"
rm -rf "$OUT/unpack"

RES="$APP/Contents/Resources"
rm -f "$RES/default_app.asar" "$RES/electron.icns"
mkdir -p "$RES/app/game"
cp "$HERE/main.js" "$HERE/preload.js" "$HERE/package.json" "$RES/app/"
cp -R "$GAME/index.html" "$GAME/css" "$GAME/js" "$GAME/lib" "$GAME/fonts" "$GAME/LICENSE" "$RES/app/game/"
cp "$HERE/icon.icns" "$RES/dustline.icns"

PB=/usr/libexec/PlistBuddy
setp() { "$PB" -c "Set :$2 $3" "$1" 2>/dev/null || "$PB" -c "Add :$2 string $3" "$1"; }
VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$HERE/package.json")
INFO="$APP/Contents/Info.plist"
setp "$INFO" CFBundleName Dustline
setp "$INFO" CFBundleDisplayName Dustline
setp "$INFO" CFBundleIdentifier "$BUNDLE_ID"
setp "$INFO" CFBundleIconFile dustline.icns
setp "$INFO" CFBundleShortVersionString "$VERSION"
setp "$INFO" CFBundleVersion "$VERSION"
setp "$INFO" LSApplicationCategoryType public.app-category.action-games
setp "$INFO" NSHumanReadableCopyright "MIT License"
# Electron's rebranding guide: give the helper apps matching identifiers too.
for helper in "$APP"/Contents/Frameworks/*Helper*.app; do
  hp="$helper/Contents/Info.plist"
  old=$("$PB" -c "Print :CFBundleIdentifier" "$hp")
  setp "$hp" CFBundleIdentifier "${old/com.github.Electron/$BUNDLE_ID}"
done

# Ad-hoc signature so macOS runs the modified bundle on this Mac.
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP"
touch "$APP"
echo "Built $APP ($(du -sh "$APP" | cut -f1))"
