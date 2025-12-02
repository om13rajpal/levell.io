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
import { useTranscriptStore } from "@/store/useTranscriptStore"

const chartConfig = {
  score: {
    label: "Call Score",
    color: "var(--primary)"
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")
  const transcripts = useTranscriptStore((s) => s.transcripts)
  const [chartData, setChartData] = React.useState<Array<{ date: string; score: number }>>([])

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  // Process transcripts into chart data
  React.useEffect(() => {
    if (!transcripts || transcripts.length === 0) {
      setChartData([])
      return
    }

    // Filter transcripts with valid scores and dates
    const scoredTranscripts = transcripts
      .filter((t) => t.ai_overall_score != null && !isNaN(t.ai_overall_score) && t.created_at)
      .map((t) => ({
        date: new Date(t.created_at).toISOString().split('T')[0], // YYYY-MM-DD format
        score: Number(t.ai_overall_score),
        timestamp: new Date(t.created_at).getTime()
      }))
      .sort((a, b) => a.timestamp - b.timestamp)

    // Group by date and calculate average score per day
    const groupedByDate = scoredTranscripts.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = []
      }
      acc[item.date].push(item.score)
      return acc
    }, {} as Record<string, number[]>)

    const processedData = Object.entries(groupedByDate).map(([date, scores]) => ({
      date,
      score: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    }))

    setChartData(processedData)
  }, [transcripts])

  // Filter data based on time range
  const filteredData = React.useMemo(() => {
    if (chartData.length === 0) return []

    const now = new Date()
    let cutoffDate = new Date()

    switch (timeRange) {
      case "7d":
        cutoffDate.setDate(now.getDate() - 7)
        break
      case "30d":
        cutoffDate.setDate(now.getDate() - 30)
        break
      case "90d":
        cutoffDate.setDate(now.getDate() - 90)
        break
      default:
        return chartData
    }

    return chartData.filter((item) => new Date(item.date) >= cutoffDate)
  }, [chartData, timeRange])

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Call Scores</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Scores for recent calls
          </span>
          <span className="@[540px]/card:hidden">Recent scores</span>
        </CardDescription>

        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(value) => {
              // Only update if a valid value is provided (prevents deselection issues)
              if (value) setTimeRange(value)
            }}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>

          <Select value={timeRange} onValueChange={(value) => {
            if (value) setTimeRange(value)
          }}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d">Last 3 months</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>

      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[250px] text-center">
            {/* Check if there are transcripts but none scored */}
            {transcripts && transcripts.length > 0 ? (
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
              <p className="text-muted-foreground">No calls available for the selected period</p>
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
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
              />

              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
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