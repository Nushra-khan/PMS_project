import {
  AppSettings,
  AuditLog,
  CycleEnrollment,
  FeedbackSubmission,
  FlagItem,
  Goal,
  GoalApprovalEvent,
  GoalUpdate,
  LeavePeriod,
  NotificationItem,
  ProbationCase,
  ProbationCheckpoint,
  Profile,
  ReviewCycle,
  ReviewSubmission,
  Team
} from "@/lib/types";

export const teams: Team[] = [
  {
    id: "team-platform",
    name: "Platform Operations",
    department: "Technology",
    leadProfileId: "mgr-maya"
  },
  {
    id: "team-customer",
    name: "Customer Success",
    department: "Customer Operations",
    leadProfileId: "mgr-arjun"
  }
];

export const profiles: Profile[] = [
  {
    id: "admin-nushra",
    name: "Nushra Ali",
    email: "nushra.hr@pms.local",
    title: "Admin (HR)",
    department: "People Operations",
    teamId: "team-platform",
    reviewTrack: "biannual",
    roles: ["admin"],
    dateOfJoining: "2023-02-13"
  },
  {
    id: "mgr-maya",
    name: "Maya Singh",
    email: "maya.singh@pms.local",
    title: "Engineering Manager",
    department: "Technology",
    teamId: "team-platform",
    reviewTrack: "biannual",
    roles: ["manager"],
    dateOfJoining: "2022-08-01"
  },
  {
    id: "mgr-arjun",
    name: "Arjun Mehta",
    email: "arjun.mehta@pms.local",
    title: "Customer Success Lead",
    department: "Customer Operations",
    teamId: "team-customer",
    reviewTrack: "quarterly",
    roles: ["employee", "manager"],
    managerId: "mgr-maya",
    dateOfJoining: "2023-01-09"
  },
  {
    id: "emp-aanya",
    name: "Aanya Patel",
    email: "aanya.patel@pms.local",
    title: "Frontend Engineer",
    department: "Technology",
    teamId: "team-platform",
    reviewTrack: "biannual",
    roles: ["employee"],
    managerId: "mgr-maya",
    dateOfJoining: "2024-01-15"
  },
  {
    id: "emp-rohan",
    name: "Rohan Kapoor",
    email: "rohan.kapoor@pms.local",
    title: "Backend Engineer",
    department: "Technology",
    teamId: "team-platform",
    reviewTrack: "biannual",
    roles: ["employee"],
    managerId: "mgr-maya",
    dateOfJoining: "2024-02-12"
  },
  {
    id: "emp-neha",
    name: "Neha Iyer",
    email: "neha.iyer@pms.local",
    title: "Customer Success Associate",
    department: "Customer Operations",
    teamId: "team-customer",
    reviewTrack: "quarterly",
    roles: ["employee"],
    managerId: "mgr-arjun",
    dateOfJoining: "2026-01-06"
  }
];

