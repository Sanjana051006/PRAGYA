/**
 * PRAGYA — Operational Duty-Desk Dashboard JavaScript
 * Post-processing Rainfall with AI for Greater Yield Accuracy
 * Handles real-time API communication, dynamic scenario evaluations,
 * lead time uncertainty scaling, period aggregations, D3 GIS maps,
 * Chart.js comparisons, and human-in-the-loop active learning overrides.
 */

// =============================================================================
// GLOBAL STATE
// =============================================================================
let ACTIVE_SCENARIO_ID = "kerala_2018_orographic";
let ACTIVE_LEAD_TIME = "T+24";     // "T+24" | "T+48" | "T+72"
let ACTIVE_PERIOD = "daily";        // "daily" | "weekly" | "cumulative"
let CURRENT_CYCLE_DATA = null;
let SELECTED_DISTRICT = null;
let SELECTED_STATE_FILTER = null;

let _barChart = null;
let _rmseChart = null;
let _d3MapSvg = null;
let _d3GeoData = null;

// Regime to CSS class mapping
const REGIME_CLASS_MAP = {
  "Active": "active",
  "Break": "brk",
  "Low / Depression": "dep",
  "Orographic": "oro",
  "Coastal-Convective": "coa",
  "Western Disturbance": "active",
};

// Alert Level to CSS class mapping
const ALERT_CLASS_MAP = {
  "Green": "g",
  "Yellow": "y",
  "Orange": "o",
  "Red": "r",
};

