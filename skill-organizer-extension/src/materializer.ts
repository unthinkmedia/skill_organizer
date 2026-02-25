import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { SkillItem } from "./types";

const MANIFEST_FILE = ".skill-organizer.manifest.json";

export async function materializeSkillsToWorkspace(skills: SkillItem[]): Promise<{ outputPath: string; copied: number; removed: number }> {
  const workspaceFolder = getPrimaryWorkspaceFolder();
  const config = vscode.workspace.getConfiguration("skillOrganizer");
  const destinationPath = config.get<string>("destinationPath", ".github/skills");

  const outputPath = path.join(workspaceFolder.uri.fsPath, destinationPath);
  await fs.mkdir(outputPath, { recursive: true });

  const materializationPlan = skills.map((skill) => ({
    skill,
    folderName: createTargetFolderName(skill)
  }));

  assertNoFolderNameConflicts(materializationPlan);

  const expectedFolders = new Set(materializationPlan.map((entry) => entry.folderName));

  const previouslyManaged = await readManagedFolders(outputPath);
  const foldersToRemove = [...previouslyManaged].filter((folder) => !expectedFolders.has(folder));
  for (const folderName of foldersToRemove) {
    await fs.rm(path.join(outputPath, folderName), { recursive: true, force: true });
  }

  let copied = 0;
  for (const { skill, folderName } of materializationPlan) {
    const targetPath = path.join(outputPath, folderName);

    await fs.rm(targetPath, { recursive: true, force: true });
    await fs.cp(skill.absolutePath, targetPath, { recursive: true, force: true });
    copied += 1;
  }

  await writeManagedFolders(outputPath, [...expectedFolders]);

  return { outputPath, copied, removed: foldersToRemove.length };
}

function getPrimaryWorkspaceFolder(): vscode.WorkspaceFolder {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    throw new Error("Open a workspace folder before materializing skills.");
  }

  return folders[0];
}

function createTargetFolderName(skill: SkillItem): string {
  return sanitizeFolderName(skill.slug);
}

function sanitizeFolderName(input: string): string {
  const normalized = input.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
  return normalized || "skill";
}

function assertNoFolderNameConflicts(plan: Array<{ skill: SkillItem; folderName: string }>): void {
  const folderToSkills = new Map<string, SkillItem[]>();

  for (const entry of plan) {
    const existing = folderToSkills.get(entry.folderName) ?? [];
    existing.push(entry.skill);
    folderToSkills.set(entry.folderName, existing);
  }

  const conflicts = [...folderToSkills.entries()].filter(([, items]) => items.length > 1);
  if (conflicts.length === 0) {
    return;
  }

  const conflictSummary = conflicts
    .map(([folderName, items]) => {
      const sources = items.map((item) => `${item.slug} (${item.relativePath})`).join(", ");
      return `'${folderName}' from ${sources}`;
    })
    .join("; ");

  throw new Error(
    `Cannot import or sync skills because name conflicts were found. Each skill folder name must be unique and match SKILL.md name. Conflicts: ${conflictSummary}`
  );
}

async function readManagedFolders(outputPath: string): Promise<Set<string>> {
  const manifestPath = path.join(outputPath, MANIFEST_FILE);

  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as { managedFolders?: unknown };
    if (!Array.isArray(parsed.managedFolders)) {
      throw new Error("invalid manifest");
    }

    const folders = parsed.managedFolders.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
    return new Set(folders);
  } catch {
    // Legacy fallback: before manifest existed, assume current top-level directories were managed.
    const entries = await fs.readdir(outputPath, { withFileTypes: true });
    const folderNames = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    return new Set(folderNames);
  }
}

async function writeManagedFolders(outputPath: string, folders: string[]): Promise<void> {
  const manifestPath = path.join(outputPath, MANIFEST_FILE);
  const payload = JSON.stringify({ managedFolders: [...folders].sort() }, null, 2);
  await fs.writeFile(manifestPath, `${payload}\n`, "utf8");
}
