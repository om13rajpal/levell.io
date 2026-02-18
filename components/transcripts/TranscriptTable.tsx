"use client";

import React from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  Row,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import {
  IconGripVertical,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconExternalLink,
  IconPlayerPlay,
  IconRefresh,
  IconCheck,
  IconMinus,
  IconAlertTriangle,
  IconSearch,
  IconEye,
  IconBrain,
  IconTarget,
  IconPhone,
} from "@tabler/icons-react";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import {
  Table,
  TableHead,
  TableCell,
  TableRow,
  TableHeader,
  TableBody,
} from "@/components/ui/table";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import axiosClient from "@/lib/axiosClient";

// ========== TYPES ========== //

export type Transcript = {
  id: number;
  title: string;
  duration: number;
  audio_url: string;
  video_url?: string;
  transcript_url: string;
  meeting_link?: string;
  created_at: string;
  ai_overall_score?: number | null;
  ai_deal_signal?: string | null;
  ai_call_type?: string | null;
};

// Deal signal configuration
const DEAL_SIGNAL_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  healthy: {
    label: "Healthy",
    color: "border-emerald-500/50 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30",
    icon: IconCheck,
  },
  neutral: {
    label: "Neutral",
    color: "border-slate-500/50 text-slate-700 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/30",
    icon: IconMinus,
  },
  at_risk: {
    label: "At Risk",
    color: "border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30",
    icon: IconAlertTriangle,
  },
  critical: {
    label: "Critical",
    color: "border-rose-500/50 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30",
    icon: IconAlertTriangle,
  },
};

// Call type configuration
const CALL_TYPE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  discovery: {
    label: "Discovery",
    color: "border-blue-500/50 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30",
    icon: IconSearch,
  },
  demo: {
    label: "Demo",
    color: "border-purple-500/50 text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30",
    icon: IconEye,
  },
  coaching: {
    label: "Coaching",
    color: "border-indigo-500/50 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30",
    icon: IconBrain,
  },
  negotiation: {
    label: "Negotiation",
    color: "border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30",
    icon: IconTarget,
  },
  follow_up: {
    label: "Follow-up",
    color: "border-teal-500/50 text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30",
    icon: IconPhone,
  },
  closing: {
    label: "Closing",
    color: "border-emerald-500/50 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30",
    icon: IconCheck,
  },
};

// ========== DRAG HANDLE ========== //

const DragHandle = React.memo(function DragHandle({ id }: { id: number }) {
  const { attributes, listeners } = useSortable({ id });

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-6 hover:bg-transparent"
    >
      <IconGripVertical size={16} />
    </Button>
  );
});

// ========== TABLE COLUMNS ========== //

export const transcriptColumns: ColumnDef<Transcript>[] = [
  {
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  },

  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <div className="font-medium truncate max-w-[180px]">
        {row.original.title}
      </div>
    ),
  },

  {
    accessorKey: "duration",
    header: "Duration",
    cell: ({ row }) => {
      const minutes = row.original.duration;
      if (!minutes || minutes <= 0) return <Badge variant="outline">—</Badge>;
      const m = Math.floor(minutes);
      const h = Math.floor(m / 60);
      const mins = m % 60;
      if (h > 0) {
        return <Badge variant="outline">{h}h {mins}m</Badge>;
      }
      return <Badge variant="outline">{mins}m</Badge>;
    },
  },

  {
    accessorKey: "Call Score",
    header: "Score",
    cell: ({ row }) => {
      const score = row.original.ai_overall_score;
      if (score == null || isNaN(score)) {
        return (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </div>
            <span className="text-[10px] font-medium text-primary/80">Scoring</span>
          </div>
        );
      }
      return (
        <Badge
          variant="outline"
          className={
            score >= 80
              ? "border-green-500/50 text-green-700 dark:text-green-400"
              : score >= 60
              ? "border-yellow-500/50 text-yellow-700 dark:text-yellow-400"
              : "border-red-500/50 text-red-700 dark:text-red-400"
          }
        >
          {Math.round(score)}
        </Badge>
      );
    },
  },

  {
    accessorKey: "ai_deal_signal",
    header: "Deal Signal",
    cell: ({ row }) => {
      const signal = row.original.ai_deal_signal;
      if (!signal) return <span className="text-muted-foreground text-xs">—</span>;
      const config = DEAL_SIGNAL_CONFIG[signal];
      if (!config) return <span className="text-muted-foreground text-xs">{signal}</span>;
      const Icon = config.icon;
      return (
        <Badge variant="outline" className={`${config.color} text-[10px] px-2 py-0.5 flex items-center gap-1 w-fit`}>
          <Icon size={12} />
          {config.label}
        </Badge>
      );
    },
  },

  {
    accessorKey: "ai_call_type",
    header: "Call Type",
    cell: ({ row }) => {
      const callType = row.original.ai_call_type;
      if (!callType) return <span className="text-muted-foreground text-xs">—</span>;
      const config = CALL_TYPE_CONFIG[callType];
      if (!config) return <Badge variant="outline" className="text-[10px]">{callType}</Badge>;
      const Icon = config.icon;
      return (
        <Badge variant="outline" className={`${config.color} text-[10px] px-2 py-0.5 flex items-center gap-1 w-fit`}>
          <Icon size={12} />
          {config.label}
        </Badge>
      );
    },
  },

  {
    header: "Audio",
    cell: ({ row }) => (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          if (row.original.audio_url) {
            window.open(row.original.audio_url, "_blank");
          }
        }}
      >
        <IconPlayerPlay size={16} />
        Play
      </Button>
    ),
  },

  {
    header: "Transcript",
    cell: ({ row }) => (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          if (row.original.transcript_url)
            window.open(row.original.transcript_url, "_blank");
        }}
      >
        <IconExternalLink size={16} />
        View
      </Button>
    ),
  },

  {
    header: "Meeting Link",
    cell: ({ row }) => (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          if (row.original.meeting_link)
            window.open(row.original.meeting_link, "_blank");
        }}
      >
        Open
      </Button>
    ),
  },

  {
    accessorKey: "created_at",
    header: "Date",
    cell: ({ row }) => (
      <div>{new Date(row.original.created_at).toLocaleString()}</div>
    ),
  },
];

