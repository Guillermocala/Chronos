import { Badge } from "@/components/ui/badge";
import type { ParsedItem } from "@/lib/granola/parse";

export const ITEM_TYPE_LABELS: Record<ParsedItem["type"], string> = {
  task: "Tarea",
  follow_up: "Seguimiento",
  ticket: "Ticket",
};

const PRIORITY_LABELS = { 1: "Alta", 2: "Media", 3: "Baja" } as const;

/** Resumen visual de lo que Chronos entendió de una línea. */
export function ParsedItemBadges({ item }: { item: ParsedItem }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={item.type === "ticket" ? "default" : "secondary"}>{ITEM_TYPE_LABELS[item.type]}</Badge>
      {item.projectPrefix && (
        <Badge variant={item.projectId ? "outline" : "destructive"}>@{item.projectPrefix}</Badge>
      )}
      {item.due_date && <Badge variant="outline">Vence {item.due_date}</Badge>}
      {item.planned_on && <Badge variant="outline">Mi día {item.planned_on}</Badge>}
      {item.priority !== 2 && <Badge variant="outline">Prioridad {PRIORITY_LABELS[item.priority]}</Badge>}
      {item.waiting_on && <Badge variant="outline">Esperando a {item.waiting_on}</Badge>}
      {item.estimated_hours !== null && <Badge variant="outline">~{item.estimated_hours} h</Badge>}
      {item.doc_url && <Badge variant="outline">Drive: {item.doc_kind}</Badge>}
      {item.tags.map((tag) => (
        <Badge key={tag} variant="outline">
          #{tag}
        </Badge>
      ))}
    </div>
  );
}
