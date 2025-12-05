"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconPlayerPlay, IconExternalLink } from "@tabler/icons-react"

export type Transcript = {
  id: number
  title: string
  duration: number
  audio_url: string
  video_url: string
  transcript_url: string
  meeting_link: string
  created_at: string
}

export const transcriptColumns: ColumnDef<Transcript>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <div className="font-medium">{row.original.title}</div>
    )
  },
  {
    accessorKey: "duration",
    header: "Duration",
    cell: ({ row }) => {
      const minutes = row.original.duration;
      if (!minutes || minutes <= 0) return <div>—</div>;
      const m = Math.floor(minutes);
      const h = Math.floor(m / 60);
      const mins = m % 60;
      if (h > 0) {
        return <div>{h}h {mins}m</div>;
      }
      return <div>{mins}m</div>;
    }
  },
  {
    header: "Audio",
    cell: ({ row }) => (
      <Button
        size="sm"
        variant="outline"
        onClick={() => window.open(row.original.audio_url, "_blank")}
      >
        <IconPlayerPlay size={16} />
        Play
      </Button>
    )
  },
  {
    header: "Transcript",
    cell: ({ row }) => (
      <Button
        size="sm"
        variant="outline"
        onClick={() => window.open(row.original.transcript_url, "_blank")}
      >
        <IconExternalLink size={16} />
        View
      </Button>
    )
  },
  {
    header: "Meeting Link",
    cell: ({ row }) => (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => window.open(row.original.meeting_link, "_blank")}
      >
        Link
      </Button>
    )
  },
  {
    accessorKey: "created_at",
    header: "Date",
    cell: ({ row }) => (
      <div>{new Date(row.original.created_at).toLocaleString()}</div>
    )
  },
]
