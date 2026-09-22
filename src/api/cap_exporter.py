"""
OASIS Common Alerting Protocol (CAP v1.2) and NDMA SACHET Alert Exporter.
Generates compliant ITU-T Recommendation X.1303 XML and JSON payloads
for automated integration into the NDMA Pan-India SACHET alert platform.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any
import xml.etree.ElementTree as ET
from xml.dom import minidom
from src.config import AlertLevel


class CAPAlertExporter:
    """
    Synthesizes CAP v1.2 XML and SACHET JSON payloads from post-processed district forecasts.
    """

    def __init__(self, sender_uri: str = "imd_nwp_postproc@imd.gov.in"):
        self.sender_uri = sender_uri
        self.cap_namespace = "urn:oasis:names:tc:emergency:cap:1.2"

    def generate_cap_xml(self, district_record: Dict[str, Any], cycle_time_str: str) -> str:
        """
        Generates an OASIS CAP v1.2 XML document for a single alerted district.
        """
        alert_level = district_record.get("alert_level", "Green")
        district_name = district_record.get("district_name", "District")
        state_name = district_record.get("state", "State")
        p50 = district_record.get("corrected_rainfall_mm", 0.0)
        p90 = district_record.get("quantile_p90_mm", 0.0)
        p10 = district_record.get("quantile_p10_mm", 0.0)
        regime = district_record.get("regime", "Active")
        lgd_dist = district_record.get("lgd_district_code", "000")
        lgd_state = district_record.get("lgd_state_code", "00")

        now = datetime.now(timezone.utc)
        sent_iso = now.strftime("%Y-%m-%dT%H:%M:%S+05:30")
        expires_iso = (now + timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%S+05:30")
        identifier = f"IMD-SACHET-{lgd_state}-{lgd_dist}-{now.strftime('%Y%m%d%H%M%S')}-001"

        # Severity mapping
        if alert_level == AlertLevel.RED.value:
            severity = "Extreme"
            urgency = "Immediate"
            certainty = "Likely"
            headline = f"RED ALERT: Extremely Heavy Rainfall expected over {district_name} District during next 24h."
        elif alert_level == AlertLevel.ORANGE.value:
            severity = "Severe"
            urgency = "Expected"
            certainty = "Likely"
            headline = f"ORANGE ALERT: Very Heavy Rainfall expected over {district_name} District during next 24h."
        elif alert_level == AlertLevel.YELLOW.value:
            severity = "Moderate"
            urgency = "Expected"
            certainty = "Possible"
            headline = f"YELLOW ALERT: Heavy Rainfall expected over {district_name} District during next 24h."
        else:
            severity = "Minor"
            urgency = "Future"
            certainty = "Possible"
            headline = f"GREEN: Normal weather over {district_name} District."

        # Build XML
        root = ET.Element("alert", xmlns=self.cap_namespace)
        ET.SubElement(root, "identifier").text = identifier
        ET.SubElement(root, "sender").text = self.sender_uri
        ET.SubElement(root, "sent").text = sent_iso
        ET.SubElement(root, "status").text = "Actual"
        ET.SubElement(root, "msgType").text = "Alert"
        ET.SubElement(root, "scope").text = "Public"

        # Info container
        info = ET.SubElement(root, "info")
        ET.SubElement(info, "language").text = "en-IN"
        ET.SubElement(info, "category").text = "Met"
        ET.SubElement(info, "event").text = "Heavy Rainfall Warning"
        ET.SubElement(info, "urgency").text = urgency
        ET.SubElement(info, "severity").text = severity
        ET.SubElement(info, "certainty").text = certainty

        event_code = ET.SubElement(info, "eventCode")
        ET.SubElement(event_code, "valueName").text = "NDMA_EVENT_CODE"
        ET.SubElement(event_code, "value").text = "NDMA-MET-HR-002"

        ET.SubElement(info, "expires").text = expires_iso
        ET.SubElement(info, "headline").text = headline
        ET.SubElement(info, "description").text = (
            f"Regime-Aware AI Post-Processing Model forecasts 24h accumulated rainfall of {p50} mm "
            f"(80% credible band: {p10} to {p90} mm) over {district_name} District ({state_name}). "
            f"Governing weather regime: {regime}."
        )
        ET.SubElement(info, "instruction").text = district_record.get("action_statement", "Follow local advisories.")

        # Parameters
        param_color = ET.SubElement(info, "parameter")
        ET.SubElement(param_color, "valueName").text = "ColorCode"
        ET.SubElement(param_color, "value").text = alert_level.upper()

        param_p90 = ET.SubElement(info, "parameter")
        ET.SubElement(param_p90, "valueName").text = "RainfallQuantile_p90"
        ET.SubElement(param_p90, "value").text = str(p90)

        # Area container
        area = ET.SubElement(info, "area")
        ET.SubElement(area, "areaDesc").text = f"{district_name} District, {state_name}"
        
        geocode_state = ET.SubElement(area, "geocode")
        ET.SubElement(geocode_state, "valueName").text = "LGD_STATE_CODE"
        ET.SubElement(geocode_state, "value").text = str(lgd_state)

        geocode_dist = ET.SubElement(area, "geocode")
        ET.SubElement(geocode_dist, "valueName").text = "LGD_DISTRICT_CODE"
        ET.SubElement(geocode_dist, "value").text = str(lgd_dist)

        # Pretty-print XML
        rough_string = ET.tostring(root, "utf-8")
        reparsed = minidom.parseString(rough_string)
        return reparsed.toprettyxml(indent="  ")

    def generate_sachet_json(self, district_record: Dict[str, Any], cycle_time_str: str) -> Dict[str, Any]:
        """
        Generates an NDMA SACHET JSON mirror payload.
        """
        now = datetime.now(timezone.utc)
        return {
            "sachet_alert_id": f"SACHET-{district_record.get('lgd_district_code', '000')}-{now.strftime('%Y%m%d%H%M')}",
            "originator": "IMD_NATIONAL_WEATHER_ANALYTICS_PROGRAMME",
            "timestamp_utc": now.isoformat(),
            "valid_until_utc": (now + timedelta(hours=24)).isoformat(),
            "target": {
                "district": district_record.get("district_name"),
                "state": district_record.get("state"),
                "lgd_district_code": district_record.get("lgd_district_code"),
                "lgd_state_code": district_record.get("lgd_state_code"),
            },
            "warning": {
                "color_code": district_record.get("alert_level"),
                "regime": district_record.get("regime"),
                "predicted_rainfall_p50_mm": district_record.get("corrected_rainfall_mm"),
                "credible_interval_mm": [
                    district_record.get("quantile_p10_mm"),
                    district_record.get("quantile_p90_mm"),
                ],
                "probability_heavy": district_record.get("p_heavy"),
                "probability_very_heavy": district_record.get("p_very_heavy"),
                "probability_extremely_heavy": district_record.get("p_extremely_heavy"),
            },
            "public_instruction": district_record.get("action_statement"),
        }
