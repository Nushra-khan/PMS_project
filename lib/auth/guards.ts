import { Role } from "@/lib/types";

export function canAccessAdmin(role: Role) {
  return role === "admin";
}

export function canApproveGoals(role: Role) {
  return role === "manager" || role === "admin";
}

export function canReviewFlags(role: Role) {
  return role === "manager" || role === "admin";
}
