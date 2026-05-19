import { CheckCircle2, Camera, RotateCcw, VideoOff } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import SidePanel from '../common/SidePanel'
import type { Student } from '../../types/student'

const POSES = ['center', 'left', 'right'] as const

type FacePose = (typeof POSES)[number]

const FACE_MESH_SCRIPT_ID = 'mediapipe-face-mesh-script'
const FACE_MESH_SCRIPT_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js'

interface FaceMeshResult {
  multiFaceLandmarks?: Array<Array<{ x: number; y: number }>>
}

interface FaceMeshInstance {
  close(): Promise<void> | void
  onResults(listener: (results: FaceMeshResult) => void): void
  setOptions(options: Record<string, unknown>): void
  send(inputs: { image: HTMLVideoElement }): Promise<void>
}

interface FaceMeshConstructor {
  new (config?: { locateFile?: (path: string, prefix?: string) => string }): FaceMeshInstance
}

const loadFaceMeshScript = async (): Promise<FaceMeshConstructor> => {
  const existing = (window as Window & { FaceMesh?: FaceMeshConstructor }).FaceMesh
  if (existing) {
    return existing
  }

  await new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(FACE_MESH_SCRIPT_ID) as
      | HTMLScriptElement
      | null

    if (existingScript) {
      if (
        existingScript.dataset.loaded === 'true' &&
        (window as Window & { FaceMesh?: FaceMeshConstructor }).FaceMesh
      ) {
        resolve()
        return
      }
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Failed to load Face Mesh script.')),
        { once: true },
      )
      return
    }

    const script = document.createElement('script')
    script.id = FACE_MESH_SCRIPT_ID
    script.src = FACE_MESH_SCRIPT_URL
    script.async = true
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load Face Mesh script.'))
    document.head.appendChild(script)
  })

  const ctor = (window as Window & { FaceMesh?: FaceMeshConstructor }).FaceMesh
  if (!ctor) {
    throw new Error('Face Mesh script loaded, but FaceMesh constructor is unavailable.')
  }

  return ctor
}

const POSE_LABEL: Record<FacePose, string> = {
  center: 'Center face',
  left: 'Turn face left',
  right: 'Turn face right',
}

export interface FaceRegistrationImages {
  center: string
  left: string
  right: string
}

interface FaceRegistrationModalProps {
  open: boolean
  student: Student | null
  isSaving: boolean
  onClose: () => void
  onSubmit: (images: FaceRegistrationImages) => Promise<void>
}

