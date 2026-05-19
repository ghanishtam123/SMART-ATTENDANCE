from __future__ import annotations

import time
from typing import TYPE_CHECKING, Sequence

import requests

from config import Settings

if TYPE_CHECKING:
    from recognizer import Detection


class BackendSender:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._session = requests.Session()

    def send_events(
        self,
        session_id: str,
        camera_id: str,
        detections: Sequence["Detection"],
    ) -> bool:
        if not detections:
            return False

        url = f"{self._settings.backend_base_url}/ai/recognition-events"
        headers = {
            # Preferred header for internal AI auth.
            "x-ai-api-key": self._settings.ai_internal_api_key,
            # Backward compatibility for backends that still read x-api-key.
            "x-api-key": self._settings.ai_internal_api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "sessionId": session_id,
            "cameraId": camera_id,
            "events": [detection.to_payload_event() for detection in detections],
        }

        max_attempts = 2
        for attempt in range(1, max_attempts + 1):
            try:
                response = self._session.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=self._settings.request_timeout_seconds,
                )

                if 200 <= response.status_code < 300:
                    print(
                        f"[sender] sent={len(detections)} session={session_id} camera={camera_id} status={response.status_code}"
                    )
                    return True

                short_body = (response.text or "").strip().replace("\n", " ")[:220]
                print(
                    f"[sender] failed status={response.status_code} attempt={attempt}/{max_attempts} body={short_body}"
                )

                if 400 <= response.status_code < 500 and response.status_code != 429:
                    return False
            except requests.RequestException as error:
                print(
                    f"[sender] request_error attempt={attempt}/{max_attempts} detail={error}"
                )

            if attempt < max_attempts:
                time.sleep(1.0)

        return False
