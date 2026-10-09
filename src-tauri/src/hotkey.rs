//! Единственный глобальный хоткей приложения.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Wry};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::overlay;

/// Удалось ли зарегистрировать хоткей — интерфейс показывает это в настройках.
#[derive(Default)]
pub struct Status(AtomicBool);

impl Status {
    pub fn ok(&self) -> bool {
        self.0.load(Ordering::Relaxed)
    }
}

pub fn plugin() -> TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                overlay::on_hotkey(app);
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

/// Заменяет текущий хоткей. При ошибке старый остаётся как был.
pub fn replace(
    app: &AppHandle,
    status: &Status,
    old: Option<&str>,
    new: &str,
) -> Result<(), &'static str> {
    let shortcut = parse(new)?;
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    if gs.register(shortcut).is_ok() {
        status.0.store(true, Ordering::Relaxed);
        return Ok(());
    }
    // Комбинацию держит другая программа — возвращаем прежнюю.
    let restored = old
        .and_then(|o| parse(o).ok())
        .is_some_and(|s| gs.register(s).is_ok());
    status.0.store(restored, Ordering::Relaxed);
    Err("taken")
}
