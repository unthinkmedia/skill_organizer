import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { SkillItem } from "./types";

export async function materializeSkillsToWorkspace(skills: SkillItem[]): Promise<{ outputPath: string; copied: number }> {
  const workspaceFolder = getPrimaryWorkspaceFolder();
  const config = vscode.workspace.getConfiguration("skillOrganizer");
  const destinationPath = config.get<string>("destinationPath", ".github/skills");

  const outputPath = path.join(workspaceFolder.uri.fsPath, destinationPath);
  await fs.mkdir(outputPath, { recursive: true });

  let copied = 0;
  const usedNames = new Set<string>();

  for (const skill of skills) {
    const folderName = createTargetFolderName(skill, usedNames);
    const targetPath = path.join(outputPath, folderName);

    await fs.rm(targetPath, { recursive: true, force: true });
    await fs.cp(skill.absolutePath, targetPath, { recursive: true, force: true });
    copied += 1;
  }

  return { outputPath, copied };
}

function getPrimaryWorkspaceFolder(): vscode.WorkspaceFolder {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    throw new Error("Open a workspace folder before materializing skills.");
  }

  return folders[0];
}

function createTargetFolderName(skill: SkillItem, usedNames: Set<string>): string {
  const base = sanitizeFolderName(skill.slug);

  if (!usedNames.has(base)) {
    usedNames.add(base);
    return base;
  }

  const withSource = `${base}-${skill.sourceId.slice(0, 6)}`;
  if (!usedNames.has(withSource)) {
    usedNames.add(withSource);
    return withSource;
  }

  let i = 2;
  while (true) {
    const candidate = `${withSource}-${i}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
    i += 1;
  }
}

function sanitizeFolderName(input: string): string {
  const normalized = input.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
  return normalized || "skill";
}
