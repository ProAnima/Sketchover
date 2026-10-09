//! Снимок экрана под холстом — основа скриншота области.

use std::time::Duration;

use tauri::ipc::Response;
use tauri::{AppHandle, Manager};

use crate::overlay;

/// Сколько ждать после скрытия холста, чтобы система успела перерисовать экран без него.
const HIDE_DELAY: Duration = Duration::from_millis(150);

/// Прячет холст, снимает монитор под ним и показывает холст обратно.
/// Ответ — двоичный: ширина и высота (u32, little-endian), затем пиксели RGBA.
/// Двоичный, а не PNG/base64: кадр 4K — десятки мегабайт, кодирование заметно тормозило бы.
#[tauri::command]
pub async fn capture_screen(app: AppHandle) -> Result<Response, String> {
    let win = app.get_webview_window(overlay::LABEL).ok_or("no window")?;
    let pos = win.inner_position().map_err(|e| e.to_string())?;
    let size = win.inner_size().map_err(|e| e.to_string())?;
    let center = (
        pos.x + size.width as i32 / 2,
        pos.y + size.height as i32 / 2,
    );

    win.hide().map_err(|e| e.to_string())?;
    pause(HIDE_DELAY).await;
    let shot = xcap::Monitor::from_point(center.0, center.1).and_then(|m| m.capture_image());
    // Холст возвращаем в любом случае — даже если снимок не удался.
    let _ = win.show();
    overlay::focus(&win);

    let image = shot.map_err(|e| e.to_string())?;
    let (width, height) = image.dimensions();
    let mut bytes = Vec::with_capacity(8 + image.as_raw().len());
    bytes.extend_from_slice(&width.to_le_bytes());
    bytes.extend_from_slice(&height.to_le_bytes());
    bytes.extend_from_slice(image.as_raw());
    Ok(Response::new(bytes))
}

async fn pause(duration: Duration) {
    // Не блокируем поток асинхронного рантайма Tauri.
    let _ = tauri::async_runtime::spawn_blocking(move || std::thread::sleep(duration)).await;
}
