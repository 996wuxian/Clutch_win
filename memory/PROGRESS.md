# PROGRESS

> **生命周期：** 见 [`docs/document-governance.md`](../docs/document-governance.md) §文档生命周期。  
> 主文件仅保留当前状态 + 最近 10 次会话；更早记录见 [`archive/PROGRESS-2026-Q2.md`](./archive/PROGRESS-2026-Q2.md) · [`archive/PROGRESS-2026-Q3.md`](./archive/PROGRESS-2026-Q3.md)。

## Current Status

- **阶段：** **v1.1.1 已发布**（2026-07-04）— Windows interactive PTY (#30) + 平台 chrome 拆分
- **Release：** [v1.1.1](https://github.com/fancy1108/Clutch/releases/tag/v1.1.1) Latest · 上一版 [v1.1.0](https://github.com/fancy1108/Clutch/releases/tag/v1.1.0)
- **Git：** `main` / `dev` · 版本号 `1.1.1`
- **开放：** [#23](https://github.com/fancy1108/Clutch/issues/23) Windows 实体机 smoke（v1.1.1 安装包已挂 Release）

### v1.1.1 发版清单

| 项 | 状态 |
|----|------|
| PR #31 merge `dev` → `main` | ✅ |
| `git tag v1.1.1` + macOS DMG CI | ✅ |
| Windows MSI/NSIS 挂 Release + SHA256SUMS | ✅ |
| Homebrew tap → 1.1.1 | ✅ |
| macOS updater (`latest.json` + tar.gz) | ✅ |
| @996wuxian Win10/11 smoke | ⏳ |

## Next Actions

- **#23** — @996wuxian 用 v1.1.1 Win 安装包做实体机 smoke（PTY + 侧栏 + 安装）
- **sync `dev`** — merge `main` 回 `dev`（如尚未同步）

## Recent Sessions

## 2026-07-05 会话（移除冗余任务编排入口）

- **原因** 已有独立 Workflows SOP 导航承接复杂任务编排，左侧栏再放 `Task Orchestration` 新建入口会重复且增加心智负担。
- **修复** 移除展开态 `Task Orchestration` 按钮，恢复单一 Quick Chat 新建入口；复杂任务继续通过 Workflows SOP 进入。同步 `PRODUCT_INTRO.md`。Quick Chat 的 Codex 快速问答仍走真实 `codex exec --json --ignore-rules --ephemeral`，不注入项目 system prompt，不写项目 session。
- **Commit** `b825aff` — `fix(ui): remove redundant task orchestration entry`
- **验证** `pnpm --filter @clutch/desktop test` 17 files / 126 tests 通过；`pnpm --filter @clutch/desktop build` 通过。仍有既有 `LanguageContext.tsx` duplicate key warning 与 chunk size warning。

## 2026-07-05 会话（新建会话入口拆分）

- **原因** 后端关键词判断 Quick / Project 只能止血，长期产品心智不正确；用户要求把“快速会话”和“任务编排”作为最前置入口区分。
- **修复** 左侧栏展开态将单一 `New Chat` 拆成 `Quick Chat` 与 `Task Orchestration`。Quick Chat 创建普通 chat session 并保留默认文本模型重置；Task Orchestration 创建新 run 后进入 Workflows SOP / 编排准备态，不自动启动 workflow。折叠态与项目行内 `+` 保持轻入口语义，兼容既有 `nav-new-chat` E2E selector。
- **Commit** `12f1a9a` — `feat(ui): split quick chat and task orchestration entry`
- **验证** `pnpm --filter @clutch/desktop test` 17 files / 126 tests 通过；`pnpm --filter @clutch/desktop build` 通过。仍有既有 `LanguageContext.tsx` duplicate key warning 与 chunk size warning。

## 2026-07-05 会话（Codex Quick / Project 分流）

- **原因** 用户实测 `@Codex CLI` 问“鲁迅和周树人是一个人吗”在 Clutch 内耗时 29.1s；审计显示 `workspace_lock_acquire_ms=0`、`cli_subprocess_ms=29016`、`input_tokens=10688`，确认主要慢点不是 UI/WebSocket/shell 池，而是 Codex headless 项目路径为常识短问加载项目上下文。
- **修复** Codex plain chat 增加 Quick / Project 自动分流：明显非项目短问走 `Codex CLI (Quick)`，使用临时目录 + `--ignore-rules --ephemeral` 真实调用 Codex，不写项目 `cli_session_id`；代码、文件、仓库、运行、测试等项目任务继续走 `Codex CLI (Direct)`，保留项目 cwd、真实 `thread_id` resume 与审计。
- **Commit** `9416bd5` — `fix(codex): split quick ask from project execution`
- **验证** 定向 `python -m uv run pytest tests/test_agent_routing_smoke.py tests/test_claude_hybrid_output_parser.py tests/test_ws_hybrid_execution.py` 35 passed / 1 warning；后端全量 `python -m uv run pytest` 640 passed / 9 skipped / 1 warning。手工直接 Quick 同形态命令本次约 23.95s、`input_tokens=10084`，比项目路径减少上下文但仍受 `codex exec` headless 启动/模型耗时影响。
- **下次优先** 若用户仍认为短问不可接受，停止继续挤 `codex exec`，转入 Codex 交互/常驻路径（`exec-server` / `app-server` / interactive PTY）评估。

## 2026-07-05 会话（Codex plain chat 直接 subprocess）

- **原因** 用户指出短问不应走“本地假回复”绕过模型，核心问题是 Clutch 调 Codex 的真实链路比原生 Codex CLI 慢太多；上一轮已撤回身份短问 fast path。
- **修复** `codex-cli` plain chat 改为直接调用 `codex exec --json` / `codex exec resume <thread_id>`，绕过 Clutch hybrid shell/PTY 包装；继续使用 Codex 原生模型调用、真实 `thread_id` 恢复和 workspace CLI 锁。新增 Codex usage 解析，并在 hybrid audit 中记录 `workspace_lock_acquire_ms`、`cli_subprocess_ms`、`total_ms` 与 token usage，便于后续定位慢在 Clutch 包装还是 Codex CLI/模型。
- **Commit** `e7ffcd8` — `fix(codex): route plain chat through direct subprocess`
- **验证** `python -m uv run pytest tests/test_claude_hybrid_output_parser.py tests/test_agent_routing_smoke.py tests/test_ws_hybrid_execution.py` 34 passed / 1 warning；`python -m uv run pytest` 639 passed / 9 skipped / 1 warning。`bash scripts/verify.sh` 未运行成功：当前 PowerShell PATH 无 `bash`。
- **下次优先** 用实际 Clutch UI 再测 `@Codex CLI 你叫什么` 与同 workspace 直接 `codex exec --json` 的差距；若仍显著慢，进入 Phase 2 评估 Codex `exec-server` / `app-server` / 交互 PTY 常驻路径。

## 2026-07-05 会话（Codex CLI 原生 resume 优化）

- **原因** `codex-cli` plain chat 之前每轮都执行新的 `codex exec --json`，并把 system prompt + 历史对话重放给 Codex；用户实测同样短问在 Codex CLI 原生会话约 10s，在 Clutch 内约 17.5s。
- **修复** 从 Codex JSONL `thread.started.thread_id` 提取真实 Codex thread id 并写入 `cli_session_id`；同一 Clutch 会话后续 Codex 轮次改走 `codex exec resume <thread_id> ... --json <当前输入>`，不再重复注入 system prompt 或完整历史。保留旧会话/低版本失败后的历史重放回退。
- **Commit** `9eb7d59` — `fix(codex): resume native exec sessions`
- **验证** `python -m uv run pytest tests/test_claude_hybrid_output_parser.py tests/test_agent_routing_smoke.py tests/test_ws_hybrid_execution.py` 31 passed / 1 warning。

## 2026-07-05 会话（开发态 Sidecar 自动重载）

- **原因** `pnpm tauri:dev` 下前端 Vite 会 HMR，但 debug sidecar 由 Rust 直接启动 `uvicorn` 且未带 `--reload`，修改 Python 后端代码后必须重启 Tauri 才会生效。
- **修复** debug sidecar 启动参数改为 `uv run uvicorn src.main:app --host 127.0.0.1 --port 8124 --reload --reload-dir src`，仅影响开发态；release PyInstaller sidecar 不变。
- **Commit** `c808786` — `fix(dev): reload sidecar on python changes`
- **验证** `cargo check --no-default-features` 通过。

## 2026-07-05 会话（AI 回复耗时显示）

- **分支** `clutch_win_wuxian` 个人主用产品分支继续改进日常使用可观测性。
- **实现** 后端在 plain chat / MCP 审批继续回复 / workflow refine 回复完成后写入 `ChatMessage.executionTime`；前端将耗时显示在 AI 回复气泡下方，用户消息不显示耗时。
- **Commit** `3206f8e` — `feat(chat): show assistant reply elapsed time`
- **验证** `python -m uv run pytest tests/test_ws_message_log.py tests/test_ws_hybrid_execution.py` 6 passed / 1 warning；`pnpm --filter @clutch/desktop test` 17 files / 126 tests 通过；`pnpm --filter @clutch/desktop build` 通过。直接 `uv run ...` 在当前 PowerShell PATH 下不可用，使用 `python -m uv` 替代。既有 `LanguageContext.tsx` duplicate key warning 与 chunk size warning 仍未处理。

## 2026-07-05 会话（个人主用分支 Terminal Focus 改造）

- **分支** `clutch_win_wuxian` 作为 wuxian 日常主用产品分支继续分化；本次不改 `win` 贡献分支。
- **产品调整** 将硬切换的 `Chat mode / Terminal mode` 改为同一会话里的 `Conversation / Terminal focus`，Terminal 不再被视为另一个任务模式。
- **实现** Terminal Focus 打开时仍保留 Chat 上下文和主 `ChatInputBar`；`OrchestratorBar` 移入终端聚焦面板并使用独立输入态；进入 Terminal Focus 不再强制切默认 CLI Agent，也不再把底部 Agent 选择过滤为 CLI-only。
- **文档** 更新 `docs/PRODUCT_INTRO.md` 与 `memory/DECISIONS.md`，记录 Terminal 作为聚焦视图而非独立模式的产品决策。
- **验证** `pnpm --filter @clutch/desktop build` 通过；`pnpm --filter @clutch/desktop test` 17 files / 125 tests 通过。仍有既有 `LanguageContext.tsx` duplicate key warning 与 chunk size warning。

## 2026-07-04 会话（#30 merge + 平台 chrome 拆分）

- **#30** — 已通过 GitHub merge 进 `dev`（@996wuxian）；Windows interactive PTY（WinPTY）、字体偏好恢复、跨平台 `tauri:dev` launcher
- **平台边界** — `docs/PLATFORM_MAINTENANCE.md`、`.github/CODEOWNERS`、`platform/chrome/*.{macos,windows}.tsx`、`navConfig.ts`
- **mac** — 保留浮动侧栏折叠按钮、图标+微标签折叠 rail；统一 Chat 紧凑布局 + 右 panel 30px gutter
- **Windows** — 侧栏边缘折叠按钮、纯图标 rail、紧凑 Chat、右 panel 等分 Tab
- **致谢** — follow-up commit 含 `Co-authored-by: 996wuxian`

## 2026-07-03 会话（同步 upstream 首页图标 · @996wuxian）

- **原因** 作者 dev 已将首页/侧栏 Workflows SOP 图标更新为 `fork_right`，但 Windows UI polish 恢复时误把该入口带回旧的 `account_tree`。
- **修复** `apps/desktop/src/sidebar.tsx` 展开态与折叠态 Workflows SOP 图标统一同步为 upstream dev 的 `fork_right`，保留左侧面板中线折叠按钮与 Windows UI 布局。
- **Commit** `9a982f4` — `fix(ui): sync workflow sidebar icon from upstream`

## 2026-07-03 会话（同步 upstream dev + 侧栏折叠入口 · @996wuxian）

- **同步** 合入 `upstream/dev` `4740786`（v1.1.0 文档对齐、Agnes 默认文本模型、图标/模型相关更新）。
- **UI** 按作者 dev 方向移除 Header 顶部左侧折叠按钮，将左侧侧栏折叠入口移到侧栏右边缘中线位置，与右侧监督面板折叠按钮交互位置一致。
- **Commit** `214af4d` — `merge upstream dev and align sidebar collapse chrome`

## 2026-07-03 会话（v1.1.0 文档对齐 · README / 维护者文档）

- **README 双语** — Latest release / 当前版本 → **v1.1.0**；去掉「in development / 开发中」
- **维护者文档** — `UPDATES.md` · `RELEASE_MAINTAINER.md` · `STABILITY.md` 版本指针同步
- **Homebrew 模板** — `packaging/homebrew/Casks/clutch.rb` → 1.1.0 + SHA256
- **Memory** — `PROGRESS.md` · `DELIVERABLES.md` 待发版表述清理

## 2026-07-03 会话（同步 Windows UI polish）

- **原因** 同步 upstream v1.1.0 后，`1a35da6` 中部分 Windows 首页/工作台 chrome 调整被后续 Header、Sidebar、Terminal Orchestra 布局重构覆盖。
- **修复** 以 `1a35da6` 为基准，恢复 Header 内置侧栏折叠按钮、移除左侧浮动折叠按钮、侧栏折叠态纯图标 tooltip、Workflow 图标、Settings 底部布局、Chat 主区收窄逻辑、聊天气泡紧凑间距、右侧监督面板等分 Tab 与短指示条，并保持 v1.1.0 Terminal Orchestra 新逻辑。
- **Commit** `796120b` — `fix(ui): restore Windows workspace chrome polish`
- **验证** `pnpm build` 通过；`pnpm test` 17 files / 125 tests 通过。提交使用 `HUSKY=0`，原因同前：Husky pre-commit 在 Git Bash PATH 中找不到 `uv`。

## 2026-07-03 会话（恢复字体大小偏好）

- **原因** upstream v1.1.0 settings 重构后，字体大小偏好的存储/API/CSS 仍存在，但 `App.tsx` 不再读取并挂载 `data-font-size`，`SystemPreferencesModal.tsx` 也移除了选择入口。
- **修复** 恢复 General Settings 字体大小选择框、偏好读取/保存、根节点 `data-font-size` 应用，并同步 `PRODUCT_INTRO.md`。
- **Commit** `68769fb` — `fix(settings): restore font size preference`
- **验证** `pnpm build` 通过；`pnpm test` 17 files / 125 tests 通过。Husky pre-commit 在 Git Bash PATH 中找不到 `uv`，已在等价前端验证通过后用 `HUSKY=0` 提交。

## 2026-07-03 会话（Windows interactive PTY lanes）

- **修复** Windows Terminal Orchestra interactive PTY：`interactive_pty_runtime.py` 不再在 Windows 直接 blocked，复用 `WindowsPty` 支持 attach/read/write/close。
- **验证** 后端定向 PTY / Terminal Orchestra / WebSocket PTY 相关测试通过；全量 `python -m uv run pytest` 通过；`pnpm build`、`pnpm test` 通过；真实 Windows `cmd.exe` low-level 与 manager smoke 通过。
- **Commit** `395bacb` — `fix(windows): support interactive PTY lanes`
- **下次优先** Windows PTY polish：resize、Ctrl+C/Ctrl+D、长期运行 session、多 lane 并发关闭；再评估 Windows picker 和上游 TypeScript lint 质量债。

## 2026-07-03 会话（v1.1.0 文档恢复）

- **恢复** CHANGELOG `[1.1.0]`、`docs/releases/v1.1.0.md`、README 双语 What's new、PRODUCT_INTRO 终端 dock / resume、GETTING_STARTED / INSTALL pin
- **版本** package / tauri / Cargo → `1.1.0`
- **分支** `feat/d34-terminal-ux` rebase 至 `dev`（#28）后 push

## 2026-07-01 会话（文档治理轮转）

- **PROGRESS** → `archive/PROGRESS-2026-Q3.md`（保留最近 10 次会话）
- **DELIVERABLES** 瘦身：Active 清空 · v1.0.3 未发版条目保留 · OSR-16/17 入 `DELIVERABLES-OSR.md`

## 2026-07-01 会话（发版与安装渠道文档）

- **方案：** curl + `homebrew-clutch` tap；winget / Intel 暂缓
- **已建** [fancy1108/homebrew-clutch](https://github.com/fancy1108/homebrew-clutch)
- **文档** `RELEASE_MAINTAINER.md`（发版 checklist · AI 协作话术 · PAT 可选）
- **CI** `release.yml` 可选自动 sync tap（`HOMEBREW_TAP_GITHUB_TOKEN`）

## 2026-07-01 会话（README 与新手引导）

- **README** 重写：`README.md`（EN）+ `README.zh-CN.md`（ZH），顶部语言切换 + 显眼链向新手指南
- **新增** `docs/GETTING_STARTED.md` — 安装、向导、首聊、常见配置、故障排除（中英双语）
- **索引** `docs/README.md` · `INSTALL.md` · `PRODUCT_INTRO.md` · `FILEMAP.md` · `CHANGELOG`

## 2026-07-01 会话（Ollama Models Config 本机同步）

- **问题：** Settings → Models Config 与 Create Agent 的 Ollama 列表不一致，跨 Mac 对话 404
- **修复：** `models_config.py` — 本机 tag 同步 / 可用性 / `active_model_id` 回退
- **Commit：** `2257560` · 测试 21 passed

## 2026-07-01 会话（HRT-F 验收）

- **F1/F2/G：** Pass · **F3–F5：** Skip/N/A · **#24** closed

## 2026-07-01 会话（worktree 清理）

- **已删除 worktree：** `clutch-release-1.0.2-*` · `clutch-review-pr16/17` · `clutch-release-1.0.3-loop`
- **注意：** `1.0.3-loop` WIP 已随 force remove 丢失；Loop 需从 `dev` 重新开工

## 2026-07-01 会话（v1.0.2 发版收尾）

- **Updater go-live：** workflow [28465904210](https://github.com/fancy1108/Clutch/actions/runs/28465904210) ✅
- **Windows 安装包** 上传 Release · `SHA256SUMS.txt` 三项
- **Rivet/tools** 纳入 v1.0.2 · `release/1.0.2-updater` 合入 `dev`

## 2026-06-30 会话（GitHub triage）

- **PR #22** → **B-33** 写入 `BACKLOG.md` · **#18/#19** Bug 登记 · **#20** 用法咨询已回复

## 2026-06-29 会话 26（OSR-16/17 · Release 硬化）

- **OSR-16/17**：`release_hardening.py` · CSP · `console=False` — commit `e410897`
- **验证**：`pytest tests/test_release_hardening.py` + `./scripts/verify.sh`

## 2026-06-29 会话 25（OSR-14 · 首次启动向导）

- **前端**：7 屏 `OnboardingWizard`；`agentProvisioning.ts`；`App.tsx` 全屏挂载
- **验证**：`pytest tests/test_onboarding_preference.py` · vitest · `./scripts/verify.sh`

## 2026-06-29 会话 23（OSR-12 · v1.0.0 Release 实跑 ✅）

- Release 资产：`Clutch_1.0.0_aarch64.dmg` · `SHA256SUMS.txt` · 构建修复 `dd9fa20`

