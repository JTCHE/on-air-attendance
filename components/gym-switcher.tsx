"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import { clubs, type Club } from "@/lib/clubs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export function GymSwitcher({ current }: { current: Club }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function select(id: string) {
    document.cookie = `club=${id}; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
    if (id !== current.id) router.push(`/${id}`);
  }

  return (
    <div>
      <Popover
        open={open}
        onOpenChange={setOpen}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-auto gap-2 rounded-lg px-3 py-1.5 text-base font-semibold tracking-tight"
          >
            {current.name}
            <ChevronsUpDown className="size-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-80 p-0"
        >
          <Command>
            <CommandInput placeholder="Search gyms..." />
            <CommandList>
              <CommandEmpty>No gym found.</CommandEmpty>
              <CommandGroup>
                {clubs.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => select(c.id)}
                  >
                    <Check className={cn("size-4", c.id === current.id ? "opacity-100" : "opacity-0")} />
                    {c.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
