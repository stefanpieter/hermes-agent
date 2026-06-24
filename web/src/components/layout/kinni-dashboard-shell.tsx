import { type ComponentType, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  Activity,
  BarChart3,
  BookOpen,
  Clock,
  Code,
  Cpu,
  Database,
  Eye,
  FileText,
  Globe,
  Heart,
  KeyRound,
  LayoutTemplate,
  MessageSquare,
  Package,
  Puzzle,
  Settings,
  Shield,
  Sparkles,
  Star,
  Terminal,
  Users,
  Users2,
  Wrench,
  Zap,
} from "lucide-react";
import { PageHeaderContext } from "@/contexts/page-header-context";
import { useI18n } from "@/i18n";
import { PluginSlot } from "@/plugins";
import type { PluginManifest } from "@/plugins";

export interface NavItem {
  path: string;
  label: string;
  labelKey?: string;
  icon: ComponentType<{ className?: string }>;
}

export const CHAT_NAV_ITEM: NavItem = {
  path: "/chat",
  labelKey: "chat",
  label: "Chat",
  icon: Terminal,
};

export const BUILTIN_NAV_REST: NavItem[] = [
  { path: "/", labelKey: "status", label: "Status", icon: Activity },
  {
    path: "/sessions",
    labelKey: "sessions",
    label: "Sessions",
    icon: MessageSquare,
  },
  { path: "/org-chart", labelKey: "orgChart", label: "Org Chart", icon: Users2 },
  {
    path: "/analytics",
    labelKey: "analytics",
    label: "Analytics",
    icon: BarChart3,
  },
  {
    path: "/models",
    labelKey: "models",
    label: "Models",
    icon: Cpu,
  },
  { path: "/logs", labelKey: "logs", label: "Logs", icon: FileText },
  { path: "/cron", labelKey: "cron", label: "Cron", icon: Clock },
  { path: "/skills", labelKey: "skills", label: "Skills", icon: Package },
  { path: "/plugins", labelKey: "plugins", label: "Plugins", icon: Puzzle },
  { path: "/profiles", labelKey: "profiles", label: "Profiles", icon: Users },
  { path: "/config", labelKey: "config", label: "Config", icon: Settings },
  { path: "/env", labelKey: "keys", label: "Keys", icon: KeyRound },
  {
    path: "/docs",
    labelKey: "documentation",
    label: "Documentation",
    icon: BookOpen,
  },
];

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  Activity,
  BarChart3,
  Clock,
  Code,
  Cpu,
  Database,
  Eye,
  FileText,
  Globe,
  Heart,
  KeyRound,
  LayoutTemplate,
  MessageSquare,
  Package,
  Puzzle,
  Settings,
  Shield,
  Sparkles,
  Star,
  Terminal,
  Users,
  Users2,
  Wrench,
  Zap,
};

function resolveIcon(name: string): ComponentType<{ className?: string }> {
  return ICON_MAP[name] ?? Puzzle;
}

export function buildNavItems(
  builtIn: NavItem[],
  manifests: PluginManifest[],
): NavItem[] {
  const items = [...builtIn];

  for (const manifest of manifests) {
    if (manifest.tab.hidden) continue;
    if (manifest.tab.override) continue;

    const pluginItem: NavItem = {
      path: manifest.tab.path,
      label: manifest.label,
      icon: resolveIcon(manifest.icon),
    };

    const pos = manifest.tab.position ?? "end";
    if (pos === "end") {
      items.push(pluginItem);
    } else if (pos.startsWith("after:")) {
      const target = "/" + pos.slice(6);
      const idx = items.findIndex((i) => i.path === target);
      items.splice(idx >= 0 ? idx + 1 : items.length, 0, pluginItem);
    } else if (pos.startsWith("before:")) {
      const target = "/" + pos.slice(7);
      const idx = items.findIndex((i) => i.path === target);
      items.splice(idx >= 0 ? idx : items.length, 0, pluginItem);
    } else {
      items.push(pluginItem);
    }
  }

  return items;
}

const LEGACY_PAGE_HEADER_CONTEXT = {
  setAfterTitle: (_node: ReactNode) => {},
  setEnd: (_node: ReactNode) => {},
  setTitle: (_title: string | null) => {},
};

export function KinniDashboardShell({
  navItems,
  children,
}: {
  navItems: NavItem[];
  children: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <div className="noise-overlay" />
      <div className="warm-glow" />
      <PluginSlot name="backdrop" />

      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-[1400px] items-stretch">
          <div className="flex shrink-0 items-center border-r border-border px-3 sm:px-5">
            <img
              src="/kinni-logo.svg"
              alt="Kinni"
              className="h-6 w-auto shrink-0"
            />
          </div>

          <nav
            className="scrollbar-none flex min-w-0 flex-1 items-stretch overflow-x-auto"
            aria-label={t.app.navigation}
          >
            {navItems.map(({ path, label, labelKey, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                className={({ isActive }) =>
                  `group relative inline-flex shrink-0 cursor-pointer items-center gap-1 border-r border-border px-2.5 py-2 font-display text-[0.65rem] uppercase tracking-[0.12em] whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none sm:gap-1.5 sm:px-4 sm:text-[0.8rem] ${
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden sm:inline">
                      {labelKey
                        ? ((t.app.nav as Record<string, string>)[labelKey] ?? label)
                        : label}
                    </span>
                    <span className="pointer-events-none absolute inset-0 bg-primary opacity-0 transition-opacity duration-150 group-hover:opacity-8" />
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-px bg-primary" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <PluginSlot name="header-banner" />

      <main className="relative z-2 mx-auto w-full max-w-[1400px] flex-1 px-0 pt-16 pb-4 sm:pt-20 sm:pb-8">
        <PageHeaderContext.Provider value={LEGACY_PAGE_HEADER_CONTEXT}>
          <PluginSlot name="pre-main" />
          {children}
          <PluginSlot name="post-main" />
        </PageHeaderContext.Provider>
      </main>

      <PluginSlot name="overlay" />
    </div>
  );
}
