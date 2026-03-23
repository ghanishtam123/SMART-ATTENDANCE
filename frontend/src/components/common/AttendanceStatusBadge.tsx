import type { AttendanceStatus } from '../../types/attendance'
import StatusBadge from './StatusBadge'

interface AttendanceStatusBadgeProps {
  status: AttendanceStatus
}

const attendanceStatusMeta: Record<
  AttendanceStatus,
  {
    label: string
    tone: 'neutral' | 'brand' | 'success' | 'warning'
  }
> = {
  present: {
    label: 'Present',
    tone: 'success',
  },
  late: {
    label: 'Late',
    tone: 'brand',
  },
  absent: {
    label: 'Absent',
    tone: 'warning',
  },
  left_early: {
    label: 'Left Early',
    tone: 'neutral',
  },
}

function AttendanceStatusBadge({ status }: AttendanceStatusBadgeProps) {
  const meta = attendanceStatusMeta[status]

  return <StatusBadge label={meta.label} tone={meta.tone} />
}

export default AttendanceStatusBadge
