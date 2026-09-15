const CARACAS_OFFSET = "-04:00";

// Vercel Web Analytics rejects aggregate queries above this limit.
export const VERCEL_ANALYTICS_RESULT_LIMIT = 100;

export function createVercelAnalyticsParams(options: {
  projectId: string;
  teamId?: string;
  from: string;
  to: string;
  by: string;
}): URLSearchParams {
  const params = new URLSearchParams({
    projectId: options.projectId,
    since: `${options.from}T00:00:00${CARACAS_OFFSET}`,
    until: `${options.to}T23:59:59${CARACAS_OFFSET}`,
    by: options.by,
    limit: String(VERCEL_ANALYTICS_RESULT_LIMIT),
  });
  if (options.teamId) params.set("teamId", options.teamId);
  return params;
}