export const goals: Goal[] = [
  {
    id: "goal-company-reliability",
    title: "Improve customer workflow reliability",
    ownerProfileId: "admin-nushra",
    scope: "company",
    status: "active",
    weightage: 100,
    completionPct: 58,
    cycleId: "cycle-2026-q2",
    createdBy: "admin-nushra",
    approvedBy: "admin-nushra",
    approvedAt: "2026-03-28T09:15:00Z",
    dueDate: "2026-06-30",
    summary: "Reduce manual performance tracking gaps by centralizing workflows."
  },
  {
    id: "goal-team-platform-visibility",
    title: "Ship manager visibility dashboard",
    ownerProfileId: "mgr-maya",
    scope: "team",
    status: "active",
    weightage: 100,
    completionPct: 64,
    cycleId: "cycle-2026-q2",
    parentGoalId: "goal-company-reliability",
    createdBy: "mgr-maya",
    approvedBy: "admin-nushra",
    approvedAt: "2026-04-01T08:10:00Z",
    dueDate: "2026-06-24",
    summary: "Give managers live views of approvals, overdue forms, and review status."
  },
  {
    id: "goal-aanya-employee-goals",
    title: "Deliver employee goal drafting experience",
    ownerProfileId: "emp-aanya",
    scope: "individual",
    status: "active",
    weightage: 55,
    completionPct: 72,
    cycleId: "cycle-2026-q2",
    parentGoalId: "goal-team-platform-visibility",
    createdBy: "emp-aanya",
    approvedBy: "mgr-maya",
    approvedAt: "2026-04-02T10:00:00Z",
    dueDate: "2026-06-18",
    summary: "Enable employees to draft, submit, and revise goals with manager feedback."
  },
  {
    id: "goal-aanya-reminder-engine",
    title: "Implement reminder escalation workflow",
    ownerProfileId: "emp-aanya",
    scope: "individual",
    status: "pending_approval",
    weightage: 45,
    completionPct: 20,
    cycleId: "cycle-2026-q2",
    parentGoalId: "goal-team-platform-visibility",
    createdBy: "emp-aanya",
    dueDate: "2026-06-29",
    summary: "Cover probation reminders and approval escalations with audit trails."
  },
  {
    id: "goal-rohan-data-foundation",
    title: "Finalize PMS relational data model",
    ownerProfileId: "emp-rohan",
    scope: "individual",
    status: "active",
    weightage: 100,
    completionPct: 61,
    cycleId: "cycle-2026-q2",
    parentGoalId: "goal-team-platform-visibility",
    createdBy: "mgr-maya",
    approvedBy: "mgr-maya",
    approvedAt: "2026-04-03T11:30:00Z",
    dueDate: "2026-06-20",
    summary: "Model goals, cycles, probation, and flags in a single audit-friendly schema."
  },
  {
    id: "goal-neha-day60-followup",
    title: "Complete customer onboarding quality review",
    ownerProfileId: "emp-neha",
    scope: "individual",
    status: "active",
    weightage: 60,
    completionPct: 40,
    cycleId: "cycle-2026-q2",
    createdBy: "mgr-arjun",
    approvedBy: "mgr-arjun",
    approvedAt: "2026-04-05T06:45:00Z",
    dueDate: "2026-06-22",
    summary: "Improve onboarding handoff quality and reduce repeat customer touchpoints."
  },
  {
    id: "goal-neha-support-playbook",
    title: "Build escalation playbook for repeat flags",
    ownerProfileId: "emp-neha",
    scope: "individual",
    status: "draft",
    weightage: 40,
    completionPct: 0,
    cycleId: "cycle-2026-q2",
    createdBy: "emp-neha",
    dueDate: "2026-06-27",
    summary: "Document response patterns for customers with repeated issues."
  }
];

export const goalUpdates: GoalUpdate[] = [
  {
    id: "update-aanya-1",
    goalId: "goal-aanya-employee-goals",
    postedBy: "emp-aanya",
    postedAt: "2026-04-10T13:30:00Z",
    kind: "progress",
    body: "Completed first-pass approval queue wireframes and server-side role guards."
  },
  {
    id: "update-aanya-2",
    goalId: "goal-aanya-reminder-engine",
    postedBy: "emp-aanya",
    postedAt: "2026-04-14T09:50:00Z",
    kind: "blocker",
    body: "Need final rules for business-day handling before locking the scheduler logic."
  },
  {
    id: "update-neha-1",
    goalId: "goal-neha-day60-followup",
    postedBy: "mgr-arjun",
    postedAt: "2026-04-11T07:05:00Z",
    kind: "nudge",
    body: "Please attach the customer-call summary before the Day 60 checkpoint closes."
  }
];

export const goalApprovalEvents: GoalApprovalEvent[] = [
  {
    id: "goal-event-1",
    goalId: "goal-aanya-reminder-engine",
    action: "submit",
    actorProfileId: "emp-aanya",
    createdAt: "2026-04-12T14:05:00Z",
    notes: "Ready for manager review with updated timeline assumptions."
  },
  {
    id: "goal-event-2",
    goalId: "goal-neha-support-playbook",
    action: "submit",
    actorProfileId: "emp-neha",
    createdAt: "2026-04-15T08:30:00Z",
    notes: "Draft shared for early coaching before formal approval."
  }
];

export const leavePeriods: LeavePeriod[] = [
  {
    id: "leave-neha-1",
    profileId: "emp-neha",
    startDate: "2026-03-24",
    endDate: "2026-03-28",
    reason: "Medical leave"
  }
];

