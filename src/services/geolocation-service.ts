import type { Language } from "../domain/models.js";

export interface GeolocationData {
  country?: string;
  countryCode?: string;
  language?: Language;
}

// Mapping of country codes to their primary language
const COUNTRY_TO_LANGUAGE: Record<string, Language> = {
  US: "en",
  GB: "en",
  CA: "en",
  AU: "en",
  IE: "en",
  NZ: "en",
  ZA: "en",
  ES: "es",
  MX: "es",
  AR: "es",
  CO: "es",
  CL: "es",
  PE: "es",
  VE: "es",
  FR: "fr",
  DE: "de",
  AT: "de",
  CH: "de",
  IT: "it",
  PT: "pt",
  BR: "pt",
  JP: "ja",
  CN: "zh",
  TW: "zh",
  HK: "zh",
  KR: "ko",
  RU: "ru",
  BY: "ru",
  KZ: "ru"
};

export class GeolocationService {
  /**
   * Detect language from client IP address
   * Uses GeoIP2 database if available, otherwise falls back to header detection
   */
  async detectLanguageFromIp(ipAddress: string): Promise<Language | null> {
    try {
      // Try to use MaxMind GeoLite2 if configured
      const countryCode = await this.getCountryFromIp(ipAddress);
      if (countryCode && COUNTRY_TO_LANGUAGE[countryCode]) {
        return COUNTRY_TO_LANGUAGE[countryCode];
      }
    } catch {
      // Silently fail and return null
    }
    return null;
  }

  private async getCountryFromIp(ipAddress: string): Promise<string | null> {
    // This is a placeholder for GeoIP2 integration
    // In production, you would integrate with:
    // - MaxMind GeoLite2 (https://dev.maxmind.com/geoip/geolite2-open-data-geolocation)
    // - IP2Location
    // - Or any other GeoIP database

    // For now, return null to indicate the service should use fallback
    return null;
  }

  getLanguageFromCountryCode(countryCode: string): Language | null {
    return COUNTRY_TO_LANGUAGE[countryCode.toUpperCase()] || null;
  }

  getAvailableCountries(): Array<{ code: string; name: string; language: Language }> {
    return Object.entries(COUNTRY_TO_LANGUAGE).map(([code, language]) => ({
      code,
      name: new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code,
      language
    }));
  }
}
