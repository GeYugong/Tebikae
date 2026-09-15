# 连接与使用

## 连接 GitHub

1. 在 GitHub.com 创建或选择你自己拥有的**私人仓库**，启用 Issues。
2. 打开 [fine-grained Token 创建页](https://github.com/settings/personal-access-tokens/new?name=Tebikae&issues=write&expires_in=90)。选择 `Only select repositories`，指定笔记仓库，将 `Issues` 设为 `Read and write`。
3. 在 Tebikae 中填写 `owner/repo` 或完整 GitHub 仓库网址，粘贴 Token，点击连接。

Metadata 只读是 GitHub 的基础权限；不需要 Contents、Actions 或仓库管理权限。Token 预填链接不会替你选择仓库。

连接验证身份、仓库可见性、所有者和 Issues 可读性，不会创建测试内容或更改仓库设置。`permissions.push` 不能证明 Token 具有 Issues 写权限；实际保存失败时会保留本地内容并提示修正权限。首版不接受公开仓库、组织仓库、他人所有的仓库或自定义 API 主机。

## 写笔记

- 首页快速输入或“新建笔记”打开可视化编辑器；清单按钮直接开始任务列表。
- 标题可以留空，第一次保存草稿时按当前语言固定为“无标题笔记”或 `Untitled note`。
- 标题上限为 120 个 Unicode 码点，正文为 40,000 个。超限不会被静默截断。
- 修改约 150 毫秒后写入此设备；停止输入 2 秒后申请同步。自动笔记写入之间至少间隔 15 秒；`Ctrl/Cmd + S` 或“立即同步”请求手动保存，仍遵守串行和限流规则。
- “已保存到此设备”表示 IndexedDB 写入成功；只有 GitHub 确认后才显示“已同步到 GitHub”。
- “已有 Issues”只读展示普通 Issue。逐条点击“转为笔记”才添加笔记元数据。Pull Request 被过滤。

可视化模式支持 CommonMark 与 GFM。原始 HTML、脚注、数学、指令等无法安全往返的内容保留在源码模式；代码围栏中的内容按代码保存。外部图片显示占位链接，不自动联网加载。

## 整理与恢复

标签直接对应 GitHub Labels。侧栏和筛选面板使用同一个筛选状态；多标签支持全部／任一匹配，还能筛选颜色、类型、置顶、日期和未同步内容。预览上一条／下一条沿打开时的筛选序列浏览。当前笔记编辑中离开筛选条件时，仍保留编辑窗口。

归档关闭 Issue；恢复归档重新打开 Issue。回收站仅记录 `trashedAt`，保留当时归档状态。回收站不自动清空，也不执行永久删除。

同一浏览器中的一个仓库同时只有一个标签页可以编辑。其他标签页只读；关闭原标签页后，点击“启用编辑”接管。没有 Web Locks 的浏览器保留阅读和导出能力。

## 断网、冲突与错误

刷新会清除 Token，但保留草稿。首页可主动打开已知缓存，无需 Token；这不是独立的本地登录保护。恢复网络并重新连接后，先读取 GitHub 再处理队列。关闭网页或 PWA 后不保证继续同步。

创建请求超时可能已经成功。应用先扫描 Issues，通过笔记 UUID 找回原 Issue，不自动再次 POST。“再次创建”会提示可能重复。相同 UUID 的多个 Issue 暂停自动写入，可以选择原笔记，将其余条目拆为独立副本。

本地与远端修改不同字段时合并；同一字段修改为不同内容时暂停同步。可以保留远端、使用本地或将本地另存。处理前保存恢复副本；覆盖前若远端再次变化，会重新提示冲突。

本地空间不足或写入失败时，编辑器保留内存正文，提供下载入口并阻止直接关闭编辑器。不要依赖浏览器强制退出时能够完成保存。

## 数据与隐私

Token 仅保留在当前页内存，只通过授权请求头发往 `https://api.github.com`。不会写入 URL、localStorage、IndexedDB、Service Worker 或导出文件。应用不使用第三方统计、远程字体或错误内容上传。

笔记 Markdown 以明文存于 GitHub；本地缓存同样没有端到端加密。托管站点所提供的 JavaScript 在运行时能接触页面输入，不应将纯前端理解为恶意站点无法取得数据。

设置页区分断开连接和清除当前仓库的设备数据。清除操作会显示未同步笔记数量；如需保留请先导出。JSON 导出包括加载过的原始 Issue、笔记、草稿、尝试记录、冲突和恢复副本。离线／未完成完整拉取时标为部分导出，不含评论和附件文件。Issues 不在 Git 提交中，`git clone` 不会备份笔记。

权限和限流依据：[GitHub PAT 文档](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)、[Issues API](https://docs.github.com/en/rest/issues/issues)、[REST API 最佳实践](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)。
