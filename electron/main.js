const { app, BrowserWindow, ipcMain, dialog, Menu, shell, net } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')

// GitHub 仓库配置（打包后 package.json 的 build 字段会被剥离，这里硬编码）
const GITHUB_OWNER = 'Youutaku'
const GITHUB_REPO = 'Lumin'

let mainWindow = null
const isDev = process.env.NODE_ENV === 'development'

// 配置 autoUpdater
autoUpdater.autoDownload = false  // 用户点"检查更新"才下载
autoUpdater.autoInstallOnAppQuit = true  // 退出时自动安装

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#ffffff',
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.on('did-finish-load', () => {
    // 窗口加载完成后检测版本变更
    checkVersionChange()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'Ctrl+N',
          click: () => mainWindow?.webContents.send('menu:new')
        },
        {
          label: '打开...',
          accelerator: 'Ctrl+O',
          click: () => mainWindow?.webContents.send('menu:open')
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'Ctrl+S',
          click: () => mainWindow?.webContents.send('menu:save')
        },
        {
          label: '另存为...',
          accelerator: 'Ctrl+Shift+S',
          click: () => mainWindow?.webContents.send('menu:saveAs')
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { type: 'separator' },
        { label: '全选', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '切换主题',
          accelerator: 'Ctrl+Shift+T',
          click: () => mainWindow?.webContents.send('menu:toggleTheme')
        },
        {
          label: '切换专注模式',
          accelerator: 'Ctrl+Shift+F',
          click: () => mainWindow?.webContents.send('menu:focusMode')
        },
        {
          label: '切换侧边栏',
          accelerator: 'Ctrl+B',
          click: () => mainWindow?.webContents.send('menu:toggleSidebar')
        },
        { type: 'separator' },
        {
          label: '放大',
          accelerator: 'Ctrl+=',
          click: () => mainWindow?.webContents.send('menu:zoomIn')
        },
        {
          label: '缩小',
          accelerator: 'Ctrl+-',
          click: () => mainWindow?.webContents.send('menu:zoomOut')
        },
        {
          label: '重置缩放',
          accelerator: 'Ctrl+0',
          click: () => mainWindow?.webContents.send('menu:zoomReset')
        },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '帮助文档',
          click: () => mainWindow?.webContents.send('menu:help')
        },
        { type: 'separator' },
        {
          label: '关于 Lumin',
          click: () => mainWindow?.webContents.send('menu:about')
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// 文件对话框 IPC
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开 Markdown 文件',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown 文件', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0]
    const content = fs.readFileSync(filePath, 'utf-8')
    return { filePath, content }
  }
  return null
})

ipcMain.handle('dialog:saveFile', async (event, { content, defaultPath }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存 Markdown 文件',
    defaultPath: defaultPath || 'untitled.md',
    filters: [
      { name: 'Markdown 文件', extensions: ['md'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, content, 'utf-8')
    return result.filePath
  }
  return null
})

ipcMain.handle('file:read', async (event, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (e) {
    return null
  }
})

ipcMain.handle('file:write', async (event, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  } catch (e) {
    return false
  }
})

ipcMain.handle('app:getVersion', () => app.getVersion())

// 代理相关 IPC
ipcMain.handle('proxy:get', () => {
  const config = getProxyConfig()
  return { ...config, presets: DEFAULT_PROXIES }
})

ipcMain.handle('proxy:set', async (event, { enabled, proxyUrl }) => {
  const url = enabled ? (proxyUrl || '') : ''
  const finalEnabled = enabled && !!url
  writeJson(PROXY_FILE, { enabled: finalEnabled, proxyUrl: url })
  applyProxy(url)
  return { enabled: finalEnabled, proxyUrl: url }
})

ipcMain.handle('shell:openExternal', async (event, url) => {
  try {
    await shell.openExternal(url)
    return true
  } catch (e) {
    return false
  }
})

// ============ Auto Updater + Changelog ============

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

const CHANGES_DIR = app.getPath('userData')
const LAST_VERSION_FILE = path.join(CHANGES_DIR, '.last-version.json')
const CHANGELOG_FILE = path.join(CHANGES_DIR, '.changelog.json')
const PROXY_FILE = path.join(CHANGES_DIR, '.updater-proxy.json')
const GITHUB_BASE = 'https://github.com'
const GITHUB_API_BASE = 'https://api.github.com'

// 默认代理列表
const DEFAULT_PROXIES = [
  { label: 'gh-proxy.com', url: 'https://gh-proxy.com' },
  { label: 'mirror.ghproxy.com', url: 'https://mirror.ghproxy.com' },
  { label: 'gh.api.99988866.xyz', url: 'https://gh.api.99988866.xyz' },
  { label: '不使用代理', url: '' }
]

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {
    return null
  }
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
  } catch {}
}

// 获取当前代理配置
function getProxyConfig() {
  const saved = readJson(PROXY_FILE)
  return {
    enabled: saved?.enabled ?? false,
    proxyUrl: saved?.proxyUrl ?? ''
  }
}

