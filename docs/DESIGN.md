# Design

本文记录当前实现的结构和取舍。使用方式和安装步骤见 [README](../README.md)。

## 1. 产品模型

- **审计目标**：DSH 已配置的一条 provider 路由 + 一个 model id。插件不维护自己的端点表，也不保存 API key。
- **指纹记录**：对某个目标在某一时刻做一次完整采集的结果。记录本身就是指纹，包含 40 个 cell 的经验答案分布和派生统计。
- **对比**：任意两条记录之间的同一个操作。跨模型、跨服务商、同一目标的前后两次，都是同一个比较操作，只有 `relation` 标签不同。
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
- 判定线：`CUTOFF = 0.280`，取自发布的分半 trial 中不同模型距离的 1% 分位。该工作点把误报压到约 1%，同模型比较的漏报约 18%；它比论文的 EER 工作点（0.356，FPR≈FNR≈7.3%）更严格。
- 比较前校验两条记录属于同一测量协议：`promptVersion` 不同直接拒绝；`reasoningPolicy` 不是 `disabled`（或非推理模型的 `none`）也拒绝。`sessionPolicy` 不同只给警告，因为会话标识可能影响路由与缓存，但没有证据表明它改变答案分布。

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
- `responses.jsonl` 的 key 是 `cellId#rep`；恢复时按 key 去重，已完成的请求不重发。请求里的重复 cell id 会先去重，统计只按唯一 cell 汇总。
- 进程内采集持有 AbortController；插件卸载时中止在途请求并停止调度，记录标为失败并保留已完成的响应。
- 启动时扫描 `queued`/`running` 的遗留记录：没有 runner 的记录标为失败（原因写明中断），已完成的响应和分半统计保留，记录可以直接删除，不自动续跑。
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

采集请求只使用 `off/none/disabled` 档位：显式请求其他档位会被拒绝，默认选择也只在这些档位里挑；`minimal` 仍会产生推理，不算关闭。探针允许指定任意已声明档位，用于诊断。
请求走 `ctx.llm.stream({ provider, model, system, messages, temperature: 1, maxTokens: 16, reasoningEffort, sessionId })`。每个独立样本（cell × repetition）生成新的 UUID，同一样本的重试沿用该 ID；probe 同样逐样本生成 ID。不创建聊天会话，也不传历史、工具或当前聊天的 system prompt；一次请求只有论文 system prompt 和一条 user 探针。

新记录的 `request.sessionPolicy` 和探针日志的 `sessionPolicy` 为 `new-per-sample-reuse-on-retry`，成功响应保存实际 `sessionId`。旧记录没有这一策略字段，不能假定其会话路由策略相同。会话标识可能影响服务商路由和缓存；新 ID 不保证禁用缓存。

遇到 `MissingSessionID` 时停止调度后续采样，等待已经发出的并发请求结束后将记录标为失败，保留原始错误，不继续发完整批次。

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
- 结论用“看起来是同一个模型 / 看起来不是同一个模型 / 证据不足，无法判断”，旁边显示判定线；结果下方常驻一句解释，避免把“低于判定线”误读成“证明同一模型”。

主题只使用 `--dsw-alias-*` token，文案通过 client locale 注册；当前提供 en / zh。

## 7. 阈值与解释

- `score` 是平均 JSD，越小表示答案分布越接近。
- 判定线 0.280 来自发布数据：27,060 个不同模型 trial 的平均 JSD，1% 分位约 0.280。它比论文 EER 点 0.356 更严格：误报从 7.3% 降到约 1%，漏报升到约 18%。这是有意选择的工作点，不是论文的 EER 阈值。
- 跨服务商同模型天然可能有差异；论文中同模型分半中位 0.140，跨服务商 0.227，不同模型 0.463（cell 级 JSD 则是 0.075 对 0.489）。跨服务商被判成“看起来不是同一个模型”可能是误报，需要结合参考值和来源判断。
- 论文报告的有效率是总体 97.6%、模型内中位 99.6%、最低 60.6%；它不设 80% 的排除线。插件只展示这些参考值，不用自造阈值判定记录好坏。
- 结论只在覆盖完整 40 个 cell、且两条记录都是每 cell 30 次重复时给出；其余情况返回 `insufficient_evidence` 和 `verdictReason`（`no_cells` / `partial_battery` / `repetitions`），分数仍展示供参考。
- 判定线来自发布数据，不是本地重新校准；如果以后积累足够的 genuine/impostor 记录，可以按同一方法重算并记录版本。
- 判定线只适用于这套协议（40 cell × 30 次、提示词版本一致、推理关闭）。修改这些条件后，旧线不再适用。

## 8. 限制与不做的事

- 不做 post-reasoning 指纹模式；只能 reasoning 的模型被拒绝。
- 不读取/保存 provider key；认证由 DSH 适配器负责。
- 不读取 provider 返回的 model 字符串或聚合器上游路由；`ctx.llm.stream` 不暴露这些。
- 不把“分布不一致”解释成“供应商故意掺水”；它只是可观察行为差异。
- 不实现自动定时巡检、多端点距离矩阵、CSV 导出、自定义 battery 编辑器；这些是后续功能。

## 9. 维护

- 提示词版本写在 `prompts.json` 的 `version` 和每条记录的 `promptVersion`；改提示词需要重新采集，旧记录不能直接和新记录混比。
- 判定线常量在 `core.js` 的 `CUTOFF`；修改时需要同步 README/DESIGN 并说明校准来源。
- 数据目录 append-only；分析产物可以删除后从 `responses.jsonl` 重新计算。
- 代码无构建步骤；`npm run check` 做三个 JS 文件的语法检查，`npm test` 跑核心回归测试。
