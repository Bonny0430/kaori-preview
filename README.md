# kaori-preview — Kaori 文件预览系统

为 **DeepSeek Harness Web (dsh web)** 定制的轻量文件预览插件：
侧边栏 📂 按钮 → 文件树 → 文本/代码/Markdown/图片预览。

- **零 token 消耗**：文件内容通过独立 RPC 通道直接读给浏览器渲染，不经过 LLM、不进会话历史。
- **只读预览**：不做编辑/Git/终端，绝不修改会话容器布局。
- **主题友好**：默认主题开箱即用；其他主题通过 `hideOnOpen` 配置适配。

## 特性

- 侧边栏入口：
  - 展开（wide）时，📂 图标与系统图标（搜索/添加工作区）同排，样式一致
  - 收起（rail）时，📂 悬浮在搜索按钮下方，自动跟随切换
- 左侧文件树：目录/文件分层、隐藏文件与 `.git`/`node_modules`/`.dsh` 等目录自动过滤
- 右侧按类型渲染：
  - `.md` → Markdown 渲染（标题/列表/代码块/链接/引用）
  - 代码文件（js/ts/py/css/html/json 等）→ 语法着色
  - 文本 → 纯文本（超 256KB 自动截断）
  - 图片（png/jpg/gif/webp/svg/bmp）→ 自适应缩放
- 大文件保护：读取上限默认 256KB，目录遍历深度/条目数有限制
- 路径安全：仅允许工作区内相对路径，拒绝绝对路径/`..`/盘符越权

## 安装

```sh
# 克隆或下载本仓库到本地，然后在 dsh 环境执行：
dsh plugin --profile web add <本仓库路径>
# 重启 dsh web 生效（客户端改动刷新页面即可，服务端改动需重启）
```

> 插件依赖 DSH 框架提供的 `@deepseek-ai/schemastery`（构建时已外部化），
> 运行时由 dsh 环境解析，无需额外安装依赖。
> 源码改动后重新打包：`node build.mjs`（esbuild，产出 `lib/`）。

## 使用

1. 点击侧边栏 📂 按钮（展开时在图标行，收起时在搜索按钮下方）
2. 左侧文件树选择文件（隐藏文件与忽略目录已过滤）
3. 右侧按类型渲染预览
4. 面板右上角 ✕ 关闭；设置等模态浮层打开时自动关闭

## 配置

插件通过 DSH 插件配置注入（`Config`），字段如下：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `maxReadBytes` | `262144` | 文本/图片读取大小上限（字节） |
| `maxEntries` | `2000` | 文件树最多条目数 |
| `ignoreDirs` | `['.git','node_modules','.dsh',...]` | 文件树忽略的目录名 |
| `imageExts` | `['.png','.jpg',...]` | 图片预览扩展名 |
| `textExts` | `['.md','.txt',...]` | 文本预览扩展名 |
| `hideOnOpen` | `[]` | 面板打开时隐藏的 DOM 选择器（主题适配，见下） |

### 主题适配（hideOnOpen）

插件以默认主题为基准，默认不隐藏任何元素。若你的主题带有装饰层
（如侧边立绘、顶部台词、背景角色卡等），预览面板打开时会遮挡预览内容，
可配置在面板打开时隐藏这些装饰：

```yaml
# 例如 kaori 主题：
hideOnOpen:
  - ".kaori-companions"   # 右侧立绘/小猫
  - ".kaori-top-decor"    # 顶部台词装饰
```

面板关闭后自动恢复显示。

## 服务端 API（RPC 通道 `/kaori-preview`）

| endpoint | 参数 | 返回 |
|---|---|---|
| `listDir` | `{sessionId?, cwd?}` | `{entries: [{name,path,isDir,isFile}], cwd, truncated}` |
| `stat` | `{path}` | `{name,path,isDir,size,isImage,isText}` |
| `readText` | `{path}` | `{content, size, truncated, name}`（限 `maxReadBytes`） |
| `readImage` | `{path}` | `{dataUrl, size, name}`（限 `maxReadBytes`） |
| `getConfig` | `{}` | `{hideOnOpen}`（客户端启动时获取主题适配配置） |

安全：路径仅允许工作区内相对路径（拒绝绝对路径/`..`/盘符），每个请求都做边界校验。

## 文件结构

| 文件 | 作用 |
|---|---|
| `src/index.js` | 服务端源码：RPC 通道 + fs 读取（Node fs.promises） |
| `src/client.js` | 客户端源码：UI（侧边栏按钮/文件树/渲染器）+ 样式注入 |
| `lib/index.js` | 服务端构建产物（esbuild，纯 ESM） |
| `lib/client.js` | 客户端构建产物（esbuild + `__ModuleLoader__.load` 包装） |
| `build.mjs` | esbuild 构建脚本（改源码后 `node build.mjs` 重新打包） |
| `cordis.patch.yml` | profile bundle 补丁 |
| `dsh.plugin.json` | 插件清单 |

> **客户端必须构建**：DSH 通过 `exports["./client"]` 加载 `lib/client.js`，
> 并要求它是 `window.__ModuleLoader__.load({ id: 'kaori-preview', ... })` 包装的
> CJS bundle（加载后注册插件）。直接改 `src/client.js` 不生效——必须
> `node build.mjs` 重新打包。服务端同样从 `src/index.js` 构建。

## 许可

[MIT](./LICENSE)
