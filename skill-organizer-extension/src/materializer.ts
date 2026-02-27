import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { SkillItem } from "./types";

const MANIFEST_FILE = ".skill-organizer.manifest.json";

export interface SkillManifest {
  managedFolders: string[];
  manualFolders: string[];
}

export interface MaterializedSkillEntry {
  folderName: string;
  type: "manual" | "managed";
  path: string;
  protectedFromUpdates: boolean;
}

export async function materializeSkillsToWorkspace(skills: SkillItem[]): Promise<{ outputPath: string; copied: number; removed: number; skippedManual: number }> {
  const workspaceFolder = getPrimaryWorkspaceFolder();
  const outputPath = getOutputPath(workspaceFolder);
  await fs.mkdir(outputPath, { recursive: true });

  const materializationPlan = skills.map((skill) => ({
    skill,
    folderName: createTargetFolderName(skill)
  }));

  assertNoFolderNameConflicts(materializationPlan);

  const manifest = await loadManifest(outputPath);
  const collidingManualFolders = new Set(
    materializationPlan.map((entry) => entry.folderName).filter((folder) => manifest.manualFolders.includes(folder))
  );

  const filteredPlan = materializationPlan.filter((entry) => !collidingManualFolders.has(entry.folderName));
  const expectedFolders = new Set(filteredPlan.map((entry) => entry.folderName));

  const foldersToRemove = manifest.managedFolders.filter((folder) => !expectedFolders.has(folder));
  for (const folderName of foldersToRemove) {
    await fs.rm(path.join(outputPath, folderName), { recursive: true, force: true });
  }

  let copied = 0;
  for (const { skill, folderName } of filteredPlan) {
    const targetPath = path.join(outputPath, folderName);

    await fs.rm(targetPath, { recursive: true, force: true });
    await fs.cp(skill.absolutePath, targetPath, { recursive: true, force: true });
    copied += 1;
  }

  await writeManifest(outputPath, {
    managedFolders: [...expectedFolders],
    manualFolders: manifest.manualFolders
  });

  return { outputPath, copied, removed: foldersToRemove.length, skippedManual: collidingManualFolders.size };
}

export async function listMaterializedSkills(): Promise<MaterializedSkillEntry[]> {
  const workspaceFolder = getPrimaryWorkspaceFolder();
  const outputPath = getOutputPath(workspaceFolder);
  await fs.mkdir(outputPath, { recursive: true });

  const manifest = await loadManifest(outputPath);
  const entries: MaterializedSkillEntry[] = [];

  for (const folderName of manifest.manualFolders) {
    entries.push({
      folderName,
      type: "manual",
      path: path.join(outputPath, folderName),
      protectedFromUpdates: true
    });
  }

  for (const folderName of manifest.managedFolders) {
    entries.push({
      folderName,
      type: "managed",
      path: path.join(outputPath, folderName),
      protectedFromUpdates: false
    });
  }

  entries.sort((a, b) => {
    if (a.type === b.type) {
      return a.folderName.localeCompare(b.folderName);
    }

    return a.type === "manual" ? -1 : 1;
  });

  return entries;
}

export async function markSkillAsManual(skillName: string): Promise<void> {
  const outputPath = getOutputPath(getPrimaryWorkspaceFolder());
  await fs.mkdir(outputPath, { recursive: true });

  const manifest = await loadManifest(outputPath);
  const normalized = sanitizeFolderName(skillName);

  if (!manifest.manualFolders.includes(normalized)) {
    manifest.manualFolders.push(normalized);
  }

  manifest.managedFolders = manifest.managedFolders.filter((folder) => folder !== normalized);
  await writeManifest(outputPath, manifest);
}

export async function assertCanInstallMaterializedSkill(skillName: string, asManual: boolean): Promise<void> {
  const outputPath = getOutputPath(getPrimaryWorkspaceFolder());
  await fs.mkdir(outputPath, { recursive: true });

  const manifest = await loadManifest(outputPath);
  const normalized = sanitizeFolderName(skillName);
  const existsInManaged = manifest.managedFolders.includes(normalized);
  const existsInManual = manifest.manualFolders.includes(normalized);

  if (!existsInManaged && !existsInManual) {
    return;
  }

  if (!asManual && existsInManual) {
    throw new Error(`Cannot install managed skill '${normalized}' because a manual protected skill with that name already exists.`);
  }

  throw new Error(`Cannot install '${normalized}' because a skill with the same name already exists in the manifest.`);
}

