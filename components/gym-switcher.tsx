"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, LayoutGrid } from "lucide-react";
import { clubs, type Club } from "@/lib/clubs";
import { cn } from "@/lib/utils";
import { fold, matchIndex } from "@/lib/text";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export function GymSwitcher({
  current,
  activeIds,
  onSelect,
  onShowAll,
  showAll,
  loading,
}: {
  current: Club;
  activeIds: string[];
  onSelect: (id: string) => void;
  onShowAll: () => void;
  showAll: boolean;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Only offer clubs that actually report data (plus whatever is current).
  const active = new Set(activeIds);
  const options = clubs.filter((c) => c.id === current.id || active.has(c.id));

  // Open onto the currently-viewed club rather than the top of the list.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-club="${current.id}"]`);
    el?.scrollIntoView({ block: "center" });
  }, [open, current.id]);

  function pick(id: string) {
    setOpen(false);
    setQ("");
    if (id !== current.id) onSelect(id);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Popover
        open={open}
        onOpenChange={setOpen}
      >
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            role="combobox"
            aria-expanded={open}
            disabled={showAll}
            className="h-auto gap-2 rounded-lg px-3 py-1.5 text-base font-semibold tracking-tight"
          >
            {current.name}
            <ChevronsUpDown className="size-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          className="w-80 p-0"
        >
          {/* Accent-insensitive: "defense" matches "La Défense". */}
          <Command filter={(value, search) => (fold(value).includes(fold(search)) ? 1 : 0)}>
            <CommandInput
              placeholder="Search gyms..."
              value={q}
              onValueChange={setQ}
            />
            <CommandList ref={listRef}>
              <CommandEmpty>No gym found.</CommandEmpty>
              <CommandGroup>
                {options.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    data-club={c.id}
                    onSelect={() => pick(c.id)}
                  >
                    <Check className={cn("size-4 shrink-0", c.id === current.id ? "opacity-100" : "opacity-0")} />
                    <Highlight
                      text={c.name}
                      query={q}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button
        variant="secondary"
        size="icon"
        aria-label={showAll ? "Close grid" : "View all clubs"}
        title={showAll ? "Close grid" : "View all clubs"}
        disabled={loading}
        className={cn("size-9 rounded-lg transition-opacity", loading && "opacity-40")}
        onClick={onShowAll}
      >
        <LayoutGrid className="size-4" />
      </Button>
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const i = matchIndex(text, query);
  if (i < 0) return <span>{text}</span>;
  const len = query.trim().length;
  return (
    <span>
      {text.slice(0, i)}
      <mark className="bg-foreground/15 font-semibold text-foreground">{text.slice(i, i + len)}</mark>
      {text.slice(i + len)}
    </span>
  );
}
