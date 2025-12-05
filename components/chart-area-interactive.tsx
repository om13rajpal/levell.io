"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { supabase } from "@/lib/supabaseClient"
import { getUserIdFromCache } from "@/lib/supabaseCache"

const chartConfig = {
  score: {
    label: "Call Score",
    color: "var(--primary)"
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [percentFilter, setPercentFilter] = React.useState("100")
  const [chartData, setChartData] = React.useState<Array<{ index: number; score: number; title: string }>>([])
  const [totalScoredCount, setTotalScoredCount] = React.useState(0)
  const [hasTranscripts, setHasTranscripts] = React.useState(false)

  React.useEffect(() => {
    if (isMobile) {
      setPercentFilter("50")
    }
  }, [isMobile])

  // Fetch all scored transcripts for the chart
  React.useEffect(() => {
    let isMounted = true

    const fetchChartData = async () => {
      const userId = getUserIdFromCache()
      if (!userId) return

      // First check if user has any transcripts
      const { count: totalCount } = await supabase
        .from('transcripts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (isMounted) {
        setHasTranscripts((totalCount || 0) > 0)
      }

      // Fetch all scored transcripts for the chart (no date limit)
      const { data, error } = await supabase
        .from('transcripts')
        .select('title, ai_overall_score')
        .eq('user_id', userId)
        .not('ai_overall_score', 'is', null)
        .not('duration', 'is', null)
        .gte('duration', 5)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching chart data:', error)
        return
      }

      if (isMounted && data) {
        setTotalScoredCount(data.length)

        // Create individual data points for each call (not grouped by date)
        const chartDataPoints = data.map((item, idx) => ({
          index: idx + 1,
          score: Math.round(Number(item.ai_overall_score)),
          title: item.title || `Call ${idx + 1}`
        }))

        setChartData(chartDataPoints)
      }
    }

    fetchChartData()

    return () => {
      isMounted = false
    }
  }, [])

  // Filter data based on percentage of total transcripts
  const filteredData = React.useMemo(() => {
    if (chartData.length === 0) return []

    const percent = parseInt(percentFilter)
    const dataPointsToShow = Math.max(1, Math.ceil((chartData.length * percent) / 100))

    // Show the most recent N% of data points
    return chartData.slice(-dataPointsToShow)
  }, [chartData, percentFilter])

  // Calculate how many transcripts are shown
  const transcriptsShown = React.useMemo(() => {
    const percent = parseInt(percentFilter)
    return Math.max(1, Math.ceil((totalScoredCount * percent) / 100))
  }, [totalScoredCount, percentFilter])

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Call Scores</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {totalScoredCount > 0
              ? `Showing ${transcriptsShown} of ${totalScoredCount} scored calls`
              : "Scores for your calls"
            }
          </span>
          <span className="@[540px]/card:hidden">
            {totalScoredCount > 0 ? `${transcriptsShown}/${totalScoredCount} calls` : "Recent scores"}
          </span>
        </CardDescription>

        <CardAction>
          <ToggleGroup
            type="single"
            value={percentFilter}
            onValueChange={(value) => {
              // Only update if a valid value is provided (prevents deselection issues)
              if (value) setPercentFilter(value)
            }}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="100">All Calls</ToggleGroupItem>
            <ToggleGroupItem value="50">Recent 50%</ToggleGroupItem>
            <ToggleGroupItem value="10">Recent 10%</ToggleGroupItem>
          </ToggleGroup>

          <Select value={percentFilter} onValueChange={(value) => {
            if (value) setPercentFilter(value)
          }}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
            >
              <SelectValue placeholder="All Calls" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="100">All Calls</SelectItem>
              <SelectItem value="50">Recent 50%</SelectItem>
              <SelectItem value="10">Recent 10%</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>

      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[250px] text-center">
            {/* Check if there are transcripts but none scored */}
            {hasTranscripts ? (
              <>
                {/* Animated scoring indicator */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
                  <div className="absolute inset-3 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.5s" }} />
                  <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <svg
                      className="h-8 w-8 text-primary"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="animate-pulse"
                      />
                    </svg>
                  </div>
                </div>
                <p className="font-semibold text-foreground mb-1">Scoring your calls</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Our AI is analyzing your conversations. Scores will appear here shortly.
                </p>
                {/* Progress dots */}
                <div className="flex items-center gap-1.5 mt-4">
                  <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">No scored calls available yet</p>
            )}
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="fillScore" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--primary)"
                    stopOpacity={0.9}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--primary)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} />

              <XAxis
                dataKey="index"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => `#${value}`}
              />

              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value, payload) => {
                      const item = payload?.[0]?.payload
                      return item?.title || `Call #${value}`
                    }}
                    indicator="dot"
                  />
                }
              />

              <Area
                dataKey="score"
                type="natural"
                fill="url(#fillScore)"
                stroke="var(--primary)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}