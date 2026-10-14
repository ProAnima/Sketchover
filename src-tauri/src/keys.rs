//! Состояние клавиши удержания (Alt / ⌥), клавиши двойного тапа и прочих клавиш — даже когда
//! фокус в другом окне (после клика сквозь холст keyup до нас не доходит).
//! Опрос состояния клавиш, без хуков клавиатуры и без особых разрешений системы.
//!
//! Почему удержание — Alt: он почти не меняет поведение окна под холстом — колесо прокручивает
//! как обычно (с Ctrl браузер масштабирует страницу, с Shift — прокручивает вбок).

/// Клавиша двойного тапа (сквозной режим вкл/выкл) — выбирается в настройках.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tap {
    Off,
    Alt,
    Ctrl,
    Shift,
    /// ⌘ — только macOS: клавишу Win на Windows держит система.
    Cmd,
}

impl Tap {
    /// На macOS — ⌘: двойной ⌥ занят (быстрый ввод Claude), двойные ⇧ и ⌃ — в IDE JetBrains.
    pub const DEFAULT: Tap = if cfg!(target_os = "macos") {
        Tap::Cmd
    } else {
        Tap::Alt
    };

    pub fn parse(name: &str) -> Option<Tap> {
        match name {
            "off" => Some(Tap::Off),
            "alt" => Some(Tap::Alt),
            "ctrl" => Some(Tap::Ctrl),
            "shift" => Some(Tap::Shift),
            "cmd" if cfg!(target_os = "macos") => Some(Tap::Cmd),
            _ => None,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Tap::Off => "off",
            Tap::Alt => "alt",
            Tap::Ctrl => "ctrl",
            Tap::Shift => "shift",
            Tap::Cmd => "cmd",
        }
    }
}

impl Default for Tap {
    fn default() -> Self {
        Tap::DEFAULT
    }
}

#[derive(Clone, Copy)]
pub struct Keys {
    /// Зажат Alt — удержание.
    pub hold: bool,
    /// Зажата клавиша двойного тапа.
    pub tap: bool,
    /// Зажата любая другая клавиша или кнопка мыши: значит, клавиша тапа — часть комбинации.
    pub other: bool,
}

#[cfg(target_os = "windows")]
pub fn poll(tap: Tap) -> Option<Keys> {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, VK_CONTROL, VK_LCONTROL, VK_LMENU, VK_LSHIFT, VK_MENU, VK_RCONTROL,
        VK_RMENU, VK_RSHIFT, VK_SHIFT,
    };
    // Старший бит — клавиша нажата сейчас.
    let down = |vk: u16| unsafe { GetAsyncKeyState(i32::from(vk)) } as u16 & 0x8000 != 0;
    // Общий код клавиши и её левый и правый варианты: при нажатии отмечаются оба.
    let codes: &[u16] = match tap {
        Tap::Alt => &[VK_MENU, VK_LMENU, VK_RMENU],
        Tap::Ctrl => &[VK_CONTROL, VK_LCONTROL, VK_RCONTROL],
        Tap::Shift => &[VK_SHIFT, VK_LSHIFT, VK_RSHIFT],
        Tap::Off | Tap::Cmd => &[],
    };
    Some(Keys {
        hold: down(VK_MENU),
        tap: codes.first().is_some_and(|&vk| down(vk)),
        other: (0x01..=0xFE).filter(|vk| !codes.contains(vk)).any(down),
    })
}

#[cfg(target_os = "macos")]
pub fn poll(tap: Tap) -> Option<Keys> {
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventSourceFlagsState(state_id: i32) -> u64;
        fn CGEventSourceKeyState(state_id: i32, key: u16) -> bool;
        fn CGEventSourceButtonState(state_id: i32, button: u32) -> bool;
    }
    const COMBINED_SESSION_STATE: i32 = 0;
    const ALTERNATE_MASK: u64 = 0x0008_0000;
    // Флаг модификатора и коды его левой и правой клавиш.
    let (mask, codes): (u64, &[u16]) = match tap {
        Tap::Alt => (ALTERNATE_MASK, &[58, 61]),
        Tap::Ctrl => (0x0004_0000, &[59, 62]),
        Tap::Shift => (0x0002_0000, &[56, 60]),
        Tap::Cmd => (0x0010_0000, &[55, 54]),
        Tap::Off => (0, &[]),
    };
    unsafe {
        let flags = CGEventSourceFlagsState(COMBINED_SESSION_STATE);
        let key = (0..128u16)
            .filter(|k| !codes.contains(k))
            .any(|k| CGEventSourceKeyState(COMBINED_SESSION_STATE, k));
        let button = (0..3).any(|b| CGEventSourceButtonState(COMBINED_SESSION_STATE, b));
        Some(Keys {
            hold: flags & ALTERNATE_MASK != 0,
            tap: mask != 0 && flags & mask != 0,
            other: key || button,
        })
    }
}

/// Linux: пока не поддерживается (на Wayland состояние чужих клавиш недоступно в принципе).
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn poll(_tap: Tap) -> Option<Keys> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tap_names_round_trip_and_cmd_is_mac_only() {
        for tap in [Tap::Off, Tap::Alt, Tap::Ctrl, Tap::Shift] {
            assert_eq!(Tap::parse(tap.name()), Some(tap));
        }
        assert_eq!(Tap::parse("cmd").is_some(), cfg!(target_os = "macos"));
        assert_eq!(Tap::parse("Super"), None);
        assert_eq!(Tap::parse(Tap::DEFAULT.name()), Some(Tap::DEFAULT));
    }
}
