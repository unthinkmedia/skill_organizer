import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import * as vscode from "vscode";
import { StateStore } from "./stateStore";
import { resolveSkillsShUrl } from "./skillsSh";
import { SkillItem, SkillSource } from "./types";

const execFileAsync = promisify(execFile);
const NON_INTERACTIVE_GIT_ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0"
};

export class SourceManager {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly stateStore: StateStore
  ) {}

  getSources(): SkillSource[] {
    return this.stateStore.getSources();
  }

  async addGitHubSource(repoUrl: string): Promise<SkillSource> {
    const parsed = this.parseGitHubSourceInput(repoUrl);

    const sources = this.stateStore.getSources();
    const existing = sources.find(
      (s) =>
        s.canonicalRepoUri === parsed.canonicalRepoUri &&
        (s.branch ?? "") === (parsed.branch ?? "") &&
        (s.skillsRootPath ?? "") === (parsed.skillsRootPath ?? "")
    );
    if (existing) {
      await this.refreshSourceClone(existing);
      return existing;
    }

    const source: SkillSource = {
      id: createStableId(`${parsed.canonicalRepoUri}|${parsed.branch ?? ""}|${parsed.skillsRootPath ?? ""}`),
      type: "gitRepo",
      uri: repoUrl,
      canonicalRepoUri: parsed.canonicalRepoUri,
      branch: parsed.branch,
      skillsRootPath: parsed.skillsRootPath,
      authMode: "system",
      lastSyncAt: new Date().toISOString()
    };

    await this.refreshSourceClone(source);

    sources.push(source);
    await this.stateStore.saveSources(sources);
    return source;
  }

  async addFromSkillsSh(skillsShUrl: string): Promise<{ source: SkillSource; skillSlug: string }> {
    const resolved = resolveSkillsShUrl(skillsShUrl);
    const source = await this.addGitHubSource(resolved.canonicalRepoUrl);
    return { source, skillSlug: resolved.skillSlug };
  }

  async removeSource(sourceId: string): Promise<SkillSource> {
    const sources = this.stateStore.getSources();
    const source = sources.find((candidate) => candidate.id === sourceId);
    if (!source) {
      throw new Error("Source not found.");
    }

    await this.stateStore.saveSources(sources.filter((candidate) => candidate.id !== sourceId));

    const checkout = this.getSourceCheckoutPath(source);
    await fs.rm(checkout, { recursive: true, force: true });

    return source;
  }

  async refreshAllSources(): Promise<void> {
    const sources = this.stateStore.getSources();
    for (const source of sources) {
      if (source.type === "gitRepo") {
        await this.refreshSourceClone(source);
      }
    }
  }

  async chooseGitHubAccount(): Promise<string> {
    try {
      const session = await vscode.authentication.getSession("github", ["repo"], {
        createIfNone: true,
        clearSessionPreference: true
      });

      if (!session?.account?.label) {
        throw new Error("GitHub authentication session did not return an account.");
      }

      return session.account.label;
    } catch {
      throw new Error("Could not select a GitHub account. Sign in and try again.");
    }
  }

  async getSkills(): Promise<SkillItem[]> {
    const sources = this.stateStore.getSources();
    const skillLists = await Promise.all(sources.map((source) => this.getSkillsForSource(source)));
    return skillLists.flat();
  }

  async getSkillById(skillId: string): Promise<SkillItem | undefined> {
    const skills = await this.getSkills();
    return skills.find((skill) => skill.id === skillId);
  }

  async getSkillsForSource(source: SkillSource): Promise<SkillItem[]> {
    if (source.type !== "gitRepo") {
      return [];
    }

    const normalizedSource = this.normalizeGitSource(source);
    const checkout = this.getSourceCheckoutPath(normalizedSource);
    return discoverSkills(checkout, normalizedSource.id, normalizedSource.skillsRootPath);
  }

  private async refreshSourceClone(source: SkillSource): Promise<void> {
    const normalizedSource = this.normalizeGitSource(source);
    const checkout = this.getSourceCheckoutPath(normalizedSource);
    await fs.mkdir(path.dirname(checkout), { recursive: true });

    const gitDir = path.join(checkout, ".git");
    const hasGitDir = await exists(gitDir);
    const cloneUri = normalizedSource.canonicalRepoUri ?? normalizedSource.uri;

    if (!hasGitDir) {
      await this.cloneRepoWithFallback(cloneUri, checkout, normalizedSource.branch);
    } else {
      if (normalizedSource.branch) {
        await this.runGitCommand(["-C", checkout, "checkout", normalizedSource.branch], cloneUri, "checkout");
      }
      await this.runGitWithAuthFallback(["-C", checkout, "pull", "--ff-only"], cloneUri, "pull");
    }
  }

  private async cloneRepoWithFallback(cloneUri: string, checkout: string, branch?: string): Promise<void> {
    const buildCloneArgs = (uri: string): string[] => {
      const args = ["clone", "--depth", "1"];
      if (branch) {
        args.push("--branch", branch);
      }
      args.push(uri, checkout);
      return args;
    };

    try {
      await this.runGitWithAuthFallback(buildCloneArgs(cloneUri), cloneUri, "clone");
      return;
    } catch (httpsError) {
      const errorMessage = httpsError instanceof Error ? httpsError.message.toLowerCase() : "";
      const sshUri = this.toGitHubSshUri(cloneUri);
      const authFailure = errorMessage.includes("authentication failed");

      if (!sshUri || !authFailure) {
        throw httpsError;
      }

      // If HTTPS auth fails, fall back to SSH for users with GitHub SSH keys configured.
      try {
        await this.runGitCommand(buildCloneArgs(sshUri), sshUri, "clone");
      } catch (sshError) {
        throw this.buildCombinedCloneAuthError(cloneUri, httpsError, sshError);
      }
    }
  }

  private async runGitCommand(args: string[], sourceUri: string, action: "clone" | "pull" | "checkout"): Promise<void> {
    try {
      await execFileAsync("git", args, { env: NON_INTERACTIVE_GIT_ENV });
    } catch (error) {
      throw this.buildGitError(action, sourceUri, error);
    }
  }

  private async runGitWithAuthFallback(
    args: string[],
    sourceUri: string,
    action: "clone" | "pull"
  ): Promise<void> {
    try {
      await execFileAsync("git", args, { env: NON_INTERACTIVE_GIT_ENV });
      return;
    } catch (error) {
      if (!this.isGitHubRepoUri(sourceUri) || !this.isAuthenticationFailure(error)) {
        throw this.buildGitError(action, sourceUri, error);
      }
    }

    const firstToken = await this.getGitHubAccessToken(false);
    const firstAuthArgs = ["-c", `http.https://github.com/.extraheader=${this.buildGitHubAuthHeader(firstToken)}`, ...args];

    try {
      await execFileAsync("git", firstAuthArgs, { env: NON_INTERACTIVE_GIT_ENV });
      return;
    } catch (error) {
      if (!this.isAuthenticationFailure(error)) {
        throw this.buildGitError(action, sourceUri, error);
      }
    }

    // Default session may point to the wrong GitHub account. Re-prompt account selection and retry once.
    const selectedToken = await this.getGitHubAccessToken(true);
    const selectedAuthArgs = ["-c", `http.https://github.com/.extraheader=${this.buildGitHubAuthHeader(selectedToken)}`, ...args];

    try {
      await execFileAsync("git", selectedAuthArgs, { env: NON_INTERACTIVE_GIT_ENV });
    } catch (error) {
      throw this.buildGitError(action, sourceUri, error);
    }
  }

  private async getGitHubAccessToken(forceAccountPicker: boolean): Promise<string> {
    try {
      const session = await vscode.authentication.getSession("github", ["repo"], {
        createIfNone: true,
        clearSessionPreference: forceAccountPicker
      });
      if (!session?.accessToken) {
        throw new Error("GitHub authentication session did not return an access token.");
      }

      return session.accessToken;
    } catch {
      throw new Error(
        "GitHub authentication is required for this source. Sign in with an account that has repo access and try again."
      );
    }
  }

  private buildGitHubAuthHeader(accessToken: string): string {
    const basicToken = Buffer.from(`x-access-token:${accessToken}`, "utf8").toString("base64");
    return `AUTHORIZATION: basic ${basicToken}`;
  }

  private buildGitError(action: "clone" | "pull" | "checkout", sourceUri: string, error: unknown): Error {
    const stderr = this.extractGitStderr(error);
    const actionLabel = action === "checkout" ? "switch branches" : action;

    if (this.isAuthenticationFailure(error)) {
      return new Error(
        `Unable to ${actionLabel} ${sourceUri}. Authentication failed. Sign in to GitHub in VS Code and ensure your token is authorized for this repo (including org SSO if required), or use the SSH repo URL (git@github.com:owner/repo.git).`
      );
    }

    if (stderr) {
      return new Error(`Unable to ${actionLabel} ${sourceUri}. ${stderr}`);
    }

    return new Error(`Unable to ${actionLabel} ${sourceUri}.`);
  }

  private extractGitStderr(error: unknown): string {
    if (!error || typeof error !== "object") {
      return "";
    }

    const stderr = (error as { stderr?: string }).stderr;
    if (!stderr) {
      return "";
    }

    return stderr
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ");
  }

  private isAuthenticationFailure(error: unknown): boolean {
    const message = this.extractGitStderr(error).toLowerCase();
    if (!message) {
      return false;
    }

    return (
      message.includes("could not read username") ||
      message.includes("authentication failed") ||
      message.includes("repository not found") ||
      message.includes("terminal prompts disabled")
    );
  }

  private isGitHubRepoUri(uri: string): boolean {
    if (/^git@github\.com:/i.test(uri)) {
      return true;
    }

    try {
      return new URL(uri).hostname === "github.com";
    } catch {
      return false;
    }
  }

  private toGitHubSshUri(uri: string): string | undefined {
    try {
      const parsed = new URL(uri);
      if (parsed.hostname !== "github.com") {
        return undefined;
      }

      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length < 2) {
        return undefined;
      }

      const owner = parts[0];
      const repo = parts[1].replace(/\.git$/i, "");
      return `git@github.com:${owner}/${repo}.git`;
    } catch {
      return undefined;
    }
  }

  private buildCombinedCloneAuthError(cloneUri: string, httpsError: unknown, sshError: unknown): Error {
    const owner = this.getGitHubOwner(cloneUri);
    const ssoHint = owner
      ? ` If this is a private org repo, authorize your GitHub token for org SSO: https://github.com/orgs/${owner}/sso`
      : "";

    const httpsMessage = httpsError instanceof Error ? httpsError.message : "HTTPS clone failed.";
    const sshMessage = sshError instanceof Error ? sshError.message : "SSH clone failed.";

    return new Error(
      `Unable to clone ${cloneUri}. HTTPS authentication and SSH fallback both failed. ${httpsMessage} SSH fallback error: ${sshMessage} Sign in to GitHub in VS Code with repo access and${ssoHint} or configure a GitHub SSH key and retry with an SSH repo URL.`
    );
  }

  private getGitHubOwner(uri: string): string | undefined {
    try {
      const parsed = new URL(uri);
      if (parsed.hostname !== "github.com") {
        return undefined;
      }

      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length < 2) {
        return undefined;
      }

      return parts[0];
    } catch {
      return undefined;
    }
  }

  private getSourceCheckoutPath(source: SkillSource): string {
    return path.join(this.context.globalStorageUri.fsPath, "source-cache", source.id);
  }

  private normalizeGitSource(source: SkillSource): SkillSource {
    if (source.type !== "gitRepo") {
      return source;
    }

    if (source.canonicalRepoUri || source.branch || source.skillsRootPath) {
      return source;
    }

    try {
      const parsed = this.parseGitHubSourceInput(source.uri);
      return {
        ...source,
        canonicalRepoUri: parsed.canonicalRepoUri,
        branch: parsed.branch,
        skillsRootPath: parsed.skillsRootPath
      };
    } catch {
      return source;
    }
  }

  private parseGitHubSourceInput(repoUrl: string): { canonicalRepoUri: string; branch?: string; skillsRootPath?: string } {
    const sshPattern = /^git@github\.com:[\w.-]+\/[\w.-]+(?:\.git)?$/i;
    const httpsPattern = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/i;

    if (sshPattern.test(repoUrl) || httpsPattern.test(repoUrl)) {
      return { canonicalRepoUri: repoUrl };
    }

    try {
      const parsedUrl = new URL(repoUrl);
      if (parsedUrl.hostname !== "github.com") {
        throw new Error("not-github");
      }

      const parts = parsedUrl.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
      if (parts.length < 2) {
        throw new Error("invalid-path");
      }

      const owner = parts[0];
      const repo = parts[1].replace(/\.git$/i, "");
      const canonicalRepoUri = `https://github.com/${owner}/${repo}`;

      // Supports URLs like /owner/repo/tree/main/tools/skills
      if (parts.length >= 5 && parts[2] === "tree") {
        const branch = parts[3];
        const skillsRootPath = parts.slice(4).join("/").replace(/^\/+|\/+$/g, "");
        if (!skillsRootPath) {
          throw new Error("The GitHub tree URL must include a folder path after the branch name.");
        }

        return {
          canonicalRepoUri,
          branch,
          skillsRootPath
        };
      }

      // Supports plain repo URLs with optional trailing slash or query string.
      if (parts.length === 2) {
        return { canonicalRepoUri };
      }
    } catch {
      // Fall through to user-facing error below.
    }

    throw new Error("Use a GitHub repo URL or a GitHub tree URL (for example: https://github.com/owner/repo/tree/main/tools/skills).");
  }
}

