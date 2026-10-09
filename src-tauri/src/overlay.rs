//! Окно-оверлей: показ на мониторе с курсором, сквозные клики (режим, удержание Alt,
//! двойной тап Alt) с кликабельной панелью.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard, OnceLock};
use std::thread::{self, Thread};
use std::time::{Duration, Instant};

use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::keys;

pub const LABEL: &str = "overlay";
/// Как часто, пока холст виден, проверяем Alt и курсор: ~30 раз в секунду незаметно глазу и почти не грузит CPU.
const POLL: Duration = Duration::from_millis(33);
/// Тап — Alt отпущен не позже, чем через столько после нажатия.
const TAP_MAX: Duration = Duration::from_millis(300);
/// Двойной тап — второй тап не позже, чем через столько после первого.
const DOUBLE_TAP_GAP: Duration = Duration::from_millis(400);

/// Прямоугольник панели в CSS-пикселях окна.
#[derive(Clone, Copy, Default, Deserialize)]
pub struct Rect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

impl Rect {
    pub fn is_valid(&self) -> bool {
        [self.x, self.y, self.w, self.h]
            .iter()
            .all(|v| v.is_finite())
            && self.w >= 0.0
            && self.h >= 0.0
    }
    fn contains(&self, x: f64, y: f64) -> bool {
        x >= self.x && x <= self.x + self.w && y >= self.y && y <= self.y + self.h
    }
}

#[derive(Default)]
struct State {
    /// Зажат Alt — временно сквозные клики.
    peeking: bool,
    /// Включён режим «сквозные клики».
    pass: bool,
    panel: Rect,
    /// Что сейчас выставлено окну; `None` — неизвестно, выставить заново.
    ignoring: Option<bool>,
    /// Когда зажали Alt и нажималось ли вместе с ним что-то ещё (тогда это комбинация, не тап).
    alt_since: Option<Instant>,
    alt_combo: bool,
    /// Когда закончился предыдущий тап.
    last_tap: Option<Instant>,
}

impl State {
    /// Отслеживает тапы Alt; `true` — только что случился двойной тап.
    fn track_taps(&mut self, k: keys::Keys, now: Instant) -> bool {
        match (k.hold, self.alt_since) {
            (true, None) => {
                self.alt_since = Some(now);
                self.alt_combo = k.other;
            }
            (true, Some(_)) => self.alt_combo |= k.other,
            (false, Some(since)) => {
                self.alt_since = None;
                let tap = !self.alt_combo && now - since <= TAP_MAX;
                if !tap {
                    self.last_tap = None;
                } else if self.last_tap.is_some_and(|t| now - t <= DOUBLE_TAP_GAP) {
                    self.last_tap = None;
                    return true;
                } else {
                    self.last_tap = Some(now);
                }
            }
            (false, None) => {}
        }
        false
    }
}

/// Tauri, в отличие от Electron, не пересылает движение мыши окну, игнорирующему клики,
/// а после клика сквозь холст фокус уходит в другое окно и отпускание Alt до нас не доходит.
/// Поэтому, пока холст виден, фоновый поток ~30 раз в секунду просит главный поток
/// проверить Alt и курсор. Холст спрятан — поток спит.
///
/// Всё, что трогает окно, выполняется только в главном потоке (`sync`): фоновый поток ничего
/// не ждёт и замков не держит — иначе он и главный поток могли бы заблокировать друг друга.
#[derive(Default)]
pub struct ClickThrough {
    visible: AtomicBool,
    state: Mutex<State>,
    poller: OnceLock<Thread>,
}

impl ClickThrough {
    fn lock(&self) -> MutexGuard<'_, State> {
        self.state.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn set_pass(&self, app: &AppHandle, pass: bool, panel: Rect) {
        {
            let mut s = self.lock();
            s.pass = pass;
            s.panel = panel;
        }
        request_sync(app);
    }

    fn set_visible(&self, app: &AppHandle, visible: bool) {
        self.visible.store(visible, Ordering::Relaxed);
        if !visible {
            let mut s = self.lock();
            s.pass = false;
            s.peeking = false;
        }
        request_sync(app);
        if visible {
            if let Some(t) = self.poller.get() {
                t.unpark();
            }
        }
    }
}

fn request_sync(app: &AppHandle) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || sync(&handle));
}

/// Только в главном потоке: сверяет Alt (удержание, двойной тап) и курсор и выставляет окну, пропускать ли мышь.
fn sync(app: &AppHandle) {
    let Some(win) = app.get_webview_window(LABEL) else {
        return;
    };
    let clicks = app.state::<ClickThrough>();
    let visible = clicks.visible.load(Ordering::Relaxed);
    let mut s = clicks.lock();

    let k = keys::poll().filter(|_| visible).unwrap_or(keys::Keys {
        hold: false,
        other: false,
    });
    if s.track_taps(k, Instant::now()) {
        // Двойной тап Alt: рисование ⇄ сквозные клики — как глобальный хоткей.
        let _ = app.emit("overlay:toggle", ());
    }
    let held = k.hold;
    if held != s.peeking {
        s.peeking = held;
        let _ = app.emit("overlay:peek", held);
        // Пока Alt был зажат, клик мог увести фокус — возвращаем его холсту, чтобы работали клавиши.
        if !held && !s.pass {
            focus(&win);
        }
    }

    let through = visible && (s.pass || s.peeking);
    let ignore = through && !cursor_in(&win, s.panel).unwrap_or(false);
    if s.ignoring != Some(ignore) && win.set_ignore_cursor_events(ignore).is_ok() {
        s.ignoring = Some(ignore);
    }
}

