import data from "./clubs.json";

export type Club = { id: string; name: string; openingHours?: [number, number] };
export const clubs = data as Club[];
export const getClub = (id: string) => clubs.find((c) => c.id === id);
export const DEFAULT_CLUB = "9eM6en7UzJ"; // ON AIR Montpellier Celleneuve
