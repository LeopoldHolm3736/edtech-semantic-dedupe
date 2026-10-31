import { decideNearDuplicate } from "./decision.ts";

const incoming = { id: "lesson-204", courseId: "algebra-1", delivery: "live" as const, deadline: "2026-11-15", educatorReport: "Learners need a worked example before the next check-in." };
const nearest = { id: "lesson-118", score: 0.96, record: { ...incoming, id: "lesson-118", educatorReport: "Learners need a worked example before the next check-in." } };

console.log(JSON.stringify({ incomingId: incoming.id, nearestId: nearest.id, decision: decideNearDuplicate(nearest) ? "review-as-near-duplicate" : "keep-as-new-record" }, null, 2));
