import * as path from "path";
import * as vscode from "vscode";
import { listMaterializedSkills, MaterializedSkillEntry, getLocalConflictFolderNames, getSkillTargetFolderName } from "./materializer";
import { SourceManager } from "./sourceManager";
import { StateStore } from "./stateStore";
import { SkillItem } from "./types";

const blankIconPath = path.join(__dirname, "..", "media", "blank.svg");

export type SkillsViewMode = "sources" | "active" | "global";

export class SkillsTreeProvider implements vscode.TreeDataProvider<SkillsTreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<SkillsTreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly sourceManager: SourceManager,
    private readonly stateStore: StateStore,
    private readonly mode: SkillsViewMode
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: SkillsTreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SkillsTreeNode): Promise<SkillsTreeNode[]> {
    if (this.mode === "sources") {
      return this.getSourceChildren(element);
    }

    if (this.mode === "active") {
      return this.getActiveChildren(element);
    }

    return this.getGlobalChildren(element);
  }

  private async getSourceChildren(element?: SkillsTreeNode): Promise<SkillsTreeNode[]> {
    if (!element) {
      return [
        new SourceBucketTreeNode("Enabled Skills", "Checked in workspace", "checklist", "enabled"),
        new SourceBucketTreeNode("Available Skill Sources", "Discovered but not enabled", "repo-clone", "available")
      ];
    }

    if (element instanceof SourceBucketTreeNode) {
      const allSkills = await this.sourceManager.getSkills();
      const workspaceEnabled = new Set(this.stateStore.getWorkspaceEnabled());
      const sources = this.sourceManager.getSources();

      if (sources.length === 0) {
        return [new MessageTreeNode("No sources yet", "Use Add Source to begin", "info")];
      }

      // Enabled bucket: flat list of individual skills with source repo as description
      if (element.bucketType === "enabled") {
        const sourceMap = new Map(sources.map((s) => [s.id, s]));
        const globalDefaults = new Set(this.stateStore.getGlobalDefaults());
        const enabledSkills = allSkills.filter((skill) => workspaceEnabled.has(skill.id));

        const skillNodes = enabledSkills.map((skill) => {
          const source = sourceMap.get(skill.sourceId);
          const sourceLabel = source ? getSourceLabel(source.uri) : "unknown source";
          return toEnabledSkillNode(skill, sourceLabel, globalDefaults.has(skill.id));
        });

        const missingNodes = [...workspaceEnabled]
          .filter((skillId) => !allSkills.some((skill) => skill.id === skillId))
          .map((skillId) => toMissingSkillNode(skillId, "workspace", false));

        if (skillNodes.length === 0 && missingNodes.length === 0) {
          return [new MessageTreeNode("No enabled skills", "Check a skill in Sources to enable it", "info")];
        }

        return [...skillNodes, ...missingNodes];
      }

      // Available bucket: grouped by source (existing behavior)
      const nodes = sources
        .map((source) => {
          const sourceSkills = allSkills.filter((skill) => skill.sourceId === source.id);
          const filtered = sourceSkills.filter((skill) => !workspaceEnabled.has(skill.id));

          if (filtered.length === 0) {
            return undefined;
          }

          const enabledCount = sourceSkills.filter((skill) => workspaceEnabled.has(skill.id)).length;

          const item = new vscode.TreeItem(getSourceLabel(source.uri), vscode.TreeItemCollapsibleState.None);
          item.description = `${filtered.length} skills`;
          item.tooltip = source.uri;
          item.iconPath = new vscode.ThemeIcon("repo");
          item.contextValue = "sourceItem";
          item.id = `${source.id}:${element.bucketType}`;
          item.command = {
            command: "skillOrganizer.browseSourceSkills",
            title: "Browse Skills in Source",
            arguments: [source.id]
          };
          item.resourceUri = vscode.Uri.parse(`skill-source-badge:/${encodeURIComponent(source.id)}?${enabledCount}`);
          return new SourceTreeNode(item, source.id, element.bucketType);
        })
        .filter((node): node is SourceTreeNode => Boolean(node));

      if (nodes.length === 0) {
        return [new MessageTreeNode("No available skills", "All discovered skills are enabled", "info")];
      }

      return nodes;
    }

    if (element instanceof SourceTreeNode) {
      const allSkills = await this.sourceManager.getSkills();
      const workspaceEnabled = new Set(this.stateStore.getWorkspaceEnabled());
      const globalDefaults = new Set(this.stateStore.getGlobalDefaults());
      const frozenSkills = new Set(this.stateStore.getFrozenSkills());
      const conflictFolders = await getLocalConflictFolderNames();

      return allSkills
        .filter((skill) => skill.sourceId === element.sourceId)
        .filter((skill) => {
          if (element.bucketType === "enabled") {
            return workspaceEnabled.has(skill.id);
          }

          if (element.bucketType === "available") {
            return !workspaceEnabled.has(skill.id);
          }

          return true;
        })
        .map((skill) => toSkillNode(skill, workspaceEnabled, globalDefaults, frozenSkills, conflictFolders));
    }

    return [];
  }

  private async getActiveChildren(element?: SkillsTreeNode): Promise<SkillsTreeNode[]> {
    if (element) {
      return [];
    }

    const allSkills = await this.sourceManager.getSkills();
    const materialized = await listMaterializedSkills();
    const globalDefaults = new Set(this.stateStore.getGlobalDefaults());
    const reconnectableFolderNames = new Set(allSkills.map((skill) => getSkillTargetFolderName(skill.slug)));
    const folderToSkillId = new Map<string, string>();
    for (const skill of allSkills) {
      folderToSkillId.set(getSkillTargetFolderName(skill.slug), skill.id);
    }
    const nodes = materialized.map((entry) => toMaterializedSkillNode(entry, reconnectableFolderNames, globalDefaults, folderToSkillId));

    return nodes.length > 0
      ? nodes
      : [new MessageTreeNode("No local skills", "Run sync to copy enabled skills", "folder-opened")];
  }

  private async getGlobalChildren(element?: SkillsTreeNode): Promise<SkillsTreeNode[]> {
    if (element) {
      return [];
    }

    const allSkills = await this.sourceManager.getSkills();
    const globalDefaults = new Set(this.stateStore.getGlobalDefaults());

    const nodes = [...globalDefaults]
      .map((skillId) => ({
        skillId,
        skill: allSkills.find((skill) => skill.id === skillId)
      }))
      .map(({ skillId, skill }) => toGlobalSkillNode(skillId, skill))
      .filter((node): node is SkillTreeNode | MissingSkillTreeNode => Boolean(node));

    return nodes.length > 0
      ? nodes
      : [new MessageTreeNode("No global skills", "Mark skills as global to sync to user profile", "star-empty")];
  }
}