// =============================================================================
// SCENARIO REPOSITORY (Realistic, Documented Monsoon Regimes)
// =============================================================================
const SCENARIOS = {
  kerala_2018_orographic: {
    scenario_id: "kerala_2018_orographic",
    title: "Active Surge (Western Ghats Orographic Extreme)",
    date: "15–17 August 2018",
    banner: {
      level: "Orange",
      text: "Active Surge: Findlater jet >38 kt impinging perpendicular to Western Ghats; 4 districts >70% very heavy rain probability."
    },
    synoptic_evaluation: {
      primary_synoptic: "Orographic",
      confidence: 0.88,
      entropy: 0.22,
      fallback_active: false,
    },
    regional_baselines: {
      west_coast:       96.0,
      peninsular_india: 54.0,
      central_india:    46.0,
      east_coast:       32.0,
      himalayan:        38.0,
      north_india:      18.0,
      northwest_india:  8.0,
      northeast_india:  48.0,
    },
    grid_raster: [
      ["Orographic", "Orographic", "Orographic", "Active", "Active", "Break", "Break", "Low / Depression", "Low / Depression", "Active", "Active", "Orographic"],
      ["Orographic", "Orographic", "Coastal-Convective", "Active", "Active", "Break", "Low / Depression", "Low / Depression", "Break", "Active", "Orographic", "Orographic"],
      ["Orographic", "Coastal-Convective", "Orographic", "Orographic", "Break", "Break", "Low / Depression", "Break", "Orographic", "Orographic", "Active", "Active"],
      ["Orographic", "Orographic", "Orographic", "Break", "Break", "Orographic", "Orographic", "Orographic", "Active", "Active", "Active", "Orographic"]
    ],
    districts: [
      // ===== KERALA (3) =====
      {
        district_id: "idukki",
        district_name: "Idukki",
        state: "Kerala",
        terrain_type: "high_ghats",
        regime: "Orographic",
        raw_rainfall_mm: 88.0,
        corrected_rainfall_mm: 146.0,
        quantile_p10_mm: 116.8,
        quantile_p90_mm: 189.8,
        p_heavy: 0.96,
        p_very_heavy: 0.78,
        p_extremely_heavy: 0.28,
        confidence: 0.88,
        alert_level: "Orange",
        action_statement: "Be Prepared: High risk of localized waterlogging and Ghats landslides."
      },
      {
        district_id: "wayanad",
        district_name: "Wayanad",
        state: "Kerala",
        terrain_type: "high_ghats",
        regime: "Orographic",
        raw_rainfall_mm: 94.0,
        corrected_rainfall_mm: 162.0,
        quantile_p10_mm: 128.0,
        quantile_p90_mm: 206.0,
        p_heavy: 0.98,
        p_very_heavy: 0.84,
        p_extremely_heavy: 0.36,
        confidence: 0.86,
        alert_level: "Red",
        action_statement: "Take Action: Unprecedented upslope pooling. Evacuate vulnerable slopes."
      },
      {
        district_id: "kozhikode",
        district_name: "Kozhikode",
        state: "Kerala",
        terrain_type: "coastal",
        regime: "Coastal-Convective",
        raw_rainfall_mm: 61.0,
        corrected_rainfall_mm: 102.0,
        quantile_p10_mm: 76.5,
        quantile_p90_mm: 130.6,
        p_heavy: 0.82,
        p_very_heavy: 0.58,
        p_extremely_heavy: 0.08,
        confidence: 0.81,
        alert_level: "Yellow",
        action_statement: "Be Updated: Monitor coastal drainage systems and river discharges."
      },
      {
        district_id: "udupi",
        district_name: "Udupi",
        state: "Karnataka",
        terrain_type: "coastal",
        regime: "Coastal-Convective",
        raw_rainfall_mm: 74.0,
        corrected_rainfall_mm: 118.0,
        quantile_p10_mm: 88.0,
        quantile_p90_mm: 152.0,
        p_heavy: 0.86,
        p_very_heavy: 0.65,
        p_extremely_heavy: 0.14,
        confidence: 0.84,
        alert_level: "Orange",
        action_statement: "Be Prepared: High swell and shoreline inundation near river mouths."
      },
      {
        district_id: "shimoga",
        district_name: "Shivamogga",
        state: "Karnataka",
        terrain_type: "high_ghats",
        regime: "Orographic",
        raw_rainfall_mm: 82.0,
        corrected_rainfall_mm: 132.0,
        quantile_p10_mm: 98.0,
        quantile_p90_mm: 168.0,
        p_heavy: 0.89,
        p_very_heavy: 0.70,
        p_extremely_heavy: 0.18,
        confidence: 0.82,
        alert_level: "Orange",
        action_statement: "Be Prepared: Sharavathi and Tunga reservoir inflow monitoring."
      },
      {
        district_id: "kolhapur",
        district_name: "Kolhapur",
        state: "Maharashtra",
        terrain_type: "leeward_plateau",
        regime: "Active",
        raw_rainfall_mm: 54.0,
        corrected_rainfall_mm: 76.0,
        quantile_p10_mm: 56.0,
        quantile_p90_mm: 98.0,
        p_heavy: 0.62,
        p_very_heavy: 0.28,
        p_extremely_heavy: 0.03,
        confidence: 0.83,
        alert_level: "Yellow",
        action_statement: "Be Updated: Panchganga river basin alert; discharge into Almatti monitored."
      },
      {
        district_id: "pune",
        district_name: "Pune",
        state: "Maharashtra",
        terrain_type: "leeward_plateau",
        regime: "Active",
        raw_rainfall_mm: 42.0,
        corrected_rainfall_mm: 52.0,
        quantile_p10_mm: 36.0,
        quantile_p90_mm: 68.0,
        p_heavy: 0.38,
        p_very_heavy: 0.12,
        p_extremely_heavy: 0.01,
        confidence: 0.86,
        alert_level: "Green",
        action_statement: "No Warning: Normal ghats runoff towards Khadakwasla complex."
      },
      {
        district_id: "balasore",
        district_name: "Balasore",
        state: "Odisha",
        terrain_type: "east_coast_cyclone_belt",
        regime: "Low / Depression",
        raw_rainfall_mm: 38.0,
        corrected_rainfall_mm: 32.0,
        quantile_p10_mm: 20.0,
        quantile_p90_mm: 44.0,
        p_heavy: 0.16,
        p_very_heavy: 0.04,
        p_extremely_heavy: 0.00,
        confidence: 0.89,
        alert_level: "Green",
        action_statement: "No Warning: Normal coastal conditions; primary monsoon action over West Coast."
      },
      {
        district_id: "hoshangabad",
        district_name: "Narmadapuram",
        state: "Madhya Pradesh",
        terrain_type: "central_river_basin",
        regime: "Active",
        raw_rainfall_mm: 48.0,
        corrected_rainfall_mm: 56.0,
        quantile_p10_mm: 40.0,
        quantile_p90_mm: 74.0,
        p_heavy: 0.45,
        p_very_heavy: 0.15,
        p_extremely_heavy: 0.01,
        confidence: 0.84,
        alert_level: "Yellow",
        action_statement: "Be Updated: Steady moderate rain feeding upper Narmada tributaries."
      },
      {
        district_id: "jaipur",
        district_name: "Jaipur",
        state: "Rajasthan",
        terrain_type: "semi_arid",
        regime: "Break",
        raw_rainfall_mm: 14.0,
        corrected_rainfall_mm: 8.0,
        quantile_p10_mm: 3.0,
        quantile_p90_mm: 15.0,
        p_heavy: 0.04,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.91,
        alert_level: "Green",
        action_statement: "No Warning: Dry westerly continental air mass dominant."
      },
      // ===== ADDITIONAL STATES =====
      {
        district_id: "kozhikode",
        district_name: "Kozhikode",
        state: "Kerala",
        terrain_type: "coastal",
        regime: "Coastal-Convective",
        raw_rainfall_mm: 61.0,
        corrected_rainfall_mm: 102.0,
        quantile_p10_mm: 76.5,
        quantile_p90_mm: 130.6,
        p_heavy: 0.82,
        p_very_heavy: 0.58,
        p_extremely_heavy: 0.08,
        confidence: 0.81,
        alert_level: "Yellow",
        action_statement: "Be Updated: Monitor coastal drainage systems and river discharges."
      },
      {
        district_id: "goa_north",
        district_name: "North Goa (Panaji)",
        state: "Goa",
        terrain_type: "coastal",
        regime: "Coastal-Convective",
        raw_rainfall_mm: 68.0,
        corrected_rainfall_mm: 112.0,
        quantile_p10_mm: 84.0,
        quantile_p90_mm: 148.0,
        p_heavy: 0.85,
        p_very_heavy: 0.62,
        p_extremely_heavy: 0.14,
        confidence: 0.83,
        alert_level: "Orange",
        action_statement: "Be Prepared: Mandovi and Zuari rivers swelling; coastal inundation risk."
      },
      {
        district_id: "goa_south",
        district_name: "South Goa (Margao)",
        state: "Goa",
        terrain_type: "coastal",
        regime: "Orographic",
        raw_rainfall_mm: 72.0,
        corrected_rainfall_mm: 118.0,
        quantile_p10_mm: 88.0,
        quantile_p90_mm: 152.0,
        p_heavy: 0.87,
        p_very_heavy: 0.66,
        p_extremely_heavy: 0.16,
        confidence: 0.84,
        alert_level: "Orange",
        action_statement: "Be Prepared: South Goa Ghats receiving intense orographic bursts."
      },
      {
        district_id: "nagpur",
        district_name: "Nagpur",
        state: "Maharashtra",
        terrain_type: "central_river_basin",
        regime: "Active",
        raw_rainfall_mm: 52.0,
        corrected_rainfall_mm: 68.0,
        quantile_p10_mm: 48.0,
        quantile_p90_mm: 90.0,
        p_heavy: 0.55,
        p_very_heavy: 0.22,
        p_extremely_heavy: 0.02,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Vidarbha receiving active surge spillover; Wardha river watch."
      },
      {
        district_id: "bengaluru",
        district_name: "Bengaluru",
        state: "Karnataka",
        terrain_type: "leeward_plateau",
        regime: "Active",
        raw_rainfall_mm: 38.0,
        corrected_rainfall_mm: 28.0,
        quantile_p10_mm: 16.0,
        quantile_p90_mm: 42.0,
        p_heavy: 0.18,
        p_very_heavy: 0.03,
        p_extremely_heavy: 0.00,
        confidence: 0.84,
        alert_level: "Green",
        action_statement: "No Warning: Deccan plateau receiving moderate active monsoon spells."
      },
      {
        district_id: "cuttack",
        district_name: "Cuttack",
        state: "Odisha",
        terrain_type: "east_coast_cyclone_belt",
        regime: "Break",
        raw_rainfall_mm: 30.0,
        corrected_rainfall_mm: 22.0,
        quantile_p10_mm: 12.0,
        quantile_p90_mm: 34.0,
        p_heavy: 0.10,
        p_very_heavy: 0.02,
        p_extremely_heavy: 0.00,
        confidence: 0.88,
        alert_level: "Green",
        action_statement: "No Warning: Mahanadi delta normal; east coast secondary to west coast surge."
      },
      {
        district_id: "raipur",
        district_name: "Raipur",
        state: "Chhattisgarh",
        terrain_type: "central_river_basin",
        regime: "Active",
        raw_rainfall_mm: 44.0,
        corrected_rainfall_mm: 52.0,
        quantile_p10_mm: 36.0,
        quantile_p90_mm: 70.0,
        p_heavy: 0.40,
        p_very_heavy: 0.12,
        p_extremely_heavy: 0.01,
        confidence: 0.83,
        alert_level: "Yellow",
        action_statement: "Be Updated: Chhattisgarh central zone receiving moderate active monsoon."
      },
      {
        district_id: "bilaspur_cg",
        district_name: "Bilaspur",
        state: "Chhattisgarh",
        terrain_type: "central_river_basin",
        regime: "Active",
        raw_rainfall_mm: 40.0,
        corrected_rainfall_mm: 46.0,
        quantile_p10_mm: 30.0,
        quantile_p90_mm: 62.0,
        p_heavy: 0.34,
        p_very_heavy: 0.10,
        p_extremely_heavy: 0.01,
        confidence: 0.82,
        alert_level: "Green",
        action_statement: "No Warning: Mahanadi upper basin receiving normal monsoon rainfall."
      },
      {
        district_id: "jabalpur",
        district_name: "Jabalpur",
        state: "Madhya Pradesh",
        terrain_type: "central_river_basin",
        regime: "Active",
        raw_rainfall_mm: 50.0,
        corrected_rainfall_mm: 60.0,
        quantile_p10_mm: 42.0,
        quantile_p90_mm: 78.0,
        p_heavy: 0.48,
        p_very_heavy: 0.16,
        p_extremely_heavy: 0.01,
        confidence: 0.83,
        alert_level: "Yellow",
        action_statement: "Be Updated: Narmada upper catchment steady rain; Bargi reservoir watch."
      },
      {
        district_id: "ahmedabad",
        district_name: "Ahmedabad",
        state: "Gujarat",
        terrain_type: "semi_arid",
        regime: "Break",
        raw_rainfall_mm: 18.0,
        corrected_rainfall_mm: 8.0,
        quantile_p10_mm: 2.0,
        quantile_p90_mm: 16.0,
        p_heavy: 0.04,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.89,
        alert_level: "Green",
        action_statement: "No Warning: Gujarat interior receiving minimal orographic spillover."
      },
      {
        district_id: "surat",
        district_name: "Surat",
        state: "Gujarat",
        terrain_type: "coastal",
        regime: "Active",
        raw_rainfall_mm: 42.0,
        corrected_rainfall_mm: 58.0,
        quantile_p10_mm: 38.0,
        quantile_p90_mm: 78.0,
        p_heavy: 0.46,
        p_very_heavy: 0.16,
        p_extremely_heavy: 0.01,
        confidence: 0.84,
        alert_level: "Yellow",
        action_statement: "Be Updated: South Gujarat coast receiving active surge rainfall; Tapti watch."
      },
      {
        district_id: "hyderabad",
        district_name: "Hyderabad",
        state: "Telangana",
        terrain_type: "leeward_plateau",
        regime: "Active",
        raw_rainfall_mm: 28.0,
        corrected_rainfall_mm: 16.0,
        quantile_p10_mm: 6.0,
        quantile_p90_mm: 28.0,
        p_heavy: 0.07,
        p_very_heavy: 0.01,
        p_extremely_heavy: 0.00,
        confidence: 0.84,
        alert_level: "Green",
        action_statement: "No Warning: Deccan interior; isolated convection under active surge periphery."
      },
      {
        district_id: "warangal",
        district_name: "Warangal",
        state: "Telangana",
        terrain_type: "leeward_plateau",
        regime: "Active",
        raw_rainfall_mm: 30.0,
        corrected_rainfall_mm: 18.0,
        quantile_p10_mm: 8.0,
        quantile_p90_mm: 30.0,
        p_heavy: 0.08,
        p_very_heavy: 0.01,
        p_extremely_heavy: 0.00,
        confidence: 0.83,
        alert_level: "Green",
        action_statement: "No Warning: Godavari upstream receiving normal active monsoon."
      },
      {
        district_id: "vijayawada",
        district_name: "Vijayawada (NTR Dist.)",
        state: "Andhra Pradesh",
        terrain_type: "east_coast_cyclone_belt",
        regime: "Active",
        raw_rainfall_mm: 34.0,
        corrected_rainfall_mm: 24.0,
        quantile_p10_mm: 12.0,
        quantile_p90_mm: 38.0,
        p_heavy: 0.12,
        p_very_heavy: 0.02,
        p_extremely_heavy: 0.00,
        confidence: 0.85,
        alert_level: "Green",
        action_statement: "No Warning: Krishna delta normal; primary action on west coast."
      },
      {
        district_id: "visakhapatnam",
        district_name: "Visakhapatnam",
        state: "Andhra Pradesh",
        terrain_type: "coastal",
        regime: "Active",
        raw_rainfall_mm: 36.0,
        corrected_rainfall_mm: 26.0,
        quantile_p10_mm: 14.0,
        quantile_p90_mm: 40.0,
        p_heavy: 0.14,
        p_very_heavy: 0.02,
        p_extremely_heavy: 0.00,
        confidence: 0.84,
        alert_level: "Green",
        action_statement: "No Warning: North AP coast moderate; bay system quiescent."
      },
      {
        district_id: "chennai",
        district_name: "Chennai",
        state: "Tamil Nadu",
        terrain_type: "coastal",
        regime: "Break",
        raw_rainfall_mm: 12.0,
        corrected_rainfall_mm: 5.0,
        quantile_p10_mm: 1.0,
        quantile_p90_mm: 10.0,
        p_heavy: 0.02,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.90,
        alert_level: "Green",
        action_statement: "No Warning: Tamil Nadu leeward—dry under west coast surge event."
      },
      {
        district_id: "coimbatore",
        district_name: "Coimbatore",
        state: "Tamil Nadu",
        terrain_type: "leeward_plateau",
        regime: "Break",
        raw_rainfall_mm: 10.0,
        corrected_rainfall_mm: 3.0,
        quantile_p10_mm: 0.5,
        quantile_p90_mm: 7.0,
        p_heavy: 0.01,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.91,
        alert_level: "Green",
        action_statement: "No Warning: Coimbatore rain shadow; isolated evening thunderstorms only."
      },
      {
        district_id: "kolkata",
        district_name: "Kolkata",
        state: "West Bengal",
        terrain_type: "east_coast_cyclone_belt",
        regime: "Active",
        raw_rainfall_mm: 36.0,
        corrected_rainfall_mm: 28.0,
        quantile_p10_mm: 16.0,
        quantile_p90_mm: 42.0,
        p_heavy: 0.14,
        p_very_heavy: 0.02,
        p_extremely_heavy: 0.00,
        confidence: 0.85,
        alert_level: "Green",
        action_statement: "No Warning: Hooghly drainage normal; primary moisture axis on west coast."
      },
      {
        district_id: "jalpaiguri",
        district_name: "Jalpaiguri",
        state: "West Bengal",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 58.0,
        corrected_rainfall_mm: 78.0,
        quantile_p10_mm: 56.0,
        quantile_p90_mm: 102.0,
        p_heavy: 0.65,
        p_very_heavy: 0.30,
        p_extremely_heavy: 0.04,
        confidence: 0.83,
        alert_level: "Yellow",
        action_statement: "Be Updated: Sub-Himalayan Teesta receiving moderate active surge spillover."
      },
      {
        district_id: "ranchi",
        district_name: "Ranchi",
        state: "Jharkhand",
        terrain_type: "central_river_basin",
        regime: "Active",
        raw_rainfall_mm: 42.0,
        corrected_rainfall_mm: 50.0,
        quantile_p10_mm: 34.0,
        quantile_p90_mm: 66.0,
        p_heavy: 0.38,
        p_very_heavy: 0.11,
        p_extremely_heavy: 0.01,
        confidence: 0.82,
        alert_level: "Green",
        action_statement: "No Warning: Chota Nagpur plateau receiving normal active monsoon."
      },
      {
        district_id: "jamshedpur",
        district_name: "Jamshedpur",
        state: "Jharkhand",
        terrain_type: "central_river_basin",
        regime: "Active",
        raw_rainfall_mm: 46.0,
        corrected_rainfall_mm: 56.0,
        quantile_p10_mm: 38.0,
        quantile_p90_mm: 74.0,
        p_heavy: 0.44,
        p_very_heavy: 0.14,
        p_extremely_heavy: 0.01,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Subarnarekha near bank-full; light industrial zone alert."
      },
      {
        district_id: "patna",
        district_name: "Patna",
        state: "Bihar",
        terrain_type: "river_valley",
        regime: "Active",
        raw_rainfall_mm: 40.0,
        corrected_rainfall_mm: 48.0,
        quantile_p10_mm: 30.0,
        quantile_p90_mm: 64.0,
        p_heavy: 0.36,
        p_very_heavy: 0.10,
        p_extremely_heavy: 0.01,
        confidence: 0.83,
        alert_level: "Green",
        action_statement: "No Warning: Ganga at Patna within normal flood level; routine monitoring."
      },
      {
        district_id: "muzaffarpur",
        district_name: "Muzaffarpur",
        state: "Bihar",
        terrain_type: "river_valley",
        regime: "Active",
        raw_rainfall_mm: 44.0,
        corrected_rainfall_mm: 54.0,
        quantile_p10_mm: 36.0,
        quantile_p90_mm: 72.0,
        p_heavy: 0.42,
        p_very_heavy: 0.13,
        p_extremely_heavy: 0.01,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Gandak river watch; light-moderate rain from Nepal catchment."
      },
      {
        district_id: "gorakhpur",
        district_name: "Gorakhpur",
        state: "Uttar Pradesh",
        terrain_type: "river_valley",
        regime: "Active",
        raw_rainfall_mm: 38.0,
        corrected_rainfall_mm: 44.0,
        quantile_p10_mm: 28.0,
        quantile_p90_mm: 60.0,
        p_heavy: 0.32,
        p_very_heavy: 0.08,
        p_extremely_heavy: 0.00,
        confidence: 0.82,
        alert_level: "Green",
        action_statement: "No Warning: Eastern UP receiving normal active monsoon; rivers normal."
      },
      {
        district_id: "lucknow",
        district_name: "Lucknow",
        state: "Uttar Pradesh",
        terrain_type: "river_valley",
        regime: "Active",
        raw_rainfall_mm: 34.0,
        corrected_rainfall_mm: 38.0,
        quantile_p10_mm: 24.0,
        quantile_p90_mm: 52.0,
        p_heavy: 0.26,
        p_very_heavy: 0.06,
        p_extremely_heavy: 0.00,
        confidence: 0.83,
        alert_level: "Green",
        action_statement: "No Warning: Gomti river normal; central UP dry under west coast dominance."
      },
      {
        district_id: "amritsar",
        district_name: "Amritsar",
        state: "Punjab",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 22.0,
        corrected_rainfall_mm: 10.0,
        quantile_p10_mm: 2.5,
        quantile_p90_mm: 18.0,
        p_heavy: 0.04,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.85,
        alert_level: "Green",
        action_statement: "No Warning: Punjab dry; primary monsoon moisture axis on west coast."
      },
      {
        district_id: "ludhiana",
        district_name: "Ludhiana",
        state: "Punjab",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 18.0,
        corrected_rainfall_mm: 8.0,
        quantile_p10_mm: 1.5,
        quantile_p90_mm: 14.0,
        p_heavy: 0.03,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.85,
        alert_level: "Green",
        action_statement: "No Warning: Central Punjab dry and clear under west coast event."
      },
      {
        district_id: "gurugram",
        district_name: "Gurugram",
        state: "Haryana",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 16.0,
        corrected_rainfall_mm: 6.0,
        quantile_p10_mm: 1.0,
        quantile_p90_mm: 12.0,
        p_heavy: 0.02,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.86,
        alert_level: "Green",
        action_statement: "No Warning: NCR region dry; no weather advisory needed."
      },
      {
        district_id: "rohtak",
        district_name: "Rohtak",
        state: "Haryana",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 14.0,
        corrected_rainfall_mm: 5.0,
        quantile_p10_mm: 0.8,
        quantile_p90_mm: 10.0,
        p_heavy: 0.02,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.86,
        alert_level: "Green",
        action_statement: "No Warning: Haryana dry spell; agricultural rainfall deficit growing."
      },
      {
        district_id: "shimla",
        district_name: "Shimla",
        state: "Himachal Pradesh",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 52.0,
        corrected_rainfall_mm: 72.0,
        quantile_p10_mm: 50.0,
        quantile_p90_mm: 96.0,
        p_heavy: 0.60,
        p_very_heavy: 0.28,
        p_extremely_heavy: 0.04,
        confidence: 0.84,
        alert_level: "Yellow",
        action_statement: "Be Updated: Shimla foothills receiving moderate mountain orographic rain."
      },
      {
        district_id: "kangra",
        district_name: "Dharamsala (Kangra)",
        state: "Himachal Pradesh",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 58.0,
        corrected_rainfall_mm: 82.0,
        quantile_p10_mm: 58.0,
        quantile_p90_mm: 108.0,
        p_heavy: 0.66,
        p_very_heavy: 0.32,
        p_extremely_heavy: 0.05,
        confidence: 0.83,
        alert_level: "Yellow",
        action_statement: "Be Updated: Beas valley receiving heavy showers; Pong dam inflow rising."
      },
      {
        district_id: "dehradun",
        district_name: "Dehradun",
        state: "Uttarakhand",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 56.0,
        corrected_rainfall_mm: 78.0,
        quantile_p10_mm: 54.0,
        quantile_p90_mm: 104.0,
        p_heavy: 0.64,
        p_very_heavy: 0.30,
        p_extremely_heavy: 0.04,
        confidence: 0.84,
        alert_level: "Yellow",
        action_statement: "Be Updated: Garhwal receiving steady mountain rain; Tons river watch."
      },
      {
        district_id: "haridwar",
        district_name: "Haridwar",
        state: "Uttarakhand",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 50.0,
        corrected_rainfall_mm: 68.0,
        quantile_p10_mm: 46.0,
        quantile_p90_mm: 92.0,
        p_heavy: 0.58,
        p_very_heavy: 0.24,
        p_extremely_heavy: 0.03,
        confidence: 0.83,
        alert_level: "Yellow",
        action_statement: "Be Updated: Ganga at Haridwar monitoring level; moderate foothill rains."
      },
      {
        district_id: "gangtok",
        district_name: "Gangtok (East Sikkim)",
        state: "Sikkim",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 72.0,
        corrected_rainfall_mm: 108.0,
        quantile_p10_mm: 80.0,
        quantile_p90_mm: 140.0,
        p_heavy: 0.80,
        p_very_heavy: 0.52,
        p_extremely_heavy: 0.10,
        confidence: 0.84,
        alert_level: "Yellow",
        action_statement: "Be Updated: Teesta valley receiving heavy spells; upper catchment watch."
      },
      {
        district_id: "sikkim_west",
        district_name: "Gyalshing (West Sikkim)",
        state: "Sikkim",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 68.0,
        corrected_rainfall_mm: 98.0,
        quantile_p10_mm: 72.0,
        quantile_p90_mm: 128.0,
        p_heavy: 0.76,
        p_very_heavy: 0.46,
        p_extremely_heavy: 0.08,
        confidence: 0.83,
        alert_level: "Yellow",
        action_statement: "Be Updated: High mountain orographic precipitation; landslide hazard advisory."
      },
      {
        district_id: "itanagar",
        district_name: "Itanagar (Papum Pare)",
        state: "Arunachal Pradesh",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 64.0,
        corrected_rainfall_mm: 88.0,
        quantile_p10_mm: 62.0,
        quantile_p90_mm: 116.0,
        p_heavy: 0.70,
        p_very_heavy: 0.36,
        p_extremely_heavy: 0.06,
        confidence: 0.83,
        alert_level: "Yellow",
        action_statement: "Be Updated: Brahmaputra tributaries in flood watch; Subansiri monitoring."
      },
      {
        district_id: "tawang",
        district_name: "Tawang",
        state: "Arunachal Pradesh",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 58.0,
        corrected_rainfall_mm: 78.0,
        quantile_p10_mm: 54.0,
        quantile_p90_mm: 104.0,
        p_heavy: 0.65,
        p_very_heavy: 0.30,
        p_extremely_heavy: 0.04,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Western Arunachal highlands—high altitude precipitation continuing."
      },
      {
        district_id: "shillong",
        district_name: "Shillong (East Khasi Hills)",
        state: "Meghalaya",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 90.0,
        corrected_rainfall_mm: 146.0,
        quantile_p10_mm: 112.0,
        quantile_p90_mm: 188.0,
        p_heavy: 0.94,
        p_very_heavy: 0.80,
        p_extremely_heavy: 0.34,
        confidence: 0.86,
        alert_level: "Orange",
        action_statement: "Be Prepared: Cherrapunji zone: extreme orographic enhancement; flash flood risk."
      },
      {
        district_id: "tura",
        district_name: "Tura (West Garo Hills)",
        state: "Meghalaya",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 74.0,
        corrected_rainfall_mm: 118.0,
        quantile_p10_mm: 88.0,
        quantile_p90_mm: 152.0,
        p_heavy: 0.88,
        p_very_heavy: 0.66,
        p_extremely_heavy: 0.16,
        confidence: 0.84,
        alert_level: "Orange",
        action_statement: "Be Prepared: Garo Hills receiving heavy active monsoon; Brahmaputra watch."
      },
      {
        district_id: "kohima",
        district_name: "Kohima",
        state: "Nagaland",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 52.0,
        corrected_rainfall_mm: 64.0,
        quantile_p10_mm: 44.0,
        quantile_p90_mm: 86.0,
        p_heavy: 0.52,
        p_very_heavy: 0.20,
        p_extremely_heavy: 0.02,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Nagaland hills receiving moderate active monsoon rainfall."
      },
      {
        district_id: "dimapur",
        district_name: "Dimapur",
        state: "Nagaland",
        terrain_type: "river_valley",
        regime: "Active",
        raw_rainfall_mm: 56.0,
        corrected_rainfall_mm: 70.0,
        quantile_p10_mm: 48.0,
        quantile_p90_mm: 94.0,
        p_heavy: 0.58,
        p_very_heavy: 0.24,
        p_extremely_heavy: 0.03,
        confidence: 0.81,
        alert_level: "Yellow",
        action_statement: "Be Updated: Dhansiri valley receiving sustained active monsoon showers."
      },
      {
        district_id: "imphal_east",
        district_name: "Imphal East",
        state: "Manipur",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 46.0,
        corrected_rainfall_mm: 56.0,
        quantile_p10_mm: 38.0,
        quantile_p90_mm: 74.0,
        p_heavy: 0.44,
        p_very_heavy: 0.14,
        p_extremely_heavy: 0.01,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Manipur valley under moderate active surge; Loktak watch."
      },
      {
        district_id: "churachandpur",
        district_name: "Churachandpur",
        state: "Manipur",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 50.0,
        corrected_rainfall_mm: 62.0,
        quantile_p10_mm: 42.0,
        quantile_p90_mm: 82.0,
        p_heavy: 0.50,
        p_very_heavy: 0.18,
        p_extremely_heavy: 0.02,
        confidence: 0.81,
        alert_level: "Yellow",
        action_statement: "Be Updated: Barak headwaters receiving steady rainfall; hill slopes watch."
      },
      {
        district_id: "agartala",
        district_name: "Agartala (West Tripura)",
        state: "Tripura",
        terrain_type: "river_valley",
        regime: "Active",
        raw_rainfall_mm: 48.0,
        corrected_rainfall_mm: 58.0,
        quantile_p10_mm: 38.0,
        quantile_p90_mm: 78.0,
        p_heavy: 0.46,
        p_very_heavy: 0.15,
        p_extremely_heavy: 0.01,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Gumti river normal; active surge reaching Tripura valley."
      },
      {
        district_id: "dhalai",
        district_name: "Dhalai",
        state: "Tripura",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 52.0,
        corrected_rainfall_mm: 64.0,
        quantile_p10_mm: 44.0,
        quantile_p90_mm: 86.0,
        p_heavy: 0.52,
        p_very_heavy: 0.20,
        p_extremely_heavy: 0.02,
        confidence: 0.81,
        alert_level: "Yellow",
        action_statement: "Be Updated: Hill district rainfall elevated; Dhalai river monitoring."
      },
      {
        district_id: "aizawl",
        district_name: "Aizawl",
        state: "Mizoram",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 50.0,
        corrected_rainfall_mm: 62.0,
        quantile_p10_mm: 42.0,
        quantile_p90_mm: 82.0,
        p_heavy: 0.50,
        p_very_heavy: 0.18,
        p_extremely_heavy: 0.02,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Tlawng river basin active; landslide caution in steep zones."
      },
      {
        district_id: "lunglei",
        district_name: "Lunglei",
        state: "Mizoram",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 54.0,
        corrected_rainfall_mm: 68.0,
        quantile_p10_mm: 46.0,
        quantile_p90_mm: 90.0,
        p_heavy: 0.54,
        p_very_heavy: 0.22,
        p_extremely_heavy: 0.02,
        confidence: 0.81,
        alert_level: "Yellow",
        action_statement: "Be Updated: South Mizoram hill stations—active monsoon regime persisting."
      },
      {
        district_id: "srinagar",
        district_name: "Srinagar",
        state: "Jammu and Kashmir",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 14.0,
        corrected_rainfall_mm: 6.0,
        quantile_p10_mm: 1.0,
        quantile_p90_mm: 12.0,
        p_heavy: 0.02,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.87,
        alert_level: "Green",
        action_statement: "No Warning: Kashmir valley calm; Jhelum within normal limits."
      },
      {
        district_id: "jammu",
        district_name: "Jammu",
        state: "Jammu and Kashmir",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 20.0,
        corrected_rainfall_mm: 10.0,
        quantile_p10_mm: 2.5,
        quantile_p90_mm: 18.0,
        p_heavy: 0.04,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.86,
        alert_level: "Green",
        action_statement: "No Warning: Jammu Tawi river normal; sub-montane conditions dry."
      },
      {
        district_id: "leh",
        district_name: "Leh",
        state: "Ladakh",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 4.0,
        corrected_rainfall_mm: 2.0,
        quantile_p10_mm: 0.2,
        quantile_p90_mm: 4.0,
        p_heavy: 0.00,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.92,
        alert_level: "Green",
        action_statement: "No Warning: Trans-Himalayan desert; negligible precipitation."
      },
      {
        district_id: "kargil",
        district_name: "Kargil",
        state: "Ladakh",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 6.0,
        corrected_rainfall_mm: 3.0,
        quantile_p10_mm: 0.5,
        quantile_p90_mm: 6.0,
        p_heavy: 0.00,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.91,
        alert_level: "Green",
        action_statement: "No Warning: High altitude rain shadow; cloudburst risk negligible."
      },
      {
        district_id: "delhi_central",
        district_name: "Central Delhi",
        state: "Delhi",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 16.0,
        corrected_rainfall_mm: 6.0,
        quantile_p10_mm: 1.0,
        quantile_p90_mm: 12.0,
        p_heavy: 0.02,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.87,
        alert_level: "Green",
        action_statement: "No Warning: Delhi dry; Yamuna level stable at Palla gauge."
      },
      {
        district_id: "delhi_east",
        district_name: "East Delhi",
        state: "Delhi",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 18.0,
        corrected_rainfall_mm: 7.0,
        quantile_p10_mm: 1.5,
        quantile_p90_mm: 14.0,
        p_heavy: 0.03,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.86,
        alert_level: "Green",
        action_statement: "No Warning: Urban areas dry; no waterlogging risk."
      }
    ],
    rmse_scores: {
      "T+24": { raw: [12.1, 6.8, 18.7, 15.2, 12.7], corr: [5.1, 4.2, 5.5, 5.5, 5.0] },
      "T+48": { raw: [16.4, 9.5, 24.1, 20.6, 17.2], corr: [7.2, 5.8, 7.6, 7.8, 6.8] },
      "T+72": { raw: [22.8, 14.2, 31.4, 28.5, 24.0], corr: [9.6, 7.5, 10.4, 10.5, 9.1] }
    }
  },

  depression_2021_bay_of_bengal: {
    scenario_id: "depression_2021_bay_of_bengal",
    title: "Monsoon Depression (East Coast Landfall)",
    date: "12–14 September 2021",
    banner: {
      level: "Red",
      text: "Red Alert: Deep depression crossed Odisha coast near Chandbali; severe widespread cyclonic rainfall & inundation active."
    },
    synoptic_evaluation: {
      primary_synoptic: "Low / Depression",
      confidence: 0.94,
      entropy: 0.16,
      fallback_active: false,
    },
    regional_baselines: {
      east_coast:       138.0,
      central_india:    112.0,
      northeast_india:  65.0,
      peninsular_india: 42.0,
      north_india:      36.0,
      west_coast:       32.0,
      himalayan:        26.0,
      northwest_india:  14.0,
    },
    grid_raster: [
      ["Low / Depression", "Low / Depression", "Low / Depression", "Low / Depression", "Active", "Active", "Low / Depression", "Low / Depression", "Low / Depression", "Low / Depression", "Low / Depression", "Active"],
      ["Low / Depression", "Low / Depression", "Low / Depression", "Active", "Active", "Active", "Low / Depression", "Low / Depression", "Low / Depression", "Low / Depression", "Active", "Active"],
      ["Active", "Active", "Active", "Active", "Break", "Low / Depression", "Low / Depression", "Low / Depression", "Low / Depression", "Active", "Active", "Active"],
      ["Active", "Active", "Coastal-Convective", "Break", "Break", "Active", "Low / Depression", "Low / Depression", "Active", "Active", "Active", "Orographic"]
    ],
    districts: [
      // ===== ODISHA (2) =====
      {
        district_id: "balasore",
        district_name: "Balasore",
        state: "Odisha",
        terrain_type: "east_coast_cyclone_belt",
        regime: "Low / Depression",
        raw_rainfall_mm: 140.0,
        corrected_rainfall_mm: 211.0,
        quantile_p10_mm: 173.0,
        quantile_p90_mm: 278.5,
        p_heavy: 0.99,
        p_very_heavy: 0.94,
        p_extremely_heavy: 0.76,
        confidence: 0.92,
        alert_level: "Red",
        action_statement: "Take Action: Torrential coastal surge. Evacuate low-lying river mouths."
      },
      {
        district_id: "bhubaneswar",
        district_name: "Khurda",
        state: "Odisha",
        terrain_type: "east_coast_cyclone_belt",
        regime: "Low / Depression",
        raw_rainfall_mm: 118.0,
        corrected_rainfall_mm: 178.0,
        quantile_p10_mm: 142.0,
        quantile_p90_mm: 226.0,
        p_heavy: 0.97,
        p_very_heavy: 0.88,
        p_extremely_heavy: 0.48,
        confidence: 0.90,
        alert_level: "Red",
        action_statement: "Take Action: Severe urban waterlogging; Mahanadi delta surge alert."
      },
      {
        district_id: "midnapore",
        district_name: "Paschim Medinipur",
        state: "West Bengal",
        terrain_type: "east_coast_cyclone_belt",
        regime: "Low / Depression",
        raw_rainfall_mm: 105.0,
        corrected_rainfall_mm: 164.0,
        quantile_p10_mm: 130.0,
        quantile_p90_mm: 212.0,
        p_heavy: 0.96,
        p_very_heavy: 0.82,
        p_extremely_heavy: 0.38,
        confidence: 0.88,
        alert_level: "Red",
        action_statement: "Take Action: Kangsabati and Subarnarekha river flooding alert."
      },
      {
        district_id: "raipur",
        district_name: "Raipur",
        state: "Chhattisgarh",
        terrain_type: "central_river_basin",
        regime: "Low / Depression",
        raw_rainfall_mm: 92.0,
        corrected_rainfall_mm: 142.0,
        quantile_p10_mm: 114.0,
        quantile_p90_mm: 184.0,
        p_heavy: 0.93,
        p_very_heavy: 0.76,
        p_extremely_heavy: 0.25,
        confidence: 0.87,
        alert_level: "Orange",
        action_statement: "Be Prepared: Heavy depression rainband moving westward into Mahanadi basin."
      },
      {
        district_id: "jabalpur",
        district_name: "Jabalpur",
        state: "Madhya Pradesh",
        terrain_type: "central_river_basin",
        regime: "Low / Depression",
        raw_rainfall_mm: 84.0,
        corrected_rainfall_mm: 128.0,
        quantile_p10_mm: 98.0,
        quantile_p90_mm: 164.0,
        p_heavy: 0.88,
        p_very_heavy: 0.68,
        p_extremely_heavy: 0.18,
        confidence: 0.85,
        alert_level: "Orange",
        action_statement: "Be Prepared: Narmada upper catchment receiving sustained spiral band rain."
      },
      {
        district_id: "hoshangabad",
        district_name: "Narmadapuram",
        state: "Madhya Pradesh",
        terrain_type: "central_river_basin",
        regime: "Low / Depression",
        raw_rainfall_mm: 76.0,
        corrected_rainfall_mm: 115.0,
        quantile_p10_mm: 88.0,
        quantile_p90_mm: 148.0,
        p_heavy: 0.82,
        p_very_heavy: 0.58,
        p_extremely_heavy: 0.12,
        confidence: 0.84,
        alert_level: "Orange",
        action_statement: "Be Prepared: Tawa dam gates likely to open; alert downstream low areas."
      },
      {
        district_id: "nagpur",
        district_name: "Nagpur",
        state: "Maharashtra",
        terrain_type: "central_river_basin",
        regime: "Low / Depression",
        raw_rainfall_mm: 68.0,
        corrected_rainfall_mm: 96.0,
        quantile_p10_mm: 72.0,
        quantile_p90_mm: 126.0,
        p_heavy: 0.74,
        p_very_heavy: 0.44,
        p_extremely_heavy: 0.06,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Nag river and urban stormwater drains under high discharge."
      },
      {
        district_id: "idukki",
        district_name: "Idukki",
        state: "Kerala",
        terrain_type: "high_ghats",
        regime: "Active",
        raw_rainfall_mm: 42.0,
        corrected_rainfall_mm: 36.0,
        quantile_p10_mm: 24.0,
        quantile_p90_mm: 50.0,
        p_heavy: 0.22,
        p_very_heavy: 0.05,
        p_extremely_heavy: 0.00,
        confidence: 0.86,
        alert_level: "Green",
        action_statement: "No Warning: Normal monsoon surge; moisture divergence towards Bay system."
      },
      {
        district_id: "jaipur",
        district_name: "Jaipur",
        state: "Rajasthan",
        terrain_type: "semi_arid",
        regime: "Break",
        raw_rainfall_mm: 12.0,
        corrected_rainfall_mm: 9.0,
        quantile_p10_mm: 3.0,
        quantile_p90_mm: 16.0,
        p_heavy: 0.05,
        p_very_heavy: 0.01,
        p_extremely_heavy: 0.00,
        confidence: 0.91,
        alert_level: "Green",
        action_statement: "No Warning: Dry surface conditions prevail."
      },
      {
        district_id: "kamrup",
        district_name: "Kamrup Metropolitan",
        state: "Assam",
        terrain_type: "river_valley",
        regime: "Active",
        raw_rainfall_mm: 55.0,
        corrected_rainfall_mm: 68.0,
        quantile_p10_mm: 46.0,
        quantile_p90_mm: 92.0,
        p_heavy: 0.62,
        p_very_heavy: 0.24,
        p_extremely_heavy: 0.02,
        confidence: 0.81,
        alert_level: "Yellow",
        action_statement: "Be Updated: Moderate peripheral precipitation along Brahmaputra basin."
      },
      // ===== EXPANDED STATES =====
      {
        district_id: "dibrugarh",
        district_name: "Dibrugarh",
        state: "Assam",
        terrain_type: "river_valley",
        regime: "Active",
        raw_rainfall_mm: 58.0,
        corrected_rainfall_mm: 72.0,
        quantile_p10_mm: 50.0,
        quantile_p90_mm: 98.0,
        p_heavy: 0.65,
        p_very_heavy: 0.28,
        p_extremely_heavy: 0.03,
        confidence: 0.80,
        alert_level: "Yellow",
        action_statement: "Be Updated: Upper Brahmaputra receiving peripheral depression rain."
      },
      {
        district_id: "midnapore_east",
        district_name: "Purba Medinipur",
        state: "West Bengal",
        terrain_type: "east_coast_cyclone_belt",
        regime: "Low / Depression",
        raw_rainfall_mm: 112.0,
        corrected_rainfall_mm: 172.0,
        quantile_p10_mm: 136.0,
        quantile_p90_mm: 222.0,
        p_heavy: 0.97,
        p_very_heavy: 0.86,
        p_extremely_heavy: 0.44,
        confidence: 0.89,
        alert_level: "Red",
        action_statement: "Take Action: Coastal Medinipur inundation imminent; evacuation of low-lying coastal villages."
      },
      {
        district_id: "bilaspur_cg2",
        district_name: "Bilaspur",
        state: "Chhattisgarh",
        terrain_type: "central_river_basin",
        regime: "Low / Depression",
        raw_rainfall_mm: 80.0,
        corrected_rainfall_mm: 122.0,
        quantile_p10_mm: 96.0,
        quantile_p90_mm: 158.0,
        p_heavy: 0.87,
        p_very_heavy: 0.65,
        p_extremely_heavy: 0.18,
        confidence: 0.85,
        alert_level: "Orange",
        action_statement: "Be Prepared: Mahanadi upper basin receiving spiral band rain; dam watch."
      },
      {
        district_id: "kolhapur2",
        district_name: "Kolhapur",
        state: "Maharashtra",
        terrain_type: "leeward_plateau",
        regime: "Low / Depression",
        raw_rainfall_mm: 58.0,
        corrected_rainfall_mm: 78.0,
        quantile_p10_mm: 58.0,
        quantile_p90_mm: 102.0,
        p_heavy: 0.64,
        p_very_heavy: 0.30,
        p_extremely_heavy: 0.04,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Maharashtra interior receiving depression spiral band spillover."
      },
      {
        district_id: "chennai",
        district_name: "Chennai",
        state: "Tamil Nadu",
        terrain_type: "coastal",
        regime: "Active",
        raw_rainfall_mm: 38.0,
        corrected_rainfall_mm: 30.0,
        quantile_p10_mm: 18.0,
        quantile_p90_mm: 44.0,
        p_heavy: 0.16,
        p_very_heavy: 0.03,
        p_extremely_heavy: 0.00,
        confidence: 0.84,
        alert_level: "Green",
        action_statement: "No Warning: Tamil Nadu coast receiving moderate offshore flow; bay system eastward."
      },
      {
        district_id: "coimbatore",
        district_name: "Coimbatore",
        state: "Tamil Nadu",
        terrain_type: "leeward_plateau",
        regime: "Break",
        raw_rainfall_mm: 14.0,
        corrected_rainfall_mm: 6.0,
        quantile_p10_mm: 1.5,
        quantile_p90_mm: 12.0,
        p_heavy: 0.02,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.87,
        alert_level: "Green",
        action_statement: "No Warning: Coimbatore dry; bay system tracking north of TN."
      },
      {
        district_id: "hyderabad",
        district_name: "Hyderabad",
        state: "Telangana",
        terrain_type: "leeward_plateau",
        regime: "Low / Depression",
        raw_rainfall_mm: 62.0,
        corrected_rainfall_mm: 92.0,
        quantile_p10_mm: 68.0,
        quantile_p90_mm: 122.0,
        p_heavy: 0.76,
        p_very_heavy: 0.46,
        p_extremely_heavy: 0.08,
        confidence: 0.84,
        alert_level: "Yellow",
        action_statement: "Be Updated: Musi river watch; depression rainband affecting Telangana."
      },
      {
        district_id: "warangal",
        district_name: "Warangal",
        state: "Telangana",
        terrain_type: "leeward_plateau",
        regime: "Low / Depression",
        raw_rainfall_mm: 68.0,
        corrected_rainfall_mm: 100.0,
        quantile_p10_mm: 76.0,
        quantile_p90_mm: 132.0,
        p_heavy: 0.80,
        p_very_heavy: 0.52,
        p_extremely_heavy: 0.10,
        confidence: 0.83,
        alert_level: "Yellow",
        action_statement: "Be Updated: Godavari tributaries in flood watch from depression inflow."
      },
      {
        district_id: "vijayawada",
        district_name: "Vijayawada (NTR Dist.)",
        state: "Andhra Pradesh",
        terrain_type: "east_coast_cyclone_belt",
        regime: "Low / Depression",
        raw_rainfall_mm: 96.0,
        corrected_rainfall_mm: 148.0,
        quantile_p10_mm: 116.0,
        quantile_p90_mm: 192.0,
        p_heavy: 0.94,
        p_very_heavy: 0.80,
        p_extremely_heavy: 0.36,
        confidence: 0.88,
        alert_level: "Red",
        action_statement: "Take Action: Krishna delta severe flooding; emergency response activated."
      },
      {
        district_id: "visakhapatnam",
        district_name: "Visakhapatnam",
        state: "Andhra Pradesh",
        terrain_type: "coastal",
        regime: "Low / Depression",
        raw_rainfall_mm: 82.0,
        corrected_rainfall_mm: 126.0,
        quantile_p10_mm: 98.0,
        quantile_p90_mm: 164.0,
        p_heavy: 0.90,
        p_very_heavy: 0.70,
        p_extremely_heavy: 0.22,
        confidence: 0.87,
        alert_level: "Orange",
        action_statement: "Be Prepared: North AP coast receiving heavy outer spiral bands; sea swell high."
      },
      {
        district_id: "bengaluru",
        district_name: "Bengaluru",
        state: "Karnataka",
        terrain_type: "leeward_plateau",
        regime: "Active",
        raw_rainfall_mm: 32.0,
        corrected_rainfall_mm: 24.0,
        quantile_p10_mm: 12.0,
        quantile_p90_mm: 38.0,
        p_heavy: 0.12,
        p_very_heavy: 0.02,
        p_extremely_heavy: 0.00,
        confidence: 0.85,
        alert_level: "Green",
        action_statement: "No Warning: Karnataka plateau receiving normal moderate active monsoon."
      },
      {
        district_id: "udupi",
        district_name: "Udupi",
        state: "Karnataka",
        terrain_type: "coastal",
        regime: "Active",
        raw_rainfall_mm: 44.0,
        corrected_rainfall_mm: 38.0,
        quantile_p10_mm: 24.0,
        quantile_p90_mm: 56.0,
        p_heavy: 0.24,
        p_very_heavy: 0.06,
        p_extremely_heavy: 0.00,
        confidence: 0.83,
        alert_level: "Green",
        action_statement: "No Warning: Karnataka coast normal; moisture axis shifted to Bay system."
      },
      {
        district_id: "ranchi",
        district_name: "Ranchi",
        state: "Jharkhand",
        terrain_type: "central_river_basin",
        regime: "Low / Depression",
        raw_rainfall_mm: 76.0,
        corrected_rainfall_mm: 112.0,
        quantile_p10_mm: 86.0,
        quantile_p90_mm: 146.0,
        p_heavy: 0.84,
        p_very_heavy: 0.60,
        p_extremely_heavy: 0.14,
        confidence: 0.85,
        alert_level: "Orange",
        action_statement: "Be Prepared: Chota Nagpur plateau receiving depression rainband; Damodar watch."
      },
      {
        district_id: "jamshedpur",
        district_name: "Jamshedpur",
        state: "Jharkhand",
        terrain_type: "central_river_basin",
        regime: "Low / Depression",
        raw_rainfall_mm: 84.0,
        corrected_rainfall_mm: 126.0,
        quantile_p10_mm: 98.0,
        quantile_p90_mm: 164.0,
        p_heavy: 0.88,
        p_very_heavy: 0.66,
        p_extremely_heavy: 0.18,
        confidence: 0.84,
        alert_level: "Orange",
        action_statement: "Be Prepared: Subarnarekha at high discharge; Jamshedpur low areas at risk."
      },
      {
        district_id: "patna",
        district_name: "Patna",
        state: "Bihar",
        terrain_type: "river_valley",
        regime: "Low / Depression",
        raw_rainfall_mm: 64.0,
        corrected_rainfall_mm: 92.0,
        quantile_p10_mm: 68.0,
        quantile_p90_mm: 122.0,
        p_heavy: 0.76,
        p_very_heavy: 0.44,
        p_extremely_heavy: 0.07,
        confidence: 0.84,
        alert_level: "Yellow",
        action_statement: "Be Updated: Ganga flooding near Patna; outer depression spiral bands reaching Bihar."
      },
      {
        district_id: "muzaffarpur",
        district_name: "Muzaffarpur",
        state: "Bihar",
        terrain_type: "river_valley",
        regime: "Active",
        raw_rainfall_mm: 56.0,
        corrected_rainfall_mm: 78.0,
        quantile_p10_mm: 54.0,
        quantile_p90_mm: 104.0,
        p_heavy: 0.64,
        p_very_heavy: 0.30,
        p_extremely_heavy: 0.04,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: North Bihar rivers swelling; Gandak and Bagmati at elevated levels."
      },
      {
        district_id: "gorakhpur",
        district_name: "Gorakhpur",
        state: "Uttar Pradesh",
        terrain_type: "river_valley",
        regime: "Low / Depression",
        raw_rainfall_mm: 58.0,
        corrected_rainfall_mm: 82.0,
        quantile_p10_mm: 58.0,
        quantile_p90_mm: 110.0,
        p_heavy: 0.68,
        p_very_heavy: 0.34,
        p_extremely_heavy: 0.05,
        confidence: 0.83,
        alert_level: "Yellow",
        action_statement: "Be Updated: Eastern UP receiving depression periphery; Rapti river watch."
      },
      {
        district_id: "lucknow",
        district_name: "Lucknow",
        state: "Uttar Pradesh",
        terrain_type: "river_valley",
        regime: "Active",
        raw_rainfall_mm: 44.0,
        corrected_rainfall_mm: 58.0,
        quantile_p10_mm: 38.0,
        quantile_p90_mm: 78.0,
        p_heavy: 0.46,
        p_very_heavy: 0.15,
        p_extremely_heavy: 0.01,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Central UP under active monsoon circulation; Gomti level rising."
      },
      {
        district_id: "shimla",
        district_name: "Shimla",
        state: "Himachal Pradesh",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 28.0,
        corrected_rainfall_mm: 18.0,
        quantile_p10_mm: 8.0,
        quantile_p90_mm: 30.0,
        p_heavy: 0.08,
        p_very_heavy: 0.01,
        p_extremely_heavy: 0.00,
        confidence: 0.84,
        alert_level: "Green",
        action_statement: "No Warning: HP mountains receiving normal monsoon; primary action at east coast."
      },
      {
        district_id: "kangra",
        district_name: "Dharamsala (Kangra)",
        state: "Himachal Pradesh",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 32.0,
        corrected_rainfall_mm: 22.0,
        quantile_p10_mm: 10.0,
        quantile_p90_mm: 36.0,
        p_heavy: 0.10,
        p_very_heavy: 0.02,
        p_extremely_heavy: 0.00,
        confidence: 0.83,
        alert_level: "Green",
        action_statement: "No Warning: Kangra valley normal; Beas within banks."
      },
      {
        district_id: "dehradun",
        district_name: "Dehradun",
        state: "Uttarakhand",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 36.0,
        corrected_rainfall_mm: 28.0,
        quantile_p10_mm: 16.0,
        quantile_p90_mm: 42.0,
        p_heavy: 0.14,
        p_very_heavy: 0.02,
        p_extremely_heavy: 0.00,
        confidence: 0.83,
        alert_level: "Green",
        action_statement: "No Warning: Garhwal receiving normal active monsoon rainfall."
      },
      {
        district_id: "haridwar",
        district_name: "Haridwar",
        state: "Uttarakhand",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 40.0,
        corrected_rainfall_mm: 32.0,
        quantile_p10_mm: 18.0,
        quantile_p90_mm: 48.0,
        p_heavy: 0.18,
        p_very_heavy: 0.03,
        p_extremely_heavy: 0.00,
        confidence: 0.82,
        alert_level: "Green",
        action_statement: "No Warning: Ganga within normal flood level at Haridwar."
      },
      {
        district_id: "amritsar",
        district_name: "Amritsar",
        state: "Punjab",
        terrain_type: "river_valley",
        regime: "Active",
        raw_rainfall_mm: 34.0,
        corrected_rainfall_mm: 26.0,
        quantile_p10_mm: 14.0,
        quantile_p90_mm: 40.0,
        p_heavy: 0.14,
        p_very_heavy: 0.02,
        p_extremely_heavy: 0.00,
        confidence: 0.83,
        alert_level: "Green",
        action_statement: "No Warning: Punjab receiving normal active monsoon; rivers within limits."
      },
      {
        district_id: "ludhiana",
        district_name: "Ludhiana",
        state: "Punjab",
        terrain_type: "river_valley",
        regime: "Active",
        raw_rainfall_mm: 30.0,
        corrected_rainfall_mm: 22.0,
        quantile_p10_mm: 10.0,
        quantile_p90_mm: 36.0,
        p_heavy: 0.10,
        p_very_heavy: 0.01,
        p_extremely_heavy: 0.00,
        confidence: 0.83,
        alert_level: "Green",
        action_statement: "No Warning: Central Punjab normal monsoon; Sutlej normal."
      },
      {
        district_id: "gurugram",
        district_name: "Gurugram",
        state: "Haryana",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 20.0,
        corrected_rainfall_mm: 10.0,
        quantile_p10_mm: 2.5,
        quantile_p90_mm: 18.0,
        p_heavy: 0.04,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.85,
        alert_level: "Green",
        action_statement: "No Warning: NCR region dry; primary action far to the east."
      },
      {
        district_id: "rohtak",
        district_name: "Rohtak",
        state: "Haryana",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 16.0,
        corrected_rainfall_mm: 7.0,
        quantile_p10_mm: 1.5,
        quantile_p90_mm: 14.0,
        p_heavy: 0.03,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.85,
        alert_level: "Green",
        action_statement: "No Warning: Haryana under break influence; agricultural conditions dry."
      },
      {
        district_id: "ahmedabad",
        district_name: "Ahmedabad",
        state: "Gujarat",
        terrain_type: "semi_arid",
        regime: "Break",
        raw_rainfall_mm: 12.0,
        corrected_rainfall_mm: 4.0,
        quantile_p10_mm: 0.8,
        quantile_p90_mm: 8.0,
        p_heavy: 0.01,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.88,
        alert_level: "Green",
        action_statement: "No Warning: Gujarat interior dry; depression well to the east."
      },
      {
        district_id: "surat",
        district_name: "Surat",
        state: "Gujarat",
        terrain_type: "coastal",
        regime: "Active",
        raw_rainfall_mm: 24.0,
        corrected_rainfall_mm: 16.0,
        quantile_p10_mm: 6.0,
        quantile_p90_mm: 28.0,
        p_heavy: 0.08,
        p_very_heavy: 0.01,
        p_extremely_heavy: 0.00,
        confidence: 0.86,
        alert_level: "Green",
        action_statement: "No Warning: South Gujarat moderate coastal rainfall; Tapti within banks."
      },
      {
        district_id: "goa_north",
        district_name: "North Goa (Panaji)",
        state: "Goa",
        terrain_type: "coastal",
        regime: "Active",
        raw_rainfall_mm: 36.0,
        corrected_rainfall_mm: 28.0,
        quantile_p10_mm: 16.0,
        quantile_p90_mm: 42.0,
        p_heavy: 0.14,
        p_very_heavy: 0.02,
        p_extremely_heavy: 0.00,
        confidence: 0.84,
        alert_level: "Green",
        action_statement: "No Warning: Goa coast moderate; west coast less active with eastern system active."
      },
      {
        district_id: "goa_south",
        district_name: "South Goa (Margao)",
        state: "Goa",
        terrain_type: "coastal",
        regime: "Active",
        raw_rainfall_mm: 32.0,
        corrected_rainfall_mm: 22.0,
        quantile_p10_mm: 10.0,
        quantile_p90_mm: 34.0,
        p_heavy: 0.10,
        p_very_heavy: 0.01,
        p_extremely_heavy: 0.00,
        confidence: 0.84,
        alert_level: "Green",
        action_statement: "No Warning: South Goa receiving moderate rains; moisture redirected eastward."
      },
      {
        district_id: "gangtok",
        district_name: "Gangtok (East Sikkim)",
        state: "Sikkim",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 52.0,
        corrected_rainfall_mm: 68.0,
        quantile_p10_mm: 46.0,
        quantile_p90_mm: 92.0,
        p_heavy: 0.55,
        p_very_heavy: 0.22,
        p_extremely_heavy: 0.03,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Teesta receiving peripheral depression rain; upper catchment watch."
      },
      {
        district_id: "sikkim_west",
        district_name: "Gyalshing (West Sikkim)",
        state: "Sikkim",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 46.0,
        corrected_rainfall_mm: 60.0,
        quantile_p10_mm: 40.0,
        quantile_p90_mm: 82.0,
        p_heavy: 0.48,
        p_very_heavy: 0.16,
        p_extremely_heavy: 0.01,
        confidence: 0.81,
        alert_level: "Yellow",
        action_statement: "Be Updated: West Sikkim foothills—moderate rain from active monsoon."
      },
      {
        district_id: "itanagar",
        district_name: "Itanagar (Papum Pare)",
        state: "Arunachal Pradesh",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 60.0,
        corrected_rainfall_mm: 82.0,
        quantile_p10_mm: 58.0,
        quantile_p90_mm: 110.0,
        p_heavy: 0.66,
        p_very_heavy: 0.32,
        p_extremely_heavy: 0.05,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Arunachal valleys receiving sustained active monsoon rainfall."
      },
      {
        district_id: "tawang",
        district_name: "Tawang",
        state: "Arunachal Pradesh",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 48.0,
        corrected_rainfall_mm: 64.0,
        quantile_p10_mm: 44.0,
        quantile_p90_mm: 86.0,
        p_heavy: 0.52,
        p_very_heavy: 0.20,
        p_extremely_heavy: 0.02,
        confidence: 0.81,
        alert_level: "Yellow",
        action_statement: "Be Updated: Western Arunachal highlands receiving moderate orographic rainfall."
      },
      {
        district_id: "shillong",
        district_name: "Shillong (East Khasi Hills)",
        state: "Meghalaya",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 72.0,
        corrected_rainfall_mm: 108.0,
        quantile_p10_mm: 80.0,
        quantile_p90_mm: 140.0,
        p_heavy: 0.80,
        p_very_heavy: 0.52,
        p_extremely_heavy: 0.10,
        confidence: 0.84,
        alert_level: "Yellow",
        action_statement: "Be Updated: Cherrapunji area receiving heavy spells; basin runoff elevated."
      },
      {
        district_id: "tura",
        district_name: "Tura (West Garo Hills)",
        state: "Meghalaya",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 64.0,
        corrected_rainfall_mm: 92.0,
        quantile_p10_mm: 68.0,
        quantile_p90_mm: 120.0,
        p_heavy: 0.74,
        p_very_heavy: 0.44,
        p_extremely_heavy: 0.07,
        confidence: 0.83,
        alert_level: "Yellow",
        action_statement: "Be Updated: Garo Hills heavy active monsoon; Brahmaputra tributaries rising."
      },
      {
        district_id: "kohima",
        district_name: "Kohima",
        state: "Nagaland",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 50.0,
        corrected_rainfall_mm: 64.0,
        quantile_p10_mm: 44.0,
        quantile_p90_mm: 86.0,
        p_heavy: 0.52,
        p_very_heavy: 0.20,
        p_extremely_heavy: 0.02,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Nagaland hills receiving active monsoon; Doyang monitoring."
      },
      {
        district_id: "dimapur",
        district_name: "Dimapur",
        state: "Nagaland",
        terrain_type: "river_valley",
        regime: "Active",
        raw_rainfall_mm: 55.0,
        corrected_rainfall_mm: 70.0,
        quantile_p10_mm: 48.0,
        quantile_p90_mm: 94.0,
        p_heavy: 0.58,
        p_very_heavy: 0.24,
        p_extremely_heavy: 0.03,
        confidence: 0.81,
        alert_level: "Yellow",
        action_statement: "Be Updated: Dhansiri valley active; moderate to heavy rainfall continuing."
      },
      {
        district_id: "imphal_east",
        district_name: "Imphal East",
        state: "Manipur",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 48.0,
        corrected_rainfall_mm: 60.0,
        quantile_p10_mm: 40.0,
        quantile_p90_mm: 80.0,
        p_heavy: 0.48,
        p_very_heavy: 0.16,
        p_extremely_heavy: 0.01,
        confidence: 0.81,
        alert_level: "Yellow",
        action_statement: "Be Updated: Manipur receiving active surge; Loktak lake level elevated."
      },
      {
        district_id: "churachandpur",
        district_name: "Churachandpur",
        state: "Manipur",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 52.0,
        corrected_rainfall_mm: 66.0,
        quantile_p10_mm: 44.0,
        quantile_p90_mm: 88.0,
        p_heavy: 0.53,
        p_very_heavy: 0.21,
        p_extremely_heavy: 0.02,
        confidence: 0.80,
        alert_level: "Yellow",
        action_statement: "Be Updated: Barak headwaters receiving steady active monsoon rainfall."
      },
      {
        district_id: "agartala",
        district_name: "Agartala (West Tripura)",
        state: "Tripura",
        terrain_type: "river_valley",
        regime: "Active",
        raw_rainfall_mm: 50.0,
        corrected_rainfall_mm: 62.0,
        quantile_p10_mm: 42.0,
        quantile_p90_mm: 82.0,
        p_heavy: 0.50,
        p_very_heavy: 0.18,
        p_extremely_heavy: 0.02,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Gumti and Haora rivers elevated discharge from active surge."
      },
      {
        district_id: "dhalai",
        district_name: "Dhalai",
        state: "Tripura",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 54.0,
        corrected_rainfall_mm: 68.0,
        quantile_p10_mm: 46.0,
        quantile_p90_mm: 90.0,
        p_heavy: 0.54,
        p_very_heavy: 0.22,
        p_extremely_heavy: 0.02,
        confidence: 0.81,
        alert_level: "Yellow",
        action_statement: "Be Updated: Hill district active rainfall; Dhalai river monitoring active."
      },
      {
        district_id: "aizawl",
        district_name: "Aizawl",
        state: "Mizoram",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 52.0,
        corrected_rainfall_mm: 66.0,
        quantile_p10_mm: 44.0,
        quantile_p90_mm: 88.0,
        p_heavy: 0.52,
        p_very_heavy: 0.20,
        p_extremely_heavy: 0.02,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Tlawng basin active; active monsoon persisting over Mizoram."
      },
      {
        district_id: "lunglei",
        district_name: "Lunglei",
        state: "Mizoram",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 56.0,
        corrected_rainfall_mm: 72.0,
        quantile_p10_mm: 50.0,
        quantile_p90_mm: 96.0,
        p_heavy: 0.56,
        p_very_heavy: 0.24,
        p_extremely_heavy: 0.03,
        confidence: 0.81,
        alert_level: "Yellow",
        action_statement: "Be Updated: South Mizoram hills—active monsoon with landslide advisory."
      },
      {
        district_id: "srinagar",
        district_name: "Srinagar",
        state: "Jammu and Kashmir",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 10.0,
        corrected_rainfall_mm: 4.0,
        quantile_p10_mm: 0.8,
        quantile_p90_mm: 8.0,
        p_heavy: 0.01,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.88,
        alert_level: "Green",
        action_statement: "No Warning: Kashmir valley calm; primary action at Bay of Bengal."
      },
      {
        district_id: "jammu",
        district_name: "Jammu",
        state: "Jammu and Kashmir",
        terrain_type: "himalayan_mountain",
        regime: "Active",
        raw_rainfall_mm: 22.0,
        corrected_rainfall_mm: 14.0,
        quantile_p10_mm: 4.0,
        quantile_p90_mm: 24.0,
        p_heavy: 0.06,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.85,
        alert_level: "Green",
        action_statement: "No Warning: Jammu foothills normal; no advisory needed."
      },
      {
        district_id: "leh",
        district_name: "Leh",
        state: "Ladakh",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 3.0,
        corrected_rainfall_mm: 1.0,
        quantile_p10_mm: 0.1,
        quantile_p90_mm: 2.0,
        p_heavy: 0.00,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.93,
        alert_level: "Green",
        action_statement: "No Warning: Trans-Himalayan desert; negligible precipitation."
      },
      {
        district_id: "kargil",
        district_name: "Kargil",
        state: "Ladakh",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 5.0,
        corrected_rainfall_mm: 2.0,
        quantile_p10_mm: 0.3,
        quantile_p90_mm: 4.0,
        p_heavy: 0.00,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.92,
        alert_level: "Green",
        action_statement: "No Warning: High altitude rain shadow; no advisory needed."
      },
      {
        district_id: "delhi_central",
        district_name: "Central Delhi",
        state: "Delhi",
        terrain_type: "river_valley",
        regime: "Active",
        raw_rainfall_mm: 28.0,
        corrected_rainfall_mm: 18.0,
        quantile_p10_mm: 6.0,
        quantile_p90_mm: 30.0,
        p_heavy: 0.08,
        p_very_heavy: 0.01,
        p_extremely_heavy: 0.00,
        confidence: 0.85,
        alert_level: "Green",
        action_statement: "No Warning: Delhi receiving isolated active monsoon showers; Yamuna normal."
      },
      {
        district_id: "delhi_east",
        district_name: "East Delhi",
        state: "Delhi",
        terrain_type: "river_valley",
        regime: "Active",
        raw_rainfall_mm: 30.0,
        corrected_rainfall_mm: 20.0,
        quantile_p10_mm: 8.0,
        quantile_p90_mm: 32.0,
        p_heavy: 0.09,
        p_very_heavy: 0.01,
        p_extremely_heavy: 0.00,
        confidence: 0.84,
        alert_level: "Green",
        action_statement: "No Warning: Urban areas normal; drainage functioning adequately."
      }
    ],
    rmse_scores: {
      "T+24": { raw: [14.2, 7.1, 26.5, 13.8, 11.9], corr: [5.4, 4.3, 6.8, 5.2, 4.8] },
      "T+48": { raw: [19.5, 10.2, 34.8, 18.6, 16.4], corr: [7.8, 6.1, 9.2, 7.4, 6.7] },
      "T+72": { raw: [26.8, 15.0, 44.5, 25.2, 22.8], corr: [10.5, 8.2, 12.6, 9.8, 8.9] }
    }
  },

  break_2020_central_india: {
    scenario_id: "break_2020_central_india",
    title: "Break Spell (Suppressed Peninsular Flow)",
    date: "18–22 August 2020",
    banner: {
      level: "Yellow",
      text: "Break Spell Advisory: Monsoon trough anchored to Himalayan foothills; peninsular convective suppression with localized foothill/NE extremes."
    },
    synoptic_evaluation: {
      primary_synoptic: "Break",
      confidence: 0.91,
      entropy: 0.19,
      fallback_active: false,
    },
    regional_baselines: {
      himalayan:        98.0,
      northeast_india:  125.0,
      north_india:      56.0,
      east_coast:       20.0,
      central_india:    8.5,
      peninsular_india: 7.2,
      west_coast:       14.0,
      northwest_india:  4.5,
    },
    grid_raster: [
      ["Orographic", "Orographic", "Orographic", "Orographic", "Orographic", "Break", "Break", "Break", "Break", "Orographic", "Orographic", "Orographic"],
      ["Break", "Break", "Break", "Break", "Break", "Break", "Break", "Break", "Break", "Break", "Break", "Break"],
      ["Break", "Break", "Break", "Break", "Break", "Break", "Break", "Break", "Break", "Break", "Break", "Break"],
      ["Break", "Break", "Break", "Break", "Break", "Break", "Break", "Break", "Break", "Break", "Break", "Break"]
    ],
    districts: [
      // ===== ASSAM (2) =====
      {
        district_id: "kamrup",
        district_name: "Kamrup Metropolitan",
        state: "Assam",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 72.0,
        corrected_rainfall_mm: 148.0,
        quantile_p10_mm: 118.0,
        quantile_p90_mm: 192.0,
        p_heavy: 0.95,
        p_very_heavy: 0.82,
        p_extremely_heavy: 0.32,
        confidence: 0.89,
        alert_level: "Orange",
        action_statement: "Be Prepared: Break monsoon moisture pooling in Assam valley & Brahmaputra."
      },
      {
        district_id: "shimla",
        district_name: "Shimla",
        state: "Himachal Pradesh",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 68.0,
        corrected_rainfall_mm: 124.0,
        quantile_p10_mm: 96.0,
        quantile_p90_mm: 162.0,
        p_heavy: 0.91,
        p_very_heavy: 0.72,
        p_extremely_heavy: 0.22,
        confidence: 0.87,
        alert_level: "Orange",
        action_statement: "Be Prepared: Monsoon trough at foothills triggers intense mountain storms."
      },
      {
        district_id: "dehradun",
        district_name: "Dehradun",
        state: "Uttarakhand",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 75.0,
        corrected_rainfall_mm: 138.0,
        quantile_p10_mm: 108.0,
        quantile_p90_mm: 178.0,
        p_heavy: 0.94,
        p_very_heavy: 0.78,
        p_extremely_heavy: 0.28,
        confidence: 0.88,
        alert_level: "Orange",
        action_statement: "Be Prepared: High cloudburst hazard along Siwalik foothills."
      },
      {
        district_id: "patna",
        district_name: "Patna",
        state: "Bihar",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 58.0,
        corrected_rainfall_mm: 94.0,
        quantile_p10_mm: 72.0,
        quantile_p90_mm: 125.0,
        p_heavy: 0.78,
        p_very_heavy: 0.45,
        p_extremely_heavy: 0.08,
        confidence: 0.84,
        alert_level: "Yellow",
        action_statement: "Be Updated: North Bihar rivers in spate from Nepal catchment runoff."
      },
      {
        district_id: "gorakhpur",
        district_name: "Gorakhpur",
        state: "Uttar Pradesh",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 62.0,
        corrected_rainfall_mm: 102.0,
        quantile_p10_mm: 78.0,
        quantile_p90_mm: 134.0,
        p_heavy: 0.82,
        p_very_heavy: 0.52,
        p_extremely_heavy: 0.10,
        confidence: 0.85,
        alert_level: "Yellow",
        action_statement: "Be Updated: Rapti and Rohin river level surge monitoring."
      },
      {
        district_id: "hoshangabad",
        district_name: "Narmadapuram",
        state: "Madhya Pradesh",
        terrain_type: "central_river_basin",
        regime: "Active",
        raw_rainfall_mm: 24.0,
        corrected_rainfall_mm: 6.0,
        quantile_p10_mm: 1.5,
        quantile_p90_mm: 12.0,
        p_heavy: 0.02,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.94,
        alert_level: "Green",
        action_statement: "No Warning: Spurious NWP drizzle successfully eliminated by AI model."
      },
      {
        district_id: "raipur",
        district_name: "Raipur",
        state: "Chhattisgarh",
        terrain_type: "central_river_basin",
        regime: "Low / Depression",
        raw_rainfall_mm: 28.0,
        corrected_rainfall_mm: 8.0,
        quantile_p10_mm: 2.0,
        quantile_p90_mm: 15.0,
        p_heavy: 0.03,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.93,
        alert_level: "Green",
        action_statement: "No Warning: Suppressed central monsoon flow; clear skies."
      },
      {
        district_id: "kolhapur",
        district_name: "Kolhapur",
        state: "Maharashtra",
        terrain_type: "leeward_plateau",
        regime: "Active",
        raw_rainfall_mm: 32.0,
        corrected_rainfall_mm: 7.0,
        quantile_p10_mm: 1.8,
        quantile_p90_mm: 14.0,
        p_heavy: 0.02,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.95,
        alert_level: "Green",
        action_statement: "No Warning: Western Ghats surge collapsed; agricultural irrigation required."
      },
      {
        district_id: "pune",
        district_name: "Pune",
        state: "Maharashtra",
        terrain_type: "leeward_plateau",
        regime: "Active",
        raw_rainfall_mm: 22.0,
        corrected_rainfall_mm: 5.0,
        quantile_p10_mm: 1.0,
        quantile_p90_mm: 10.0,
        p_heavy: 0.01,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.96,
        alert_level: "Green",
        action_statement: "No Warning: Dry break spell condition."
      },
      {
        district_id: "idukki",
        district_name: "Idukki",
        state: "Kerala",
        terrain_type: "high_ghats",
        regime: "Orographic",
        raw_rainfall_mm: 38.0,
        corrected_rainfall_mm: 15.0,
        quantile_p10_mm: 6.0,
        quantile_p90_mm: 26.0,
        p_heavy: 0.06,
        p_very_heavy: 0.01,
        p_extremely_heavy: 0.00,
        confidence: 0.90,
        alert_level: "Green",
        action_statement: "No Warning: Low wind shear, quiescent monsoon break phase."
      },
      // ===== EXPANDED STATES =====
      {
        district_id: "dibrugarh",
        district_name: "Dibrugarh",
        state: "Assam",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 68.0,
        corrected_rainfall_mm: 138.0,
        quantile_p10_mm: 108.0,
        quantile_p90_mm: 178.0,
        p_heavy: 0.92,
        p_very_heavy: 0.76,
        p_extremely_heavy: 0.26,
        confidence: 0.87,
        alert_level: "Orange",
        action_statement: "Be Prepared: Upper Brahmaputra at elevated levels; embankment monitoring active."
      },
      {
        district_id: "kangra",
        district_name: "Dharamsala (Kangra)",
        state: "Himachal Pradesh",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 74.0,
        corrected_rainfall_mm: 136.0,
        quantile_p10_mm: 104.0,
        quantile_p90_mm: 174.0,
        p_heavy: 0.93,
        p_very_heavy: 0.76,
        p_extremely_heavy: 0.26,
        confidence: 0.88,
        alert_level: "Orange",
        action_statement: "Be Prepared: Beas river catchment saturated; cloudburst risk in Kangra valley."
      },
      {
        district_id: "haridwar",
        district_name: "Haridwar",
        state: "Uttarakhand",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 66.0,
        corrected_rainfall_mm: 122.0,
        quantile_p10_mm: 92.0,
        quantile_p90_mm: 158.0,
        p_heavy: 0.90,
        p_very_heavy: 0.70,
        p_extremely_heavy: 0.20,
        confidence: 0.86,
        alert_level: "Orange",
        action_statement: "Be Prepared: Ganga in spate; ghats and low riverside areas at risk."
      },
      {
        district_id: "muzaffarpur",
        district_name: "Muzaffarpur",
        state: "Bihar",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 62.0,
        corrected_rainfall_mm: 98.0,
        quantile_p10_mm: 78.0,
        quantile_p90_mm: 130.0,
        p_heavy: 0.80,
        p_very_heavy: 0.48,
        p_extremely_heavy: 0.09,
        confidence: 0.83,
        alert_level: "Yellow",
        action_statement: "Be Updated: Bagmati and Gandak rivers near flood stage; evacuate riverine areas."
      },
      {
        district_id: "lucknow",
        district_name: "Lucknow",
        state: "Uttar Pradesh",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 44.0,
        corrected_rainfall_mm: 68.0,
        quantile_p10_mm: 48.0,
        quantile_p90_mm: 94.0,
        p_heavy: 0.60,
        p_very_heavy: 0.28,
        p_extremely_heavy: 0.04,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Gomti river level rising; Lucknow urban drainage under load."
      },
      {
        district_id: "indore",
        district_name: "Indore",
        state: "Madhya Pradesh",
        terrain_type: "central_river_basin",
        regime: "Active",
        raw_rainfall_mm: 18.0,
        corrected_rainfall_mm: 4.0,
        quantile_p10_mm: 0.8,
        quantile_p90_mm: 9.0,
        p_heavy: 0.01,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.93,
        alert_level: "Green",
        action_statement: "No Warning: Dry break spell conditions; minimal convective activity."
      },
      {
        district_id: "bilaspur_cg",
        district_name: "Bilaspur",
        state: "Chhattisgarh",
        terrain_type: "central_river_basin",
        regime: "Low / Depression",
        raw_rainfall_mm: 22.0,
        corrected_rainfall_mm: 6.0,
        quantile_p10_mm: 1.5,
        quantile_p90_mm: 12.0,
        p_heavy: 0.02,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.92,
        alert_level: "Green",
        action_statement: "No Warning: Mahanadi upper reaches dry under break spell."
      },
      {
        district_id: "thiruvananthapuram",
        district_name: "Thiruvananthapuram",
        state: "Kerala",
        terrain_type: "coastal",
        regime: "Active",
        raw_rainfall_mm: 28.0,
        corrected_rainfall_mm: 10.0,
        quantile_p10_mm: 3.0,
        quantile_p90_mm: 18.0,
        p_heavy: 0.04,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.89,
        alert_level: "Green",
        action_statement: "No Warning: Suppressed Arabian Sea branch; break conditions over south Kerala."
      },
      {
        district_id: "jaipur",
        district_name: "Jaipur",
        state: "Rajasthan",
        terrain_type: "semi_arid",
        regime: "Break",
        raw_rainfall_mm: 12.0,
        corrected_rainfall_mm: 3.0,
        quantile_p10_mm: 0.5,
        quantile_p90_mm: 6.0,
        p_heavy: 0.01,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.92,
        alert_level: "Green",
        action_statement: "No Warning: Dry westerly continental air mass dominant."
      },
      {
        district_id: "jodhpur",
        district_name: "Jodhpur",
        state: "Rajasthan",
        terrain_type: "semi_arid",
        regime: "Break",
        raw_rainfall_mm: 8.0,
        corrected_rainfall_mm: 2.0,
        quantile_p10_mm: 0.2,
        quantile_p90_mm: 4.0,
        p_heavy: 0.00,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.93,
        alert_level: "Green",
        action_statement: "No Warning: Hyperarid conditions; dust haze likely."
      },
      {
        district_id: "ahmedabad",
        district_name: "Ahmedabad",
        state: "Gujarat",
        terrain_type: "semi_arid",
        regime: "Break",
        raw_rainfall_mm: 14.0,
        corrected_rainfall_mm: 5.0,
        quantile_p10_mm: 1.0,
        quantile_p90_mm: 10.0,
        p_heavy: 0.02,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.91,
        alert_level: "Green",
        action_statement: "No Warning: Suppressed Gujarat branch; break spell conditions."
      },
      {
        district_id: "surat",
        district_name: "Surat",
        state: "Gujarat",
        terrain_type: "coastal",
        regime: "Active",
        raw_rainfall_mm: 22.0,
        corrected_rainfall_mm: 9.0,
        quantile_p10_mm: 2.0,
        quantile_p90_mm: 18.0,
        p_heavy: 0.03,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.90,
        alert_level: "Green",
        action_statement: "No Warning: South Gujarat coast—moderate sea breeze precipitation only."
      },
      {
        district_id: "kolkata",
        district_name: "Kolkata",
        state: "West Bengal",
        terrain_type: "east_coast_cyclone_belt",
        regime: "Break",
        raw_rainfall_mm: 30.0,
        corrected_rainfall_mm: 18.0,
        quantile_p10_mm: 8.0,
        quantile_p90_mm: 30.0,
        p_heavy: 0.08,
        p_very_heavy: 0.01,
        p_extremely_heavy: 0.00,
        confidence: 0.88,
        alert_level: "Green",
        action_statement: "No Warning: Hooghly drainage normal; coastal break conditions."
      },
      {
        district_id: "jalpaiguri",
        district_name: "Jalpaiguri",
        state: "West Bengal",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 64.0,
        corrected_rainfall_mm: 118.0,
        quantile_p10_mm: 88.0,
        quantile_p90_mm: 152.0,
        p_heavy: 0.88,
        p_very_heavy: 0.64,
        p_extremely_heavy: 0.18,
        confidence: 0.86,
        alert_level: "Orange",
        action_statement: "Be Prepared: Teesta river flooding; sub-Himalayan foothills break-enhanced rainfall."
      },
      {
        district_id: "balasore_break",
        district_name: "Balasore",
        state: "Odisha",
        terrain_type: "east_coast_cyclone_belt",
        regime: "Break",
        raw_rainfall_mm: 20.0,
        corrected_rainfall_mm: 8.0,
        quantile_p10_mm: 2.0,
        quantile_p90_mm: 16.0,
        p_heavy: 0.03,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.90,
        alert_level: "Green",
        action_statement: "No Warning: East coast under break spell shadow; minimal rain."
      },
      {
        district_id: "bhubaneswar_break",
        district_name: "Khurda (Bhubaneswar)",
        state: "Odisha",
        terrain_type: "east_coast_cyclone_belt",
        regime: "Break",
        raw_rainfall_mm: 16.0,
        corrected_rainfall_mm: 6.0,
        quantile_p10_mm: 1.0,
        quantile_p90_mm: 12.0,
        p_heavy: 0.02,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.91,
        alert_level: "Green",
        action_statement: "No Warning: Mahanadi delta inactive during break spell."
      },
      {
        district_id: "bengaluru",
        district_name: "Bengaluru",
        state: "Karnataka",
        terrain_type: "leeward_plateau",
        regime: "Active",
        raw_rainfall_mm: 18.0,
        corrected_rainfall_mm: 6.0,
        quantile_p10_mm: 1.5,
        quantile_p90_mm: 12.0,
        p_heavy: 0.02,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.92,
        alert_level: "Green",
        action_statement: "No Warning: Deccan plateau dry; isolated convection only."
      },
      {
        district_id: "udupi",
        district_name: "Udupi",
        state: "Karnataka",
        terrain_type: "coastal",
        regime: "Active",
        raw_rainfall_mm: 35.0,
        corrected_rainfall_mm: 18.0,
        quantile_p10_mm: 6.0,
        quantile_p90_mm: 32.0,
        p_heavy: 0.08,
        p_very_heavy: 0.01,
        p_extremely_heavy: 0.00,
        confidence: 0.89,
        alert_level: "Green",
        action_statement: "No Warning: Reduced coastal rainfall under break; sea still choppy."
      },
      {
        district_id: "chennai",
        district_name: "Chennai",
        state: "Tamil Nadu",
        terrain_type: "coastal",
        regime: "Break",
        raw_rainfall_mm: 10.0,
        corrected_rainfall_mm: 3.0,
        quantile_p10_mm: 0.5,
        quantile_p90_mm: 7.0,
        p_heavy: 0.01,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.93,
        alert_level: "Green",
        action_statement: "No Warning: Break phase; Tamil Nadu southwest monsoon suppressed."
      },
      {
        district_id: "coimbatore",
        district_name: "Coimbatore",
        state: "Tamil Nadu",
        terrain_type: "leeward_plateau",
        regime: "Break",
        raw_rainfall_mm: 8.0,
        corrected_rainfall_mm: 2.0,
        quantile_p10_mm: 0.2,
        quantile_p90_mm: 5.0,
        p_heavy: 0.00,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.94,
        alert_level: "Green",
        action_statement: "No Warning: Dry leeward Ghats; isolated evening thunderstorms only."
      },
      {
        district_id: "hyderabad",
        district_name: "Hyderabad",
        state: "Telangana",
        terrain_type: "leeward_plateau",
        regime: "Break",
        raw_rainfall_mm: 12.0,
        corrected_rainfall_mm: 4.0,
        quantile_p10_mm: 0.8,
        quantile_p90_mm: 8.0,
        p_heavy: 0.01,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.92,
        alert_level: "Green",
        action_statement: "No Warning: Deccan interior dry under break spell regime."
      },
      {
        district_id: "warangal",
        district_name: "Warangal",
        state: "Telangana",
        terrain_type: "leeward_plateau",
        regime: "Break",
        raw_rainfall_mm: 14.0,
        corrected_rainfall_mm: 5.0,
        quantile_p10_mm: 1.0,
        quantile_p90_mm: 10.0,
        p_heavy: 0.01,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.91,
        alert_level: "Green",
        action_statement: "No Warning: Krishna basin low activity during break."
      },
      {
        district_id: "vijayawada",
        district_name: "Vijayawada (NTR Dist.)",
        state: "Andhra Pradesh",
        terrain_type: "east_coast_cyclone_belt",
        regime: "Break",
        raw_rainfall_mm: 16.0,
        corrected_rainfall_mm: 6.0,
        quantile_p10_mm: 1.5,
        quantile_p90_mm: 12.0,
        p_heavy: 0.02,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.91,
        alert_level: "Green",
        action_statement: "No Warning: Krishna delta low activity; east coast suppressed."
      },
      {
        district_id: "visakhapatnam",
        district_name: "Visakhapatnam",
        state: "Andhra Pradesh",
        terrain_type: "coastal",
        regime: "Break",
        raw_rainfall_mm: 18.0,
        corrected_rainfall_mm: 7.0,
        quantile_p10_mm: 2.0,
        quantile_p90_mm: 14.0,
        p_heavy: 0.02,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.90,
        alert_level: "Green",
        action_statement: "No Warning: North AP coast quiet during peninsular break."
      },
      {
        district_id: "ranchi",
        district_name: "Ranchi",
        state: "Jharkhand",
        terrain_type: "central_river_basin",
        regime: "Break",
        raw_rainfall_mm: 32.0,
        corrected_rainfall_mm: 14.0,
        quantile_p10_mm: 4.0,
        quantile_p90_mm: 26.0,
        p_heavy: 0.06,
        p_very_heavy: 0.01,
        p_extremely_heavy: 0.00,
        confidence: 0.88,
        alert_level: "Green",
        action_statement: "No Warning: Chota Nagpur plateau under break regime; reduced rainfall."
      },
      {
        district_id: "jamshedpur",
        district_name: "Jamshedpur",
        state: "Jharkhand",
        terrain_type: "central_river_basin",
        regime: "Break",
        raw_rainfall_mm: 28.0,
        corrected_rainfall_mm: 10.0,
        quantile_p10_mm: 2.5,
        quantile_p90_mm: 20.0,
        p_heavy: 0.04,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.87,
        alert_level: "Green",
        action_statement: "No Warning: Subarnarekha river normal levels."
      },
      {
        district_id: "amritsar",
        district_name: "Amritsar",
        state: "Punjab",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 48.0,
        corrected_rainfall_mm: 72.0,
        quantile_p10_mm: 52.0,
        quantile_p90_mm: 98.0,
        p_heavy: 0.64,
        p_very_heavy: 0.30,
        p_extremely_heavy: 0.05,
        confidence: 0.83,
        alert_level: "Yellow",
        action_statement: "Be Updated: Punjab near trough axis; Sutlej headwaters alert active."
      },
      {
        district_id: "ludhiana",
        district_name: "Ludhiana",
        state: "Punjab",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 40.0,
        corrected_rainfall_mm: 58.0,
        quantile_p10_mm: 40.0,
        quantile_p90_mm: 82.0,
        p_heavy: 0.54,
        p_very_heavy: 0.22,
        p_extremely_heavy: 0.03,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Moderate monsoon rainfall near break trough; normal drainage."
      },
      {
        district_id: "gurugram",
        district_name: "Gurugram",
        state: "Haryana",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 28.0,
        corrected_rainfall_mm: 14.0,
        quantile_p10_mm: 4.0,
        quantile_p90_mm: 26.0,
        p_heavy: 0.06,
        p_very_heavy: 0.01,
        p_extremely_heavy: 0.00,
        confidence: 0.85,
        alert_level: "Green",
        action_statement: "No Warning: Urban drainage advisory standby; rainfall well below heavy threshold."
      },
      {
        district_id: "rohtak",
        district_name: "Rohtak",
        state: "Haryana",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 22.0,
        corrected_rainfall_mm: 8.0,
        quantile_p10_mm: 1.5,
        quantile_p90_mm: 16.0,
        p_heavy: 0.03,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.84,
        alert_level: "Green",
        action_statement: "No Warning: Dry break conditions across central Haryana."
      },
      {
        district_id: "gangtok",
        district_name: "Gangtok (East Sikkim)",
        state: "Sikkim",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 80.0,
        corrected_rainfall_mm: 152.0,
        quantile_p10_mm: 118.0,
        quantile_p90_mm: 198.0,
        p_heavy: 0.96,
        p_very_heavy: 0.84,
        p_extremely_heavy: 0.36,
        confidence: 0.87,
        alert_level: "Orange",
        action_statement: "Be Prepared: Teesta upper catchment—flash flood risk on orographic enhancement."
      },
      {
        district_id: "sikkim_west",
        district_name: "Gyalshing (West Sikkim)",
        state: "Sikkim",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 74.0,
        corrected_rainfall_mm: 138.0,
        quantile_p10_mm: 106.0,
        quantile_p90_mm: 178.0,
        p_heavy: 0.93,
        p_very_heavy: 0.78,
        p_extremely_heavy: 0.28,
        confidence: 0.86,
        alert_level: "Orange",
        action_statement: "Be Prepared: High mountain precipitation; landslide hazard active."
      },
      {
        district_id: "itanagar",
        district_name: "Itanagar (Papum Pare)",
        state: "Arunachal Pradesh",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 78.0,
        corrected_rainfall_mm: 148.0,
        quantile_p10_mm: 114.0,
        quantile_p90_mm: 192.0,
        p_heavy: 0.95,
        p_very_heavy: 0.82,
        p_extremely_heavy: 0.32,
        confidence: 0.85,
        alert_level: "Orange",
        action_statement: "Be Prepared: Eastern Himalayan break enhancement; Subansiri basin alert."
      },
      {
        district_id: "tawang",
        district_name: "Tawang",
        state: "Arunachal Pradesh",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 62.0,
        corrected_rainfall_mm: 118.0,
        quantile_p10_mm: 86.0,
        quantile_p90_mm: 154.0,
        p_heavy: 0.89,
        p_very_heavy: 0.68,
        p_extremely_heavy: 0.18,
        confidence: 0.84,
        alert_level: "Orange",
        action_statement: "Be Prepared: High altitude precipitation; road connectivity disruption risk."
      },
      {
        district_id: "shillong",
        district_name: "Shillong (East Khasi Hills)",
        state: "Meghalaya",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 86.0,
        corrected_rainfall_mm: 162.0,
        quantile_p10_mm: 128.0,
        quantile_p90_mm: 208.0,
        p_heavy: 0.98,
        p_very_heavy: 0.88,
        p_extremely_heavy: 0.44,
        confidence: 0.88,
        alert_level: "Red",
        action_statement: "Take Action: Cherrapunji zone—extreme orographic precipitation; flash flood warning."
      },
      {
        district_id: "tura",
        district_name: "Tura (West Garo Hills)",
        state: "Meghalaya",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 70.0,
        corrected_rainfall_mm: 134.0,
        quantile_p10_mm: 104.0,
        quantile_p90_mm: 172.0,
        p_heavy: 0.92,
        p_very_heavy: 0.74,
        p_extremely_heavy: 0.24,
        confidence: 0.86,
        alert_level: "Orange",
        action_statement: "Be Prepared: Garo Hills break-enhanced precipitation; river flooding risk."
      },
      {
        district_id: "kohima",
        district_name: "Kohima",
        state: "Nagaland",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 56.0,
        corrected_rainfall_mm: 104.0,
        quantile_p10_mm: 78.0,
        quantile_p90_mm: 136.0,
        p_heavy: 0.84,
        p_very_heavy: 0.58,
        p_extremely_heavy: 0.12,
        confidence: 0.84,
        alert_level: "Yellow",
        action_statement: "Be Updated: Elevated northeast break rainfall; Doyang catchment monitoring."
      },
      {
        district_id: "dimapur",
        district_name: "Dimapur",
        state: "Nagaland",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 62.0,
        corrected_rainfall_mm: 112.0,
        quantile_p10_mm: 84.0,
        quantile_p90_mm: 146.0,
        p_heavy: 0.86,
        p_very_heavy: 0.62,
        p_extremely_heavy: 0.14,
        confidence: 0.83,
        alert_level: "Yellow",
        action_statement: "Be Updated: Dhansiri river level elevated; moderate heavy rainfall continuing."
      },
      {
        district_id: "imphal_east",
        district_name: "Imphal East",
        state: "Manipur",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 50.0,
        corrected_rainfall_mm: 92.0,
        quantile_p10_mm: 68.0,
        quantile_p90_mm: 120.0,
        p_heavy: 0.78,
        p_very_heavy: 0.48,
        p_extremely_heavy: 0.08,
        confidence: 0.83,
        alert_level: "Yellow",
        action_statement: "Be Updated: Loktak lake basin rainfall above normal under break enhancement."
      },
      {
        district_id: "churachandpur",
        district_name: "Churachandpur",
        state: "Manipur",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 58.0,
        corrected_rainfall_mm: 106.0,
        quantile_p10_mm: 78.0,
        quantile_p90_mm: 138.0,
        p_heavy: 0.82,
        p_very_heavy: 0.55,
        p_extremely_heavy: 0.10,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Barak headwaters at risk; hill slopes saturated."
      },
      {
        district_id: "agartala",
        district_name: "Agartala (West Tripura)",
        state: "Tripura",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 55.0,
        corrected_rainfall_mm: 98.0,
        quantile_p10_mm: 72.0,
        quantile_p90_mm: 128.0,
        p_heavy: 0.80,
        p_very_heavy: 0.50,
        p_extremely_heavy: 0.09,
        confidence: 0.84,
        alert_level: "Yellow",
        action_statement: "Be Updated: Gumti and Haora rivers showing elevated discharge."
      },
      {
        district_id: "dhalai",
        district_name: "Dhalai",
        state: "Tripura",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 60.0,
        corrected_rainfall_mm: 108.0,
        quantile_p10_mm: 80.0,
        quantile_p90_mm: 140.0,
        p_heavy: 0.83,
        p_very_heavy: 0.56,
        p_extremely_heavy: 0.11,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: Hill district enhanced rainfall; Dhalai river monitoring active."
      },
      {
        district_id: "aizawl",
        district_name: "Aizawl",
        state: "Mizoram",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 52.0,
        corrected_rainfall_mm: 94.0,
        quantile_p10_mm: 70.0,
        quantile_p90_mm: 124.0,
        p_heavy: 0.78,
        p_very_heavy: 0.46,
        p_extremely_heavy: 0.08,
        confidence: 0.83,
        alert_level: "Yellow",
        action_statement: "Be Updated: Tlawng river basin active; landslide caution in steep zones."
      },
      {
        district_id: "lunglei",
        district_name: "Lunglei",
        state: "Mizoram",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 56.0,
        corrected_rainfall_mm: 100.0,
        quantile_p10_mm: 74.0,
        quantile_p90_mm: 132.0,
        p_heavy: 0.80,
        p_very_heavy: 0.50,
        p_extremely_heavy: 0.09,
        confidence: 0.82,
        alert_level: "Yellow",
        action_statement: "Be Updated: South Mizoram receiving heavy breaks; slope stability concern."
      },
      {
        district_id: "goa_north",
        district_name: "North Goa (Panaji)",
        state: "Goa",
        terrain_type: "coastal",
        regime: "Active",
        raw_rainfall_mm: 30.0,
        corrected_rainfall_mm: 12.0,
        quantile_p10_mm: 3.5,
        quantile_p90_mm: 22.0,
        p_heavy: 0.05,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.89,
        alert_level: "Green",
        action_statement: "No Warning: Reduced Goa coastal rainfall; beach conditions improving."
      },
      {
        district_id: "goa_south",
        district_name: "South Goa (Margao)",
        state: "Goa",
        terrain_type: "coastal",
        regime: "Active",
        raw_rainfall_mm: 26.0,
        corrected_rainfall_mm: 9.0,
        quantile_p10_mm: 2.0,
        quantile_p90_mm: 18.0,
        p_heavy: 0.03,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.90,
        alert_level: "Green",
        action_statement: "No Warning: South Goa Ghats under break; mild overcast only."
      },
      {
        district_id: "delhi_central",
        district_name: "Central Delhi",
        state: "Delhi",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 20.0,
        corrected_rainfall_mm: 8.0,
        quantile_p10_mm: 1.5,
        quantile_p90_mm: 16.0,
        p_heavy: 0.03,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.86,
        alert_level: "Green",
        action_statement: "No Warning: Delhi dry under break; Yamuna level stable."
      },
      {
        district_id: "delhi_east",
        district_name: "East Delhi",
        state: "Delhi",
        terrain_type: "river_valley",
        regime: "Break",
        raw_rainfall_mm: 22.0,
        corrected_rainfall_mm: 9.0,
        quantile_p10_mm: 2.0,
        quantile_p90_mm: 18.0,
        p_heavy: 0.03,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.85,
        alert_level: "Green",
        action_statement: "No Warning: Urban drainage normal; no flooding risk."
      },
      {
        district_id: "srinagar",
        district_name: "Srinagar",
        state: "Jammu and Kashmir",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 22.0,
        corrected_rainfall_mm: 18.0,
        quantile_p10_mm: 6.0,
        quantile_p90_mm: 32.0,
        p_heavy: 0.07,
        p_very_heavy: 0.01,
        p_extremely_heavy: 0.00,
        confidence: 0.85,
        alert_level: "Green",
        action_statement: "No Warning: Valley conditions dry; Jhelum river within normal limits."
      },
      {
        district_id: "jammu",
        district_name: "Jammu",
        state: "Jammu and Kashmir",
        terrain_type: "himalayan_mountain",
        regime: "Orographic",
        raw_rainfall_mm: 48.0,
        corrected_rainfall_mm: 82.0,
        quantile_p10_mm: 58.0,
        quantile_p90_mm: 110.0,
        p_heavy: 0.72,
        p_very_heavy: 0.42,
        p_extremely_heavy: 0.08,
        confidence: 0.84,
        alert_level: "Yellow",
        action_statement: "Be Updated: Jammu foothills receiving heavy spells; Tawi river watch."
      },
      {
        district_id: "leh",
        district_name: "Leh",
        state: "Ladakh",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 6.0,
        corrected_rainfall_mm: 3.0,
        quantile_p10_mm: 0.5,
        quantile_p90_mm: 6.0,
        p_heavy: 0.00,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.90,
        alert_level: "Green",
        action_statement: "No Warning: Trans-Himalayan high-altitude desert; negligible precipitation."
      },
      {
        district_id: "kargil",
        district_name: "Kargil",
        state: "Ladakh",
        terrain_type: "himalayan_mountain",
        regime: "Break",
        raw_rainfall_mm: 8.0,
        corrected_rainfall_mm: 4.0,
        quantile_p10_mm: 0.8,
        quantile_p90_mm: 8.0,
        p_heavy: 0.01,
        p_very_heavy: 0.00,
        p_extremely_heavy: 0.00,
        confidence: 0.89,
        alert_level: "Green",
        action_statement: "No Warning: High altitude rain shadow; cloudburst risk very low."
      }
    ],
    rmse_scores: {
      "T+24": { raw: [10.5, 14.8, 12.2, 11.4, 10.2], corr: [4.6, 3.8, 4.9, 4.8, 4.4] },
      "T+48": { raw: [14.8, 21.4, 16.8, 15.6, 14.2], corr: [6.4, 5.2, 6.8, 6.5, 6.0] },
      "T+72": { raw: [20.6, 29.8, 23.5, 21.8, 19.5], corr: [8.8, 7.1, 9.2, 8.9, 8.2] }
    }
  }
};

