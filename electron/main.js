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
// 发布时未上传 .blockmap，且部分代理不支持多段 Range，禁用差分下载改为全量下载
autoUpdater.disableDifferentialDownload = true

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
  return {
    enabled: config.enabled,
    proxyUrl: config.proxyUrl,
    feedUrl: buildFeedUrl(config.proxyUrl),
    presets: DEFAULT_PROXIES
  }
})

ipcMain.handle('proxy:set', (event, { enabled, proxyUrl }) => {
  const url = (proxyUrl || '').trim()
  const finalEnabled = !!enabled && !!url
  writeJson(PROXY_FILE, { enabled: finalEnabled, proxyUrl: url })
  const feedUrl = applyProxy(finalEnabled ? url : '')
  return { enabled: finalEnabled, proxyUrl: url, feedUrl }
})

// 代理测速：取 latest.yml 验证可达性，再用 net.request 算真实下载速度
ipcMain.handle('proxy:test', async (event, proxyUrl) => {
  const dir = buildFeedUrl(proxyUrl)
  const overallStart = Date.now()

  // 1) 先验证 latest.yml 可访问
  let asset = ''
  try {
    const ymlController = new AbortController()
    const ymlTimer = setTimeout(() => ymlController.abort(), 8000)
    const resp = await net.fetch(`${dir}latest.yml`, { signal: ymlController.signal })
    clearTimeout(ymlTimer)
    if (!resp.ok) return { ok: false, ms: Date.now() - overallStart, message: `HTTP ${resp.status}` }
    const text = await resp.text()
    const m = text.match(/url:\s*([^\r\n]+)/)
    asset = m ? m[1].trim().replace(/^['"]|['"]$/g, '') : ''
  } catch (e) {
    return { ok: false, ms: Date.now() - overallStart, message: e.name === 'AbortError' ? '请求超时（8s）' : (e.message || String(e)) }
  }

  if (!asset) {
    return { ok: true, ms: Date.now() - overallStart, speedKbps: 0 }
  }

  // 2) 用 net.request 下载前 1MB 计算速度，Promise 带 15s 超时兜底
  return await new Promise((resolve) => {
    let bytes = 0
    let done = false
    const startedAt = Date.now()
    const TARGET = 1048576
    const req = net.request({
      method: 'GET',
      url: `${dir}${asset}`,
      headers: { Range: `bytes=0-${TARGET - 1}` }
    })
    const finish = (result) => {
      if (done) return
      done = true
      try { req.destroy() } catch {}
      resolve(result)
    }

    // 15s 兜底超时，防止任何事件都不触发时 Promise 永不 resolve
    setTimeout(() => {
      if (!done) finish({
        ok: false,
        ms: Date.now() - overallStart,
        speedKbps: 0,
        message: '测速超时（15s）'
      })
    }, 15000)

    req.on('response', (res) => {
      const okStatus = res.statusCode === 200 || res.statusCode === 206
      if (!okStatus) {
        finish({ ok: false, ms: Date.now() - overallStart, speedKbps: 0, message: `HTTP ${res.statusCode}` })
        return
      }
      res.on('data', (chunk) => {
        bytes += chunk.length
        if (bytes >= TARGET && !done) finish({
          ok: true,
          ms: Date.now() - overallStart,
          bytes,
          speedKbps: Math.round(bytes / 1024 / Math.max((Date.now() - startedAt) / 1000, 0.01))
        })
      })
      res.on('end', () => {
        if (!done) finish({
          ok: true,
          ms: Date.now() - overallStart,
          bytes,
          speedKbps: bytes > 0 ? Math.round(bytes / 1024 / Math.max((Date.now() - startedAt) / 1000, 0.01)) : 0
        })
      })
      res.on('error', (err) => {
        if (!done) finish({ ok: false, ms: Date.now() - overallStart, speedKbps: 0, message: err.message || String(err) })
      })
    })
    req.on('error', (err) => {
      finish({ ok: false, ms: Date.now() - overallStart, speedKbps: 0, message: err.message || String(err) })
    })
    req.end()
  })
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

// 默认代理（gh-proxy.org 实测比 gh-proxy.com 快 3-5 倍）
const DEFAULT_PROXY_URL = 'https://gh-proxy.org'
const DEFAULT_PROXIES = [
  { label: 'gh-proxy.org（推荐）', url: 'https://gh-proxy.org' },
  { label: 'gh-proxy.com', url: 'https://gh-proxy.com' },
  { label: 'mirror.ghproxy.com', url: 'https://mirror.ghproxy.com' },
  { label: '不使用代理（直连）', url: '' }
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

// 获取当前代理配置（首次运行默认启用 gh-proxy.org）
function getProxyConfig() {
  const saved = readJson(PROXY_FILE)
  if (!saved) {
    return { enabled: true, proxyUrl: DEFAULT_PROXY_URL }
  }
  return {
    enabled: !!saved.enabled,
    proxyUrl: saved.enabled ? (saved.proxyUrl || '') : ''
  }
}

// 拼代理前缀（格式：https://gh-proxy.org/https://github.com/xxx）
function wrapWithProxy(url, proxyUrl) {
  if (!proxyUrl) return url
  return `${proxyUrl.replace(/\/+$/, '')}/${url}`
}

function getEffectiveProxyUrl() {
  const cfg = getProxyConfig()
  return cfg.enabled ? cfg.proxyUrl : ''
}

// 发布页的 latest/download 目录：electron-updater 会在该目录下取 latest.yml 和安装包
function buildFeedUrl(proxyUrl) {
  const base = `${GITHUB_BASE}/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/`
  return proxyUrl ? wrapWithProxy(base, proxyUrl) : base
}

let currentFeedUrl = ''

// 把更新源切到「代理 + GitHub Release」或「直连」
function applyProxy(proxyUrl) {
  const feedUrl = buildFeedUrl(proxyUrl)
  if (feedUrl === currentFeedUrl) return feedUrl
  try {
    autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl })
    currentFeedUrl = feedUrl
  } catch (e) {
    console.error('[updater] setFeedURL 失败:', e.message)
  }
  return feedUrl
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

// 从 GitHub Releases API 拉 release notes（走代理，失败回退直连）
async function fetchGithubReleaseNotes(tag) {
  const apiUrl = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${tag}`
  const proxyUrl = getEffectiveProxyUrl()
  const candidates = proxyUrl ? [wrapWithProxy(apiUrl, proxyUrl), apiUrl] : [apiUrl]
  for (const url of candidates) {
    try {
      const resp = await net.fetch(url)
      if (resp.ok) {
        const data = await resp.json()
        if (data.body) return data.body
      }
    } catch {}
  }
  return ''
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
    // 每次检查前按当前设置刷新更新源，保证代理改动立即生效
    const feedUrl = applyProxy(getEffectiveProxyUrl())
    await autoUpdater.checkForUpdates()
    return { ok: true, feedUrl }
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

  // 初始化更新源（启用代理则走代理，否则直连）
  applyProxy(getEffectiveProxyUrl())

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