export abstract class SkillsTreeNode extends vscode.TreeItem {}

export class MaterializedSkillTreeNode extends SkillsTreeNode {
  public readonly skillId?: string;

  constructor(
    item: vscode.TreeItem,
    public readonly entry: MaterializedSkillEntry,
    skillId?: string
  ) {
    super(item.label ?? "", item.collapsibleState);
    this.contextValue = item.contextValue;
    this.id = item.id;
    this.description = item.description;
    this.tooltip = item.tooltip;
    this.iconPath = item.iconPath;
    this.skillId = skillId;
  }
}

type SourceBucketType = "enabled" | "available";

export class SourceBucketTreeNode extends SkillsTreeNode {
  constructor(
    label: string,
    description: string,
    iconName: string,
    public readonly bucketType: SourceBucketType
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = description;
    this.iconPath = new vscode.ThemeIcon(iconName);
    this.contextValue = `sourceBucket_${bucketType}`;
  }
}

export class SourceTreeNode extends SkillsTreeNode {
  constructor(item: vscode.TreeItem, public readonly sourceId: string, public readonly bucketType: SourceBucketType | "all") {
    super(item.label ?? "", item.collapsibleState);
    this.contextValue = item.contextValue;
    this.id = item.id;
    this.description = item.description;
    this.tooltip = item.tooltip;
    this.command = item.command;
    this.resourceUri = item.resourceUri;
  }
}

export class SkillTreeNode extends SkillsTreeNode {
  constructor(
    item: vscode.TreeItem,
    public readonly skill: SkillItem,
    public readonly enabled: boolean,
    public readonly globalDefault: boolean
  ) {
    super(item.label ?? "", item.collapsibleState);
    this.contextValue = item.contextValue;
    this.id = item.id;
    this.description = item.description;
    this.tooltip = item.tooltip;
    this.command = item.command;
    this.iconPath = item.iconPath;
    this.checkboxState = item.checkboxState;
  }
}

