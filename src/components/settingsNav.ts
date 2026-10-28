import type { SettingsTab } from "./SettingsDialog";

let pending: SettingsTab | null = null;

export function openSettingsTab(tab: SettingsTab): void {
  pending = tab;
}

export function takePendingSettingsTab(): SettingsTab | null {
  const t = pending;
  pending = null;
  return t;
}
