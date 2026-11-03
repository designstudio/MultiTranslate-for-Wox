# MultiTranslate for Wox

[![Release](https://img.shields.io/github/v/release/designstudio/MultiTranslate-for-Wox)](https://github.com/designstudio/MultiTranslate-for-Wox/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Multi-provider translation for [Wox 2](https://github.com/Wox-launcher/Wox). Query once, compare every translator at the same time — Google, Microsoft/Bing, DeepL, Youdao, Tencent, Transmart, Caiyun, Volcengine and more.

> Community port inspired by [Lu-Jiejie's MultiTranslate for Flow Launcher](https://github.com/Lu-Jiejie/flow-launcher-multi-translate), adapted for Wox 2. Not affiliated with the original author or with any translation provider.

## Features

- **One query, many providers** — every enabled translator returns a separate result, side by side.
- **Auto-detection** of the source language; target language from the query or the plugin settings.
- **`Enter` copies the translation**, action menu copies the original text.
- Localized UI (English / Portuguese), follows the Wox language.
- Per-provider icons with light/dark theme variants.
- **Self-healing list**: providers failing repeatedly in a session are hidden automatically and can be shown again with one keystroke.
- Error tooltips document each provider's known limitations.

## Install

1. Download `MultiTranslate-for-Wox-<version>.wox` from the [latest release](https://github.com/designstudio/MultiTranslate-for-Wox/releases/latest).
2. Open the file with Wox (2.4.5 or newer) — done.

## Usage

| Query | Result |
|---|---|
| `tr I love this app` | auto-detected source → default target (pt_br) |
| `tr >en Bom dia` | → English |
| `tr en>pt_br Hello` | explicit English → Brazilian Portuguese |
| `tr fr Bonjour` | → French |
| `tr ` (with space) | quick language pair suggestions |

Press `Enter` on a result to copy the translation.

## Settings (Wox → Plugins → MultiTranslate)

- **Translation mode**: configured direction, or automatic Chinese ↔ English.
- **Source / target language**: `auto` / `pt_br` by default; any supported code (`en`, `es`, `ja`, `pt_pt`…).
- **Providers**: one per line, e.g. `google`, `bing`, `deepl`, `youdao`, `tencent`, `transmart`, `caiyun`, `volcengine`, `deeplx`, `mtranserver`, `openai`.
- **Quick language pairs**: one `source>target` per line.
- **Timeout / delay** and optional credentials: `deepl_key` (official API), `deeplx_url`, `mtran_url`/`mtran_token`, OpenAI-compatible server settings.

## Provider status (live-verified 2026-10)

| Provider | Status | Notes |
|---|---|---|
| Google Translate | ✅ | Unofficial web endpoints; may rate-limit. |
| Microsoft/Bing | ✅ | Unofficial Edge endpoint. |
| Caiyun | ✅ | Unofficial token; zh-anchored pairs are the most reliable. |
| Volcengine | ✅ | Unofficial endpoint. |
| DeepL | ⚠️ | Keyless web endpoint is heavily rate-limited (HTTP 429) — one retry, then a clear message. For stable use, set an official `deepl_key` (or use `deeplx`/`mtranserver`). |
| Youdao | ✅ / ⚠️ | Works for most pairs (`pt→en`, `en→es`, `auto→en`…). `en→pt` is no longer accepted by Youdao (code 40). |
| Tencent | ⚠️ | The free WeChat endpoint only honors **X→zh** (simplified) and **zh→X**; other pairs are refused up front instead of silently returning Chinese. |
| Transmart | ⚠️ | API works, but the server's TLS certificate expired on 2026-10-11 — until Tencent renews it, requests fail with a clear server-side error. |

All embedded endpoints are unofficial and can change without notice. Translated text is sent to the enabled providers.

## Development

```bash
node test.js        # 37 automated tests with mocked responses (no network)
node test-live.js   # real integration tests against the live services
python build.py     # builds dist/MultiTranslate-for-Wox-<version>.wox and validates it
```

Mocked tests prove the parsing/error logic; only `test-live.js` proves a provider actually works on the internet. Please keep the two separated when contributing.

## Changelog

### v0.3.8 — Cleaner list, documented limitations
- Providers failing 3 consecutive times in a session are hidden automatically (success resets the counter); a summary item with **Show again** restores them.
- Error results carry a markdown preview (tooltip) with the provider, requested direction, the error and a "Known limitations" section.

### v0.3.7 — Providers fixed and diagnosed
- **Youdao**: updated to the current web client signature (`keyid webfanyi-key-getter-2025`, `appVersion 12.0.0`, new base fields) — translations work again; unsupported pairs (e.g. `en→pt`, code 40) now surface a clear message.
- **Tencent**: the free endpoint's real capabilities are enforced (X→zh, zh→X); the returned language is verified so a Chinese result is never shown for a `pt_br` request.
- **DeepL**: single retry on HTTP 429 with a clear message afterwards; official-key path now maps 401/403 (invalid key) and 456 (quota) distinctly.
- **Transmart**: TLS/certificate failures are diagnosed (`CERT_HAS_EXPIRED` on transmart.qq.com) instead of a generic `fetch failed`.
- `fetchData` unwraps TLS/DNS/timeout errors for all providers.

### Earlier
- v0.3.6 — theme-aware provider icons (light/dark via Wox `GetThemeColors`).
- v0.3.5 — local SVG icons preferred over remote PNGs.
- v0.3.2 — per-provider icons.
- v0.3.1 — minimal result UI with side preview.
- v0.3.0 — Wox interface language localization (en_US / pt_BR).

## Security note

This plugin contains **no credentials**. User-provided keys (`deepl_key`, `openai_api_key`, `mtran_token`…) live only in the Wox plugin settings and are never hardcoded or logged.

A few hardcoded identifiers (e.g. the WeChat mini-program AppID `wxb1070eabc6f9107e` in the Tencent `Referer` header) are **public protocol constants** required by the unofficial endpoints. They are inherited verbatim from the upstream [flow-launcher-multi-translate](https://github.com/Lu-Jiejie/flow-launcher-multi-translate) project, are public by design, and grant no access on their own. GitHub secret scanning may flag the WeChat AppID pattern — that alert is a false positive.

## Credits & license

Original translation adapters and design: **Lu-Jiejie** (2024), MIT — see [LICENSE](LICENSE). Wox 2 adapter, provider fixes, tests and packaging: community contribution. Please retain the attribution when distributing.
