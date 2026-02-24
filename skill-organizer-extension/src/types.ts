export type SourceType = "gitRepo" | "localFolder" | "skillFolder" | "skillsShUrl";

export interface SkillSource {
  id: string;
  type: SourceType;
  uri: string;
  canonicalRepoUri?: string;
  branch?: string;
  skillsRootPath?: string;
  authMode?: "ssh" | "https" | "pat" | "system";
  lastSyncAt?: string;
}

export interface SkillItem {
  id: string;
  sourceId: string;
  slug: string;
  relativePath: string;
  absolutePath: string;
  versionHash?: string;
}

export interface ResolvedSkillsShUrl {
  owner: string;
  repo: string;
  skillSlug: string;
  canonicalRepoUrl: string;
}
