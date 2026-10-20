# Design

本文记录当前实现的结构和取舍。使用方式和安装步骤见 [README](../README.md)。

## 1. 产品模型

- **审计目标**：DSH 已配置的一条 provider 路由 + 一个 model id。插件不维护自己的端点表，也不保存 API key。
- **指纹记录**：对某个目标在某一时刻做一次完整采集的结果。记录本身就是指纹，包含 40 个 cell 的经验答案分布和派生统计。
- **对比**：任意两条记录之间的同一个操作。跨模型/跨服务商和同目标前后对比没有算法差异，只有 `relation` 标签不同。
- **单一实现**：Host service 是唯一操作层；agent 工具和 Web 面板都是调用方。

## 2. 协议常量

论文：Bruckner, *One Token Is Enough*，arXiv:2607.10252。

- 10 个任务 × 4 种语言（en / ru / zh / ar）= 40 个 cell。
- 每个 cell 默认 30 次重复；UI 最低 10，API/tool 允许更低用于诊断。
- `temperature=1.0`，`max_tokens=16`，每个 cell 使用对应语言的固定单词 system prompt。
- reasoning 必须关闭；不能关闭的模型不进入采集。
- 答案归一化：Unicode NFC、去标点/引号、case fold、阿拉伯-印度数字和中文数字映射、取首个词；每条响应归为 `valid` / `invalid` / `refusal` / `empty`，带 reasoning trace 的标为 `post_reasoning` 并从有效分布中排除。
- 距离：双方都有 ≥10 个有效样本的 cell 上求 base-2 JSD，再对 cell 取平均。
- 分半一致性：同一记录的 repetition 奇偶分半，在双方各 ≥5 个有效样本的 cell 上求 JSD 平均。
- 默认阈值：`TAU = 0.356`，即论文 full-battery 分半 trial 的等错误率点（FPR≈FNR≈7.3%）。这是冷启动默认值，不是对任意数据集的保证。

提示词和 system prompt 在 `prompts.json`，来自论文发布 artifact；来源和许可见 [NOTICE](../NOTICE.md)。

## 3. 数据模型

默认数据目录：`$DSH_HOME/llm-fingerprint/`，可由插件 row 的 `dataDir` 覆盖。

```text
llm-fingerprint/
  checkpoints/<record-id>/
    meta.json          # 目标、状态、请求数、reasoning 设置、usage、warnings
    responses.jsonl    # 每条成功请求一行，append-only
    fingerprint.json   # 派生分布、valid rate、分半一致性、cell 明细
  probes/<probe-id>.json
```

- 记录 id 形如 `cp-20261020T034450-59c80896`，服务端用严格格式校验，防止路径穿越。
- `responses.jsonl` 的 key 是 `cellId#rep`；恢复时按 key 去重，已完成的请求不重发。
- 失败请求按指数退避重试；最终失败的请求不写入数据集，`meta.json` 记录失败数。
- 运行中的记录登记在 Host 进程的 active set 中；删除接口会拒绝 active 记录，避免删到一半。
- 删除是永久的：移除整个记录目录，不做回收站。

## 4. Host 结构

`index.js` 通过 `apply(ctx, config)` 注册：

- 六个 agent 工具：`llm_fingerprint_list_models`、`probe`、`capture`、`get_record`、`compare`、`delete_record`。
- 一个 HTTP API，prefix `/llm-fingerprint/api`，供 Web 面板调用：
  - `GET /targets`
  - `GET /checkpoints`
  - `POST /checkpoints`
  - `GET /checkpoints/:id`
  - `DELETE /checkpoints/:id`
  - `POST /compare`
  - `POST /probe`
- 所有操作都在 `createService(ctx, root)` 返回的同一组方法里实现。

目标发现：

1. `ctx.llm.listProviders()` 拿 provider 路由；
2. `ctx.llm.listModels(provider)` 拿适配器暴露的模型；
3. `ctx.llm.resolveModelInfo(provider, model)` 拿 reasoning efforts 和默认 effort；
4. 计算 `paperCompatible`。

