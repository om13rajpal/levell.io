"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, subDays, subWeeks, subMonths, subQuarters, subYears } from "date-fns"

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
import { RefreshCw, CalendarX2 } from "lucide-react"

const chartConfig = {
  score: {
    label: "Call Score",
    color: "var(--primary)"
  },
} satisfies ChartConfig

// Time range filter options
const timeRangeOptions = [
  { value: "all", label: "All Calls" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "last_quarter", label: "Last Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
]

function getTimeRangeDates(range: string): { start: Date | null; end: Date | null } {
  const now = new Date()
  switch (range) {
    case "today":
      return { start: startOfDay(now), end: now }
    case "yesterday": {
      const yesterday = subDays(now, 1)
      return { start: startOfDay(yesterday), end: startOfDay(now) }
    }
    case "this_week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: now }
    case "last_week": {
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      const lastWeekEnd = startOfWeek(now, { weekStartsOn: 1 })
      return { start: lastWeekStart, end: lastWeekEnd }
    }
    case "this_month":
      return { start: startOfMonth(now), end: now }
    case "last_month": {
      const lastMonthStart = startOfMonth(subMonths(now, 1))
      const lastMonthEnd = startOfMonth(now)
      return { start: lastMonthStart, end: lastMonthEnd }
    }
    case "this_quarter":
      return { start: startOfQuarter(now), end: now }
    case "last_quarter": {
      const lastQStart = startOfQuarter(subQuarters(now, 1))
      const lastQEnd = startOfQuarter(now)
      return { start: lastQStart, end: lastQEnd }
    }
    case "this_year":
      return { start: startOfYear(now), end: now }
    case "last_year": {
      const lastYearStart = startOfYear(subYears(now, 1))
      const lastYearEnd = startOfYear(now)
      return { start: lastYearStart, end: lastYearEnd }
    }
    default:
      return { start: null, end: null }
  }
}

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeFilter, setTimeFilter] = React.useState("all")
  const [chartData, setChartData] = React.useState<Array<{ index: number; score: number; title: string; date: string }>>([])
  const [totalScoredCount, setTotalScoredCount] = React.useState(0)
  const [hasTranscripts, setHasTranscripts] = React.useState(false)

  React.useEffect(() => {
    if (isMobile) {
      setTimeFilter("this_week")
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
        .select('title, ai_overall_score, created_at')
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

        const chartDataPoints = data.map((item, idx) => ({
          index: idx + 1,
          score: Math.round(Number(item.ai_overall_score)),
          title: item.title || `Call ${idx + 1}`,
          date: item.created_at || "",
        }))

        setChartData(chartDataPoints)
      }
    }

    fetchChartData()

    return () => {
      isMounted = false
    }
  }, [])

  // Filter data based on time range
  const filteredData = React.useMemo(() => {
    if (chartData.length === 0) return []

    if (timeFilter === "all") return chartData

    const { start, end } = getTimeRangeDates(timeFilter)
    if (!start || !end) return chartData

    return chartData.filter((item) => {
      if (!item.date) return false
      const itemDate = new Date(item.date)
      return itemDate >= start && itemDate < end
    })
  }, [chartData, timeFilter])

  const transcriptsShown = filteredData.length
  const currentLabel = timeRangeOptions.find((o) => o.value === timeFilter)?.label || "All Calls"

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Call Scores</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {totalScoredCount > 0
              ? `Showing ${transcriptsShown} of ${totalScoredCount} scored calls (${currentLabel})`
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
            value={timeFilter}
            onValueChange={(value) => {
              if (value) setTimeFilter(value)
            }}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="all">All Calls</ToggleGroupItem>
            <ToggleGroupItem value="this_week">This Week</ToggleGroupItem>
            <ToggleGroupItem value="this_month">This Month</ToggleGroupItem>
          </ToggleGroup>

          <Select value={timeFilter} onValueChange={(value) => {
            if (value) setTimeFilter(value)
          }}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
            >
              <SelectValue placeholder="All Calls" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {timeRangeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>

      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[250px] text-center">
            {/* Check if there are transcripts but none scored */}
            {hasTranscripts ? (
              chartData.length > 0 ? (
                <>
                  {/* Scored calls exist but none in selected time range */}
                  <CalendarX2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="font-semibold text-foreground mb-1">No scored calls in this time period</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Try selecting a different date range to see your call scores.
                  </p>
                </>
              ) : (
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
              )
            ) : (
              <>
                {/* Syncing animation - waiting for Fireflies */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "2.5s" }} />
                  <div className="absolute inset-3 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.3s" }} />
                  <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 text-primary animate-spin" style={{ animationDuration: "2s" }} />
                  </div>
                </div>
                <p className="font-semibold text-foreground mb-1">Syncing your calls</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Connecting to Fireflies to fetch your recorded conversations...
                </p>
                {/* Sync wave animation */}
                <div className="flex items-center gap-1 mt-4">
                  <div className="h-3 w-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0ms" }} />
                  <div className="h-4 w-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: "100ms" }} />
                  <div className="h-5 w-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: "200ms" }} />
                  <div className="h-4 w-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: "300ms" }} />
                  <div className="h-3 w-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: "400ms" }} />
                </div>
              </>
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