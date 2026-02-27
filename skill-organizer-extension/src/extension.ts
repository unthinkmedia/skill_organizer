import * as vscode from "vscode";
import {
  assertCanInstallMaterializedSkill,
  getLocalConflictFolderNames,
  getSkillTargetFolderName,
  listMaterializedSkills,
  markSkillAsManaged,
  markSkillAsManual,
  materializeSkillsToWorkspace,
  reconcileUntrackedSkills,
  uninstallMaterializedSkill,
  updateManagedMaterializedSkill
} from "./materializer";
import { createGitHubRepo, getGitHubUsername, listGitHubUserOrgs, parseGitHubOwnerRepo, submitSkillPR } from "./githubApi";
import { MaterializedSkillTreeNode, MissingSkillTreeNode, SkillTreeNode, SkillsTreeProvider, SourceTreeNode } from "./skillsTreeProvider";
import { searchSkills } from "./skillSearch";
import { SourceManager } from "./sourceManager";
import { StateStore } from "./stateStore";
import { SkillItem, SkillSource } from "./types";

const DEFAULT_SKILLS_SOURCE = "https://github.com/anthropics/skills";
const DEFAULT_AGENTS_MD = `# AGENTS.md

Global governance loaded on every prompt. Keep this file minimal.

## Scope

- Applies to the entire repo.
- Include only invariants required for consistent skill triggering and safe operation.

## Triggering And Progressive Disclosure

- Keep metadata and top-level guidance concise so skills trigger reliably.
- Put detailed procedures, examples, and checklists in skill-local references loaded on demand.

## Tool-First Rule

- Prefer tool-driven verification over speculation.
- Cite concrete repo evidence (files, command outputs) when asserting status.

## Routing Mechanics

- Prefer native VS Code UI first.
- Use custom editors for specialized file editing/viewing.
- Use WebViews only when native UI and custom editors cannot meet requirements.

## Basic Verification

- Validate changed behavior with explicit checks before sign-off.
- Do not mark work complete when required build/test/package checks fail.

## Output Preference

- Default to short, scannable responses.
- Expand only when complexity or user request requires it.

## Placement Rule

- Do not store procedural governance details in \`.github/AGENTS.md\`.
- Put skill-creation governance in \`.github/skills/skill-creator/references/governance.md\`.
`;
const EXTEND_AGENTS_PROMPT = `Review this repository's skill system governance and recommend updates to .github/AGENTS.md.

Scope:
- Analyze all skill definitions and references under:
  - .github/skills/**/SKILL.md
  - .github/skills/**/references/*.md
- Also consider repository instruction files under:
  - .github/instructions/*.md

Goal:
- Identify rules that should be globally enforced in .github/AGENTS.md so they are applied to every prompt.
- Distinguish global rules from skill-specific rules that should remain in skill docs.

Required .github/AGENTS.md scope:
- Routing and UI selection policy
- WebView security/accessibility invariants
- Scaffold and lifecycle minimums
- Icon policy baseline
- Verification and release evidence requirements

Output format (concise):
1) Return ONLY a unified diff for .github/AGENTS.md (no full file dump).
2) Then provide a short review summary with:
- Max 8 bullets total.
- Added rules.
- Rules intentionally excluded because they are skill-local.
- Top 2 drift risks.

Constraints:
- Do not restate detailed procedural checklists already covered in skill references.
- Prefer short policy statements with explicit MUST/SHOULD wording.
- Cite recommendations with concrete repo file references in the summary bullets only.`;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const stateStore = new StateStore(context);
  const sourceManager = new SourceManager(context, stateStore);
  const treeProvider = new SkillsTreeProvider(sourceManager, stateStore);

  await ensureDefaultSourceLoaded(sourceManager, stateStore);

  const treeView = vscode.window.createTreeView("skillOrganizer.skills", {
    treeDataProvider: treeProvider,
    showCollapseAll: false
  });

  treeView.onDidChangeCheckboxState(async (e) => {
    for (const [item] of e.items) {
      if (item instanceof SkillTreeNode) {
        await vscode.commands.executeCommand("skillOrganizer.toggleSkill", item.skill.id);
      }
    }
  });

  // --- File system watcher for auto-refresh ---
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const debouncedRefresh = () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(async () => {
      await reconcileUntrackedSkills();
      treeProvider.refresh();
    }, 500);
  };

  let skillsWatcher: vscode.FileSystemWatcher | undefined;

  function createSkillsWatcher(): vscode.FileSystemWatcher | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return undefined;
    }

    const config = vscode.workspace.getConfiguration("skillOrganizer");
    const destinationPath = config.get<string>("destinationPath", ".github/skills");
    const pattern = new vscode.RelativePattern(workspaceFolder, `${destinationPath}/**`);
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidCreate(debouncedRefresh);
    watcher.onDidDelete(debouncedRefresh);
    watcher.onDidChange(debouncedRefresh);
    return watcher;
  }

  skillsWatcher = createSkillsWatcher();
  if (skillsWatcher) {
    context.subscriptions.push(skillsWatcher);
  }

  // Reconcile untracked skills at activation so pre-existing skills are detected
  reconcileUntrackedSkills().then((changed) => {
    if (changed > 0) {
      treeProvider.refresh();
    }
  });

  // Re-reconcile when the tree view becomes visible to catch missed events
  treeView.onDidChangeVisibility(async (e) => {
    if (e.visible) {
      const changed = await reconcileUntrackedSkills();
      if (changed > 0) {
        treeProvider.refresh();
      }
    }
  });

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("skillOrganizer.destinationPath")) {
        skillsWatcher?.dispose();
        skillsWatcher = createSkillsWatcher();
        if (skillsWatcher) {
          context.subscriptions.push(skillsWatcher);
        }
        treeProvider.refresh();
      }
    })
  );

  const conflictDecorationProvider = vscode.window.registerFileDecorationProvider({
    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
      if (uri.scheme === "skill-organizer-disabled") {
        return {
          color: new vscode.ThemeColor("disabledForeground"),
          tooltip: "Local conflict — cannot enable"
        };
      }
      return undefined;
    }
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
      const installMode = await vscode.window.showQuickPick(
        [
          { label: "$(package) Reconnect to Source (managed)", value: "managed" },
          { label: "$(lock) Detach from Source (local protected copy)", value: "manual" }
        ],
        {
          title: "Install Mode",
          placeHolder: "Choose how this skill should be tracked"
        }
      );

      if (!installMode) {
        return;
      }

      const resolved = await runWithProgress("Resolving skills.sh source", async () => {
        return sourceManager.addFromSkillsSh(inputUrl.trim());
      });

      const allSkills = await sourceManager.getSkills();
      const skill = allSkills.find((s) => s.sourceId === resolved.source.id && s.slug === resolved.skillSlug);

      if (skill) {
        await assertCanInstallMaterializedSkill(skill.slug, installMode.value === "manual");
        await enableSkillInWorkspace(skill.id, stateStore, sourceManager);

        if (installMode.value === "manual") {
          await markSkillAsManual(skill.slug);
        }

        const installedAs = installMode.value === "manual" ? "detached from source" : "source-managed";

        vscode.window.showInformationMessage(
          `Imported ${skill.slug} from ${resolved.source.uri} and enabled it in this workspace as ${installedAs}.`
        );
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

  const explainMissingSkill = vscode.commands.registerCommand(
    "skillOrganizer.explainMissingSkill",
    async (node?: MissingSkillTreeNode | MissingSkillCommandPayload) => {
      const payload = resolveMissingSkillPayload(node);
      if (!payload) {
        return;
      }

      const removeThisSectionLabel = payload.section === "workspace" ? "Remove from Workspace Enabled" : "Remove from Global Defaults";
      const actions = ["Add Source", "Refresh Sources", removeThisSectionLabel];
      if (payload.section === "workspace" && payload.globalDefault) {
        actions.push("Remove from Workspace + Global Defaults");
      }

      const selected = await vscode.window.showWarningMessage(
        "This skill is referenced in saved state but cannot be found in current sources.",
        {
          modal: true,
          detail:
            `Missing skill id: ${payload.skillId}\n\n` +
            "Common causes:\n" +
            "• The source was removed\n" +
            "• The source URL or branch changed\n" +
            "• The skill was renamed or deleted upstream\n\n" +
            "Recommended: re-add the source, then refresh."
        },
        ...actions
      );

      if (!selected) {
        return;
      }

      if (selected === "Add Source") {
        await vscode.commands.executeCommand("skillOrganizer.addSource");
        return;
      }

      if (selected === "Refresh Sources") {
        await vscode.commands.executeCommand("skillOrganizer.refresh");
        return;
      }

      await runCommand(async () => {
        if (selected === removeThisSectionLabel || selected === "Remove from Workspace + Global Defaults") {
          if (payload.section === "workspace") {
            const updatedWorkspace = stateStore.getWorkspaceEnabled().filter((id) => id !== payload.skillId);
            await stateStore.saveWorkspaceEnabled(updatedWorkspace);

            if (selected === "Remove from Workspace + Global Defaults") {
              const updatedGlobal = stateStore.getGlobalDefaults().filter((id) => id !== payload.skillId);
              await stateStore.saveGlobalDefaults(updatedGlobal);
            }

            await syncMaterializedEnabledSkills(sourceManager, stateStore);
          } else {
            const updatedGlobal = stateStore.getGlobalDefaults().filter((id) => id !== payload.skillId);
            await stateStore.saveGlobalDefaults(updatedGlobal);
          }

          treeProvider.refresh();
          vscode.window.showInformationMessage(`Removed stale missing skill reference '${payload.skillId}'.`);
        }
      });
    }
  );

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
      const frozenSkills = new Set(stateStore.getFrozenSkills());

      if (!isEnabled && frozenSkills.has(resolvedSkillId)) {
        const skill = await sourceManager.getSkillById(resolvedSkillId);
        const label = skill?.slug ?? resolvedSkillId;
        vscode.window.showWarningMessage(`'${label}' is frozen. Unlock it to enable.`);
        return;
      }

      if (!isEnabled) {
        const skill = await sourceManager.getSkillById(resolvedSkillId);
        if (skill) {
          const conflicts = await getLocalConflictFolderNames();
          const targetFolder = getSkillTargetFolderName(skill.slug);
          if (conflicts.has(targetFolder)) {
            vscode.window.showWarningMessage(
              `'${skill.slug}' conflicts with an existing local folder '${targetFolder}'. Remove or rename the local folder first.`
            );
            return;
          }
        }
      }

      if (isEnabled) {
        current.delete(resolvedSkillId);
        await stateStore.saveWorkspaceEnabled([...current]);
        await syncMaterializedEnabledSkills(sourceManager, stateStore);
      } else {
        const previous = new Set(current);
        current.add(resolvedSkillId);
        await stateStore.saveWorkspaceEnabled([...current]);

        try {
          await syncMaterializedEnabledSkills(sourceManager, stateStore);
        } catch (error) {
          await stateStore.saveWorkspaceEnabled([...previous]);
          throw error;
        }
      }

      treeProvider.refresh();
    });
  });

  const freezeSkill = vscode.commands.registerCommand(
    "skillOrganizer.freezeSkill",
    async (skillArg?: string | SkillTreeNode) => {
      const resolvedSkillId = await resolveSkillIdFromTreeArgument(skillArg, sourceManager);
      if (!resolvedSkillId) {
        return;
      }

      await runCommand(async () => {
        const skill = await sourceManager.getSkillById(resolvedSkillId);
        const label = skill?.slug ?? resolvedSkillId;
        const frozenSkills = new Set(stateStore.getFrozenSkills());
        if (frozenSkills.has(resolvedSkillId)) {
          vscode.window.showInformationMessage(`'${label}' is already frozen.`);
          return;
        }

        const enabledBefore = new Set(stateStore.getWorkspaceEnabled());
        const wasEnabled = enabledBefore.delete(resolvedSkillId);
        if (wasEnabled) {
          await stateStore.saveWorkspaceEnabled([...enabledBefore]);
        }

        frozenSkills.add(resolvedSkillId);
        await stateStore.saveFrozenSkills([...frozenSkills]);

        try {
          if (wasEnabled) {
            await syncMaterializedEnabledSkills(sourceManager, stateStore);
          }
        } catch (error) {
          frozenSkills.delete(resolvedSkillId);
          await stateStore.saveFrozenSkills([...frozenSkills]);
          if (wasEnabled) {
            enabledBefore.add(resolvedSkillId);
            await stateStore.saveWorkspaceEnabled([...enabledBefore]);
          }
          throw error;
        }

        treeProvider.refresh();
        vscode.window.showInformationMessage(`Froze '${label}'. It cannot be enabled until unlocked.`);
      });
    }
  );

  const unfreezeSkill = vscode.commands.registerCommand(
    "skillOrganizer.unfreezeSkill",
    async (skillArg?: string | SkillTreeNode) => {
      const resolvedSkillId = await resolveSkillIdFromTreeArgument(skillArg, sourceManager);
      if (!resolvedSkillId) {
        return;
      }

      await runCommand(async () => {
        const skill = await sourceManager.getSkillById(resolvedSkillId);
        const label = skill?.slug ?? resolvedSkillId;
        const frozenSkills = new Set(stateStore.getFrozenSkills());
        if (!frozenSkills.has(resolvedSkillId)) {
          vscode.window.showInformationMessage(`'${label}' is not frozen.`);
          return;
        }

        frozenSkills.delete(resolvedSkillId);
        await stateStore.saveFrozenSkills([...frozenSkills]);
        treeProvider.refresh();
        vscode.window.showInformationMessage(`Unlocked '${label}'. You can enable it again.`);
      });
    }
  );

  const setGlobalDefault = vscode.commands.registerCommand(
    "skillOrganizer.setGlobalDefault",
    async (skillArg?: string | SkillTreeNode) => {
      const resolvedSkillId = await resolveSkillIdFromTreeArgument(skillArg, sourceManager);
      if (!resolvedSkillId) {
        return;
      }

      await runCommand(async () => {
        const current = new Set(stateStore.getGlobalDefaults());
        current.add(resolvedSkillId);

        await stateStore.saveGlobalDefaults([...current]);
        treeProvider.refresh();
      });
    }
  );

  const unsetGlobalDefault = vscode.commands.registerCommand(
    "skillOrganizer.unsetGlobalDefault",
    async (skillArg?: string | SkillTreeNode) => {
      const resolvedSkillId = await resolveSkillIdFromTreeArgument(skillArg, sourceManager);
      if (!resolvedSkillId) {
        return;
      }

      await runCommand(async () => {
        const current = new Set(stateStore.getGlobalDefaults());
        current.delete(resolvedSkillId);

        await stateStore.saveGlobalDefaults([...current]);
        treeProvider.refresh();
      });
    }
  );

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

      const frozenSkills = new Set(stateStore.getFrozenSkills());
      const eligibleGlobalDefaults = globalDefaults.filter((skillId) => !frozenSkills.has(skillId));
      const skippedFrozen = globalDefaults.length - eligibleGlobalDefaults.length;

      const workspaceEnabled = new Set(stateStore.getWorkspaceEnabled());
      for (const skillId of eligibleGlobalDefaults) {
        workspaceEnabled.add(skillId);
      }

      await stateStore.saveWorkspaceEnabled([...workspaceEnabled]);
      await syncMaterializedEnabledSkills(sourceManager, stateStore);
      treeProvider.refresh();
      const skippedMessage = skippedFrozen > 0 ? ` Skipped ${skippedFrozen} frozen skill(s).` : "";
      vscode.window.showInformationMessage(
        `Applied ${eligibleGlobalDefaults.length} global default skill(s) to this workspace.${skippedMessage}`
      );
    });
  });

  const syncWorkspaceSkills = vscode.commands.registerCommand("skillOrganizer.syncWorkspaceSkills", async () => {
    const confirm = await confirmSyncWorkspaceSkills(stateStore);
    if (!confirm) {
      return;
    }

    await runCommand(async () => {
      const enabledIds = stateStore.getWorkspaceEnabled();
      if (enabledIds.length === 0) {
        const result = await runWithProgress("Syncing local skills", async () => {
          return materializeSkillsToWorkspace([]);
        });

        vscode.window.showInformationMessage(`No skills enabled. Removed ${result.removed} local skill folder(s).`);
        return;
      }

      const resolvedSkills = await Promise.all(enabledIds.map((skillId) => sourceManager.getSkillById(skillId)));
      const skills = resolvedSkills.filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));

      if (skills.length === 0) {
        vscode.window.showWarningMessage("Enabled skills could not be resolved from current sources. Try refreshing sources.");
        return;
      }

      const result = await runWithProgress("Syncing enabled local skills", async () => {
        return materializeSkillsToWorkspace(skills);
      });

      const skippedMessage = result.skippedManual > 0 ? ` Skipped ${result.skippedManual} manual protected skill(s).` : "";
      vscode.window.showInformationMessage(
        `Synced ${result.copied} local skill(s) to ${result.outputPath}. Removed ${result.removed} stale folder(s).${skippedMessage}`
      );
      treeProvider.refresh();
    });
  });

  const markManual = vscode.commands.registerCommand("skillOrganizer.markManual", async (node?: MaterializedSkillTreeNode) => {
    await runCommand(async () => {
      const skillName = await resolveMaterializedSkillName(node, "all");
      if (!skillName) {
        return;
      }

      await markSkillAsManual(skillName);
      treeProvider.refresh();
      vscode.window.showInformationMessage(`Detached '${skillName}' from source (protected from updates).`);
    });
  });

  const markManaged = vscode.commands.registerCommand("skillOrganizer.markManaged", async (node?: MaterializedSkillTreeNode) => {
    await runCommand(async () => {
      const skillName = await resolveMaterializedSkillName(node, "all");
      if (!skillName) {
        return;
      }

      await markSkillAsManaged(skillName);
      treeProvider.refresh();
      vscode.window.showInformationMessage(`Reconnected '${skillName}' to source updates.`);
    });
  });

  const uninstallSkill = vscode.commands.registerCommand(
    "skillOrganizer.uninstallSkill",
    async (node?: MaterializedSkillTreeNode) => {
      await runCommand(async () => {
        const skillName = await resolveMaterializedSkillName(node, "all");
        if (!skillName) {
          return;
        }

        const isManual = node?.entry.type === "manual";
        if (isManual) {
          const forceConfirm = await vscode.window.showWarningMessage(
            `'${skillName}' is detached from source and protected. Remove anyway?`,
            { modal: true },
            "Force Remove"
          );

          if (forceConfirm !== "Force Remove") {
            return;
          }

          await uninstallMaterializedSkill(skillName, true);
        } else {
          const confirm = await vscode.window.showWarningMessage(
            `Remove '${skillName}' from destination folder and manifest?`,
            { modal: true },
            "Remove"
          );

          if (confirm !== "Remove") {
            return;
          }

          await uninstallMaterializedSkill(skillName, false);
        }

        treeProvider.refresh();
        vscode.window.showInformationMessage(`Uninstalled '${skillName}'.`);
      });
    }
  );

  const updateManagedSkill = vscode.commands.registerCommand(
    "skillOrganizer.updateManagedSkill",
    async (node?: MaterializedSkillTreeNode) => {
      await runCommand(async () => {
        const skillName = await resolveMaterializedSkillName(node, "managed");
        if (!skillName) {
          return;
        }

        const enabledIds = stateStore.getWorkspaceEnabled();
        const resolvedSkills = await Promise.all(enabledIds.map((id) => sourceManager.getSkillById(id)));
        const enabledSkills = resolvedSkills.filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));

        const normalizedSkillName = normalizeManagedSkillFolderName(skillName);
        let selectedSkill = enabledSkills.find((skill) => normalizeManagedSkillFolderName(skill.slug) === normalizedSkillName);

        if (!selectedSkill) {
          const allSkills = await sourceManager.getSkills();
          const matchingSkills = allSkills.filter((skill) => normalizeManagedSkillFolderName(skill.slug) === normalizedSkillName);

          if (matchingSkills.length === 0) {
            throw new Error(`No source skill matches managed folder '${skillName}'. Re-enable it or re-install from source.`);
          }

          if (matchingSkills.length === 1) {
            selectedSkill = matchingSkills[0];
          } else {
            selectedSkill = await pickManagedSkillMatch(skillName, matchingSkills, sourceManager);
            if (!selectedSkill) {
              return;
            }
          }

          if (!enabledIds.includes(selectedSkill.id)) {
            await stateStore.saveWorkspaceEnabled([...enabledIds, selectedSkill.id]);
          }
        }

        await updateManagedMaterializedSkill(skillName, [selectedSkill]);
        treeProvider.refresh();
        vscode.window.showInformationMessage(`Updated managed skill '${skillName}'.`);
      });
    }
  );

  const explainConflict = vscode.commands.registerCommand(
    "skillOrganizer.explainConflict",
    async (skillSlug?: string, targetFolder?: string) => {
      const label = skillSlug ?? "This skill";
      const folder = targetFolder ?? "unknown";
      vscode.window.showWarningMessage(
        `'${label}' cannot be enabled because a local folder '${folder}' already exists in the destination path. Remove or rename the local folder, then refresh.`
      );
    }
  );

  const extendAgents = vscode.commands.registerCommand("skillOrganizer.extendAgents", async () => {
    await runCommand(async () => {
      const locationStatus = await normalizeAgentsFileLocation();
      if (locationStatus === "moved") {
        vscode.window.showInformationMessage("Moved AGENTS.md to .github/AGENTS.md.");
      }
      if (locationStatus === "duplicate") {
        vscode.window.showWarningMessage("Found both AGENTS.md and .github/AGENTS.md. Using .github/AGENTS.md and leaving root file unchanged.");
      }

      const created = await ensureAgentsFileExists();
      if (created) {
        vscode.window.showInformationMessage(".github/AGENTS.md was missing and has been recreated.");
      }

      const sent = await openCopilotChatWithPrompt(EXTEND_AGENTS_PROMPT);
      if (sent) {
        vscode.window.showInformationMessage("Opened Copilot Chat with the Review AGENTS.md prompt.");
        return;
      }

      await vscode.env.clipboard.writeText(EXTEND_AGENTS_PROMPT);
      await openCopilotChat();
      vscode.window.showInformationMessage("Prompt copied. Paste into Copilot Chat to review AGENTS.md.");
    });
  });

  const searchSkillsCommand = vscode.commands.registerCommand("skillOrganizer.searchSkills", async () => {
    const allSkills = await sourceManager.getSkills();
    if (allSkills.length === 0) {
      vscode.window.showWarningMessage("No skills available. Add a source first.");
      return;
    }

    const query = await vscode.window.showInputBox({
      title: "Search Skills",
      prompt: "Describe what you're looking for",
      placeHolder: "e.g. help me deploy, make presentations, set up auth",
      ignoreFocusOut: true
    });

    if (!query) {
      return;
    }

    await runCommand(async () => {
      const workspaceEnabled = new Set(stateStore.getWorkspaceEnabled());

      const results = await runWithProgress("Searching skills", async () => {
        const tokenSource = new vscode.CancellationTokenSource();
        try {
          return await searchSkills(query, allSkills, tokenSource.token);
        } finally {
          tokenSource.dispose();
        }
      });

      if (results.length === 0) {
        vscode.window.showInformationMessage(`No skills matched "${query}".`);
        return;
      }

      const items = results.map((result) => {
        const enabled = workspaceEnabled.has(result.skill.id);
        const statusIcon = enabled ? "$(check)" : "$(circle-large-outline)";
        const name = result.skill.metadata?.name ?? result.skill.slug;
        const description = result.reason ?? result.skill.metadata?.description ?? "";
        return {
          label: `${statusIcon} ${name}`,
          description: result.skill.slug !== name ? result.skill.slug : "",
          detail: description,
          value: result.skill
        };
      });

      const selected = await vscode.window.showQuickPick(items, {
        title: `Search results for "${query}"`,
        placeHolder: "Select a skill to enable or disable",
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (selected) {
        await vscode.commands.executeCommand("skillOrganizer.toggleSkill", selected.value.id);
      }
    });
  });

  const submitSkillPRCommand = vscode.commands.registerCommand(
    "skillOrganizer.submitSkillPR",
    async (node?: MaterializedSkillTreeNode) => {
      await runCommand(async () => {
        // 1. Pick a local skill to submit.
        const materialized = await listMaterializedSkills();
        if (materialized.length === 0) {
          vscode.window.showWarningMessage("No local skills found. Enable and sync a skill first, or create one manually.");
          return;
        }

        let skillName: string | undefined;
        let skillPath: string | undefined;

        if (node?.entry) {
          skillName = node.entry.folderName;
          skillPath = node.entry.path;
        } else {
          const selected = await vscode.window.showQuickPick(
            materialized.map((entry) => ({
              label: entry.folderName,
              description: entry.type === "manual" ? "Local (detached)" : "Managed",
              value: entry
            })),
            { title: "Submit Skill as PR", placeHolder: "Select a skill to submit" }
          );

          if (!selected) {
            return;
          }

          skillName = selected.value.folderName;
          skillPath = selected.value.path;
        }

        // 2. Pick the target repo — existing source, manual URL, or create new.
        const sources = sourceManager.getSources().filter((s) => {
          const parsed = parseGitHubOwnerRepo(s.canonicalRepoUri ?? s.uri);
          return s.type === "gitRepo" && parsed !== undefined;
        });

        type TargetChoice = { kind: "source"; source: SkillSource } | { kind: "url" } | { kind: "create" };

        const quickPickItems: Array<{ label: string; description?: string; value: TargetChoice }> = [];

        for (const source of sources) {
          quickPickItems.push({
            label: `$(repo) ${getSourceLabel(source.uri)}`,
            description: source.canonicalRepoUri ?? source.uri,
            value: { kind: "source", source }
          });
        }

        quickPickItems.push(
          { label: "$(link-external) Enter a GitHub repo URL", value: { kind: "url" } },
          { label: "$(plus) Create a new GitHub repo", value: { kind: "create" } }
        );

        const targetChoice = await vscode.window.showQuickPick(quickPickItems, {
          title: "Target Repository",
          placeHolder: "Where should this skill be submitted?"
        });

        if (!targetChoice) {
          return;
        }

        // Authenticate — let user pick which GitHub account to use.
        const session = await pickGitHubSession();

        if (!session) {
          return;
        }

        let targetOwner: string;
        let targetRepo: string;
        let targetBranch: string | undefined;
        let targetSkillsRoot: string | undefined;

        if (targetChoice.value.kind === "source") {
          const src = targetChoice.value.source;
          const parsed = parseGitHubOwnerRepo(src.canonicalRepoUri ?? src.uri);
          if (!parsed) {
            throw new Error("Could not parse owner/repo from the selected source.");
          }

          targetOwner = parsed.owner;
          targetRepo = parsed.repo;
          targetBranch = src.branch;
          targetSkillsRoot = src.skillsRootPath;
        } else if (targetChoice.value.kind === "url") {
          const repoUrl = await vscode.window.showInputBox({
            title: "GitHub Repository URL",
            prompt: "Enter the GitHub repo URL to submit the PR to",
            placeHolder: "https://github.com/owner/repo",
            ignoreFocusOut: true
          });

          if (!repoUrl) {
            return;
          }

          const parsed = parseGitHubOwnerRepo(repoUrl.trim());
          if (!parsed) {
            throw new Error("Invalid GitHub URL. Use a format like https://github.com/owner/repo");
          }

          targetOwner = parsed.owner;
          targetRepo = parsed.repo;
        } else {
          // Create new repo.
          const username = await runWithProgress("Loading GitHub account", () => getGitHubUsername(session.accessToken));
          const orgs = await runWithProgress("Loading organizations", () => listGitHubUserOrgs(session.accessToken));

          const ownerChoices = [
            { label: `$(person) ${username}`, description: "Personal account", value: username },
            ...orgs.map((org) => ({ label: `$(organization) ${org}`, description: "Organization", value: org }))
          ];

          const ownerPick = ownerChoices.length === 1
            ? ownerChoices[0]
            : await vscode.window.showQuickPick(ownerChoices, {
                title: "Repository Owner",
                placeHolder: "Where should the new repo be created?"
              });

          if (!ownerPick) {
            return;
          }

          const repoName = await vscode.window.showInputBox({
            title: "Repository Name",
            prompt: "Name for the new skills repository",
            value: "my-skills",
            ignoreFocusOut: true,
            validateInput: (input) => {
              if (!/^[a-zA-Z0-9._-]+$/.test(input)) {
                return "Use only letters, numbers, hyphens, dots, and underscores.";
              }
              return undefined;
            }
          });

          if (!repoName) {
            return;
          }

          const visibilityPick = await vscode.window.showQuickPick(
            [
              { label: "$(globe) Public", value: false },
              { label: "$(lock) Private", value: true }
            ],
            { title: "Repository Visibility" }
          );

          if (!visibilityPick) {
            return;
          }

          const selectedOwner = ownerPick.value;
          const isOrg = selectedOwner !== username;

          const created = await runWithProgress("Creating repository", () =>
            createGitHubRepo(
              session.accessToken,
              repoName,
              "Reusable AI skills collection",
              isOrg ? selectedOwner : undefined,
              visibilityPick.value
            )
          );

          targetOwner = created.owner;
          targetRepo = created.repo;
          targetBranch = created.defaultBranch;

          vscode.window.showInformationMessage(`Created ${created.owner}/${created.repo}.`);
        }

        // 3. PR title and body.
        const prTitle = await vscode.window.showInputBox({
          title: "PR Title",
          value: `Add skill: ${skillName}`,
          ignoreFocusOut: true
        });

        if (!prTitle) {
          return;
        }

        const prBody = await vscode.window.showInputBox({
          title: "PR Description (optional)",
          value: `Adds the \`${skillName}\` skill.\n\nSubmitted via Skill Organizer.`,
          ignoreFocusOut: true
        });

        // 4. Submit.
        const result = await runWithProgress("Submitting skill as PR", async () => {
          return submitSkillPR({
            token: session.accessToken,
            owner: targetOwner,
            repo: targetRepo,
            baseBranch: targetBranch,
            skillsRootPath: targetSkillsRoot,
            skillSlug: skillName!,
            localSkillPath: skillPath!,
            prTitle,
            prBody: prBody ?? undefined
          });
        });

        const forkedNote = result.forked ? " (via fork)" : "";
        const action = await vscode.window.showInformationMessage(
          `PR #${result.prNumber} created${forkedNote}.`,
          "Open PR"
        );

        if (action === "Open PR") {
          vscode.env.openExternal(vscode.Uri.parse(result.prUrl));
        }
      });
    }
  );

  context.subscriptions.push(
    treeView,
    conflictDecorationProvider,
    addSource,
    addGitHubSource,
    addFromSkillsSh,
    chooseGitHubAccount,
    removeSource,
    refresh,
    explainMissingSkill,
    toggleSkill,
    setGlobalDefault,
    unsetGlobalDefault,
    removeFromWorkspace,
    removeFromGlobalDefaults,
    applyGlobalProfile,
    syncWorkspaceSkills,
    freezeSkill,
    unfreezeSkill,
    extendAgents,
    explainConflict,
    markManual,
    markManaged,
    uninstallSkill,
    updateManagedSkill,
    searchSkillsCommand,
    submitSkillPRCommand
  );
}

async function confirmSyncWorkspaceSkills(stateStore: StateStore): Promise<boolean> {
  const config = vscode.workspace.getConfiguration("skillOrganizer");
  const destinationPath = config.get<string>("destinationPath", ".github/skills");
  const enabledCount = stateStore.getWorkspaceEnabled().length;

  const message = enabledCount === 0
    ? `No skills are enabled. Sync will remove Skill Organizer-managed folders from '${destinationPath}'.`
    : `Sync will overwrite enabled skill folders and remove stale Skill Organizer-managed folders in '${destinationPath}'.`;

  const detail = "Review local changes before syncing. Folders not tracked by Skill Organizer are preserved.";
  const confirm = await vscode.window.showWarningMessage(message, { modal: true, detail }, "Resync");
  return confirm === "Resync";
}

export function deactivate(): void {
  // VS Code disposes subscriptions automatically.
}

type MissingSkillCommandPayload = {
  skillId: string;
  section: "workspace" | "global";
  globalDefault?: boolean;
};

function resolveMissingSkillPayload(
  input?: MissingSkillTreeNode | MissingSkillCommandPayload
): MissingSkillCommandPayload | undefined {
  if (!input) {
    return undefined;
  }

  if (input instanceof MissingSkillTreeNode) {
    return {
      skillId: input.missingSkillId,
      section: input.section,
      globalDefault: false
    };
  }

  if (typeof input.skillId === "string" && (input.section === "workspace" || input.section === "global")) {
    return {
      skillId: input.skillId,
      section: input.section,
      globalDefault: input.globalDefault === true
    };
  }

  return undefined;
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

async function enableSkillInWorkspace(skillId: string, stateStore: StateStore, sourceManager: SourceManager): Promise<void> {
  const frozenSkills = new Set(stateStore.getFrozenSkills());
  if (frozenSkills.has(skillId)) {
    const skill = await sourceManager.getSkillById(skillId);
    const label = skill?.slug ?? skillId;
    throw new Error(`'${label}' is frozen. Unlock it before enabling.`);
  }

  const skill = await sourceManager.getSkillById(skillId);
  if (skill) {
    const conflicts = await getLocalConflictFolderNames();
    const targetFolder = getSkillTargetFolderName(skill.slug);
    if (conflicts.has(targetFolder)) {
      throw new Error(
        `'${skill.slug}' conflicts with an existing local folder '${targetFolder}'. Remove or rename the local folder first.`
      );
    }
  }

  const enabled = new Set(stateStore.getWorkspaceEnabled());
  const previous = new Set(enabled);
  enabled.add(skillId);
  await stateStore.saveWorkspaceEnabled([...enabled]);

  try {
    await syncMaterializedEnabledSkills(sourceManager, stateStore);
  } catch (error) {
    await stateStore.saveWorkspaceEnabled([...previous]);
    throw error;
  }
}

async function syncMaterializedEnabledSkills(sourceManager: SourceManager, stateStore: StateStore): Promise<void> {
  const frozenSkills = new Set(stateStore.getFrozenSkills());
  const enabledIds = stateStore.getWorkspaceEnabled();
  const filteredEnabledIds = enabledIds.filter((id) => !frozenSkills.has(id));

  if (filteredEnabledIds.length !== enabledIds.length) {
    await stateStore.saveWorkspaceEnabled(filteredEnabledIds);
  }

  if (filteredEnabledIds.length === 0) {
    await materializeSkillsToWorkspace([]);
    return;
  }

  const resolvedSkills = await Promise.all(filteredEnabledIds.map((id) => sourceManager.getSkillById(id)));
  const skills = resolvedSkills.filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));

  if (skills.length === 0) {
    return;
  }

  await materializeSkillsToWorkspace(skills);
}