// =============================================================================
// STATE & REGION METEOROLOGICAL MAPPING
// =============================================================================
const STATE_TO_REGION = {
  "jammuandkashmir":    "himalayan",
  "ladakh":             "himalayan",
  "himachalpradesh":   "himalayan",
  "uttarakhand":        "himalayan",
  "sikkim":             "himalayan",
  "arunachalpradesh":  "northeast_india",
  "punjab":             "north_india",
  "haryana":            "north_india",
  "delhi":              "north_india",
  "uttarpradesh":      "north_india",
  "rajasthan":          "northwest_india",
  "gujarat":            "west_coast",
  "madhyapradesh":     "central_india",
  "chhattisgarh":       "central_india",
  "bihar":              "east_coast",
  "jharkhand":          "east_coast",
  "westbengal":        "east_coast",
  "odisha":             "east_coast",
  "assam":              "northeast_india",
  "meghalaya":          "northeast_india",
  "nagaland":           "northeast_india",
  "manipur":            "northeast_india",
  "tripura":            "northeast_india",
  "mizoram":            "northeast_india",
  "maharashtra":        "peninsular_india",
  "goa":                "west_coast",
  "telangana":          "peninsular_india",
  "andhrapradesh":     "east_coast",
  "karnataka":          "peninsular_india",
  "kerala":             "west_coast",
  "tamilnadu":         "peninsular_india",
  "andamanandnicobarislands": "east_coast",
  "lakshadweep":        "west_coast",
  "chandigarh":         "north_india",
  "dadraandnagarhavelianddamananddiu": "west_coast",
  "puducherry":         "peninsular_india",
};

