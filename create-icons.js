const fs = require('fs');
const path = require('path');

// Simple 16x16 PNG icon (green square with white briefcase symbol)
// This is a base64 encoded PNG
const iconData = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH5QoLBxQwKJ3IXAAAA1JJREFUWMO1l09oE0EUxn+zu5tkN9k0bZo/TdOmKVKLFkURPHjw4EFEDx48ePLgQQ+ePHjx4sWLFy9evHjx4sWLFy9evHjx4kFE8KAHQaRaa2tTa5M2TZPdZGd3Z2YPbpI2aZpEvPjgwTDM/r7v/d57b4ZhGP4XXlVVFVVVVVRVVVFVVUVVVRVVVVVUVVVRVVVFVVVVVFVVUVVVRVVVVVRVVVFVVf2vvKqq+l94VVX1v/Cqqup/4VVV1f/Cq6qq/4VXVVX/C6+qqv4XXlVV/S+8qqr6X3hVVfW/8Kqq6n/hVVXV/8Krqqr+F15VVf0vvKqq+l94VVX1v/Cqqup/4VVV1f/Cq6qq/4VXVVX/C6+qqv4XXlVV/S+8qqr6X3hVVfW/8Kqq6n/hVVXV/8Krqqr+F15VVf0vvKqq+l94VVX1v/Cqqup/4VVV1f/Cq6qq/4VXVVX/C6+qqv4XXlVV/S+8qqr6X3hVVfW/8Kqq6n/hVVXV/8Krqqr+F15VVf0vvKqq+l94VVX1v/Cqqup/4VVV1f/Cq6qq/wX/DXwbvBpGGwAAAABJRU5ErkJggg==',
  'base64'
);

const assetsDir = path.join(__dirname, 'assets');

// Create assets directory if it doesn't exist
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Create icon files
fs.writeFileSync(path.join(assetsDir, 'icon.png'), iconData);
fs.writeFileSync(path.join(assetsDir, 'tray-icon.png'), iconData);

console.log('Icon placeholders created successfully!');
console.log('Icons created in:', assetsDir);

