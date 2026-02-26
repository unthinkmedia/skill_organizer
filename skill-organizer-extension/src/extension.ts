import * as vscode from "vscode";
import {
  assertCanInstallMaterializedSkill,
  listMaterializedSkills,
  markSkillAsManaged,
  markSkillAsManual,
  materializeSkillsToWorkspace,
  uninstallMaterializedSkill,
  updateManagedMaterializedSkill
} from "./materializer";
import { MaterializedSkillTreeNode, MissingSkillTreeNode, SkillTreeNode, SkillsTreeProvider, SourceTreeNode } from "./skillsTreeProvider";
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
        vscode.window.showInformationMessage("Opened Copilot Chat with the Extend AGENTS.md prompt.");
        return;
      }

      await vscode.env.clipboard.writeText(EXTEND_AGENTS_PROMPT);
      await openCopilotChat();
      vscode.window.showInformationMessage("Prompt copied. Paste into Copilot Chat to extend AGENTS.md.");
    });
  });

  context.subscriptions.push(
    treeView,
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
    markManual,
    markManaged,
    uninstallSkill,
    updateManagedSkill
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
  const confirm = await vscode.window.showWarningMessage(message, { modal: true, detail }, "Apply Sync");
  return confirm === "Apply Sync";
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
