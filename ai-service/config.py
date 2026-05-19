from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parent


def _env_str(name: str, default: str = "") -> str:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip()


def _env_float(name: str, default: float) -> float:
    value = _env_str(name, "")
    if not value:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    value = _env_str(name, "")
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


@dataclass
class Settings:
    backend_base_url: str
    ai_internal_api_key: str
    camera_id: str
    webcam_index: int
    rtsp_url: str | None
    active_session_id: str | None
    frame_process_interval_seconds: float
    face_match_threshold: float
    duplicate_resend_seconds: float
    max_faces_per_frame: int
    frame_resize_scale: float
    request_timeout_seconds: float
    active_session_refresh_seconds: float
    insightface_model_name: str
    insightface_det_size: int
    data_students_dir: Path
    encodings_path: Path


def load_settings() -> Settings:
    load_dotenv(ROOT_DIR / ".env")

    backend_base_url = _env_str("BACKEND_BASE_URL", "http://localhost:5001/api/v1").rstrip("/")
    ai_internal_api_key = _env_str("AI_INTERNAL_API_KEY", "")
    camera_id = _env_str("CAMERA_ID", "cam-01")
    webcam_index = _env_int("WEBCAM_INDEX", 0)
    rtsp_url = _env_str("RTSP_URL", "") or None
    active_session_id = _env_str("ACTIVE_SESSION_ID", "") or None
    frame_process_interval_seconds = max(_env_float("FRAME_PROCESS_INTERVAL_SECONDS", 0.8), 0.1)
    face_match_threshold = min(max(_env_float("FACE_MATCH_THRESHOLD", 0.38), 0.2), 1.0)
    duplicate_resend_seconds = max(_env_float("DUPLICATE_RESEND_SECONDS", 8.0), 1.0)
    max_faces_per_frame = max(_env_int("MAX_FACES_PER_FRAME", 10), 1)
    frame_resize_scale = min(max(_env_float("FRAME_RESIZE_SCALE", 0.5), 0.2), 1.0)
    request_timeout_seconds = max(_env_float("REQUEST_TIMEOUT_SECONDS", 10.0), 1.0)
    active_session_refresh_seconds = max(_env_float("ACTIVE_SESSION_REFRESH_SECONDS", 15.0), 5.0)
    insightface_model_name = _env_str("INSIGHTFACE_MODEL_NAME", "buffalo_s")
    insightface_det_size = max(_env_int("INSIGHTFACE_DET_SIZE", 640), 320)

    return Settings(
        backend_base_url=backend_base_url,
        ai_internal_api_key=ai_internal_api_key,
        camera_id=camera_id,
        webcam_index=webcam_index,
        rtsp_url=rtsp_url,
        active_session_id=active_session_id,
        frame_process_interval_seconds=frame_process_interval_seconds,
        face_match_threshold=face_match_threshold,
        duplicate_resend_seconds=duplicate_resend_seconds,
        max_faces_per_frame=max_faces_per_frame,
        frame_resize_scale=frame_resize_scale,
        request_timeout_seconds=request_timeout_seconds,
        active_session_refresh_seconds=active_session_refresh_seconds,
        insightface_model_name=insightface_model_name,
        insightface_det_size=insightface_det_size,
        data_students_dir=ROOT_DIR / "data" / "students",
        encodings_path=ROOT_DIR / "encodings" / "faces.pkl",
    )
