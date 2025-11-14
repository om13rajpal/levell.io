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

export function SectionCards() {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      
      {/* Total Calls */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Calls</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            1,248
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              +3.2%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Call volume increased <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Compared to last period
          </div>
        </CardFooter>
      </Card>

      {/* Avg Score */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Avg Score</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            82
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              +1.1%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Improved call quality <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Avg score trending upwards
          </div>
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