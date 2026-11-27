/**
 * A small, explainable negative-sentiment check for open-ended feedback.
 * It looks for phrases that usually signal a problem (disengagement,
 * conflict, burnout, intent to leave) and ignores ones that are negated
 * ("not stressed", "no conflict"). It is a prompt for a human to look, not
 * a verdict, so it only raises a soft flag.
 */
const NEGATIVE_PHRASES = [
  "burned out",
  "burnt out",
  "burnout",
  "overwhelmed",
  "exhausted",
  "stressed",
  "frustrated",
  "unhappy",
  "demotivated",
  "disengaged",
  "toxic",
  "harass",
  "bullied",
  "bullying",
  "discriminat",
  "hostile",
  "unfair",
  "ignored",
  "micromanag",
  "conflict",
  "struggling",
  "not supported",
  "no support",
  "lack of support",
  "thinking of leaving",
  "want to leave",
  "looking for another job",
  "quitting",
  "resign",
  "poor performance",
  "missed deadlines",
  "unreliable",
  "careless",
  "rude",
  "disrespect"
];

const NEGATIONS = ["not ", "no ", "never ", "isn't ", "wasn't ", "aren't ", "without "];

export type SentimentResult = {
  negative: boolean;
  matches: string[];
};

export function detectNegativeSentiment(text: string): SentimentResult {
  const normalized = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  const matches: string[] = [];

  for (const phrase of NEGATIVE_PHRASES) {
    let index = normalized.indexOf(phrase);

    while (index !== -1) {
      const before = normalized.slice(Math.max(0, index - 12), index);
      // A phrase that itself starts with a negation ("not supported") counts as is.
      const negated = !NEGATIONS.some((word) => phrase.startsWith(word)) &&
        NEGATIONS.some((word) => before.endsWith(word));

      if (!negated) {
        matches.push(phrase);
        break;
      }

      index = normalized.indexOf(phrase, index + phrase.length);
    }
  }

  return { negative: matches.length > 0, matches };
}
