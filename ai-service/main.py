from __future__ import annotations

import argparse
import time
from dataclasses import dataclass

import requests

from camera import CameraStream
from config import load_settings
from recognizer import FaceRecognizer
from sender import BackendSender


@dataclass
class ActiveSession:
    session_id: str
    camera_id: str | None
    status: str


class DuplicateThrottle:
    def __init__(self, resend_seconds: float) -> None:
        self._resend_seconds = resend_seconds
        self._last_sent_at: dict[str, float] = {}

    def eligible(self, detection, now: float) -> bool:
        key = detection.throttle_key()
        last_seen = self._last_sent_at.get(key)
        if last_seen is None or (now - last_seen) >= self._resend_seconds:
            self._last_sent_at[key] = now
            return True
        return False


def _lookup_ai_active_session(settings, preferred_camera_id: str | None = None) -> ActiveSession | None:
    params: dict[str, str] = {}
    if preferred_camera_id:
        params["cameraId"] = preferred_camera_id

    response = requests.get(
        f"{settings.backend_base_url}/ai/active-session",
        params=params,
        headers={"x-ai-api-key": settings.ai_internal_api_key},
        timeout=settings.request_timeout_seconds,
    )
    response.raise_for_status()
    body = response.json()
    data = body.get("data")
    if not isinstance(data, dict):
        return None

    session_id = str(data.get("sessionId", "")).strip()
    if not session_id:
        return None

    raw_camera_id = data.get("cameraId")
    camera_id = (
        str(raw_camera_id).strip()
        if isinstance(raw_camera_id, str) and raw_camera_id.strip()
        else None
    )
    status = str(data.get("status", "started")).strip() or "started"

    return ActiveSession(session_id=session_id, camera_id=camera_id, status=status)


def resolve_active_session(
    settings,
    requested_session_id: str | None = None,
    preferred_camera_id: str | None = None,
) -> ActiveSession | None:
    if requested_session_id:
        return ActiveSession(
            session_id=requested_session_id,
            camera_id=settings.camera_id or None,
            status="manual",
        )

    try:
        active_session = _lookup_ai_active_session(
            settings,
            preferred_camera_id=preferred_camera_id,
        )
    except requests.RequestException as error:
        print(f"[active-session] lookup failed: {error}")
        active_session = None

    if active_session:
        print(
            f"[active-session] found session={active_session.session_id} camera={active_session.camera_id or 'default'} status={active_session.status}"
        )
        return active_session

    if settings.active_session_id:
        return ActiveSession(
            session_id=settings.active_session_id,
            camera_id=settings.camera_id or None,
            status="env",
        )

    return None


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smart Attendance AI service runtime.")
    parser.add_argument(
        "--session-id",
        dest="session_id",
        default=None,
        help="Optional explicit session ID. Overrides auto active-session lookup.",
    )
    parser.add_argument(
        "--camera-id",
        dest="camera_id",
        default=None,
        help="Optional camera ID override.",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    settings = load_settings()

    if not settings.ai_internal_api_key:
        raise RuntimeError("AI_INTERNAL_API_KEY is required in ai-service/.env")

    recognizer = FaceRecognizer(settings)
    sender = BackendSender(settings)
    throttle = DuplicateThrottle(settings.duplicate_resend_seconds)

    active_session = resolve_active_session(
        settings,
        requested_session_id=args.session_id,
        preferred_camera_id=args.camera_id,
    )
    session_id = active_session.session_id if active_session else None
    camera_id = (
        args.camera_id
        or (active_session.camera_id if active_session else None)
        or settings.camera_id
        or "cam-01"
    )

    if active_session:
        print(
            f"[main] started session={session_id} camera={camera_id} source={'rtsp' if settings.rtsp_url else 'webcam'}"
        )
    else:
        print(
            f"[main] no active session found; waiting for teacher to start session (camera={camera_id})"
        )

    stream = CameraStream(settings)

    last_processed_at = 0.0
    last_session_refresh_at = time.time()

    try:
        while True:
            now = time.time()

            if (
                not args.session_id
                and now - last_session_refresh_at >= settings.active_session_refresh_seconds
            ):
                try:
                    active_session = resolve_active_session(
                        settings,
                        requested_session_id=None,
                        preferred_camera_id=args.camera_id,
                    )
                    if active_session:
                        session_id = active_session.session_id
                        if not args.camera_id and active_session.camera_id:
                            camera_id = active_session.camera_id
                        print(
                            f"[main] session refresh session={session_id} camera={camera_id} status={active_session.status}"
                        )
                    else:
                        session_id = None
                        print("[main] no active session found")
                except Exception as error:
                    print(f"[main] session refresh skipped: {error}")
                last_session_refresh_at = now

            if not session_id:
                if stream.is_open:
                    stream.release()
                    print("[main] session ended; camera released")
                print("[main] waiting for active session; camera off")
                time.sleep(1.0)
                continue

            if not stream.is_open:
                stream.open()
                print(
                    f"[main] camera opened session={session_id} camera={camera_id} source={'rtsp' if settings.rtsp_url else 'webcam'}"
                )

            frame = stream.read()
            if frame is None:
                print("[main] frame read failed; retrying...")
                time.sleep(0.5)
                continue

            if now - last_processed_at < settings.frame_process_interval_seconds:
                continue
            last_processed_at = now

            detections = recognizer.recognize(frame)
            if not detections:
                print("[main] no faces")
                continue

            sendable = [detection for detection in detections if throttle.eligible(detection, now)]
            if not sendable:
                print(f"[main] detections={len(detections)} throttled")
                continue

            known_student_ids = [d.student_id for d in sendable if d.student_id]
            unknown_count = len([d for d in sendable if d.is_unknown])
            print(
                f"[main] recognized={known_student_ids} unknown={unknown_count} sending={len(sendable)}"
            )

            sender.send_events(session_id=session_id, camera_id=camera_id, detections=sendable)
    except KeyboardInterrupt:
        print("\n[main] shutdown requested")
    finally:
        stream.release()
        print("[main] camera released")


if __name__ == "__main__":
    main()
