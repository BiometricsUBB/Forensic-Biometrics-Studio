// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Emitter;
use tauri::Manager;
use std::fs;

#[cfg(target_os = "windows")]
use winreg::enums::HKEY_LOCAL_MACHINE;
#[cfg(target_os = "windows")]
use winreg::RegKey;
use tauri::WebviewUrl;
use tauri::WebviewWindowBuilder;

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
    let maybe_window = window.get_webview_window("splashscreen");

    match maybe_window {
        Some(splashscreen_window) => {
            splashscreen_window.close().unwrap();
        }
        None => {}
    }
}

#[tauri::command]
async fn open_settings_window(app: tauri::AppHandle, category: Option<String>) -> Result<(), String> {
    if let Some(settings_window) = app.get_webview_window("settings") {
        if let Some(cat) = &category {
            settings_window.emit("settings-category-change", cat).map_err(|e| e.to_string())?;
        }
        settings_window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let url = match &category {
        Some(cat) => format!("index.html?window=settings&category={}", cat),
        None => "index.html?window=settings".to_string(),
    };

    WebviewWindowBuilder::new(
        &app,
        "settings",
        WebviewUrl::App(url.into()),
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
async fn get_machine_id(app: tauri::AppHandle) -> Result<String, String> {
    if let Some(id) = read_os_machine_id() {
        return Ok(id);
    }

    let fallback = load_or_create_app_uuid(&app)?;
    Ok(fallback)
}

fn load_or_create_app_uuid(app: &tauri::AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file_path = dir.join("machine_id.txt");

    if file_path.exists() {
        let existing = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
        let trimmed = existing.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }

    let new_id = uuid::Uuid::new_v4().to_string();
    fs::write(&file_path, &new_id).map_err(|e| e.to_string())?;
    Ok(new_id)
}

fn read_os_machine_id() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let key = hklm.open_subkey("SOFTWARE\\Microsoft\\Cryptography").ok()?;
        let guid: String = key.get_value("MachineGuid").ok()?;
        if !guid.trim().is_empty() {
            return Some(guid);
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(id) = fs::read_to_string("/etc/machine-id") {
            let trimmed = id.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
        if let Ok(id) = fs::read_to_string("/var/lib/dbus/machine-id") {
            let trimmed = id.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = std::process::Command::new("ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()
        {
            if output.status.success() {
                if let Ok(text) = String::from_utf8(output.stdout) {
                    for line in text.lines() {
                        if line.contains("IOPlatformUUID") {
                            let parts: Vec<&str> = line.split('"').collect();
                            if parts.len() >= 4 {
                                let uuid = parts[3].trim();
                                if !uuid.is_empty() {
                                    return Some(uuid.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

fn main() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            println!("{}, {argv:?}, {cwd}", app.package_info().name);
            let _ = app
                .get_webview_window("main")
                .expect("no main window")
                .set_focus();
        })) 
        .invoke_handler(tauri::generate_handler![
            show_main_window_if_hidden,
            close_splashscreen_if_exists,
            open_settings_window,
            get_machine_id,
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
