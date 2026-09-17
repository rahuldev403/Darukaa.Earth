from datetime import date

import pytest
from pydantic import ValidationError

from app.schemas import PolygonGeometry, UserCreate
from app.security import hash_password, verify_password
from app.services.carbon import CO2E_PER_TONNE_CARBON, estimate_carbon
from app.services.gbif import geometry_to_wkt
from app.services.nasa_power import _parse_monthly

VALID_RING = [[77.5, 12.9], [77.6, 12.9], [77.6, 13.0], [77.5, 13.0], [77.5, 12.9]]


class TestPolygonValidation:
    def test_accepts_a_closed_ring(self):
        polygon = PolygonGeometry(type="Polygon", coordinates=[VALID_RING])
        assert len(polygon.coordinates[0]) == 5

    def test_rejects_unclosed_ring(self):
        with pytest.raises(ValidationError, match="closed"):
            PolygonGeometry(type="Polygon", coordinates=[VALID_RING[:-1]])

    def test_rejects_too_few_positions(self):
        with pytest.raises(ValidationError, match="at least 4"):
            PolygonGeometry(
                type="Polygon", coordinates=[[[77.5, 12.9], [77.6, 12.9], [77.5, 12.9]]]
            )

    def test_rejects_out_of_range_longitude(self):
        bad = [[200.0, 12.9], [77.6, 12.9], [77.6, 13.0], [200.0, 12.9]]
        with pytest.raises(ValidationError, match="Longitude"):
            PolygonGeometry(type="Polygon", coordinates=[bad])

    def test_rejects_out_of_range_latitude(self):
        bad = [[77.5, 95.0], [77.6, 12.9], [77.6, 13.0], [77.5, 95.0]]
        with pytest.raises(ValidationError, match="Latitude"):
            PolygonGeometry(type="Polygon", coordinates=[bad])

    def test_rejects_non_polygon_type(self):
        with pytest.raises(ValidationError):
            PolygonGeometry(type="Point", coordinates=[VALID_RING])


class TestPasswordHashing:
    def test_hash_verify_roundtrip(self):
        hashed = hash_password("correct-horse-battery")
        assert verify_password("correct-horse-battery", hashed)

    def test_wrong_password_fails(self):
        assert not verify_password("wrong", hash_password("right-password"))

    def test_hash_is_not_the_plaintext(self):
        assert hash_password("plaintext123") != "plaintext123"

    def test_same_password_hashes_differently(self):
        assert hash_password("same-password") != hash_password("same-password")

    def test_registration_rejects_short_password(self):
        with pytest.raises(ValidationError):
            UserCreate(email="a@darukaa.earth", password="short")


class TestCarbonEstimate:
    def test_zero_area_yields_zero(self):
        result = estimate_carbon(0)
        assert result.baseline_tco2e == 0.0
        assert result.projection == []

    def test_scales_linearly_with_area(self):
        hundred = estimate_carbon(100).baseline_tco2e
        thousand = estimate_carbon(1000).baseline_tco2e
        assert thousand == pytest.approx(hundred * 10, rel=1e-4)

    def test_projection_increases_over_time(self):
        values = [value for _, value in estimate_carbon(100).projection]
        assert values == sorted(values)
        assert values[-1] > values[0]

    def test_co2e_ratio_is_stoichiometric(self):
        assert pytest.approx(44.0 / 12.0) == CO2E_PER_TONNE_CARBON


class TestNasaPowerParsing:
    def test_excludes_annual_mean_month_13(self):
        points = _parse_monthly({"202201": 20.0, "202212": 21.0, "202213": 99.9})
        assert [d.month for d, _ in points] == [1, 12]
        assert 99.9 not in [v for _, v in points]

    def test_excludes_fill_values(self):
        points = _parse_monthly({"202201": -999.0, "202202": 22.5})
        assert points == [(date(2022, 2, 1), 22.5)]

    def test_returns_chronological_order(self):
        points = _parse_monthly({"202303": 3.0, "202301": 1.0, "202302": 2.0})
        assert [v for _, v in points] == [1.0, 2.0, 3.0]

    def test_handles_empty_payload(self):
        assert _parse_monthly({}) == []
        assert _parse_monthly(None) == []


class TestGeometryConversion:
    def test_produces_wkt_polygon(self):
        wkt = geometry_to_wkt({"type": "Polygon", "coordinates": [VALID_RING]})
        assert wkt.startswith("POLYGON")

    def test_repairs_self_intersecting_polygon(self):
        bowtie = [[0.0, 0.0], [1.0, 1.0], [1.0, 0.0], [0.0, 1.0], [0.0, 0.0]]
        assert geometry_to_wkt({"type": "Polygon", "coordinates": [bowtie]})
