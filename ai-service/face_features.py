from __future__ import annotations

import cv2
import numpy as np


def largest_face(faces: np.ndarray) -> tuple[int, int, int, int] | None:
    if len(faces) == 0:
        return None

    return max((tuple(map(int, face)) for face in faces), key=lambda face: face[2] * face[3])


def extract_lbp_embedding(gray_image: np.ndarray) -> np.ndarray | None:
    if gray_image.size == 0:
        return None

    face_gray = cv2.equalizeHist(gray_image)
    face_gray = cv2.resize(face_gray, (64, 64), interpolation=cv2.INTER_AREA)

    embedding = face_gray.astype(np.float32).flatten()
    embedding -= float(embedding.mean())
    norm = float(np.linalg.norm(embedding))
    if norm == 0:
        return None

    return embedding / norm
