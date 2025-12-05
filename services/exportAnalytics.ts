"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

// Types
interface RepPerformance {
  id: string;
  name: string;
  email: string;
  totalCalls: number;
  avgScore: number;
  bestCategory: string;
  needsImprovement: string;
}

interface TeamStats {
  totalCalls: number;
  avgScore: number;
  trend: number;
  avgPerRep: number;
}

interface CategoryPerformance {
  category: string;
  score: number;
}

interface ScoreDistribution {
  name: string;
  value: number;
  color: string;
}

interface ScoreTrend {
  index?: number;
  date?: string;
  score: number;
  title?: string;
}

interface TopPerformer {
  id: string;
  name: string;
  email: string;
  avgScore: number;
  totalCalls: number;
}

interface Company {
  id: string;
  company_name: string;
  callCount?: number;
  riskCount?: number;
}

interface CallsPerRep {
  id: string;
  name: string;
  email: string;
  totalCalls: number;
  avgScore: number;
}

interface ExportData {
  teamName: string;
  teamStats: TeamStats;
  repPerformance: RepPerformance[];
  categoryPerformance: CategoryPerformance[];
  scoreDistribution: ScoreDistribution[];
  scoreTrendsData: ScoreTrend[];
  topPerformers: TopPerformer[];
  topCompaniesByVolume: Company[];
  criticalRiskCompanies: Company[];
  callsPerRepData?: CallsPerRep[];
}

/**
 * Export full analytics report to PDF with charts and all data
 */
