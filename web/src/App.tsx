import { useMemo, type ComponentType, type ReactNode } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import StatusPage from "@/pages/StatusPage";
import ConfigPage from "@/pages/ConfigPage";
import EnvPage from "@/pages/EnvPage";
import SessionsPage from "@/pages/SessionsPage";
import LogsPage from "@/pages/LogsPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import ModelsPage from "@/pages/ModelsPage";
import CronPage from "@/pages/CronPage";
import ProfilesPage from "@/pages/ProfilesPage";
import SkillsPage from "@/pages/SkillsPage";
import OrgChartPage from "@/pages/OrgChartPage";
import PluginsPage from "@/pages/PluginsPage";
import DocsPage from "@/pages/DocsPage";
import ChatPage from "@/pages/ChatPage";
import { PluginPage, usePlugins } from "@/plugins";
import type { PluginManifest } from "@/plugins";
import { isDashboardEmbeddedChatEnabled } from "@/lib/dashboard-flags";
import {
  BUILTIN_NAV_REST,
  CHAT_NAV_ITEM,
  KinniDashboardShell,
  buildNavItems,
  type NavItem,
} from "@/components/layout/kinni-dashboard-shell";

const BUILTIN_ROUTES_CORE: Record<string, ComponentType> = {
  "/": StatusPage,
  "/sessions": SessionsPage,
  "/org-chart": OrgChartPage,
  "/analytics": AnalyticsPage,
  "/models": ModelsPage,
  "/logs": LogsPage,
  "/cron": CronPage,
  "/skills": SkillsPage,
  "/plugins": PluginsPage,
  "/profiles": ProfilesPage,
  "/config": ConfigPage,
  "/env": EnvPage,
  "/docs": DocsPage,
};

function ChatRouteSink() {
  return null;
}

function buildRoutes(
  builtinRoutes: Record<string, ComponentType>,
  manifests: PluginManifest[],
): Array<{
  key: string;
  path: string;
  element: ReactNode;
}> {
  const byOverride = new Map<string, PluginManifest>();
  const addons: PluginManifest[] = [];

  for (const manifest of manifests) {
    if (manifest.tab.override) {
      byOverride.set(manifest.tab.override, manifest);
    } else {
      addons.push(manifest);
    }
  }

  const routes: Array<{
    key: string;
    path: string;
    element: ReactNode;
  }> = [];

  for (const [path, Component] of Object.entries(builtinRoutes)) {
    const override = byOverride.get(path);
    if (override) {
      routes.push({
        key: `override:${override.name}`,
        path,
        element: <PluginPage name={override.name} />,
      });
    } else {
      routes.push({ key: `builtin:${path}`, path, element: <Component /> });
    }
  }

  for (const manifest of addons) {
    if (manifest.tab.hidden) continue;
    if (builtinRoutes[manifest.tab.path]) continue;
    routes.push({
      key: `plugin:${manifest.name}`,
      path: manifest.tab.path,
      element: <PluginPage name={manifest.name} />,
    });
  }

  for (const manifest of manifests) {
    if (!manifest.tab.hidden) continue;
    if (builtinRoutes[manifest.tab.path] || manifest.tab.override) continue;
    routes.push({
      key: `plugin:hidden:${manifest.name}`,
      path: manifest.tab.path,
      element: <PluginPage name={manifest.name} />,
    });
  }

  return routes;
}

export default function App() {
  const { pathname } = useLocation();
  const { manifests, loading: pluginsLoading } = usePlugins();
  const normalizedPath = pathname.replace(/\/$/, "") || "/";
  const isChatRoute = normalizedPath === "/chat";
  const embeddedChat = isDashboardEmbeddedChatEnabled();

  const chatOverriddenByPlugin = useMemo(
    () => manifests.some((manifest) => manifest.tab.override === "/chat"),
    [manifests],
  );

  const builtinRoutes = useMemo(
    () => ({
      ...BUILTIN_ROUTES_CORE,
      ...(embeddedChat ? { "/chat": ChatRouteSink } : {}),
    }),
    [embeddedChat],
  );

  const builtinNav: NavItem[] = useMemo(
    () =>
      embeddedChat ? [CHAT_NAV_ITEM, ...BUILTIN_NAV_REST] : BUILTIN_NAV_REST,
    [embeddedChat],
  );

  const navItems = useMemo(
    () => buildNavItems(builtinNav, manifests),
    [builtinNav, manifests],
  );

  const routes = useMemo(
    () => buildRoutes(builtinRoutes, manifests),
    [builtinRoutes, manifests],
  );

  return (
    <KinniDashboardShell navItems={navItems}>
      <Routes>
        <Route path="/" element={<StatusPage />} />
        {routes
          .filter(({ path }) => path !== "/")
          .map(({ key, path, element }) => (
            <Route key={key} path={path} element={element} />
          ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {embeddedChat &&
        !chatOverriddenByPlugin &&
        (pluginsLoading ? (
          isChatRoute ? (
            <div
              className="flex min-h-0 min-w-0 flex-1 items-center justify-center"
              aria-busy="true"
              aria-live="polite"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                <span>Loading chat…</span>
              </div>
            </div>
          ) : null
        ) : (
          <div
            data-chat-active={isChatRoute ? "true" : "false"}
            className={isChatRoute ? "flex min-h-0 min-w-0 flex-1 flex-col" : "hidden"}
            aria-hidden={!isChatRoute}
          >
            <ChatPage isActive={isChatRoute} />
          </div>
        ))}
    </KinniDashboardShell>
  );
}
