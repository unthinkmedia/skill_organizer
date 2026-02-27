import * as vscode from "vscode";
import { listMaterializedSkills, MaterializedSkillEntry, getLocalConflictFolderNames, getSkillTargetFolderName } from "./materializer";
import { SourceManager } from "./sourceManager";
import { StateStore } from "./stateStore";
import { SkillItem } from "./types";

export class SkillsTreeProvider implements vscode.TreeDataProvider<SkillsTreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<SkillsTreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly sourceManager: SourceManager,
    private readonly stateStore: StateStore
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: SkillsTreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SkillsTreeNode): Promise<SkillsTreeNode[]> {
    if (!element) {
      return [
        new SectionTreeNode("Sources", "Configured repositories", "repo", "sources"),
        new SectionTreeNode("Local Skills", "Found in destination path", "folder-library", "materialized"),
        new SectionTreeNode("Workspace Enabled", "Active in this workspace", "checklist", "workspace"),
        new SectionTreeNode("Global Skills", "Synced to user profile", "star-full", "global")
      ];
    }

    if (element instanceof SectionTreeNode) {
      const allSkills = await this.sourceManager.getSkills();
      const workspaceEnabled = new Set(this.stateStore.getWorkspaceEnabled());
      const globalDefaults = new Set(this.stateStore.getGlobalDefaults());
      const frozenSkills = new Set(this.stateStore.getFrozenSkills());

      if (element.sectionType === "sources") {
        const sources = this.sourceManager.getSources();
        if (sources.length === 0) {
          return [new MessageTreeNode("No sources yet", "Use Add Source to begin", "info")];
        }

        return sources.map((source) => {
          const sourceSkills = allSkills.filter((skill) => skill.sourceId === source.id);
          const item = new vscode.TreeItem(getSourceLabel(source.uri), vscode.TreeItemCollapsibleState.Collapsed);
          item.description = `${sourceSkills.length} skills`;
          item.tooltip = source.uri;
          item.iconPath = new vscode.ThemeIcon("repo");
          item.contextValue = "sourceItem";
          item.id = source.id;
          return new SourceTreeNode(item, source.id);
        });
      }

      if (element.sectionType === "workspace") {
        const nodes = [...workspaceEnabled]
          .map((skillId) => ({
            skillId,
            skill: allSkills.find((candidate) => candidate.id === skillId),
            globalDefault: globalDefaults.has(skillId)
          }))
          .map(({ skillId, skill, globalDefault }) => toWorkspaceSkillNode(skillId, skill, globalDefault))
          .filter((node): node is SkillTreeNode | MissingSkillTreeNode => Boolean(node));

        return nodes.length > 0 ? nodes : [new MessageTreeNode("No skills enabled", "Toggle a skill to enable it", "circle-large-outline")];
      }

      if (element.sectionType === "global") {
        const nodes = [...globalDefaults]
          .map((skillId) => ({
            skillId,
            skill: allSkills.find((skill) => skill.id === skillId)
          }))
          .map(({ skillId, skill }) => toGlobalSkillNode(skillId, skill))
          .filter((node): node is SkillTreeNode | MissingSkillTreeNode => Boolean(node));

        return nodes.length > 0 ? nodes : [new MessageTreeNode("No global skills", "Mark skills as global to sync to user profile", "star-empty")];
      }

      if (element.sectionType === "materialized") {
        const materialized = await listMaterializedSkills();
        const nodes = materialized.map((entry) => toMaterializedSkillNode(entry));
        return nodes.length > 0
          ? nodes
          : [new MessageTreeNode("No local skills", "Run sync to copy enabled skills", "folder-opened")];
      }

      return [];
    }

    if (element instanceof SourceTreeNode) {
      const allSkills = await this.sourceManager.getSkills();
      const workspaceEnabled = new Set(this.stateStore.getWorkspaceEnabled());
      const globalDefaults = new Set(this.stateStore.getGlobalDefaults());
      const frozenSkills = new Set(this.stateStore.getFrozenSkills());
      const conflictFolders = await getLocalConflictFolderNames();

      return allSkills
        .filter((skill) => skill.sourceId === element.sourceId)
        .map((skill) => toSkillNode(skill, workspaceEnabled, globalDefaults, frozenSkills, conflictFolders));
    }

    return [];
  }
}

export abstract class SkillsTreeNode extends vscode.TreeItem {}

export class MaterializedSkillTreeNode extends SkillsTreeNode {
  constructor(
    item: vscode.TreeItem,
    public readonly entry: MaterializedSkillEntry
  ) {
    super(item.label ?? "", item.collapsibleState);
    this.contextValue = item.contextValue;
    this.id = item.id;
    this.description = item.description;
    this.tooltip = item.tooltip;
    this.iconPath = item.iconPath;
  }
}

type SectionType = "sources" | "workspace" | "global" | "materialized";

export class SectionTreeNode extends SkillsTreeNode {
  constructor(
    label: string,
    description: string,
    iconName: string,
    public readonly sectionType: SectionType
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.description = description;
    this.iconPath = new vscode.ThemeIcon(iconName);
    this.contextValue = `sectionItem_${sectionType}`;
  }
}

export class SourceTreeNode extends SkillsTreeNode {
  constructor(item: vscode.TreeItem, public readonly sourceId: string) {
    super(item.label ?? "", item.collapsibleState);
    this.contextValue = item.contextValue;
    this.id = item.id;
    this.description = item.description;
    this.tooltip = item.tooltip;
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

  item.contextValue = frozen ? "sourceSkillItemFrozen" : "sourceSkillItem";
  item.tooltip = `${skill.relativePath}\n${enabled ? "Enabled in workspace" : "Disabled in workspace"}${frozen ? "\nVersion locked (unlock to enable)" : ""}`;

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

function toWorkspaceSkillNode(
  skillId: string,
  skill: SkillItem | undefined,
  globalDefault: boolean
): SkillTreeNode | MissingSkillTreeNode | undefined {
  if (!skill) {
    return toMissingSkillNode(skillId, "workspace", globalDefault);
  }

  const item = new vscode.TreeItem(skill.slug, vscode.TreeItemCollapsibleState.None);
  item.id = createTreeItemId(skill.id, "workspace");
  item.contextValue = globalDefault ? "workspaceSkillItemGlobal" : "workspaceSkillItem";
  item.description = globalDefault ? `${skill.relativePath} | global` : skill.relativePath;
  item.tooltip = `${skill.relativePath}\nEnabled in workspace${globalDefault ? "\nGlobal default" : ""}`;
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

function toMaterializedSkillNode(entry: MaterializedSkillEntry): MaterializedSkillTreeNode {
  const isManual = entry.type === "manual";
  const item = new vscode.TreeItem(
    `${isManual ? "[manual]" : "[managed]"} ${entry.folderName}`,
    vscode.TreeItemCollapsibleState.None
  );

  item.id = createTreeItemId(entry.folderName, "materialized");
  item.contextValue = isManual ? "materializedManualSkillItem" : "materializedManagedSkillItem";
  item.description = isManual ? "Protected from updates" : "Managed by sync";
  item.tooltip = `${entry.path}\n${isManual ? "Protected from updates" : "Managed by Skill Organizer"}`;
  item.iconPath = new vscode.ThemeIcon(isManual ? "lock" : "package");

  return new MaterializedSkillTreeNode(item, entry);
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
