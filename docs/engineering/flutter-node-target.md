# Flutter + Node target

`flutter-node` extends the existing stack registry and generation pipeline. Its maturity is **structural**, with no deployment target or native certification. Explicit Flutter + Node requests select it; ordinary mobile defaults remain unchanged.

The artifact contains a Flutter client at `lib/`, a TypeScript backend at `server/src/`, and one public API contract at `shared/contracts/product-api.json`. Flutter bundles that contract as an asset; the backend loads it at startup. Backend build output belongs to `build/server/`. Root Node scripts and separate Flutter scripts keep component checks distinct.

The infrastructure shell supplies health transport and a consistent error envelope. It does not supply product behavior, authentication, a database, or reservation integrations. The contract explicitly marks authentication as unimplemented. Product generation must implement these requirements, and scaffold merging does not fill missing product entrypoints with a generic application.

Flutter configuration merging preserves product dependencies and assets while adding required infrastructure entries. Structural validation rejects disconnected manifests and malformed shared contracts. Backend startup contracts are checked separately from the primary mobile runtime. Source checks are not runtime certification.

The scaffold regression test compiles a trusted backend fixture, starts it with a filtered environment, and makes real HTTP requests. It also checks malformed-contract startup failure. This evidence applies to that backend fixture only. It does not authorize running arbitrary generated code outside the existing isolation boundary or prove a customer journey.

Remaining qualification includes Dart tests, paired client/backend execution, native builds, Android emulator interactions, legitimate macOS/Xcode execution, isolated composite execution, authentication and persistence, release artifacts, and requirement-linked behavior. A successful backend build must never substitute for these checks. Generated backend credentials remain server-side; only the public API address belongs in the Flutter configuration. Production mobile requests must use HTTPS.
