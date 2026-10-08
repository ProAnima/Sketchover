//! Процесс ОС: окно-оверлей, трей, глобальный хоткей, настройки, обновления.
//! О рисовании здесь ничего не знают — это целиком интерфейс в `src/`.

mod capture;
mod hotkey;
mod keys;
mod overlay;
mod settings;
mod tray;
mod updates;

use serde::Serialize;
use tauri::{AppHandle, Manager, State, WebviewWindow};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

use settings::{Store, LANGS};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    version: String,
    os: &'static str,
    lang: Option<String>,
    hotkey: String,
    hotkey_ok: bool,
    autostart: bool,
    auto_update: bool,
    /// Работает ли удержание Alt для сквозных кликов на этой системе.
    hold_supported: bool,
}

#[tauri::command]
fn get_settings(app: AppHandle, store: State<Store>, status: State<hotkey::Status>) -> AppInfo {
    let s = store.get();
    AppInfo {
        version: app.package_info().version.to_string(),
        os: std::env::consts::OS,
        lang: s.lang,
        hotkey: s.hotkey,
        hotkey_ok: status.ok(),
        autostart: app.autolaunch().is_enabled().unwrap_or(false),
        auto_update: s.auto_update,
        hold_supported: keys::poll().is_some(),
    }
}

#[tauri::command]
fn set_language(store: State<Store>, tray: State<tray::Tray>, lang: Option<String>, labels: tray::Labels) -> Result<(), String> {
    if lang.as_deref().is_some_and(|l| !LANGS.contains(&l)) {
        return Err("invalid".into());
    }
    store.update(|s| s.lang = lang);
    tray.set_labels(&labels);
    Ok(())
}

#[tauri::command]
fn set_hotkey(app: AppHandle, store: State<Store>, status: State<hotkey::Status>, accelerator: String) -> Result<(), String> {
    let old = store.get().hotkey;
    hotkey::replace(&app, &status, Some(&old), &accelerator)?;
    store.update(|s| s.hotkey = accelerator);
    Ok(())
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    let launcher = app.autolaunch();
    let result = if enabled { launcher.enable() } else { launcher.disable() };
    result.map_err(|e| e.to_string())
}

#[tauri::command]
fn set_auto_update(store: State<Store>, enabled: bool) {
    store.update(|s| s.auto_update = enabled);
}

#[tauri::command]
fn set_pass_through(app: AppHandle, clicks: State<overlay::ClickThrough>, enabled: bool, panel: overlay::Rect) -> Result<(), String> {
    if !panel.is_valid() {
        return Err("invalid".into());
    }
    clicks.set_pass(&app, enabled, panel);
    Ok(())
}

#[tauri::command]
fn focus_window(win: WebviewWindow) {
    overlay::focus(&win);
}

#[tauri::command]
fn hide_overlay(app: AppHandle) {
    overlay::hide(&app);
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

pub fn run() {
    tauri::Builder::default()
        // Повторный запуск не плодит копии, а показывает холст.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| overlay::show(app)))
        .plugin(hotkey::plugin())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(overlay::ClickThrough::default())
        .manage(hotkey::Status::default())
        .manage(updates::Pending::default())
        .setup(|app| {
            let handle = app.handle();
            let store = Store::load(handle);
            let accelerator = store.get().hotkey;
            app.manage(store);
            overlay::create(handle)?;
            app.manage(tray::create(handle)?);
            // Занятый хоткей не должен мешать запуску: пользователь увидит это в настройках.
            if hotkey::replace(handle, &app.state::<hotkey::Status>(), None, &accelerator).is_err() {
                eprintln!("Не удалось зарегистрировать хоткей {accelerator}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            set_language,
            set_hotkey,
            set_autostart,
            set_auto_update,
            set_pass_through,
            focus_window,
            hide_overlay,
            quit,
            updates::check_update,
            updates::install_update,
            capture::capture_screen,
        ])
        .run(tauri::generate_context!())
        .expect("не удалось запустить Sketchover");
}
