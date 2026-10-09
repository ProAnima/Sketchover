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

#[derive(Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    /// `None` — язык системы.
    pub lang: Option<String>,
    pub hotkey: String,
    pub auto_update: bool,
    /// Случайный id установки для поэтапной раскатки обновлений в хабе; ничего личного.
    pub install_id: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            lang: None,
            hotkey: DEFAULT_HOTKEY.into(),
            auto_update: true,
            install_id: String::new(),
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
        let fresh = loaded.is_none();
        let store = Self {
            path,
            data: Mutex::new(loaded.unwrap_or_default().sanitize()),
        };
        if fresh {
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
