# iOS simulator log-stream backport

`flutter-ios-log-reader.patch` backports Flutter's official fix
[`c3ed85ef987759ee54a6bce275490cde2a238dc1`](https://github.com/flutter/flutter/commit/c3ed85ef987759ee54a6bce275490cde2a238dc1)
([PR #193142](https://github.com/flutter/flutter/pull/193142),
[issue #181771](https://github.com/flutter/flutter/issues/181771)) to the pinned
Flutter 3.47.7 commit `abaf9c523780a608bd46686fd5e53740a07077f8`.
It includes the upstream implementation and regression tests. Adaptations are
patch context/line offsets and omission of the newer `cpuArch` test-constructor
argument, which does not exist in this pinned SDK. Flutter's BSD license is
retained in the SDK source files.

## Evidence and cause

PR #198 qualification run `39166362985`, attempt 1, macOS job `117790020191`:
bootstatus finished, both simulator builds completed, but zero tests executed.
The 15-minute command limit expired with exit 124. The log-reader error was
printed during that termination, so it alone is not evidence of an earlier
log-process crash. Run `39078072739`, macOS job `117529255264`, passed the same
real Node test. Their artifacts contain identical Flutter/Xcode versions,
simulator inventories, and scaffold hashes; the Node health endpoint was ready
in both. The test harness and generated runner materialization did not change.

The pinned Flutter tool contains the upstream-diagnosed race: the asynchronous
log-reader startup is invoked from a synchronous stream-listener callback,
and application launch does not wait for log capture. The startup VM-service
URL can therefore be emitted before capture begins, leaving discovery waiting
forever. The old nonverbose logs cannot prove the precise scheduling of that
failed launch, but the affected source, failure boundary, unchanged successful
case, and upstream deterministic regression tests support this targeted fix.

The backport waits for the log stream's first output before `simctl launch`.
It is applied only to the macOS qualification SDK, after verifying the original
commit and before its first tool snapshot is built. The SDK base commit stays
pinned; evidence also records the applied patch hash and complete SDK diff.
The workflow runs the three upstream launch-ordering tests before qualification
and enables verbose iOS integration logs for future transport diagnosis.

No retry or additional integration time is introduced. Simulator readiness,
real Node `ok:1`, the five-minute test limit, 15-minute integration command
limit, 60-minute job limit, Android qualification, and unsigned iOS release
package evidence remain enforced. Remove this backport when the pinned official
SDK contains the upstream fix; do not apply it silently to a different SDK.
