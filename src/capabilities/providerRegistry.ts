import type { CapabilityProvider } from "./types.js";

export class CapabilityProviderRegistry {
  private readonly providers = new Map<string, CapabilityProvider>();

  constructor(providers: CapabilityProvider[] = []) {
    for (const provider of providers) this.register(provider);
  }

  register(provider: CapabilityProvider): void {
    if (!provider.id.trim()) throw new Error("Capability provider ID is required");
    this.providers.set(provider.id, provider);
  }

  get(providerId: string): CapabilityProvider | null {
    return this.providers.get(providerId) ?? null;
  }

  list(): CapabilityProvider[] {
    return [...this.providers.values()];
  }
}
