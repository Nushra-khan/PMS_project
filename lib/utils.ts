import { type ClassValue, clsx } from "clsx";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(value?: string) {
  if (!value) {
    return "Not scheduled";
  }

  return format(new Date(value), "dd MMM yyyy");
}

export function formatDateTime(value?: string) {
  if (!value) {
    return "Not available";
  }

  return format(new Date(value), "dd MMM yyyy, hh:mm a");
}

export function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