export async function exportFullPDF(
  data: ExportData,
  chartContainerIds: string[]
): Promise<void> {
  const {
    teamName,
    teamStats,
    repPerformance,
    categoryPerformance,
    scoreDistribution,
    scoreTrendsData,
    topPerformers,
    topCompaniesByVolume,
    criticalRiskCompanies,
    callsPerRepData,
  } = data;

  // Create PDF document
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // Helper to get score color
  const getScoreColor = (score: number): [number, number, number] => {
    if (score >= 80) return [34, 197, 94]; // green
    if (score >= 60) return [234, 179, 8]; // yellow
    return [239, 68, 68]; // red
  };

  // ==================== COVER PAGE ====================
  // Header background
  doc.setFillColor(99, 102, 241); // Primary color (indigo)
  doc.rect(0, 0, pageWidth, 60, "F");

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("Team Analytics Report", pageWidth / 2, 30, { align: "center" });

  // Team name
  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text(teamName, pageWidth / 2, 45, { align: "center" });

  // Date
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  yPos = 75;
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);

  // ==================== EXECUTIVE SUMMARY ====================
  yPos = 90;
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(99, 102, 241);
  doc.text("Executive Summary", margin, yPos);

  yPos += 12;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);

  // Stats cards
  const statsData = [
    { label: "Total Calls Analyzed", value: teamStats.totalCalls.toString() },
    { label: "Team Average Score", value: teamStats.avgScore > 0 ? `${teamStats.avgScore}/100` : "N/A" },
    { label: "Score Trend (30 days)", value: `${teamStats.trend > 0 ? "+" : ""}${teamStats.trend}%` },
    { label: "Avg Calls Per Rep", value: `${teamStats.avgPerRep} calls` },
  ];

  const cardWidth = (pageWidth - margin * 2 - 15) / 2;
  const cardHeight = 25;

  statsData.forEach((stat, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + col * (cardWidth + 5);
    const y = yPos + row * (cardHeight + 5);

    // Card background
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, "F");

    // Label
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(stat.label, x + 5, y + 8);

    // Value
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(stat.value, x + 5, y + 19);
    doc.setFont("helvetica", "normal");
  });

  yPos += cardHeight * 2 + 10;

  // ==================== SCORE DISTRIBUTION ====================
  checkPageBreak(50);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(99, 102, 241);
  doc.text("Score Distribution", margin, yPos);

  yPos += 8;
  const distributionColors: Record<string, [number, number, number]> = {
    "Excellent (80-100)": [34, 197, 94],
    "Good (60-79)": [59, 130, 246],
    "Needs Work (40-59)": [234, 179, 8],
    "Poor (0-39)": [239, 68, 68],
  };

  const totalScored = scoreDistribution.reduce((acc, d) => acc + d.value, 0);
  scoreDistribution.forEach((dist, index) => {
    const color = distributionColors[dist.name] || [128, 128, 128];
    const percentage = totalScored > 0 ? Math.round((dist.value / totalScored) * 100) : 0;

    doc.setFillColor(color[0], color[1], color[2]);
    doc.circle(margin + 5, yPos + index * 8, 3, "F");

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`${dist.name}: ${dist.value} calls (${percentage}%)`, margin + 12, yPos + index * 8 + 1);
  });

  yPos += scoreDistribution.length * 8 + 8;

  // ==================== TOP PERFORMERS ====================
  checkPageBreak(60);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(99, 102, 241);
  doc.text("Top 5 Performers", margin, yPos);

  yPos += 5;
  if (topPerformers.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Rank", "Name", "Calls", "Avg Score"]],
      body: topPerformers.map((performer, i) => [
        `#${i + 1}`,
        performer.name || "No Name",
        performer.totalCalls.toString(),
        performer.avgScore.toString(),
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [99, 102, 241],
        textColor: 255,
        fontSize: 10,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 9,
      },
      columnStyles: {
        0: { cellWidth: 15 },
        3: { halign: "center" },
      },
      margin: { left: margin, right: margin },
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text("No data available", margin, yPos + 8);
    yPos += 12;
  }

  // ==================== CALLS PER REP ====================
  if (callsPerRepData && callsPerRepData.length > 0) {
    checkPageBreak(60);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(99, 102, 241);
    doc.text("Calls Per Rep", margin, yPos);

    yPos += 5;
    autoTable(doc, {
      startY: yPos,
      head: [["Name", "Email", "Total Calls", "Avg Score"]],
      body: callsPerRepData.map((rep) => [
        rep.name || "No Name",
        rep.email,
        rep.totalCalls.toString(),
        rep.avgScore.toString(),
      ]),
      theme: "striped",
      headStyles: {
        fillColor: [99, 102, 241],
        textColor: 255,
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 9,
      },
      columnStyles: {
        2: { halign: "center", cellWidth: 25 },
        3: { halign: "center", cellWidth: 25 },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const score = parseInt(data.cell.raw as string);
          if (score >= 80) {
            data.cell.styles.textColor = [34, 197, 94];
          } else if (score >= 60) {
            data.cell.styles.textColor = [234, 179, 8];
          } else {
            data.cell.styles.textColor = [239, 68, 68];
          }
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  // ==================== CHARTS PAGE ====================
  doc.addPage();
  yPos = margin;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(99, 102, 241);
  doc.text("Visual Analytics", margin, yPos);
  yPos += 10;

  // Chart titles for reference
  const chartTitles: Record<string, string> = {
    "chart-score-trends": "Call Scores Chart",
    "chart-top-performers": "Top 5 Performers",
    "chart-category-performance": "Category Performance",
    "chart-score-distribution": "Score Distribution",
  };

  // Capture and add each chart
  for (const containerId of chartContainerIds) {
    const element = document.getElementById(containerId);
    if (element) {
      try {
        // Add chart title
        const chartTitle = chartTitles[containerId] || containerId;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);

        // Check if we need a new page before the title
        if (yPos + 10 > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
        }

        doc.text(chartTitle, margin, yPos);
        yPos += 5;

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // Check if we need a new page for the chart
        if (yPos + imgHeight > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
          // Re-add title on new page
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0);
          doc.text(chartTitle, margin, yPos);
          yPos += 5;
        }

        doc.addImage(imgData, "PNG", margin, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 8;
      } catch (err) {
        console.error(`Failed to capture chart ${containerId}:`, err);
      }
    }
  }

  // ==================== CATEGORY PERFORMANCE ====================
  doc.addPage();
  yPos = margin;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(99, 102, 241);
  doc.text("Category Performance", margin, yPos);

  yPos += 10;
  if (categoryPerformance.length > 0) {
    categoryPerformance.forEach((cat, index) => {
      const barWidth = (cat.score / 100) * (pageWidth - margin * 2 - 60);
      const color = getScoreColor(cat.score);

      // Category label
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(cat.category, margin, yPos + index * 12);

      // Progress bar background
      doc.setFillColor(229, 231, 235);
      doc.roundedRect(margin + 50, yPos + index * 12 - 4, pageWidth - margin * 2 - 80, 6, 2, 2, "F");

      // Progress bar fill
      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(margin + 50, yPos + index * 12 - 4, barWidth, 6, 2, 2, "F");

      // Score
      doc.setFontSize(9);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(`${cat.score}`, pageWidth - margin - 10, yPos + index * 12);
    });
    yPos += categoryPerformance.length * 12 + 8;
  }

  // ==================== REP PERFORMANCE TABLE ====================
  checkPageBreak(60);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(99, 102, 241);
  doc.text("Rep Performance Comparison", margin, yPos);

  yPos += 5;
  if (repPerformance.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Name", "Email", "Calls", "Score", "Best Category", "Needs Improvement"]],
      body: repPerformance.map((rep) => [
        rep.name || "No Name",
        rep.email,
        rep.totalCalls.toString(),
        rep.avgScore.toString(),
        rep.bestCategory,
        rep.needsImprovement,
      ]),
      theme: "striped",
      headStyles: {
        fillColor: [99, 102, 241],
        textColor: 255,
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
      },
      columnStyles: {
        1: { cellWidth: 45 },
        2: { halign: "center", cellWidth: 15 },
        3: { halign: "center", cellWidth: 15 },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const score = parseInt(data.cell.raw as string);
          if (score >= 80) {
            data.cell.styles.textColor = [34, 197, 94];
          } else if (score >= 60) {
            data.cell.styles.textColor = [234, 179, 8];
          } else {
            data.cell.styles.textColor = [239, 68, 68];
          }
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  // ==================== COMPANY INSIGHTS ====================
  checkPageBreak(80);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(99, 102, 241);
  doc.text("Company Insights", margin, yPos);

  yPos += 8;

  // Top Companies by Volume
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Top Companies by Call Volume", margin, yPos);

  yPos += 5;
  if (topCompaniesByVolume.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Company", "Calls"]],
      body: topCompaniesByVolume.map((company) => [
        company.company_name,
        (company.callCount || 0).toString(),
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [99, 102, 241],
        textColor: 255,
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9 },
      margin: { left: margin, right: margin },
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text("No data available", margin, yPos + 5);
    yPos += 10;
  }

  // Critical Risk Companies
  checkPageBreak(50);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(239, 68, 68);
  doc.text("Companies with Critical Risks", margin, yPos);

  yPos += 4;
  if (criticalRiskCompanies.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Company", "Risk Count"]],
      body: criticalRiskCompanies.map((company) => [
        company.company_name,
        (company.riskCount || 0).toString(),
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [239, 68, 68],
        textColor: 255,
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9 },
      margin: { left: margin, right: margin },
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(34, 197, 94);
    doc.text("No critical risks detected", margin, yPos + 5);
    yPos += 10;
  }

  // ==================== SCORE TRENDS ====================
  if (scoreTrendsData.length > 0) {
    checkPageBreak(80);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(99, 102, 241);
    doc.text("Call Scores (Recent)", margin, yPos);

    yPos += 4;

    // Handle both old (date-based) and new (index-based) data structures
    const hasIndex = scoreTrendsData[0]?.index !== undefined;

    autoTable(doc, {
      startY: yPos,
      head: [hasIndex ? ["#", "Call Title", "Score"] : ["Date", "Average Score"]],
      body: scoreTrendsData.slice(-20).map((trend) =>
        hasIndex
          ? [`#${trend.index}`, trend.title || `Call ${trend.index}`, trend.score.toString()]
          : [trend.date || "", trend.score.toString()]
      ),
      theme: "striped",
      headStyles: {
        fillColor: [99, 102, 241],
        textColor: 255,
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9 },
      columnStyles: hasIndex ? {
        0: { cellWidth: 15 },
        2: { halign: "center", cellWidth: 20 },
      } : {},
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === (hasIndex ? 2 : 1)) {
          const score = parseInt(data.cell.raw as string);
          if (score >= 80) {
            data.cell.styles.textColor = [34, 197, 94];
          } else if (score >= 60) {
            data.cell.styles.textColor = [234, 179, 8];
          } else {
            data.cell.styles.textColor = [239, 68, 68];
          }
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  // ==================== FOOTER ON ALL PAGES ====================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} of ${pageCount} | ${teamName} Analytics Report | Generated ${new Date().toLocaleDateString()}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }

  // Save the PDF
  doc.save(`${teamName.replace(/\s+/g, "-")}-analytics-${new Date().toISOString().split("T")[0]}.pdf`);
}
