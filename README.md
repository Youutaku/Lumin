# Lumin

Lumin 是一款专注、优雅的 Markdown 编辑器，基于 Electron 和 Vue 3 构建，面向 Windows 平台。

## 特性

- 三种编辑模式：纯编辑、分屏同步、纯预览
- 亮色 / 暗色主题一键切换，平滑过渡
- 大纲导航侧边栏，支持 h1 到 h6 全层级缩进
- 数学公式渲染（KaTeX）
- 流程图、时序图、类图、甘特图（Mermaid）
- 代码语法高亮（highlight.js）
- Monaco 编辑器内核，括号匹配、自动折叠、多光标
- 自动保存，防止意外丢失
- 系统文件对话框，新建 / 打开 / 另存
- 一键自动检查更新，下载后静默安装
- 自定义标题栏与品牌图标
- 状态栏显示行列、字数、字符数
- 快捷键覆盖常用操作

## 技术栈

- Electron 33
- Vue 3 + Vite
- Monaco Editor
- marked
- highlight.js
- KaTeX
- Mermaid
- electron-updater

## 下载安装

前往 [GitHub Releases](https://github.com/Youutaku/lumin/releases) 下载最新版本。

Windows 10 / 11 x64 用户推荐下载 `Lumin Setup 0.0.1.exe` 安装包，便携版可直接运行 `Lumin.exe`。

## 从源码构建

### 环境要求

- Node.js 18 及以上
- npm 或 pnpm

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建安装包

```bash
npm run build
```

构建产物输出到 `release/` 目录，包含 NSIS 安装程序和免安装版。

## 常用快捷键

| 操作 | 快捷键 |
|------|--------|
| 新建文件 | Ctrl + N |
| 打开文件 | Ctrl + O |
| 保存 | Ctrl + S |
| 另存为 | Ctrl + Shift + S |
| 切换主题 | Ctrl + Shift + T |
| 放大 | Ctrl + = |
| 缩小 | Ctrl + - |
| 重置缩放 | Ctrl + 0 |
| 切换分屏模式 | 工具栏点击 |

## 自动更新

Lumin 内置了 electron-updater，启动时会静默检查 GitHub Releases。若发现新版本，可在"帮助 -> 关于 Lumin"中点击"检查更新"，下载完成后一键安装并重启。

如需手动更新，访问 [Releases 页面](https://github.com/Youutaku/lumin/releases) 下载最新安装包覆盖安装即可。

## 许可证

MIT License.