export async function markSkillAsManaged(skillName: string): Promise<void> {
  const outputPath = getOutputPath(getPrimaryWorkspaceFolder());
  await fs.mkdir(outputPath, { recursive: true });

  const manifest = await loadManifest(outputPath);
  const normalized = sanitizeFolderName(skillName);

  if (!manifest.managedFolders.includes(normalized)) {
    manifest.managedFolders.push(normalized);
  }

  manifest.manualFolders = manifest.manualFolders.filter((folder) => folder !== normalized);
  await writeManifest(outputPath, manifest);
}

export async function uninstallMaterializedSkill(skillName: string, force = false): Promise<void> {
  const outputPath = getOutputPath(getPrimaryWorkspaceFolder());
  await fs.mkdir(outputPath, { recursive: true });

  const manifest = await loadManifest(outputPath);
  const normalized = sanitizeFolderName(skillName);
  const isManual = manifest.manualFolders.includes(normalized);

  if (isManual && !force) {
    throw new Error(`'${normalized}' is manual and protected. Re-run uninstall with force enabled to remove it.`);
  }

  manifest.managedFolders = manifest.managedFolders.filter((folder) => folder !== normalized);
  manifest.manualFolders = manifest.manualFolders.filter((folder) => folder !== normalized);

  await fs.rm(path.join(outputPath, normalized), { recursive: true, force: true });
  await writeManifest(outputPath, manifest);
}

export async function updateManagedMaterializedSkill(skillName: string, skills: SkillItem[]): Promise<void> {
  const outputPath = getOutputPath(getPrimaryWorkspaceFolder());
  await fs.mkdir(outputPath, { recursive: true });

  const normalized = sanitizeFolderName(skillName);
  const manifest = await loadManifest(outputPath);
  if (manifest.manualFolders.includes(normalized)) {
    throw new Error(`'${normalized}' is manual and protected from updates.`);
  }

  const matched = skills.find((skill) => createTargetFolderName(skill) === normalized);
  if (!matched) {
    throw new Error(`No enabled managed skill matches '${normalized}'.`);
  }

  const targetPath = path.join(outputPath, normalized);
  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.cp(matched.absolutePath, targetPath, { recursive: true, force: true });

  if (!manifest.managedFolders.includes(normalized)) {
    manifest.managedFolders.push(normalized);
  }

  await writeManifest(outputPath, manifest);
}

function getPrimaryWorkspaceFolder(): vscode.WorkspaceFolder {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    throw new Error("Open a workspace folder before materializing skills.");
  }

  return folders[0];
}

function getOutputPath(workspaceFolder: vscode.WorkspaceFolder): string {
  const config = vscode.workspace.getConfiguration("skillOrganizer");
  const destinationPath = config.get<string>("destinationPath", ".github/skills");
  return path.join(workspaceFolder.uri.fsPath, destinationPath);
}

export function getSkillTargetFolderName(slug: string): string {
  return sanitizeFolderName(slug);
}

function createTargetFolderName(skill: SkillItem): string {
  return sanitizeFolderName(skill.slug);
}

export async function getLocalConflictFolderNames(): Promise<Set<string>> {
  let workspaceFolder: vscode.WorkspaceFolder;
  try {
    workspaceFolder = getPrimaryWorkspaceFolder();
  } catch {
    return new Set();
  }

  const outputPath = getOutputPath(workspaceFolder);

  try {
    await fs.access(outputPath);
  } catch {
    return new Set();
  }

  const manifest = await loadManifest(outputPath);
  const conflicts = new Set<string>();

  for (const folder of manifest.manualFolders) {
    conflicts.add(folder);
  }

  let dirEntries: string[];
  try {
    dirEntries = await fs.readdir(outputPath);
  } catch {
    return conflicts;
  }

  const managedSet = new Set(manifest.managedFolders);
  const manualSet = new Set(manifest.manualFolders);

  for (const name of dirEntries) {
    const fullPath = path.join(outputPath, name);
    try {
      const stat = await fs.stat(fullPath);
      if (!stat.isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }

    if (!managedSet.has(name) && !manualSet.has(name)) {
      conflicts.add(name);
    }
  }

  return conflicts;
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
  const manifest = await loadManifest(outputPath);
  return new Set(manifest.managedFolders);
}

export async function loadManifest(outputPath: string): Promise<SkillManifest> {
  const manifestPath = path.join(outputPath, MANIFEST_FILE);

  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as { managedFolders?: unknown; manualFolders?: unknown };

    if (!Array.isArray(parsed.managedFolders)) {
      throw new Error("invalid manifest");
    }

    const managedFolders = parsed.managedFolders.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
    const manualFolders = Array.isArray(parsed.manualFolders)
      ? parsed.manualFolders.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      : [];

    const manifest = {
      managedFolders: [...new Set(managedFolders)].sort(),
      manualFolders: [...new Set(manualFolders)].sort()
    };

    if (!Array.isArray(parsed.manualFolders)) {
      await writeManifest(outputPath, manifest);
    }

    return manifest;
  } catch {
    return {
      managedFolders: [],
      manualFolders: []
    };
  }
}

