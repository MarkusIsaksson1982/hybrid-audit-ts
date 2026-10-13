import {
  SEVERITY_RANK,
  type Action,
  type Finding,
  type ParseResult,
  type ProviderAdapter,
  type Severity,
} from './types.js';

/** Internal aggregation bucket for one entityId+action key. */
interface Group {
  entityId: string;
  action: string;
  severity: Severity;
  sources: string[];
  sourceSeen: Set<string>;
  reasons: string[];
  reasonSeen: Set<string>;
}

/** True for non-null, non-array objects. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** JSON.parse that reports failure instead of throwing. */
function tryParse(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    const value: unknown = JSON.parse(text);
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

/** Accept a JSON array, or an object exposing a `findings` array. */
function asCandidateArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) {
    const findings = value['findings'];
    if (Array.isArray(findings)) return findings;
  }
  return null;
}

/** Parse one candidate string into a findings array, or null. */
function candidateArray(text: string): unknown[] | null {
  const parsed = tryParse(text);
  return parsed.ok ? asCandidateArray(parsed.value) : null;
}

/** Index closing the value opened at `start` (`[`/`{`), or -1 if unterminated. */
function balancedEnd(text: string, start: number): number {
  const open = text[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Contents of every ``` / ```json fence in the text, in order. */
function fencedBlocks(text: string): string[] {
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  const blocks: string[] = [];
  let match: RegExpExecArray | null = re.exec(text);
  while (match !== null) {
    blocks.push(match[1]);
    match = re.exec(text);
  }
  return blocks;
}

/** True when an unknown item carries a usable entityId/action/severity. */
function isCandidate(
  value: unknown,
): value is { entityId: string; action: string; severity: Severity; reason?: unknown } {
  if (!isRecord(value)) return false;
  const { entityId, action, severity } = value;
  return (
    typeof entityId === 'string' &&
    typeof action === 'string' &&
    typeof severity === 'string' &&
    severity in SEVERITY_RANK
  );
}

/** Build an adapter that lifts a JSON findings array out of prose or fences. */
export function jsonArrayAdapter(provider: string): ProviderAdapter {
  return {
    provider,
    /** Returns the array, or null; never throws. */
    extract(raw: string): unknown[] | null {
      for (const block of fencedBlocks(raw)) {
        const fenced = candidateArray(block);
        if (fenced) return fenced;
      }
      const whole = candidateArray(raw);
      if (whole) return whole;
      const found: unknown[][] = [];
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (ch !== '[' && ch !== '{') continue;
        const end = balancedEnd(raw, i);
        if (end < 0) continue;
        const slice = candidateArray(raw.slice(i, end + 1));
        if (slice) found.push(slice);
      }
      if (found.length === 0) return null;
      const objectish = found.find((arr) => arr.some((el) => isRecord(el)));
      return objectish ?? found[0];
    },
  };
}

/** Validate extracted items into findings; count rejects as dropped. */
export function parseLlmFindings(text: string, adapter: ProviderAdapter): ParseResult {
  const items = adapter.extract(text) ?? [];
  const findings: Finding[] = [];
  for (const item of items) {
    if (!isCandidate(item)) continue;
    const finding: Finding = {
      entityId: item.entityId,
      action: item.action,
      severity: item.severity,
      source: adapter.provider,
    };
    if (typeof item.reason === 'string') finding.reason = item.reason;
    findings.push(finding);
  }
  return { findings, dropped: items.length - findings.length };
}

/** Merge duplicates by entityId+action and order the resulting actions. */
export function dedupeActions(findings: Finding[]): Action[] {
  const groups = new Map<string, Group>();
  for (const f of findings) {
    const key = JSON.stringify([f.entityId, f.action]);
    let group = groups.get(key);
    if (!group) {
      group = {
        entityId: f.entityId,
        action: f.action,
        severity: f.severity,
        sources: [],
        sourceSeen: new Set<string>(),
        reasons: [],
        reasonSeen: new Set<string>(),
      };
      groups.set(key, group);
    }
    if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[group.severity]) group.severity = f.severity;
    if (!group.sourceSeen.has(f.source)) {
      group.sourceSeen.add(f.source);
      group.sources.push(f.source);
    }
    if (f.reason !== undefined && f.reason.length > 0 && !group.reasonSeen.has(f.reason)) {
      group.reasonSeen.add(f.reason);
      group.reasons.push(f.reason);
    }
  }
  const actions: Action[] = [];
  for (const g of groups.values()) {
    actions.push({
      entityId: g.entityId,
      action: g.action,
      severity: g.severity,
      sources: g.sources.slice().sort((a, b) => a.localeCompare(b)),
      reasons: g.reasons,
    });
  }
  actions.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (bySeverity !== 0) return bySeverity;
    const byId = a.entityId.localeCompare(b.entityId);
    if (byId !== 0) return byId;
    return a.action.localeCompare(b.action);
  });
  return actions;
}
