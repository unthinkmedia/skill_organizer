import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
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
    folderName: createStableTargetFolderName(skill)
  }));
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

function createStableTargetFolderName(skill: SkillItem): string {
  const base = sanitizeFolderName(skill.slug);
  const suffix = crypto.createHash("sha1").update(skill.id).digest("hex").slice(0, 8);
  return `${base}-${suffix}`;
}

function sanitizeFolderName(input: string): string {
  const normalized = input.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
  return normalized || "skill";
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
