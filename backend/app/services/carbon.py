from dataclasses import dataclass, field
from datetime import date

CARBON_FRACTION_OF_DRY_MATTER = 0.47
CO2E_PER_TONNE_CARBON = 44.0 / 12.0
ABOVE_GROUND_BIOMASS_T_DM_PER_HA = 180.0
ROOT_TO_SHOOT_RATIO = 0.37
ANNUAL_BIOMASS_GROWTH_T_DM_PER_HA = 7.0
PROJECTION_YEARS = 10

METHODOLOGY = "IPCC 2006 Guidelines Vol.4 Ch.4 (Tier 1 defaults, tropical moist forest)"


@dataclass
class CarbonResult:
    baseline_tco2e: float = 0.0
    annual_sequestration_tco2e: float = 0.0
    projection: list[tuple[date, float]] = field(default_factory=list)


def _biomass_to_tco2e(biomass_t_dm_per_ha: float, area_ha: float) -> float:
    total_biomass = biomass_t_dm_per_ha * (1.0 + ROOT_TO_SHOOT_RATIO)
    carbon_tonnes = total_biomass * CARBON_FRACTION_OF_DRY_MATTER * area_ha
    return carbon_tonnes * CO2E_PER_TONNE_CARBON


def estimate_carbon(area_ha: float) -> CarbonResult:
    if area_ha <= 0:
        return CarbonResult()

    baseline = _biomass_to_tco2e(ABOVE_GROUND_BIOMASS_T_DM_PER_HA, area_ha)
    annual = _biomass_to_tco2e(ANNUAL_BIOMASS_GROWTH_T_DM_PER_HA, area_ha)

    current_year = date.today().year
    projection = [
        (date(current_year + offset, 1, 1), round(baseline + annual * offset, 1))
        for offset in range(PROJECTION_YEARS + 1)
    ]

    return CarbonResult(
        baseline_tco2e=round(baseline, 1),
        annual_sequestration_tco2e=round(annual, 1),
        projection=projection,
    )
