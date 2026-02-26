import * as vscode from "vscode";
import { SkillSource } from "./types";

const SOURCES_KEY = "skillOrganizer.sources";
const GLOBAL_DEFAULTS_KEY = "skillOrganizer.globalDefaults";
const WORKSPACE_ENABLED_KEY = "skillOrganizer.workspaceEnabled";
const FROZEN_SKILLS_KEY = "skillOrganizer.frozenSkills";

export class StateStore {
  constructor(private readonly context: vscode.ExtensionContext) {}

  getSources(): SkillSource[] {
    return this.context.globalState.get<SkillSource[]>(SOURCES_KEY, []);
  }

  async saveSources(sources: SkillSource[]): Promise<void> {
    await this.context.globalState.update(SOURCES_KEY, sources);
  }

  getGlobalDefaults(): string[] {
    return sanitizeSkillIds(this.context.globalState.get<unknown>(GLOBAL_DEFAULTS_KEY, []));
  }

  async saveGlobalDefaults(skillIds: string[]): Promise<void> {
    await this.context.globalState.update(GLOBAL_DEFAULTS_KEY, skillIds);
  }

  getWorkspaceEnabled(): string[] {
    return sanitizeSkillIds(this.context.workspaceState.get<unknown>(WORKSPACE_ENABLED_KEY, []));
  }

  async saveWorkspaceEnabled(skillIds: string[]): Promise<void> {
    await this.context.workspaceState.update(WORKSPACE_ENABLED_KEY, skillIds);
  }

  getFrozenSkills(): string[] {
    return sanitizeSkillIds(this.context.workspaceState.get<unknown>(FROZEN_SKILLS_KEY, []));
  }

  async saveFrozenSkills(skillIds: string[]): Promise<void> {
    await this.context.workspaceState.update(FROZEN_SKILLS_KEY, skillIds);
  }
}

function sanitizeSkillIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}
