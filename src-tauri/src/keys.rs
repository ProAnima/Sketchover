//! Состояние клавиши удержания (Alt / ⌥) и прочих клавиш — даже когда фокус в другом окне
//! (после клика сквозь холст keyup до нас не доходит).
//! Опрос состояния клавиш, без хуков клавиатуры и без особых разрешений системы.
//!
//! Почему Alt: он почти не меняет поведение окна под холстом — колесо прокручивает как обычно
//! (с Ctrl браузер масштабирует страницу, с Shift — прокручивает вбок).

#[derive(Clone, Copy)]
pub struct Keys {
    /// Зажат Alt.
    pub hold: bool,
    /// Зажата любая другая клавиша или кнопка мыши: значит, Alt — часть комбинации, а не тап.
    pub other: bool,
}

#[cfg(target_os = "windows")]
pub fn poll() -> Option<Keys> {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, VK_LMENU, VK_MENU, VK_RMENU,
    };
    // Старший бит — клавиша нажата сейчас.
    let down = |vk: u16| unsafe { GetAsyncKeyState(i32::from(vk)) } as u16 & 0x8000 != 0;
    let alt = [VK_MENU, VK_LMENU, VK_RMENU];
    Some(Keys {
        hold: down(VK_MENU),
        other: (0x01..=0xFE).filter(|vk| !alt.contains(vk)).any(down),
    })
}

#[cfg(target_os = "macos")]
pub fn poll() -> Option<Keys> {
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventSourceFlagsState(state_id: i32) -> u64;
        fn CGEventSourceKeyState(state_id: i32, key: u16) -> bool;
        fn CGEventSourceButtonState(state_id: i32, button: u32) -> bool;
    }
    const COMBINED_SESSION_STATE: i32 = 0;
    const ALTERNATE_MASK: u64 = 0x0008_0000;
    const OPTION_KEYS: [u16; 2] = [58, 61];
    unsafe {
        let hold = CGEventSourceFlagsState(COMBINED_SESSION_STATE) & ALTERNATE_MASK != 0;
        let key = (0..128u16)
            .filter(|k| !OPTION_KEYS.contains(k))
            .any(|k| CGEventSourceKeyState(COMBINED_SESSION_STATE, k));
        let button = (0..3).any(|b| CGEventSourceButtonState(COMBINED_SESSION_STATE, b));
        Some(Keys {
            hold,
            other: key || button,
        })
    }
}

/// Linux: пока не поддерживается (на Wayland состояние чужих клавиш недоступно в принципе).
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn poll() -> Option<Keys> {
    None
}