// ========== DRAGGABLE ROW ========== //

const DraggableRow = React.memo(function DraggableRow({ row }: { row: Row<Transcript> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  });

  return (
    <TableRow
      ref={setNodeRef}
      data-dragging={isDragging}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
});

// ========== MAIN TABLE COMPONENT ========== //

export function TranscriptTable({ data: initialData }: { data: Transcript[] }) {
  const [data, setData] = React.useState(initialData);
  const [syncLoading, setSyncLoading] = React.useState(false);

  React.useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor)
  );

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data.map((d) => d.id),
    [data]
  );

  // ⭐ SYNC BUTTON LOGIC
  const handleSync = React.useCallback(async () => {
    try {
      setSyncLoading(true);

      // Get authenticated user from Supabase
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        toast.error("Please log in to sync");
        setSyncLoading(false);
        return;
      }

      const userId = user.id;

      // Fetch the user's Fireflies API key from api_keys table
      const { data: apiKeyData, error: apiKeyError } = await supabase
        .from("api_keys")
        .select("fireflies")
        .eq("user_id", userId)
        .single();

      if (apiKeyError || !apiKeyData?.fireflies) {
        toast.error("Please connect your Fireflies account first in Settings > Integrations");
        setSyncLoading(false);
        return;
      }

      // Get current transcript count for skip parameter
      const skip = data.length;

      // Send Inngest event to sync transcripts
      const response = await axiosClient.post("/api/inngest/trigger", {
        event: "transcripts/sync.requested",
        data: {
          user_id: userId,
          skip: skip,
          token: apiKeyData.fireflies,
        },
      });

      if (response.status >= 200 && response.status < 300) {
        toast.success("Sync completed successfully");
      } else {
        toast.error("Sync failed. Please try again.");
      }
    } catch (err) {
      console.error("Sync error:", err);
      toast.error("Sync failed. Please try again.");
    } finally {
      setSyncLoading(false);
    }
  }, [data.length]);

  const table = useReactTable({
    data,
    columns: transcriptColumns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,

    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,

    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setData((prev) => {
        const oldIndex = prev.findIndex(d => d.id === active.id);
        const newIndex = prev.findIndex(d => d.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  return (
    <Tabs defaultValue="table" className="w-full flex flex-col gap-4">
      <TabsContent value="table" className="px-4 lg:px-6">

        {/* ⭐ Toolbar Row with Columns + Sync Button */}
        <div className="flex justify-between items-center mb-4 px-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((column) => (
                  <DropdownMenuItem
                    key={column.id}
                    onSelect={() =>
                      column.toggleVisibility(!column.getIsVisible())
                    }
                  >
                    <Checkbox
                      checked={column.getIsVisible()}
                      className="mr-2"
                    />
                    {column.id}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* ⭐ SYNC BUTTON (Animated) */}
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/10"
            onClick={handleSync}
            disabled={syncLoading}
          >
            <IconRefresh
              size={16}
              className={syncLoading ? "animate-spin" : ""}
            />
            {syncLoading ? "Syncing..." : "Sync"}
          </Button>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                          </svg>
                        </div>
                        <h3 className="font-semibold text-sm mb-1">No transcripts to display</h3>
                        <p className="text-xs text-muted-foreground">Your call transcripts will appear here once processed</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow row={row} key={row.id} />
                    ))}
                  </SortableContext>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>

        {/* PAGINATION */}
        <div className="flex justify-between items-center mt-4 px-2">
          <div className="flex items-center space-x-4">
            <Label>Rows per page</Label>
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 30, 40, 50].map((num) => (
                  <SelectItem key={num} value={String(num)}>
                    {num}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <IconChevronsLeft />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <IconChevronLeft />
            </Button>

            <span>
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </span>

            <Button
              variant="outline"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <IconChevronRight />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <IconChevronsRight />
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}