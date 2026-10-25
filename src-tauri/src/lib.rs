//! Процесс ОС: окно-оверлей, трей, глобальный хоткей, настройки, файлы холста, обновления,
//! анонимная статистика.
//! О рисовании здесь ничего не знают — это целиком интерфейс в `src/`.

mod capture;
mod files;
mod hotkey;
mod keys;
mod overlay;
mod settings;
mod stats;
mod tray;
mod updates;

use std::collections::BTreeMap;

use serde::Serialize;
use tauri::{AppHandle, Manager, State, WebviewWindow};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

use settings::{Store, LANGS};

/// Аргумент автозапуска вместе с системой: тогда стартуем тихо в трее.
/// Запуск вручную (меню «Пуск», ярлык, Launchpad) сразу открывает холст — иначе после
/// установки кажется, что ничего не произошло.
const HIDDEN_ARG: &str = "--hidden";

/// Глобальный хоткей для настроек: сочетание («» — нет) и встало ли оно.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GlobalKey {
    accelerator: String,
    ok: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    version: String,
    os: &'static str,
    lang: Option<String>,
    /// Главный глобальный хоткей — его показывают памятка, обучение и подсказки.
    hotkey: String,
    hotkey_ok: bool,
    /// Все глобальные хоткеи по действиям: `show`, `mode`, `hide`.
    globals: BTreeMap<&'static str, GlobalKey>,
    autostart: bool,
    auto_update: bool,
    share_stats: bool,
    keys: BTreeMap<String, String>,
    hold_key: String,
    tap_key: String,
    onboarded: bool,
    /// Работают ли удержание и двойной тап на этой системе (опрос клавиш).
    hold_supported: bool,
}

#[tauri::command]
fn get_settings(app: AppHandle, store: State<Store>, hotkeys: State<hotkey::Hotkeys>) -> AppInfo {
    let s = store.get();
    let globals: BTreeMap<_, _> = hotkey::ACTIONS
        .into_iter()
        .map(|a| {
            let (accelerator, ok) = hotkeys.status(a);
            (a.name(), GlobalKey { accelerator, ok })
        })
        .collect();
    let (hotkey, hotkey_ok) = hotkeys.status(hotkey::Action::Show);
    AppInfo {
        version: app.package_info().version.to_string(),
        os: std::env::consts::OS,
        lang: s.lang,
        hotkey,
        hotkey_ok,
        globals,
        autostart: app.autolaunch().is_enabled().unwrap_or(false),
        auto_update: s.auto_update,
        share_stats: s.share_stats,
        keys: s.keys,
        hold_key: s.hold_key,
        tap_key: s.tap_key,
        onboarded: s.onboarded,
        hold_supported: keys::poll(keys::Modifier::Off, keys::Modifier::Off).is_some(),
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

/// Глобальный хоткей действия (`show`, `mode`, `hide`); «» — убрать (кроме `show`).
/// Ошибка — код для `settings.hotkey.<код>`: `invalid`, `used`, `taken`.
#[tauri::command]
fn set_global_hotkey(
    app: AppHandle,
    store: State<Store>,
    action: String,
    accelerator: String,
) -> Result<(), String> {
    let action = hotkey::Action::parse(&action).ok_or("invalid")?;
    hotkey::set(&app, action, &accelerator)?;
    store.update(|s| match action {
        hotkey::Action::Show => s.hotkey = accelerator,
        hotkey::Action::Mode => s.hotkey_mode = accelerator,
        hotkey::Action::Hide => s.hotkey_hide = accelerator,
    });
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
fn set_share_stats(store: State<Store>, enabled: bool) {
    store.update(|s| s.share_stats = enabled);
}

/// Переназначенные клавиши холста целиком; интерфейсу не доверяем — проверяем форму.
#[tauri::command]
fn set_keys(store: State<Store>, keys: BTreeMap<String, String>) -> Result<(), String> {
    if !settings::valid_keys(&keys) {
        return Err("invalid".into());
    }
    store.update(|s| s.keys = keys);
    Ok(())
}

#[tauri::command]
fn set_onboarded(store: State<Store>, done: bool) {
    store.update(|s| s.onboarded = done);
}

#[tauri::command]
fn set_tap_key(
    store: State<Store>,
    clicks: State<overlay::ClickThrough>,
    key: String,
) -> Result<(), String> {
    let tap = keys::Modifier::parse(&key).ok_or("invalid")?;
    clicks.set_tap(tap);
    store.update(|s| s.tap_key = key);
    Ok(())
}

#[tauri::command]
fn set_hold_key(
    store: State<Store>,
    clicks: State<overlay::ClickThrough>,
    key: String,
) -> Result<(), String> {
    let hold = keys::Modifier::parse(&key).ok_or("invalid")?;
    clicks.set_hold(hold);
    store.update(|s| s.hold_key = key);
    Ok(())
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
        .manage(hotkey::Hotkeys::default())
        .manage(updates::Pending::default())
        .setup(|app| {
            // macOS: приложение трея — без иконки в Dock и без меню приложения.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let handle = app.handle();
            let store = Store::load(handle);
            let saved = store.get();
            let clicks = app.state::<overlay::ClickThrough>();
            clicks.set_hold(
                keys::Modifier::parse(&saved.hold_key).unwrap_or(keys::Modifier::HOLD_DEFAULT),
            );
            clicks.set_tap(
                keys::Modifier::parse(&saved.tap_key).unwrap_or(keys::Modifier::TAP_DEFAULT),
            );
            app.manage(store);
            overlay::create(handle)?;
            app.manage(tray::create(handle)?);
            // Занятый хоткей не мешает запуску, но без него холст не открыть ничем, кроме трея —
            // поэтому тогда показываем холст и при автозапуске: интерфейс скажет, что делать.
            let hotkey_ok = hotkey::init(
                handle,
                [&saved.hotkey, &saved.hotkey_mode, &saved.hotkey_hide],
            );
            enable_autostart_once(handle);
            stats::start(handle);
            if !hotkey_ok || !std::env::args().any(|a| a == HIDDEN_ARG) {
                overlay::show(handle);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            set_language,
            set_global_hotkey,
            set_autostart,
            set_auto_update,
            set_share_stats,
            set_keys,
            set_tap_key,
            set_hold_key,
            set_onboarded,
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
