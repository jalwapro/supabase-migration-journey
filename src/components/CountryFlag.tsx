type CountryFlagProps = {
  country?: string | null;
  countryCode?: string | null;
  className?: string;
  title?: string;
};

const COUNTRY_FLAGS: Record<string, string> = {
  Pakistan: "🇵🇰", India: "🇮🇳", Bangladesh: "🇧🇩", "Saudi Arabia": "🇸🇦",
  "United Arab Emirates": "🇦🇪", UAE: "🇦🇪", Turkey: "🇹🇷", Türkiye: "🇹🇷",
  Egypt: "🇪🇬", Indonesia: "🇮🇩", Malaysia: "🇲🇾", "United States": "🇺🇸",
  "United Kingdom": "🇬🇧", Philippines: "🇵🇭", Nigeria: "🇳🇬", Morocco: "🇲🇦",
  Iraq: "🇮🇶", Kuwait: "🇰🇼", Qatar: "🇶🇦", Afghanistan: "🇦🇫", Nepal: "🇳🇵",
  "Sri Lanka": "🇱🇰", Oman: "🇴🇲", Bahrain: "🇧🇭", Jordan: "🇯🇴", Iran: "🇮🇷",
  Canada: "🇨🇦", Australia: "🇦🇺",
};

export function countryFlagFor(country?: string | null, countryCode?: string | null): string | null {
  const code = countryCode?.trim().toUpperCase();
  if (code && /^[A-Z]{2}$/.test(code)) {
    return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)));
  }
  const normalizedCountry = country?.trim();
  return normalizedCountry ? COUNTRY_FLAGS[normalizedCountry] ?? null : null;
}

export function CountryFlag({ country, countryCode, className = "", title }: CountryFlagProps) {
  const flag = countryFlagFor(country, countryCode);
  if (!flag) return null;
  return (
    <span
      role="img"
      aria-label={title ?? country ?? countryCode ?? "Country"}
      title={title ?? country ?? countryCode ?? undefined}
      className={`inline-flex shrink-0 items-center leading-none ${className}`}
    >
      {flag}
    </span>
  );
}
