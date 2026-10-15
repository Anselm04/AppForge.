# AppForge runtime evidence matrix

This companion to `current-state-capability-matrix.md` prevents generated-product stack maturity from being confused with compiler/runtime maturity. A runtime may be proven runnable while a product stack that uses it remains structural.

| Runtime / toolchain | Adapter state | Existing evidence | What is not yet justified | Engineering rule |
| --- | --- | --- | --- | --- |
| Node.js | `verified` | Discovery, install, build, runtime, packaging, deployment, tests, security scan and behavioral evidence are declared by the compiler-runtime adapter and exercised throughout existing Node product paths | `production-certified` still requires reproducible-build evidence under the adapter promotion contract | Treat Node as the mature reference; do not rebuild its runtime infrastructure |
| Python | `runnable` | Real host probe verifies Python/version discovery, pip, venv creation, local package install, compileall, fixture execution, unittest and HTTP service health; evidence ledger IDs are retained and `lastVerifiedAt` is recorded | Packaging, remote deployment, security/behavioral certification and reproducible production evidence | Do **not** rebuild the Python runtime. Connect the already-runnable runtime to generated-product packaging/deployment/certification |
| Rust | conservative/default adapter state | Rustup/cargo install/build/test/runtime commands and security-check contract exist | Fresh host provisioning/build/test/runtime/package/deploy evidence | Extend the existing runtime adapter; do not create a second Rust subsystem |
| Flutter | qualification-driven partial maturity | Official pinned Flutter 3.47.7 identity, dependency resolution, widget tests and trusted web compilation have fresh evidence | Full Android/iOS trusted-runtime evidence, packaging/deployment, generated-product behavior and reproducibility | Promote only from retained qualification evidence |
| Android SDK / Gradle | qualification-driven partial maturity | Existing mobile toolchain adapter plus free hosted-runner SDK/Java/Gradle environment | APK/emulator/install/launch/backend interaction until the active qualification gate passes; release signing/AAB/Play remain separate | Fail closed; never auto-accept external agreements to make the gate green |
| Xcode / iOS | qualification-driven partial maturity | Existing Xcode adapter plus legitimate macOS/Xcode runner and passing pre-native Flutter/Node stages | Simulator interaction until active gate passes; archive/export/signing/App Store remain separate | Never infer iOS production support from Linux/static analysis |

## Evidence sources in the repository

- `src/lib/externalTechnologyAdapters_COMPILER_RUNTIMES.ts` is the current compiler/runtime registry.
- `src/lib/pythonRuntimeProbeOrchestration.ts` performs the Python host probe and derives evidence rather than assuming it.
- `src/lib/adapterSdk.ts` defines the evidence requirements and state promotion rules.
- `.github/workflows/flutter-node-qualification.yml` produces trusted Flutter/native evidence; a green fixture is scoped to the exact runner/toolchain/scaffold it exercised.

## Python distinction

`python-service` and `ai-agent-python` remain `structural` in the **generated product stack registry**. That does not mean Python itself is structural. The Python **runtime adapter is already `runnable`**, so the remaining work is to connect generated Python products to packaging, deployment, security/behavior verification and certification rather than reimplement Python provisioning from scratch.
