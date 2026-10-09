//! Холст наружу: картинка в буфер обмена, сохранение и открытие (PNG со сценой внутри)
//! через системные диалоги.
//! Путь выбирает человек в диалоге — интерфейс путей не задаёт и записать куда-то ещё не может.

use std::fs;
use std::path::Path;

use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::{DialogExt, FileDialogBuilder};

use crate::overlay;

/// Больше холст не бывает даже со множеством скриншотов 4K; защищает от чтения чужих огромных файлов.
const MAX_FILE_BYTES: u64 = 256 * 1024 * 1024;
const DEFAULT_NAME: &str = "Sketchover.png";

/// Имя файла из заголовка интерфейса — только как подсказка в диалоге: без каталогов, с .png.
fn suggested_name(request: &Request<'_>) -> String {
    let name = request
        .headers()
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .and_then(percent_decode)
        .and_then(|v| {
            Path::new(&v)
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
        })
        .unwrap_or_else(|| DEFAULT_NAME.into());
    if name.to_lowercase().ends_with(".png") {
        name
    } else {
        format!("{name}.png")
    }
}

/// Заголовки HTTP — только ASCII, поэтому интерфейс кодирует имя через encodeURIComponent.
fn percent_decode(s: &str) -> Option<String> {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = std::str::from_utf8(bytes.get(i + 1..i + 3)?).ok()?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// Диалог, привязанный к окну холста: холст — полноэкранное окно поверх всех, и диалог без
/// владельца открылся бы под ним — невидимым и недоступным для клика.
fn file_dialog(app: &AppHandle) -> FileDialogBuilder<tauri::Wry> {
    let mut dialog = app.dialog().file().add_filter("PNG", &["png"]);
    if let Some(win) = app.get_webview_window(overlay::LABEL) {
        dialog = dialog.set_parent(&win);
    }
    if let Ok(dir) = app.path().picture_dir() {
        dialog = dialog.set_directory(dir);
    }
    dialog
}

/// Тело запроса — байты PNG. Возвращает имя сохранённого файла или `None`, если диалог закрыли.
#[tauri::command]
pub async fn save_png(app: AppHandle, request: Request<'_>) -> Result<Option<String>, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("invalid".into());
    };
    if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Err("invalid".into());
    }
    let dialog = file_dialog(&app).set_file_name(suggested_name(&request));
    // Блокирующий диалог — в асинхронной команде, то есть не в главном потоке.
    let Some(path) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    let path = path.into_path().map_err(|e| e.to_string())?;
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.file_name().map(|n| n.to_string_lossy().into_owned()))
}

/// Тело запроса — пиксели RGBA, размер — в заголовках `x-width` / `x-height`.
#[tauri::command]
pub fn copy_image(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let InvokeBody::Raw(rgba) = request.body() else {
        return Err("invalid".into());
    };
    let dim = |name: &str| {
        request
            .headers()
            .get(name)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u32>().ok())
            .filter(|&v| v > 0)
    };
    let (Some(width), Some(height)) = (dim("x-width"), dim("x-height")) else {
        return Err("invalid".into());
    };
    if rgba.len() as u64 != u64::from(width) * u64::from(height) * 4 {
        return Err("invalid".into());
    }
    app.clipboard()
        .write_image(&tauri::image::Image::new(rgba, width, height))
        .map_err(|e| e.to_string())
}

/// Байты выбранного PNG; пустой ответ — диалог закрыли.
#[tauri::command]
pub async fn open_png(app: AppHandle) -> Result<Response, String> {
    let Some(path) = file_dialog(&app).blocking_pick_file() else {
        return Ok(Response::new(Vec::new()));
    };
    let path = path.into_path().map_err(|e| e.to_string())?;
    let size = fs::metadata(&path).map_err(|e| e.to_string())?.len();
    if size > MAX_FILE_BYTES {
        return Err("too large".into());
    }
    fs::read(&path)
        .map(Response::new)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::percent_decode;

    #[test]
    fn decodes_names_from_header() {
        assert_eq!(
            percent_decode("%D0%A1%D1%85%D0%B5%D0%BC%D0%B0.png").as_deref(),
            Some("Схема.png")
        );
        assert_eq!(percent_decode("plain.png").as_deref(), Some("plain.png"));
        assert_eq!(percent_decode("bad%G1"), None);
        assert_eq!(percent_decode("cut%D"), None);
    }
}
