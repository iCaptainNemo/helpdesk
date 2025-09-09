# Installer Assets

This directory contains assets for the NSIS installer.

## Required Files:

- `icon.ico` - Application icon for installer (32x32, 48x48, 256x256 multi-resolution ICO)
- `header.bmp` - Header image for installer pages (150x57 BMP, 8-bit)
- `wizard.bmp` - Sidebar image for welcome/finish pages (164x314 BMP, 8-bit)
- `license.txt` - Software license agreement text file

## Asset Guidelines:

### Icon (icon.ico)
- Multi-resolution ICO file with 16x16, 32x32, 48x48, and 256x256 sizes
- Should match the main application icon
- Use high contrast colors for visibility

### Header Image (header.bmp)
- Dimensions: 150x57 pixels
- Format: 8-bit BMP
- Should contain company/product branding
- Colors should match the installer theme

### Wizard Sidebar (wizard.bmp)
- Dimensions: 164x314 pixels  
- Format: 8-bit BMP
- Appears on welcome and finish pages
- Should be visually appealing and branded

### License Text (license.txt)
- Plain text file with software license
- Will be displayed in scrollable text box
- Keep line length reasonable for readability

## Creating Assets:

1. **From high-resolution source**: Create a high-resolution version of your logo/branding first
2. **Icon conversion**: Use tools like ImageMagick or online converters to create ICO files
3. **BMP optimization**: Ensure BMPs are 8-bit color depth for NSIS compatibility
4. **Test in installer**: Always test assets in the installer before distribution

## Placeholder Status:

Currently using placeholder descriptions. Replace with actual branded assets for production:

- [ ] icon.ico - Create branded application icon
- [ ] header.bmp - Design installer header with branding  
- [ ] wizard.bmp - Create welcome/finish page sidebar image
- [x] license.txt - Software license agreement (completed)

## Tools for Asset Creation:

- **GIMP**: Free image editor for creating BMPs
- **ImageMagick**: Command-line tool for format conversion
- **Icon editors**: IcoFX, Greenfish Icon Editor Pro
- **Online converters**: ConvertICO, ICO Convert