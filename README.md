# AO3 Mail Workspace for Firefox

将 [Archive of Our Own（AO3）](https://archiveofourown.org/) 的网页转换成类似 Outlook 的邮件工作界面，同时保留原始作品正文、链接和常用 AO3 功能。

当前版本：**v1.0.9**

## 功能

### 邮件式工作界面

- Outlook 风格的顶部栏、操作栏、文件夹、邮件列表和阅读窗格。
- AO3 作品、搜索结果、Bookmark、系列与 History 条目会显示成邮件。
- 原始 AO3 正文保留在阅读窗格内，作品链接和章节内容仍可正常访问。

### 搜索、浏览与阅读

- 顶部“搜索所有邮件”可跳转到 AO3 全站作品搜索。
- “筛选”可仅筛选当前已载入的邮件列表。
- 邮件列表支持单击选择、双击打开；键盘选中后按 Enter 也能打开。
- 每页显示 20 封邮件，提供“上一页”和“下一页”。
- History 页面会自动读取所有分页，不再只显示当前页面的 20 条记录。
- 可最小化文件夹与邮件列表，让阅读窗格占据更大空间。
- AO3 章节导航按钮会自动居中和对齐。

### 工具栏功能

- **新邮件**：打开 AO3 新建作品页面。
- **删除**：执行所选 History 条目的 `Delete from History`。
- **Bookmark**：添加或编辑当前作品的 AO3 Bookmark。
- **标记**：执行 `Mark for Later` 或 `Mark as Read`。
- **回复**：定位作品评论框；下拉菜单可打开评论列表。
- **转发**：复制当前作品链接。
- **RSS 源**：打开当前标签页、系列页等页面提供的 RSS/Atom 源。

### 其他功能

- 中文/英文界面一键切换，语言选择会被保存。
- 点击“恢复 AO3”可以立即返回原始 AO3 界面。
- 点击 Firefox 工具栏图标或使用 `Alt + Shift + M` 切换界面。
- 启用状态会被保存，下次访问 AO3 时自动沿用。
- 仅作用于 `archiveofourown.org`，不连接第三方服务，不收集用户数据。

## 安装

### Firefox 临时安装

1. 下载并解压 [`ao3-mail-workspace-firefox-v1.0.9-AMO.zip`](release/ao3-mail-workspace-firefox-v1.0.9-AMO.zip)。
2. 在 Firefox 地址栏打开 `about:debugging#/runtime/this-firefox`。
3. 点击“临时载入附加组件”。
4. 选择解压目录中的 `manifest.json`。
5. 打开或刷新 AO3 页面。

临时安装会在 Firefox 完全退出后被移除。长期安装应使用经过 Mozilla Add-ons 签名的版本。

## 文件结构

- `manifest.json`：Firefox WebExtension 配置。
- `content.js`：页面转换和功能逻辑。
- `mail-workspace.css`：邮件工作界面与 AO3 阅读样式。
- `background.js`：工具栏按钮和快捷键。
- `icons/mail.svg`：扩展图标。
- `release/`：可下载的打包版本。

## 隐私

扩展不收集、存储或上传用户数据。扩展只在 AO3 域名下运行，并仅使用 Firefox 本地存储保存界面启用状态和语言选择。

## 许可证

[MIT License](LICENSE)
