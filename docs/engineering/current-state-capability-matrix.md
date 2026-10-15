# AppForge current-state capability matrix

Evidence snapshot for the autonomous-product-factory programme. This document distinguishes repository structure from reproducible execution evidence and must not be used to promote a capability beyond the evidence ledger/runtime gates.

Baseline production branch inspected before this programme: `main` at `694595813da869b33c6cd16f5a589fb998eb545`. Contract/recovery correctness was subsequently merged to `main`; the Flutter + Node work remains independently gated until its exact-head checks complete.

Status vocabulary follows AppForge's adapter maturity model: `unsupported -> discovered -> experimental -> structural -> buildable -> runnable -> packageable -> deployable -> verified -> production-certified`.

## Core factory

| Capability | Existing implementation / connection | Evidence-backed state | Proven / not proven | Golden Product #1 | Next engineering action |
| --- | --- | --- | --- | --- | --- |
| Prompt intake and product-type detection | `src/lib/productContract.ts` and generation/build routes | VERIFIED EXISTING | Product intent/product type are parsed and carried into the canonical contract; full arbitrary-prompt semantic correctness is not assumed | Yes | Keep covered by contract regression tests |
| Canonical ProductContract | `src/lib/productContract.ts`, build jobs, generator/deployer/self-healing paths | VERIFIED EXISTING | Explicit requirements/prices now fail closed rather than being silently dropped | Yes | Preserve exact contract through every new mobile/runtime path |
| Stack selection | Product contract + `src/lib/stackAdapters.ts` | VERIFIED EXISTING | Registered stacks resolve deterministically; unsupported stacks fail instead of silently becoming another stack | Yes | Add promotion evidence, not duplicate selection logic |
| Product planning / specialist agents | Existing planner/designer/coder/testing/validator/research orchestration | VERIFIED EXISTING | Repository CI exercises plan/research/generated-project gates | Yes | Reuse for Golden Product; do not hardcode restaurant behavior |
| Live research / failure dossier / repair and redesign | Existing research, failure-dossier and self-healing/outer-loop services | VERIFIED EXISTING | Factory validation covers these control paths; success still depends on runtime-specific evidence | Yes | Feed native/runtime failures back through the existing loop |
| Isolation / sandbox | Existing Docker/build-host isolation, unique build identity and safety checks | VERIFIED EXISTING | Exact-head CI proves real isolated Docker build plus host syscall/registry boundaries | Yes | Extend the same isolation model to native runners; do not create a second sandbox |
| Artifact integrity | Existing snapshots/hashes/recovery checkpoints/release manifests | VERIFIED EXISTING | CI validates release-artifact integrity and recovery governance | Yes | Attach native APK/iOS evidence identities to the same evidence model |
| Recovery | Existing snapshot/checkpoint/database/queue recovery controls | PARTIALLY IMPLEMENTED | Recovery truth is now fail-closed; a saved checkpoint alone is not called a verified restore | Yes | Continue real restore/reopen proofs for generated products |
| Certification | Adapter SDK/evidence requirements and product certification gates | VERIFIED EXISTING | Promotion rules exist and require progressively stronger evidence | Yes | Feed trusted native evidence into promotion only after reproducible qualification |
| Deployment | Existing Fly/Vercel/provider infrastructure | VERIFIED EXISTING for existing web/service paths; PARTIAL globally | AppForge's own build/deploy gates are mature; not every generated stack has deployment evidence | Yes | Add deployment/release evidence per generated-product stack |

## Registered product stacks

The stack registry is the authoritative source for whether a generated stack is currently declared `runnable` or only `structural`. Those labels are not equivalent to production certification.

