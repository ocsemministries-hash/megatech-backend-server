/** Aggregated counts the admin dashboard renders as stat cards + nav badges. */
export interface DashboardCountsDto {
  admins: { total: number; active: number; pending: number };
  subscribers: { active: number; total: number };
  payments: { total: number; paid: number; pending: number };
}

/** Dashboard summary: counts + the badges the sidebar shows. */
export interface DashboardSummaryDto {
  generatedAt: string;
  counts: DashboardCountsDto;
  badges: { pendingAdmins: number };
}