export const probationCases: ProbationCase[] = [
  {
    id: "probation-neha",
    profileId: "emp-neha",
    managerProfileId: "mgr-arjun",
    status: "paused",
    confirmationCallDate: "2026-05-06",
    adminOwnerProfileId: "admin-nushra"
  },
  {
    id: "probation-rohan",
    profileId: "emp-rohan",
    managerProfileId: "mgr-maya",
    status: "completed",
    confirmationCallDate: "2024-05-15",
    adminOwnerProfileId: "admin-nushra"
  }
];

export const probationCheckpoints: ProbationCheckpoint[] = [
  {
    id: "checkpoint-neha-30",
    caseId: "probation-neha",
    checkpointType: "day_30",
    formTitle: "Initial check-in",
    dueDate: "2026-02-17",
    status: "shared"
  },
  {
    id: "checkpoint-neha-60",
    caseId: "probation-neha",
    checkpointType: "day_60",
    formTitle: "Mid-probation review",
    dueDate: "2026-03-31",
    revisedDueDate: "2026-04-07",
    status: "waiting_for_manager"
  },
  {
    id: "checkpoint-neha-80",
    caseId: "probation-neha",
    checkpointType: "day_80",
    formTitle: "Final pre-confirmation review",
    dueDate: "2026-04-28",
    revisedDueDate: "2026-05-05",
    status: "blocked"
  }
];

export const reviewCycles: ReviewCycle[] = [
  {
    id: "cycle-2026-biannual-h1",
    label: "Bi-Annual Cycle 1",
    cycleType: "biannual",
    goalWindowLabel: "April-September 2026",
    triggerDate: "2026-08-01",
    closeDate: "2026-08-25",
    finalizeFrom: "2026-08-26"
  },
  {
    id: "cycle-2026-q2",
    label: "Quarterly Q2",
    cycleType: "quarterly",
    goalWindowLabel: "April-June 2026",
    triggerDate: "2026-07-01",
    closeDate: "2026-07-15"
  }
];

export const cycleEnrollments: CycleEnrollment[] = [
  {
    id: "enroll-aanya-h1",
    cycleId: "cycle-2026-biannual-h1",
    profileId: "emp-aanya",
    managerProfileId: "mgr-maya",
    reviewStatus: "in_progress",
    discussionStatus: "scheduled"
  },
  {
    id: "enroll-rohan-h1",
    cycleId: "cycle-2026-biannual-h1",
    profileId: "emp-rohan",
    managerProfileId: "mgr-maya",
    reviewStatus: "submitted",
    discussionStatus: "completed",
    finalRating: "meets_expectations"
  },
  {
    id: "enroll-neha-q2",
    cycleId: "cycle-2026-q2",
    profileId: "emp-neha",
    managerProfileId: "mgr-arjun",
    reviewStatus: "not_started",
    discussionStatus: "not_scheduled"
  },
  {
    id: "enroll-arjun-q2",
    cycleId: "cycle-2026-q2",
    profileId: "mgr-arjun",
    managerProfileId: "mgr-maya",
    reviewStatus: "in_progress",
    discussionStatus: "scheduled"
  }
];

export const reviewSubmissions: ReviewSubmission[] = [
  {
    id: "review-aanya-self",
    cycleId: "cycle-2026-biannual-h1",
    profileId: "emp-aanya",
    reviewerProfileId: "emp-aanya",
    submissionType: "self_review",
    status: "submitted",
    submittedAt: "2026-08-08T10:10:00Z",
    rating: "meets_expectations"
  },
  {
    id: "review-rohan-manager",
    cycleId: "cycle-2026-biannual-h1",
    profileId: "emp-rohan",
    reviewerProfileId: "mgr-maya",
    submissionType: "manager_review",
    status: "finalized",
    submittedAt: "2026-08-21T08:50:00Z",
    rating: "meets_expectations"
  }
];