| Stack | Registry mode | Current evidence classification | What is actually proven | Golden Product #1 | Next action |
| --- | --- | --- | --- | --- | --- |
| React + Node | runnable | VERIFIED EXISTING | Build/start/deploy paths are integrated into existing factory tests | No | Preserve as reference implementation |
| Static HTML/CSS/JS | runnable | VERIFIED EXISTING | Build/preview/deploy targets registered | No | Preserve |
| Next.js + Node | runnable | VERIFIED EXISTING | Build/start/deploy targets registered and exercised by existing Node/web infrastructure | No | Preserve |
| Phaser | runnable | VERIFIED EXISTING at web-stack level | Web build path exists; broad gameplay certification remains separate | No | Add gameplay/package evidence when game Golden Product begins |
| Three.js | runnable | VERIFIED EXISTING at web-stack level | Web build path exists; broad 3D behavioral certification remains separate | No | Add behavior/performance evidence later |
| Browser automation | runnable | VERIFIED EXISTING | Node service execution path registered | No | Preserve; browser-provider credentials remain integration-specific |
| Data visualization | runnable | VERIFIED EXISTING at web-stack level | Vite/web build path registered | No | Preserve |
| Node API service | runnable | VERIFIED EXISTING | Build/start service path | Backend reference | Preserve |
| Node service | runnable | VERIFIED EXISTING | Build/start service path | Backend reference | Preserve |
| Node AI agent | runnable | VERIFIED EXISTING at runtime level | Node build/start path | No | Add provider-specific behavior evidence per product |
| Python service | structural | PARTIALLY IMPLEMENTED | Source/build commands exist; registry intentionally does not call it runnable | No | Provision/run/package/deploy a trusted Python fixture before promotion |
| Python AI agent | structural | PARTIALLY IMPLEMENTED | Structural source/runtime contract only | No | Same Python execution lane plus provider behavior evidence |
| React Native / Expo | structural | PARTIALLY IMPLEMENTED | Source/build commands and EAS target declared; no native execution certification | No | Defer until Flutter flagship is stable |
| Flutter + Firebase | structural | PARTIALLY IMPLEMENTED | Source/build commands declared; not sufficient native proof | No (superseded for flagship) | Do not duplicate; retain as alternate target |
| Flutter + Node | structural | PARTIALLY IMPLEMENTED | Shared API contract, Node backend fixture, Flutter dependency/test/web build evidence exist; native qualification is gated separately | **Yes** | Complete iOS and Android trusted-runtime qualification, then auth/persistence |
| Electron + React | structural | PARTIALLY IMPLEMENTED | Package/build commands declared only | No | Add Windows/macOS/Linux package + launch fixtures later |
| Tauri + Rust | structural | PARTIALLY IMPLEMENTED | Rust/Tauri structure and commands declared only | No | Add toolchain/build/package/launch evidence later |
| Chrome extension MV3 | structural | PARTIALLY IMPLEMENTED | Manifest/build/store target declared only | No | Add load-in-Chromium + behavior + package evidence later |
| Docker Compose infrastructure | structural | PARTIALLY IMPLEMENTED | Compose contract declared; no arbitrary generated-stack production certification | No | Add isolated compose fixture and health evidence later |
| Kubernetes + Helm | structural | PARTIALLY IMPLEMENTED | Helm lint/install contract declared only | No | Add local disposable-cluster lint/render/install evidence later |

## Mobile / desktop toolchains

| Toolchain | Existing implementation | Current maturity | Proven / declared | Golden Product #1 | External blocker |
| --- | --- | --- | --- | --- | --- |
| Flutter SDK | External technology adapter plus pinned official 3.47.7 qualification workflow | buildable evidence for trusted shell; broader target remains PARTIAL | Official release identity, dependency resolution and Flutter tests are reproducibly proven on the trusted fixture | Yes | No for fixture |
| Android SDK / Gradle | Existing `android-sdk-gradle` adapter; trusted Flutter workflow now extends it | discovered/structural until emulator run passes | SDK/Gradle commands were previously declarative; new lane must prove APK, emulator, install, launch and interaction | **Yes** | Accepted SDK/license state or runner virtualization can become external dependency; never auto-accept agreements |
| Xcode / iOS | Existing Xcode adapter; legitimate GitHub macOS/Xcode qualification lane | structural/buildable candidate until exact native job passes | Node/Flutter shell stages pass; iOS simulator build/interaction must complete before stronger claim | **Yes** | Signing/provisioning/App Store credentials for release |
| Rust | Existing Tauri/toolchain abstractions | PARTIALLY IMPLEMENTED | No broad package/runtime certification recorded here | No | Platform toolchain availability as applicable |
| Electron | Stack adapter exists | PARTIALLY IMPLEMENTED | Structural only | No | Signing/notarization for distribution later |
| Tauri | Stack adapter exists | PARTIALLY IMPLEMENTED | Structural only | No | Signing/notarization later |

## Game engines

