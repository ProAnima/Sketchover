//! Анонимная статистика для ProAnima Hub: при запуске — `launch`, пока программа работает —
//! `heartbeat` раз в 5 минут (по нему хаб считает онлайн). Уходят только случайный
//! install_id, версия, система и архитектура. Выключается в настройках.

use std::time::Duration;

use serde_json::json;
use tauri::{AppHandle, Manager};

use crate::settings::Store;

const ENDPOINT: &str = "https://hub.proanima.net/v1/sketchover/events";
const BEAT: Duration = Duration::from_secs(5 * 60);

/// Система в тех же словах, что `{{target}}` у обновлений: хаб сводит их в одну установку.
fn target() -> &'static str {
    match std::env::consts::OS {
        "macos" => "darwin",
        os => os,
    }
}

/// Фоновый поток почти всё время спит. В отладочной сборке не шлём ничего —
/// иначе запуски разработчика попадали бы в статистику.
pub fn start(app: &AppHandle) {
    if cfg!(debug_assertions) {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        // reqwest собран без своего криптопровайдера — ставим тот же, что плагин обновлений.
        if rustls::crypto::CryptoProvider::get_default().is_none() {
            let _ = rustls::crypto::ring::default_provider().install_default();
        }
        let client = match reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
        {
            Ok(client) => client,
            Err(e) => return eprintln!("Статистика выключена: {e}"),
        };
        let version = app.package_info().version.to_string();
        let mut kind = "launch";
        loop {
            let settings = app.state::<Store>().get();
            if settings.share_stats {
                let body = json!({
                    "install_id": settings.install_id,
                    "version": version,
                    "os": target(),
                    "arch": std::env::consts::ARCH,
                    "events": [{ "kind": kind }],
                });
                let sent = tauri::async_runtime::block_on(client.post(ENDPOINT).json(&body).send());
                // Нет сети — не беда: следующий пульс через 5 минут.
                if let Err(e) = sent.and_then(|r| r.error_for_status()) {
                    eprintln!("Статистика не отправлена: {e}");
                }
                kind = "heartbeat";
            }
            std::thread::sleep(BEAT);
        }
    });
}
