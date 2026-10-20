"use client";

import { SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

type Props = {
  project?: string;
  q?: string;
  projects: { id: string; name: string; code_prefix: string }[];
};

export function NoteFilters({ project, q, projects }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const go = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        role="search"
        className="w-full max-w-xs"
        onSubmit={(e) => {
          e.preventDefault();
          go({
            q:
              String(new FormData(e.currentTarget).get("q") ?? "").trim() ||
              undefined,
          });
        }}
      >
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            name="q"
            defaultValue={q}
            placeholder="Buscar por título…"
            aria-label="Buscar notas"
          />
        </InputGroup>
      </form>
      <NativeSelect
        size="sm"
        aria-label="Proyecto"
        value={project ?? ""}
        onChange={(e) => go({ project: e.target.value || undefined })}
      >
        <NativeSelectOption value="">Todos los proyectos</NativeSelectOption>
        <NativeSelectOption value="personal">Sin proyecto</NativeSelectOption>
        {projects.map((p) => (
          <NativeSelectOption key={p.id} value={p.id}>
            {p.code_prefix} · {p.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
