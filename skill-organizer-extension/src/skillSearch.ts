import * as vscode from "vscode";
import { SkillItem, SkillMetadata } from "./types";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Parse a SKILL.md file to extract name and description metadata.
 *
 * Supports two formats:
 * 1. YAML-style frontmatter with `name:` and `description:` fields
 * 2. Markdown heading as name, first paragraph as description
 */
export async function parseSkillMetadata(skillAbsolutePath: string): Promise<SkillMetadata> {
  const skillMdPath = path.join(skillAbsolutePath, "SKILL.md");
  let content: string;

  try {
    content = await fs.readFile(skillMdPath, "utf8");
  } catch {
    return { name: path.basename(skillAbsolutePath), description: "" };
  }

  // Try YAML-style frontmatter first (between --- fences)
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (nameMatch || descMatch) {
      return {
        name: nameMatch?.[1]?.trim().replace(/^["']|["']$/g, "") ?? path.basename(skillAbsolutePath),
        description: descMatch?.[1]?.trim().replace(/^["']|["']$/g, "") ?? ""
      };
    }
  }

  // Fall back to: first # heading = name, next non-empty paragraph = description
  const lines = content.split("\n");
  let name = path.basename(skillAbsolutePath);
  let description = "";

  let foundHeading = false;
  for (const line of lines) {
    const headingMatch = line.match(/^#\s+(.+)/);
    if (headingMatch && !foundHeading) {
      name = headingMatch[1].trim();
      foundHeading = true;
      continue;
    }

    if (foundHeading && line.trim().length > 0 && !line.startsWith("#")) {
      description = line.trim();
      break;
    }
  }

  return { name, description };
}

/**
 * Enrich an array of SkillItems with metadata parsed from their SKILL.md files.
 */
export async function enrichSkillsWithMetadata(skills: SkillItem[]): Promise<SkillItem[]> {
  return Promise.all(
    skills.map(async (skill) => {
      if (skill.metadata) {
        return skill;
      }
      const metadata = await parseSkillMetadata(skill.absolutePath);
      return { ...skill, metadata };
    })
  );
}

interface SearchResult {
  skill: SkillItem;
  reason?: string;
}

/**
 * Search skills using VS Code's Language Model API for semantic matching.
 * Falls back to substring matching when the LM is not available.
 */
export async function searchSkills(
  query: string,
  skills: SkillItem[],
  token: vscode.CancellationToken
): Promise<SearchResult[]> {
  const enriched = await enrichSkillsWithMetadata(skills);

  // Try LM-powered search first
  try {
    const lmResults = await searchWithLanguageModel(query, enriched, token);
    if (lmResults.length > 0) {
      return lmResults;
    }
  } catch {
    // LM unavailable or failed — fall through to fuzzy search
  }

  return searchWithSubstring(query, enriched);
}

async function searchWithLanguageModel(
  query: string,
  skills: SkillItem[],
  token: vscode.CancellationToken
): Promise<SearchResult[]> {
  const models = await vscode.lm.selectChatModels({ family: "gpt-4o" });
  if (models.length === 0) {
    return [];
  }

  const model = models[0];

  const catalog = skills
    .map((s) => {
      const name = s.metadata?.name ?? s.slug;
      const desc = s.metadata?.description ?? "";
      return `- slug: "${s.slug}" | name: "${name}" | description: "${desc}"`;
    })
    .join("\n");

  const systemPrompt = `You are a skill search engine. Given a catalog of available skills and a user query, return the most relevant matches.

Rules:
- Return a JSON array of objects with "slug" and "reason" fields.
- "slug" must exactly match one of the catalog slugs.
- "reason" is a short phrase explaining why this skill matches the query.
- Return at most 10 results, ordered by relevance.
- If nothing matches, return an empty array [].
- Return ONLY the JSON array, no markdown fences, no explanation.`;

  const userPrompt = `Catalog:\n${catalog}\n\nUser query: "${query}"`;

  const messages = [
    vscode.LanguageModelChatMessage.User(systemPrompt),
    vscode.LanguageModelChatMessage.User(userPrompt)
  ];

  const response = await model.sendRequest(messages, {}, token);

  let resultText = "";
  for await (const chunk of response.text) {
    resultText += chunk;
  }

  // Strip markdown code fences if present
  resultText = resultText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  const parsed = JSON.parse(resultText);
  if (!Array.isArray(parsed)) {
    return [];
  }

  const skillBySlug = new Map(skills.map((s) => [s.slug, s]));
  const results: SearchResult[] = [];

  for (const entry of parsed) {
    if (typeof entry?.slug !== "string") {
      continue;
    }
    const skill = skillBySlug.get(entry.slug);
    if (skill) {
      results.push({
        skill,
        reason: typeof entry.reason === "string" ? entry.reason : undefined
      });
    }
  }

  return results;
}

function searchWithSubstring(query: string, skills: SkillItem[]): SearchResult[] {
  const queryLower = query.toLowerCase();
  const queryTokens = queryLower.split(/\s+/).filter((t) => t.length > 0);

  const scored: Array<{ skill: SkillItem; score: number }> = [];

  for (const skill of skills) {
    const slug = skill.slug.toLowerCase();
    const name = (skill.metadata?.name ?? "").toLowerCase();
    const description = (skill.metadata?.description ?? "").toLowerCase();
    const searchable = `${slug} ${name} ${description}`;

    let score = 0;

    // Exact slug match
    if (slug === queryLower) {
      score += 100;
    }

    // Slug contains query
    if (slug.includes(queryLower)) {
      score += 50;
    }

    // Name contains query
    if (name.includes(queryLower)) {
      score += 40;
    }

    // Description contains query
    if (description.includes(queryLower)) {
      score += 20;
    }

    // Token-level matches
    for (const token of queryTokens) {
      if (searchable.includes(token)) {
        score += 10;
      }
    }

    if (score > 0) {
      scored.push({ skill, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ skill }) => ({ skill }));
}
