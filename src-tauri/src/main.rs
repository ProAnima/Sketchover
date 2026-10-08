// Без лишнего окна консоли на Windows в релизе.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    sketchover_lib::run()
}