async function discoverSkills(rootPath: string, sourceId: string, skillsRootPath?: string): Promise<SkillItem[]> {
  if (!(await exists(rootPath))) {
    return [];
  }

  const results: SkillItem[] = [];

  const candidateRoots = skillsRootPath
    ? [path.join(rootPath, skillsRootPath)]
    : [path.join(rootPath, ".github", "skills"), path.join(rootPath, "skills")];

  for (const candidateRoot of candidateRoots) {
    if (!(await exists(candidateRoot))) {
      continue;
    }

    const skillDirs = await findSkillDirectories(candidateRoot);
    for (const skillDir of skillDirs) {
      const relativePath = path.relative(rootPath, skillDir);
      const slug = path.basename(skillDir);
      const id = `${sourceId}:${relativePath}`;
      results.push({
        id,
        sourceId,
        slug,
        relativePath,
        absolutePath: skillDir
      });
    }
  }

  // Deduplicate when overlapping roots discover the same skill directory.
  const deduped = new Map<string, SkillItem>();
  for (const skill of results) {
    deduped.set(skill.id, skill);
  }

  return [...deduped.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

async function findSkillDirectories(startDir: string): Promise<string[]> {
  const found: string[] = [];
  const queue: string[] = [startDir];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const skillMdPath = path.join(current, "SKILL.md");
    if (await exists(skillMdPath)) {
      found.push(current);
      continue;
    }

    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      if (entry.name === ".git" || entry.name === "node_modules") {
        continue;
      }

      queue.push(path.join(current, entry.name));
    }
  }

  return found;
}

function createStableId(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 12);
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
