//! Настройки пользователя: JSON в каталоге конфигурации приложения.

use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::keys::Tap;

/// Две клавиши, слева сверху, рядом с Esc (на русской раскладке — Ё).
pub const DEFAULT_HOTKEY: &str = "Alt+Backquote";
/// Прежнее значение по умолчанию — переводим на новое, пользователь его не выбирал.
const LEGACY_HOTKEY: &str = "CommandOrControl+Alt+D";
/// Языки интерфейса — те же, что в `src/i18n`.
pub const LANGS: [&str; 11] = [
    "ru", "en", "de", "es", "fr", "pt", "zh", "ja", "ko", "ar", "hi",
];
/// Переназначенных клавиш холста не больше — действий в интерфейсе меньше.
const MAX_KEYS: usize = 64;
/// Сочетаний у одного действия не больше.
const MAX_COMBOS: usize = 4;
const MODIFIERS: [&str; 4] = ["Mod", "Ctrl", "Alt", "Shift"];

/// Сочетание из `src/core/keymap.js`: «Mod+Shift+KeyC» — модификаторы без повторов и
/// физическая клавиша (`e.code`).
fn valid_combo(combo: &str) -> bool {
    let mut parts: Vec<&str> = combo.split('+').collect();
    let Some(code) = parts.pop() else {
        return false;
    };
    let code_ok = (1..=24).contains(&code.len()) && code.bytes().all(|b| b.is_ascii_alphanumeric());
    let mut seen = Vec::new();
    let mods_ok = parts.iter().all(|m| {
        let fresh = MODIFIERS.contains(m) && !seen.contains(m);
        seen.push(*m);
        fresh
    });
    code_ok && mods_ok
}

/// Действие (`undo`, `tool.pen`, `color.3`) и его сочетания через запятую; «» — без клавиши.
/// Какие действия есть, знает интерфейс; здесь — только форма, чтобы в файл не попал мусор.
pub fn valid_key(action: &str, combos: &str) -> bool {
    let action_ok = (1..=32).contains(&action.len())
        && action
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'.');
    let list: Vec<&str> = combos.split(',').filter(|c| !c.is_empty()).collect();
    action_ok && list.len() <= MAX_COMBOS && list.iter().all(|c| valid_combo(c))
}

pub fn valid_keys(keys: &BTreeMap<String, String>) -> bool {
    keys.len() <= MAX_KEYS && keys.iter().all(|(a, c)| valid_key(a, c))
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    /// `None` — язык системы.
    pub lang: Option<String>,
    pub hotkey: String,
    pub auto_update: bool,
    /// Анонимная статистика в хаб (`stats.rs`); человек может выключить.
    pub share_stats: bool,
    /// Случайный id установки для поэтапной раскатки обновлений в хабе; ничего личного.
    pub install_id: String,
    /// Автозапуск по умолчанию уже включали. Дальше решает пользователь: выключил — не включаем снова.
    pub autostart_default_applied: bool,
    /// Переназначенные клавиши холста — только отличия от значений по умолчанию.
    pub keys: BTreeMap<String, String>,
    /// Клавиша двойного тапа — `keys::Tap` по имени (`off`, `alt`, `ctrl`, `shift`, `cmd`).
    pub tap_key: String,
    /// Обучение пройдено или пропущено. Нет поля в файле — значит, программа стояла до
    /// обучения: им показывать его не навязываем, а новой установке (файла нет) — показываем.
    #[serde(default = "already_onboarded")]
    pub onboarded: bool,
}

fn already_onboarded() -> bool {
    true
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            lang: None,
            hotkey: DEFAULT_HOTKEY.into(),
            auto_update: true,
            share_stats: true,
            install_id: String::new(),
            autostart_default_applied: false,
            keys: BTreeMap::new(),
            tap_key: Tap::DEFAULT.name().into(),
            onboarded: false,
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
        if Tap::parse(&self.tap_key).is_none() {
            self.tap_key = Tap::DEFAULT.name().into();
        }
        if !valid_keys(&self.keys) {
            self.keys.retain(|a, c| valid_key(a, c));
            if self.keys.len() > MAX_KEYS {
                self.keys.clear();
            }
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
        assert!(
            s.share_stats,
            "статистика включена и у старых настроек без этого поля"
        );
        assert!(!s.autostart_default_applied);
        assert!(s.keys.is_empty());
        assert_eq!(s.tap_key, Tap::DEFAULT.name());
    }

    #[test]
    fn onboarding_is_for_new_installs_only() {
        assert!(!Settings::default().onboarded, "новая установка — обучение");
        let old: Settings = serde_json::from_str(r#"{"hotkey":"Alt+Backquote"}"#).unwrap();
        assert!(old.onboarded, "настройки до обучения — не навязываем");
    }

    #[test]
    fn canvas_keys_keep_only_valid_entries() {
        assert!(valid_key("redo", "Mod+KeyY,Mod+Shift+KeyZ"));
        assert!(valid_key("tool.pen", "Digit2"));
        assert!(valid_key("delete", ""), "без клавиши");
        assert!(!valid_key("Undo", "Mod+KeyZ"), "имя действия — строчными");
        assert!(!valid_key("undo", "Mod+Mod+KeyZ"), "модификатор дважды");
        assert!(!valid_key("undo", "Hyper+KeyZ"));
        assert!(!valid_key("undo", "Mod+"));
        assert!(!valid_key("undo", "Mod+Key Z"));
        assert!(!valid_key("undo", "A,B,C,D,E"), "больше четырёх сочетаний");
        let s: Settings = serde_json::from_str(
            r#"{"keys":{"shot":"KeyP","bad action":"KeyQ","undo":"<script>"}}"#,
        )
        .unwrap();
        let s = s.sanitize();
        assert_eq!(s.keys.len(), 1);
        assert_eq!(s.keys["shot"], "KeyP");
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
