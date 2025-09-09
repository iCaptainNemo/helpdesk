# Electron Assets

This directory contains the application icons and assets for the Electron application.

## Required Icons:

- `icon.png` - Main application icon (512x512 PNG)
- `icon.ico` - Windows application icon (multi-size ICO)
- `icon.icns` - macOS application icon (ICNS format)
- `tray-icon.png` - System tray icon (16x16 or 32x32 PNG)

## Icon Generation:

You can generate the required icon formats from a single high-resolution PNG using tools like:

1. **electron-icon-builder**: `npm install -g electron-icon-builder && electron-icon-builder --input=icon.png --output=./`
2. **Online converters**: Convert PNG to ICO and ICNS formats
3. **ImageMagick**: Command-line tool for icon conversion

## Placeholder Icons:

Currently using placeholder icons. Replace these with proper branded icons for production use.

## Icon Guidelines:

- Use high contrast colors for better visibility
- Ensure icons are readable at small sizes (16x16)
- Follow platform-specific icon guidelines
- Consider dark/light theme variations for tray icon