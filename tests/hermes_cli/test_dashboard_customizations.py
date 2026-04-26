from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


DASHBOARD_CUSTOMIZATION_MARKERS = {
    ".hermes/plans/2026-04-22_164051-role-team-hybrid-runtime.md": [
        "Hermes role-team runtime overhaul",
        "persistent_role_instance",
        "role skill-policy",
    ],
    "tests/hermes_cli/test_dashboard_customizations.py": [
        "DASHBOARD_CUSTOMIZATION_MARKERS",
        "Kinni dashboard customization guard",
    ],
    "web/public/kinni-logo.svg": ["id=\"kinni\""],
    "web/src/App.tsx": [
        "kinni-logo.svg",
        "StatusPage",
        '<Route path="/" element={<StatusPage />} />',
        'label: "Status"',
        'end={path === "/"}',
        'className="fixed top-0 left-0 right-0 z-40',
        'max-w-[1400px]',
        "noise-overlay",
        "warm-glow",
        "OrgChartPage",
        "org-chart",
    ],
    "web/src/pages/StatusPage.tsx": ["StatusPage", "PageBand", "restartGateway", "updateHermes"],
    "web/src/pages/AnalyticsPage.tsx": [
        "ActiveModelsSection",
        "RoleExecutionEvidence",
        "AgentAnalyticsTable",
        "api.getOrgChart()",
        "data.active_models",
        "data.delegate_metrics",
        "data?.by_agent",
    ],
    "web/src/pages/OrgChartPage.tsx": [
        "Hermes agent org chart",
        "Live auto-refresh · 5s",
        "Registry status",
        "Reports upward into Lead / PM",
        "Approved role aliases & proposed capability additions",
        "api.getOrgChart()",
    ],
    "web/src/lib/api.ts": [
        "getOrgChart",
        "DashboardOrgChartResponse",
        "AnalyticsActiveModelEntry",
        "AnalyticsAgentEntry",
        "delegate_metrics",
    ],
    "hermes_cli/web_server.py": [
        '@app.get("/api/dashboard/org-chart")',
        "_load_dashboard_org_chart",
        "by_agent",
        "active_models",
        "delegate_metrics",
        "codex_quota",
    ],
    "web/src/lib/resolve-page-title.ts": ['return t.app.nav.status'],
    "web/src/components/layout/page-band.tsx": ["PageBand", "page-band--bleed"],
    "web/src/index.css": ["Kinni", "page-band--bleed", ".noise-overlay", "#212121", "#FA4E4A"],
    "web/src/themes/presets.ts": ["Kinni Dark", "Kinni/Hermes"],
    "web/src/pages/QuotaPage.tsx": ["QuotaPage", "PageBand"],
    "web/src/data/hermesOrgChart.registry.yaml": ["persistent_role_instance", "skills:", "Lead / PM"],
    "web/src/data/hermesOrgChart.generated.ts": ["OrgRole", "persistent_role_instance", "Lead / PM"],
}


def test_kinni_dashboard_customizations_are_present() -> None:
    """Guard the local dashboard overlay from being lost during Hermes updates/rebases."""
    missing: list[str] = []

    for relative_path, markers in DASHBOARD_CUSTOMIZATION_MARKERS.items():
        path = PROJECT_ROOT / relative_path
        if not path.exists():
            missing.append(f"{relative_path}: file is missing")
            continue

        content = path.read_text(encoding="utf-8")
        for marker in markers:
            if marker not in content:
                missing.append(f"{relative_path}: missing marker {marker!r}")

    assert not missing, "Kinni dashboard customization guard failed:\n" + "\n".join(missing)


def test_kinni_dashboard_does_not_use_upstream_sidebar_shell() -> None:
    """The local Kinni dashboard should keep its pre-update top-tab shell, not upstream's sidebar chrome."""
    app = (PROJECT_ROOT / "web/src/App.tsx").read_text(encoding="utf-8")

    upstream_sidebar_markers = [
        "SelectionSwitcher",
        "PageHeaderProvider",
        "SidebarFooter",
        "SidebarStatusStrip",
        "SidebarSystemActions",
        "data-layout-variant",
    ]
    present = [marker for marker in upstream_sidebar_markers if marker in app]

    assert not present, "Upstream sidebar dashboard shell leaked into Kinni dashboard:\n" + "\n".join(present)