async function resolveMaterializedSkillName(
  node: MaterializedSkillTreeNode | undefined,
  mode: "all" | "managed"
): Promise<string | undefined> {
  if (node?.entry.folderName) {
    if (mode === "managed" && node.entry.type !== "managed") {
      vscode.window.showWarningMessage("Manual skills are protected from update.");
      return undefined;
    }

    return node.entry.folderName;
  }

  const materialized = await listMaterializedSkills();
  const candidates = mode === "managed" ? materialized.filter((entry) => entry.type === "managed") : materialized;

  if (candidates.length === 0) {
    vscode.window.showWarningMessage(mode === "managed" ? "No managed skills are available." : "No local skills found.");
    return undefined;
  }

  const selected = await vscode.window.showQuickPick(
    candidates.map((entry) => ({
      label: entry.folderName,
      description: entry.type === "manual" ? "Protected from updates" : "Managed",
      value: entry.folderName
    })),
    { title: mode === "managed" ? "Select a managed skill" : "Select a local skill" }
  );

  return selected?.value;
}

async function pickManagedSkillMatch(
  skillName: string,
  matches: SkillItem[],
  sourceManager: SourceManager
): Promise<SkillItem | undefined> {
  const sources = sourceManager.getSources();
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  const selected = await vscode.window.showQuickPick(
    matches.map((match) => {
      const source = sourceById.get(match.sourceId);
      const sourceLabel = source ? formatSourceForPicker(source) : "unknown source";

      return {
        label: match.slug,
        description: sourceLabel,
        detail: match.relativePath,
        value: match
      };
    }),
    {
      title: `Multiple source matches found for '${skillName}'`,
      placeHolder: "Choose which source to refresh from"
    }
  );

  return selected?.value;
}

