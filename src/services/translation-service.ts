import type { Language } from "../domain/models.js";

export interface TranslationResources {
  [key: string]: {
    [locale: string]: string;
  };
}

// Supported languages with their language codes and display names
export const SUPPORTED_LANGUAGES: Record<Language, { code: Language; name: string; nativeName: string }> = {
  en: { code: "en", name: "English", nativeName: "English" },
  es: { code: "es", name: "Spanish", nativeName: "Español" },
  fr: { code: "fr", name: "French", nativeName: "Français" },
  de: { code: "de", name: "German", nativeName: "Deutsch" },
  it: { code: "it", name: "Italian", nativeName: "Italiano" },
  pt: { code: "pt", name: "Portuguese", nativeName: "Português" },
  ja: { code: "ja", name: "Japanese", nativeName: "日本語" },
  zh: { code: "zh", name: "Chinese", nativeName: "中文" },
  ko: { code: "ko", name: "Korean", nativeName: "한국어" },
  ru: { code: "ru", name: "Russian", nativeName: "Русский" }
};

const DEFAULT_LANGUAGE: Language = "en";

// Translation keys for portal UI
export const PORTAL_TRANSLATIONS: TranslationResources = {
  "portal.login.title": {
    en: "Account Portal",
    es: "Portal de Cuenta",
    fr: "Portail de Compte",
    de: "Kontoportal",
    it: "Portale Account",
    pt: "Portal de Conta",
    ja: "アカウントポータル",
    zh: "帐户门户",
    ko: "계정 포털",
    ru: "Портал учетной записи"
  },
  "portal.login.subtitle": {
    en: "Sign in to access your account",
    es: "Inicia sesión para acceder a tu cuenta",
    fr: "Connectez-vous pour accéder à votre compte",
    de: "Melden Sie sich an, um auf Ihr Konto zuzugreifen",
    it: "Accedi per accedere al tuo account",
    pt: "Faça login para acessar sua conta",
    ja: "サインインしてアカウントにアクセスしてください",
    zh: "登录以访问您的帐户",
    ko: "로그인하여 계정에 액세스",
    ru: "Войдите в свой аккаунт"
  },
  "portal.login.username": {
    en: "Username",
    es: "Nombre de usuario",
    fr: "Nom d'utilisateur",
    de: "Benutzername",
    it: "Nome utente",
    pt: "Nome de usuário",
    ja: "ユーザー名",
    zh: "用户名",
    ko: "사용자명",
    ru: "Имя пользователя"
  },
  "portal.login.password": {
    en: "Password",
    es: "Contraseña",
    fr: "Mot de passe",
    de: "Passwort",
    it: "Password",
    pt: "Senha",
    ja: "パスワード",
    zh: "密码",
    ko: "비밀번호",
    ru: "Пароль"
  },
  "portal.login.signIn": {
    en: "Sign In",
    es: "Iniciar sesión",
    fr: "Se connecter",
    de: "Anmelden",
    it: "Accedi",
    pt: "Entrar",
    ja: "サインイン",
    zh: "登录",
    ko: "로그인",
    ru: "Войти"
  },
  "portal.login.error": {
    en: "Incorrect username or password",
    es: "Nombre de usuario o contraseña incorrectos",
    fr: "Nom d'utilisateur ou mot de passe incorrect",
    de: "Falscher Benutzername oder Passwort",
    it: "Nome utente o password non corretti",
    pt: "Nome de usuário ou senha incorretos",
    ja: "ユーザー名またはパスワードが正しくありません",
    zh: "用户名或密码不正确",
    ko: "사용자 이름 또는 비밀번호가 올바르지 않습니다",
    ru: "Неверное имя пользователя или пароль"
  },
  "portal.launcher.title": {
    en: "Applications",
    es: "Aplicaciones",
    fr: "Applications",
    de: "Anwendungen",
    it: "Applicazioni",
    pt: "Aplicativos",
    ja: "アプリケーション",
    zh: "应用程序",
    ko: "응용 프로그램",
    ru: "Приложения"
  },
  "portal.profile.title": {
    en: "Profile",
    es: "Perfil",
    fr: "Profil",
    de: "Profil",
    it: "Profilo",
    pt: "Perfil",
    ja: "プロフィール",
    zh: "个人资料",
    ko: "프로필",
    ru: "Профиль"
  },
  "portal.language": {
    en: "Language",
    es: "Idioma",
    fr: "Langue",
    de: "Sprache",
    it: "Lingua",
    pt: "Idioma",
    ja: "言語",
    zh: "语言",
    ko: "언어",
    ru: "Язык"
  },
  "portal.signOut": {
    en: "Sign Out",
    es: "Cerrar sesión",
    fr: "Se déconnecter",
    de: "Abmelden",
    it: "Esci",
    pt: "Sair",
    ja: "サインアウト",
    zh: "登出",
    ko: "로그아웃",
    ru: "Выход"
  }
};

export class TranslationService {
  getAvailableLanguages() {
    return Object.values(SUPPORTED_LANGUAGES);
  }

  isValidLanguage(lang: string): lang is Language {
    return lang in SUPPORTED_LANGUAGES;
  }

  getDefaultLanguage(): Language {
    return DEFAULT_LANGUAGE;
  }

  translate(key: string, language: Language): string {
    const translations = PORTAL_TRANSLATIONS[key];
    if (!translations) {
      return key; // Return key if translation not found
    }

    if (!this.isValidLanguage(language)) {
      language = DEFAULT_LANGUAGE;
    }

    return translations[language] || translations[DEFAULT_LANGUAGE] || key;
  }

  getTranslations(language: Language): Record<string, string> {
    if (!this.isValidLanguage(language)) {
      language = DEFAULT_LANGUAGE;
    }

    const result: Record<string, string> = {};
    for (const [key, translations] of Object.entries(PORTAL_TRANSLATIONS)) {
      result[key] = translations[language] || translations[DEFAULT_LANGUAGE] || key;
    }
    return result;
  }

  detectLanguageFromHeader(acceptLanguage: string): Language {
    if (!acceptLanguage) {
      return DEFAULT_LANGUAGE;
    }

    // Parse Accept-Language header
    const languages = acceptLanguage
      .split(",")
      .map((lang) => {
        const [code, q] = lang.trim().split(";");
        const priority = q ? parseFloat(q.replace("q=", "")) : 1;
        return { code: code.trim(), priority };
      })
      .sort((a, b) => b.priority - a.priority);

    for (const { code } of languages) {
      // Try exact match
      if (this.isValidLanguage(code)) {
        return code;
      }

      // Try language prefix (e.g., "es" from "es-ES")
      const prefix = code.split("-")[0];
      if (this.isValidLanguage(prefix)) {
        return prefix as Language;
      }
    }

    return DEFAULT_LANGUAGE;
  }
}
