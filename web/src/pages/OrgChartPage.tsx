import { useEffect, useMemo, useState, useCallback } from "react";
import {
  AlertTriangle,
  ArrowDown,
  Bug,
  Briefcase,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Compass,
  Crown,
  Cpu,
  Gauge,
  GitPullRequest,
  LayoutTemplate,
  RotateCw,
  ShieldCheck,
  Smartphone,
  Users2,
  Wrench,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  DashboardOrgChartRegistryData,
  DashboardOrgChartRegistryRole,
  DashboardOrgChartRegistrySection,
  DashboardOrgChartResponse,
} from "@/lib/api";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DEFAULT_OPEN_SECTIONS as GENERATED_DEFAULT_OPEN_SECTIONS,
  INVOKE_MATRIX as GENERATED_INVOKE_MATRIX,
  LEAD_ROLE as GENERATED_LEAD_ROLE,
  ORG_SECTIONS as GENERATED_ORG_SECTIONS,
  VERIFICATION_LEVELS as GENERATED_VERIFICATION_LEVELS,
  WORKFLOW_STEPS as GENERATED_WORKFLOW_STEPS,
  type OrgRole,
  type OrgSection,
} from "@/data/hermesOrgChart.generated";

const ICON_MAP = {
  Briefcase,
  ClipboardCheck,
  Compass,
  Crown,
  Cpu,
  Gauge,
  GitPullRequest,
  LayoutTemplate,
  ShieldCheck,
  Smartphone,
  Wrench,
} as const;

const FALLBACK_DATA = {
  lead_role: GENERATED_LEAD_ROLE,
  org_sections: GENERATED_ORG_SECTIONS,
  workflow_steps: GENERATED_WORKFLOW_STEPS,
  verification_levels: GENERATED_VERIFICATION_LEVELS,
  invoke_matrix: GENERATED_INVOKE_MATRIX,
};

const REGISTRY_POLL_INTERVAL_MS = 5000;

const DEFAULT_SKILL_POLICY: OrgRole["skills"] = {
  required: [],
  recommended: [],
  triggered: [],
};

const DEFAULT_RUNTIME_POLICY: OrgRole["runtimePolicy"] = {
  default_execution_mode: "persistent_role_instance",
  allowed_execution_modes: ["persistent_role_instance"],
  requires_independent_session: true,
  requires_artifact_handoff: true,
  lead_coordinates_feedback: true,
  lead_review_required_before_next_handoff: true,
  requires_revalidation_after_fix: true,
  worktree_strategy: "shared",
};

function toneVariant(tone: OrgRole["tone"]) {
  if (tone === "success") return "success";
  if (tone === "warning") return "warning";
  return "secondary";
}

function mapRole(role: DashboardOrgChartRegistryRole | OrgRole): OrgRole {
  const iconValue = typeof role.icon === "string" ? ICON_MAP[role.icon as keyof typeof ICON_MAP] ?? Wrench : role.icon;
  const orgRole = role as Partial<OrgRole>;
  return {
    ...role,
    skills: orgRole.skills ?? DEFAULT_SKILL_POLICY,
    runtimePolicy: orgRole.runtimePolicy ?? DEFAULT_RUNTIME_POLICY,
    icon: iconValue,
  };
}

function mapSection(section: DashboardOrgChartRegistrySection | OrgSection): OrgSection {
  return {
    ...section,
    roles: section.roles.map(mapRole),
  };
}

function normalizeOrgData(data: DashboardOrgChartRegistryData | typeof FALLBACK_DATA) {
  return {
    leadRole: mapRole(data.lead_role),
    sections: data.org_sections.map(mapSection),
    workflowSteps: data.workflow_steps,
    verificationLevels: data.verification_levels,
    invokeMatrix: data.invoke_matrix,
  };
}

function formatTimestamp(unixSeconds: number | null | undefined): string {
  if (!unixSeconds) return "Unknown";
  return new Date(unixSeconds * 1000).toLocaleString();
}