async function writeManagedFolders(outputPath: string, folders: string[]): Promise<void> {
  const existing = await loadManifest(outputPath);
  await writeManifest(outputPath, {
    managedFolders: folders,
    manualFolders: existing.manualFolders
  });
}

export async function reconcileUntrackedSkills(): Promise<number> {
  let workspaceFolder: vscode.WorkspaceFolder;
  try {
    workspaceFolder = getPrimaryWorkspaceFolder();
  } catch {
    return 0;
  }

  const outputPath = getOutputPath(workspaceFolder);

  let dirEntries: string[];
  try {
    dirEntries = await fs.readdir(outputPath);
  } catch {
    return 0;
  }

  const manifest = await loadManifest(outputPath);
  const onDisk = new Set(dirEntries);
  let changed = 0;

  // Prune manifest entries whose folders no longer exist on disk.
  const prunedManual = manifest.manualFolders.filter((f) => onDisk.has(f));
  const prunedManaged = manifest.managedFolders.filter((f) => onDisk.has(f));
  changed += manifest.manualFolders.length - prunedManual.length;
  changed += manifest.managedFolders.length - prunedManaged.length;
  manifest.manualFolders = prunedManual;
  manifest.managedFolders = prunedManaged;

  // Register untracked skill folders (those with SKILL.md) as manual.
  const tracked = new Set([...manifest.managedFolders, ...manifest.manualFolders]);

  for (const name of dirEntries) {
    if (tracked.has(name)) {
      continue;
    }

    const fullPath = path.join(outputPath, name);
    try {
      const stat = await fs.stat(fullPath);
      if (!stat.isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }

    const skillMd = path.join(fullPath, "SKILL.md");
    try {
      await fs.access(skillMd);
    } catch {
      continue;
    }

    manifest.manualFolders.push(name);
    changed++;
  }

  if (changed > 0) {
    await writeManifest(outputPath, manifest);
  }

  return changed;
}

async function writeManifest(outputPath: string, manifest: SkillManifest): Promise<void> {
  const manifestPath = path.join(outputPath, MANIFEST_FILE);
  const payload = JSON.stringify(
    {
      managedFolders: [...new Set(manifest.managedFolders)].sort(),
      manualFolders: [...new Set(manifest.manualFolders)].sort()
    },
    null,
    2
  );
  await fs.writeFile(manifestPath, `${payload}\n`, "utf8");
}

function resolveGlobalOutputPath(): string {
  const config = vscode.workspace.getConfiguration("skillOrganizer");
  const raw = config.get<string>("globalDestinationPath", "~/.agents/skills");
  return raw.startsWith("~") ? path.join(os.homedir(), raw.slice(1)) : raw;
}

export async function materializeSkillsToGlobalFolder(skills: SkillItem[]): Promise<{ outputPath: string; copied: number; removed: number }> {
  const outputPath = resolveGlobalOutputPath();
  await fs.mkdir(outputPath, { recursive: true });

  const materializationPlan = skills.map((skill) => ({
    skill,
    folderName: createTargetFolderName(skill)
  }));

  assertNoFolderNameConflicts(materializationPlan);

  const manifest = await loadManifest(outputPath);
  const expectedFolders = new Set(materializationPlan.map((entry) => entry.folderName));

  const foldersToRemove = manifest.managedFolders.filter((folder) => !expectedFolders.has(folder));
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

  await writeManifest(outputPath, {
    managedFolders: [...expectedFolders],
    manualFolders: manifest.manualFolders
  });

  return { outputPath, copied, removed: foldersToRemove.length };
}

export function getGlobalOutputPath(): string {
  return resolveGlobalOutputPath();
}
