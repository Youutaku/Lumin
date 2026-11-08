const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 对话框
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  saveFileDialog: (content, defaultPath) =>
    ipcRenderer.invoke('dialog:saveFile', { content, defaultPath }),

  // 文件操作
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath, content) =>
    ipcRenderer.invoke('file:write', { filePath, content }),

  // 应用信息
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // 外部链接
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // 菜单事件监听
  onMenu: (callback) => {
    const events = [
      'menu:new',
      'menu:open',
      'menu:save',
      'menu:saveAs',
      'menu:toggleTheme',
      'menu:focusMode',
      'menu:toggleSidebar',
      'menu:zoomIn',
      'menu:zoomOut',
      'menu:zoomReset',
      'menu:help',
      'menu:about'
    ]
    events.forEach((event) => {
      ipcRenderer.on(event, () => callback(event))
    })
  }
})
