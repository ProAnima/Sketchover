//! Состояние клавиши удержания, клавиши двойного тапа и прочих клавиш — даже когда
//! фокус в другом окне (после клика сквозь холст keyup до нас не доходит).
//! Опрос состояния клавиш, без хуков клавиатуры и без особых разрешений системы.
//!
//! Почему удержание по умолчанию — Alt: он почти не меняет поведение окна под холстом —
//! колесо прокручивает как обычно (с Ctrl браузер масштабирует страницу, с Shift —
//! прокручивает вбок).

/// Модификатор для удержания и для двойного тапа — выбирается в настройках.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Modifier {
    Off,
    Alt,
    Ctrl,
    Shift,
    /// ⌘ — только macOS: клавишу Win на Windows держит система.
    Cmd,
}

impl Modifier {
    /// Удержание — мышь окнам под холстом.
    pub const HOLD_DEFAULT: Modifier = Modifier::Alt;
    /// Двойной тап — на macOS ⌘: двойной ⌥ занят (быстрый ввод Claude), двойные ⇧ и ⌃ — в IDE JetBrains.
    pub const TAP_DEFAULT: Modifier = if cfg!(target_os = "macos") {
        Modifier::Cmd
    } else {
        Modifier::Alt
    };

    pub fn parse(name: &str) -> Option<Modifier> {
        match name {
            "off" => Some(Modifier::Off),
            "alt" => Some(Modifier::Alt),
            "ctrl" => Some(Modifier::Ctrl),
            "shift" => Some(Modifier::Shift),
            "cmd" if cfg!(target_os = "macos") => Some(Modifier::Cmd),
            _ => None,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Modifier::Off => "off",
            Modifier::Alt => "alt",
            Modifier::Ctrl => "ctrl",
            Modifier::Shift => "shift",
            Modifier::Cmd => "cmd",
        }
    }
}

#[derive(Clone, Copy)]
pub struct Keys {
    /// Зажата клавиша удержания.
    pub hold: bool,
    /// Зажата клавиша двойного тапа.
    pub tap: bool,
    /// Зажата любая другая клавиша или кнопка мыши: значит, клавиша тапа — часть комбинации.
    pub other: bool,
}

#[cfg(target_os = "windows")]
pub fn poll(hold: Modifier, tap: Modifier) -> Option<Keys> {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, VK_CONTROL, VK_LCONTROL, VK_LMENU, VK_LSHIFT, VK_MENU, VK_RCONTROL,
        VK_RMENU, VK_RSHIFT, VK_SHIFT,
    };
    // Старший бит — клавиша нажата сейчас.
    let down = |vk: u16| unsafe { GetAsyncKeyState(i32::from(vk)) } as u16 & 0x8000 != 0;
    // Общий код клавиши и её левый и правый варианты: при нажатии отмечаются оба.
    let codes = |m: Modifier| -> &[u16] {
        match m {
            Modifier::Alt => &[VK_MENU, VK_LMENU, VK_RMENU],
            Modifier::Ctrl => &[VK_CONTROL, VK_LCONTROL, VK_RCONTROL],
            Modifier::Shift => &[VK_SHIFT, VK_LSHIFT, VK_RSHIFT],
            Modifier::Off | Modifier::Cmd => &[],
        }
    };
    let tap_codes = codes(tap);
    Some(Keys {
        hold: codes(hold).first().is_some_and(|&vk| down(vk)),
        tap: tap_codes.first().is_some_and(|&vk| down(vk)),
        other: (0x01..=0xFE).filter(|vk| !tap_codes.contains(vk)).any(down),
    })
}

#[cfg(target_os = "macos")]
pub fn poll(hold: Modifier, tap: Modifier) -> Option<Keys> {
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventSourceFlagsState(state_id: i32) -> u64;
        fn CGEventSourceKeyState(state_id: i32, key: u16) -> bool;
        fn CGEventSourceButtonState(state_id: i32, button: u32) -> bool;
    }
    const COMBINED_SESSION_STATE: i32 = 0;
    // Флаг модификатора и коды его левой и правой клавиш.
    let flag = |m: Modifier| -> (u64, &[u16]) {
        match m {
            Modifier::Alt => (0x0008_0000, &[58, 61]),
            Modifier::Ctrl => (0x0004_0000, &[59, 62]),
            Modifier::Shift => (0x0002_0000, &[56, 60]),
            Modifier::Cmd => (0x0010_0000, &[55, 54]),
            Modifier::Off => (0, &[]),
        }
    };
    let (hold_mask, _) = flag(hold);
    let (tap_mask, tap_codes) = flag(tap);
    unsafe {
        let flags = CGEventSourceFlagsState(COMBINED_SESSION_STATE);
        let key = (0..128u16)
            .filter(|k| !tap_codes.contains(k))
            .any(|k| CGEventSourceKeyState(COMBINED_SESSION_STATE, k));
        let button = (0..3).any(|b| CGEventSourceButtonState(COMBINED_SESSION_STATE, b));
        Some(Keys {
            hold: hold_mask != 0 && flags & hold_mask != 0,
            tap: tap_mask != 0 && flags & tap_mask != 0,
            other: key || button,
        })
    }
}

/// Linux: пока не поддерживается (на Wayland состояние чужих клавиш недоступно в принципе).
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn poll(_hold: Modifier, _tap: Modifier) -> Option<Keys> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn modifier_names_round_trip_and_cmd_is_mac_only() {
        for m in [
            Modifier::Off,
            Modifier::Alt,
            Modifier::Ctrl,
            Modifier::Shift,
        ] {
            assert_eq!(Modifier::parse(m.name()), Some(m));
        }
        assert_eq!(Modifier::parse("cmd").is_some(), cfg!(target_os = "macos"));
        assert_eq!(Modifier::parse("Super"), None);
        for default in [Modifier::HOLD_DEFAULT, Modifier::TAP_DEFAULT] {
            assert_eq!(Modifier::parse(default.name()), Some(default));
        }
    }
}