export class MissingSkillTreeNode extends SkillsTreeNode {
  constructor(
    item: vscode.TreeItem,
    public readonly missingSkillId: string,
    public readonly section: "workspace" | "global"
  ) {
    super(item.label ?? "", item.collapsibleState);
    this.contextValue = item.contextValue;
    this.id = item.id;
    this.description = item.description;
    this.tooltip = item.tooltip;
    this.command = item.command;
    this.iconPath = item.iconPath;
  }
}

export class MessageTreeNode extends SkillsTreeNode {
  constructor(label: string, description: string, iconName: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.iconPath = new vscode.ThemeIcon(iconName);
    this.contextValue = "messageItem";
  }
}

function toSkillNode(
  skill: SkillItem,
  workspaceEnabled: Set<string>,
  globalDefaults: Set<string>,
  frozenSkills: Set<string>,
  conflictFolders: Set<string>
): SkillTreeNode {
  const enabled = workspaceEnabled.has(skill.id);
  const globalDefault = globalDefaults.has(skill.id);
  const frozen = frozenSkills.has(skill.id);
  const targetFolder = getSkillTargetFolderName(skill.slug);
  const hasConflict = conflictFolders.has(targetFolder);

  const item = new vscode.TreeItem(skill.slug, vscode.TreeItemCollapsibleState.None);
  item.id = createTreeItemId(skill.id, "sources");

  if (hasConflict) {
    item.contextValue = "sourceSkillItemConflict";
    item.tooltip = `${skill.relativePath}\nLocal conflict: a folder named '${targetFolder}' already exists in destination.\nRemove or rename the local folder to enable this skill.`;
    item.description = "local conflict";
    item.iconPath = new vscode.ThemeIcon("circle-slash", new vscode.ThemeColor("disabledForeground"));
    item.resourceUri = vscode.Uri.parse(`skill-organizer-disabled:/${encodeURIComponent(skill.id)}`);
    item.command = {
      command: "skillOrganizer.explainConflict",
      title: "Explain Conflict",
      arguments: [skill.slug, targetFolder]
    };
    return new SkillTreeNode(item, skill, false, globalDefault);
  }

  item.contextValue = frozen ? "sourceSkillItemFrozen" : (globalDefault ? "sourceSkillItemGlobal" : "sourceSkillItem");
  item.tooltip = `${skill.relativePath}\n${enabled ? "Enabled in workspace" : "Disabled in workspace"}${frozen ? "\nVersion locked (unlock to enable)" : ""}${globalDefault ? "\nGlobal default" : ""}`;

  const descriptionParts: string[] = [];
  descriptionParts.push(enabled ? "enabled" : "disabled");
  if (frozen) {
    descriptionParts.push("version locked");
  }
  if (globalDefault) {
    descriptionParts.push("global");
  }
  item.description = descriptionParts.join(" | ");

  if (frozen) {
    item.iconPath = new vscode.ThemeIcon("lock");
  } else {
    item.checkboxState = enabled
      ? vscode.TreeItemCheckboxState.Checked
      : vscode.TreeItemCheckboxState.Unchecked;
  }

  return new SkillTreeNode(item, skill, enabled, globalDefault);
}

function toEnabledSkillNode(skill: SkillItem, sourceLabel: string, globalDefault: boolean): SkillTreeNode {
  const item = new vscode.TreeItem(skill.slug, vscode.TreeItemCollapsibleState.None);
  item.id = createTreeItemId(skill.id, "sources");
  item.contextValue = globalDefault ? "sourceSkillItemGlobal" : "sourceSkillItem";
  item.description = sourceLabel;
  item.tooltip = `${skill.relativePath}\nSource: ${sourceLabel}${globalDefault ? "\nGlobal default" : ""}`;
  item.checkboxState = vscode.TreeItemCheckboxState.Checked;
  return new SkillTreeNode(item, skill, true, globalDefault);
}

