from __future__ import annotations

import cv2

from config import Settings


class CameraStream:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._capture: cv2.VideoCapture | None = None

    def open(self) -> None:
        if self.is_open:
            return

        source = self._settings.rtsp_url if self._settings.rtsp_url else self._settings.webcam_index
        self._capture = cv2.VideoCapture(source)

        if not self._capture.isOpened():
            raise RuntimeError(f"Unable to open camera source: {source}")

    @property
    def is_open(self) -> bool:
        return self._capture is not None and self._capture.isOpened()

    def read(self):
        if self._capture is None:
            raise RuntimeError("Camera source is not opened.")

        ok, frame = self._capture.read()
        if not ok:
            return None
        return frame

    def release(self) -> None:
        if self._capture is not None:
            self._capture.release()
            self._capture = None