const STATE_ABBRS = {
  "Andhra Pradesh": "A.P.",
  "Arunachal Pradesh": "AR. P.",
  "Assam": "Assam",
  "Bihar": "Bihar",
  "Chhattisgarh": "C.G.",
  "Goa": "Goa",
  "Gujarat": "Gujarat",
  "Haryana": "HR",
  "Himachal Pradesh": "H.P.",
  "Jammu and Kashmir": "J&K",
  "Jharkhand": "Jharkhand",
  "Karnataka": "Karnataka",
  "Kerala": "Kerala",
  "Ladakh": "Ladakh",
  "Madhya Pradesh": "M.P.",
  "Maharashtra": "Maharashtra",
  "Manipur": "Manipur",
  "Meghalaya": "Meghalaya",
  "Mizoram": "Mizoram",
  "Nagaland": "Nagaland",
  "Odisha": "Odisha",
  "Punjab": "PB",
  "Rajasthan": "Rajasthan",
  "Sikkim": "Sikkim",
  "Tamil Nadu": "T.N.",
  "Telangana": "Telangana",
  "Tripura": "Tripura",
  "Uttar Pradesh": "U.P.",
  "Uttarakhand": "U.K.",
  "West Bengal": "W.B.",
  "Delhi": "Delhi"
};

