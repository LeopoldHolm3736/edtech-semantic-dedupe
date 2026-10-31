export type ReviewCandidate = { score: number };

export function decideNearDuplicate(candidate: ReviewCandidate | undefined, threshold = 0.92): boolean {
  return Boolean(candidate && candidate.score >= threshold);
}
