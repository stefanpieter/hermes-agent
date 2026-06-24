from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _read(relative_path: str) -> str:
    return (PROJECT_ROOT / relative_path).read_text(encoding="utf-8")


def test_dashboard_shell_tracks_upstream_sidebar_layout() -> None:
    """The local dashboard should look like upstream; Org Chart is supplied by a plugin tab."""
    app = _read("web/src/App.tsx")

    upstream_shell_markers = [
        "SelectionSwitcher",
        "PageHeaderProvider",
        "ProfileSwitcher",
        "SidebarFooter",
        "SidebarStatusStrip",
        "SidebarSystemActions",
        'data-layout-variant={layoutVariant}',
        '<PluginSlot name="header-left" />',
        "PluginPage",
    ]
    missing = [marker for marker in upstream_shell_markers if marker not in app]

    assert not missing, "Upstream dashboard shell marker(s) missing:\n" + "\n".join(missing)


def test_org_chart_is_not_hardcoded_into_builtin_dashboard_nav() -> None:
    """Avoid duplicate Org Chart entries when the external dashboard plugin is installed."""
    app = _read("web/src/App.tsx")

    forbidden_markers = [
        "KinniDashboardShell",
        "kinni-dashboard-shell",
        "kinni-logo.svg",
        "OrgChartPage",
        '"/org-chart"',
        "Org Chart",
    ]
    present = [marker for marker in forbidden_markers if marker in app]

    assert not present, "Dashboard App.tsx still hardcodes local chrome/org-chart route:\n" + "\n".join(present)


def test_legacy_tracked_kinni_shell_assets_are_removed() -> None:
    """Kinni chrome should live in the external plugin/theme overlay, not the tracked dashboard shell."""
    removed_paths = [
        "web/public/kinni-logo.svg",
        "web/src/components/layout/kinni-dashboard-shell.tsx",
    ]
    present = [path for path in removed_paths if (PROJECT_ROOT / path).exists()]

    assert not present, "Legacy tracked Kinni dashboard shell asset(s) still present:\n" + "\n".join(present)


def test_builtin_default_theme_is_upstream_hermes_teal() -> None:
    """The built-in default theme should not be renamed/repainted as Kinni Dark."""
    frontend_presets = _read("web/src/themes/presets.ts")
    backend_server = _read("hermes_cli/web_server.py")

    required = [
        'label: "Hermes Teal"',
        "Classic dark teal — the canonical Hermes look",
        '{"name": "default",       "label": "Hermes Teal"',
    ]
    missing = [marker for marker in required if marker not in frontend_presets + backend_server]
    forbidden = [
        'label: "Kinni Dark"',
        "Shared Kinni/Hermes dark brand palette",
        'logo: "/kinni-logo.svg"',
    ]
    present = [marker for marker in forbidden if marker in frontend_presets or marker in backend_server]

    assert not missing, "Default Hermes Teal theme marker(s) missing:\n" + "\n".join(missing)
    assert not present, "Built-in default theme still contains Kinni branding:\n" + "\n".join(present)


def test_org_chart_runtime_contract_remains_available() -> None:
    """Runtime role policies still have the registry/API contract even though the tab is plugin-owned."""
    markers = {
        ".hermes/plans/2026-04-22_164051-role-team-hybrid-runtime.md": [
            "Hermes role-team runtime overhaul",
            "persistent_role_instance",
            "role skill-policy",
        ],
        "web/src/data/hermesOrgChart.registry.yaml": [
            "persistent_role_instance",
            "skills:",
            "Lead / PM",
        ],
        "web/src/data/hermesOrgChart.generated.ts": [
            "OrgRole",
            "persistent_role_instance",
            "Lead / PM",
        ],
        "web/src/lib/api.ts": [
            "getOrgChart",
            "DashboardOrgChartResponse",
            "delegate_metrics",
        ],
        "hermes_cli/web_server.py": [
            '@app.get("/api/dashboard/org-chart")',
            "_load_dashboard_org_chart",
            "by_agent",
            "active_models",
            "delegate_metrics",
        ],
        "web/src/pages/AnalyticsPage.tsx": [
            "RoleExecutionEvidence",
            "api.getOrgChart()",
            "delegate_metrics",
        ],
    }

    missing: list[str] = []
    for relative_path, expected_markers in markers.items():
        path = PROJECT_ROOT / relative_path
        if not path.exists():
            missing.append(f"{relative_path}: file is missing")
            continue
        content = path.read_text(encoding="utf-8")
        for marker in expected_markers:
            if marker not in content:
                missing.append(f"{relative_path}: missing marker {marker!r}")

    assert not missing, "Org-chart runtime contract guard failed:\n" + "\n".join(missing)
