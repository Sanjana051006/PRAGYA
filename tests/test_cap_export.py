"""
Unit Tests for OASIS CAP v1.2 XML and NDMA SACHET Exporter.
"""

import pytest
import xml.etree.ElementTree as ET
from src.api.cap_exporter import CAPAlertExporter


def test_cap_xml_generation():
    exporter = CAPAlertExporter(sender_uri="imd_test@imd.gov.in")
    district_record = {
        "district_id": "idukki",
        "district_name": "Idukki",
        "state": "Kerala",
        "lgd_district_code": "560",
        "lgd_state_code": "32",
        "alert_level": "Orange",
        "regime": "Orographic",
        "corrected_rainfall_mm": 146.0,
        "quantile_p10_mm": 116.8,
        "quantile_p90_mm": 189.8,
        "action_statement": "Be Prepared: High risk of localized landslides in Ghats.",
    }

    xml_str = exporter.generate_cap_xml(district_record, cycle_time_str="2026-09-21T00:00:00Z")
    
    # Verify XML parses without error
    root = ET.fromstring(xml_str)
    
    # Strip namespace for tag assertions
    tags = [elem.tag.split("}")[-1] for elem in root.iter()]

    assert "alert" in tags
    assert "identifier" in tags
    assert "sender" in tags
    assert "sent" in tags
    assert "status" in tags
    assert "msgType" in tags
    assert "info" in tags
    assert "category" in tags
    assert "event" in tags
    assert "severity" in tags
    assert "urgency" in tags
    assert "certainty" in tags
    assert "area" in tags
    assert "geocode" in tags

    # Verify SACHET values
    info = root.find("{urn:oasis:names:tc:emergency:cap:1.2}info")
    assert info.find("{urn:oasis:names:tc:emergency:cap:1.2}category").text == "Met"
    assert info.find("{urn:oasis:names:tc:emergency:cap:1.2}severity").text == "Severe"


def test_sachet_json_generation():
    exporter = CAPAlertExporter()
    district_record = {
        "district_id": "balasore",
        "district_name": "Balasore",
        "state": "Odisha",
        "lgd_district_code": "344",
        "lgd_state_code": "21",
        "alert_level": "Red",
        "regime": "Low / Depression",
        "corrected_rainfall_mm": 211.0,
        "quantile_p10_mm": 173.0,
        "quantile_p90_mm": 278.5,
        "p_heavy": 0.99,
        "p_very_heavy": 0.92,
        "p_extremely_heavy": 0.83,
        "action_statement": "Take Action: Severe flooding expected.",
    }

    json_payload = exporter.generate_sachet_json(district_record, "2026-09-21T00:00:00Z")
    assert json_payload["warning"]["color_code"] == "Red"
    assert json_payload["target"]["lgd_district_code"] == "344"
    assert json_payload["warning"]["predicted_rainfall_p50_mm"] == 211.0