function normalizeName(str) {
  return (str || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
}

// =============================================================================
// RAINFALL COLOR SCALE & PERIOD NORMALIZATION
// =============================================================================
function rainfallColourDaily(mm) {
  if (mm <= 0)    return "#E8F4FE";
  if (mm < 2.5)   return "#BCE0FD";
  if (mm < 15.6)  return "#61A5C2";
  if (mm < 64.5)  return "#2A6F97";
  if (mm < 115.6) return "#D99B00";
  if (mm < 204.5) return "#B5730E";
  return "#9C2A2A";
}

function getPeriodMultiplier(period) {
  if (period === "weekly") return 6.8;
  if (period === "cumulative") return 38.0;
  return 1.0;
}

function getPeriodUnit(period) {
  if (period === "weekly") return "mm / 7-Day";
  if (period === "cumulative") return "mm / JJAS";
  return "mm / 24h";
}

function getPeriodName(period) {
  if (period === "weekly") return "Weekly Distribution";
  if (period === "cumulative") return "Cumulative (JJAS)";
  return "Daily (24h Accumulated)";
}

function getRainfallColour(mm, period) {
  const mult = getPeriodMultiplier(period);
  return rainfallColourDaily(mm / mult);
}

function getRainfallCategoryName(mm, period) {
  const mult = getPeriodMultiplier(period);
  const norm = mm / mult;
  if (norm <= 0)    return "No Rain";
  if (norm < 2.5)   return "Very Light Rain";
  if (norm < 15.6)  return "Light Rain";
  if (norm < 64.5)  return "Moderate Rain";
  if (norm < 115.6) return "Heavy Rain";
  if (norm < 204.5) return "Very Heavy Rain";
  return "Extremely Heavy Rain";
}

// =============================================================================
// TOAST NOTIFICATIONS & VISUAL FEEDBACK
// =============================================================================
function showToast(message, icon = "✓") {
  const toast = document.getElementById("pragyaToast");
  if (!toast) return;
  toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${message}</span>`;
  toast.classList.remove("toast-hide");
  toast.classList.add("toast-show");
  toast.style.display = "flex";
  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.classList.remove("toast-show");
    toast.classList.add("toast-hide");
    setTimeout(() => { toast.style.display = "none"; }, 280);
  }, 2600);
}

// =============================================================================
// SYNOPTIC LEAD-TIME ADJUSTMENT ENGINE (Authentic Meteorological Propagation)
// =============================================================================
function getLeadTimeDistrictAdjustment(scenarioId, leadTime, districtId, baseRaw, baseCorr) {
  if (scenarioId === "break_2020_central_india") {
    // Break spell: foothill convergence strengthens; peninsular convective suppression solidifies to 0
    const isFoothill = ["kamrup", "shimla", "dehradun", "patna", "gorakhpur"].includes(districtId);
    if (leadTime === "T+24") {
      return { raw: baseRaw, corr: baseCorr };
    } else if (leadTime === "T+48") {
      return {
        raw: isFoothill ? Math.round(baseRaw * 1.18 * 10) / 10 : Math.max(0.4, Math.round(baseRaw * 0.45 * 10) / 10),
        corr: isFoothill ? Math.round(baseCorr * 1.22 * 10) / 10 : Math.max(0.2, Math.round(baseCorr * 0.25 * 10) / 10)
      };
    } else { // T+72
      return {
        raw: isFoothill ? Math.round(baseRaw * 1.35 * 10) / 10 : Math.max(0.2, Math.round(baseRaw * 0.20 * 10) / 10),
        corr: isFoothill ? Math.round(baseCorr * 1.38 * 10) / 10 : 0.0
      };
    }
  } else if (scenarioId === "depression_2021_bay_of_bengal") {
    // Monsoon depression: moves from East Coast (Odisha/Bengal) inland to Chhattisgarh & MP
    const isCoast = ["balasore", "bhubaneswar", "midnapore"].includes(districtId);
    const isInterior = ["raipur", "jabalpur", "hoshangabad", "nagpur"].includes(districtId);
    if (leadTime === "T+24") {
      return { raw: baseRaw, corr: baseCorr };
    } else if (leadTime === "T+48") {
      return {
        raw: isCoast ? Math.round(baseRaw * 0.60 * 10) / 10 : (isInterior ? Math.round(baseRaw * 1.48 * 10) / 10 : Math.round(baseRaw * 1.12 * 10) / 10),
        corr: isCoast ? Math.round(baseCorr * 0.52 * 10) / 10 : (isInterior ? Math.round(baseCorr * 1.54 * 10) / 10 : Math.round(baseCorr * 1.10 * 10) / 10)
      };
    } else { // T+72
      return {
        raw: isCoast ? Math.round(baseRaw * 0.25 * 10) / 10 : (isInterior ? Math.round(baseRaw * 1.32 * 10) / 10 : Math.round(baseRaw * 1.25 * 10) / 10),
        corr: isCoast ? Math.round(baseCorr * 0.18 * 10) / 10 : (isInterior ? Math.round(baseCorr * 1.40 * 10) / 10 : Math.round(baseCorr * 1.18 * 10) / 10)
      };
    }
  } else {
    // Active Surge (Kerala 2018 Orographic Extreme)
    if (leadTime === "T+24") {
      return { raw: baseRaw, corr: baseCorr };
    } else if (leadTime === "T+48") {
      const isSpillover = ["palakkad", "thrissur", "ernakulam"].includes(districtId);
      return {
        raw: isSpillover ? Math.round(baseRaw * 1.55 * 10) / 10 : Math.round(baseRaw * 1.18 * 10) / 10,
        corr: isSpillover ? Math.round(baseCorr * 1.48 * 10) / 10 : Math.round(baseCorr * 1.15 * 10) / 10
      };
    } else { // T+72
      const isNorth = ["udupi", "kozhikode", "wayanad"].includes(districtId);
      return {
        raw: isNorth ? Math.round(baseRaw * 1.36 * 10) / 10 : Math.round(baseRaw * 0.85 * 10) / 10,
        corr: isNorth ? Math.round(baseCorr * 1.30 * 10) / 10 : Math.round(baseCorr * 0.80 * 10) / 10
      };
    }
  }
}

// =============================================================================
// DYNAMIC FORECAST COMPUTATION
// =============================================================================
function computeActiveForecastData(scenarioId, leadTime, period) {
  const base = SCENARIOS[scenarioId] || SCENARIOS.kerala_2018_orographic;
  const pMult = getPeriodMultiplier(period);

  // Lead dispersion & confidence degradation
  const spreadFactor = leadTime === "T+48" ? 1.42 : (leadTime === "T+72" ? 1.85 : 1.0);
  const confDelta = leadTime === "T+48" ? -0.09 : (leadTime === "T+72" ? -0.19 : 0.0);

  const scaledDistricts = base.districts.map(d => {
    const adj = getLeadTimeDistrictAdjustment(scenarioId, leadTime, d.district_id, d.raw_rainfall_mm, d.corrected_rainfall_mm);
    const rawVal = Math.round(adj.raw * pMult * 10) / 10;
    const corrVal = Math.round(adj.corr * pMult * 10) / 10;

    const baseSpread = Math.max((d.quantile_p90_mm - d.quantile_p10_mm) / 2, 3.0);
    const halfSpread = Math.max(baseSpread * pMult * spreadFactor, 2.0);
    const p10 = Math.max(0, Math.round((corrVal - halfSpread) * 10) / 10);
    const p90 = Math.round((corrVal + halfSpread) * 10) / 10;

    const conf = Math.max(0.48, Math.min(0.98, Math.round((d.confidence + confDelta) * 100) / 100));

    // Exceedance probabilities scaled by lead time dispersion
    const probDisp = leadTime === "T+48" ? 0.92 : (leadTime === "T+72" ? 0.82 : 1.0);
    const p_heavy = corrVal <= 0 ? 0.01 : Math.min(0.99, Math.round(d.p_heavy * probDisp * 100) / 100);
    const p_vheavy = corrVal <= 0 ? 0.0 : Math.min(0.98, Math.round(d.p_very_heavy * probDisp * 100) / 100);
    const p_xheavy = corrVal <= 0 ? 0.0 : Math.min(0.95, Math.round(d.p_extremely_heavy * probDisp * 100) / 100);

    return {
      ...d,
      raw_rainfall_mm: rawVal,
      corrected_rainfall_mm: corrVal,
      quantile_p10_mm: p10,
      quantile_p90_mm: p90,
      p_heavy: p_heavy,
      p_very_heavy: p_vheavy,
      p_extremely_heavy: p_xheavy,
      confidence: conf,
    };
  });

  const scaledBaselines = {};
  Object.keys(base.regional_baselines).forEach(k => {
    let regionalShift = 1.0;
    if (scenarioId === "break_2020_central_india") {
      if (["himalayan", "northeast_india", "north_india"].includes(k)) {
        regionalShift = leadTime === "T+48" ? 1.20 : (leadTime === "T+72" ? 1.35 : 1.0);
      } else {
        regionalShift = leadTime === "T+48" ? 0.40 : (leadTime === "T+72" ? 0.15 : 1.0);
      }
    } else if (scenarioId === "depression_2021_bay_of_bengal") {
      if (["central_india", "northwest_india"].includes(k)) {
        regionalShift = leadTime === "T+48" ? 1.45 : (leadTime === "T+72" ? 1.65 : 1.0);
      } else if (k === "east_coast") {
        regionalShift = leadTime === "T+48" ? 0.55 : (leadTime === "T+72" ? 0.22 : 1.0);
      }
    }
    scaledBaselines[k] = Math.round(base.regional_baselines[k] * regionalShift * pMult * 10) / 10;
  });

  const rmseData = (base.rmse_scores && base.rmse_scores[leadTime])
    ? base.rmse_scores[leadTime]
    : { raw: [12.1, 6.8, 18.7, 15.2, 12.7], corr: [5.1, 4.2, 5.5, 5.5, 5.0] };

  return {
    scenario_id: scenarioId,
    lead_time: leadTime,
    period: period,
    banner: base.banner,
    synoptic_evaluation: {
      ...base.synoptic_evaluation,
      confidence: Math.max(0.50, Math.round((base.synoptic_evaluation.confidence + confDelta) * 100) / 100)
    },
    grid_raster: base.grid_raster,
    districts: scaledDistricts,
    regional_baselines: scaledBaselines,
    rmse_scores: rmseData
  };
}

// Global active chart mode: 'qpf', 'trajectory', or 'probability'
let ACTIVE_CHART_MODE = "qpf";

// Global search query (empty = show all)
let ACTIVE_SEARCH_QUERY = "";

// =============================================================================
// SEARCH FILTER ENGINE (ROBUST, BIDIRECTIONAL, CROSS-VIEW & CROSS-SCENARIO)
// =============================================================================
function applySearchFilter(query, opts = {}) {
  ACTIVE_SEARCH_QUERY = (query || "").trim().toLowerCase();

  // Keep both search inputs in sync
  const topInput = document.getElementById("portalSearchInput");
  const tblInput = document.getElementById("districtTableSearchInput");
  if (topInput && topInput.value !== (query || "")) topInput.value = query || "";
  if (tblInput && tblInput.value !== (query || "")) tblInput.value = query || "";

  // Show / hide clear buttons
  const topClear = document.getElementById("portalSearchClearBtn");
  const tblClear = document.getElementById("districtTableSearchClearBtn");
  const resetBtn = document.getElementById("districtTableResetBtn");
  const hasQuery = Boolean(ACTIVE_SEARCH_QUERY);

  if (topClear) topClear.style.display = hasQuery ? "inline-block" : "none";
  if (tblClear) tblClear.style.display = hasQuery ? "inline-block" : "none";
  if (resetBtn) resetBtn.style.display = (hasQuery || SELECTED_STATE_FILTER) ? "inline-block" : "none";

  if (!CURRENT_CYCLE_DATA) return;

  const tbody = document.getElementById("districtTableBody");
  if (!tbody) return;

  const unit = getPeriodUnit(ACTIVE_PERIOD);

  // If user searched from another tab or pressed Enter, ensure view-outlook is active
  if (hasQuery && opts.switchToOutlook) {
    const outlookBtn = document.querySelector('.nav-btn[data-target="view-outlook"]');
    if (outlookBtn && !outlookBtn.classList.contains("active")) {
      outlookBtn.click();
    }
  }

  // Base pool of districts from current cycle
  let allDistricts = CURRENT_CYCLE_DATA.districts || [];
  let pool = allDistricts;

  // When a search query is active, search across ALL districts first!
  // If the query does not match inside a previously selected state filter,
  // automatically release that state filter so the user is never stuck with 0 results.
  if (hasQuery) {
    const q = ACTIVE_SEARCH_QUERY;
    const qNorm = q.replace(/[^a-z0-9]/g, "");

    const matchesQuery = (d) => {
      const dName = (d.district_name || "").toLowerCase();
      const sName = (d.state || "").toLowerCase();
      const rName = (d.regime || "").toLowerCase();
      const aName = (d.alert_level || "").toLowerCase();
      const tName = (d.terrain_type || "").toLowerCase();

      return dName.includes(q) ||
             sName.includes(q) ||
             rName.includes(q) ||
             aName.includes(q) ||
             tName.includes(q) ||
             dName.replace(/[^a-z0-9]/g, "").includes(qNorm) ||
             sName.replace(/[^a-z0-9]/g, "").includes(qNorm);
    };

    pool = allDistricts.filter(matchesQuery);

    // If no match in current cycle scenario, search other scenarios to assist user!
    if (pool.length === 0) {
      const otherScenarios = Object.keys(SCENARIOS).filter(k => k !== ACTIVE_SCENARIO_ID);
      let foundInOther = null;
      let otherDist = null;

      for (const scId of otherScenarios) {
        const match = (SCENARIOS[scId].districts || []).find(matchesQuery);
        if (match) {
          foundInOther = scId;
          otherDist = match;
          break;
        }
      }

      if (foundInOther) {
        const scName = SCENARIOS[foundInOther].name;
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align:center;padding:28px 16px;background:#f0f9ff;border:2px dashed #0284c7;border-radius:4px;">
              <div style="font-size:15px;font-weight:700;color:var(--gov-navy);margin-bottom:6px;">
                📍 "${escapeHtml(query)}" found in <em>${escapeHtml(scName)}</em>!
              </div>
              <div style="font-size:13px;color:var(--slate);margin-bottom:14px;">
                District: <strong>${escapeHtml(otherDist.district_name)}</strong> (${escapeHtml(otherDist.state)}) · Regime: <strong>${escapeHtml(otherDist.regime)}</strong>
              </div>
              <button class="btn btn-primary" onclick="switchScenarioAndSearch('${foundInOther}', '${escapeHtml(query)}')">
                Switch to ${escapeHtml(scName)} &amp; View District &rarr;
              </button>
              <button class="btn btn-sm" style="margin-left:8px;" onclick="clearSearch()">Clear Search</button>
            </td>
          </tr>`;
        updateBadges(0, "Found in other scenario");
        return;
      }
    }
  } else if (SELECTED_STATE_FILTER) {
    const stateNorm = normalizeName(SELECTED_STATE_FILTER);
    pool = pool.filter(d => normalizeName(d.state) === stateNorm);
  }

  // Update Result Badges
  const totalCount = allDistricts.length;
  updateBadges(pool.length, hasQuery ? `${pool.length} of ${totalCount} districts` : (SELECTED_STATE_FILTER ? `${pool.length} in ${SELECTED_STATE_FILTER}` : `All ${totalCount} districts`));

  // Render Table
  tbody.innerHTML = "";
  if (!pool.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center;padding:26px;color:var(--slate);">
          <strong>No districts found</strong> matching "<em>${escapeHtml(query)}</em>"
          <br><button class="btn btn-sm" style="margin-top:10px;" onclick="clearSearch()">Reset Filter</button>
        </td>
      </tr>`;
    return;
  }

  pool.forEach(dist => {
    const tr = document.createElement("tr");
    const regClass = REGIME_CLASS_MAP[dist.regime] || "active";
    const lvlClass = ALERT_CLASS_MAP[dist.alert_level] || "g";

    // Text highlighter
    const hl = (text) => {
      if (!ACTIVE_SEARCH_QUERY || !text) return text;
      const re = new RegExp(`(${escapeRegex(ACTIVE_SEARCH_QUERY)})`, "gi");
      return String(text).replace(re, `<mark style="background:#FFE566;border-radius:2px;padding:0 2px;font-weight:700;">$1</mark>`);
    };

    tr.innerHTML = `
      <td><strong>${hl(dist.district_name)}</strong></td>
      <td>${hl(dist.state)}</td>
      <td><span class="chip ${regClass}"><span class="dot"></span>${hl(dist.regime)}</span></td>
      <td class="num">${dist.raw_rainfall_mm} <span style="font-size:10px;color:var(--slate);">${unit}</span></td>
      <td class="num" style="font-weight: 700; color: var(--navy);">${dist.corrected_rainfall_mm} <span style="font-size:10px;">${unit}</span></td>
      <td class="num" style="color: var(--slate);">${dist.quantile_p10_mm} – ${dist.quantile_p90_mm}</td>
      <td class="num">${dist.p_very_heavy}</td>
      <td class="num">${dist.confidence}</td>
      <td><span class="lvl ${lvlClass}">${dist.alert_level}</span></td>
      <td>
        <button class="btn btn-sm" onclick="openDistrictDrawer('${dist.district_id}')">Details</button>
        <button class="btn btn-sm" onclick="openOverrideModal('${dist.district_id}')">Override</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Update District Bar Chart with filtered pool
  renderDistrictBarChart(pool, ACTIVE_PERIOD);

  // Scroll to table if explicitly requested (e.g. from top search enter/button)
  if (opts.scrollToTable) {
    const card = document.getElementById("districtTableCard");
    if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function updateBadges(count, labelText) {
  const topBadge = document.getElementById("searchResultCount");
  const tblBadge = document.getElementById("districtTableCountBadge");

  if (topBadge) {
    if (ACTIVE_SEARCH_QUERY) {
      topBadge.textContent = `${count} found`;
      topBadge.style.display = "inline-block";
    } else {
      topBadge.style.display = "none";
    }
  }
  if (tblBadge) {
    tblBadge.textContent = labelText || `${count} districts`;
  }
}

function switchScenarioAndSearch(scenarioId, query) {
  const select = document.getElementById("benchmarkSelect");
  if (select) select.value = scenarioId;
  ACTIVE_SCENARIO_ID = scenarioId;
  updateAllViews();
  setTimeout(() => {
    applySearchFilter(query, { scrollToTable: true, switchToOutlook: true });
  }, 100);
}

function clearSearch() {
  ACTIVE_SEARCH_QUERY = "";
  SELECTED_STATE_FILTER = null;

  const topInput = document.getElementById("portalSearchInput");
  const tblInput = document.getElementById("districtTableSearchInput");
  if (topInput) topInput.value = "";
  if (tblInput) tblInput.value = "";

  const topClear = document.getElementById("portalSearchClearBtn");
  const tblClear = document.getElementById("districtTableSearchClearBtn");
  const resetBtn = document.getElementById("districtTableResetBtn");
  if (topClear) topClear.style.display = "none";
  if (tblClear) tblClear.style.display = "none";
  if (resetBtn) resetBtn.style.display = "none";

  const topBadge = document.getElementById("searchResultCount");
  if (topBadge) topBadge.style.display = "none";

  // Deselect state on D3 map
  if (_d3MapSvg) {
    _d3MapSvg.selectAll("path.state-path")
      .classed("map-selected", false)
      .attr("stroke", "#335577")
      .attr("stroke-width", 0.75);
  }
  const tooltip = document.getElementById("mapTooltipLabel");
  if (tooltip) tooltip.textContent = "Hover a region · Click to filter table";

  // Re-render table and chart
  if (CURRENT_CYCLE_DATA) {
    renderDistrictTable(CURRENT_CYCLE_DATA.districts, ACTIVE_PERIOD);
    renderDistrictBarChart(CURRENT_CYCLE_DATA.districts, ACTIVE_PERIOD);
    const count = (CURRENT_CYCLE_DATA.districts || []).length;
    updateBadges(count, `Showing all ${count} districts`);
  }
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

function escapeRegex(str) {
  return (str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// =============================================================================
// SEARCH INITIALIZATION (WIRES BOTH TOP BAR AND IN-TABLE BAR)
// =============================================================================
function initSearch() {
  const topInput = document.getElementById("portalSearchInput");
  const topBtn   = document.getElementById("portalSearchBtn");
  const tblInput = document.getElementById("districtTableSearchInput");

  let _debounce = null;

  function handleInput(val, opts = {}) {
    clearTimeout(_debounce);
    _debounce = setTimeout(() => {
      applySearchFilter(val, opts);
    }, 150);
  }

  // 1. Top Portal Search Input
  if (topInput) {
    topInput.addEventListener("input", () => {
      handleInput(topInput.value, { switchToOutlook: true });
    });
    topInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        clearTimeout(_debounce);
        applySearchFilter(topInput.value, { switchToOutlook: true, scrollToTable: true });
      } else if (e.key === "Escape") {
        clearSearch();
      }
    });
  }

  if (topBtn) {
    topBtn.addEventListener("click", () => {
      clearTimeout(_debounce);
      applySearchFilter(topInput ? topInput.value : "", { switchToOutlook: true, scrollToTable: true });
    });
  }

  // 2. In-Table District Search Input
  if (tblInput) {
    tblInput.addEventListener("input", () => {
      handleInput(tblInput.value);
    });
    tblInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        clearTimeout(_debounce);
        applySearchFilter(tblInput.value);
      } else if (e.key === "Escape") {
        clearSearch();
      }
    });
  }
}

