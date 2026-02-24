import * as vscode from "vscode";
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
        new SectionTreeNode("Workspace Enabled", "Active in this workspace", "checklist", "workspace"),
        new SectionTreeNode("Global Defaults", "Applied by global profile", "star-full", "global")
      ];
    }

    if (element instanceof SectionTreeNode) {
      const allSkills = await this.sourceManager.getSkills();
      const workspaceEnabled = new Set(this.stateStore.getWorkspaceEnabled());
      const globalDefaults = new Set(this.stateStore.getGlobalDefaults());

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
          .map((skillId) => allSkills.find((skill) => skill.id === skillId))
          .map((skill) => toWorkspaceSkillNode(skill))
          .filter((node): node is SkillTreeNode | MessageTreeNode => Boolean(node));

        return nodes.length > 0 ? nodes : [new MessageTreeNode("No skills enabled", "Toggle a skill to enable it", "circle-large-outline")];
      }

      if (element.sectionType === "global") {
        const nodes = [...globalDefaults]
          .map((skillId) => allSkills.find((skill) => skill.id === skillId))
          .map((skill) => toGlobalSkillNode(skill))
          .filter((node): node is SkillTreeNode | MessageTreeNode => Boolean(node));

        return nodes.length > 0 ? nodes : [new MessageTreeNode("No global defaults", "Mark skills as global defaults", "star-empty")];
      }

      return [];
    }

    if (element instanceof SourceTreeNode) {
      const allSkills = await this.sourceManager.getSkills();
      const workspaceEnabled = new Set(this.stateStore.getWorkspaceEnabled());
      const globalDefaults = new Set(this.stateStore.getGlobalDefaults());

      return allSkills
        .filter((skill) => skill.sourceId === element.sourceId)
        .map((skill) => toSkillNode(skill, workspaceEnabled, globalDefaults));
    }

    return [];
  }
}

export abstract class SkillsTreeNode extends vscode.TreeItem {}

type SectionType = "sources" | "workspace" | "global";

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
    this.contextValue = "sectionItem";
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
  globalDefaults: Set<string>
): SkillTreeNode {
  const enabled = workspaceEnabled.has(skill.id);
  const globalDefault = globalDefaults.has(skill.id);

  const item = new vscode.TreeItem(skill.slug, vscode.TreeItemCollapsibleState.None);
  item.id = createTreeItemId(skill.id, "sources");
  item.contextValue = "sourceSkillItem";
  item.tooltip = `${skill.relativePath}\n${enabled ? "Enabled in workspace" : "Disabled in workspace"}`;

  const descriptionParts: string[] = [];
  descriptionParts.push(enabled ? "enabled" : "disabled");
  if (globalDefault) {
    descriptionParts.push("global");
  }
  item.description = descriptionParts.join(" | ");

  item.iconPath = new vscode.ThemeIcon(enabled ? "check" : "circle-large-outline");
  item.command = {
    command: "skillOrganizer.toggleSkill",
    title: "Toggle Skill",
    arguments: [skill.id]
  };

  return new SkillTreeNode(item, skill, enabled, globalDefault);
}

function toWorkspaceSkillNode(skill: SkillItem | undefined): SkillTreeNode | MessageTreeNode | undefined {
  if (!skill) {
    return new MessageTreeNode("Missing skill", "Source no longer provides this skill", "warning");
  }

  const item = new vscode.TreeItem(skill.slug, vscode.TreeItemCollapsibleState.None);
  item.id = createTreeItemId(skill.id, "workspace");
  item.contextValue = "workspaceSkillItem";
  item.description = skill.relativePath;
  item.tooltip = `${skill.relativePath}\nEnabled in workspace`;
  item.iconPath = new vscode.ThemeIcon("check");

  return new SkillTreeNode(item, skill, true, false);
}

function toGlobalSkillNode(skill: SkillItem | undefined): SkillTreeNode | MessageTreeNode | undefined {
  if (!skill) {
    return new MessageTreeNode("Missing skill", "Source no longer provides this global default", "warning");
  }

  const item = new vscode.TreeItem(skill.slug, vscode.TreeItemCollapsibleState.None);
  item.id = createTreeItemId(skill.id, "global");
  item.contextValue = "globalSkillItem";
  item.description = skill.relativePath;
  item.tooltip = `${skill.relativePath}\nGlobal default`;
  item.iconPath = new vscode.ThemeIcon("star-full");

  return new SkillTreeNode(item, skill, false, true);
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

function createTreeItemId(skillId: string, section: "sources" | "workspace" | "global"): string {
  return `${section}:${skillId}`;
}
