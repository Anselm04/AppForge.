import type { TechnologyAdapterDescriptor } from "./adapterSdk.js";
import { adapter } from "./externalTechnologyAdapterHelpers.js";

export const HARDWARE_TOOLCHAINS: TechnologyAdapterDescriptor[] = [
  adapter({
    id: "arduino-toolchain",
    label: "Arduino",
    category: "hardware_toolchain",
    supportedVersions: ["arduino-cli 1.x"],
    latestCompatibleStableVersion: "arduino-cli 1.x",
    supportedPlatforms: ["embedded"],
    supportedArchitectures: ["arm"],
    installation: {
      method: "arduino-cli core install",
      requiresProvisioning: true,
      requiredToolchain: ["arduino-cli", "board core package"],
    },
    authentication: {
      required: false,
      kind: "none",
      credentialIsolation: "not_applicable",
    },
    commands: {
      install: ["arduino-cli core install <board-package>"],
      build: "arduino-cli compile",
      test: null,
      runtime: null,
      packaging: null,
      deploy: "arduino-cli upload",
      healthCheck: "arduino-cli board list",
    },
    capabilityTests: ["compile_blink_sketch", "board_detection"],
    securityChecks: ["firmware_signing_where_supported"],
  }),
  adapter({
    id: "esp32-toolchain",
    label: "ESP32 / ESP-IDF",
    category: "hardware_toolchain",
    supportedVersions: ["5.2", "5.3"],
    latestCompatibleStableVersion: "5.3",
    supportedPlatforms: ["embedded"],
    supportedArchitectures: ["arm"],
    installation: {
      method: "ESP-IDF install script",
      requiresProvisioning: true,
      requiredToolchain: ["esp-idf", "idf.py"],
    },
    authentication: {
      required: false,
      kind: "none",
      credentialIsolation: "not_applicable",
    },
    commands: {
      install: ["./install.sh esp32"],
      build: "idf.py build",
      test: "idf.py test",
      runtime: null,
      packaging: null,
      deploy: "idf.py flash",
      healthCheck: "idf.py --version",
    },
    capabilityTests: ["idf_build", "flash_dry_run"],
    securityChecks: ["secure_boot_check"],
  }),
];