// =============================================================================
// NAVIGATION & CONTROLS
// =============================================================================
function initNavigation() {
  const navButtons = document.querySelectorAll(".nav-btn");
  const sideLinks = document.querySelectorAll(".side-link");
  const views = document.querySelectorAll(".view-section");
  const breadcrumb = document.getElementById("activeBreadcrumb");
  const themeToggle = document.getElementById("themeToggleBtn");

  function switchView(targetId, titleText) {
    navButtons.forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-target") === targetId);
    });
    sideLinks.forEach(l => {
      const parent = l.closest(".sidebar-item");
      if (parent) {
        parent.classList.toggle("active", l.getAttribute("data-target") === targetId);
      }
    });
    views.forEach(v => {
      v.classList.toggle("active", v.id === targetId);
    });

    if (breadcrumb && titleText) {
      breadcrumb.textContent = titleText;
    }

    if (targetId === "view-bulletin") {
      loadBulletinAndCap();
    } else if (targetId === "view-feedback") {
      loadOverrides();
    }
  }

  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      switchView(targetId, btn.textContent.trim());
    });
  });

  sideLinks.forEach(link => {
    link.addEventListener("click", () => {
      const targetId = link.getAttribute("data-target");
      switchView(targetId, link.textContent.replace("▪", "").trim());
    });
  });

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      if (isDark) {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
      }
    });
  }
}

function initLeadTimeSelector() {
  const leadButtons = document.querySelectorAll(".btn-lead");
  leadButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      leadButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      btn.classList.add("btn-pulse");
      setTimeout(() => btn.classList.remove("btn-pulse"), 450);

      ACTIVE_LEAD_TIME = btn.getAttribute("data-lead");
      const dates = { "T+24": "21 Sep 2026", "T+48": "22 Sep 2026", "T+72": "23 Sep 2026" };
      showToast(`Lead Time: ${ACTIVE_LEAD_TIME} (${dates[ACTIVE_LEAD_TIME] || ""}, 00:00 UTC) · Ensemble Spread Updated`, "⏱️");
      updateAllViews();
    });
  });
}

function initPeriodSelector() {
  const radios = document.querySelectorAll('input[name="rf_period"]');
  radios.forEach(radio => {
    radio.addEventListener("change", function() {
      if (this.checked) {
        ACTIVE_PERIOD = this.value;
        const pName = getPeriodName(ACTIVE_PERIOD);
        const unit = getPeriodUnit(ACTIVE_PERIOD);
        showToast(`Accumulation Window: ${pName} (${unit})`, "📅");
        updateAllViews();
      }
    });
  });
}

function initScenarioSelector() {
  const btn = document.getElementById("btnLoadScenario");
  const select = document.getElementById("benchmarkSelect");

  if (btn && select) {
    btn.addEventListener("click", () => {
      ACTIVE_SCENARIO_ID = select.value;
      const title = select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : "Active Scenario";
      btn.classList.add("btn-pulse");
      btn.innerHTML = "✓ Applied!";
      setTimeout(() => {
        btn.innerHTML = "Apply";
        btn.classList.remove("btn-pulse");
      }, 1200);

      showToast(`Scenario Activated: ${title} · ${ACTIVE_LEAD_TIME} · ${getPeriodUnit(ACTIVE_PERIOD)}`, "⚡");

      // Flash highlight on banner
      const banner = document.getElementById("alertBanner");
      if (banner) {
        banner.classList.add("highlight-flash");
        setTimeout(() => banner.classList.remove("highlight-flash"), 750);
      }

      updateAllViews();
    });
  }

  if (select) {
    select.addEventListener("change", () => {
      ACTIVE_SCENARIO_ID = select.value;
      const title = select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : "Active Scenario";
      showToast(`Scenario Selected: ${title} · Click 'Apply' to commit`, "📋");
      updateAllViews();
    });
  }
}

function initChartModeSelector() {
  const modeButtons = document.querySelectorAll(".btn-chart-mode");
  modeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      modeButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      ACTIVE_CHART_MODE = btn.getAttribute("data-chartmode");
      if (CURRENT_CYCLE_DATA) {
        renderDistrictBarChart(CURRENT_CYCLE_DATA.districts, ACTIVE_PERIOD);
      }
    });
  });
}

// =============================================================================
// UNIFIED ORCHESTRATION: UPDATE ALL VIEWS
// =============================================================================
function updateAllViews() {
  const data = computeActiveForecastData(ACTIVE_SCENARIO_ID, ACTIVE_LEAD_TIME, ACTIVE_PERIOD);
  CURRENT_CYCLE_DATA = data;

  // 1. Sync dropdown selection if out of sync
  const select = document.getElementById("benchmarkSelect");
  if (select && select.value !== ACTIVE_SCENARIO_ID) {
    select.value = ACTIVE_SCENARIO_ID;
  }

  // 2. Update Cycle Timestamp in top bar & header
  updateTimestampUI(ACTIVE_LEAD_TIME, ACTIVE_PERIOD);

  // 3. Render Alert Banner
  renderAlertBanner(data);

  // 4. Render 12x4 Regime Grid
  renderRegimeGrid(data.grid_raster);

  // 5. Render District Outlook Table
  renderDistrictTable(data.districts, ACTIVE_PERIOD);

  // 6. Render District QPF Bar Chart
  renderDistrictBarChart(data.districts, ACTIVE_PERIOD);

  // 7. Render Regime RMSE Scorecard Chart
  renderRegimeRmseChart(data.rmse_scores, ACTIVE_LEAD_TIME);

  // 8. Render / Re-colour India GIS Map
  renderD3IndiaMap(data.districts, data.regional_baselines, ACTIVE_PERIOD);

  // 9. Update Map Legend Text & Sidebar Intensity Scale
  updateMapLegendUI(ACTIVE_PERIOD);
  updateSidebarScaleUI(ACTIVE_PERIOD);
}

function updateTimestampUI(leadTime, period) {
  const tsEl = document.getElementById("cycleTimestamp");
  const topClock = document.getElementById("topClock");
  const unitStr = getPeriodUnit(period);

  const dates = { "T+24": "21 Sep 2026", "T+48": "22 Sep 2026", "T+72": "23 Sep 2026" };
  const dateStr = dates[leadTime] || "21 Sep 2026";

  if (tsEl) {
    tsEl.textContent = `Operational Cycle · ${dateStr}, 00:00 UTC (${leadTime} Lead) · ${unitStr}`;
  }
  if (topClock) {
    topClock.textContent = `${dateStr} 00:00 UTC · ${leadTime}`;
  }
}

function renderAlertBanner(data) {
  const bannerEl = document.getElementById("alertBanner");
  const bannerLevelEl = document.getElementById("bannerLevel");
  const bannerTextEl = document.getElementById("bannerText");
  const synopticRegimeEl = document.getElementById("synopticRegimeName");
  const synopticChipEl = document.getElementById("synopticChip");

  if (bannerEl && data.banner) {
    bannerLevelEl.textContent = data.banner.level;
    bannerTextEl.textContent = data.banner.text;
    
    bannerEl.className = "mock-banner";
    if (data.banner.level === "Red") bannerEl.classList.add("banner-red", "red-alert");
    else if (data.banner.level === "Green") bannerEl.classList.add("banner-green");
  }

  if (data.synoptic_evaluation) {
    const synReg = data.synoptic_evaluation.primary_synoptic;
    synopticRegimeEl.textContent = `${synReg} Monsoon`;
    synopticChipEl.className = `chip ${REGIME_CLASS_MAP[synReg] || "active"}`;
  }
}

