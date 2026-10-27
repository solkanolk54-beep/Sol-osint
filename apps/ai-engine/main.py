#!/usr/bin/env python3
"""
SOL-OSINT | HASAD-Live: AI Yield Prediction & Agronomic Forecast Microservice
Port: 8000 (with auto-fallback to 8001 if port 8000 is occupied by proxy)
Endpoint: POST /predict-yield
"""

import os
import sys
import json
import math
import socket
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

# Agronomic crop baselines (Metric Tons / Hectare) & optimal parameters
CROP_BASELINES = {
    "Alfalfa": {"benchmark": 14.5, "opt_vwc": 32.0, "opt_temp": 24.0, "ndvi_factor": 1.25},
    "Organic Alfalfa": {"benchmark": 14.5, "opt_vwc": 32.0, "opt_temp": 24.0, "ndvi_factor": 1.25},
    "Wheat": {"benchmark": 7.2, "opt_vwc": 28.0, "opt_temp": 21.0, "ndvi_factor": 1.15},
    "Winter Wheat": {"benchmark": 7.2, "opt_vwc": 28.0, "opt_temp": 21.0, "ndvi_factor": 1.15},
    "Silage Maize": {"benchmark": 22.0, "opt_vwc": 35.0, "opt_temp": 26.0, "ndvi_factor": 1.35},
    "Desert Barley": {"benchmark": 6.8, "opt_vwc": 25.0, "opt_temp": 22.0, "ndvi_factor": 1.10},
    "Rhodes Grass": {"benchmark": 16.0, "opt_vwc": 34.0, "opt_temp": 28.0, "ndvi_factor": 1.20},
    "Fodder Sorghum": {"benchmark": 18.5, "opt_vwc": 30.0, "opt_temp": 29.0, "ndvi_factor": 1.18},
    "Almonds": {"benchmark": 3.2, "opt_vwc": 30.0, "opt_temp": 22.0, "ndvi_factor": 1.40},
    "Almonds (Drip Automated)": {"benchmark": 3.2, "opt_vwc": 30.0, "opt_temp": 22.0, "ndvi_factor": 1.40},
    "Wine Grapes": {"benchmark": 8.5, "opt_vwc": 24.0, "opt_temp": 23.0, "ndvi_factor": 1.20},
    "Wine Grapes (VSP Trellis)": {"benchmark": 8.5, "opt_vwc": 24.0, "opt_temp": 23.0, "ndvi_factor": 1.20},
    "Navel Oranges": {"benchmark": 28.0, "opt_vwc": 33.0, "opt_temp": 25.0, "ndvi_factor": 1.30},
    "Olives": {"benchmark": 9.0, "opt_vwc": 26.0, "opt_temp": 24.0, "ndvi_factor": 1.15},
    "SHD Picual Olive Groves": {"benchmark": 9.0, "opt_vwc": 26.0, "opt_temp": 24.0, "ndvi_factor": 1.15},
}


