import { useEffect, useState, useCallback, useMemo } from "react";
import {
  BarChart3,
  Brain,
  Cpu,
  Hash,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  AnalyticsResponse,
  AnalyticsDailyEntry,
  AnalyticsModelEntry,
  AnalyticsAgentEntry,
  AnalyticsActiveModelEntry,
  AnalyticsSkillEntry,
  CodexQuotaModel,
  DashboardOrgChartResponse,
  DashboardOrgChartRegistryRole,
} from "@/lib/api";
import { timeAgo, isoTimeAgo } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { useI18n } from "@/i18n";
import { LEAD_ROLE, ORG_SECTIONS } from "@/data/hermesOrgChart.generated";

const PERIODS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

const CHART_HEIGHT_PX = 160;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(day: string): string {
  try {
    const d = new Date(day + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return day;
  }
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function TokenBarChart({ daily }: { daily: AnalyticsDailyEntry[] }) {
  const { t } = useI18n();
  if (daily.length === 0) return null;

  const maxTokens = Math.max(...daily.map((d) => d.input_tokens + d.output_tokens), 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">{t.analytics.dailyTokenUsage}</CardTitle>
        </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 bg-[#ffe6cb]" />
            {t.analytics.input}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 bg-emerald-500" />
            {t.analytics.output}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-[2px]" style={{ height: CHART_HEIGHT_PX }}>
          {daily.map((d) => {
            const total = d.input_tokens + d.output_tokens;
            const inputH = Math.round((d.input_tokens / maxTokens) * CHART_HEIGHT_PX);
            const outputH = Math.round((d.output_tokens / maxTokens) * CHART_HEIGHT_PX);
            return (
              <div
                key={d.day}
                className="flex-1 min-w-0 group relative flex flex-col justify-end"
                style={{ height: CHART_HEIGHT_PX }}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                  <div className="bg-card border border-border px-2.5 py-1.5 text-[10px] text-foreground shadow-lg whitespace-nowrap">
                    <div className="font-medium">{formatDate(d.day)}</div>
                    <div>{t.analytics.input}: {formatTokens(d.input_tokens)}</div>
                    <div>{t.analytics.output}: {formatTokens(d.output_tokens)}</div>
                    <div>{t.analytics.total}: {formatTokens(total)}</div>
                  </div>
                </div>
                {/* Input bar */}
                <div
                  className="w-full bg-[#ffe6cb]/70"
                  style={{ height: Math.max(inputH, total > 0 ? 1 : 0) }}
                />
                {/* Output bar */}
                <div
                  className="w-full bg-emerald-500/70"
                  style={{ height: Math.max(outputH, d.output_tokens > 0 ? 1 : 0) }}
                />
              </div>
            );
          })}
        </div>
        {/* X-axis labels */}
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
          <span>{daily.length > 0 ? formatDate(daily[0].day) : ""}</span>
          {daily.length > 2 && (
            <span>{formatDate(daily[Math.floor(daily.length / 2)].day)}</span>
          )}
          <span>{daily.length > 1 ? formatDate(daily[daily.length - 1].day) : ""}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function DailyTable({ daily }: { daily: AnalyticsDailyEntry[] }) {
  const { t } = useI18n();
  if (daily.length === 0) return null;

  const sorted = [...daily].reverse();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">{t.analytics.dailyBreakdown}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="text-left py-2 pr-4 font-medium">{t.analytics.date}</th>
                <th className="text-right py-2 px-4 font-medium">{t.sessions.title}</th>
                <th className="text-right py-2 px-4 font-medium">{t.analytics.input}</th>
                <th className="text-right py-2 pl-4 font-medium">{t.analytics.output}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => {
                return (
                  <tr key={d.day} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="py-2 pr-4 font-medium">{formatDate(d.day)}</td>
                    <td className="text-right py-2 px-4 text-muted-foreground">{d.sessions}</td>
                    <td className="text-right py-2 px-4">
                      <span className="text-[#ffe6cb]">{formatTokens(d.input_tokens)}</span>
                    </td>
                    <td className="text-right py-2 pl-4">
                      <span className="text-emerald-400">{formatTokens(d.output_tokens)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ModelTable({ models }: { models: AnalyticsModelEntry[] }) {
  const { t } = useI18n();
  if (models.length === 0) return null;

  const sorted = [...models].sort(
    (a, b) => b.input_tokens + b.output_tokens - (a.input_tokens + a.output_tokens),
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">{t.analytics.perModelBreakdown}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="text-left py-2 pr-4 font-medium">{t.analytics.model}</th>
                <th className="text-right py-2 px-4 font-medium">{t.sessions.title}</th>
                <th className="text-right py-2 pl-4 font-medium">{t.analytics.tokens}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.model} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="py-2 pr-4">
                    <span className="font-mono-ui text-xs">{m.model}</span>
                  </td>
                  <td className="text-right py-2 px-4 text-muted-foreground">{m.sessions}</td>
                  <td className="text-right py-2 pl-4">
                    <span className="text-[#ffe6cb]">{formatTokens(m.input_tokens)}</span>
                    {" / "}
                    <span className="text-emerald-400">{formatTokens(m.output_tokens)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function quotaBadgeVariant(remaining: number): "success" | "warning" | "destructive" {
  if (remaining <= 10) return "destructive";
  if (remaining <= 35) return "warning";
  return "success";
}

function formatResetTime(epochSeconds: number | null | undefined): string {
  if (!epochSeconds) return "Reset unknown";
  return `Resets ${timeAgo(epochSeconds)}`;
}

function ActiveQuotaMeter({ label, bucket }: { label: string; bucket: CodexQuotaModel["primary"] }) {
  if (!bucket) {
    return (
      <div className="grid gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
          <Badge tone="outline" className="text-[10px]">Unknown</Badge>
        </div>
      </div>
    );
  }

  const remaining = Math.max(0, Math.min(100, bucket.remaining_percent ?? 0));
  const variant = quotaBadgeVariant(remaining);
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <Badge tone={variant} className="text-[10px]">{remaining.toFixed(0)}% remaining</Badge>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={`h-full rounded-full ${variant === "destructive" ? "bg-destructive" : variant === "warning" ? "bg-warning" : "bg-emerald-500"}`}
          style={{ width: `${remaining}%` }}
        />
      </div>
      <div className="text-[11px] text-muted-foreground">{formatResetTime(bucket.resets_at)}</div>
    </div>
  );
}

function ActiveModelsSection({ models }: { models: AnalyticsActiveModelEntry[] }) {
  if (models.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Active Models</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          Live snapshot of sessions active in the last 5 minutes. Fresh Codex quota appears per model when available.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-2">
        {models.map((entry) => (
          <div key={entry.model} className="border border-border/70 bg-background/35 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono-ui text-sm font-medium">{entry.model}</span>
              <Badge tone="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                {entry.active_sessions} active session{entry.active_sessions === 1 ? "" : "s"}
              </Badge>
              {entry.codex_quota?.plan_type && (
                <Badge tone="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                  {entry.codex_quota.plan_type}
                </Badge>
              )}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Last active {timeAgo(entry.last_active)}
              {entry.codex_quota?.observed_at ? ` · quota observed ${isoTimeAgo(entry.codex_quota.observed_at)}` : ""}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="border border-border/60 bg-secondary/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Input</div>
                <div className="mt-1 text-sm text-[#ffe6cb]">{formatTokens(entry.input_tokens)}</div>
              </div>
              <div className="border border-border/60 bg-secondary/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Cache read</div>
                <div className="mt-1 text-sm text-sky-300">{formatTokens(entry.cache_read_tokens)}</div>
              </div>
              <div className="border border-border/60 bg-secondary/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Output</div>
                <div className="mt-1 text-sm text-emerald-400">{formatTokens(entry.output_tokens)}</div>
              </div>
              <div className="border border-border/60 bg-secondary/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Total</div>
                <div className="mt-1 text-sm text-foreground">{formatTokens(entry.total_tokens)}</div>
              </div>
            </div>

            {entry.codex_quota && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <ActiveQuotaMeter label="Primary (5h)" bucket={entry.codex_quota.primary} />
                <ActiveQuotaMeter label="Secondary (weekly)" bucket={entry.codex_quota.secondary} />
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const FALLBACK_ORG_ROLES: DashboardOrgChartRegistryRole[] = [
  LEAD_ROLE as unknown as DashboardOrgChartRegistryRole,
  ...ORG_SECTIONS.flatMap((section) => section.roles as unknown as DashboardOrgChartRegistryRole[]),
];

type AggregatedAgentEntry = {
  roleTitle: string;
  rolePosition: string;
  input_tokens: number;
  output_tokens: number;
  sessions: number;
  delegateTaskCalls: number;
  delegatedSessions: number;
};

function RoleExecutionEvidence({
  observedRoleCount,
  totalRoleCount,
  delegateTaskCalls,
  delegatedSessionCount,
}: {
  observedRoleCount: number;
  totalRoleCount: number;
  delegateTaskCalls: number;
  delegatedSessionCount: number;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Role execution evidence</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Observed roles</div>
            <div className="mt-1 text-xl font-semibold">{observedRoleCount} / {totalRoleCount}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">delegate_task calls</div>
            <div className="mt-1 text-xl font-semibold">{delegateTaskCalls}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Delegated child sessions</div>
            <div className="mt-1 text-xl font-semibold">{delegatedSessionCount}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function findRoleTitle(
  orgRoles: DashboardOrgChartRegistryRole[],
  preferredTitles: string[],
  preferredPositions: string[],
  fallback: string,
): string {
  return (
    orgRoles.find((role) => preferredTitles.includes(role.title))?.title
    ?? orgRoles.find((role) => preferredPositions.includes(role.position))?.title
    ?? fallback
  );
}

function getRoleTitleForSource(source: string, orgRoles: DashboardOrgChartRegistryRole[]): string {
  const normalized = source.trim().toLowerCase();
  const lead = orgRoles[0]?.title ?? "Lead / PM";
  const developer = findRoleTitle(orgRoles, ["Developer"], ["Implementation specialist"], lead);
  const planner = findRoleTitle(orgRoles, ["Planner"], ["Planning lead"], lead);

  if (normalized === "acp") {
    return developer;
  }

  if (normalized === "cron") {
    return planner;
  }

  if (["cli", "discord", "signal", "telegram", "slack", "whatsapp", "matrix", "qqbot"].includes(normalized)) {
    return lead;
  }

  return lead;
}

function aggregateAgentsByRole(
  agents: AnalyticsAgentEntry[],
  orgRoles: DashboardOrgChartRegistryRole[],
  delegatedRoles: Record<string, number> = {},
): AggregatedAgentEntry[] {
  const aggregated = new Map<string, AggregatedAgentEntry>();

  for (const role of orgRoles) {
    aggregated.set(role.title, {
      roleTitle: role.title,
      rolePosition: role.position,
      input_tokens: 0,
      output_tokens: 0,
      sessions: 0,
      delegateTaskCalls: delegatedRoles[role.title] ?? 0,
      delegatedSessions: delegatedRoles[role.title] ?? 0,
    });
  }

  for (const agent of agents) {
    const roleTitle = getRoleTitleForSource(agent.source, orgRoles);
    const existing = aggregated.get(roleTitle);
    if (!existing) {
      continue;
    }

    existing.input_tokens += agent.input_tokens;
    existing.output_tokens += agent.output_tokens;
    existing.sessions += agent.sessions;
  }

  return orgRoles.map((role) => aggregated.get(role.title)!).filter(Boolean);
}

function AgentAnalyticsTable({ agents }: { agents: AggregatedAgentEntry[] }) {
  if (agents.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Per-agent details</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          The list is driven by the live org chart and shows one row per agent role. Runtime sources such as CLI or ACP are collapsed into their mapped agent so the table stays agent-focused. Delegate activity is shown per role.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="text-left py-2 pr-4 font-medium">Agent</th>
                <th className="text-right py-2 px-4 font-medium">Sessions</th>
                <th className="text-right py-2 px-4 font-medium">delegate_task calls</th>
                <th className="text-right py-2 px-4 font-medium">Delegated child sessions</th>
                <th className="text-right py-2 pl-4 font-medium">Token in / out</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.roleTitle} className="border-b border-border/50 hover:bg-secondary/20 transition-colors align-top">
                  <td className="py-2 pr-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="font-medium">{agent.roleTitle}</div>
                      <div className="text-xs text-muted-foreground">{agent.rolePosition}</div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {agent.delegatedSessions > 0
                          ? `Observed delegated pass · ${agent.delegatedSessions}`
                          : agent.sessions > 0
                            ? "Observed in telemetry"
                            : "No observed pass yet"}
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-2 px-4 text-muted-foreground">{agent.sessions}</td>
                  <td className="text-right py-2 px-4 text-muted-foreground">{agent.delegateTaskCalls}</td>
                  <td className="text-right py-2 px-4 text-muted-foreground">{agent.delegatedSessions}</td>
                  <td className="text-right py-2 pl-4">
                    <span className="text-[#ffe6cb]">{formatTokens(agent.input_tokens)}</span>
                    {" / "}
                    <span className="text-emerald-400">{formatTokens(agent.output_tokens)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SkillTable({ skills }: { skills: AnalyticsSkillEntry[] }) {
  const { t } = useI18n();
  if (skills.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">{t.analytics.topSkills}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="text-left py-2 pr-4 font-medium">{t.analytics.skill}</th>
                <th className="text-right py-2 px-4 font-medium">{t.analytics.loads}</th>
                <th className="text-right py-2 px-4 font-medium">{t.analytics.edits}</th>
                <th className="text-right py-2 px-4 font-medium">{t.analytics.total}</th>
                <th className="text-right py-2 pl-4 font-medium">{t.analytics.lastUsed}</th>
              </tr>
            </thead>
            <tbody>
              {skills.map((skill) => (
                <tr key={skill.skill} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="py-2 pr-4">
                    <span className="font-mono-ui text-xs">{skill.skill}</span>
                  </td>
                  <td className="text-right py-2 px-4 text-muted-foreground">{skill.view_count}</td>
                  <td className="text-right py-2 px-4 text-muted-foreground">{skill.manage_count}</td>
                  <td className="text-right py-2 px-4">{skill.total_count}</td>
                  <td className="text-right py-2 pl-4 text-muted-foreground">
                    {skill.last_used_at ? timeAgo(skill.last_used_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function RoleRuntimeCard({
  roleRuntime,
}: {
  roleRuntime: AnalyticsResponse["role_runtime"] | null | undefined;
}) {
  if (!roleRuntime || roleRuntime.total_invocations === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Role runtime</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            icon={BarChart3}
            label="Role invocations"
            value={String(roleRuntime.total_invocations)}
            sub={`${roleRuntime.default_invocation_count} default · ${roleRuntime.override_invocation_count} overrides`}
          />
          <SummaryCard
            icon={Cpu}
            label="Sessions with role invocations"
            value={String(roleRuntime.sessions_with_role_invocations)}
            sub={`${roleRuntime.by_role.length} distinct roles`}
          />
          <SummaryCard
            icon={TrendingUp}
            label="Findings"
            value={String(roleRuntime.findings.open_count)}
            sub={`${roleRuntime.findings.pending_revalidation_count} pending · ${roleRuntime.findings.closed_count} closed · ${roleRuntime.findings.send_back_count} send-backs`}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-border/60 bg-background/30 p-3">
            <p className="text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
              By role
            </p>
            <div className="mt-2 space-y-2">
              {roleRuntime.by_role.length > 0 ? (
                roleRuntime.by_role.map((entry) => (
                  <div
                    key={entry.role}
                    className="flex items-center justify-between gap-3 rounded border border-border/50 bg-background/60 px-3 py-2"
                  >
                    <span className="text-sm text-foreground/90">{entry.role}</span>
                    <span className="font-mono-ui text-sm text-muted-foreground">{entry.count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No role runtime data.</p>
              )}
            </div>
          </div>

          <div className="rounded border border-border/60 bg-background/30 p-3">
            <p className="text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
              By execution mode
            </p>
            <div className="mt-2 space-y-2">
              {roleRuntime.by_execution_mode.length > 0 ? (
                roleRuntime.by_execution_mode.map((entry) => (
                  <div
                    key={entry.execution_mode}
                    className="flex items-center justify-between gap-3 rounded border border-border/50 bg-background/60 px-3 py-2"
                  >
                    <span className="text-sm text-foreground/90">{entry.execution_mode}</span>
                    <span className="font-mono-ui text-sm text-muted-foreground">{entry.count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No role runtime data.</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [orgChart, setOrgChart] = useState<DashboardOrgChartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.getAnalytics(days), api.getOrgChart()])
      .then(([analytics, liveOrgChart]) => {
        setData(analytics);
        setOrgChart(liveOrgChart);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const orgRoles = useMemo(
    () => orgChart
      ? [orgChart.data.lead_role, ...orgChart.data.org_sections.flatMap((section) => section.roles)]
      : FALLBACK_ORG_ROLES,
    [orgChart],
  );

  const aggregatedAgents = useMemo(
    () => aggregateAgentsByRole(data?.by_agent ?? [], orgRoles, data?.delegate_metrics?.delegated_roles ?? {}),
    [data, orgRoles],
  );
  const observedRoleCount = useMemo(
    () => aggregatedAgents.filter((agent) => agent.sessions > 0 || agent.delegatedSessions > 0).length,
    [aggregatedAgents],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground font-medium">{t.analytics.period}</span>
        {PERIODS.map((p) => (
          <Button
            key={p.label}
            outlined={days !== p.days}
            size="sm"
            className="text-xs h-7"
            onClick={() => setDays(p.days)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center py-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive text-center">{error}</p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryCard
              icon={Hash}
              label={t.analytics.totalTokens}
              value={formatTokens(data.totals.total_input + data.totals.total_output)}
              sub={t.analytics.inOut.replace("{input}", formatTokens(data.totals.total_input)).replace("{output}", formatTokens(data.totals.total_output))}
            />
            <SummaryCard
              icon={BarChart3}
              label={t.analytics.totalSessions}
              value={String(data.totals.total_sessions)}
              sub={`~${(data.totals.total_sessions / days).toFixed(1)}${t.analytics.perDayAvg}`}
            />
            <SummaryCard
              icon={TrendingUp}
              label={t.analytics.apiCalls}
              value={String(data.totals.total_api_calls ?? data.daily.reduce((sum, d) => sum + d.sessions, 0))}
              sub={t.analytics.acrossModels.replace("{count}", String(data.by_model.length))}
            />
          </div>

          {/* Bar chart */}
          <ActiveModelsSection models={data.active_models ?? []} />
          <TokenBarChart daily={data.daily} />

          <RoleExecutionEvidence
            observedRoleCount={observedRoleCount}
            totalRoleCount={aggregatedAgents.length}
            delegateTaskCalls={data.delegate_metrics?.delegate_task_calls ?? 0}
            delegatedSessionCount={data.delegate_metrics?.child_sessions ?? 0}
          />

          {/* Tables */}
          <AgentAnalyticsTable agents={aggregatedAgents} />
          <DailyTable daily={data.daily} />
          <ModelTable models={data.by_model} />
          <SkillTable skills={data.skills?.top_skills ?? []} />
          <RoleRuntimeCard roleRuntime={data.role_runtime} />
        </>
      )}

      {data && data.daily.length === 0 && data.by_model.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-muted-foreground">
              <BarChart3 className="h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm font-medium">{t.analytics.noUsageData}</p>
              <p className="text-xs mt-1 text-muted-foreground/60">{t.analytics.startSession}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
