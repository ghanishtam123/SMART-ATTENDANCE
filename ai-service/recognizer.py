from __future__ import annotations

import pickle
from dataclasses import dataclass
from datetime import datetime, timezone

import cv2
import numpy as np

from config import Settings
from insightface_engine import InsightFaceEngine


@dataclass
class Detection:
    student_id: str | None
    is_unknown: bool
    confidence: float
    bounding_box: dict[str, int]
    timestamp: str
    distance: float | None = None

    def throttle_key(self) -> str:
        if self.student_id:
            return f"student:{self.student_id}"

        bucket_x = int(self.bounding_box["x"] / 50)
        bucket_y = int(self.bounding_box["y"] / 50)
        return f"unknown:{bucket_x}:{bucket_y}"

    def to_payload_event(self) -> dict[str, object]:
        return {
            "studentId": self.student_id,
            "isUnknown": self.is_unknown,
            "confidence": max(0.0, min(self.confidence, 1.0)),
            "timestamp": self.timestamp,
            "boundingBox": self.bounding_box,
            "metadata": {"distance": self.distance},
        }


class FaceRecognizer:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._engine = InsightFaceEngine(settings)
        self._known_encodings: np.ndarray
        self._known_student_ids: list[str]
        self._load_encodings()

    def _load_encodings(self) -> None:
        path = self._settings.encodings_path
        if not path.exists():
            raise FileNotFoundError(
                f"Encoding file not found: {path}. Run encode_faces.py first."
            )

        with path.open("rb") as file:
            payload = pickle.load(file)

        encodings = payload.get("encodings", [])
        student_ids = payload.get("studentIds", [])

        if len(encodings) != len(student_ids):
            raise ValueError("Invalid encodings file: encodings/studentIds length mismatch.")

        self._known_student_ids = [str(student_id) for student_id in student_ids]
        self._known_encodings = np.array(encodings, dtype=np.float32)

    def recognize(self, frame) -> list[Detection]:
        if frame is None:
            return []

        scale = self._settings.frame_resize_scale
        processed_frame = frame
        if scale < 1.0:
            processed_frame = cv2.resize(
                frame,
                (0, 0),
                fx=scale,
                fy=scale,
                interpolation=cv2.INTER_LINEAR,
            )

        faces = self._engine.get_faces(processed_frame)
        if not faces:
            return []

        detections: list[Detection] = []
        now = datetime.now(timezone.utc).isoformat()

        for face in faces[: self._settings.max_faces_per_frame]:
            box = self._engine.get_box(face)
            if scale < 1.0:
                box = {
                    "x": int(box["x"] / scale),
                    "y": int(box["y"] / scale),
                    "w": int(box["w"] / scale),
                    "h": int(box["h"] / scale),
                }

            embedding = self._engine.get_embedding(face)
            if embedding is None or self._known_encodings.size == 0:
                detections.append(
                    Detection(
                        student_id=None,
                        is_unknown=True,
                        confidence=0.0,
                        bounding_box=box,
                        timestamp=now,
                        distance=None,
                    )
                )
                continue

            similarities = self._known_encodings @ embedding
            best_match_index = int(np.argmax(similarities))
            best_similarity = float(similarities[best_match_index])
            confidence = max(0.0, min(best_similarity, 1.0))

            if best_similarity >= self._settings.face_match_threshold:
                detections.append(
                    Detection(
                        student_id=self._known_student_ids[best_match_index],
                        is_unknown=False,
                        confidence=confidence,
                        bounding_box=box,
                        timestamp=now,
                        distance=1.0 - best_similarity,
                    )
                )
            else:
                detections.append(
                    Detection(
                        student_id=None,
                        is_unknown=True,
                        confidence=confidence,
                        bounding_box=box,
                        timestamp=now,
                        distance=1.0 - best_similarity,
                    )
                )

        return detections
