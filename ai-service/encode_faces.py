from __future__ import annotations

import pickle
from pathlib import Path

import cv2
import numpy as np

from config import load_settings
from insightface_engine import InsightFaceEngine


VALID_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def _scan_student_images(students_root: Path) -> list[tuple[str, Path]]:
    pairs: list[tuple[str, Path]] = []

    if not students_root.exists():
        return pairs

    for item in sorted(students_root.iterdir()):
        if item.is_file():
            if item.suffix.lower() not in VALID_EXTENSIONS:
                continue
            student_id = item.stem.strip()
            if student_id:
                pairs.append((student_id, item))
            continue

        if item.is_dir():
            student_id = item.name.strip()
            if not student_id:
                continue
            for image_path in sorted(item.rglob("*")):
                if image_path.is_file() and image_path.suffix.lower() in VALID_EXTENSIONS:
                    pairs.append((student_id, image_path))

    return pairs


def main() -> None:
    settings = load_settings()
    students_root = settings.data_students_dir
    output_path = settings.encodings_path
    output_path.parent.mkdir(parents=True, exist_ok=True)

    engine = InsightFaceEngine(settings)
    image_pairs = _scan_student_images(students_root)

    known_encodings: list[np.ndarray] = []
    known_student_ids: list[str] = []
    skipped = 0
    encoded = 0

    if not image_pairs:
        print(f"[encode] no images found under: {students_root}")

    for student_id, image_path in image_pairs:
        image = cv2.imread(str(image_path))
        if image is None:
            skipped += 1
            print(f"[encode] skipped(unreadable): {image_path}")
            continue

        faces = engine.get_faces(image)
        if not faces:
            skipped += 1
            print(f"[encode] skipped(no face): {image_path}")
            continue

        if len(faces) > 1:
            print(f"[encode] warning(multiple faces): {image_path} -> using largest face")

        embedding = engine.get_embedding(faces[0])
        if embedding is None:
            skipped += 1
            print(f"[encode] skipped(no embedding): {image_path}")
            continue

        known_encodings.append(embedding)
        known_student_ids.append(student_id)
        encoded += 1
        print(f"[encode] encoded student={student_id} file={image_path.name}")

    payload = {
        "model": f"insightface-{settings.insightface_model_name}",
        "threshold": settings.face_match_threshold,
        "encodings": known_encodings,
        "studentIds": known_student_ids,
    }

    with output_path.open("wb") as file:
        pickle.dump(payload, file)

    print(
        f"[encode] done output={output_path} encoded={encoded} skipped={skipped} total_files={len(image_pairs)}"
    )


if __name__ == "__main__":
    main()
