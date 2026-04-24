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
    "web/src/App.tsx": ["kinni-logo.svg", "OrgChartPage", "org-chart"],
    "web/src/components/layout/page-band.tsx": ["PageBand", "page-band--bleed"],
    "web/src/index.css": ["Kinni", "page-band--bleed"],
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
