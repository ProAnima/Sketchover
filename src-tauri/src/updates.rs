//! Обновления через ProAnima Hub (Tauri updater; запасной адрес — GitHub Releases).
//! Подпись каждого файла проверяется ключом из `tauri.conf.json`.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::settings::Store;

/// Найденное обновление ждёт, пока пользователь нажмёт «Обновить».
#[derive(Default)]
pub struct Pending(Mutex<Option<Update>>);

#[derive(Serialize)]
pub struct Found {
    version: String,
    notes: Option<String>,
}

#[derive(Clone, Serialize)]
struct Progress {
    received: u64,
    total: Option<u64>,
}

fn text(e: impl ToString) -> String {
    e.to_string()
}

#[tauri::command]
pub async fn check_update(
    app: AppHandle,
    store: State<'_, Store>,
    pending: State<'_, Pending>,
) -> Result<Option<Found>, String> {
    let install_id = store.get().install_id;
    let update = app
        .updater_builder()
        .header("X-Install-Id", install_id)
        .map_err(text)?
        .build()
        .map_err(text)?
        .check()
        .await
        .map_err(text)?;
    let found = update.as_ref().map(|u| Found {
        version: u.version.clone(),
        notes: u.body.clone(),
    });
    *pending.0.lock().unwrap_or_else(|e| e.into_inner()) = update;
    Ok(found)
}

/// Скачивает, ставит и перезапускает приложение. Прогресс — событием `update:progress`.
#[tauri::command]
pub async fn install_update(app: AppHandle, pending: State<'_, Pending>) -> Result<(), String> {
    let update = pending
        .0
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take()
        .ok_or("none")?;
    let mut received = 0u64;
    update
        .download_and_install(
            |chunk, total| {
                received += chunk as u64;
                let _ = app.emit("update:progress", Progress { received, total });
            },
            || {
                let _ = app.emit("update:installing", ());
            },
        )
        .await
        .map_err(text)?;
    app.restart()
}
