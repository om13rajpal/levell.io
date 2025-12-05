"use client"

import { useEffect, useState } from "react"
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { supabase } from "@/lib/supabaseClient"
import { getTranscriptStats, getUserIdFromCache } from "@/lib/supabaseCache"

export function SectionCards() {
  const [totalCalls, setTotalCalls] = useState(0)
  const [avgScore, setAvgScore] = useState(0)
  const [scoredCount, setScoredCount] = useState(0)
  const [isScoring, setIsScoring] = useState(false)

  // Fetch stats directly from server without loading all transcripts
  useEffect(() => {
    let isMounted = true

    const fetchStats = async () => {
      const userId = getUserIdFromCache()
      if (!userId) return

      const stats = await getTranscriptStats(userId, supabase)

      if (isMounted) {
        setTotalCalls(stats.totalCount)
        setScoredCount(stats.scoredCount)
        setAvgScore(stats.avgScore)
        setIsScoring(stats.isScoring)
      }
    }

    fetchStats()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">

      {/* Total Calls */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Calls</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalCalls.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              Live Data
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Total recorded calls <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Updated from your transcripts
          </div>
        </CardFooter>
      </Card>

      {/* Avg Score */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Avg Score</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {avgScore > 0 ? (
              avgScore
            ) : isScoring ? (
              <div className="flex items-center gap-2">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                </div>
                <span className="text-lg text-muted-foreground">Scoring...</span>
              </div>
            ) : (
              "—"
            )}
          </CardTitle>
          <CardAction>
            {isScoring ? (
              <Badge variant="outline" className="border-primary/30 text-primary">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse mr-1" />
                Processing
              </Badge>
            ) : (
              <Badge variant="outline">
                <IconTrendingUp />
                Live Data
              </Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {isScoring && scoredCount === 0 ? (
            <>
              <div className="line-clamp-1 flex gap-2 font-medium text-primary">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing your calls
              </div>
              <div className="text-muted-foreground">
                AI scoring in progress...
              </div>
            </>
          ) : isScoring ? (
            <>
              <div className="line-clamp-1 flex gap-2 font-medium">
                {scoredCount} of {totalCalls} calls scored
              </div>
              <div className="text-muted-foreground">
                More scores coming soon...
              </div>
            </>
          ) : (
            <>
              <div className="line-clamp-1 flex gap-2 font-medium">
                Average call quality <IconTrendingUp className="size-4" />
              </div>
              <div className="text-muted-foreground">
                Based on AI analysis scores
              </div>
            </>
          )}
        </CardFooter>
      </Card>

      {/* Critical Risks */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Critical Risks</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            7
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingDown />
              -8%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Fewer high-risk calls <IconTrendingDown className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Risk levels dropping
          </div>
        </CardFooter>
      </Card>

      {/* Pending Tasks */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Pending Tasks</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            12
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              +4
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Tasks accumulating <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Needs review & completion
          </div>
        </CardFooter>
      </Card>

    </div>
  )
}