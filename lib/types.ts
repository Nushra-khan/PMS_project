export type Role = "employee" | "manager" | "admin";

export type ReviewTrack = "biannual" | "quarterly";

export type GoalScope = "company" | "team" | "individual";

export type GoalStatus =
  | "draft"
  | "pending_approval"
  | "active"
  | "completed"
  | "archived";

export type RatingValue =
  | "below_expectations"
  | "meets_expectations"
  | "above_expectations";

export type ProbationStatus =
  | "active"
  | "paused"
  | "completed"
  | "terminated"
  | "extended";

export type CheckpointType = "day_30" | "day_60" | "day_80";

export type CheckpointStatus =
  | "waiting_for_employee"
  | "waiting_for_manager"
  | "ready_for_cross_share"
  | "shared"
  | "waived"
  | "blocked"
  | "cancelled";

export type CycleType = "biannual" | "quarterly";

export type ReviewStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "overdue"
  | "waived"
  | "finalized";

export type DiscussionStatus =
  | "not_scheduled"
  | "scheduled"
  | "completed";

export type FlagSeverity = "soft" | "medium" | "high";

export type FlagStatus = "open" | "under_review" | "escalated" | "resolved";

export type NotificationStatus = "queued" | "sent" | "failed";

export interface Team {
  id: string;
  name: string;
  department: string;
  leadProfileId: string;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  title: string;
  department: string;
  teamId: string;
  reviewTrack: ReviewTrack;
  roles: Role[];
  managerId?: string;
  dateOfJoining: string;
}

export interface Goal {
  id: string;
  title: string;
  ownerProfileId: string;
  scope: GoalScope;
  status: GoalStatus;
  weightage: number;
  completionPct: number;
  cycleId: string;
  parentGoalId?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  dueDate: string;
  summary: string;
}

export interface GoalUpdate {
  id: string;
  goalId: string;
  postedBy: string;
  postedAt: string;
  kind: "progress" | "blocker" | "nudge" | "completion";
  body: string;
}

export interface GoalApprovalEvent {
  id: string;
  goalId: string;
  action: "submit" | "approve" | "reject" | "resubmit" | "archive";
  actorProfileId: string;
  createdAt: string;
  notes?: string;
}

export interface LeavePeriod {
  id: string;
  profileId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface ProbationCase {
  id: string;
  profileId: string;
  managerProfileId?: string;
  status: ProbationStatus;
  confirmationCallDate?: string;
  adminOwnerProfileId: string;
}

export interface ProbationCheckpoint {
  id: string;
  caseId: string;
  checkpointType: CheckpointType;
  formTitle: string;
  dueDate: string;
  status: CheckpointStatus;
  revisedDueDate?: string;
}

export interface FeedbackSubmission {
  id: string;
  workflowType: "probation" | "cycle_review";
  requestLabel: string;
  submittedBy: string;
  targetProfileId: string;
  relatedCheckpointId?: string;
  relatedCycleId?: string;
  score: number;
  comments: string;
  submittedAt: string;
}

export interface ReviewCycle {
  id: string;
  label: string;
  cycleType: CycleType;
  goalWindowLabel: string;
  triggerDate: string;
  closeDate: string;
  finalizeFrom?: string;
}

export interface CycleEnrollment {
  id: string;
  cycleId: string;
  profileId: string;
  managerProfileId: string;
  reviewStatus: ReviewStatus;
  discussionStatus: DiscussionStatus;
  finalRating?: RatingValue;
}

export interface ReviewSubmission {
  id: string;
  cycleId: string;
  profileId: string;
  reviewerProfileId: string;
  submissionType: "self_review" | "manager_review";
  status: ReviewStatus;
  submittedAt?: string;
  rating?: RatingValue;
}

export interface FlagItem {
  id: string;
  submissionId: string;
  employeeProfileId: string;
  severity: FlagSeverity;
  status: FlagStatus;
  reason: string;
  agedAt: string;
}

export interface NotificationItem {
  id: string;
  audienceRole: Role;
  title: string;
  body: string;
  status: NotificationStatus;
  sentAt?: string;
}

export interface AuditLog {
  id: string;
  actorProfileId: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
  summary: string;
}

export interface AppSettings {
  redFlagThreshold: number;
  goalApprovalEscalationBusinessDays: number;
  probationEscalationDays: number;
  secondaryAdminProfileId: string;
  successorAdminProfileId: string;
}

export interface AppSession {
  role: Role;
  userId: string;
  workspaceProfileId: string;
  sessionMode: "demo" | "auth_preview" | "live";
  authUserId?: string;
  profile: Profile;
}
