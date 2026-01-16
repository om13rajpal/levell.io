"use client";

import { AlertTriangle, TrendingUp, Phone, Users } from "lucide-react";

export function DashboardMockup() {
  return (
    <div className="relative bg-card rounded-xl border shadow-2xl overflow-hidden">
      {/* Window Chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 text-center text-xs text-muted-foreground">
          levvl - Dashboard
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="p-4 space-y-4">
        {/* Attention Banner */}
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-primary">
                7 calls need attention
              </p>
              <p className="text-xs text-muted-foreground">
                Low scores detected this week
              </p>
            </div>
          </div>
          <button className="text-xs font-medium text-primary hover:underline">
            View all
          </button>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-3">
          {/* Team Score */}
          <div className="p-3 rounded-lg bg-background border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              Team Score
            </p>
            <p className="text-2xl font-bold text-score-good">68</p>
            <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-score-good rounded-full"
                style={{ width: "68%" }}
              />
            </div>
          </div>

          {/* Total Calls */}
          <div className="p-3 rounded-lg bg-background border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              Calls
            </p>
            <p className="text-2xl font-bold text-foreground">312</p>
            <p className="text-[10px] text-muted-foreground mt-2">this week</p>
          </div>

          {/* Trend */}
          <div className="p-3 rounded-lg bg-background border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              Trend
            </p>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-score-excellent" />
              <p className="text-2xl font-bold text-score-excellent">+12%</p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">vs last week</p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-3">
          {/* Rep Leaderboard */}
          <div className="p-3 rounded-lg bg-background border">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs font-medium text-foreground">
                Rep Performance
              </p>
            </div>
            <div className="space-y-2">
              {[
                { rank: 1, name: "Sarah M.", score: 84, color: "bg-score-excellent" },
                { rank: 2, name: "James K.", score: 77, color: "bg-score-good" },
                { rank: 3, name: "Mike T.", score: 52, color: "bg-score-fair" },
              ].map((rep) => (
                <div key={rep.rank} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-3">{rep.rank}</span>
                  <span className="flex-1 text-foreground truncate">{rep.name}</span>
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${rep.color} rounded-full`}
                      style={{ width: `${rep.score}%` }}
                    />
                  </div>
                  <span className={`font-semibold w-6 text-right ${
                    rep.score >= 80 ? "text-score-excellent" :
                    rep.score >= 65 ? "text-score-good" :
                    rep.score >= 50 ? "text-score-fair" : "text-score-poor"
                  }`}>
                    {rep.score}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Calls */}
          <div className="p-3 rounded-lg bg-background border">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs font-medium text-foreground">
                Recent Calls
              </p>
            </div>
            <div className="space-y-2">
              {[
                { company: "Acme Corp", score: 87, sentiment: "positive" },
                { company: "TechStart", score: 41, sentiment: "negative" },
                { company: "GlobalCo", score: 62, sentiment: "neutral" },
              ].map((call, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-foreground truncate flex-1">{call.company}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        call.score >= 80
                          ? "bg-score-excellent"
                          : call.score >= 50
                          ? "bg-score-fair"
                          : "bg-score-poor"
                      }`}
                    />
                    <span
                      className={`font-semibold ${
                        call.score >= 80
                          ? "text-score-excellent"
                          : call.score >= 50
                          ? "text-score-fair"
                          : "text-score-poor"
                      }`}
                    >
                      {call.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
