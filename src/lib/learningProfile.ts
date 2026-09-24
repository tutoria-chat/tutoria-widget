/**
 * "Seu jeito de aprender" — the student's opt-in learning profile.
 *
 * The student may say what's part of how they learn (ADHD, autism, dyslexia…)
 * and/or pick answer-style adaptations directly. Only the ADAPTATIONS (how to
 * answer: "short steps", "literal language"…) and an optional note are ever
 * sent with a chat message. The conditions stay on this device — they're just
 * a shortcut for choosing adaptations — so neither our server nor the AI ever
 * learns them, and the AI can't expose the student ("since you have ADHD…").
 *
 * Stored per-device in localStorage (never on our servers). The server keeps
 * the matching whitelist in tutoria-api app/prompts/learning_adaptations.py.
 */

export const CONDITION_IDS = [
  'adhd',
  'autism',
  'dyslexia',
  'dyscalculia',
  'intellectual',
  'low_vision',
  'anxiety',
  'gifted',
  'other',
] as const;
export type ConditionId = (typeof CONDITION_IDS)[number];

// Canonical order — must match ADAPTATION_IDS on the server.
export const ADAPTATION_IDS = [
  'direct_first',
  'steps',
  'short_paragraphs',
  'highlight_key',
  'check_in',
  'literal',
  'predictable_structure',
  'concrete_examples',
  'simple_words',
  'numbers_step_by_step',
  'describe_visuals',
  'calm_tone',
  'more_depth',
] as const;
export type AdaptationId = (typeof ADAPTATION_IDS)[number];

/** Adaptations that usually help, per condition. The student can fine-tune. */
export const CONDITION_ADAPTATIONS: Record<ConditionId, readonly AdaptationId[]> = {
  adhd: ['direct_first', 'steps', 'short_paragraphs', 'highlight_key', 'check_in'],
  autism: ['direct_first', 'literal', 'predictable_structure', 'concrete_examples'],
  dyslexia: ['steps', 'short_paragraphs', 'highlight_key', 'simple_words'],
  dyscalculia: ['steps', 'concrete_examples', 'numbers_step_by_step'],
  intellectual: ['steps', 'short_paragraphs', 'concrete_examples', 'simple_words'],
  low_vision: ['short_paragraphs', 'describe_visuals'],
  anxiety: ['direct_first', 'steps', 'calm_tone'],
  gifted: ['more_depth'],
  other: [],
};

export const MAX_NOTE_CHARS = 300;

export interface LearningProfile {
  v: 1;
  /** The student's explicit opt-in. Nothing is sent while this is false. */
  enabled: boolean;
  conditions: ConditionId[];
  adaptations: AdaptationId[];
  note: string;
}

export const EMPTY_PROFILE: LearningProfile = {
  v: 1,
  enabled: false,
  conditions: [],
  adaptations: [],
  note: '',
};

const isCondition = (x: unknown): x is ConditionId =>
  typeof x === 'string' && (CONDITION_IDS as readonly string[]).includes(x);
const isAdaptation = (x: unknown): x is AdaptationId =>
  typeof x === 'string' && (ADAPTATION_IDS as readonly string[]).includes(x);

/** Known adaptations only, de-duplicated, in canonical order. */
export function orderAdaptations(ids: readonly string[]): AdaptationId[] {
  const set = new Set(ids);
  return ADAPTATION_IDS.filter((a) => set.has(a));
}

/** Parse whatever is in storage into a valid profile (tolerates bad/old data). */
export function normalizeProfile(raw: unknown): LearningProfile {
  if (!raw || typeof raw !== 'object') return EMPTY_PROFILE;
  const r = raw as Partial<Record<keyof LearningProfile, unknown>>;
  return {
    v: 1,
    enabled: r.enabled === true,
    conditions: Array.isArray(r.conditions)
      ? CONDITION_IDS.filter((c) => (r.conditions as unknown[]).includes(c))
      : [],
    adaptations: Array.isArray(r.adaptations)
      ? orderAdaptations((r.adaptations as unknown[]).filter(isAdaptation))
      : [],
    note: typeof r.note === 'string' ? r.note.slice(0, MAX_NOTE_CHARS) : '',
  };
}

/**
 * Select / deselect a condition. Selecting adds its adaptations; deselecting
 * removes the ones no other selected condition still implies.
 */
export function toggleCondition(p: LearningProfile, id: ConditionId): LearningProfile {
  if (!isCondition(id)) return p;
  const selected = p.conditions.includes(id);
  const conditions = selected
    ? p.conditions.filter((c) => c !== id)
    : CONDITION_IDS.filter((c) => c === id || p.conditions.includes(c));

  if (!selected) {
    return { ...p, conditions, adaptations: orderAdaptations([...p.adaptations, ...CONDITION_ADAPTATIONS[id]]) };
  }
  const stillImplied = new Set(conditions.flatMap((c) => CONDITION_ADAPTATIONS[c]));
  const drop = new Set(CONDITION_ADAPTATIONS[id].filter((a) => !stillImplied.has(a)));
  return { ...p, conditions, adaptations: p.adaptations.filter((a) => !drop.has(a)) };
}

export function toggleAdaptation(p: LearningProfile, id: AdaptationId): LearningProfile {
  if (!isAdaptation(id)) return p;
  const adaptations = p.adaptations.includes(id)
    ? p.adaptations.filter((a) => a !== id)
    : orderAdaptations([...p.adaptations, id]);
  return { ...p, adaptations };
}

/** True when the opted-in profile would actually change answers. */
export function isProfileActive(p: LearningProfile): boolean {
  return p.enabled && (p.adaptations.length > 0 || p.note.trim().length > 0);
}

/**
 * The fields sent with a chat message. Conditions are never included — only
 * how to answer — and nothing at all is sent unless the student opted in.
 */
export function learningRequestFields(p: LearningProfile): {
  learningAdaptations?: AdaptationId[];
  learningNote?: string;
} {
  if (!p.enabled) return {};
  const out: { learningAdaptations?: AdaptationId[]; learningNote?: string } = {};
  if (p.adaptations.length) out.learningAdaptations = [...p.adaptations];
  const note = p.note.trim().slice(0, MAX_NOTE_CHARS);
  if (note) out.learningNote = note;
  return out;
}
