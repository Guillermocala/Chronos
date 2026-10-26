"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

import { REPORT_RANGE_MONTHS as RANGE_OPTIONS } from "@/lib/reports/cashflow";

type Props = {
  project?: string;
  months: number;
  projects: { id: string; name: string; code_prefix: string }[];
};

export function ReportFilters({ project, months, projects }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefWith = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        size="sm"
        className="max-w-full sm:max-w-xs"
        aria-label="Proyecto"
        value={project ?? ""}
        onChange={(e) =>
          router.push(hrefWith({ project: e.target.value || undefined }))
        }
      >
        <NativeSelectOption value="">Todos los proyectos</NativeSelectOption>
        {projects.map((p) => (
          <NativeSelectOption key={p.id} value={p.id}>
            {p.code_prefix} · {p.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <nav className="flex gap-1" aria-label="Rango de meses">
        {RANGE_OPTIONS.map((m) => (
          <Button
            key={m}
            size="sm"
            variant={m === months ? "secondary" : "ghost"}
            nativeButton={false}
            render={
              <Link
                href={hrefWith({ months: m === 6 ? undefined : String(m) })}
                aria-current={m === months ? "page" : undefined}
              />
            }
          >
            {m} meses
          </Button>
        ))}
      </nav>
    </div>
  );
}
