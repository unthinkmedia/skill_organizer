import * as fs from "fs/promises";
import * as path from "path";

interface GitHubRepo {
  full_name: string;
  default_branch: string;
  permissions?: { push?: boolean };
}

interface GitHubRef {
  ref: string;
  object: { sha: string };
}

interface GitHubBlob {
  sha: string;
}

interface GitHubTree {
  sha: string;
}

interface GitHubCommit {
  sha: string;
}

interface GitHubPullRequest {
  html_url: string;
  number: number;
}

interface SkillFile {
  relativePath: string;
  contentBase64: string;
}

export interface SubmitSkillPRParams {
  token: string;
  owner: string;
  repo: string;
  baseBranch?: string;
  skillsRootPath?: string;
  skillSlug: string;
  localSkillPath: string;
  prTitle?: string;
  prBody?: string;
}

export interface SubmitSkillPRResult {
  prUrl: string;
  prNumber: number;
  forked: boolean;
}

export interface CreateRepoResult {
  owner: string;
  repo: string;
  htmlUrl: string;
  defaultBranch: string;
}

interface GitHubOrg {
  login: string;
}

export async function listGitHubUserOrgs(token: string): Promise<string[]> {
  const orgs = await githubRequest<GitHubOrg[]>(token, "GET", "/user/orgs?per_page=100");
  return orgs.map((org) => org.login);
}

export async function getGitHubUsername(token: string): Promise<string> {
  const user = await githubRequest<{ login: string }>(token, "GET", "/user");
  return user.login;
}

export async function createGitHubRepo(
  token: string,
  name: string,
  description: string,
  orgOwner?: string,
  isPrivate = false
): Promise<CreateRepoResult> {
  const endpoint = orgOwner ? `/orgs/${orgOwner}/repos` : "/user/repos";
  const repo = await githubRequest<GitHubRepo & { html_url: string }>(token, "POST", endpoint, {
    name,
    description,
    private: isPrivate,
    auto_init: true
  });

  const parts = repo.full_name.split("/");
  return {
    owner: parts[0],
    repo: parts[1],
    htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch
  };
}

export function parseGitHubOwnerRepo(uri: string): { owner: string; repo: string } | undefined {
  const sshMatch = uri.match(/^git@github\.com:([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  try {
    const parsed = new URL(uri);
    if (parsed.hostname !== "github.com") {
      return undefined;
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      return undefined;
    }

    return { owner: parts[0], repo: parts[1].replace(/\.git$/i, "") };
  } catch {
    return undefined;
  }
}

export async function submitSkillPR(params: SubmitSkillPRParams): Promise<SubmitSkillPRResult> {
  const { token, owner, repo, skillSlug, localSkillPath } = params;
  const skillsRoot = params.skillsRootPath ?? ".github/skills";

  // 1. Get repo info and determine push strategy.
  const repoInfo = await githubRequest<GitHubRepo>(token, "GET", `/repos/${owner}/${repo}`);
  const baseBranch = params.baseBranch ?? repoInfo.default_branch;
  const hasPushAccess = repoInfo.permissions?.push === true;

  let pushOwner = owner;
  let pushRepo = repo;
  let forked = false;

  if (!hasPushAccess) {
    const fork = await githubRequest<GitHubRepo>(token, "POST", `/repos/${owner}/${repo}/forks`, {});
    const forkParts = fork.full_name.split("/");
    pushOwner = forkParts[0];
    pushRepo = forkParts[1];
    forked = true;

    // Wait for GitHub to finish creating the fork.
    await waitForFork(token, pushOwner, pushRepo);
  }

  // 2. Get base branch SHA.
  const baseRef = await githubRequest<GitHubRef>(
    token, "GET", `/repos/${pushOwner}/${pushRepo}/git/ref/heads/${baseBranch}`
  );
  const baseSha = baseRef.object.sha;

  // 3. Create feature branch.
  const branchName = `skill-organizer/add-${sanitizeBranchSegment(skillSlug)}`;
  await githubRequest<GitHubRef>(token, "POST", `/repos/${pushOwner}/${pushRepo}/git/refs`, {
    ref: `refs/heads/${branchName}`,
    sha: baseSha
  });

  // 4. Read local files and create blobs.
  const localFiles = await readSkillFilesRecursively(localSkillPath);
  if (localFiles.length === 0) {
    throw new Error(`No files found in skill folder: ${localSkillPath}`);
  }

  const treeEntries: Array<{ path: string; mode: string; type: string; sha: string }> = [];

  for (const file of localFiles) {
    const blob = await githubRequest<GitHubBlob>(
      token, "POST", `/repos/${pushOwner}/${pushRepo}/git/blobs`,
      { content: file.contentBase64, encoding: "base64" }
    );

    treeEntries.push({
      path: `${skillsRoot}/${skillSlug}/${file.relativePath}`,
      mode: "100644",
      type: "blob",
      sha: blob.sha
    });
  }

  // 5. Create tree, commit, and update branch.
  const tree = await githubRequest<GitHubTree>(
    token, "POST", `/repos/${pushOwner}/${pushRepo}/git/trees`,
    { base_tree: baseSha, tree: treeEntries }
  );

  const commitMessage = params.prTitle ?? `Add skill: ${skillSlug}`;
  const commit = await githubRequest<GitHubCommit>(
    token, "POST", `/repos/${pushOwner}/${pushRepo}/git/commits`,
    { message: commitMessage, tree: tree.sha, parents: [baseSha] }
  );

  await githubRequest<GitHubRef>(
    token, "PATCH", `/repos/${pushOwner}/${pushRepo}/git/refs/heads/${branchName}`,
    { sha: commit.sha }
  );

  // 6. Create pull request against the upstream repo.
  const prTitle = params.prTitle ?? `Add skill: ${skillSlug}`;
  const prBody = params.prBody ?? `Adds the \`${skillSlug}\` skill.\n\nSubmitted via [Skill Organizer](https://github.com/unthinkmedia/skill_organizer).`;
  const head = forked ? `${pushOwner}:${branchName}` : branchName;

  const pr = await githubRequest<GitHubPullRequest>(
    token, "POST", `/repos/${owner}/${repo}/pulls`,
    { title: prTitle, body: prBody, head, base: baseBranch }
  );

  return { prUrl: pr.html_url, prNumber: pr.number, forked };
}

async function githubRequest<T>(token: string, method: string, urlPath: string, body?: unknown): Promise<T> {
  const response = await fetch(`https://api.github.com${urlPath}`, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "skill-organizer-vscode"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`GitHub API ${method} ${urlPath} returned ${response.status}: ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

async function waitForFork(token: string, owner: string, repo: string): Promise<void> {
  const maxAttempts = 10;
  const delayMs = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      await githubRequest<GitHubRepo>(token, "GET", `/repos/${owner}/${repo}`);
      return;
    } catch {
      await delay(delayMs);
    }
  }
}

async function readSkillFilesRecursively(rootPath: string): Promise<SkillFile[]> {
  const files: SkillFile[] = [];
  const queue: string[] = [rootPath];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (entry.name !== ".git" && entry.name !== "node_modules") {
          queue.push(fullPath);
        }
        continue;
      }

      if (entry.isFile()) {
        const content = await fs.readFile(fullPath);
        files.push({
          relativePath: path.relative(rootPath, fullPath),
          contentBase64: content.toString("base64")
        });
      }
    }
  }

  return files;
}

function sanitizeBranchSegment(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").substring(0, 40);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
