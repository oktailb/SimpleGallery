# Project Rules & Best Practices

## Internationalization (i18n) & Translation Keys
- **No Hardcoded Fallback Strings in `this.t('key')` calls**:
  Do NOT pass or chain hardcoded fallback strings when calling translation methods (e.g. avoid `this.t('sysmon.clear_cache_confirm') || "Êtes-vous sûr..."`).
  Call `this.t('key', replacements)` directly and let the i18n engine return the missing key string if unmapped. This ensures missing translations or untranslated keys are immediately visible during development and testing.

## Refactoring & Préservation Fonctionnelle Stricte
- **100% Iso-Fonctionnel Obligatoire** :
  Tout refactoring architectural, découpage de fichier ou réorganisation de code doit être **100% iso-fonctionnel**.
  Aucune fonctionnalité, raccourci, modalité de sélection, interaction ou feature existante ne doit être supprimée silencieusement ou par oubli.
  Tout test unitaire et fonctionnel existant doit continuer de passer sans régression.
