"use client";

import { ArrowLeftIcon, ArrowRightIcon, MicIcon, MicOffIcon, SquareIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { importDictation } from "@/app/(app)/import/actions";
import {
  DictationReview,
  toImportItems,
  useReviewRows,
  type ProjectOption,
} from "@/components/granola/dictation-review";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import type { ISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { interpretSpoken } from "@/lib/voice/normalize";

type PanelProps = {
  projects: ProjectOption[];
  today: ISODate;
  /** Proyecto preasignado (desde el detalle de un proyecto). */
  defaultProjectId?: string;
  /** Lo dictado entra a Mi día salvo que se diga otra fecha ("mañana voy a…"). */
  defaultMyDay?: boolean;
};

const TITLE = "Dictar tareas";
const DESCRIPTION =
  "Di qué vas a hacer y cuánto te toma, por ejemplo: “revisar la propuesta del proyecto web, dos horas, y luego llamar al contador, media hora”.";

/** Botón "Dictar" que abre el panel: hoja inferior en el celular, diálogo en escritorio. */
export function VoiceDictation({
  defaultOpen = false,
  ...panel
}: PanelProps & { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const isMobile = useIsMobile();
  const close = () => setOpen(false);

  const label = (
    <>
      <MicIcon data-icon="inline-start" />
      <span className="max-sm:sr-only">Dictar</span>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger render={<Button size="sm" variant="outline" />}>{label}</DrawerTrigger>
        <DrawerContent className="[--drawer-height:calc(100dvh-2rem)] data-[swipe-axis=y]:[--drawer-content-max-height:calc(100dvh-2rem)]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{TITLE}</DrawerTitle>
            <DrawerDescription className="sr-only">{DESCRIPTION}</DrawerDescription>
          </DrawerHeader>
          {open && <VoiceDictationPanel {...panel} onCreated={close} />}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>{label}</DialogTrigger>
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-5xl">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>{TITLE}</DialogTitle>
          <DialogDescription>{DESCRIPTION}</DialogDescription>
        </DialogHeader>
        {open && <VoiceDictationPanel {...panel} onCreated={close} />}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Contenido del dictado: transcripción editable + vista previa de los ítems.
 * Menos de 1024 px: dos pasos (Dictar → Revisar). Desde 1024 px: lado a lado.
 * `inline` lo muestra dentro de una página (pestaña de /import) en vez de un panel.
 */
export function VoiceDictationPanel({
  projects,
  today,
  defaultProjectId,
  defaultMyDay = false,
  inline = false,
  onCreated,
}: PanelProps & { inline?: boolean; onCreated?: () => void }) {
  const speech = useSpeechRecognition();
  const { pending, run } = useAction();
  const [step, setStep] = useState<"dictate" | "review">("dictate");
  const [myDay, setMyDay] = useState(defaultMyDay);

  const text = speech.transcript;
  const interpreted = useMemo(
    () =>
      text.trim()
        ? interpretSpoken(text, { projects, today, defaultProjectId, myDay })
        : { items: [], plannedOn: null },
    [text, projects, today, defaultProjectId, myDay],
  );
  const { rows, selected, update } = useReviewRows(interpreted.items);
  const listening = speech.status === "listening";

  const create = () =>
    run(
      () =>
        importDictation({
          title: null,
          date: today,
          markdown: text,
          items: toImportItems(selected),
          source: "voice",
        }),
      () => {
        speech.setTranscript("");
        setStep("dictate");
        onCreated?.();
      },
    );

  const micButton = (className?: string) => (
    <Button
      type="button"
      size="icon-lg"
      variant={listening ? "destructive" : "default"}
      className={cn("size-14 shrink-0 rounded-full lg:size-11", className)}
      disabled={!speech.supported}
      aria-pressed={listening}
      aria-label={listening ? "Detener dictado" : "Empezar a dictar"}
      onClick={listening ? speech.stop : speech.start}
    >
      {!speech.supported ? <MicOffIcon /> : listening ? <SquareIcon /> : <MicIcon />}
    </Button>
  );

  const createLabel = `Crear ${selected.length} ${selected.length === 1 ? "ítem" : "ítems"}`;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", inline && "gap-4")}>
      <div
        className={cn(
          "grid min-h-0 flex-1 gap-6 overflow-y-auto overscroll-contain lg:grid-cols-2",
          !inline && "p-4",
        )}
      >
        {/* Paso 1: dictar o escribir. */}
        <section
          aria-label="Transcripción"
          className={cn("flex flex-col gap-3", step === "review" && "max-lg:hidden")}
        >
          <div className="flex items-center gap-3">
            {micButton("max-lg:hidden")}
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {!speech.supported ? (
                "El dictado por voz no está disponible en este navegador (usa Chrome, Edge o Safari). Puedes escribir el texto."
              ) : speech.error ? (
                <span className="text-destructive">{speech.error}</span>
              ) : listening ? (
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <span className="size-2 rounded-full bg-destructive motion-safe:animate-pulse" aria-hidden />
                  Escuchando… pulsa de nuevo para terminar.
                </span>
              ) : (
                "Pulsa el micrófono y habla. Cada pausa larga separa un ítem."
              )}
            </p>
          </div>

          <Field>
            <FieldLabel htmlFor="voice-transcript">Lo que dijiste</FieldLabel>
            <Textarea
              id="voice-transcript"
              rows={6}
              enterKeyHint="done"
              value={text}
              onChange={(e) => speech.setTranscript(e.target.value)}
              placeholder="Para mi día de hoy voy a revisar la propuesta del proyecto web, dos horas…"
              className="min-h-32 text-base sm:text-sm"
            />
            {speech.interim && (
              <p className="text-sm text-muted-foreground italic" aria-hidden>
                {speech.interim}…
              </p>
            )}
            <FieldDescription>Puedes corregir el texto antes de revisar.</FieldDescription>
          </Field>

          <Field orientation="horizontal">
            <Checkbox
              id="voice-my-day"
              checked={myDay}
              onCheckedChange={(checked) => setMyDay(checked)}
            />
            <FieldLabel htmlFor="voice-my-day">Agregar a Mi día</FieldLabel>
          </Field>
        </section>

        {/* Paso 2: revisar lo interpretado. */}
        <section
          aria-labelledby="voice-review-title"
          className={cn("flex flex-col gap-3", step === "dictate" && "max-lg:hidden")}
        >
          <h3 id="voice-review-title" className="text-sm font-semibold">
            Vista previa
            {interpreted.plannedOn &&
              ` · ${interpreted.plannedOn === today ? "Mi día" : `Planeado para ${interpreted.plannedOn}`}`}
          </h3>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aquí aparecerán las tareas que entienda Chronos, con proyecto, fecha y horas estimadas.
            </p>
          ) : (
            <DictationReview rows={rows} projects={projects} onUpdate={update} />
          )}
        </section>
      </div>

      {/* Pie fijo: al alcance del pulgar y sin quedar debajo del teclado. */}
      <div
        className={cn(
          "sticky bottom-0 flex shrink-0 items-center gap-3 border-t pt-3",
          inline ? "bg-background pb-3" : "bg-popover px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
        )}
      >
        {step === "dictate" ? (
          <>
            {micButton("lg:hidden")}
            <Button
              type="button"
              size="lg"
              className="ml-auto h-11 lg:hidden"
              disabled={rows.length === 0 || listening}
              onClick={() => setStep("review")}
            >
              Revisar {rows.length > 0 && `(${rows.length})`}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </>
        ) : (
          <Button type="button" size="lg" variant="outline" className="h-11 lg:hidden" onClick={() => setStep("dictate")}>
            <ArrowLeftIcon data-icon="inline-start" />
            Volver
          </Button>
        )}
        <Button
          type="button"
          size="lg"
          className={cn("ml-auto max-lg:h-11", step === "dictate" && "max-lg:hidden")}
          disabled={pending || listening || selected.length === 0}
          onClick={create}
        >
          {pending && <Spinner data-icon="inline-start" />}
          {createLabel}
        </Button>
      </div>
    </div>
  );
}
