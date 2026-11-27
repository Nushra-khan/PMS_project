export type RollupGoal = {
  id: string;
  parentGoalId?: string;
  status: string;
  weightage: number;
  completionPct: number;
};

export type GoalRollup = {
  /** Weighted completion of linked child goals, 0-100, rounded. */
  completionPct: number;
  /** Number of direct child goals counted. */
  childCount: number;
};

/**
 * Rolls completion up the goal tree (company <- team <- individual).
 *
 * A goal with linked children gets the weighted average of its children's
 * completion, using each child's weightage (equal weights if all are 0). A
 * child that has children of its own contributes its rolled-up value.
 * Archived and draft goals are ignored. Goals without children get no entry.
 */
export function computeGoalRollups(goals: RollupGoal[]) {
  const counted = goals.filter((goal) => goal.status !== "archived" && goal.status !== "draft");
  const children = new Map<string, RollupGoal[]>();

  for (const goal of counted) {
    if (goal.parentGoalId) {
      const siblings = children.get(goal.parentGoalId) ?? [];
      siblings.push(goal);
      children.set(goal.parentGoalId, siblings);
    }
  }

  const exact = new Map<string, number>();
  const visiting = new Set<string>();

  function effectiveCompletion(goal: RollupGoal): number {
    const cached = exact.get(goal.id);

    if (cached !== undefined) {
      return cached;
    }

    const kids = children.get(goal.id);

    // Leaf goal, or a cycle in bad data: use the goal's own completion.
    if (!kids || visiting.has(goal.id)) {
      return goal.completionPct;
    }

    visiting.add(goal.id);
    const allZero = kids.every((kid) => kid.weightage <= 0);
    let weighted = 0;
    let totalWeight = 0;

    for (const kid of kids) {
      const weight = allZero ? 1 : Math.max(kid.weightage, 0);
      weighted += effectiveCompletion(kid) * weight;
      totalWeight += weight;
    }

    visiting.delete(goal.id);
    const value = totalWeight > 0 ? weighted / totalWeight : goal.completionPct;
    exact.set(goal.id, value);
    return value;
  }

  const rollups = new Map<string, GoalRollup>();

  for (const goal of counted) {
    const kids = children.get(goal.id);

    if (kids && kids.length > 0) {
      rollups.set(goal.id, {
        completionPct: Math.round(effectiveCompletion(goal)),
        childCount: kids.length
      });
    }
  }

  return rollups;
}