/// Окно на передний план и фокус клавиатуры внутрь WebView: фокус одного лишь окна
/// до страницы не доходит, и клавиши не работали бы до первого клика по холсту.
/// Если окно уже в фокусе — ничего не делаем: фокус WebView сбросил бы фокус
/// внутри страницы, и открытое поле ввода текста закрылось бы.
pub fn focus(win: &WebviewWindow) {
    if win.is_focused().unwrap_or(false) {
        return;
    }
    let _ = win.set_focus();
    let _ = win.as_ref().set_focus();
}

fn cursor_in(win: &WebviewWindow, rect: Rect) -> Option<bool> {
    let cursor = win.cursor_position().ok()?;
    let origin = win.inner_position().ok()?;
    let scale = win.scale_factor().ok()?;
    Some(rect.contains(
        (cursor.x - f64::from(origin.x)) / scale,
        (cursor.y - f64::from(origin.y)) / scale,
    ))
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, LABEL, WebviewUrl::default())
        .title("Sketchover")
        .transparent(true)
        .decorations(false)
        .resizable(false)
        .shadow(false)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
        .skip_taskbar(true)
        .visible(false)
        .build()?;

    let poll_app = app.clone();
    let handle = thread::spawn(move || loop {
        if poll_app
            .state::<ClickThrough>()
            .visible
            .load(Ordering::Relaxed)
        {
            request_sync(&poll_app);
            thread::sleep(POLL);
        } else {
            thread::park();
        }
    });
    let _ = app
        .state::<ClickThrough>()
        .poller
        .set(handle.thread().clone());
    Ok(())
}

/// Растягивает окно на монитор, где сейчас курсор (иначе — на основной).
fn fit_to_cursor_monitor(win: &WebviewWindow) {
    let monitor = win
        .cursor_position()
        .ok()
        .and_then(|c| win.monitor_from_point(c.x, c.y).ok().flatten())
        .or_else(|| win.primary_monitor().ok().flatten());
    if let Some(m) = monitor {
        let _ = win.set_position(*m.position());
        let _ = win.set_size(*m.size());
    }
}

/// Показать холст в режиме рисования.
pub fn show(app: &AppHandle) {
    let Some(win) = app.get_webview_window(LABEL) else {
        return;
    };
    if !win.is_visible().unwrap_or(false) {
        fit_to_cursor_monitor(&win);
        let _ = win.show();
    }
    app.state::<ClickThrough>().set_visible(app, true);
    focus(&win);
    let _ = app.emit("overlay:show", ());
}

pub fn hide(app: &AppHandle) {
    let Some(win) = app.get_webview_window(LABEL) else {
        return;
    };
    app.state::<ClickThrough>().set_visible(app, false);
    let _ = win.hide();
}

/// Глобальный хоткей: спрятан → показать; виден → рисование ⇄ сквозные клики (решает интерфейс).
pub fn on_hotkey(app: &AppHandle) {
    let visible = app
        .get_webview_window(LABEL)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    if visible {
        let _ = app.emit("overlay:toggle", ());
    } else {
        show(app);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const UP: keys::Keys = keys::Keys {
        hold: false,
        other: false,
    };
    const ALT: keys::Keys = keys::Keys {
        hold: true,
        other: false,
    };
    const ALT_TAB: keys::Keys = keys::Keys {
        hold: true,
        other: true,
    };

    /// Прогоняет последовательность (состояние клавиш, мс от начала); возвращает, был ли двойной тап.
    fn run(steps: &[(keys::Keys, u64)]) -> bool {
        let start = Instant::now();
        let mut s = State::default();
        steps
            .iter()
            .any(|&(k, ms)| s.track_taps(k, start + Duration::from_millis(ms)))
    }

    #[test]
    fn double_tap_toggles() {
        assert!(run(&[(ALT, 0), (UP, 100), (ALT, 250), (UP, 350)]));
    }

    #[test]
    fn single_tap_does_not() {
        assert!(!run(&[(ALT, 0), (UP, 100)]));
    }

    #[test]
    fn slow_second_tap_does_not() {
        assert!(!run(&[(ALT, 0), (UP, 100), (ALT, 700), (UP, 800)]));
    }

    #[test]
    fn long_hold_is_not_a_tap() {
        assert!(!run(&[(ALT, 0), (UP, 600), (ALT, 700), (UP, 800)]));
    }

    #[test]
    fn combination_is_not_a_tap() {
        // Alt+Tab дважды подряд не должен переключать режим.
        assert!(!run(&[(ALT_TAB, 0), (UP, 100), (ALT_TAB, 200), (UP, 300)]));
        assert!(!run(&[
            (ALT, 0),
            (ALT_TAB, 40),
            (UP, 100),
            (ALT, 200),
            (UP, 300)
        ]));
    }

    #[test]
    fn triple_tap_toggles_once() {
        let start = Instant::now();
        let mut s = State::default();
        let hits = [
            (ALT, 0),
            (UP, 80),
            (ALT, 160),
            (UP, 240),
            (ALT, 320),
            (UP, 400),
        ]
        .iter()
        .filter(|&&(k, ms)| s.track_taps(k, start + Duration::from_millis(ms)))
        .count();
        assert_eq!(hits, 1);
    }
}
