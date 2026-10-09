//! Процесс ОС: окно-оверлей, трей, глобальный хоткей, настройки, файлы холста, обновления.
//! О рисовании здесь ничего не знают — это целиком интерфейс в `src/`.

mod capture;
mod files;
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

/// Аргумент автозапуска вместе с системой: тогда стартуем тихо в трее.
/// Запуск вручную (меню «Пуск», ярлык, Launchpad) сразу открывает холст — иначе после
/// установки кажется, что ничего не произошло.
const HIDDEN_ARG: &str = "--hidden";

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
fn set_language(
    store: State<Store>,
    tray: State<tray::Tray>,
    lang: Option<String>,
    labels: tray::Labels,
) -> Result<(), String> {
    if lang.as_deref().is_some_and(|l| !LANGS.contains(&l)) {
        return Err("invalid".into());
    }
    store.update(|s| s.lang = lang);
    tray.set_labels(&labels);
    Ok(())
}

#[tauri::command]
fn set_hotkey(
    app: AppHandle,
    store: State<Store>,
    status: State<hotkey::Status>,
    accelerator: String,
) -> Result<(), String> {
    let old = store.get().hotkey;
    hotkey::replace(&app, &status, Some(&old), &accelerator)?;
    store.update(|s| s.hotkey = accelerator);
    Ok(())
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    let launcher = app.autolaunch();
    let result = if enabled {
        launcher.enable()
    } else {
        launcher.disable()
    };
    result.map_err(|e| e.to_string())
}

#[tauri::command]
fn set_auto_update(store: State<Store>, enabled: bool) {
    store.update(|s| s.auto_update = enabled);
}

#[tauri::command]
fn set_pass_through(
    app: AppHandle,
    clicks: State<overlay::ClickThrough>,
    enabled: bool,
    panel: overlay::Rect,
) -> Result<(), String> {
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

/// Программа нужна во время созвона — значит, должна уже ждать в трее. Поэтому автозапуск
/// включаем сами, один раз; выключил в настройках — больше не трогаем. В отладочной сборке —
/// нет, иначе в автозагрузку попал бы exe из target/debug.
fn enable_autostart_once(app: &AppHandle) {
    let store = app.state::<Store>();
    if cfg!(debug_assertions) || store.get().autostart_default_applied {
        return;
    }
    match app.autolaunch().enable() {
        Ok(()) => store.update(|s| s.autostart_default_applied = true),
        Err(e) => eprintln!("Не удалось включить автозапуск: {e}"),
    }
}

pub fn run() {
    tauri::Builder::default()
        // Повторный запуск не плодит копии, а показывает холст.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            overlay::show(app)
        }))
        .plugin(hotkey::plugin())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![HIDDEN_ARG]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(overlay::ClickThrough::default())
        .manage(hotkey::Status::default())
        .manage(updates::Pending::default())
        .setup(|app| {
            // macOS: приложение трея — без иконки в Dock и без меню приложения.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let handle = app.handle();
            let store = Store::load(handle);
            let accelerator = store.get().hotkey;
            app.manage(store);
            overlay::create(handle)?;
            app.manage(tray::create(handle)?);
            // Занятый хоткей не мешает запуску, но без него холст не открыть ничем, кроме трея —
            // поэтому тогда показываем холст и при автозапуске: интерфейс скажет, что делать.
            let hotkey_ok =
                hotkey::replace(handle, &app.state::<hotkey::Status>(), None, &accelerator).is_ok();
            enable_autostart_once(handle);
            if !hotkey_ok || !std::env::args().any(|a| a == HIDDEN_ARG) {
                overlay::show(handle);
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
            files::copy_image,
            files::save_png,
            files::open_png,
        ])
        .run(tauri::generate_context!())
        .expect("не удалось запустить Sketchover");
}
