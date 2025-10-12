// Window manager to share main window reference
let mainWindow = null;

function setMainWindow(window) {
  mainWindow = window;
}

function getMainWindow() {
  return mainWindow;
}

module.exports = {
  setMainWindow,
  getMainWindow
};

