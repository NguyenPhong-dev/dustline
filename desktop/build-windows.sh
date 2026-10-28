#!/usr/bin/env bash
# Builds Dustline for Windows on macOS or Linux: desktop/dist/win-x64/Dustline (a folder with Dustline.exe)
# and desktop/dist/Dustline-<version>-win-x64.zip. Like build-mac.sh it downloads Electron's prebuilt app
# and checks its SHA-256, so no npm is needed.
# If Node.js 20 or later is installed, Dustline.exe also gets its own icon and file details (otherwise it
# keeps Electron's, and only the window shows the Dustline icon). That step downloads the resedit library
# from npm at a fixed version and checks it against its published hash. Set NODE to pick a Node.js binary.
#
# Usage: desktop/build-windows.sh [x64|arm64]    (defaults to x64)
set -euo pipefail

ELECTRON_VERSION="44.4.3"
RESEDIT="resedit 3.1.0 sha512-i6CN8E6FzTpzsGq/oUnm2GTWhddpZEbnAE+zeNwqTppucTK7xd178q1xWEMrFb+nLnCh+geDqZ4QwhFN8VEgVQ=="
PE_LIBRARY="pe-library 2.0.1 sha512-/qjYFqNSlq59B5DI36am++5/3gMgh02QnzpYigrwrW6s+QpU0mHf09/iA4wjTu21UUxodyV7ZCetV5MiDhaN/A=="

ARCH="${1:-x64}"
case "$ARCH" in x64|arm64) ;; *) echo "Unknown architecture: $ARCH (use x64 or arm64)"; exit 1 ;; esac

HERE="$(cd "$(dirname "$0")" && pwd)"
GAME="$(cd "$HERE/.." && pwd)"
CACHE="$HERE/.cache"
OUT="$HERE/dist/win-$ARCH"
APP="$OUT/Dustline"
VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$HERE/package.json")
RELEASE_ZIP="$HERE/dist/Dustline-$VERSION-win-$ARCH.zip"
ZIP="electron-v${ELECTRON_VERSION}-win32-${ARCH}.zip"
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

rm -rf "$APP"
mkdir -p "$APP"
unzip -q "$CACHE/$ZIP" -d "$APP"
mv "$APP/electron.exe" "$APP/Dustline.exe"
rm -f "$APP/resources/default_app.asar"
mkdir -p "$APP/resources/app/game"
cp "$HERE/main.js" "$HERE/preload.js" "$HERE/package.json" "$HERE/icon.ico" "$APP/resources/app/"
cp -R "$GAME/index.html" "$GAME/css" "$GAME/js" "$GAME/lib" "$GAME/fonts" "$GAME/LICENSE" "$APP/resources/app/game/"

NODE_BIN="${NODE:-node}"
if command -v "$NODE_BIN" >/dev/null 2>&1; then
  TOOLS="$CACHE/win-tools"
  # Downloads one npm package, checks its sha512 against the pinned value and unpacks it into $TOOLS.
  fetch_npm() {
    local name=$1 version=$2 integrity=$3 tgz="$CACHE/$1-$2.tgz"
    [ -f "$tgz" ] || curl -fsSL -o "$tgz" "https://registry.npmjs.org/$name/-/$name-$version.tgz"
    if [ "sha512-$(openssl dgst -sha512 -binary "$tgz" | openssl base64 -A)" != "$integrity" ]; then
      echo "Checksum mismatch for $name $version, deleting it. Run the script again to re-download."
      rm -f "$tgz"
      exit 1
    fi
    rm -rf "$TOOLS/node_modules/$name"
    mkdir -p "$TOOLS/node_modules/$name"
    tar -xzf "$tgz" -C "$TOOLS/node_modules/$name" --strip-components=1
  }
  fetch_npm $RESEDIT
  fetch_npm $PE_LIBRARY
  cp "$HERE/set-exe-info.mjs" "$TOOLS/"
  "$NODE_BIN" "$TOOLS/set-exe-info.mjs" "$APP/Dustline.exe" "$HERE/icon.ico" "$VERSION"
else
  echo "Node.js not found, so Dustline.exe keeps Electron's file icon and details. The game window still shows the Dustline icon."
fi

rm -f "$RELEASE_ZIP"
(cd "$OUT" && zip -qrX "$RELEASE_ZIP" Dustline)
echo "Built $APP ($(du -sh "$APP" | cut -f1)) and $RELEASE_ZIP ($(du -h "$RELEASE_ZIP" | cut -f1))"