请求走 `ctx.llm.stream({ provider, model, system, messages, temperature: 1, maxTokens: 16, reasoningEffort })`。不传会话 id、历史、工具或当前会话的 system prompt；一次请求只有论文 system prompt 和一条 user 探针。

## 5. 兼容性硬拦截

`supportsPaperProtocol(info)` 的规则：

- 没有 `reasoning` 元数据 → 视为非推理模型，允许；
- 有 `reasoning`，且 efforts 中存在 `off` / `none` / `disabled` → 允许；
- 有 `reasoning`，但没有这些 effort → 不允许。

`paperCompatible=false` 的模型：

- UI 模型下拉里仍然列出，但 `disabled`，文本标注“不可关闭推理”；
- 服务商下所有模型都不可用时，服务商选项标注“无可用模型”，模型选择禁用，Start 禁用，并显示原因；
- Host `startCheckpoint` 再检查一次，API 和 agent 工具都无法绕过；
- `probe` 仍然可以用于诊断，但不会创建记录。

这套判断完全由运行时配置/适配器元数据计算，不维护模型名黑名单。给某个模型在 DSH 配置里加上 `off` 映射后，它会自动变为可用，不需要改插件代码。

## 6. Web 面板

客户端 `client.js` 注册：

- `main` keyed slot，key `llm-fingerprint`；
- `sidebar.panellist` 图标，id `llm-fingerprint`。

布局决策：

- 术语保留 `cell` / `JSD` / `split-half`，标题下给一句解释；
- 记录列表只保留决策信息：显示名、短时间 + 短 record id、状态、有效率、分半 JSD、纳入 cell；原始 slug 只在悬浮提示和详情抽屉里出现；
- 完成记录不显示进度条，运行中/有失败的记录才在状态列显示进度或失败数；
- 详情使用右侧抽屉，列表和对比区不被推走；
- 对比选择器显示“显示名 · 短时间 · #短 id”，并上下排列，避免长标签被截断；
- 默认选中第一个 `paperCompatible !== false` 的 provider/model，不硬编码模型名；
- 删除入口是行内垃圾桶 + 详情里的删除按钮，两者共用一个确认弹窗；运行中的记录禁用；
- 结论用“一致 / 不一致 / 证据不足”，结果下方常驻一句解释，避免把 `score ≤ τ` 误读成“证明同一模型”。

主题只使用 `--dsw-alias-*` token，文案通过 client locale 注册；当前提供 en / zh。

## 7. 阈值与解释

- `score` 是平均 JSD，越小表示答案分布越接近。
- `τ=0.356` 是论文 40-cell、同服务商、15 vs 15 分半数据的 EER 点。记录使用 30 次重复时，分半是 15 vs 15，和论文口径接近。
- 跨服务商同模型天然可能有差异；论文中同服务商分半中位约 0.140，跨服务商约 0.227，不同模型约 0.46–0.49。跨服务商红色结论可能是误报，报告会提示。
- 当前没有用本地数据重新校准 τ；如果以后积累足够的 genuine/impostor 记录，可以在服务层重算并记录版本。
- `τ` 只适用于论文协议。修改 repetitions、提示词或 reasoning 设置后，旧阈值不再适用。

## 8. 限制与不做的事

- 不做 post-reasoning 指纹模式；只能 reasoning 的模型被拒绝。
- 不读取/保存 provider key；认证由 DSH 适配器负责。
- 不读取 provider 返回的 model 字符串或聚合器上游路由；`ctx.llm.stream` 不暴露这些。
- 不把“分布不一致”解释成“供应商故意掺水”；它只是可观察行为差异。
- 不实现自动定时巡检、多端点距离矩阵、CSV 导出、自定义 battery 编辑器；这些是后续功能。

## 9. 维护

- 提示词版本写在 `prompts.json` 的 `version` 和每条记录的 `promptVersion`；改提示词需要重新采集，旧记录不能直接和新记录混比。
- 阈值常量在 `core.js` 的 `TAU`；修改时需要同步 README/DESIGN 并说明校准来源。
- 数据目录 append-only；分析产物可以删除后从 `responses.jsonl` 重新计算。
- 代码无构建步骤；`npm run check` 做三个 JS 文件的语法检查。
