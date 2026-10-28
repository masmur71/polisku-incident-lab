# Validation record — 28 October 2026

Implementation: local branch codex/local-lab-hardening, runtime commit 8590919. No remote push or GCP deployment.

- Docker image build (Node 20): passed.
- TypeScript noEmit: passed.
- Jest + PostgreSQL: 11 tests passed; successful claims asserted and test rows cleaned by ID.
- verify-lab.js: five scenarios passed in run 09-26 after replacing fixed alert sleep with bounded firing polling. A prior failed run and successful automatic recovery are retained.
- promtool check: six rules valid; promtool normal/abnormal tests passed (heap, disk, target availability).
- Baseline: three profiles completed with zero connection errors, timeouts and non-2xx responses. JSON records samples and environment; results are a single-machine run, not a production capacity guarantee.
- Production npm audit: zero vulnerabilities at validation time. Six low development-only findings remain outside production image.
- JSON, SVG and Markdown link checks passed. PowerShell parser and Linux shell syntax checks passed.

Heap firing in this final configuration was tested synthetically, not forced live. Windows host metrics, external notifications, independent fresh-clone walkthrough, recorded demo and cloud deployment remain pending. Tutorial/agent files, raw logs and heap snapshots remain ignored locally.