function toGlobalSkillNode(skillId: string, skill: SkillItem | undefined): SkillTreeNode | MissingSkillTreeNode | undefined {
  if (!skill) {
    return toMissingSkillNode(skillId, "global", false);
  }

  const item = new vscode.TreeItem(skill.slug, vscode.TreeItemCollapsibleState.None);
  item.id = createTreeItemId(skill.id, "global");
  item.contextValue = "globalSkillItem";
  item.description = skill.relativePath;
  item.tooltip = `${skill.relativePath}\nGlobal default`;
  item.iconPath = new vscode.ThemeIcon("star-full");

  return new SkillTreeNode(item, skill, false, true);
}

function toMissingSkillNode(
  skillId: string,
  section: "workspace" | "global",
  globalDefault: boolean
): MissingSkillTreeNode {
  const item = new vscode.TreeItem("Missing skill", vscode.TreeItemCollapsibleState.None);
  item.id = createTreeItemId(skillId, section);
  item.contextValue = section === "workspace" ? "missingWorkspaceSkillItem" : "missingGlobalSkillItem";
  item.description = "Click for recovery steps";

  const scopeLabel = section === "workspace" ? "workspace enabled" : "global defaults";
  const globalLine = section === "workspace" && globalDefault ? "\nAlso set as global default" : "";
  item.tooltip = `Skill id: ${skillId}\nMissing from current sources\nReferenced by ${scopeLabel}${globalLine}`;
  item.iconPath = new vscode.ThemeIcon("warning");
  item.command = {
    command: "skillOrganizer.explainMissingSkill",
    title: "Explain Missing Skill",
    arguments: [
      {
        skillId,
        section,
        globalDefault
      }
    ]
  };

  return new MissingSkillTreeNode(item, skillId, section);
}

function toMaterializedSkillNode(
  entry: MaterializedSkillEntry,
  reconnectableFolderNames: Set<string>,
  globalDefaults: Set<string>,
  folderToSkillId: Map<string, string>
): MaterializedSkillTreeNode {
  const isManual = entry.type === "manual";
  const reconnectable = isManual && reconnectableFolderNames.has(entry.folderName);
  const skillId = folderToSkillId.get(entry.folderName);
  const isGlobal = skillId ? globalDefaults.has(skillId) : false;
  const item = new vscode.TreeItem(
    `${isManual ? "[manual]" : "[managed]"} ${entry.folderName}`,
    vscode.TreeItemCollapsibleState.None
  );

  item.id = createTreeItemId(entry.folderName, "materialized");
  if (!isManual) {
    item.contextValue = isGlobal ? "materializedManagedSkillItemGlobal" : "materializedManagedSkillItem";
    item.description = isGlobal ? "Managed by sync | global" : "Managed by sync";
    item.tooltip = `${entry.path}\nManaged by Skill Organizer${isGlobal ? "\nGlobal default" : ""}`;
  } else if (reconnectable) {
    item.contextValue = isGlobal ? "materializedManualSkillItemReconnectableGlobal" : "materializedManualSkillItemReconnectable";
    item.description = isGlobal ? "Protected from updates | source match found | global" : "Protected from updates | source match found";
    item.tooltip = `${entry.path}\nProtected from updates\nA matching source skill exists, so reconnect is available.${isGlobal ? "\nGlobal default" : ""}`;
  } else {
    item.contextValue = "materializedManualSkillItemUnlinked";
    item.description = "Protected from updates | no source match";
    item.tooltip = `${entry.path}\nProtected from updates\nNo matching source skill found. Reconnect is unavailable.`;
  }

  item.iconPath = new vscode.ThemeIcon(isManual ? "lock" : "package");

  return new MaterializedSkillTreeNode(item, entry, skillId);
}

const SOURCE_BADGE_SCHEME = "skill-source-badge";

export class SourceBadgeDecorationProvider implements vscode.FileDecorationProvider {
  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  refresh(): void {
    this._onDidChangeFileDecorations.fire(undefined);
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== SOURCE_BADGE_SCHEME) {
      return undefined;
    }
    const count = parseInt(uri.query, 10);
    if (!count || count <= 0) {
      return undefined;
    }
    return new vscode.FileDecoration(
      String(count),
      `${count} skill${count === 1 ? "" : "s"} enabled`,
      new vscode.ThemeColor("charts.green")
    );
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

function createTreeItemId(skillId: string, section: "sources" | "workspace" | "global" | "materialized"): string {
  return `${section}:${skillId}`;
}