function normalizeManagedSkillFolderName(input: string): string {
  const normalized = input.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
  return normalized || "skill";
}

function formatSourceForPicker(source: SkillSource): string {
  const uri = source.canonicalRepoUri ?? source.uri;

  try {
    const parsed = new URL(uri);
    if (parsed.hostname === "github.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
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

  const frozenSkills = stateStore.getFrozenSkills();
  const filteredFrozenSkills = frozenSkills.filter((skillId) => !skillId.startsWith(sourceSkillPrefix));
  if (filteredFrozenSkills.length !== frozenSkills.length) {
    await stateStore.saveFrozenSkills(filteredFrozenSkills);
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

async function openCopilotChat(): Promise<void> {
  const commandIds = [
    "workbench.action.chat.open",
    "workbench.action.chat.newChat",
    "github.copilot.chat.open",
    "github.copilot.chat.focus"
  ];

  for (const commandId of commandIds) {
    try {
      await vscode.commands.executeCommand(commandId);
      return;
    } catch {
      // Try the next possible command id across VS Code/Copilot versions.
    }
  }
}

async function openCopilotChatWithPrompt(prompt: string): Promise<boolean> {
  const commandAttempts: Array<{ id: string; args: unknown[] }> = [
    { id: "workbench.action.chat.open", args: [{ query: prompt, newChat: true }] },
    { id: "workbench.action.chat.open", args: [prompt] },
    { id: "github.copilot.chat.open", args: [{ query: prompt, newChat: true }] },
    { id: "github.copilot.chat.open", args: [prompt] }
  ];

  for (const attempt of commandAttempts) {
    try {
      await vscode.commands.executeCommand(attempt.id, ...attempt.args);
      return true;
    } catch {
      // Fall through and try alternative command/argument shapes.
    }
  }

  return false;
}

async function ensureAgentsFileExists(): Promise<boolean> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return false;
  }

  const agentsDirUri = vscode.Uri.joinPath(workspaceFolder.uri, ".github");
  const agentsUri = vscode.Uri.joinPath(workspaceFolder.uri, ".github", "AGENTS.md");
  try {
    await vscode.workspace.fs.stat(agentsUri);
    return false;
  } catch {
    await vscode.workspace.fs.createDirectory(agentsDirUri);
    await vscode.workspace.fs.writeFile(agentsUri, Buffer.from(DEFAULT_AGENTS_MD, "utf8"));
    return true;
  }
}

async function normalizeAgentsFileLocation(): Promise<"none" | "moved" | "duplicate"> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return "none";
  }

  const rootAgentsUri = vscode.Uri.joinPath(workspaceFolder.uri, "AGENTS.md");
  const githubAgentsUri = vscode.Uri.joinPath(workspaceFolder.uri, ".github", "AGENTS.md");

  const rootExists = await uriExists(rootAgentsUri);
  if (!rootExists) {
    return "none";
  }

  const githubExists = await uriExists(githubAgentsUri);
  if (githubExists) {
    return "duplicate";
  }

  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(workspaceFolder.uri, ".github"));
  await vscode.workspace.fs.rename(rootAgentsUri, githubAgentsUri, { overwrite: false });
  return "moved";
}

