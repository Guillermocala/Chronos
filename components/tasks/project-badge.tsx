import Link from "next/link";

import { Badge } from "@/components/ui/badge";

type Props = { id: string; code_prefix: string; name: string; color: string | null };

/** Prefijo del proyecto con su color; enlaza al proyecto. */
export function ProjectBadge({ id, code_prefix, name, color }: Props) {
  return (
    <Badge variant="outline" title={name} translate="no" render={<Link href={`/projects/${id}`} />}>
      {/* El color lo elige el usuario por proyecto, por eso va inline. */}
      <span
        aria-hidden
        className="size-2 rounded-full bg-muted-foreground"
        style={color ? { backgroundColor: color } : undefined}
      />
      {code_prefix}
    </Badge>
  );
}