// 把 URL 套上代理前缀（代理格式：https://gh-proxy.com/https://github.com/xxx）
function wrapWithProxy(url, proxyUrl) {
  if (!proxyUrl) return url
  // 去掉代理末尾的斜杠
  const prefix = proxyUrl.replace(/\/+$/, '')
  return `${prefix}/${url}`
}

// 把 autoUpdater 切到指定代理（或直连）
function applyProxy(proxyUrl) {
  const releasesBase = `${GITHUB_BASE}/${GITHUB_OWNER}/${GITHUB_REPO}/releases`
  const latestDir = `${releasesBase}/latest/download`
  autoUpdater.server = {
    provider: 'generic',
    url: proxyUrl ? wrapWithProxy(latestDir, proxyUrl) : latestDir
  }
}

async function checkVersionChange() {
  const current = app.getVersion()
  const lastRun = readJson(LAST_VERSION_FILE)?.version
  if (lastRun && lastRun !== current) {
    // 有更新，优先读本地 changelog.json，空的就主动从 GitHub 拉
    const changelog = readJson(CHANGELOG_FILE) || {}
    let releaseNotes = changelog.releaseNotes || ''
    if (!releaseNotes) {
      releaseNotes = await fetchGithubReleaseNotes(`v${current}`)
    }
    sendToRenderer('app:changelog', {
      from: lastRun,
      to: current,
      releaseNotes,
      releaseDate: changelog.releaseDate || ''
    })
  }
  writeJson(LAST_VERSION_FILE, { version: current, at: Date.now() })
}

// 从 GitHub Releases API 拉 release notes
async function fetchGithubReleaseNotes(tag) {
  try {
    const { proxyUrl } = getProxyConfig()
    const url = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${tag}`
    // API 走代理用 gh-proxy 的 API 模式
    const apiUrl = proxyUrl ? wrapWithProxy(url, proxyUrl) : url
    const resp = await net.fetch(apiUrl)
    if (!resp.ok) return ''
    const data = await resp.json()
    return data.body || ''
  } catch {
    return ''
  }
}

autoUpdater.on('checking-for-update', () => {
  sendToRenderer('updater:checking')
})

autoUpdater.on('update-available', async (info) => {
  // electron-updater 的 info.releaseNotes 通常是空的，主动拉 GitHub API
  let releaseNotes = info.releaseNotes || ''
  if (!releaseNotes) {
    releaseNotes = await fetchGithubReleaseNotes(`v${info.version}`)
  }
  // 立刻存起来，update-downloaded 时 info.releaseNotes 还是空的
  writeJson(CHANGELOG_FILE, {
    version: info.version,
    releaseNotes,
    releaseDate: info.releaseDate || '',
    savedAt: Date.now()
  })
  sendToRenderer('updater:available', {
    version: info.version,
    releaseNotes,
    releaseDate: info.releaseDate || ''
  })
})

autoUpdater.on('update-not-available', (info) => {
  sendToRenderer('updater:not-available', { version: info.version })
})

autoUpdater.on('download-progress', (progressObj) => {
  sendToRenderer('updater:progress', {
    percent: Math.round(progressObj.percent),
    bytesPerSecond: progressObj.bytesPerSecond,
    total: progressObj.total,
    transferred: progressObj.transferred
  })
})

autoUpdater.on('update-downloaded', (info) => {
  // 存 changelog，下次启动时弹窗用
  let releaseNotes = info.releaseNotes || ''
  writeJson(CHANGELOG_FILE, {
    version: info.version,
    releaseNotes,
    releaseDate: info.releaseDate || '',
    savedAt: Date.now()
  })
  sendToRenderer('updater:downloaded', { version: info.version })
})

autoUpdater.on('error', (err) => {
  sendToRenderer('updater:error', { message: err.message || String(err) })
})

// IPC: 渲染进程主动触发检查更新
ipcMain.handle('updater:check', async () => {
  if (isDev) {
    return { ok: false, message: '开发模式下无法检查更新，请使用打包后的版本。' }
  }
  try {
    await autoUpdater.checkForUpdates()
    return { ok: true }
  } catch (e) {
    return { ok: false, message: e.message || String(e) }
  }
})

// IPC: 用户点"下载更新"
ipcMain.handle('updater:download', async () => {
  try {
    await autoUpdater.downloadUpdate()
    return { ok: true }
  } catch (e) {
    return { ok: false, message: e.message || String(e) }
  }
})

// IPC: 用户点"立即安装并重启"
ipcMain.handle('updater:install', async () => {
  autoUpdater.quitAndInstall(true, true)
  return { ok: true }
})

app.whenReady().then(() => {
  createWindow()
  createMenu()

  // 初始化代理配置
  const { enabled, proxyUrl } = getProxyConfig()
  if (enabled && proxyUrl) {
    applyProxy(proxyUrl)
  }

  // 生产环境启动后静默检查一次更新
  if (!isDev) {
    autoUpdater.checkForUpdates().catch(() => {})
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