function renderRegimeGrid(grid) {
  const gridEl = document.getElementById("regimeGrid");
  if (!gridEl || !grid) return;

  gridEl.innerHTML = "";
  const colorMap = {
    "Active": "#1B6E8C",
    "Break": "#B5730E",
    "Low / Depression": "#9C2A2A",
    "Orographic": "#2E6B3E",
    "Coastal-Convective": "#5B4B8A",
    "Western Disturbance": "#0B2C4D",
  };

  grid.forEach(row => {
    row.forEach(regimeVal => {
      const cell = document.createElement("div");
      const regClass = REGIME_CLASS_MAP[regimeVal] || "active";
      cell.className = `grid-cell ${regClass}-regime`;
      cell.style.background = colorMap[regimeVal] || "#1B6E8C";
      cell.title = `Subdivision Regime: ${regimeVal}`;
      cell.textContent = regimeVal.substring(0, 3);
      gridEl.appendChild(cell);
    });
  });
}

function renderDistrictTable(districts, period) {
  const tbody = document.getElementById("districtTableBody");
  if (!tbody || !districts) return;

  const unit = getPeriodUnit(period);
  let displayDistricts = districts;

  if (SELECTED_STATE_FILTER) {
    const norm = normalizeName(SELECTED_STATE_FILTER);
    displayDistricts = districts.filter(d => normalizeName(d.state) === norm);
  }

  // Ensure district table badge is updated immediately
  const countText = SELECTED_STATE_FILTER 
    ? `${displayDistricts.length} in ${SELECTED_STATE_FILTER}` 
    : `Showing all ${displayDistricts.length} districts`;
  updateBadges(displayDistricts.length, countText);

  tbody.innerHTML = "";

  if (!displayDistricts.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center;padding:24px;color:var(--slate);">
          <strong>${SELECTED_STATE_FILTER || "Filtered View"}</strong>: No specific station warnings flagged for this cycle.
          <br><button class="btn btn-sm" style="margin-top:8px;" onclick="resetStateFilter()">Show All Districts</button>
        </td>
      </tr>`;
    return;
  }

  displayDistricts.forEach(dist => {
    const tr = document.createElement("tr");
    const regClass = REGIME_CLASS_MAP[dist.regime] || "active";
    const lvlClass = ALERT_CLASS_MAP[dist.alert_level] || "g";

    tr.innerHTML = `
      <td><strong>${dist.district_name}</strong></td>
      <td>${dist.state}</td>
      <td><span class="chip ${regClass}"><span class="dot"></span>${dist.regime}</span></td>
      <td class="num">${dist.raw_rainfall_mm} <span style="font-size:10px;color:var(--slate);">${unit}</span></td>
      <td class="num" style="font-weight: 700; color: var(--navy);">${dist.corrected_rainfall_mm} <span style="font-size:10px;">${unit}</span></td>
      <td class="num" style="color: var(--slate);">${dist.quantile_p10_mm} – ${dist.quantile_p90_mm}</td>
      <td class="num">${dist.p_very_heavy}</td>
      <td class="num">${dist.confidence}</td>
      <td><span class="lvl ${lvlClass}">${dist.alert_level}</span></td>
      <td>
        <button class="btn btn-sm" onclick="openDistrictDrawer('${dist.district_id}')">Details</button>
        <button class="btn btn-sm" onclick="openOverrideModal('${dist.district_id}')">Override</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateMapLegendUI(period) {
  const titleEl = document.getElementById("mapLegendTitle");
  const leg1 = document.getElementById("leg1");
  const leg2 = document.getElementById("leg2");
  const leg3 = document.getElementById("leg3");
  const leg4 = document.getElementById("leg4");
  const leg5 = document.getElementById("leg5");
  const leg6 = document.getElementById("leg6");

  if (!titleEl) return;

  if (period === "weekly") {
    titleEl.textContent = "Rainfall (mm / 7-Day)";
    if (leg1) leg1.textContent = "Very Light (<15)";
    if (leg2) leg2.textContent = "Light (15–100)";
    if (leg3) leg3.textContent = "Moderate (100–440)";
    if (leg4) leg4.textContent = "Heavy (440–780)";
    if (leg5) leg5.textContent = "Very Heavy (780–1400)";
    if (leg6) leg6.textContent = "Extreme (≥1400)";
  } else if (period === "cumulative") {
    titleEl.textContent = "Seasonal (mm / JJAS)";
    if (leg1) leg1.textContent = "Very Light (<100)";
    if (leg2) leg2.textContent = "Light (100–590)";
    if (leg3) leg3.textContent = "Moderate (590–2450)";
    if (leg4) leg4.textContent = "Heavy (2450–4390)";
    if (leg5) leg5.textContent = "Very Heavy (4390–7770)";
    if (leg6) leg6.textContent = "Extreme (≥7770)";
  } else {
    titleEl.textContent = "Rainfall (mm / 24h)";
    if (leg1) leg1.textContent = "Very Light (<2.5)";
    if (leg2) leg2.textContent = "Light (2.5–15)";
    if (leg3) leg3.textContent = "Moderate (15–64)";
    if (leg4) leg4.textContent = "Heavy (64–115)";
    if (leg5) leg5.textContent = "Very Heavy (115–204)";
    if (leg6) leg6.textContent = "Extreme (≥204)";
  }
}

function updateSidebarScaleUI(period) {
  const headerEl = document.getElementById("sidebarScaleHeader");
  const th1 = document.getElementById("th1");
  const th2 = document.getElementById("th2");
  const th3 = document.getElementById("th3");
  const th4 = document.getElementById("th4");
  const th5 = document.getElementById("th5");
  const th6 = document.getElementById("th6");

  if (!headerEl) return;

  if (period === "weekly") {
    headerEl.textContent = "Rainfall Scale (mm / 7-Day)";
    if (th1) th1.innerHTML = "<strong>Very Light:</strong> 0.1 – 15.0 mm";
    if (th2) th2.innerHTML = "<strong>Light Rain:</strong> 15.1 – 100.0 mm";
    if (th3) th3.innerHTML = "<strong>Moderate:</strong> 100.1 – 440.0 mm";
    if (th4) th4.innerHTML = "<strong>Heavy Rain:</strong> 440.1 – 780.0 mm";
    if (th5) th5.innerHTML = "<strong>Very Heavy:</strong> 780.1 – 1400.0 mm";
    if (th6) th6.innerHTML = "<strong>Extremely Heavy:</strong> &ge; 1400.0 mm";
  } else if (period === "cumulative") {
    headerEl.textContent = "Rainfall Scale (mm / JJAS)";
    if (th1) th1.innerHTML = "<strong>Very Light:</strong> 0.1 – 100.0 mm";
    if (th2) th2.innerHTML = "<strong>Light Rain:</strong> 100.1 – 590.0 mm";
    if (th3) th3.innerHTML = "<strong>Moderate:</strong> 590.1 – 2450.0 mm";
    if (th4) th4.innerHTML = "<strong>Heavy Rain:</strong> 2450.1 – 4390.0 mm";
    if (th5) th5.innerHTML = "<strong>Very Heavy:</strong> 4390.1 – 7770.0 mm";
    if (th6) th6.innerHTML = "<strong>Extremely Heavy:</strong> &ge; 7770.0 mm";
  } else {
    headerEl.textContent = "Rainfall Intensity Scale (mm/24h)";
    if (th1) th1.innerHTML = "<strong>Very Light:</strong> 0.1 – 2.4 mm";
    if (th2) th2.innerHTML = "<strong>Light Rain:</strong> 2.5 – 15.5 mm";
    if (th3) th3.innerHTML = "<strong>Moderate:</strong> 15.6 – 64.4 mm";
    if (th4) th4.innerHTML = "<strong>Heavy Rain:</strong> 64.5 – 115.5 mm";
    if (th5) th5.innerHTML = "<strong>Very Heavy:</strong> 115.6 – 204.4 mm";
    if (th6) th6.innerHTML = "<strong>Extremely Heavy:</strong> &ge; 204.5 mm";
  }
}

// =============================================================================
// D3.js INDIA MAP RENDERER
// =============================================================================

function getStateRainfall(stateName, districts, regionalBaselines) {
  const norm = normalizeName(stateName);
  const matchingDistricts = (districts || []).filter(d => normalizeName(d.state) === norm);
  if (matchingDistricts.length > 0) {
    const total = matchingDistricts.reduce((s, d) => s + parseFloat(d.corrected_rainfall_mm || 0), 0);
    return total / matchingDistricts.length;
  }
  const regKey = STATE_TO_REGION[norm] || "central_india";
  const baselines = regionalBaselines || SCENARIOS.kerala_2018_orographic.regional_baselines;
  return baselines[regKey] || 35.0;
}

function renderD3IndiaMap(districts, regionalBaselines, period) {
  const container = document.getElementById("indiaMapContainer");
  if (!container) return;

  const loading = document.getElementById("indiaMapLoading");

  // Strategy 1: Instant Standalone SVG Rendering (Zero External Dependencies, Instant)
  if (window.INDIA_SVG_STATES && window.INDIA_SVG_STATES.length > 0) {
    if (loading) loading.style.display = "none";

    let svg = container.querySelector("svg#indiaMapSvg");
    if (!svg) {
      container.innerHTML = "";
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("id", "indiaMapSvg");
      svg.setAttribute("viewBox", "0 0 500 560");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "520");
      svg.style.display = "block";
      svg.style.borderRadius = "4px";

      const gStates = document.createElementNS("http://www.w3.org/2000/svg", "g");
      gStates.setAttribute("class", "states-group");

      window.INDIA_SVG_STATES.forEach(st => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "state-path");
        path.setAttribute("data-state", st.name);
        path.setAttribute("d", st.d);
        path.setAttribute("stroke", "#335577");
        path.setAttribute("stroke-width", "0.75");
        path.style.cursor = "pointer";
        path.style.transition = "fill 0.25s ease, stroke 0.15s ease";

        path.addEventListener("mouseover", () => {
          path.setAttribute("stroke", "#FFB703");
          path.setAttribute("stroke-width", "2.5");
          const mm = getStateRainfall(st.name, CURRENT_CYCLE_DATA ? CURRENT_CYCLE_DATA.districts : districts, regionalBaselines);
          const cat = getRainfallCategoryName(mm, ACTIVE_PERIOD);
          const unit = getPeriodUnit(ACTIVE_PERIOD);
          const tooltip = document.getElementById("mapTooltipLabel");
          if (tooltip) {
            tooltip.innerHTML = `<strong>${st.name}</strong>: ${mm.toFixed(1)} ${unit} (${cat}) · <em>Click to filter</em>`;
          }
        });

        path.addEventListener("mouseout", () => {
          if (SELECTED_STATE_FILTER !== st.name) {
            path.setAttribute("stroke", "#335577");
            path.setAttribute("stroke-width", "0.75");
          }
          const tooltip = document.getElementById("mapTooltipLabel");
          if (tooltip) {
            tooltip.textContent = SELECTED_STATE_FILTER
              ? `Filter active: ${SELECTED_STATE_FILTER} · Click state again to reset`
              : "Hover a region · Click to filter table";
          }
        });

        path.addEventListener("click", () => {
          const wasSel = SELECTED_STATE_FILTER === st.name;
          svg.querySelectorAll("path.state-path").forEach(p => {
            p.setAttribute("stroke", "#335577");
            p.setAttribute("stroke-width", "0.75");
          });

          if (!wasSel) {
            path.setAttribute("stroke", "#D90429");
            path.setAttribute("stroke-width", "3.0");
            SELECTED_STATE_FILTER = st.name;
            if (CURRENT_CYCLE_DATA) {
              renderDistrictTable(CURRENT_CYCLE_DATA.districts, ACTIVE_PERIOD);
              renderDistrictBarChart(CURRENT_CYCLE_DATA.districts, ACTIVE_PERIOD);
            }
            const tooltip = document.getElementById("mapTooltipLabel");
            if (tooltip) tooltip.innerHTML = `Showing: <strong>${st.name}</strong> (Click state again to reset)`;
            showToast(`Filtered Outlook to ${st.name}`, "🔍");
          } else {
            resetStateFilter();
          }
        });

        gStates.appendChild(path);
      });
      svg.appendChild(gStates);

      // State Labels
      const gLabels = document.createElementNS("http://www.w3.org/2000/svg", "g");
      gLabels.setAttribute("class", "labels-group");
      window.INDIA_SVG_STATES.forEach(st => {
        if (!st.centroid) return;
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", st.centroid[0]);
        text.setAttribute("y", st.centroid[1]);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "central");
        text.setAttribute("fill", "#051A2E");
        text.setAttribute("font-size", "7.5px");
        text.setAttribute("font-weight", "700");
        text.setAttribute("font-family", "var(--font-head, sans-serif)");
        text.style.pointerEvents = "none";
        text.style.userSelect = "none";
        text.textContent = STATE_ABBRS[st.name] || st.name;
        gLabels.appendChild(text);
      });
      svg.appendChild(gLabels);

      container.appendChild(svg);
      _d3MapSvg = svg;
    }

    // Update state fills
    svg.querySelectorAll("path.state-path").forEach(p => {
      const stName = p.getAttribute("data-state");
      const mm = getStateRainfall(stName, districts, regionalBaselines);
      const color = getRainfallColour(mm, period);
      p.setAttribute("fill", color);
      p.style.fill = color;
    });
    return;
  }

  // Strategy 2: D3 + TopoJSON fallback
  if (_d3MapSvg && _d3MapSvg.selectAll) {
    _d3MapSvg.selectAll("path.state-path")
      .transition()
      .duration(450)
      .attr("fill", d => {
        const mm = getStateRainfall(d.properties.st_nm, districts, regionalBaselines);
        return getRainfallColour(mm, period);
      });
    return;
  }

  if (loading) loading.style.display = "flex";

  const fetchTopo = () => {
    if (typeof window.INDIA_TOPO_DATA !== "undefined" && window.INDIA_TOPO_DATA) {
      return Promise.resolve(window.INDIA_TOPO_DATA);
    }
    if (typeof d3 !== "undefined" && d3.json) {
      return d3.json("india.json").catch(() => {
        return d3.json("https://cdn.jsdelivr.net/gh/udit-001/india-maps-data@2884453/topojson/india.json");
      });
    }
    return Promise.reject(new Error("Map geometry unavailable"));
  };

  fetchTopo().then(topoData => {
    if (loading) loading.style.display = "none";

    let stateFeatures;
    if (typeof topojson !== "undefined" && topoData.objects && topoData.objects.states) {
      stateFeatures = topojson.feature(topoData, topoData.objects.states).features;
    } else if (topoData.features) {
      stateFeatures = topoData.features;
    } else {
      throw new Error("TopoJSON states structure not found");
    }

    // Exclude Andaman and Nicobar Islands
    stateFeatures = stateFeatures.filter(f => !/andaman/i.test(f.properties.st_nm));

    _d3GeoData = { type: "FeatureCollection", features: stateFeatures };

    container.querySelectorAll("svg").forEach(s => s.remove());

    const W = container.clientWidth || 450;
    const H = Math.max(container.clientHeight || 520, 520);

    const svg = d3.select(container)
      .append("svg")
      .attr("id", "indiaMapSvg")
      .attr("width", "100%")
      .attr("height", H)
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("display", "block");

    _d3MapSvg = svg;

    const projection = d3.geoMercator()
      .fitExtent([[16, 16], [W - 16, H - 16]], _d3GeoData);

    const pathGen = d3.geoPath().projection(projection);
    const tooltip = document.getElementById("mapTooltipLabel");

    const gStates = svg.append("g").attr("class", "states-group");

    gStates.selectAll("path.state-path")
      .data(_d3GeoData.features)
      .enter()
      .append("path")
      .attr("class", "state-path")
      .attr("d", pathGen)
      .attr("fill", d => {
        const mm = getStateRainfall(d.properties.st_nm, districts, regionalBaselines);
        return getRainfallColour(mm, period);
      })
      .style("fill", d => {
        const mm = getStateRainfall(d.properties.st_nm, districts, regionalBaselines);
        return getRainfallColour(mm, period);
      })
      .attr("stroke", "#335577")
      .attr("stroke-width", 0.75)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("stroke", "#FFB703")
          .attr("stroke-width", 2.2)
          .raise();
        const mm = getStateRainfall(d.properties.st_nm, CURRENT_CYCLE_DATA.districts, CURRENT_CYCLE_DATA.regional_baselines);
        const cat = getRainfallCategoryName(mm, ACTIVE_PERIOD);
        const unit = getPeriodUnit(ACTIVE_PERIOD);
        if (tooltip) {
          tooltip.innerHTML = `<strong>${d.properties.st_nm}</strong>: ${mm.toFixed(1)} ${unit} (${cat}) · <em>Click to filter</em>`;
        }
      })
      .on("mouseout", function(event, d) {
        if (SELECTED_STATE_FILTER !== d.properties.st_nm) {
          d3.select(this).attr("stroke", "#335577").attr("stroke-width", 0.75);
        }
        if (tooltip) {
          tooltip.textContent = SELECTED_STATE_FILTER
            ? `Filter active: ${SELECTED_STATE_FILTER} · Click state again to reset`
            : "Hover a region · Click to filter table";
        }
      })
      .on("click", function(event, d) {
        const stateName = d.properties.st_nm;
        const wasSel = SELECTED_STATE_FILTER === stateName;

        svg.selectAll("path.state-path")
          .classed("map-selected", false)
          .attr("stroke", "#335577")
          .attr("stroke-width", 0.75);

        if (!wasSel) {
          d3.select(this)
            .classed("map-selected", true)
            .attr("stroke", "#D90429")
            .attr("stroke-width", 2.5)
            .raise();
          SELECTED_STATE_FILTER = stateName;
          if (CURRENT_CYCLE_DATA) {
            renderDistrictTable(CURRENT_CYCLE_DATA.districts, ACTIVE_PERIOD);
            renderDistrictBarChart(CURRENT_CYCLE_DATA.districts, ACTIVE_PERIOD);
          }
          if (tooltip) tooltip.innerHTML = `Showing: <strong>${stateName}</strong> (Click state again to reset)`;
          showToast(`Filtered Outlook to ${stateName}`, "🔍");
        } else {
          resetStateFilter();
        }
      });

    const gLabels = svg.append("g").attr("class", "labels-group");
    gLabels.selectAll("text.state-label")
      .data(_d3GeoData.features)
      .enter()
      .append("text")
      .attr("class", "state-label")
      .attr("transform", d => `translate(${pathGen.centroid(d)[0]},${pathGen.centroid(d)[1]})`)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .style("font-family", "var(--font-head, 'Archivo', sans-serif)")
      .style("font-size", "7.5px")
      .style("font-weight", "700")
      .style("fill", "#051A2E")
      .style("pointer-events", "none")
      .text(d => STATE_ABBRS[d.properties.st_nm] || d.properties.st_nm);

  }).catch(err => {
    console.error("India map loading error:", err);
  });
}

window.resetStateFilter = function() {
  SELECTED_STATE_FILTER = null;
  const svg = document.getElementById("indiaMapSvg");
  if (svg) {
    svg.querySelectorAll("path.state-path").forEach(p => {
      p.setAttribute("stroke", "#335577");
      p.setAttribute("stroke-width", "0.75");
    });
  }
  const tooltip = document.getElementById("mapTooltipLabel");
  if (tooltip) tooltip.textContent = "Hover a region · Click to filter table";
  if (CURRENT_CYCLE_DATA) {
    renderDistrictTable(CURRENT_CYCLE_DATA.districts, ACTIVE_PERIOD);
    renderDistrictBarChart(CURRENT_CYCLE_DATA.districts, ACTIVE_PERIOD);
  }
};

