//! Глобальные хоткеи — работают из любой программы. Три действия: у главного клавиша есть
//! всегда, у двух других по умолчанию её нет — их назначает тот, кому они нужны.

use std::sync::Mutex;

use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::overlay;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Action {
    /// Холст спрятан → показать; виден → рисование ⇄ сквозные клики.
    Show,
    /// Рисование ⇄ сквозные клики, если холст виден.
    Mode,
    /// Показать или спрятать холст.
    Hide,
}

pub const ACTIONS: [Action; 3] = [Action::Show, Action::Mode, Action::Hide];

impl Action {
    pub fn parse(name: &str) -> Option<Action> {
        ACTIONS.into_iter().find(|a| a.name() == name)
    }

    pub fn name(self) -> &'static str {
        match self {
            Action::Show => "show",
            Action::Mode => "mode",
            Action::Hide => "hide",
        }
    }

    fn index(self) -> usize {
        self as usize
    }
}

#[derive(Clone, Default)]
struct Slot {
    accelerator: String,
    shortcut: Option<Shortcut>,
    /// Зарегистрирован: сочетание не держит другая программа.
    ok: bool,
}

/// Что за каким действием сейчас закреплено — для обработчика и для настроек.
#[derive(Default)]
pub struct Hotkeys(Mutex<[Slot; 3]>);

impl Hotkeys {
    fn lock(&self) -> std::sync::MutexGuard<'_, [Slot; 3]> {
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Сочетание действия и удалось ли его зарегистрировать.
    pub fn status(&self, action: Action) -> (String, bool) {
        let slot = &self.lock()[action.index()];
        (slot.accelerator.clone(), slot.ok)
    }

    fn action_of(&self, shortcut: &Shortcut) -> Option<Action> {
        let slots = self.lock();
        ACTIONS
            .into_iter()
            .find(|a| slots[a.index()].shortcut.as_ref() == Some(shortcut))
    }
}

pub fn plugin() -> TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            // Замок отпущен до вызовов окна: обработчик и настройки не ждут друг друга.
            let action = app.state::<Hotkeys>().action_of(shortcut);
            match action {
                Some(Action::Show) => overlay::on_hotkey(app),
                Some(Action::Mode) => overlay::toggle_mode(app),
                Some(Action::Hide) => overlay::toggle_visible(app),
                None => {}
            }
        })
        .build()
}

/// Коды ошибок совпадают с ключами локализации `settings.hotkey.<код>`.
pub fn parse(accelerator: &str) -> Result<Shortcut, &'static str> {
    // Не больше трёх клавиш: длинные комбинации неудобно нажимать.
    if accelerator.split('+').count() > 3 {
        return Err("invalid");
    }
    let shortcut: Shortcut = accelerator.parse().map_err(|_| "invalid")?;
    // Без модификатора глобальный хоткей перехватил бы обычный ввод во всех программах.
    if shortcut.mods.is_empty() {
        return Err("invalid");
    }
    Ok(shortcut)
}

/// Назначить действию сочетание («» — убрать; у главного действия убрать нельзя).
/// При ошибке прежнее остаётся как было.
pub fn set(app: &AppHandle, action: Action, accelerator: &str) -> Result<(), &'static str> {
    let hotkeys = app.state::<Hotkeys>();
    let gs = app.global_shortcut();
    let old = hotkeys.lock()[action.index()].clone();
    if accelerator.is_empty() {
        if action == Action::Show {
            return Err("invalid");
        }
        if let Some(s) = old.shortcut {
            let _ = gs.unregister(s);
        }
        hotkeys.lock()[action.index()] = Slot::default();
        return Ok(());
    }
    let shortcut = parse(accelerator)?;
    let used = ACTIONS
        .into_iter()
        .any(|a| a != action && hotkeys.lock()[a.index()].shortcut == Some(shortcut));
    if used {
        return Err("used");
    }
    if let Some(s) = old.shortcut {
        let _ = gs.unregister(s);
    }
    if gs.register(shortcut).is_ok() {
        hotkeys.lock()[action.index()] = Slot {
            accelerator: accelerator.into(),
            shortcut: Some(shortcut),
            ok: true,
        };
        return Ok(());
    }
    // Комбинацию держит другая программа — возвращаем прежнюю.
    let restored = old.shortcut.is_some_and(|s| gs.register(s).is_ok());
    hotkeys.lock()[action.index()].ok = restored;
    Err("taken")
}

/// При запуске: регистрирует сохранённые сочетания. Не удалось (занято, битое значение) —
/// не падаем: настройки покажут это у нужной строки. Возвращает, работает ли главное.
pub fn init(app: &AppHandle, saved: [&str; 3]) -> bool {
    for (action, accelerator) in ACTIONS.into_iter().zip(saved) {
        if accelerator.is_empty() || set(app, action, accelerator).is_ok() {
            continue;
        }
        // Запомнить, что хотели, — чтобы в настройках было видно, какое сочетание не встало.
        let shortcut = parse(accelerator).ok();
        app.state::<Hotkeys>().lock()[action.index()] = Slot {
            accelerator: accelerator.into(),
            shortcut,
            ok: false,
        };
    }
    app.state::<Hotkeys>().status(Action::Show).1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn actions_round_trip_by_name() {
        for action in ACTIONS {
            assert_eq!(Action::parse(action.name()), Some(action));
        }
        assert_eq!(Action::parse("quit"), None);
    }

    #[test]
    fn a_global_hotkey_needs_a_modifier_and_at_most_three_keys() {
        assert!(parse("Alt+Backquote").is_ok());
        assert!(parse("CommandOrControl+Shift+D").is_ok());
        assert_eq!(parse("D"), Err("invalid"));
        assert_eq!(parse("CommandOrControl+Alt+Shift+D"), Err("invalid"));
        assert_eq!(parse("Alt+NoSuchKey"), Err("invalid"));
    }
}