`src/lib/externalTechnologyAdapters_GAME_ENGINES.ts` already defines Unreal, Unity and Godot installation/build/test/package contracts. These are therefore not missing adapter concepts, but they start conservatively and are not production-certified merely because descriptors exist.

| Engine | Current classification | Evidence gap / blocker |
| --- | --- | --- |
| Godot | PARTIALLY IMPLEMENTED / discovered | Provision headless editor/export templates, build trusted project, run tests/runtime, export package reproducibly |
| Unity | PARTIALLY IMPLEMENTED / discovered | Requires legitimate Unity Hub/editor installation and licensing; then compile/playmode/build-target evidence |
| Unreal | PARTIALLY IMPLEMENTED / discovered | Requires legitimate Epic/source access/toolchain provisioning; then compile/cook/package evidence |
| Phaser | VERIFIED EXISTING at web-stack build level | Gameplay smoke/asset/export certification still separate |
| Three.js | VERIFIED EXISTING at web-stack build level | 3D behavior/performance evidence still separate |

## Embedded / hardware

`src/lib/externalTechnologyAdapters_HARDWARE_TOOLCHAINS.ts` already declares Arduino and ESP32/ESP-IDF toolchains. Do not recreate them.

| Target | Current classification | Evidence gap / blocker |
| --- | --- | --- |
| Arduino | PARTIALLY IMPLEMENTED / discovered | Provision `arduino-cli` + board core, compile trusted sketch; physical upload/board detection requires hardware |
| ESP32 | PARTIALLY IMPLEMENTED / discovered | Provision ESP-IDF, compile trusted firmware; real flash/runtime requires hardware |
| Raspberry Pi / Linux ARM | MISSING from current searched adapter registry | Add only after confirming no hidden adapter; cross-build/emulated Linux ARM can precede physical-device proof |

## Platform target matrix

| Platform family | Current classification | Notes |
| --- | --- | --- |
| Web / Chromium-class output | VERIFIED EXISTING for registered web stacks | Existing production/preview build infrastructure provides real execution evidence; Safari/Firefox-specific behavior remains per-product testing |
| Linux | VERIFIED EXISTING as AppForge build/runtime host; generated desktop packaging PARTIAL | Native Linux desktop-package evidence remains stack-specific |
| Windows | PARTIALLY IMPLEMENTED | Desktop adapters exist; no general Windows package/launch certification claimed |
| macOS | PARTIALLY IMPLEMENTED | macOS runner/Xcode evidence exists for native qualification; generated desktop package/notarization is separate |
| Android | PARTIALLY IMPLEMENTED | Real emulator/APK qualification is actively gated; no production claim until it passes |
| iPhone/iPad | PARTIALLY IMPLEMENTED | Legitimate Xcode simulator qualification; signing/archive/store path still separate |
| watchOS / Wear OS | MISSING as production-certified generated targets | Add only after flagship mobile architecture and native capability system are stable |
| tvOS / Android TV / Google TV / Fire TV | MISSING as production-certified generated targets | Future platform adapters/runners needed |
| visionOS / XR | MISSING as production-certified generated target | Requires legitimate Apple/Xcode support and dedicated behavior proof |
| Browser extensions | PARTIALLY IMPLEMENTED | MV3 structural adapter; load/runtime/store evidence missing |
| Embedded / IoT | PARTIALLY IMPLEMENTED | Arduino/ESP32 descriptors exist; execution/device evidence missing |
| Xbox / PlayStation / Nintendo | EXTERNAL BLOCKER / unsupported for production certification | No proprietary SDK evidence found. Do not claim support without lawful developer-program/SDK access |

## Golden Product capability matrix

