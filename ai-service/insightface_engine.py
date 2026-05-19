from __future__ import annotations

import numpy as np
from insightface.app import FaceAnalysis

from config import Settings


class InsightFaceEngine:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._app = FaceAnalysis(
            name=settings.insightface_model_name,
            providers=["CPUExecutionProvider"],
        )
        self._app.prepare(
            ctx_id=-1,
            det_size=(settings.insightface_det_size, settings.insightface_det_size),
        )

    def get_faces(self, image: np.ndarray):
        faces = self._app.get(image)
        return sorted(
            faces,
            key=lambda face: self._bbox_area(face.bbox),
            reverse=True,
        )

    @staticmethod
    def get_embedding(face) -> np.ndarray | None:
        embedding = getattr(face, "normed_embedding", None)
        if embedding is None:
            embedding = getattr(face, "embedding", None)

        if embedding is None:
            return None

        vector = np.array(embedding, dtype=np.float32)
        norm = float(np.linalg.norm(vector))
        if norm == 0:
            return None

        return vector / norm

    @staticmethod
    def get_box(face) -> dict[str, int]:
        x1, y1, x2, y2 = [int(round(value)) for value in face.bbox]
        return {
            "x": max(0, x1),
            "y": max(0, y1),
            "w": max(1, x2 - x1),
            "h": max(1, y2 - y1),
        }

    @staticmethod
    def _bbox_area(bbox) -> float:
        x1, y1, x2, y2 = bbox
        return max(0.0, float(x2 - x1)) * max(0.0, float(y2 - y1))
