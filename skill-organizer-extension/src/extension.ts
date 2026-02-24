import * as vscode from "vscode";
import { materializeSkillsToWorkspace } from "./materializer";
import { SkillTreeNode, SkillsTreeProvider, SourceTreeNode } from "./skillsTreeProvider";
import { SourceManager } from "./sourceManager";
import { StateStore } from "./stateStore";

const DEFAULT_SKILLS_SOURCE = "https://github.com/anthropics/skills";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const stateStore = new StateStore(context);
  const sourceManager = new SourceManager(context, stateStore);
  const treeProvider = new SkillsTreeProvider(sourceManager, stateStore);

  await ensureDefaultSourceLoaded(sourceManager, stateStore);

  const treeView = vscode.window.createTreeView("skillOrganizer.skills", {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });

  const addSource = vscode.commands.registerCommand("skillOrganizer.addSource", async () => {
    const picked = await vscode.window.showQuickPick(
      [
        { label: "$(repo) GitHub Repository", value: "github" },
        { label: "$(link-external) skills.sh URL", value: "skillssh" }
      ],
      { title: "Add Skill Source" }
    );

    if (!picked) {
      return;
    }

    if (picked.value === "github") {
      await vscode.commands.executeCommand("skillOrganizer.addGitHubSource");
      return;
    }

    await vscode.commands.executeCommand("skillOrganizer.addFromSkillsSh");
  });

  const addGitHubSource = vscode.commands.registerCommand("skillOrganizer.addGitHubSource", async () => {
    const repoUrl = await vscode.window.showInputBox({
      title: "Add GitHub Skill Source",
      prompt: "Enter a GitHub repository URL",
      placeHolder: "https://github.com/owner/repo or git@github.com:owner/repo.git",
      ignoreFocusOut: true
    });

    if (!repoUrl) {
      return;
    }

    await runCommand(async () => {
      await runWithProgress("Adding GitHub source", async () => {
        await sourceManager.addGitHubSource(repoUrl.trim());
      });

      treeProvider.refresh();
      vscode.window.showInformationMessage("GitHub source added.");
    });
  });

  const addFromSkillsSh = vscode.commands.registerCommand("skillOrganizer.addFromSkillsSh", async () => {
    const inputUrl = await vscode.window.showInputBox({
      title: "Add Source from skills.sh",
      prompt: "Enter a skills.sh URL",
      placeHolder: "https://skills.sh/owner/repo/skill-slug",
      ignoreFocusOut: true
    });

    if (!inputUrl) {
      return;
    }

    await runCommand(async () => {
      const resolved = await runWithProgress("Resolving skills.sh source", async () => {
        return sourceManager.addFromSkillsSh(inputUrl.trim());
      });

      const allSkills = await sourceManager.getSkills();
      const skill = allSkills.find((s) => s.sourceId === resolved.source.id && s.slug === resolved.skillSlug);

      if (skill) {
        await enableSkillInWorkspace(skill.id, stateStore);
        await syncMaterializedEnabledSkills(sourceManager, stateStore);
        vscode.window.showInformationMessage(`Imported ${skill.slug} from ${resolved.source.uri} and enabled it in this workspace.`);
      } else {
        vscode.window.showWarningMessage(
          `Source added, but skill '${resolved.skillSlug}' was not found. Run Refresh and browse available skills.`
        );
      }

      treeProvider.refresh();
    });
  });

  const chooseGitHubAccount = vscode.commands.registerCommand("skillOrganizer.chooseGitHubAccount", async () => {
    await runCommand(async () => {
      const accountLabel = await runWithProgress("Selecting GitHub account", async () => {
        return sourceManager.chooseGitHubAccount();
      });

      vscode.window.showInformationMessage(`Skill Organizer will prefer GitHub account: ${accountLabel}`);
    });
  });

  const refresh = vscode.commands.registerCommand("skillOrganizer.refresh", async () => {
    await runCommand(async () => {
      await runWithProgress("Refreshing sources", async () => {
        await sourceManager.refreshAllSources();
      });
      treeProvider.refresh();
    });
  });

  const openActionMenu = vscode.commands.registerCommand("skillOrganizer.openActionMenu", async () => {
    const picked = await vscode.window.showQuickPick(
      [
        { label: "$(repo-create) Add Source", description: "GitHub repo or skills.sh URL", command: "skillOrganizer.addSource" },
        { label: "$(account) Choose GitHub Account", description: "Set preferred auth account for private repos", command: "skillOrganizer.chooseGitHubAccount" },
        { label: "$(trash) Remove Source", description: "Delete a configured source", command: "skillOrganizer.removeSource" },
        { label: "$(refresh) Refresh Sources", description: "Pull latest source changes", command: "skillOrganizer.refresh" },
        { label: "$(star-full) Apply Global Profile", description: "Enable global defaults in this workspace", command: "skillOrganizer.applyGlobalProfile" },
        { label: "$(files) Materialize Enabled Skills", description: "Copy enabled skills into workspace", command: "skillOrganizer.materializeEnabledSkills" }
      ],
      { title: "Skill Organizer Actions" }
    );

    if (!picked) {
      return;
    }

    await vscode.commands.executeCommand(picked.command);
  });

  const removeSource = vscode.commands.registerCommand("skillOrganizer.removeSource", async (node?: SourceTreeNode) => {
    const sourceId = await resolveSourceId(node?.sourceId, sourceManager);
    if (!sourceId) {
      return;
    }

    const source = sourceManager.getSources().find((candidate) => candidate.id === sourceId);
    if (!source) {
      vscode.window.showWarningMessage("Source no longer exists.");
      treeProvider.refresh();
      return;
    }

    const sourceLabel = getSourceLabel(source.uri);
    const confirm = await vscode.window.showWarningMessage(
      `Remove source '${sourceLabel}'? This removes the local cache and unlinks its skills from this extension.`,
      { modal: true },
      "Remove"
    );

    if (confirm !== "Remove") {
      return;
    }

    await runCommand(async () => {
      await runWithProgress("Removing source", async () => {
        await sourceManager.removeSource(sourceId);
      });

      await pruneSkillSelectionsForSource(sourceId, stateStore);
      treeProvider.refresh();
      vscode.window.showInformationMessage(`Removed source '${sourceLabel}'.`);
    });
  });

  const toggleSkill = vscode.commands.registerCommand("skillOrganizer.toggleSkill", async (skillId?: string) => {
    const resolvedSkillId = await resolveSkillId(skillId, sourceManager);
    if (!resolvedSkillId) {
      return;
    }

    await runCommand(async () => {
      const current = new Set(stateStore.getWorkspaceEnabled());
      const isEnabled = current.has(resolvedSkillId);

      if (isEnabled) {
        current.delete(resolvedSkillId);
      } else {
        current.add(resolvedSkillId);
      }

      await stateStore.saveWorkspaceEnabled([...current]);
      await syncMaterializedEnabledSkills(sourceManager, stateStore);
      treeProvider.refresh();
    });
  });

  const setGlobalDefault = vscode.commands.registerCommand("skillOrganizer.setGlobalDefault", async (skillId?: string) => {
    const resolvedSkillId = await resolveSkillId(skillId, sourceManager);
    if (!resolvedSkillId) {
      return;
    }

    await runCommand(async () => {
      const current = new Set(stateStore.getGlobalDefaults());
      if (current.has(resolvedSkillId)) {
        current.delete(resolvedSkillId);
      } else {
        current.add(resolvedSkillId);
      }

      await stateStore.saveGlobalDefaults([...current]);
      treeProvider.refresh();
    });
  });

  const removeFromWorkspace = vscode.commands.registerCommand(
    "skillOrganizer.removeFromWorkspace",
    async (skillArg?: string | SkillTreeNode) => {
      const resolvedSkillId = await resolveSkillIdFromTreeArgument(skillArg, sourceManager);
      if (!resolvedSkillId) {
        return;
      }

      await runCommand(async () => {
        const skill = await sourceManager.getSkillById(resolvedSkillId);
        const label = skill?.slug ?? resolvedSkillId;
        const confirm = await vscode.window.showWarningMessage(
          `Remove '${label}' from Workspace Enabled?`,
          { modal: true },
          "Remove"
        );

        if (confirm !== "Remove") {
          return;
        }

        const current = new Set(stateStore.getWorkspaceEnabled());
        current.delete(resolvedSkillId);
        await stateStore.saveWorkspaceEnabled([...current]);
        await syncMaterializedEnabledSkills(sourceManager, stateStore);
        treeProvider.refresh();
      });
    }
  );

  const removeFromGlobalDefaults = vscode.commands.registerCommand(
    "skillOrganizer.removeFromGlobalDefaults",
    async (skillArg?: string | SkillTreeNode) => {
      const resolvedSkillId = await resolveSkillIdFromTreeArgument(skillArg, sourceManager);
      if (!resolvedSkillId) {
        return;
      }

      await runCommand(async () => {
        const skill = await sourceManager.getSkillById(resolvedSkillId);
        const label = skill?.slug ?? resolvedSkillId;
        const confirm = await vscode.window.showWarningMessage(
          `Remove '${label}' from Global Defaults?`,
          { modal: true },
          "Remove"
        );

        if (confirm !== "Remove") {
          return;
        }

        const current = new Set(stateStore.getGlobalDefaults());
        current.delete(resolvedSkillId);
        await stateStore.saveGlobalDefaults([...current]);
        treeProvider.refresh();
      });
    }
  );

  const applyGlobalProfile = vscode.commands.registerCommand("skillOrganizer.applyGlobalProfile", async () => {
    await runCommand(async () => {
      const globalDefaults = stateStore.getGlobalDefaults();
      if (globalDefaults.length === 0) {
        vscode.window.showInformationMessage("No global default skills are configured yet.");
        return;
      }

      const workspaceEnabled = new Set(stateStore.getWorkspaceEnabled());
      for (const skillId of globalDefaults) {
        workspaceEnabled.add(skillId);
      }

      await stateStore.saveWorkspaceEnabled([...workspaceEnabled]);
      await syncMaterializedEnabledSkills(sourceManager, stateStore);
      treeProvider.refresh();
      vscode.window.showInformationMessage(`Applied ${globalDefaults.length} global default skill(s) to this workspace.`);
    });
  });

  const materializeEnabledSkills = vscode.commands.registerCommand("skillOrganizer.materializeEnabledSkills", async () => {
    await runCommand(async () => {
      const enabledIds = stateStore.getWorkspaceEnabled();
      if (enabledIds.length === 0) {
        vscode.window.showInformationMessage("No enabled skills to materialize in this workspace.");
        return;
      }

      const resolvedSkills = await Promise.all(enabledIds.map((skillId) => sourceManager.getSkillById(skillId)));
      const skills = resolvedSkills.filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));

      if (skills.length === 0) {
        vscode.window.showWarningMessage("Enabled skills could not be resolved from current sources. Try refreshing sources.");
        return;
      }

      const result = await runWithProgress("Materializing enabled skills", async () => {
        return materializeSkillsToWorkspace(skills);
      });

      vscode.window.showInformationMessage(`Materialized ${result.copied} skill(s) to ${result.outputPath}.`);
    });
  });

  context.subscriptions.push(
    treeView,
    addSource,
    openActionMenu,
    addGitHubSource,
    addFromSkillsSh,
    chooseGitHubAccount,
    removeSource,
    refresh,
    toggleSkill,
    setGlobalDefault,
    removeFromWorkspace,
    removeFromGlobalDefaults,
    applyGlobalProfile,
    materializeEnabledSkills
  );
}