function FaceRegistrationModal({
  open,
  student,
  isSaving,
  onClose,
  onSubmit,
}: FaceRegistrationModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const faceMeshRef = useRef<FaceMeshInstance | null>(null)
  const detectorIntervalRef = useRef<number | null>(null)
  const isProcessingRef = useRef(false)
  const nextCaptureAtRef = useRef(0)
  const currentPoseRef = useRef<FacePose>('center')
  const capturesRef = useRef<Record<FacePose, string | null>>({
    center: null,
    left: null,
    right: null,
  })

  const [captureError, setCaptureError] = useState<string | null>(null)
  const [statusText, setStatusText] = useState('Allow camera access to start face registration.')
  const [isCurrentStepValid, setIsCurrentStepValid] = useState(false)
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0)
  const [captures, setCaptures] = useState<Record<FacePose, string | null>>({
    center: null,
    left: null,
    right: null,
  })

  const currentPose = POSES[currentPoseIndex] ?? 'right'

  useEffect(() => {
    currentPoseRef.current = currentPose
  }, [currentPose])

  useEffect(() => {
    capturesRef.current = captures
  }, [captures])

  const stopCamera = useCallback(() => {
    if (detectorIntervalRef.current) {
      window.clearInterval(detectorIntervalRef.current)
      detectorIntervalRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (faceMeshRef.current) {
      faceMeshRef.current.close()
      faceMeshRef.current = null
    }

    const video = videoRef.current
    if (video) {
      video.srcObject = null
    }
  }, [])

  const capturePose = useCallback(
    (pose: FacePose) => {
      const video = videoRef.current
      const canvas = captureCanvasRef.current
      if (!video || !canvas) {
        setCaptureError('Camera is not ready yet. Wait a second and try again.')
        return false
      }

      const sourceWidth = video.videoWidth
      const sourceHeight = video.videoHeight
      if (!sourceWidth || !sourceHeight) {
        setCaptureError('Camera frame is not ready yet. Wait a second and try again.')
        return false
      }

      const targetWidth = Math.min(sourceWidth, 640)
      const targetHeight = Math.max(1, Math.round((targetWidth / sourceWidth) * sourceHeight))

      canvas.width = targetWidth
      canvas.height = targetHeight
      const context = canvas.getContext('2d')
      if (!context) {
        setCaptureError('Unable to prepare image capture.')
        return false
      }

      context.drawImage(video, 0, 0, targetWidth, targetHeight)
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.82)

      setCaptures((previous) => ({
        ...previous,
        [pose]: imageDataUrl,
      }))

      setStatusText(`Captured ${POSE_LABEL[pose]}.`)

      const poseIndex = POSES.indexOf(pose)
      if (poseIndex < POSES.length - 1) {
        setCurrentPoseIndex(poseIndex + 1)
      }

      setCaptureError(null)
      return true
    },
    [],
  )

  const evaluatePose = useCallback(
    (landmarks: Array<{ x: number; y: number }>) => {
      const activePose = currentPoseRef.current
      const activeCaptures = capturesRef.current

      if (!landmarks.length) {
        setIsCurrentStepValid(false)
        return
      }

      const xs = landmarks.map((point) => point.x)
      const ys = landmarks.map((point) => point.y)

      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)

      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2
      const widthRatio = maxX - minX
      const heightRatio = maxY - minY

      const centered =
        Math.abs(centerX - 0.5) <= 0.14 &&
        Math.abs(centerY - 0.5) <= 0.18 &&
        widthRatio >= 0.16 &&
        heightRatio >= 0.22

      const nose = landmarks[1]
      const leftCheek = landmarks[234]
      const rightCheek = landmarks[454]

      if (!nose || !leftCheek || !rightCheek) {
        setIsCurrentStepValid(false)
        setStatusText('Face landmarks are unstable. Hold still and try again.')
        return
      }

      const leftDistance = Math.abs(nose.x - leftCheek.x)
      const rightDistance = Math.abs(rightCheek.x - nose.x)
      const distanceSum = leftDistance + rightDistance
      const yaw = distanceSum > 0 ? (leftDistance - rightDistance) / distanceSum : 0

      let validForPose = false
      if (activePose === 'center') {
        validForPose = centered && Math.abs(yaw) <= 0.09
      } else if (activePose === 'left') {
        validForPose = centered && yaw <= -0.13
      } else {
        validForPose = centered && yaw >= 0.13
      }

      setIsCurrentStepValid(validForPose)

      if (!centered) {
        setStatusText('Move your face into the guide circle.')
      } else if (!validForPose) {
        setStatusText(POSE_LABEL[activePose])
      } else {
        setStatusText(`Good. Capturing ${POSE_LABEL[activePose]}...`)
      }

      const now = Date.now()
      if (validForPose && !activeCaptures[activePose] && now >= nextCaptureAtRef.current) {
        nextCaptureAtRef.current = now + 1200
        capturePose(activePose)
      }
    },
    [capturePose],
  )

  useEffect(() => {
    if (!open || !student) {
      stopCamera()
      setCaptureError(null)
      setStatusText('Allow camera access to start face registration.')
      setIsCurrentStepValid(false)
      setCurrentPoseIndex(0)
      setCaptures({ center: null, left: null, right: null })
      return
    }

    let mounted = true

    const setup = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })

        if (!mounted) {
          mediaStream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = mediaStream

        const video = videoRef.current
        if (!video) {
          return
        }

        video.srcObject = mediaStream
        await video.play()

        setStatusText(`Camera ready. Capture ${POSE_LABEL[currentPoseRef.current]}.`)

        try {
          const FaceMesh = await loadFaceMeshScript()
          const faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
          })

          faceMesh.setOptions({
            maxNumFaces: 2,
            refineLandmarks: false,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.5,
          })

          faceMesh.onResults((results) => {
            const allLandmarks = results.multiFaceLandmarks ?? []

            if (!allLandmarks.length) {
              setIsCurrentStepValid(false)
              setStatusText('No face detected. You can still capture manually.')
              return
            }

            if (allLandmarks.length > 1) {
              setIsCurrentStepValid(false)
              setStatusText('Multiple faces detected. Keep only one face in frame.')
              return
            }

            evaluatePose(allLandmarks[0] as Array<{ x: number; y: number }>)
          })

          faceMeshRef.current = faceMesh

          detectorIntervalRef.current = window.setInterval(async () => {
            const activeVideo = videoRef.current
            const activeMesh = faceMeshRef.current
            if (
              !activeVideo ||
              !activeMesh ||
              activeVideo.readyState < 2 ||
              isProcessingRef.current
            ) {
              return
            }

            try {
              isProcessingRef.current = true
              await activeMesh.send({ image: activeVideo })
            } catch {
              // keep loop alive on transient camera frame errors
            } finally {
              isProcessingRef.current = false
            }
          }, 260)
        } catch {
          setIsCurrentStepValid(true)
          setStatusText(
            `Camera ready. Capture ${POSE_LABEL[currentPoseRef.current]} manually.`,
          )
        }
      } catch {
        setCaptureError('Unable to access webcam. Check camera permissions and try again.')
      }
    }

    void setup()

    return () => {
      mounted = false
      stopCamera()
    }
  }, [evaluatePose, open, stopCamera, student])

  const completedCount = useMemo(
    () => POSES.filter((pose) => captures[pose]).length,
    [captures],
  )

  const canSave = Boolean(captures.center && captures.left && captures.right)

  const handleRetake = (pose: FacePose) => {
    setCaptures((previous) => ({ ...previous, [pose]: null }))
    setCurrentPoseIndex(POSES.indexOf(pose))
    setStatusText(`Retake ${POSE_LABEL[pose]}.`)
  }

  const handleCaptureClick = (pose: FacePose, isDone: boolean) => {
    if (isDone) {
      handleRetake(pose)
      return
    }

    capturePose(pose)
  }

  const handleSave = async () => {
    if (!canSave) {
      return
    }

    setCaptureError(null)

    try {
      await onSubmit({
        center: captures.center!,
        left: captures.left!,
        right: captures.right!,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save face registration images.'
      setCaptureError(message)
    }
  }

  return (
    <SidePanel
      open={open}
      title={student ? `Register Face • ${student.firstName} ${student.lastName}` : 'Register Face'}
      description="Capture center, left, and right profile images. Keep exactly one face inside the circle."
      onClose={onClose}
      widthClassName="max-w-4xl"
    >
      <div className="space-y-5">
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink-900">Live Camera</p>
            <p className="text-xs text-ink-500">Step {Math.min(currentPoseIndex + 1, 3)} of 3</p>
          </div>

          <div className="relative mx-auto aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={`h-56 w-56 rounded-full border-4 ${
                  isCurrentStepValid ? 'border-emerald-400' : 'border-white/80'
                }`}
              />
            </div>

            {captureError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-ink-950/70 px-4 text-center text-sm text-white">
                <div className="space-y-2">
                  <VideoOff className="mx-auto h-5 w-5" />
                  <p>{captureError}</p>
                </div>
              </div>
            ) : null}
          </div>

          <p className="mt-3 text-sm text-ink-600">{statusText}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink-900">Captured Frames</p>
            <p className="text-xs text-ink-500">{completedCount}/3 complete</p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {POSES.map((pose) => {
              const image = captures[pose]
              const isDone = Boolean(image)
              return (
                <div key={pose} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-ink-900">{POSE_LABEL[pose]}</p>
                    {isDone ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : null}
                  </div>

                  <div className="mb-3 h-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    {image ? (
                      <img src={image} alt={pose} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-ink-400">
                        Not captured
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCaptureClick(pose, isDone)}
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm text-ink-700 transition hover:border-brand-200 hover:bg-brand-50"
                  >
                    {isDone ? <RotateCcw className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                    {isDone ? 'Retake' : 'Capture'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-ink-700 transition hover:border-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-ink-950 px-5 text-sm font-medium text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Camera className="h-4 w-4" />
            {isSaving ? 'Saving face images...' : 'Save Face Registration'}
          </button>
        </div>

        <canvas ref={captureCanvasRef} className="hidden" />
      </div>
    </SidePanel>
  )
}

export default FaceRegistrationModal