async function uriExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function pickGitHubSession(): Promise<vscode.AuthenticationSession | undefined> {
  // Check if there's already a signed-in session (without prompting).
  const existingSession = await vscode.authentication.getSession("github", ["repo"], {
    createIfNone: false
  });

  type AccountChoice = "current" | "switch";

  const items: Array<{ label: string; description?: string; value: AccountChoice }> = [];

  if (existingSession) {
    items.push({
      label: `$(github) ${existingSession.account.label}`,
      description: "Currently signed in",
      value: "current"
    });
  }

  items.push({
    label: existingSession ? "$(sign-in) Use a different GitHub account" : "$(sign-in) Sign in to GitHub",
    value: "switch"
  });

  // If no session exists, skip the picker and go straight to sign-in.
  if (!existingSession) {
    const session = await vscode.authentication.getSession("github", ["repo"], {
      createIfNone: true
    });

    if (!session?.accessToken) {
      throw new Error("GitHub authentication is required. Sign in and try again.");
    }

    return session;
  }

  const selected = await vscode.window.showQuickPick(items, {
    title: "GitHub Account",
    placeHolder: "Which GitHub account should be used for this PR?"
  });

  if (!selected) {
    return undefined;
  }

  if (selected.value === "current") {
    return existingSession;
  }

  // Force account re-selection to pick a different account.
  const session = await vscode.authentication.getSession("github", ["repo"], {
    createIfNone: true,
    clearSessionPreference: true
  });

  if (!session?.accessToken) {
    throw new Error("GitHub authentication is required. Sign in and try again.");
  }

  return session;
}