export const feedbackSubmissions: FeedbackSubmission[] = [
  {
    id: "feedback-neha-self-60",
    workflowType: "probation",
    requestLabel: "Day 60 self-feedback",
    submittedBy: "emp-neha",
    targetProfileId: "emp-neha",
    relatedCheckpointId: "checkpoint-neha-60",
    score: 2,
    comments: "I need more clarity on cross-team escalation expectations.",
    submittedAt: "2026-04-09T09:00:00Z"
  },
  {
    id: "feedback-rohan-self-h1",
    workflowType: "cycle_review",
    requestLabel: "Bi-Annual self-review",
    submittedBy: "emp-rohan",
    targetProfileId: "emp-rohan",
    relatedCycleId: "cycle-2026-biannual-h1",
    score: 4,
    comments: "Delivered the schema foundation and ownership transfer support.",
    submittedAt: "2026-08-09T12:30:00Z"
  },
  {
    id: "feedback-neha-manager-30",
    workflowType: "probation",
    requestLabel: "Day 30 manager feedback",
    submittedBy: "mgr-arjun",
    targetProfileId: "emp-neha",
    relatedCheckpointId: "checkpoint-neha-30",
    score: 3,
    comments: "",
    submittedAt: "2026-02-18T06:45:00Z"
  }
];

export const flags: FlagItem[] = [
  {
    id: "flag-neha-repeat",
    submissionId: "feedback-neha-self-60",
    employeeProfileId: "emp-neha",
    severity: "high",
    status: "under_review",
    reason: "Repeat low-score signal across consecutive checkpoints."
      ,
    agedAt: "2026-04-09T09:00:00Z"
  },
  {
    id: "flag-neha-soft",
    submissionId: "feedback-neha-manager-30",
    employeeProfileId: "emp-neha",
    severity: "soft",
    status: "open",
    reason: "Blank open-ended response from manager feedback.",
    agedAt: "2026-02-18T06:45:00Z"
  }
];

export const notifications: NotificationItem[] = [
  {
    id: "notif-approval-aanya",
    audienceRole: "manager",
    title: "Goal approval pending",
    body: "Aanya submitted a reminder-engine goal that needs review within 5 business days.",
    status: "queued"
  },
  {
    id: "notif-neha-escalation",
    audienceRole: "admin",
    title: "Probation checkpoint escalation",
    body: "Neha's Day 60 manager submission is overdue and requires Admin visibility.",
    status: "sent",
    sentAt: "2026-04-14T07:00:00Z"
  },
  {
    id: "notif-aanya-approved",
    audienceRole: "employee",
    title: "Goal approval update",
    body: "You will receive approval status changes here and by email.",
    status: "queued"
  }
];

export const auditLogs: AuditLog[] = [
  {
    id: "audit-1",
    actorProfileId: "emp-aanya",
    entityType: "goal",
    entityId: "goal-aanya-reminder-engine",
    action: "submit",
    createdAt: "2026-04-12T14:05:00Z",
    summary: "Employee submitted reminder escalation goal for manager approval."
  },
  {
    id: "audit-2",
    actorProfileId: "admin-nushra",
    entityType: "flag",
    entityId: "flag-neha-repeat",
    action: "review",
    createdAt: "2026-04-10T11:20:00Z",
    summary: "Admin opened repeat-flag review and assigned follow-up owner."
  },
  {
    id: "audit-3",
    actorProfileId: "mgr-arjun",
    entityType: "probation_checkpoint",
    entityId: "checkpoint-neha-80",
    action: "blocked",
    createdAt: "2026-04-15T08:10:00Z",
    summary: "Checkpoint blocked pending manager reassignment clarification."
  }
];

export const appSettings: AppSettings = {
  redFlagThreshold: 2,
  goalApprovalEscalationBusinessDays: 5,
  probationEscalationDays: 7,
  secondaryAdminProfileId: "mgr-maya",
  successorAdminProfileId: "mgr-maya"
};

export const demoWorkspace = {
  teams,
  profiles,
  goals,
  goalUpdates,
  goalApprovalEvents,
  leavePeriods,
  probationCases,
  probationCheckpoints,
  reviewCycles,
  cycleEnrollments,
  reviewSubmissions,
  feedbackSubmissions,
  flags,
  notifications,
  auditLogs,
  appSettings
};

export const demoProfilesByRole = {
  employee: profiles.filter((profile) => profile.roles.includes("employee")),
  manager: profiles.filter((profile) => profile.roles.includes("manager")),
  admin: profiles.filter((profile) => profile.roles.includes("admin"))
};
