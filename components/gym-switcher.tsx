"use client";
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { clubs, type Club } from "@/lib/clubs";
import { cn } from "@/lib/utils";
import { fold, matchIndex } from "@/lib/text";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export function GymSwitcher({ current, onSelect }: { current: Club; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  function pick(id: string) {
    setOpen(false);
    setQ("");
    if (id !== current.id) onSelect(id);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          role="combobox"
          aria-expanded={open}
          className="h-auto gap-2 rounded-lg px-3 py-1.5 text-base font-semibold tracking-tight"
        >
          {current.name}
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-80 p-0">
        {/* Accent-insensitive: "defense" matches "La Défense". */}
        <Command filter={(value, search) => (fold(value).includes(fold(search)) ? 1 : 0)}>
          <CommandInput placeholder="Search gyms..." value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>No gym found.</CommandEmpty>
            <CommandGroup>
              {clubs.map((c) => (
                <CommandItem key={c.id} value={c.name} onSelect={() => pick(c.id)}>
                  <Check className={cn("size-4 shrink-0", c.id === current.id ? "opacity-100" : "opacity-0")} />
                  <Highlight text={c.name} query={q} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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