export function deactivate(): void {
  // VS Code disposes subscriptions automatically.
}

async function runWithProgress<T>(title: string, operation: () => Promise<T>): Promise<T> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title
    },
    operation
  );
}

async function resolveSkillId(
  directSkillId: string | undefined,
  sourceManager: SourceManager
): Promise<string | undefined> {
  if (directSkillId) {
    return directSkillId;
  }

  const skills = await sourceManager.getSkills();
  if (skills.length === 0) {
    vscode.window.showWarningMessage("No discovered skills available.");
    return undefined;
  }

  const selected = await vscode.window.showQuickPick(
    skills.map((skill) => ({ label: skill.slug, description: skill.relativePath, value: skill.id })),
    { title: "Select a skill" }
  );

  return selected?.value;
}

async function resolveSkillIdFromTreeArgument(
  skillArg: string | SkillTreeNode | undefined,
  sourceManager: SourceManager
): Promise<string | undefined> {
  if (typeof skillArg === "string") {
    return skillArg;
  }

  if (skillArg && typeof skillArg === "object" && "skill" in skillArg) {
    const maybeId = (skillArg as SkillTreeNode).skill?.id;
    if (typeof maybeId === "string" && maybeId.length > 0) {
      return maybeId;
    }
  }

  return resolveSkillId(undefined, sourceManager);
}

