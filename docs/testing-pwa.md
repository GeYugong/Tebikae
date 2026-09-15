# PWA 与生产路径验收

本记录对应 2026-09-16 的本地生产构建。测试读取 Vite 输出的静态文件，GitHub API 使用测试响应，不需要真实 Token，也不修改远端仓库。

## 本次结果

15 项检查全部通过。每个浏览器包含英文离线编辑、中文离线编辑、缓存与凭证检查、等待更新与草稿恢复、仓库路径检查，共 5 项。

| 浏览器引擎 | 结果       | 断网方式                               |
| ---------- | ---------- | -------------------------------------- |
| Chromium   | 5 / 5 通过 | 浏览器离线模式                         |
| Firefox    | 5 / 5 通过 | 浏览器离线模式                         |
| WebKit     | 5 / 5 通过 | 生产静态服务器拒绝全部连接；限制见下文 |

## 复现

在 PowerShell 中执行：

```powershell
pnpm build
$env:VITE_BASE_PATH = '/Tebikae/'
pnpm exec vite build --outDir .artifacts/pages-dist
Remove-Item Env:VITE_BASE_PATH
pnpm exec playwright test --config playwright.pwa.config.ts
```

配置启动根路径与仓库路径的生产预览，分别使用 4175、4176 端口。WebKit 断网场景及更新场景使用临时端口上的隔离静态服务器。报告保存在 `.artifacts/pwa-report/`，失败截图及 trace 保存在 `.artifacts/pwa-results/`。

## 覆盖内容

- 应用外壳完成预缓存后，切断网络并重新载入页面；首次打开此前没有加载过的可视化编辑器，编辑、关闭、再刷新后读取本地草稿。
- 简体中文与英文分别执行以上流程，暗色偏好保持，刷新后的 Token 输入框为空。
- 检查 Cache Storage 只有同源应用资源，GitHub API 响应未进入 Service Worker 缓存；检查 IndexedDB、localStorage、sessionStorage 不含测试凭证。
- 在 `/Tebikae/` 下检查 JavaScript、样式、manifest、图标、Service Worker URL 与 scope；直接打开 Hash 路由并在失去网络后刷新。
- 更改测试服务器返回的 Service Worker 字节，触发等待更新，检查编辑期间不自动刷新，以及用户接受更新后的草稿恢复。

## 验证范围

Chromium 与 Firefox 使用 Playwright 的离线模式。测试先确认 Worker 已激活，并通过一次导航确认页面已受其控制；未完成安装前不承诺离线启动。

Windows Playwright WebKit 在已受控页面上调用离线模式后刷新，会报告浏览器内部错误。WebKit 场景使用隔离的生产静态服务器：预缓存完成后，服务器关闭每个新请求的 socket，并以未缓存资源请求确实失败作为断网证据。这验证 Service Worker 在源站不可达时的恢复能力，但此时 `navigator.onLine` 仍为真。真实 Safari／iOS 的飞行模式与安装后的独立 PWA 仍需设备检查。

更新场景改变的是生成后 Service Worker 的内容标记，静态资源集合保持一致。它覆盖更新提示、用户确认与草稿保存流程；跨版本数据库迁移、不同资源集合的发布／回滚需要另外验证。

这些检查不能证明系统强制结束浏览器后的后台同步，也不能替代真实设备的中文输入法、移动键盘与持久存储清理测试。