function RoleCard({ role }: { role: OrgRole }) {
  const Icon = role.icon;
  return (
    <div className="relative border border-border/70 bg-background/45 p-4 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-foreground)_4%,transparent)]">
      <div className="absolute -top-3 left-1/2 hidden h-3 w-px -translate-x-1/2 bg-primary/60 xl:block" />
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{role.title}</h3>
          </div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{role.position}</p>
        </div>
        <Badge tone={toneVariant(role.tone)}>{role.model}</Badge>
      </div>

      <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{role.mission}</p>

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <div className="border border-border/60 bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
          <span className="mr-2 uppercase tracking-[0.14em] text-foreground/80">Reports to</span>
          {role.reportsTo}
        </div>
        <div className="border border-border/60 bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
          <span className="mr-2 uppercase tracking-[0.14em] text-foreground/80">Activated</span>
          {role.activation}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-foreground/80">
            Core responsibilities
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {role.responsibilities.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-[5px] h-1.5 w-1.5 shrink-0 bg-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-foreground/80">
            Tool / focus lane
          </div>
          <div className="flex flex-wrap gap-1.5">
            {role.toolFocus.map((item) => (
              <Badge key={item} tone="secondary" className="text-[10px]">
                {item}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-foreground/80">
            Invoke for
          </div>
          <div className="flex flex-wrap gap-1.5">
            {role.invokeFor.map((item) => (
              <Badge key={item} tone="secondary" className="text-[10px]">
                {item}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionBlock({
  section,
  open,
  onToggle,
}: {
  section: OrgSection;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full flex-col gap-2 text-left lg:flex-row lg:items-center lg:justify-between"
        >
          <div>
            <CardTitle>{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <Badge tone="secondary">{section.lane}</Badge>
            <Badge tone="secondary">{section.roles.length} roles</Badge>
            {open ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-primary" />}
          </div>
        </button>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <ArrowDown className="h-3.5 w-3.5 text-primary" />
            Reports upward into Lead / PM
          </div>

          <div className="relative hidden xl:block">
            <div className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-primary/60" />
            <div className="mx-auto h-px w-[85%] bg-primary/40" />
          </div>

          <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3 xl:pt-4">
            {section.roles.map((role) => (
              <RoleCard key={role.title} role={role} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function OrgChartPage() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(GENERATED_DEFAULT_OPEN_SECTIONS);
  const [registryMeta, setRegistryMeta] = useState<DashboardOrgChartResponse | null>(null);
  const [loadingRegistry, setLoadingRegistry] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  const refreshRegistry = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoadingRegistry(true);
    }
    setRegistryError(null);
    try {
      const response = await api.getOrgChart();
      setRegistryMeta(response);
      setLastCheckedAt(Date.now());
    } catch (error) {
      setRegistryError(error instanceof Error ? error.message : "Failed to load registry");
      setLastCheckedAt(Date.now());
    } finally {
      if (!silent) {
        setLoadingRegistry(false);
      }
    }
  }, []);

  useEffect(() => {
    refreshRegistry();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshRegistry({ silent: true });
      }
    }, REGISTRY_POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshRegistry({ silent: true });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshRegistry]);

  const normalized = useMemo(
    () => normalizeOrgData(registryMeta?.data ?? FALLBACK_DATA),
    [registryMeta],
  );

  const leadRole = normalized.leadRole;
  const orgSections = normalized.sections;
  const workflowSteps = normalized.workflowSteps;
  const verificationLevels = normalized.verificationLevels;
  const staleGenerated = !!(
    registryMeta?.generated_exists &&
    registryMeta.generated_updated_at &&
    registryMeta.registry_updated_at > registryMeta.generated_updated_at
  );

  return (
    <div className="flex flex-col gap-5 px-3 sm:px-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users2 className="h-5 w-5 text-primary" />
                <CardTitle>Hermes agent org chart</CardTitle>
              </div>
              <CardDescription>
                Visual operating model for this Hermes setup. Backed by a YAML registry and refreshed from the dashboard backend at runtime.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">Lead-directed</Badge>
              <Badge tone="secondary">GPT-5.4 roles</Badge>
              <Badge tone="warning">Verification gated</Badge>
              <Badge tone="outline">Live auto-refresh · 5s</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.25fr_0.95fr]">
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              The Lead is the only role that speaks to the user. All other roles are execution, validation, or specialist lanes that report upward into the final completion gate.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {workflowSteps.map((step, index) => (
                <div key={step} className="border border-border/70 bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
                  <span className="mr-2 text-primary">0{index + 1}</span>
                  {step}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {verificationLevels.map((level) => (
                <div key={level.id} className="border border-border/70 bg-background/50 p-3">
                  <div className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
                    <Bug className="h-3.5 w-3.5 text-primary" />
                    {level.id}
                  </div>
                  <div className="text-xs uppercase tracking-[0.12em] text-foreground/80">{level.label}</div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{level.detail}</p>
                </div>
              ))}
            </div>
            <div className="border border-border/70 bg-background/50 p-3 text-xs text-muted-foreground">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="uppercase tracking-[0.14em] text-foreground/80">Registry status</span>
                <button
                  type="button"
                  onClick={() => {
                    void refreshRegistry();
                  }}
                  disabled={loadingRegistry}
                  className="inline-flex items-center gap-1 border border-border/70 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-secondary/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCw className={`h-3 w-3 ${loadingRegistry ? "animate-spin" : ""}`} />
                  Reload registry
                </button>
              </div>
              <div>Roles: {registryMeta?.role_count ?? 1 + orgSections.reduce((sum, section) => sum + section.roles.length, 0)}</div>
              <div>Sections: {registryMeta?.section_count ?? orgSections.length}</div>
              <div>Registry updated: {formatTimestamp(registryMeta?.registry_updated_at)}</div>
              <div>Generated file updated: {formatTimestamp(registryMeta?.generated_updated_at)}</div>
              <div>Last checked: {lastCheckedAt ? new Date(lastCheckedAt).toLocaleTimeString() : "Checking…"}</div>
              {registryError && (
                <div className="mt-2 text-warning">Registry load failed: {registryError}</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {staleGenerated && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium text-foreground">Generated org data is stale</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                The YAML registry is newer than the generated TypeScript file. Run the org-chart generator or build pipeline so static fallback data stays aligned with the live registry.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center">
        <div className="w-full max-w-3xl border border-primary/30 bg-primary/8 p-4 shadow-[0_0_30px_color-mix(in_srgb,var(--color-primary)_10%,transparent)]">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-border/70 pb-3">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-base font-semibold text-foreground">{leadRole.title}</h2>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{leadRole.position}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">Reports to user</Badge>
              <Badge tone="secondary">{leadRole.model}</Badge>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{leadRole.mission}</p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {leadRole.responsibilities.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-[5px] h-1.5 w-1.5 shrink-0 bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3 border border-border/60 bg-background/50 p-3">
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-foreground/80">Lead lane</div>
                <div className="flex flex-wrap gap-1.5">
                  {leadRole.toolFocus.map((item) => (
                    <Badge key={item} tone="secondary" className="text-[10px]">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-foreground/80">Invoke for</div>
                <div className="flex flex-wrap gap-1.5">
                  {leadRole.invokeFor.map((item) => (
                    <Badge key={item} tone="secondary" className="text-[10px]">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="text-xs leading-relaxed text-muted-foreground">
                <span className="mr-2 uppercase tracking-[0.14em] text-foreground/80">Always active</span>
                {leadRole.activation}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="flex w-full max-w-5xl flex-col items-center">
          <div className="h-5 w-px bg-primary/70" />
          <div className="h-px w-[85%] bg-primary/40" />
          <div className="grid w-full gap-4 pt-4 lg:grid-cols-3">
            {orgSections.map((section) => (
              <div key={`connector-${section.id}`} className="flex flex-col items-center">
                <div className="h-5 w-px bg-primary/50" />
                <div className="rounded-full border border-primary/30 bg-background px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {section.title}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5">
        {orgSections.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            open={openSections[section.id] ?? true}
            onToggle={() =>
              setOpenSections((prev) => ({
                ...prev,
                [section.id]: !(prev[section.id] ?? true),
              }))
            }
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Approved role aliases & proposed capability additions</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          <div className="border border-border/70 bg-background/50 px-3 py-2 text-xs text-foreground">
            Canonical org-chart roles and approved aliases are the only allowed delegated role names.
            If the Lead thinks a new role or skill is needed, it should ask for that capability to be created and added intentionally instead of improvising a new role inline.
          </div>
          <div className="border border-border/70 bg-background/50 px-3 py-2 text-xs text-foreground">
            New capabilities should grow in a controlled way: if a missing role or skill would materially improve the work, the Lead should ask for it to be created and added to the workflow and org chart before using it.
          </div>
          {registryMeta?.data.role_aliases && Object.keys(registryMeta.data.role_aliases).length > 0 && (
            <div className="mt-2 border border-border/70 bg-background/50 p-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-foreground/80">
                Approved role aliases
              </div>
              <div className="grid gap-2">
                {Object.entries(registryMeta.data.role_aliases).map(([role, aliases]) => (
                  <div key={role} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{role}</span>
                    <span className="mx-2 text-border">→</span>
                    <span>{aliases.join(", ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {registryMeta?.proposed_capability_additions && registryMeta.proposed_capability_additions.length > 0 && (
            <div className="mt-2 border border-warning/50 bg-warning/5 p-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-foreground/80">
                Proposed capability additions
              </div>
              <div className="grid gap-2">
                {registryMeta.proposed_capability_additions.map((proposal) => (
                  <div key={`${proposal.session_id}:${proposal.role_name}`} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{proposal.role_name}</span>
                    <span className="mx-2 text-border">·</span>
                    <span>{proposal.session_title || proposal.session_id}</span>
                    <span className="mx-2 text-border">·</span>
                    <span>{proposal.source || "unknown"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