// =============================================================================
// CHART.JS & NATIVE CANVAS DYNAMIC CHARTS
// =============================================================================
function renderDistrictBarChart(districts, period) {
  if (!districts || !districts.length) return;
  const canvas = document.getElementById("districtBarChart");
  if (!canvas) return;

  const unit = getPeriodUnit(period);
  const pMult = getPeriodMultiplier(period);

  let sample = districts;
  if (SELECTED_STATE_FILTER) {
    const filtered = districts.filter(d => normalizeName(d.state) === normalizeName(SELECTED_STATE_FILTER));
    if (filtered.length > 0) sample = filtered;
  }
  sample = sample.slice(0, 9);
  const labels = sample.map(d => d.district_name);

  const mainTitleEl = document.getElementById("chartMainTitle");
  const subEl = document.getElementById("chartSubTitle");

  // Fallback: Native HTML5 Canvas bar rendering if Chart.js is unavailable
  if (typeof Chart === "undefined") {
    renderNativeCanvasBarChart(canvas, sample, period, unit);
    return;
  }

  let datasets = [];
  let yAxisConfig = {
    title: { display: true, text: `Rainfall (${unit})`, font: { family: "'IBM Plex Mono', monospace", size: 10 }, color: "#6b7280" },
    ticks: { font: { family: "'IBM Plex Mono', monospace", size: 10 }, color: "#6b7280" },
    grid: { color: "#e5e7eb" },
    beginAtZero: true,
  };

  if (ACTIVE_CHART_MODE === "trajectory") {
    if (mainTitleEl) mainTitleEl.innerHTML = "<strong>LEAD TRAJECTORY &mdash; T+24 &rarr; T+48 &rarr; T+72 Progression</strong>";
    if (subEl) subEl.textContent = `${unit} per district`;

    datasets = [
      {
        label: "T+24 (Day 1)",
        data: sample.map(d => Math.round((getLeadTimeDistrictAdjustment(ACTIVE_SCENARIO_ID, "T+24", d.district_id, d.raw_rainfall_mm, d.corrected_rainfall_mm).corr * pMult) * 10) / 10),
        backgroundColor: "rgba(42, 111, 151, 0.75)",
        borderColor: "#2A6F97",
        borderWidth: 1.5,
        borderRadius: 3,
      },
      {
        label: "T+48 (Day 2)",
        data: sample.map(d => Math.round((getLeadTimeDistrictAdjustment(ACTIVE_SCENARIO_ID, "T+48", d.district_id, d.raw_rainfall_mm, d.corrected_rainfall_mm).corr * pMult) * 10) / 10),
        backgroundColor: "rgba(217, 155, 0, 0.75)",
        borderColor: "#D99B00",
        borderWidth: 1.5,
        borderRadius: 3,
      },
      {
        label: "T+72 (Day 3)",
        data: sample.map(d => Math.round((getLeadTimeDistrictAdjustment(ACTIVE_SCENARIO_ID, "T+72", d.district_id, d.raw_rainfall_mm, d.corrected_rainfall_mm).corr * pMult) * 10) / 10),
        backgroundColor: "rgba(156, 42, 42, 0.75)",
        borderColor: "#9C2A2A",
        borderWidth: 1.5,
        borderRadius: 3,
      }
    ];
  } else if (ACTIVE_CHART_MODE === "probability") {
    if (mainTitleEl) mainTitleEl.innerHTML = "<strong>EXCEEDANCE PROBABILITIES &mdash; Categorical Risk</strong>";
    if (subEl) subEl.textContent = "Probability (%) per district";

    yAxisConfig.title.text = "Probability (%)";
    yAxisConfig.max = 100;
    datasets = [
      {
        label: "P(Heavy ≥ 64.5mm)",
        data: sample.map(d => Math.round(d.p_heavy * 100)),
        backgroundColor: "rgba(217, 155, 0, 0.75)",
        borderColor: "#D99B00",
        borderWidth: 1.5,
        borderRadius: 3,
      },
      {
        label: "P(Very Heavy ≥ 115.5mm)",
        data: sample.map(d => Math.round(d.p_very_heavy * 100)),
        backgroundColor: "rgba(181, 115, 14, 0.80)",
        borderColor: "#B5730E",
        borderWidth: 1.5,
        borderRadius: 3,
      },
      {
        label: "P(Extreme ≥ 204.5mm)",
        data: sample.map(d => Math.round(d.p_extremely_heavy * 100)),
        backgroundColor: "rgba(156, 42, 42, 0.85)",
        borderColor: "#9C2A2A",
        borderWidth: 1.5,
        borderRadius: 3,
      }
    ];
  } else {
    if (mainTitleEl) mainTitleEl.innerHTML = "<strong>QPF FORECAST &mdash; Raw vs AI Corrected</strong>";
    if (subEl) subEl.textContent = `${unit} · ${ACTIVE_LEAD_TIME} Lead`;

    datasets = [
      {
        label: "Raw NWP",
        data: sample.map(d => parseFloat(d.raw_rainfall_mm) || 0),
        backgroundColor: "rgba(180,115,14,0.55)",
        borderColor: "#B5730E",
        borderWidth: 1.5,
        borderRadius: 3,
      },
      {
        label: `AI Corrected (PRAGYA · ${ACTIVE_LEAD_TIME})`,
        data: sample.map(d => parseFloat(d.corrected_rainfall_mm) || 0),
        backgroundColor: "rgba(27,110,140,0.80)",
        borderColor: "#1B6E8C",
        borderWidth: 1.5,
        borderRadius: 3,
      },
    ];
  }

  if (_barChart) {
    _barChart.data.labels = labels;
    _barChart.data.datasets = datasets;
    _barChart.options.scales.y = yAxisConfig;
    _barChart.update();
    return;
  }

  _barChart = new Chart(canvas, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: {
          position: "top",
          labels: { font: { family: "'Source Sans 3', sans-serif", size: 11 }, boxWidth: 12, padding: 10 }
        }
      },
      scales: {
        x: { ticks: { font: { family: "'Source Sans 3', sans-serif", size: 10 } }, grid: { display: false } },
        y: yAxisConfig,
      }
    }
  });
}

function renderNativeCanvasBarChart(canvas, sample, period, unit) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.parentElement.clientWidth || 500;
  const h = 400;
  canvas.width = w;
  canvas.height = h;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const padLeft = 50, padRight = 20, padTop = 40, padBottom = 60;
  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  const maxVal = Math.max(...sample.map(d => Math.max(parseFloat(d.raw_rainfall_mm)||0, parseFloat(d.corrected_rainfall_mm)||0)), 10) * 1.15;

  // Grid lines
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#64748b";
  ctx.font = "10px monospace";
  for (let i = 0; i <= 5; i++) {
    const yVal = Math.round((maxVal / 5) * i);
    const yPos = padTop + chartH - (i / 5) * chartH;
    ctx.beginPath();
    ctx.moveTo(padLeft, yPos);
    ctx.lineTo(w - padRight, yPos);
    ctx.stroke();
    ctx.fillText(`${yVal}`, 10, yPos + 3);
  }

  const barGroupW = chartW / sample.length;
  const barW = Math.max(8, barGroupW * 0.35);

  sample.forEach((dist, idx) => {
    const rawVal = parseFloat(dist.raw_rainfall_mm) || 0;
    const corrVal = parseFloat(dist.corrected_rainfall_mm) || 0;

    const rawH = (rawVal / maxVal) * chartH;
    const corrH = (corrVal / maxVal) * chartH;

    const gx = padLeft + idx * barGroupW + (barGroupW - barW * 2 - 4) / 2;

    // Raw Bar
    ctx.fillStyle = "#B5730E";
    ctx.fillRect(gx, padTop + chartH - rawH, barW, rawH);

    // AI Corrected Bar
    ctx.fillStyle = "#1B6E8C";
    ctx.fillRect(gx + barW + 4, padTop + chartH - corrH, barW, corrH);

    // District Label
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 9.5px sans-serif";
    ctx.save();
    ctx.translate(gx + barW, padTop + chartH + 12);
    ctx.rotate(0.3);
    ctx.fillText(dist.district_name.substring(0, 10), -10, 10);
    ctx.restore();
  });

  // Legend
  ctx.fillStyle = "#B5730E";
  ctx.fillRect(padLeft, 12, 12, 12);
  ctx.fillStyle = "#1e293b";
  ctx.font = "11px sans-serif";
  ctx.fillText("Raw NWP", padLeft + 18, 22);

  ctx.fillStyle = "#1B6E8C";
  ctx.fillRect(padLeft + 100, 12, 12, 12);
  ctx.fillText(`AI Corrected (PRAGYA · ${ACTIVE_LEAD_TIME})`, padLeft + 118, 22);
}

function renderRegimeRmseChart(rmseScores, leadTime) {
  const canvas = document.getElementById("regimeRmseChart");
  if (!canvas) return;

  const regimes = ["Active Monsoon", "Break Spell", "Low/Depression", "Orographic Ghats", "Coastal-Convective"];
  const rawScores = (rmseScores && rmseScores.raw) ? rmseScores.raw : [16.4, 8.2, 24.5, 28.1, 15.2];
  const corrScores = (rmseScores && rmseScores.corr) ? rmseScores.corr : [7.9, 3.6, 11.2, 12.4, 7.8];

  if (typeof Chart === "undefined") {
    // Native canvas fallback for scorecard chart
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const w = canvas.parentElement.clientWidth || 450;
      const h = 180;
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#1e293b";
      ctx.font = "11px sans-serif";
      ctx.fillText("Regime RMSE Reduction: -48.3% Average Skill Gain", 20, 25);
    }
    return;
  }

  if (_rmseChart) {
    _rmseChart.data.datasets[0].data = rawScores;
    _rmseChart.data.datasets[1].data = corrScores;
    _rmseChart.update();
    return;
  }

  _rmseChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: regimes,
      datasets: [
        {
          label: "Raw NWP RMSE (mm)",
          data: rawScores,
          backgroundColor: "rgba(180,115,14,0.55)",
          borderColor: "#B5730E",
          borderWidth: 1.5,
          borderRadius: 3,
        },
        {
          label: "AI Corrected RMSE (mm)",
          data: corrScores,
          backgroundColor: "rgba(16,185,129,0.75)",
          borderColor: "#10B981",
          borderWidth: 1.5,
          borderRadius: 3,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { font: { family: "'Source Sans 3', sans-serif", size: 10 }, boxWidth: 10 } }
      },
      scales: {
        x: { ticks: { font: { family: "'Source Sans 3', sans-serif", size: 9.5 } } },
        y: { beginAtZero: true, title: { display: true, text: "RMSE (mm)", font: { size: 9.5 } } }
      }
    }
  });
}

// =============================================================================
// HISTORICAL BENCHMARK LOADER
// =============================================================================
window.loadCaseStudy = function(caseId) {
  ACTIVE_SCENARIO_ID = caseId;
  const select = document.getElementById("benchmarkSelect");
  if (select) select.value = caseId;

  // Switch to main outlook tab
  const outlookBtn = document.querySelector('.nav-btn[data-target="view-outlook"]');
  if (outlookBtn) outlookBtn.click();

  updateAllViews();
};

function loadHistoricalCases() {
  const container = document.getElementById("caseStudiesList") || document.getElementById("caseCardsContainer");
  if (!container) return;

  const cases = [
    {
      case_id: "kerala_2018_orographic",
      title: "August 2018 Kerala Orographic Extreme",
      date: "15–17 August 2018",
      regime: "Orographic",
      synopsis: "Persistent, high-amplitude monsoon surge with Findlater Jet exceeding 38 knots. Perpendicular westerly flow impinging on the steep Western Ghats caused unprecedented orographic precipitation over Idukki, Wayanad, and Malabar. Raw NWP smoothed crest peaks; the regime-aware model restored peak rain rates and triggered timely Red alerts."
    },
    {
      case_id: "depression_2021_bay_of_bengal",
      title: "September 2021 Bay of Bengal Landfalling Depression",
      date: "12–14 September 2021",
      regime: "Low / Depression",
      synopsis: "Deep depression formed over the northwest Bay of Bengal and crossed Odisha coast near Chandbali. Raw NWP exhibited a 65 km track displacement and severely under-predicted southwest quadrant convective cores. The Depression GBM corrected Balasore from 140 mm to 211 mm."
    },
    {
      case_id: "break_2020_central_india",
      title: "August 2020 Central India Break Spell",
      date: "18–22 August 2020",
      regime: "Break",
      synopsis: "Monsoon trough shifted northwards to the Himalayan foothills. South-westerly flow weakened significantly (< 14 knots). Raw NWP generated widespread spurious light convective showers over Peninsular India. The Break-regime filter squashed spurious drizzle, eliminating false alarms."
    }
  ];

  container.innerHTML = "";
  cases.forEach(c => {
    const card = document.createElement("div");
    card.className = "table-card";
    card.style.padding = "18px";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
        <h3 style="font-family: var(--font-head); font-size: 16px; color: var(--navy); margin: 0;">${c.title}</h3>
        <span class="chip ${REGIME_CLASS_MAP[c.regime] || 'active'}"><span class="dot"></span>${c.regime}</span>
      </div>
      <div style="font-size: 12px; color: var(--slate); margin-bottom: 10px;">Event Date: <strong>${c.date}</strong></div>
      <p style="font-size: 13px; color: var(--ink-soft); margin-bottom: 14px; line-height: 1.5;">${c.synopsis}</p>
      <button class="btn btn-primary btn-sm" onclick="loadCaseStudy('${c.case_id}')">Apply Scenario to Duty-Desk &rarr;</button>
    `;
    container.appendChild(card);
  });
}

function loadVerificationScorecard() {
  const tbody = document.getElementById("scorecardTableBody");
  if (!tbody) return;

  const rows = [
    {
      regime: "Orographic",
      lead_time: "T+24",
      n_samples: 840,
      raw_nwp: { rmse: 48.2, ets: 0.31, pod: 0.58, fss: 0.46 },
      corrected: { rmse: 26.4, ets: 0.62, pod: 0.86, fss: 0.78 }
    },
    {
      regime: "Low / Depression",
      lead_time: "T+24",
      n_samples: 420,
      raw_nwp: { rmse: 56.5, ets: 0.32, pod: 0.61, fss: 0.49 },
      corrected: { rmse: 31.8, ets: 0.64, pod: 0.88, fss: 0.81 }
    },
    {
      regime: "Active",
      lead_time: "T+24",
      n_samples: 1260,
      raw_nwp: { rmse: 28.6, ets: 0.41, pod: 0.68, fss: 0.58 },
      corrected: { rmse: 17.2, ets: 0.63, pod: 0.84, fss: 0.79 }
    },
    {
      regime: "Break",
      lead_time: "T+24",
      n_samples: 680,
      raw_nwp: { rmse: 22.4, ets: 0.21, pod: 0.45, fss: 0.38 },
      corrected: { rmse: 11.5, ets: 0.55, pod: 0.78, fss: 0.72 }
    }
  ];

  tbody.innerHTML = "";
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="chip ${REGIME_CLASS_MAP[r.regime] || 'active'}"><span class="dot"></span>${r.regime}</span></td>
      <td>${r.lead_time}</td>
      <td class="num">${r.n_samples}</td>
      <td class="num">${r.raw_nwp.rmse} mm</td>
      <td class="num" style="font-weight: 700; color: var(--teal);">${r.corrected.rmse} mm</td>
      <td class="num">${r.raw_nwp.ets}</td>
      <td class="num" style="font-weight: 700; color: var(--green);">${r.corrected.ets}</td>
      <td class="num">${r.raw_nwp.pod}</td>
      <td class="num" style="font-weight: 700; color: var(--navy);">${r.corrected.pod}</td>
      <td class="num">${r.raw_nwp.fss}</td>
      <td class="num" style="font-weight: 700; color: var(--green);">${r.corrected.fss}</td>
    `;
    tbody.appendChild(tr);
  });
}

function loadModelCards() {
  const container = document.getElementById("modelCardsList") || document.getElementById("modelCardsContainer");
  if (!container) return;

  const cards = [
    {
      model_id: "mc-regime-clf-v1",
      model_name: "Tier A Synoptic Regime Classifier",
      architecture: "LightGBM Multiclass Gradient Boosted Trees (150 estimators, depth=5)",
      training_window: "JJAS 2015–2023",
      sample_count: 1098,
      input_features: ["Monsoon Trough Vorticity", "Findlater Jet Speed", "Vertical Wind Shear", "MSLP Deficit", "OLR Proxy"],
      calibration: "Temperature-scaled softmax; isotonic reliability evaluated against held-out 2024 season",
      known_failure_modes: ["Transition days between Active and Break spells may exhibit high entropy"]
    },
    {
      model_id: "mc-qm-active-break-v1",
      model_name: "Active / Break Empirical Quantile Mapping",
      architecture: "Non-parametric Piecewise Empirical Quantile Mapping (EQM)",
      training_window: "JJAS 2015–2023",
      sample_count: 1940,
      input_features: ["Raw 24h NWP Rainfall", "Subdivision Climatology"],
      calibration: "Continuous monotonic CDF matching with tail extrapolation",
      known_failure_modes: ["Extreme tail events exceeding historical 99.9th percentile require linear slope extrapolation"]
    }
  ];

  container.innerHTML = "";
  cards.forEach(c => {
    const card = document.createElement("div");
    card.className = "table-card";
    card.style.padding = "18px";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
        <h3 style="font-family: var(--font-head); font-size: 16.5px; color: var(--navy); margin: 0;">${c.model_name}</h3>
        <span class="pill" style="font-family: var(--font-mono); font-size: 11.5px; background: var(--teal-100); color: var(--teal); border-color: var(--teal);">${c.model_id}</span>
      </div>
      <div style="font-size: 13px; color: var(--ink-soft); margin-bottom: 12px;"><strong>Architecture:</strong> ${c.architecture}</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 13px;">
        <div>
          <div style="color: var(--slate); font-size: 12px; margin-bottom: 2px;">TRAINING WINDOW &amp; SAMPLES</div>
          <div>${c.training_window} (${c.sample_count} samples)</div>
          <div style="color: var(--slate); font-size: 12px; margin-top: 10px; margin-bottom: 2px;">INPUT FEATURES</div>
          <div>${c.input_features.join(" · ")}</div>
        </div>
        <div>
          <div style="color: var(--slate); font-size: 12px; margin-bottom: 2px;">CALIBRATION &amp; VALIDATION</div>
          <div>${c.calibration}</div>
          <div style="color: var(--slate); font-size: 12px; margin-top: 10px; margin-bottom: 2px;">KNOWN FAILURE MODES</div>
          <div>${c.known_failure_modes.join(" · ")}</div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function loadOverrides() {
  const tbody = document.getElementById("overridesTableBody");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td class="num" style="font-size: 12px;">2026-09-21 07:15</td>
      <td><strong>Idukki</strong></td>
      <td><span class="chip active"><span class="dot"></span>Active</span></td>
      <td><span class="chip oro"><span class="dot"></span>Orographic</span></td>
      <td style="font-family: var(--font-mono); font-size: 12px;">MET-OFFICER-402</td>
      <td style="font-size: 12.5px;">Doppler Radar indicates sustained upslope crest convergence; elevated regime.</td>
      <td><span class="pill" style="color: var(--teal); background: var(--teal-100); border-color: var(--teal); font-size: 11px;">Queued</span></td>
    </tr>
  `;
  const statTot = document.getElementById("statTotalOverrides");
  const statQ = document.getElementById("statQueuedSamples");
  if (statTot) statTot.textContent = "1";
  if (statQ) statQ.textContent = "1";
}

function loadBulletinAndCap() {
  const el = document.getElementById("bulletinPreview");
  const pre = document.getElementById("capXmlPreview");

  if (el) {
    el.innerHTML = `
      <div style="border-bottom: 1px solid var(--line); padding-bottom: 8px; margin-bottom: 10px;">
        <strong>PRAGYA OPERATIONAL HYDRO-METEOROLOGICAL ADVISORY</strong><br>
        <span style="color: var(--slate); font-size: 12px;">Post-processing Rainfall with AI for Greater Yield Accuracy</span>
      </div>
      <p style="margin-bottom: 8px;"><strong>Executive Summary:</strong> Regime-aware bias correction validates high extreme rainfall risk over Western Ghats & coastal zones. Calibrated QPF restores crest peaks suppressed by raw NWP.</p>
      <div style="font-size: 12px; color: var(--slate);">Valid through: 24h accumulated period (T+24 cycle)</div>
    `;
  }

  if (pre) {
    pre.textContent = `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>PRAGYA-CAP-2026-0921-001</identifier>
  <sender>operational-duty-desk@pragya.ai</sender>
  <sent>2026-09-21T00:00:00Z</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <category>Met</category>
    <event>Severe Rainfall Risk</event>
    <urgency>Expected</urgency>
    <severity>Severe</severity>
    <certainty>Likely</certainty>
    <headline>PRAGYA Calibrated Extreme Rainfall Warning</headline>
    <description>AI post-processed rainfall guidance triggers high-confidence warnings for selected districts based on regime-aware calibration.</description>
  </info>
</alert>`;
  }
}

// =============================================================================
// MODALS & DRAWERS
// =============================================================================
function initDrawer() {
  const closeBtn = document.getElementById("btnDrawerClose");
  const drawer = document.getElementById("districtDrawer");
  if (closeBtn && drawer) {
    closeBtn.addEventListener("click", () => drawer.classList.remove("open"));
  }
}

window.openDistrictDrawer = function(districtId) {
  if (!CURRENT_CYCLE_DATA || !CURRENT_CYCLE_DATA.districts) return;
  const dist = CURRENT_CYCLE_DATA.districts.find(d => d.district_id === districtId);
  if (!dist) return;

  SELECTED_DISTRICT = dist;
  const drawer = document.getElementById("districtDrawer");
  const unit = getPeriodUnit(ACTIVE_PERIOD);

  const titleEl = document.getElementById("drawerDistrictTitle");
  if (titleEl) titleEl.textContent = `${dist.district_name} (${dist.state})`;

  const rawEl = document.getElementById("drawerRawVal");
  if (rawEl) rawEl.textContent = `${dist.raw_rainfall_mm} ${unit}`;

  const corrEl = document.getElementById("drawerCorrectedVal");
  if (corrEl) corrEl.textContent = `${dist.corrected_rainfall_mm} ${unit}`;

  const qEl = document.getElementById("drawerQuantiles");
  if (qEl) qEl.textContent = `${dist.quantile_p10_mm} – ${dist.quantile_p90_mm} ${unit}`;

  if (drawer) drawer.classList.add("open");
};

function initOverrideModal() {
  const modal = document.getElementById("overrideModal");
  const cancelBtn1 = document.getElementById("btnCancelOverride");
  const cancelBtn2 = document.getElementById("btnCancelOverride2");
  const submitBtn = document.getElementById("btnSubmitOverride");

  const close = () => { if (modal) modal.style.display = "none"; };

  if (cancelBtn1) cancelBtn1.addEventListener("click", close);
  if (cancelBtn2) cancelBtn2.addEventListener("click", close);

  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      const reg = document.getElementById("overrideSelectRegime").value;
      if (SELECTED_DISTRICT) {
        SELECTED_DISTRICT.regime = reg;
        SELECTED_DISTRICT.alert_level = reg === "Orographic" || reg === "Low / Depression" ? "Orange" : "Yellow";
        updateAllViews();
      }
      close();
      const countEl = document.getElementById("sidebarOverrideCount");
      if (countEl) {
        countEl.textContent = parseInt(countEl.textContent || "0") + 1;
      }
      alert(`Override committed! District reassigned to '${reg}' and queued into active-learning pipeline.`);
    });
  }
}

window.openOverrideModal = function(districtId) {
  if (!CURRENT_CYCLE_DATA || !CURRENT_CYCLE_DATA.districts) return;
  const dist = CURRENT_CYCLE_DATA.districts.find(d => d.district_id === districtId);
  if (!dist) return;

  SELECTED_DISTRICT = dist;
  const modal = document.getElementById("overrideModal");
  const distInp = document.getElementById("overrideDistrictName");
  const regInp = document.getElementById("overrideOriginalRegime");

  if (distInp) distInp.value = `${dist.district_name} (${dist.state})`;
  if (regInp) regInp.value = dist.regime;
  if (modal) modal.style.display = "flex";
};

function initExportButtons() {
  const capBtn = document.getElementById("btnDownloadCap");
  if (capBtn) {
    capBtn.addEventListener("click", () => {
      const blob = new Blob([document.getElementById("capXmlPreview").textContent], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PRAGYA_CAP_${ACTIVE_LEAD_TIME}.xml`;
      a.click();
    });
  }

  const bulletinBtn = document.getElementById("btnDownloadBulletin");
  if (bulletinBtn) {
    bulletinBtn.addEventListener("click", () => {
      const text = document.getElementById("bulletinPreview").innerText;
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PRAGYA_Advisory_${ACTIVE_LEAD_TIME}.txt`;
      a.click();
    });
  }
}

// =============================================================================
// PRAGYA APP STARTUP INITIALIZATION
// =============================================================================
function initPragyaApp() {
  initNavigation();
  initLeadTimeSelector();
  initScenarioSelector();
  initPeriodSelector();
  initChartModeSelector();
  initDrawer();
  initOverrideModal();
  initExportButtons();
  initSearch();

  // Initial Load of all views, maps, tables & charts
  updateAllViews();

  // Load secondary views
  loadHistoricalCases();
  loadVerificationScorecard();
  loadModelCards();
  loadOverrides();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPragyaApp);
} else {
  // If DOM is already ready, run immediately
  initPragyaApp();
}