async function resolveSourceId(
  directSourceId: string | undefined,
  sourceManager: SourceManager
): Promise<string | undefined> {
  if (directSourceId) {
    return directSourceId;
  }

  const sources = sourceManager.getSources();
  if (sources.length === 0) {
    vscode.window.showWarningMessage("No configured sources available.");
    return undefined;
  }

  const selected = await vscode.window.showQuickPick(
    sources.map((source) => ({ label: getSourceLabel(source.uri), description: source.uri, value: source.id })),
    { title: "Select a source to remove" }
  );

  return selected?.value;
}

async function enableSkillInWorkspace(skillId: string, stateStore: StateStore): Promise<void> {
  const enabled = new Set(stateStore.getWorkspaceEnabled());
  enabled.add(skillId);
  await stateStore.saveWorkspaceEnabled([...enabled]);
}

async function syncMaterializedEnabledSkills(sourceManager: SourceManager, stateStore: StateStore): Promise<void> {
  const enabledIds = stateStore.getWorkspaceEnabled();
  if (enabledIds.length === 0) {
    return;
  }

  const resolvedSkills = await Promise.all(enabledIds.map((id) => sourceManager.getSkillById(id)));
  const skills = resolvedSkills.filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));

  if (skills.length === 0) {
    return;
  }

  await materializeSkillsToWorkspace(skills);
}

