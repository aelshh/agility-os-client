import type { DropdownOption } from "../components/Dropdown";

export const TIMEZONES: DropdownOption[] = [
  { value: "Asia/Kolkata", label: "India Standard Time (IST, UTC+5:30)" },
  { value: "Asia/Dubai", label: "Gulf Standard Time (GST, UTC+4)" },
  { value: "Asia/Singapore", label: "Singapore Time (SGT, UTC+8)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST, UTC+9)" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT, UTC+0)" },
  { value: "Europe/Paris", label: "Central European Time (CET, UTC+1)" },
  { value: "America/New_York", label: "Eastern Time (ET, UTC-5)" },
  { value: "America/Chicago", label: "Central Time (CT, UTC-6)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT, UTC-8)" },
  { value: "America/Sao_Paulo", label: "Brasília Time (BRT, UTC-3)" },
  {
    value: "Australia/Sydney",
    label: "Australian Eastern Time (AEST, UTC+10)",
  },
];

export const LANGUAGES: DropdownOption[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi (हिन्दी)" },
  { value: "ta", label: "Tamil (தமிழ்)" },
  { value: "te", label: "Telugu (తెలుగు)" },
  { value: "mr", label: "Marathi (मराठी)" },
  { value: "ar", label: "Arabic (عربي)" },
  { value: "fr", label: "French (Français)" },
  { value: "de", label: "German (Deutsch)" },
  { value: "pt", label: "Portuguese (Português)" },
  { value: "es", label: "Spanish (Español)" },
];