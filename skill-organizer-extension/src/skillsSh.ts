import { ResolvedSkillsShUrl } from "./types";

const SKILLS_SH_HOST = "skills.sh";

export function resolveSkillsShUrl(input: string): ResolvedSkillsShUrl {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("Invalid URL. Expected format: https://skills.sh/<owner>/<repo>/<skill-slug>");
  }

  if (parsed.hostname !== SKILLS_SH_HOST) {
    throw new Error("Only skills.sh URLs are supported by this command.");
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 3) {
    throw new Error("Invalid skills.sh URL path. Expected: /<owner>/<repo>/<skill-slug>");
  }

  const [owner, repo, skillSlug] = parts;
  return {
    owner,
    repo,
    skillSlug,
    canonicalRepoUrl: `https://github.com/${owner}/${repo}`
  };
}
