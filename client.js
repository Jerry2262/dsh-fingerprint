window.__ModuleLoader__.load({
  id: 'dsh-fingerprint',
  factory(require) {
    const React = require('react');
    const { useEffect, useMemo, useRef, useState } = React;
    const h = React.createElement;
    const NS = 'llm-fingerprint';
    const PANEL_ID = 'llm-fingerprint';
    const API = '/llm-fingerprint/api';

    const en = {
      title: 'LLM Fingerprint',
      subtitle: 'One fingerprint record is one full paper-protocol capture of a provider/model route. Compare any two: different models, or the same target before and after.',
      newCheckpoint: 'New fingerprint record',
      provider: 'Provider',
      noProviders: 'No providers available',
      model: 'Model',
      reps: 'Repetitions per cell',
      estimated: 'Estimated',
      requests: 'requests',
      start: 'Start capture',
      starting: 'Starting…',
      refresh: 'Refresh',
      checkpoints: 'Fingerprint records',
      emptyCheckpoints: 'No fingerprint records yet. Capture one above.',
      'status.queued': 'Queued',
      'status.running': 'Running',
      'status.completed': 'Completed',
      'status.completed_with_failures': 'Completed with failures',
      'status.failed': 'Failed',
      validRate: 'Valid rate',
      splitHalf: 'Split-half',
      cellsIncluded: 'Cells',
      cellsUnit: 'cells',
      result: 'Result',
      details: 'Details',
      close: 'Close',
      compareTitle: 'Compare records',
      crossHint: 'Pick any two completed fingerprint records. The operation is the same; the result labels whether they share a target.',
      checkpointA: 'Record A',
      checkpointB: 'Record B',
      selectTwo: 'Select two different completed records.',
      score: 'Difference score (lower = closer)',
      cutoff: 'Cutoff',
      verdict: 'Verdict',
      verdictConsistent: 'Looks like the same model',
      verdictInconsistent: 'Looks like a different model',
      verdictInsufficient: 'Not enough evidence',
      relation: 'Relation',
      relationSame: 'Same target',
      relationDifferent: 'Different target',
      genuine: 'Split-half consistency',
      warnings: 'Warnings',
      cell: 'Cell',
      jsd: 'JSD',
      validA: 'Valid A',
      validB: 'Valid B',
      showAll: 'Show all',
      showLess: 'Show fewer',
      noOff: 'This model cannot disable reasoning; the paper protocol cannot capture it.',
      noOffShort: 'cannot disable reasoning',
      nonReasoning: 'Non-reasoning model; answers directly.',
      incompatibleHint: 'Greyed-out models cannot disable reasoning, so the paper protocol cannot capture them.',
      noCompatibleModels: 'This provider has no model that can disable reasoning.',
      noCompatibleModelsShort: 'No models eligible for capture',
      offAvailable: 'Reasoning will be disabled (off) for capture.',
      effort: 'Reasoning effort',
      started: 'Capture started:',
      error: 'Error',
      topAnswers: 'Top answers',
      included: 'Included',
      valid: 'Valid',
      noModels: 'No models advertised for this provider.',
      noCompleted: 'No completed fingerprint records yet.',
      loading: 'Loading…',
      comparing: 'Comparing…',
      resultCaveat: 'Lower means the two sides are closer. Below the cutoff only means the difference is small, not that it is certainly the same model.',
      terminologyHint: 'A cell is one task × one language. Lower JSD means closer distributions; split-half JSD is internal consistency within one record.',
      defaultRepsHint: 'Paper protocol default 30; UI minimum 10.',
      errorNoReasoning: 'This model cannot disable reasoning and cannot be captured with the paper protocol.',
      errorStillRunning: 'The record is still running; wait for it to finish before deleting.',
      errorRecordNotFound: 'The record no longer exists.',
      errorRecordNeedsFingerprint: 'This record has no completed fingerprint.',
      errorPromptVersionMismatch: 'These records use different prompt versions, so they cannot be compared.',
      errorReasoningPolicyMismatch: 'One record was captured without reasoning disabled, so it cannot be compared.',
      warningFewCells: 'Some cells had fewer than 10 valid samples on both sides; this comparison uses fewer cells.',
      warningReasoning: 'Some responses carried a reasoning trace; the paper protocol requires it disabled.',
      warningCellsIncluded: 'Some cells did not reach 10 valid samples and were excluded.',
      warningSessionPolicy: 'The two records used different session policies; provider routing or caching may differ.',
      warningFullBatteryNeeded: 'The comparison does not cover the full 40-cell battery; no verdict is given.',
      warningRepsNeeded: 'Repetitions per cell are not 30; no verdict is given.',
      verdictNoCells: 'Cannot judge: the two records share no cell with enough valid samples on both sides.',
      verdictPartialBattery: 'Cannot judge: only {cells}/40 cells qualify; the cutoff needs the full 40-cell battery.',
      verdictRepetitions: 'Cannot judge: repetitions per cell are A {a} / B {b}; the cutoff needs 30.',
      protocol: 'Protocol',
      createdAt: 'Created',
      target: 'Target',
      progress: 'Progress',
      a: 'A',
      b: 'B',
      cells: 'cells',
      requestsShort: 'req',
      failed: 'failed',
      distribution: 'Distribution',
      status: 'Status',
      requestsLabel: 'Requests',
      usage: 'Usage',
      closeDetail: 'Close details',
      deleteRecord: 'Delete record',
      deleteConfirmTitle: 'Delete this record?',
      deleteConfirmBody: 'This permanently removes its raw responses and fingerprint. The provider/model configuration is not touched.',
      deleteConfirm: 'Delete permanently',
      deleting: 'Deleting…',
      cancel: 'Cancel',
      deleted: 'Record deleted:',
      deleteRunning: 'This record is still running; wait for it to finish before deleting.',
      recordId: 'Record ID',
      failureReason: 'Failure reason',
      paperReference: 'Paper reference',
      referenceValidity: 'valid rate 97.6% overall, per-model median 99.6%',
      referenceSplitHalf: 'split-half JSD 0.140 for the same model, 0.463 for different models',
      referenceScore: 'The cutoff is 0.280, the 1st percentile of different-model distances: in 100 different models, about 1 would still look the same.',
    };

    const zh = {
      title: 'LLM 指纹鉴别',
      subtitle: '一条指纹记录就是一次完整的论文协议采集：对某个服务商/模型跑一遍 40 个 cell。任选两条比较：不同模型，或同一目标的前后两次。',
      newCheckpoint: '采集新指纹',
      provider: '服务商',
      noProviders: '暂无服务商',
      model: '模型',
      reps: '每 cell 重复次数',
      estimated: '预计',
      requests: '个请求',
      start: '开始采集',
      starting: '启动中…',
      refresh: '刷新',
      checkpoints: '指纹记录',
      emptyCheckpoints: '还没有指纹记录，先在上方采集一次。',
      'status.queued': '排队中',
      'status.running': '运行中',
      'status.completed': '已完成',
      'status.completed_with_failures': '完成但有失败',
      'status.failed': '失败',
      validRate: '有效率',
      splitHalf: '分半 JSD',
      cellsIncluded: '纳入 cell',
      cellsUnit: '个 cell',
      result: '结果',
      details: '详情',
      close: '关闭',
      compareTitle: '对比记录',
      crossHint: '任选两条已完成的指纹记录。比较方式相同，结果会标注它们是否同一目标。',
      checkpointA: '记录 A',
      checkpointB: '记录 B',
      selectTwo: '请选择两条不同的已完成记录。',
      score: '差异分数（越低越像）',
      cutoff: '判定线',
      verdict: '结论',
      verdictConsistent: '看起来是同一个模型',
      verdictInconsistent: '看起来不是同一个模型',
      verdictInsufficient: '证据不足，无法判断',
      relation: '关系',
      relationSame: '同一目标',
      relationDifferent: '不同目标',
      genuine: '分半一致性',
      warnings: '警告',
      cell: 'Cell',
      jsd: 'JSD',
      validA: 'A 有效',
      validB: 'B 有效',
      showAll: '显示全部',
      showLess: '收起',
      noOff: '该模型不支持关闭推理，论文协议无法采集。',
      noOffShort: '不可关闭推理',
      nonReasoning: '非推理模型，直接回答。',
      incompatibleHint: '灰色模型不支持关闭推理，论文协议无法采集。',
      noCompatibleModels: '该服务商没有支持关闭推理的模型，不能用于论文协议。',
      noCompatibleModelsShort: '无符合采集条件的模型',
      offAvailable: '采集时将关闭推理（off）。',
      effort: '推理档位',
      started: '指纹采集已开始：',
      error: '错误',
      topAnswers: '主要答案',
      included: '纳入',
      valid: '有效',
      noModels: '该服务商没有可用模型。',
      noCompleted: '还没有已完成的指纹记录。',
      loading: '加载中…',
      comparing: '对比中…',
      resultCaveat: '分数越低，两边越像。低于判定线只说明差异小，不等于 100% 是同一个模型。',
      terminologyHint: 'cell 是一个任务 × 一种语言；JSD 越低表示答案分布越接近；分半 JSD 是同一条记录内部的一致性。',
      defaultRepsHint: '论文协议默认 30 次；UI 最低 10 次。',
      errorNoReasoning: '该模型不支持关闭推理，不能用论文协议采集。',
      errorStillRunning: '记录还在运行，请等它结束后再删除。',
      errorRecordNotFound: '记录已不存在。',
      errorRecordNeedsFingerprint: '该记录还没有完成的指纹。',
      errorPromptVersionMismatch: '两条记录使用的提示词版本不同，无法比较。',
      errorReasoningPolicyMismatch: '有记录采集时没有关闭推理，无法比较。',
      warningFewCells: '部分 cell 在两侧都没有达到 10 个有效样本，本次比较使用的 cell 较少。',
      warningReasoning: '部分响应带有 reasoning trace；论文协议要求关闭推理。',
      warningCellsIncluded: '部分 cell 未达到 10 个有效样本，已被排除。',
      warningSessionPolicy: '两条记录的会话标识策略不同，服务商路由或缓存行为可能不同。',
      warningFullBatteryNeeded: '本次比较没有覆盖完整的 40 个 cell，因此不给结论。',
      warningRepsNeeded: '每 cell 重复次数不是 30，因此不给结论。',
      verdictNoCells: '无法判断：两条记录没有共同且样本足够的 cell。',
      verdictPartialBattery: '无法判断：只有 {cells}/40 个 cell 可用，判定线需要完整 40 个 cell。',
      verdictRepetitions: '无法判断：每 cell 重复次数是 A {a} / B {b}，判定线对应 30 次。',
      protocol: '协议',
      createdAt: '创建时间',
      target: '目标',
      progress: '进度',
      a: 'A',
      b: 'B',
      cells: 'cells',
      requestsShort: '请求',
      failed: '失败',
      distribution: '分布',
      status: '状态',
      requestsLabel: '请求数',
      usage: 'Token 用量',
      closeDetail: '关闭详情',
      deleteRecord: '删除记录',
      deleteConfirmTitle: '删除这条记录？',
      deleteConfirmBody: '这会永久删除它的原始响应和指纹；不会改动服务商/模型配置。',
      deleteConfirm: '永久删除',
      deleting: '删除中…',
      cancel: '取消',
      deleted: '记录已删除：',
      deleteRunning: '这条记录还在运行，请等它结束后再删除。',
      recordId: '记录 ID',
      failureReason: '失败原因',
      paperReference: '论文参考',
      referenceValidity: '有效率总体 97.6%，模型内中位 99.6%',
      referenceSplitHalf: '同一模型的分半差异通常 0.140，不同模型通常 0.463',
      referenceScore: '判定线是 0.280，取自不同模型距离的 1% 分位：100 个不同模型里，大约只有 1 个会被看成相同。',
    };

    async function api(path, init) {
      const response = await fetch(`${API}${path}`, {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        ...init,
      });
      const text = await response.text();
      let payload = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = { error: text };
      }
      if (!response.ok) throw new Error(payload && payload.error ? payload.error : `HTTP ${response.status}`);
      return payload;
    }

    function fmtPct(value) {
      return value == null ? '—' : `${(Number(value) * 100).toFixed(1)}%`;
    }

    function fmtScore(value) {
      return value == null ? '—' : Number(value).toFixed(4);
    }

    function pad2(value) {
      return String(value).padStart(2, '0');
    }

    function fmtTime(value) {
      if (!value) return '—';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
    }

    function fmtShortTime(value) {
      if (!value) return '—';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      const now = new Date();
      const day = date.getFullYear() === now.getFullYear()
        ? `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
        : `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
      return `${day} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    }

    function shortRecordId(id) {
      return String(id ?? '').slice(-6);
    }

    function friendlyWarning(message, t) {
      const text = String(message ?? '');
      if (/only \d+ cells|fewer cells/i.test(text)) return t('warningFewCells');
      if (/session policy differs/i.test(text)) return t('warningSessionPolicy');
      if (/reasoning trace/i.test(text)) return t('warningReasoning');
      if (/cells reached >=10 valid samples/i.test(text)) return t('warningCellsIncluded');
      if (/session policy differs/i.test(text)) return t('warningSessionPolicy');
      if (/cutoff needs the full battery/i.test(text)) return t('warningFullBatteryNeeded');
      if (/cutoff needs 30/i.test(text)) return t('warningRepsNeeded');
      return text;
    }

    function friendlyError(message, t) {
      const text = String(message ?? '');
      if (/cannot disable reasoning/i.test(text)) return t('errorNoReasoning');
      if (/different prompt versions/i.test(text)) return t('errorPromptVersionMismatch');
      if (/reasoning policy .*only records with reasoning disabled/i.test(text)) return t('errorReasoningPolicyMismatch');
      if (/still running/i.test(text)) return t('errorStillRunning');
      if (/unknown fingerprint record/i.test(text)) return t('errorRecordNotFound');
      if (/no completed fingerprint|two record ids|record id is required/i.test(text)) return t('errorRecordNeedsFingerprint');
      return text;
    }

    function toneColor(tone) {
      if (tone === 'success') return 'var(--dsw-alias-state-success-primary)';
      if (tone === 'error') return 'var(--dsw-alias-state-error-primary)';
      if (tone === 'warn') return 'var(--dsw-alias-state-warn-primary)';
      if (tone === 'brand') return 'var(--dsw-alias-brand-primary)';
      return 'var(--dsw-alias-state-idle-primary)';
    }

    function statusTone(status) {
      if (status === 'completed') return 'success';
      if (status === 'completed_with_failures') return 'warn';
      if (status === 'failed') return 'error';
      if (status === 'running') return 'brand';
      return 'idle';
    }

    function verdictKey(verdict) {
      if (verdict === 'consistent') return 'verdictConsistent';
      if (verdict === 'inconsistent') return 'verdictInconsistent';
      return 'verdictInsufficient';
    }

    /** The verdict line already states coverage and repetition problems; do not repeat them as warnings. */
    function visibleWarnings(comparison) {
      return (comparison.warnings || []).filter((item) => {
        if (comparison.verdictReason === 'partial_battery' && /full battery/i.test(item)) return false;
        if (comparison.verdictReason === 'repetitions' && /threshold needs 30/i.test(item)) return false;
        return true;
      });
    }

    function verdictExplanation(comparison, t) {
      const coverage = comparison.coverage || {};
      if (comparison.verdictReason === 'repetitions') {
        return t('verdictRepetitions')
          .replace('{a}', coverage.repsA ?? '—')
          .replace('{b}', coverage.repsB ?? '—');
      }
      if (comparison.verdictReason === 'partial_battery') {
        return t('verdictPartialBattery').replace('{cells}', coverage.cellsUsed ?? comparison.cellsUsed ?? '—');
      }
      return t('verdictNoCells');
    }

    const S = {
      page: {
        height: '100%',
        overflowY: 'auto',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        padding: '26px 30px 64px',
        boxSizing: 'border-box',
      },
      inner: { maxWidth: '1180px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' },
      header: { display: 'flex', gap: '14px', alignItems: 'center', padding: '2px 2px 4px' },
      title: { margin: 0, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.01em' },
      subtitle: { margin: '4px 0 0', color: 'var(--dsw-alias-label-secondary)', fontSize: '13px', lineHeight: 1.5 },
      card: {
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '14px',
        padding: '16px 18px',
      },
      cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' },
      h2: { margin: 0, fontSize: '15px', fontWeight: 650 },
      hint: { color: 'var(--dsw-alias-label-secondary)', fontSize: '12px', lineHeight: 1.5, margin: '4px 0 0' },
      formGrid: { display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' },
      field: { display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 190px', minWidth: '160px' },
      label: {
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--dsw-alias-label-secondary)',
        fontWeight: 600,
      },
      input: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '8px 10px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: '13px',
        outline: 'none',
      },
      button: {
        border: '1px solid var(--dsw-alias-brand-primary)',
        background: 'var(--dsw-alias-brand-primary)',
        color: 'var(--dsw-alias-bg-base)',
        borderRadius: '8px',
        padding: '8px 14px',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
      },
      buttonSecondary: {
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        borderRadius: '8px',
        padding: '6px 10px',
        fontSize: '12px',
        cursor: 'pointer',
      },
      buttonDanger: {
        border: '1px solid var(--dsw-alias-state-error-primary)',
        background: 'transparent',
        color: 'var(--dsw-alias-state-error-primary)',
        borderRadius: '8px',
        padding: '6px 10px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
      },
      buttonDangerSolid: {
        border: '1px solid var(--dsw-alias-state-error-primary)',
        background: 'var(--dsw-alias-state-error-primary)',
        color: '#fff',
        borderRadius: '8px',
        padding: '7px 12px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
      },
      buttonTiny: {
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        borderRadius: '6px',
        padding: '3px 7px',
        fontSize: '11px',
        cursor: 'pointer',
      },
      iconButton: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        padding: 0,
        borderRadius: '6px',
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        cursor: 'pointer',
      },
      iconButtonDanger: {
        color: 'var(--dsw-alias-state-error-primary)',
        borderColor: 'var(--dsw-alias-state-error-primary)',
      },
      drawerOverlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0, 0, 0, 0.45)',
      },
      drawer: {
        width: 'min(560px, 100vw)',
        height: '100%',
        overflowY: 'auto',
        background: 'var(--dsw-alias-bg-layer-1)',
        borderLeft: '1px solid var(--dsw-alias-border-l2)',
        boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.35)',
        boxSizing: 'border-box',
        padding: '20px 20px 40px',
        color: 'var(--dsw-alias-label-primary)',
      },
      drawerHeader: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '16px',
      },
      drawerEyebrow: {
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--dsw-alias-label-secondary)',
        fontWeight: 600,
      },
      drawerTitle: { margin: '4px 0', fontSize: '18px', fontWeight: 700, lineHeight: 1.3 },
      drawerBody: { display: 'flex', flexDirection: 'column', gap: '12px' },
      overlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
        background: 'rgba(0, 0, 0, 0.55)',
      },
      modal: {
        width: '100%',
        maxWidth: '520px',
        background: 'var(--dsw-alias-bg-overlay)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '14px',
        padding: '20px',
        boxSizing: 'border-box',
        color: 'var(--dsw-alias-label-primary)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
      },
      modalTitle: { margin: 0, fontSize: '17px', fontWeight: 700 },
      modalBody: { margin: '8px 0 0', color: 'var(--dsw-alias-label-secondary)', fontSize: '13px', lineHeight: 1.55 },
      modalMeta: {
        marginTop: '12px',
        padding: '10px 12px',
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '11px',
        color: 'var(--dsw-alias-label-secondary)',
      },
      modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px', flexWrap: 'wrap' },
      disabled: { opacity: 0.5, cursor: 'not-allowed' },
      tableWrap: { overflowX: 'auto', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '10px' },
      table: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
      th: {
        textAlign: 'left',
        padding: '8px 10px',
        color: 'var(--dsw-alias-label-secondary)',
        fontWeight: 600,
        borderBottom: '1px solid var(--dsw-alias-border-l1)',
        whiteSpace: 'nowrap',
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      td: { padding: '8px 10px', borderBottom: '1px solid var(--dsw-alias-border-l1)', verticalAlign: 'top' },
      badge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 7px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        border: '1px solid currentColor',
        whiteSpace: 'nowrap',
      },
      barOuter: { height: '6px', borderRadius: '999px', background: 'var(--dsw-alias-bg-layer-2)', overflow: 'hidden', minWidth: '80px' },
      barInner: { height: '100%', borderRadius: '999px', background: 'var(--dsw-alias-brand-primary)' },
      banner: { borderRadius: '10px', padding: '10px 12px', fontSize: '12px', lineHeight: 1.5, border: '1px solid' },
      errorBanner: {
        background: 'transparent',
        borderColor: 'var(--dsw-alias-state-error-primary)',
        color: 'var(--dsw-alias-state-error-primary)',
      },
      warnBanner: {
        background: 'transparent',
        borderColor: 'var(--dsw-alias-state-warn-primary)',
        color: 'var(--dsw-alias-state-warn-primary)',
      },
      grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' },
      stat: {
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '10px',
        padding: '10px 12px',
      },
      statLabel: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' },
      statValue: { fontSize: '16px', fontWeight: 700, marginTop: '2px' },
      score: { fontSize: '34px', fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1.1 },
      mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '11px' },
      row: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
      muted: { color: 'var(--dsw-alias-label-secondary)', fontSize: '12px' },
      list: { margin: '6px 0 0', paddingLeft: '18px', color: 'var(--dsw-alias-state-warn-primary)', fontSize: '12px', lineHeight: 1.6 },
      sectionGap: { display: 'flex', flexDirection: 'column', gap: '12px' },
    };

    function Mark({ size = 20 }) {
      return h('svg', {
        viewBox: '0 0 64 64',
        width: size,
        height: size,
        'aria-hidden': true,
        style: { display: 'block', flex: 'none' },
      },
        h('rect', {
          x: 11,
          y: 9,
          width: 42,
          height: 46,
          rx: 13,
          fill: 'none',
          stroke: 'var(--dsw-alias-brand-primary)',
          strokeWidth: 3.2,
        }),
        h('g', {
          fill: 'none',
          stroke: 'var(--dsw-alias-brand-primary)',
          strokeWidth: 3.2,
          strokeLinecap: 'round',
        },
          h('path', { d: 'M21 38c0-7 4-12 11-12s11 5 11 12' }),
          h('path', { d: 'M26 41c0-4 2-7 6-7s6 3 6 7' }),
          h('path', { d: 'M32 45v-5' }),
        ),
      );
    }

    function TrashIcon({ size = 14 }) {
      return h('svg', {
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        'aria-hidden': true,
        style: { display: 'block' },
      },
        h('g', {
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
          h('path', { d: 'M4 7h16' }),
          h('path', { d: 'M9 7V4h6v3' }),
          h('path', { d: 'M7 7l1 13h8l1-13' }),
        ),
      );
    }

    function Badge({ tone = 'idle', children }) {
      return h('span', { style: { ...S.badge, color: toneColor(tone) } }, children);
    }

    function Section({ title, right, children, sectionRef }) {
      return h('section', { style: S.card, ref: sectionRef },
        h('div', { style: S.cardHeader },
          h('h2', { style: S.h2 }, title),
          right || null,
        ),
        children,
      );
    }

    function Field({ label, children }) {
      return h('label', { style: S.field },
        h('span', { style: S.label }, label),
        children,
      );
    }

    function Empty({ children }) {
      return h('div', { style: { ...S.muted, padding: '12px 2px' } }, children);
    }

    function Stat({ label, value }) {
      return h('div', { style: S.stat },
        h('div', { style: S.statLabel }, label),
        h('div', { style: S.statValue }, value),
      );
    }

    function Progress({ checkpoint, t }) {
      const total = Number(checkpoint.totalRequests || 0);
      const done = Number(checkpoint.completedRequests || 0);
      const failed = Number(checkpoint.failedRequests || 0);
      const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
      return h('div', {},
        h('div', { style: S.barOuter },
          h('div', { style: { ...S.barInner, width: `${pct}%` } }),
        ),
        h('div', { style: { ...S.mono, marginTop: '4px' } }, `${done}/${total}${failed > 0 ? ` · ${failed} ${t('failed')}` : ''}`),
      );
    }

    function Panel({ t }) {
      const [targets, setTargets] = useState([]);
      const [checkpoints, setCheckpoints] = useState([]);
      const [providerId, setProviderId] = useState('');
      const [modelId, setModelId] = useState('');
      const [reps, setReps] = useState(30);
      const [starting, setStarting] = useState(false);
      const [comparing, setComparing] = useState(false);
      const [deleting, setDeleting] = useState(false);
      const [pendingDelete, setPendingDelete] = useState(null);
      const [error, setError] = useState('');
      const [warning, setWarning] = useState('');
      const [notice, setNotice] = useState('');
      const [a, setA] = useState('');
      const [b, setB] = useState('');
      const [comparison, setComparison] = useState(null);
      const [showAllCells, setShowAllCells] = useState(false);
      const [showAllDetailCells, setShowAllDetailCells] = useState(false);
      const [detail, setDetail] = useState(null);
      const [detailId, setDetailId] = useState('');
      const [compact, setCompact] = useState(false);
      const resultRef = useRef(null);
      const pageRef = useRef(null);

      useEffect(() => {
        const element = pageRef.current;
        if (!element || typeof ResizeObserver === 'undefined') return undefined;
        const update = () => setCompact(element.clientWidth < 780);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
      }, []);

      useEffect(() => {
        if (!pendingDelete && !detail) return undefined;
        const onKey = (event) => {
          if (event.key !== 'Escape') return;
          if (pendingDelete) {
            if (!deleting) setPendingDelete(null);
            return;
          }
          closeDetail();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [pendingDelete, deleting, detail]);

      useEffect(() => {
        let cancelled = false;
        (async () => {
          try {
            const [targetData, checkpointData] = await Promise.all([api('/targets'), api('/checkpoints')]);
            if (cancelled) return;
            const providers = (targetData.providers || []).filter((entry) => (entry.models || []).length > 0);
            setTargets(providers);
            setCheckpoints(checkpointData.checkpoints || []);
            const preferredProvider = providers.find((entry) => (entry.models || []).some((modelEntry) => modelEntry.paperCompatible !== false))
              || providers.find((entry) => (entry.models || []).length > 0);
            if (preferredProvider) {
              const providerModels = preferredProvider.models || [];
              const preferredModel = providerModels.find((entry) => entry.paperCompatible !== false) || null;
              setProviderId(preferredProvider.id);
              setModelId(preferredModel ? preferredModel.id : '');
            }
          } catch (cause) {
            if (!cancelled) setError(friendlyError(cause.message || cause, t));
          }
        })();
        return () => { cancelled = true; };
      }, []);

      useEffect(() => {
        const timer = setInterval(async () => {
          try {
            const data = await api('/checkpoints');
            setCheckpoints(data.checkpoints || []);
          } catch {
            // Polling failures are transient; the last good list stays visible.
          }
        }, 3000);
        return () => clearInterval(timer);
      }, []);

      useEffect(() => {
        if (comparison) resultRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }, [comparison]);

      const provider = useMemo(
        () => targets.find((entry) => entry.id === providerId) || null,
        [targets, providerId],
      );
      const models = provider ? (provider.models || []) : [];
      const model = useMemo(
        () => models.find((entry) => entry.id === modelId) || null,
        [models, modelId],
      );
      const efforts = model ? (model.efforts || []) : [];
      const compatibleModels = models.filter((entry) => entry.paperCompatible !== false);
      const hasIncompatible = models.some((entry) => entry.paperCompatible === false);
      const noCompatibleModels = models.length > 0 && compatibleModels.length === 0;
      const modelCompatible = model ? model.paperCompatible !== false : false;
      const completed = checkpoints.filter((entry) => entry.status === 'completed' || entry.status === 'completed_with_failures');
      const bOptions = completed.filter((entry) => entry.id !== a);

      function changeProvider(next) {
        const nextProvider = targets.find((entry) => entry.id === next) || null;
        setProviderId(next);
        const nextModels = nextProvider ? (nextProvider.models || []) : [];
        const nextModel = nextModels.find((entry) => entry.paperCompatible !== false) || null;
        setModelId(nextModel ? nextModel.id : '');
        setWarning('');
        setNotice('');
      }

      async function start() {
        if (!providerId || !modelId) return;
        if (!modelCompatible) {
          setError(noCompatibleModels ? t('noCompatibleModels') : t('noOff'));
          return;
        }
        setStarting(true);
        setError('');
        setWarning('');
        setNotice('');
        try {
          const created = await api('/checkpoints', {
            method: 'POST',
            body: JSON.stringify({ provider: providerId, model: modelId, reps: Number(reps) }),
          });
          const recordId = created.recordId ?? created.checkpointId;
          setNotice(`${t('started')} ${recordId}`);
          if (created.warnings && created.warnings.length > 0) setWarning(created.warnings.join(' '));
          const data = await api('/checkpoints');
          setCheckpoints(data.checkpoints || []);
          setA(recordId);
          setB('');
          setComparison(null);
        } catch (cause) {
          setError(friendlyError(cause.message || cause, t));
        } finally {
          setStarting(false);
        }
      }

      async function runCompare() {
        if (!a || !b || a === b) {
          setError(t('selectTwo'));
          return;
        }
        setComparing(true);
        setError('');
        try {
          const result = await api('/compare', {
            method: 'POST',
            body: JSON.stringify({ a, b }),
          });
          setComparison(result);
          setShowAllCells(false);
        } catch (cause) {
          setError(friendlyError(cause.message || cause, t));
        } finally {
          setComparing(false);
        }
      }

      async function openDetail(id) {
        setDetailId(id);
        setShowAllDetailCells(false);
        setError('');
        try {
          const data = await api(`/checkpoints/${encodeURIComponent(id)}`);
          setDetail(data);
        } catch (cause) {
          setError(friendlyError(cause.message || cause, t));
        }
      }

      function closeDetail() {
        setDetail(null);
        setDetailId('');
        setShowAllDetailCells(false);
      }

      async function deleteRecord(recordId) {
        if (!recordId) return;
        setDeleting(true);
        setError('');
        try {
          await api(`/checkpoints/${encodeURIComponent(recordId)}`, { method: 'DELETE' });
          setNotice(`${t('deleted')} ${recordId}`);
          setPendingDelete(null);
          if (detail && detail.checkpoint.id === recordId) {
            setDetail(null);
            setDetailId('');
          }
          if (a === recordId) setA('');
          if (b === recordId) setB('');
          if (comparison && (comparison.a.id === recordId || comparison.b.id === recordId)) setComparison(null);
          const data = await api('/checkpoints');
          setCheckpoints(data.checkpoints || []);
        } catch (cause) {
          setError(friendlyError(cause.message || cause, t));
        } finally {
          setDeleting(false);
        }
      }

      const estimate = 40 * Math.max(10, Math.min(100, Number(reps) || 30));

      return h('div', { style: S.page },
        h('div', { style: S.inner, ref: pageRef },
          h('header', { style: S.header },
            h(Mark, { size: 38 }),
            h('div', {},
              h('h1', { style: S.title }, t('title')),
              h('p', { style: S.subtitle }, t('subtitle')),
              h('p', { style: { ...S.hint, marginTop: '6px' } }, t('terminologyHint')),
            ),
          ),

          error ? h('div', { style: { ...S.banner, ...S.errorBanner } }, `${t('error')}: ${error}`) : null,
          warning ? h('div', { style: { ...S.banner, ...S.warnBanner } }, warning) : null,
          notice ? h('div', { style: { ...S.banner, ...S.warnBanner } }, notice) : null,

          h(Section, { title: t('newCheckpoint') },
            h('div', { style: S.formGrid },
              h(Field, { label: t('provider') },
                h('select', {
                  style: S.input,
                  value: providerId,
                  disabled: targets.length === 0,
                  onChange: (event) => changeProvider(event.target.value),
                },
                  targets.length === 0 ? h('option', { value: '' }, t('noProviders')) : null,
                  targets.map((entry) => {
                    const providerHasCompatible = (entry.models || []).some((modelEntry) => modelEntry.paperCompatible !== false);
                    const suffix = (entry.models || []).length > 0 && !providerHasCompatible
                      ? ` · ${t('noCompatibleModelsShort')}`
                      : '';
                    return h('option', { key: entry.id, value: entry.id }, `${entry.name || entry.id}${suffix}`);
                  }),
                ),
              ),
              h(Field, { label: t('model') },
                h('select', {
                  style: S.input,
                  value: modelId,
                  onChange: (event) => setModelId(event.target.value),
                  disabled: models.length === 0 || noCompatibleModels,
                },
                  h('option', { value: '' }, models.length === 0 ? t('noModels') : noCompatibleModels ? t('noCompatibleModelsShort') : '—'),
                  models.map((entry) => {
                    const compatible = entry.paperCompatible !== false;
                    return h('option', {
                      key: entry.id,
                      value: entry.id,
                      disabled: !compatible,
                    }, `${entry.name || entry.id}${compatible ? '' : ` · ${t('noOffShort')}`}`);
                  }),
                ),
              ),
              h(Field, { label: t('reps') },
                h('input', {
                  style: S.input,
                  type: 'number',
                  min: 10,
                  max: 100,
                  value: reps,
                  onChange: (event) => setReps(Math.max(10, Math.min(100, Number(event.target.value) || 30))),
                }),
              ),
              h('button', {
                style: { ...S.button, ...(starting || !modelCompatible ? S.disabled : {}) },
                disabled: starting || !providerId || !modelId || !modelCompatible,
                onClick: start,
              }, starting ? t('starting') : t('start')),
            ),
            h('div', { style: { ...S.hint, marginTop: '10px' } },
              `${t('estimated')}: ${estimate} ${t('requests')} (40 ${t('cellsUnit')} × ${reps})`,
              model ? ` · ${t('effort')}: ${efforts.length > 0 ? efforts.map((entry) => entry.id).join(' / ') : '—'}` : '',
            ),
            h('div', { style: { ...S.hint, marginTop: '4px' } }, t('defaultRepsHint')),
            model
              ? h('div', {
                style: {
                  ...S.hint,
                  color: modelCompatible
                    ? (efforts.length > 0 ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-label-secondary)')
                    : 'var(--dsw-alias-state-warn-primary)',
                },
              }, modelCompatible ? (efforts.length > 0 ? t('offAvailable') : t('nonReasoning')) : t('noOff'))
              : noCompatibleModels
                ? h('div', { style: { ...S.hint, color: 'var(--dsw-alias-state-warn-primary)' } }, t('noCompatibleModels'))
                : null,
            hasIncompatible ? h('div', { style: S.hint }, t('incompatibleHint')) : null,
          ),

          h(Section, {
            title: `${t('checkpoints')}${checkpoints.length > 0 ? ` · ${checkpoints.length}` : ''}`,
            right: h('button', {
              style: S.buttonSecondary,
              onClick: async () => {
                try {
                  const data = await api('/checkpoints');
                  setCheckpoints(data.checkpoints || []);
                } catch (cause) {
                  setError(friendlyError(cause.message || cause, t));
                }
              },
            }, t('refresh')),
          },
            checkpoints.length === 0 ? h(Empty, {}, t('emptyCheckpoints')) : h('div', { style: S.tableWrap },
              h('table', { style: S.table },
                h('thead', {}, h('tr', {},
                  h('th', { key: 'target', style: S.th }, t('target')),
                  h('th', { key: 'status', style: S.th }, t('status')),
                  compact
                    ? h('th', { key: 'result', style: S.th }, t('result'))
                    : [
                      h('th', { key: 'valid', style: S.th }, t('validRate')),
                      h('th', { key: 'split', style: S.th }, t('splitHalf')),
                      h('th', { key: 'cells', style: S.th }, t('cellsIncluded')),
                    ],
                )),
                h('tbody', {}, checkpoints.map((checkpoint) => {
                  const isRunning = ['queued', 'running'].includes(checkpoint.status);
                  const isFailed = checkpoint.status === 'completed_with_failures' || checkpoint.status === 'failed';
                  const cellsValue = checkpoint.cellsIncluded == null
                    ? '—'
                    : `${checkpoint.cellsIncluded}/${checkpoint.cells ?? '?'}`;
                  const resultCell = h('td', { key: 'result', style: { ...S.td, whiteSpace: 'nowrap' } },
                    h('div', {}, `${t('validRate')} ${fmtPct(checkpoint.validRate)}`),
                    h('div', {}, `${t('splitHalf')} ${fmtScore(checkpoint.splitHalfScore)}`),
                    h('div', {}, `${t('cellsIncluded')} ${cellsValue}`),
                  );
                  const statusCell = h('td', { key: 'status', style: S.td },
                    h(Badge, { tone: statusTone(checkpoint.status) }, t(`status.${checkpoint.status}`)),
                    isRunning
                      ? h('div', { style: { marginTop: '6px', minWidth: '110px' } }, h(Progress, { checkpoint, t }))
                      : null,
                    isFailed
                      ? h('div', { style: { ...S.mono, marginTop: '4px', color: 'var(--dsw-alias-label-secondary)' } },
                        `${checkpoint.completedRequests}/${checkpoint.totalRequests}${checkpoint.failedRequests > 0 ? ` · ${checkpoint.failedRequests} ${t('failed')}` : ''}`,
                      )
                      : null,
                  );
                  return h('tr', { key: checkpoint.id },
                    h('td', { key: 'target', style: S.td },
                      h('div', {
                        style: { fontWeight: 600 },
                        title: `${checkpoint.provider}/${checkpoint.model} · ${fmtTime(checkpoint.createdAt)}`,
                      }, `${checkpoint.providerName} / ${checkpoint.modelName}`),
                      h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' } },
                        h('span', { style: S.mono }, `${fmtShortTime(checkpoint.createdAt)} · #${shortRecordId(checkpoint.id)}`),
                        h('button', { style: S.buttonTiny, onClick: () => openDetail(checkpoint.id) }, t('details')),
                        h('button', {
                          style: { ...S.iconButton, ...S.iconButtonDanger, ...(isRunning ? S.disabled : {}) },
                          disabled: isRunning,
                          title: isRunning ? t('deleteRunning') : t('deleteRecord'),
                          'aria-label': t('deleteRecord'),
                          onClick: () => setPendingDelete(checkpoint),
                        }, h(TrashIcon, { size: 13 })),
                      ),
                    ),
                    statusCell,
                    compact ? resultCell : [
                      h('td', { key: 'valid', style: S.td }, fmtPct(checkpoint.validRate)),
                      h('td', { key: 'split', style: S.td }, fmtScore(checkpoint.splitHalfScore)),
                      h('td', { key: 'cells', style: S.td }, cellsValue),
                    ],
                  );
                })),

              ),
            ),
          ),

          h(Section, { title: t('compareTitle') },
            h('p', { style: S.hint }, t('crossHint')),
            completed.length === 0 ? h(Empty, {}, t('noCompleted')) : h('div', { style: { display: 'grid', gridTemplateColumns: '1fr', gap: '12px', maxWidth: '720px' } },
              h(Field, { label: t('checkpointA') },
                h('select', {
                  style: S.input,
                  value: a,
                  onChange: (event) => { setA(event.target.value); setB(''); setComparison(null); },
                },
                  h('option', { value: '' }, '—'),
                  completed.map((entry) => h('option', { key: entry.id, value: entry.id }, `${entry.providerName} / ${entry.modelName} · ${fmtShortTime(entry.createdAt)} · #${shortRecordId(entry.id)}`)),
                ),
              ),
              h(Field, { label: t('checkpointB') },
                h('select', {
                  style: S.input,
                  value: b,
                  onChange: (event) => { setB(event.target.value); setComparison(null); },
                },
                  h('option', { value: '' }, '—'),
                  bOptions.map((entry) => h('option', { key: entry.id, value: entry.id }, `${entry.providerName} / ${entry.modelName} · ${fmtShortTime(entry.createdAt)} · #${shortRecordId(entry.id)}`)),
                ),
              ),
              h('div', { style: { display: 'flex', justifyContent: 'flex-end' } },
                h('button', {
                  style: { ...S.button, ...(comparing ? S.disabled : {}) },
                  disabled: comparing || !a || !b || a === b,
                  onClick: runCompare,
                }, comparing ? t('comparing') : t('compareTitle')),
              ),
            ),
            comparison ? h('div', { ref: resultRef, style: { ...S.sectionGap, marginTop: '16px' } },
              h('div', { style: { ...S.row, alignItems: 'flex-start', gap: '28px' } },
                h('div', {},
                  h('div', { style: S.label }, t('score')),
                  h('div', { style: S.score }, fmtScore(comparison.score)),
                ),
                h('div', {},
                  h('div', { style: S.label }, t('verdict')),
                  h(Badge, { tone: comparison.verdict === 'consistent' ? 'success' : comparison.verdict === 'inconsistent' ? 'error' : 'warn' }, t(verdictKey(comparison.verdict))),
                ),
                h('div', {},
                  h('div', { style: { ...S.label, textTransform: 'none' } }, t('cutoff')),
                  h('div', { style: { fontSize: '18px', fontWeight: 650 } }, comparison.cutoff),
                ),
                h('div', {},
                  h('div', { style: S.label }, t('relation')),
                  h('div', { style: { fontSize: '13px' } }, t(comparison.relation === 'same_target' ? 'relationSame' : 'relationDifferent')),
                ),
              ),
              h('div', { style: S.muted }, `${comparison.a.provider}/${comparison.a.model} #${shortRecordId(comparison.a.id)} ↔ ${comparison.b.provider}/${comparison.b.model} #${shortRecordId(comparison.b.id)} · ${t('genuine')}: A ${fmtScore(comparison.genuineA)} / B ${fmtScore(comparison.genuineB)} · ${comparison.cellsUsed} ${t('cellsUnit')}`),
              comparison.verdict === 'insufficient_evidence'
                ? h('div', { style: { ...S.hint, color: 'var(--dsw-alias-state-warn-primary)' } }, verdictExplanation(comparison, t))
                : null,
              h('div', { style: S.hint }, t('referenceScore')),
              h('div', { style: S.hint }, t('resultCaveat')),
              visibleWarnings(comparison).length > 0
                ? h('ul', { style: S.list }, visibleWarnings(comparison).map((item, index) => h('li', { key: index }, friendlyWarning(item, t))))
                : null,
              h('div', { style: S.tableWrap },
                h('table', { style: S.table },
                  h('thead', {}, h('tr', {},
                    h('th', { style: S.th }, t('cell')),
                    h('th', { style: S.th }, t('jsd')),
                    h('th', { style: S.th }, t('validA')),
                    h('th', { style: S.th }, t('validB')),
                  )),
                  h('tbody', {}, (showAllCells ? comparison.details : comparison.details.slice(0, 12)).map((row) => h('tr', { key: row.cell },
                    h('td', { style: S.td }, h('span', { style: S.mono }, row.cell)),
                    h('td', { style: S.td }, row.jsd),
                    h('td', { style: S.td }, row.validA),
                    h('td', { style: S.td }, row.validB),
                  ))),
                ),
              ),
              comparison.details.length > 12
                ? h('button', { style: S.buttonSecondary, onClick: () => setShowAllCells(!showAllCells) }, showAllCells ? t('showLess') : `${t('showAll')} (${comparison.details.length})`)
                : null,
            ) : null,
          ),
        ),
        detail ? h('div', {
          style: S.drawerOverlay,
          role: 'presentation',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) closeDetail();
          },
        },
          h('aside', {
            style: S.drawer,
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': 'llm-fp-detail-title',
          },
            h('div', { style: S.drawerHeader },
              h('div', {},
                h('div', { style: S.drawerEyebrow }, t('details')),
                h('h2', { id: 'llm-fp-detail-title', style: S.drawerTitle }, `${detail.checkpoint.providerName} / ${detail.checkpoint.modelName}`),
                h('div', { style: S.mono }, `${detail.checkpoint.provider}/${detail.checkpoint.model}`),
              ),
              h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' } },
                h('button', {
                  style: {
                    ...S.buttonDanger,
                    ...(deleting || ['queued', 'running'].includes(detail.checkpoint.status) ? S.disabled : {}),
                  },
                  disabled: deleting || ['queued', 'running'].includes(detail.checkpoint.status),
                  title: ['queued', 'running'].includes(detail.checkpoint.status) ? t('deleteRunning') : t('deleteRecord'),
                  onClick: () => setPendingDelete(detail.checkpoint),
                }, t('deleteRecord')),
                h('button', { style: S.buttonSecondary, onClick: closeDetail }, t('closeDetail')),
              ),
            ),
            h('div', { style: S.drawerBody },
              ['queued', 'running'].includes(detail.checkpoint.status)
                ? h('div', { style: { ...S.hint, color: 'var(--dsw-alias-state-warn-primary)' } }, t('deleteRunning'))
                : null,
              h('div', { style: { ...S.mono, color: 'var(--dsw-alias-label-secondary)' } }, `${t('recordId')}: ${detail.checkpoint.id}`),
              h('div', { style: { ...S.mono, color: 'var(--dsw-alias-label-secondary)' } }, `${t('createdAt')}: ${fmtTime(detail.checkpoint.createdAt)}`),
              detail.checkpoint.fatalError
                ? h('div', { style: { ...S.mono, color: 'var(--dsw-alias-state-error-primary)', wordBreak: 'break-word' } }, `${t('failureReason')}: ${detail.checkpoint.fatalError}`)
                : null,
              detail.checkpoint.warnings && detail.checkpoint.warnings.length > 0
                ? h('ul', { style: S.list }, detail.checkpoint.warnings.map((item, index) => h('li', { key: index }, friendlyWarning(item, t))))
                : null,
              h('div', { style: S.grid2 },
                h(Stat, { label: t('status'), value: t(`status.${detail.checkpoint.status}`) }),
                h(Stat, { label: t('validRate'), value: fmtPct(detail.fingerprint ? detail.fingerprint.validRate : detail.checkpoint.validRate) }),
                h(Stat, { label: t('splitHalf'), value: fmtScore(detail.fingerprint ? detail.fingerprint.splitHalf.score : detail.checkpoint.splitHalfScore) }),
                h(Stat, { label: t('cellsIncluded'), value: detail.fingerprint ? `${detail.fingerprint.cellsIncluded}/${detail.fingerprint.cellCount}` : '—' }),
                h(Stat, { label: t('requestsLabel'), value: `${detail.checkpoint.completedRequests}/${detail.checkpoint.totalRequests}` }),
                h(Stat, { label: t('effort'), value: detail.checkpoint.reasoningEffort || '—' }),
              ),
              h('div', { style: S.hint }, `${t('paperReference')}: ${t('referenceValidity')}; ${t('referenceSplitHalf')}.`),
              detail.fingerprint && detail.fingerprint.cells
                ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                  h('div', { style: S.tableWrap },
                    h('table', { style: S.table },
                      h('thead', {}, h('tr', {},
                        h('th', { style: S.th }, t('cell')),
                        h('th', { style: S.th }, t('valid')),
                        h('th', { style: S.th }, t('topAnswers')),
                        h('th', { style: S.th }, t('included')),
                      )),
                      h('tbody', {}, (showAllDetailCells ? detail.fingerprint.cells : detail.fingerprint.cells.slice(0, 12)).map((cell) => h('tr', { key: cell.cell },
                        h('td', { style: S.td }, h('span', { style: S.mono }, cell.cell)),
                        h('td', { style: S.td }, cell.valid),
                        h('td', { style: S.td }, Object.entries(cell.distribution || {}).sort((left, right) => right[1] - left[1]).slice(0, 3).map(([answer, count]) => `${answer} ×${count}`).join(' · ') || '—'),
                        h('td', { style: S.td }, cell.included ? h(Badge, { tone: 'success' }, t('included')) : h(Badge, { tone: 'idle' }, '—')),
                      ))),
                    ),
                  ),
                  detail.fingerprint.cells.length > 12
                    ? h('button', {
                      style: S.buttonSecondary,
                      onClick: () => setShowAllDetailCells(!showAllDetailCells),
                    }, showAllDetailCells ? t('showLess') : `${t('showAll')} (${detail.fingerprint.cells.length})`)
                    : null,
                )
                : h(Empty, {}, t('loading')),
            ),
          ),
        ) : null,
        pendingDelete ? h('div', { style: S.overlay, role: 'presentation' },
          h('div', {
            style: S.modal,
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': 'llm-fp-delete-title',
          },
            h('h2', { id: 'llm-fp-delete-title', style: S.modalTitle }, t('deleteConfirmTitle')),
            h('p', { style: S.modalBody }, t('deleteConfirmBody')),
            h('div', { style: S.modalMeta },
              h('div', {}, `${t('target')}: ${pendingDelete.providerName} / ${pendingDelete.modelName}`),
              h('div', {}, `${t('recordId')}: ${pendingDelete.id}`),
              h('div', {}, `${t('createdAt')}: ${fmtTime(pendingDelete.createdAt)}`),
            ),
            h('div', { style: S.modalActions },
              h('button', {
                style: { ...S.buttonSecondary, ...(deleting ? S.disabled : {}) },
                disabled: deleting,
                autoFocus: true,
                onClick: () => setPendingDelete(null),
              }, t('cancel')),
              h('button', {
                style: { ...S.buttonDangerSolid, ...(deleting ? S.disabled : {}) },
                disabled: deleting,
                onClick: () => deleteRecord(pendingDelete.id),
              }, deleting ? t('deleting') : t('deleteConfirm')),
            ),
          ),
        ) : null,
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'llm-fingerprint: locale');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({ t }),
        }, Panel));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 30,
          locale: NS,
          label: () => t('title'),
        }, ({ label }) => h(Mark, { size: 18 })));
      },
    };
  },
});
