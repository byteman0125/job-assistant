Icon Assets for Job Searcher Application

Required icon files:
- icon.png (512x512) - Main app icon
- icon.ico - Windows icon
- icon.icns - macOS icon
- tray-icon.png (32x32) - System tray icon

Icon Design Theme:
- Job search themed (briefcase, magnifying glass, or document)
- Professional and modern look
- Colors: Green (#4CAF50) and dark blue/gray accents
- Clean and recognizable at small sizes

For now, you can use placeholder icons or generate proper icons using:
- https://icon.kitchen/
- https://www.iconfinder.com/
- Or create custom icons using design tools

To generate multi-format icons:
npm install -g electron-icon-builder
electron-icon-builder --input=./icon.png --output=./assets --flatten