| Capability | Current classification | Evidence / gap | Next exact action |
| --- | --- | --- | --- |
| Authentication | VERIFIED EXISTING for AppForge itself; MISSING in generated Flutter+Node shell | Shared contract explicitly says generated auth is not implemented | Reuse existing auth/Supabase architecture behind generated backend; prove signup/verify/login/logout/relogin/session |
| Database persistence | VERIFIED EXISTING platform foundation; MISSING in generated flagship shell | Existing AppForge PostgreSQL/Supabase systems exist, but Flutter+Node fixture has no product DB | Generate migrations automatically and enforce owner-scoped RLS/API authorization; prove persistence without manual table creation |
| Billing / subscriptions / credits | VERIFIED EXISTING for AppForge; MISSING in generated flagship | Stripe infrastructure exists but must not be silently reused as another product's live billing | Add generated-product billing adapter with test-mode evidence and explicit product/account isolation |
| Storage / uploads | PARTIALLY IMPLEMENTED platform-wide | Needs generated-product contract + security/runtime evidence | Reuse storage adapters and add owner-scoped upload test |
| External APIs / webhooks | VERIFIED EXISTING architecture | Provider-specific runtime evidence remains per integration | Add authorized reservation provider boundary only when credentials/sandbox are legitimate |
| Email | PARTIALLY IMPLEMENTED | AppForge has email/auth flows; generated-product reusable evidence not certified | Connect generated notification capability and test sandbox delivery |
| SMS | PARTIALLY IMPLEMENTED | Existing Twilio/admin path exists but historical production SMS proof was incomplete | Keep separate from flagship unless required; do not call verified without live challenge evidence |
| Push notifications | MISSING for generated flagship | No production-certified reusable Flutter push capability found in audit | Add through existing adapter/capability architecture; test device/emulator path where provider permits |
| Background jobs / scheduled monitoring | VERIFIED EXISTING infrastructure concepts; MISSING for generated flagship | AppForge has durable queue/single-writer patterns; generated reservation-watch worker not implemented | Reuse queue/idempotency model and prove restart/deduplication behavior |
| Analytics | PARTIALLY IMPLEMENTED | AppForge analytics infrastructure exists; generated product instrumentation not certified | Add privacy-conscious event contract + runtime evidence |
| Search/maps | PARTIALLY IMPLEMENTED / provider-specific | External service selection and credentials depend on product | Add only when Golden Product needs provider features |
| Voice / speech recognition | MISSING for generated flagship | No reusable certified native module found | Add Flutter capability adapter with permissions, speech provider/platform tests |
| Text-to-speech | MISSING for generated flagship | No reusable certified module found | Add TTS adapter and behavior test |
| Siri/App Intents / Android voice actions | MISSING | Requires platform-native implementation and legitimate native test lanes | Add after base speech/TTS works |
| Deep links | MISSING for generated flagship evidence | Needs native config + notification-to-screen behavior proof | Add reusable capability module and emulator/simulator tests |
| Camera/photos/mic/audio/GPS/background location/Bluetooth/biometrics/contacts/calendar/widgets/Live Activities | MISSING or unverified as reusable production-certified modules | Do not infer support from Flutter's ability to compile | Add one reusable capability contract at a time only when required by a product class |
| Professional UI/assets/landing page | PARTIALLY IMPLEMENTED | AppForge has design/generation infrastructure; Golden Product visual quality still requires actual generated-product evidence | Exercise through normal factory prompt, not hidden template |
| Source export | VERIFIED EXISTING infrastructure | Must remain tied to exact artifact identity | Include exported source in Golden Product certification |
| Deployment/release | PARTIALLY IMPLEMENTED globally | Web/backend deployment infrastructure exists; Android/iOS release paths are not yet certified | APK/AAB/signing and iOS archive/provisioning evidence after runtime foundation |

## Shortest dependency path to Golden Product #1

1. Finish exact-head Flutter + Node qualification and merge only when all gates are green.
2. Prove Android SDK -> APK -> emulator -> install -> launch -> real Node-backend interaction; retain evidence and keep claims fixture-scoped.
3. Add generated-product authentication + persistence through the shared Flutter/Node contract, reusing existing AppForge/Supabase security architecture.
4. Add background watch workers with durable single-writer/idempotency behavior.
5. Add push notifications + deep links.
6. Add speech recognition + TTS + explicit voice confirmation.
7. Add isolated generated-product Stripe test-mode payments/entitlements and account/subscription management.
8. Add an authorized reservation-provider adapter. If partner/API credentials are unavailable, mark that integration `EXTERNAL BLOCKER` while continuing every independent step.
9. Add Android release packaging and Apple archive/export/signing-preflight paths without fabricating store access.
10. Run the plain-English Golden Product prompt through normal intake -> contract -> stack selection -> research -> plan -> agents -> build -> validation -> repair/redesign -> certification, and require requirement-linked implementation/test/runtime evidence before PASS.
