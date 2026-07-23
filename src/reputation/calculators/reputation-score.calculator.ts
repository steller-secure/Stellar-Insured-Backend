/**
 * Reputation Score Calculator
 *
 * Deterministically recomputes a user's `reputationScore` from a list of
 * ReputationHistory rows.  This is a **pure function** — it has no side
 * effects and no database access — making it trivial to unit-test with
 * plain fixtures.
 *
 * The algorithm:
 *   baseScore  = INITIAL_REPUTATION (50 by convention)
 *   totalScore = baseScore + Σ scoreChange
 *   result     = clamp(totalScore, 0, 1000)
 *
 * "Deterministic" here means: given the same history rows the function
 * always returns the same number, regardless of order or insertion time.
 */

export interface ReputationHistoryEntry {
  scoreChange: number;
}

const BASE_SCORE = 50;
const MIN_REPUTATION = 0;
const MAX_REPUTATION = 1000;

/**
 * Recompute the reputation score from a full history of deltas.
 *
 * @param history  All ReputationHistory rows for the user.
 * @returns        The clamped reputationScore.
 *
 * @example
 * // approved claim (+10) then fraud detected (-20)
 * computeReputationFromHistory([{ scoreChange: 10 }, { scoreChange: -20 }]);
 * // → clamp(50 + 10 - 20, 0, 1000) = 40
 */
export function computeReputationFromHistory(
  history: ReputationHistoryEntry[],
): number {
  const total = history.reduce(
    (acc, entry) => acc + entry.scoreChange,
    BASE_SCORE,
  );
  return Math.max(MIN_REPUTATION, Math.min(MAX_REPUTATION, total));
}
