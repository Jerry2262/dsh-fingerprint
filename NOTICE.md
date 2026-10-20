# Attribution and sources

The plugin code in this repository is MIT licensed; see [LICENSE](LICENSE).

This plugin implements the fingerprint protocol from:

- Tomáš Bruckner, *One Token Is Enough: Fingerprinting and Verifying Large Language Models from Single-Token Output Distributions*, arXiv:2607.10252, 2026. <https://arxiv.org/abs/2607.10252>

The prompt battery (`prompts.json`, the ten paper-1 tasks and four system prompts) is taken from the released artifact:

- Code and prompts: <https://zenodo.org/records/21278793> (`config/prompts.json`), MIT license.
- Data and published statistics: <https://zenodo.org/records/21278557>, CC-BY-4.0.

Attribution: Tomáš Bruckner. The normalization code is a direct port of the released `stats/01-normalize.js`; the threshold `TAU = 0.356` is recomputed from the released full-battery split-score trials at the equal-error point.