async function pruneSkillSelectionsForSource(sourceId: string, stateStore: StateStore): Promise<void> {
  const sourceSkillPrefix = `${sourceId}:`;

  const workspaceEnabled = stateStore.getWorkspaceEnabled();
  const filteredWorkspaceEnabled = workspaceEnabled.filter((skillId) => !skillId.startsWith(sourceSkillPrefix));
  if (filteredWorkspaceEnabled.length !== workspaceEnabled.length) {
    await stateStore.saveWorkspaceEnabled(filteredWorkspaceEnabled);
  }

  const globalDefaults = stateStore.getGlobalDefaults();
  const filteredGlobalDefaults = globalDefaults.filter((skillId) => !skillId.startsWith(sourceSkillPrefix));
  if (filteredGlobalDefaults.length !== globalDefaults.length) {
    await stateStore.saveGlobalDefaults(filteredGlobalDefaults);
  }
}

async function runCommand(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Skill Organizer: ${message}`);
  }
}

async function ensureDefaultSourceLoaded(sourceManager: SourceManager, stateStore: StateStore): Promise<void> {
  if (stateStore.getSources().length > 0) {
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Setting up default skills source"
      },
      async () => {
        await sourceManager.addGitHubSource(DEFAULT_SKILLS_SOURCE);
      }
    );

    vscode.window.showInformationMessage("Added default source: anthropics/skills");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showWarningMessage(`Could not load default source anthropics/skills: ${message}`);
  }
}

function getSourceLabel(uri: string): string {
  try {
    const url = new URL(uri);
    if (url.hostname === "github.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1].replace(/\.git$/i, "")}`;
      }
    }
  } catch {
    // Non-URL form (for example SSH), fall back to raw value.
  }

  const sshMatch = uri.match(/^git@github\.com:([\w.-]+)\/([\w.-]+)(?:\.git)?$/i);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2]}`;
  }

  return uri;
}