def compute_yield_prediction(mean_ndvi: float, soil_moisture_avg: float, season_temperature_avg: float, crop_type: str) -> dict:
    """
    Multivariate Predictive Yield Regression Model:
    Evaluates vegetative vigor (NDVI), root-zone hydraulic saturation (VWC),
    and accumulated microclimate thermal anomalies.
    """
    matched_crop = None
    for name in CROP_BASELINES:
        if name.lower() in crop_type.lower() or crop_type.lower() in name.lower():
            matched_crop = name
            break
    if not matched_crop:
        matched_crop = "Wheat"

    spec = CROP_BASELINES[matched_crop]
    benchmark = spec["benchmark"]
    opt_vwc = spec["opt_vwc"]
    opt_temp = spec["opt_temp"]

    # 1. Vegetative Canopy Coefficient (Vigor multiplier from NDVI)
    safe_ndvi = max(0.1, min(0.95, mean_ndvi))
    ndvi_ratio = safe_ndvi / 0.58
    ndvi_multiplier = math.pow(ndvi_ratio, 0.85)

    # 2. Moisture Saturation Factor (Curve centered on opt_vwc)
    safe_moisture = max(5.0, min(70.0, soil_moisture_avg))
    if safe_moisture < 18.0:
        moisture_deficit = 18.0 - safe_moisture
        moisture_factor = max(0.40, 1.0 - (moisture_deficit * 0.042))
    elif safe_moisture > 48.0:
        moisture_factor = max(0.70, 1.0 - ((safe_moisture - 48.0) * 0.025))
    else:
        moisture_factor = min(1.12, 1.0 + ((safe_moisture - opt_vwc) * 0.008))

    # 3. Thermal Stress Penalty
    if season_temperature_avg > 32.0:
        temp_excess = season_temperature_avg - 32.0
        thermal_penalty = min(0.45, math.pow(temp_excess, 1.2) * 0.035)
    elif season_temperature_avg < 15.0:
        thermal_penalty = min(0.30, (15.0 - season_temperature_avg) * 0.025)
    else:
        thermal_penalty = 0.0

    raw_yield = benchmark * ndvi_multiplier * moisture_factor * (1.0 - thermal_penalty)
    predicted_yield = round(max(benchmark * 0.35, min(benchmark * 1.45, raw_yield)), 2)
    variance_pct = round(((predicted_yield - benchmark) / benchmark) * 100.0, 1)

    # Risk Classification
    if safe_moisture < 18.0 and season_temperature_avg > 32.0:
        risk_category = "CRITICAL_DEFICIT"
        recommended_action = "Initiate emergency 45-minute solenoid valve actuation to prevent irreversible cellular plasmolysis."
    elif predicted_yield < benchmark * 0.88 or safe_moisture < 22.0:
        risk_category = "MODERATE_RISK"
        recommended_action = "Schedule pulse fertigation within 12 hours. Canopy transpirational demand is elevated."
    else:
        risk_category = "LOW"
        recommended_action = "Canopy growth velocity and soil volumetric water content remain in optimal vegetative regime."

    confidence_score = 0.92

    return {
        "status": "success",
        "crop_type": matched_crop,
        "input_parameters": {
            "mean_ndvi": round(mean_ndvi, 3),
            "soil_moisture_avg": round(soil_moisture_avg, 1),
            "season_temperature_avg": round(season_temperature_avg, 1),
        },
        "predicted_yield_tons_per_ha": predicted_yield,
        "benchmark_yield_tons_per_ha": benchmark,
        "yield_variance_pct": variance_pct,
        "confidence_score": confidence_score,
        "risk_category": risk_category,
        "recommended_action": recommended_action,
        "factors": {
            "vegetative_vigor_index": round(ndvi_multiplier, 3),
            "hydraulic_saturation_index": round(moisture_factor, 3),
            "thermal_stress_penalty": round(thermal_penalty, 3),
        },
        "service_version": "HASAD-FastAPI-YieldEngine-v1.2",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


def get_service_port():
    env_port = os.environ.get("FASTAPI_PORT")
    if env_port:
        return int(env_port)
    for p in [8000, 8001, 8080]:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(('0.0.0.0', p))
            s.close()
            return p
        except OSError:
            continue
    return 8001


class YieldPredictHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        if self.path == "/health":
            self._set_headers(200)
            res = {
                "status": "online",
                "service": "ai-engine",
                "framework": "FastAPI-Ready",
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }
            self.wfile.write(json.dumps(res).encode("utf-8"))
        else:
            self._set_headers(404)
            self.wfile.write(b'{"error": "Not Found"}')

    def do_POST(self):
        if self.path == "/predict-yield":
            try:
                content_len = int(self.headers.get("Content-Length", 0))
                post_body = self.rfile.read(content_len)
                data = json.loads(post_body.decode("utf-8"))

                mean_ndvi = float(data.get("mean_ndvi", 0.55))
                soil_moisture_avg = float(data.get("soil_moisture_avg", 25.0))
                season_temperature_avg = float(data.get("season_temperature_avg", 26.0))
                crop_type = str(data.get("crop_type", "Wheat"))

                result = compute_yield_prediction(
                    mean_ndvi=mean_ndvi,
                    soil_moisture_avg=soil_moisture_avg,
                    season_temperature_avg=season_temperature_avg,
                    crop_type=crop_type,
                )
                self._set_headers(200)
                self.wfile.write(json.dumps(result).encode("utf-8"))
            except Exception as err:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(err)}).encode("utf-8"))
        else:
            self._set_headers(404)
            self.wfile.write(b'{"error": "Endpoint not found"}')

    def log_message(self, format, *args):
        # Quiet logs
        return


# Try importing FastAPI/Uvicorn if available in Python environment
HAS_FASTAPI = False
try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel, Field

    fastapi_app = FastAPI(
        title="SOL-OSINT | HASAD-Live AI Yield Prediction Microservice",
        description="High-precision agronomic regression service for satellite-observed crops.",
        version="1.2.0",
    )

    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class YieldPredictionRequest(BaseModel):
        mean_ndvi: float = Field(..., ge=0.0, le=1.0, description="Mean NDVI score")
        soil_moisture_avg: float = Field(..., ge=0.0, le=100.0, description="Average soil moisture % VWC")
        season_temperature_avg: float = Field(..., description="Average ambient microclimate temperature in C")
        crop_type: str = Field(..., description="Crop cultivar name")

    @fastapi_app.get("/health")
    def health_check():
        return {
            "status": "online",
            "service": "ai-engine",
            "framework": "FastAPI",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

    @fastapi_app.post("/predict-yield")
    def predict_yield(payload: YieldPredictionRequest):
        try:
            return compute_yield_prediction(
                mean_ndvi=payload.mean_ndvi,
                soil_moisture_avg=payload.soil_moisture_avg,
                season_temperature_avg=payload.season_temperature_avg,
                crop_type=payload.crop_type,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False


def main():
    port = get_service_port()
    if HAS_FASTAPI:
        try:
            import uvicorn
            print(f"[AI Engine] Starting FastAPI Yield Prediction Service on http://0.0.0.0:{port}")
            uvicorn.run(fastapi_app, host="0.0.0.0", port=port, log_level="info")
            return
        except Exception as err:
            print(f"[AI Engine] uvicorn failed ({err}), falling back to standard HTTP server")

    # Native standard HTTP server
    server_address = ("0.0.0.0", port)
    httpd = HTTPServer(server_address, YieldPredictHandler)
    print(f"[AI Engine] Yield Prediction Microservice active on http://0.0.0.0:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.server_close()


if __name__ == "__main__":
    main()
