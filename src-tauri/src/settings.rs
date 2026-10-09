//! Настройки пользователя: JSON в каталоге конфигурации приложения.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// Две клавиши, слева сверху, рядом с Esc (на русской раскладке — Ё).
pub const DEFAULT_HOTKEY: &str = "Alt+Backquote";
/// Прежнее значение по умолчанию — переводим на новое, пользователь его не выбирал.
const LEGACY_HOTKEY: &str = "CommandOrControl+Alt+D";
/// Языки интерфейса — те же, что в `src/i18n`.
pub const LANGS: [&str; 11] = [
    "ru", "en", "de", "es", "fr", "pt", "zh", "ja", "ko", "ar", "hi",
];

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    /// `None` — язык системы.
    pub lang: Option<String>,
    pub hotkey: String,
    pub auto_update: bool,
    /// Случайный id установки для поэтапной раскатки обновлений в хабе; ничего личного.
    pub install_id: String,
    /// Автозапуск по умолчанию уже включали. Дальше решает пользователь: выключил — не включаем снова.
    pub autostart_default_applied: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            lang: None,
            hotkey: DEFAULT_HOTKEY.into(),
            auto_update: true,
            install_id: String::new(),
            autostart_default_applied: false,
        }
    }
}

impl Settings {
    /// Битые или чужие значения заменяем значениями по умолчанию, а не падаем.
    fn sanitize(mut self) -> Self {
        if self.lang.as_deref().is_some_and(|l| !LANGS.contains(&l)) {
            self.lang = None;
        }
        if self.hotkey.trim().is_empty() || self.hotkey == LEGACY_HOTKEY {
            self.hotkey = DEFAULT_HOTKEY.into();
        }
        if uuid::Uuid::parse_str(&self.install_id).is_err() {
            self.install_id = uuid::Uuid::new_v4().to_string();
        }
        self
    }
}

pub struct Store {
    path: Option<PathBuf>,
    data: Mutex<Settings>,
}

impl Store {
    pub fn load(app: &AppHandle) -> Self {
        let path = app
            .path()
            .app_config_dir()
            .ok()
            .map(|d| d.join("settings.json"));
        let loaded = path
            .as_ref()
            .and_then(|p| fs::read_to_string(p).ok())
            .and_then(|text| serde_json::from_str::<Settings>(&text).ok());
        let settings = loaded.clone().unwrap_or_default().sanitize();
        // Сохраняем и новый файл, и исправленный при чтении: иначе, например, сгенерированный
        // install_id менялся бы на каждом запуске, и хаб считал бы каждый запуск новой установкой.
        let changed = loaded.as_ref() != Some(&settings);
        let store = Self {
            path,
            data: Mutex::new(settings),
        };
        if changed {
            store.save();
        }
        store
    }

    pub fn get(&self) -> Settings {
        self.data.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }

    pub fn update(&self, change: impl FnOnce(&mut Settings)) {
        change(&mut self.data.lock().unwrap_or_else(|e| e.into_inner()));
        self.save();
    }

    fn save(&self) {
        let Some(path) = &self.path else { return };
        let json = serde_json::to_string_pretty(&self.get()).unwrap_or_default();
        let written = path
            .parent()
            .map_or(Ok(()), fs::create_dir_all)
            .and_then(|()| fs::write(path, json));
        if let Err(e) = written {
            eprintln!("Не удалось сохранить настройки: {e}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_or_broken_values_get_defaults() {
        let s: Settings = serde_json::from_str(r#"{"lang":"xx","hotkey":"  "}"#).unwrap();
        let s = s.sanitize();
        assert_eq!(s.lang, None);
        assert_eq!(s.hotkey, DEFAULT_HOTKEY);
        assert!(uuid::Uuid::parse_str(&s.install_id).is_ok());
        assert!(s.auto_update);
        assert!(!s.autostart_default_applied);
    }

    #[test]
    fn legacy_default_hotkey_is_migrated_but_custom_kept() {
        let legacy = Settings {
            hotkey: LEGACY_HOTKEY.into(),
            ..Settings::default()
        }
        .sanitize();
        assert_eq!(legacy.hotkey, DEFAULT_HOTKEY);
        let custom = Settings {
            hotkey: "Control+Shift+K".into(),
            ..Settings::default()
        }
        .sanitize();
        assert_eq!(custom.hotkey, "Control+Shift+K");
    }

    #[test]
    fn valid_settings_stay_unchanged() {
        let s = Settings::default().sanitize();
        assert_eq!(
            s.clone().sanitize(),
            s,
            "повторная проверка ничего не меняет — файл не перезаписывается зря"
        );
    }
}
