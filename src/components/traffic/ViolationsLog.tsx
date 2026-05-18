import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldAlert, Trash2, Siren } from "lucide-react";
import type { ViolationEvent } from "@/lib/traffic-types";

const laneName = (l: ViolationEvent["lane"]) =>
  l === "N" ? "North" : l === "S" ? "South" : "West";

interface Props {
  violations: ViolationEvent[];
  onClear: () => void;
  onPush?: (lane: "N" | "S" | "W") => void;
  canPush?: boolean;
}

export function ViolationsLog({ violations, onClear, onPush, canPush }: Props) {
  return (
    <Card className="panel border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-signal-red" />
          <h3 className="text-sm uppercase tracking-widest text-muted-foreground">Violation Log</h3>
          <Badge variant="outline" className="ml-1 text-[10px] border-signal-red/40 text-signal-red">
            {violations.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {canPush && onPush && (
            <>
              {(["N", "S", "W"] as const).map((l) => (
                <Button
                  key={l}
                  size="sm" variant="outline"
                  onClick={() => onPush(l)}
                  className="h-7 px-2 text-xs border-signal-red/40 text-signal-red hover:bg-signal-red/10 hover:text-signal-red"
                >
                  <Siren className="h-3 w-3 mr-1" /> Push {l}
                </Button>
              ))}
            </>
          )}
          <Button
            size="sm" variant="ghost"
            onClick={onClear}
            disabled={!violations.length}
            className="h-7 px-2 text-xs"
          >
            <Trash2 className="h-3 w-3 mr-1" /> Clear
          </Button>
        </div>
      </div>

      {violations.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          No violations recorded. The system is monitoring red-light infractions in real time.
        </div>
      ) : (
        <ScrollArea className="h-[260px] rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 text-[11px] uppercase tracking-widest">Lane</TableHead>
                <TableHead className="h-9 text-[11px] uppercase tracking-widest">Time</TableHead>
                <TableHead className="h-9 text-[11px] uppercase tracking-widest">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {violations.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="py-2">
                    <span className="font-mono-tab text-xs font-semibold">
                      {v.lane} · {laneName(v.lane)}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 font-mono-tab text-xs text-muted-foreground">
                    {new Date(v.timestamp).toLocaleTimeString()}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge className="bg-signal-red/15 text-signal-red border border-signal-red/40 hover:bg-signal-red/20 text-[10px]">
                      RED-LIGHT
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </Card>
  );
}
