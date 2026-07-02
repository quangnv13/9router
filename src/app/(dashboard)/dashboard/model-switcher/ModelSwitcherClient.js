"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, Toggle } from "@/shared/components";
import { buildActiveProviderKeys, filterModelSwitcherModels } from "./modelSwitcherUtils";

export default function ModelSwitcherClient() {
  const [enabled, setEnabled] = useState(false);
  const [selectedOverride, setSelectedOverride] = useState("");
  const [models, setModels] = useState([]);
  const [combos, setCombos] = useState([]);
  const [activeProviders, setActiveProviders] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all"); // 'all' | 'combos' | 'models'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch settings, models, combos, and active providers on mount
  useEffect(() => {
    async function initData() {
      try {
        const [settingsRes, modelsRes, combosRes, providersRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/models"),
          fetch("/api/combos"),
          fetch("/api/providers"),
        ]);

        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          setEnabled(settings.modelSwitcherEnabled || false);
          setSelectedOverride(settings.modelSwitcherOverride || "");
        }

        if (modelsRes.ok) {
          const modelsData = await modelsRes.json();
          setModels(modelsData.models || []);
        }

        if (combosRes.ok) {
          const combosData = await combosRes.json();
          setCombos(combosData.combos || []);
        }

        if (providersRes.ok) {
          const providersData = await providersRes.json();
          const connections = providersData.connections || [];
          setActiveProviders(buildActiveProviderKeys(connections));
        }

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, []);


  // Update setting API helper
  const saveSettingsPatch = async (patch) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        console.error("Failed to update setting");
      }
    } catch (error) {
      console.error("Error patching settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (value) => {
    setEnabled(value);
    await saveSettingsPatch({ modelSwitcherEnabled: value });
  };

  const handleSelectOverride = async (overrideValue) => {
    setSelectedOverride(overrideValue);
    await saveSettingsPatch({ modelSwitcherOverride: overrideValue });
  };

  // Filter list of items based on search query and tab selection
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const comboItems = combos.map((c) => ({
      id: c.name,
      name: c.name,
      type: "combo",
      details: `${c.models?.length || 0} models: ${c.models?.join(" → ")}`,
      modelsList: c.models || [],
      kind: c.kind,
    }));

    // Only include models that have an active provider connection
    const modelItems = filterModelSwitcherModels(models, activeProviders)
      .map((m) => ({
        id: m.fullModel,
        name: m.alias || m.model,
        fullModel: m.fullModel,
        type: "model",
        provider: m.provider,
        caps: m.caps || {},
      }));

    let allItems = [];
    if (filterType === "all") {
      allItems = [...comboItems, ...modelItems];
    } else if (filterType === "combos") {
      allItems = comboItems;
    } else if (filterType === "models") {
      allItems = modelItems;
    }

    if (!query) return allItems;

    return allItems.filter((item) => {
      if (item.type === "combo") {
        return (
          item.name.toLowerCase().includes(query) ||
          item.details.toLowerCase().includes(query)
        );
      } else {
        return (
          item.name.toLowerCase().includes(query) ||
          item.id.toLowerCase().includes(query) ||
          (item.provider && item.provider.toLowerCase().includes(query))
        );
      }
    });
  }, [models, combos, searchQuery, filterType, activeProviders]);

  const activeOverride = selectedOverride;

  const activeItemDetails = useMemo(() => {
    if (!activeOverride) return null;
    const foundCombo = combos.find((c) => c.name === activeOverride);
    if (foundCombo) {
      return { name: foundCombo.name, type: "Combo", details: `${foundCombo.models?.length || 0} models` };
    }
    const foundModel = models.find((m) => m.fullModel === activeOverride);
    if (foundModel) {
      return { name: foundModel.alias || foundModel.model, type: `Model (${foundModel.provider})`, details: foundModel.fullModel };
    }
    return { name: activeOverride, type: "Unknown", details: "" };
  }, [activeOverride, models, combos]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-[32px] text-brand-500">
          progress_activity
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-bold tracking-tight text-text-main flex items-center gap-2">
          <span className="material-symbols-outlined text-brand-500 text-[24px]">
            swap_calls
          </span>
          Model Switcher
        </h2>
        <p className="text-sm text-text-muted">
          Override all client completion requests dynamically and force them to use a specific model or combo.
        </p>
      </div>

      {/* Main Switch Card */}
      <Card className="border border-border-subtle bg-surface shadow-[var(--shadow-soft)] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Toggle
              checked={enabled}
              onChange={handleToggle}
              label="Enable Model Switcher Override"
              description="Intercept and override the model requested by external coding assistants."
            />
          </div>
          {saving && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="material-symbols-outlined animate-spin text-[14px]">
                progress_activity
              </span>
              Saving...
            </div>
          )}
        </div>

        {/* Status banner */}
        <div className="mt-5">
          {enabled ? (
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-brand-500/20 bg-brand-500/5 text-sm text-text-main">
              <span className="material-symbols-outlined text-brand-500 text-[20px] shrink-0 mt-0.5">
                info
              </span>
              <div>
                <p className="font-semibold">Switcher is Active</p>
                {activeOverride ? (
                  <p className="text-xs text-text-muted mt-1">
                    All incoming completions are forced to use:{" "}
                    <strong className="text-brand-500 font-mono">
                      {activeItemDetails?.name}
                    </strong>{" "}
                    ({activeItemDetails?.type})
                  </p>
                ) : (
                  <p className="text-xs text-red-500 mt-1 font-semibold">
                    No override target selected! Please select a model or combo below.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-surface-2/40 text-sm text-text-muted">
              <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
                toggle_off
              </span>
              <div>
                <p className="font-medium">Switcher is Inactive</p>
                <p className="text-xs mt-1">
                  9Router will resolve and route requests normally using the model specified in the client request.
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Selector Container */}
      {enabled && <div className="flex flex-col gap-4">
        {/* Search and Tabs */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Tabs */}
          <div className="flex bg-surface-3 p-1 rounded-xl w-full sm:w-auto">
            {[
              { id: "all", label: "All" },
              { id: "combos", label: "Combos" },
              { id: "models", label: "Models" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  filterType === tab.id
                    ? "bg-surface shadow-[var(--shadow-soft)] text-text-main"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative w-full sm:max-w-xs">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-muted pointer-events-none">
              search
            </span>
            <input
              type="text"
              placeholder="Search model or combo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-border-subtle hover:border-border rounded-xl pl-9 pr-8 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main cursor-pointer flex items-center"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* List of models/combos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto p-1 pr-1.5 custom-scrollbar">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const isSelected = activeOverride === item.id;
              const title = item.type === "combo"
                ? `Combo: ${item.modelsList.join(" → ")}`
                : `Model: ${item.id}${item.provider ? ` (${item.provider})` : ""}`;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectOverride(item.id)}
                  title={title}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none bg-surface hover:border-brand-500/30 ${
                    isSelected
                      ? "border-brand-500 ring-1 ring-inset ring-brand-500 bg-brand-500/[0.02]"
                      : "border-border-subtle"
                  }`}
                >
                  <span className="material-symbols-outlined text-brand-500 text-[18px] shrink-0">
                    {item.type === "combo" ? "account_tree" : "memory"}
                  </span>
                  <p className="min-w-0 font-semibold text-sm text-text-main truncate">{item.name}</p>
                </div>
              );
            })
          ) : (
            <div className="col-span-2 flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-2xl text-center text-text-muted">
              <span className="material-symbols-outlined text-[32px] mb-2 text-text-muted/40">
                search_off
              </span>
              <p className="text-sm font-semibold">No models or combos found</p>
              <p className="text-xs mt-1">Try adjusting your search query or filter options.</p>
            </div>
          )}
        </div>
      </div>}

    </div>
  );
}
