// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tauri::WebviewUrl;
use tauri::WebviewWindowBuilder;
use tauri::Emitter;

#[tauri::command]
async fn show_main_window_if_hidden(window: tauri::Window) {
    let main_window = window
        .get_webview_window("main")
        .expect("no window labeled 'main' found");

    if let Ok(is_visible) = main_window.is_visible() {
        if !is_visible {
            main_window.show().unwrap();
        }
    }
}

#[tauri::command]
async fn close_splashscreen_if_exists(window: tauri::Window) {
    if let Some(splashscreen_window) = window.get_webview_window("splashscreen") {
        splashscreen_window.close().unwrap();
    }
}

#[tauri::command]
async fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(settings_window) = app.get_webview_window("settings") {
        settings_window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        "settings",
        WebviewUrl::App("index.html?window=settings".into()),
    )
    .title("Settings")
    .inner_size(600.0, 450.0)
    .min_inner_size(400.0, 300.0)
    .resizable(true)
    .decorations(false)
    .transparent(true)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn open_edit_window(app: tauri::AppHandle, image_path: Option<String>) -> Result<(), String> {
    if let Some(edit_window) = app.get_webview_window("edit") {
        edit_window.set_focus().map_err(|e| e.to_string())?;
        // Send the image path to the existing window via event
        if let Some(path) = image_path {
            edit_window.emit("image-path-changed", path).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    // Build URL with image path if provided (for new windows)
    let mut url = "index.html?window=edit".to_string();
    if let Some(path) = &image_path {
        // Simple URL encoding - replace backslashes and encode special chars
        let mut encoded = String::new();
        for c in path.chars() {
            match c {
                '\\' => encoded.push('/'),  // Normalize to forward slashes
                ' ' => encoded.push_str("%20"),
                '#' => encoded.push_str("%23"),
                '%' => encoded.push_str("%25"),
                '&' => encoded.push_str("%26"),
                '+' => encoded.push_str("%2B"),
                '=' => encoded.push_str("%3D"),
                '?' => encoded.push_str("%3F"),
                _ => encoded.push(c),
            }
        }
        url = format!("{}&imagePath={}", url, encoded);
    }

    let _window = WebviewWindowBuilder::new(
        &app,
        "edit",
        WebviewUrl::App(url.into()),
    )
    .title("Edit Image")
    .inner_size(800.0, 600.0)
    .min_inner_size(400.0, 300.0)
    .resizable(true)
    .decorations(false)
    .transparent(true)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    // Path is passed via URL, so the frontend will read it from there

    Ok(())
}

fn main() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            show_main_window_if_hidden,
            close_splashscreen_if_exists,
            open_settings_window,
            open_edit_window,
        ]);

    #[cfg(target_os = "windows")]
    {
        use tauri_plugin_window_state::{Builder as WindowStateBuilder, StateFlags};

        builder = builder.plugin(
            WindowStateBuilder::default()
                .with_state_flags(
                    StateFlags::all() & !StateFlags::VISIBLE & !StateFlags::DECORATIONS,
                )
                .build(),
        );
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running Biometrics Studio");
}
