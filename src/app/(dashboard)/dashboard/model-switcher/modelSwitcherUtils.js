import { PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";
import { getProviderAlias } from "@/shared/constants/providers";

export function buildActiveProviderKeys(connections = []) {
  const keys = new Set();
  for (const connection of connections) {
    if (!connection?.isActive) continue;
    const provider = connection.provider;
    const alias = PROVIDER_ID_TO_ALIAS[provider] || getProviderAlias(provider);
    const prefix = connection.providerSpecificData?.prefix;
    for (const key of [provider, alias, prefix]) {
      if (typeof key === "string" && key.trim()) keys.add(key.trim());
    }
  }
  return keys;
}

export function filterModelSwitcherModels(models = [], activeProviderKeys = new Set()) {
  return models.filter((model) => activeProviderKeys.has(model.provider));
}
