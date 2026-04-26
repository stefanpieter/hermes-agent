import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { StatusResponse } from "@/lib/api";
import { timeAgo, isoTimeAgo } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageBand } from "@/components/layout/page-band";


interface CodexQuotaBucket {
  remaining_percent?: number | null;
  resets_at?: number | null;
  used_percent?: number | null;
}

interface CodexQuotaModel {
  model: string;
  observed_at?: string | null;
  plan_type?: string | null;
  primary?: CodexQuotaBucket | null;
  secondary?: CodexQuotaBucket | null;
}

interface CodexQuotaStatus {
  fresh_within_seconds?: number | null;
  latest_observed_at?: string | null;
  models?: CodexQuotaModel[];
}

type StatusWithQuota = StatusResponse & { codex_quota?: CodexQuotaStatus | null };

function formatResetTime(epochSeconds: number | null | undefined): string {
  if (!epochSeconds) return "Reset unknown";
  return `Resets ${timeAgo(epochSeconds)}`;
}

function quotaBadgeVariant(remaining: number): "success" | "warning" | "destructive" {
  if (remaining <= 10) return "destructive";
  if (remaining <= 35) return "warning";
  return "success";
}

function modelSort(a: CodexQuotaModel, b: CodexQuotaModel): number {
  const aRemain = Math.min(a.primary?.remaining_percent ?? 100, a.secondary?.remaining_percent ?? 100);
  const bRemain = Math.min(b.primary?.remaining_percent ?? 100, b.secondary?.remaining_percent ?? 100);
  if (aRemain !== bRemain) return aRemain - bRemain;
  return a.model.localeCompare(b.model);
}

function QuotaMeter({ label, bucket }: { label: string; bucket: CodexQuotaModel["primary"] }) {
  if (!bucket) {
    return (
      <div className="grid gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <Badge variant="outline" className="text-[10px]">Unknown</Badge>
        </div>
      </div>
    );
  }

  const remaining = Math.max(0, Math.min(100, bucket.remaining_percent ?? 0));
  const used = Math.max(0, Math.min(100, bucket.used_percent ?? 0));
  const variant = quotaBadgeVariant(remaining);
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Badge variant={variant} className="text-[10px]">{remaining.toFixed(0)}% remaining</Badge>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={`h-full rounded-full ${variant === "destructive" ? "bg-destructive" : variant === "warning" ? "bg-warning" : "bg-emerald-500"}`}
          style={{ width: `${remaining}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{used.toFixed(0)}% used</span>
        <span>{formatResetTime(bucket.resets_at)}</span>
      </div>
    </div>
  );
}

export default function QuotaPage() {
  const [status, setStatus] = useState<StatusWithQuota | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await api.getStatus();
      setStatus(next as StatusWithQuota);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void load();
    }, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const models = useMemo(
    () => [...(status?.codex_quota?.models ?? [])].sort(modelSort),
    [status],
  );

  if (!status) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <PageBand tone="muted" innerClassName="px-3 sm:px-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">GPT subscription quota</CardTitle>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Observed from local Codex session telemetry. Primary = 5h window, Secondary = weekly window.
                  {status.codex_quota?.latest_observed_at ? ` Latest observed ${isoTimeAgo(status.codex_quota.latest_observed_at)}.` : ""}
                  {status.codex_quota?.fresh_within_seconds ? ` Freshness requirement: within ${Math.round(status.codex_quota.fresh_within_seconds / 3600)} hour.` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                disabled={refreshing}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {models.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No fresh Codex quota telemetry observed in the last hour.
              </div>
            ) : (
              models.map((entry) => (
                <div key={entry.model} className="border border-border bg-background/35 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-ui text-sm font-medium">{entry.model}</span>
                    {entry.plan_type && (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                        {entry.plan_type}
                      </Badge>
                    )}
                    {entry.observed_at && (
                      <span className="text-[11px] text-muted-foreground">Observed {isoTimeAgo(entry.observed_at)}</span>
                    )}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <QuotaMeter label="Primary (5h)" bucket={entry.primary} />
                    <QuotaMeter label="Secondary (weekly)" bucket={entry.secondary} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </PageBand>
    </div>
  );
}
