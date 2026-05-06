// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Emitter;
use tauri::Manager;
use std::fs;
use std::sync::Mutex;

#[cfg(target_os = "macos")]
use tauri::menu::{
    AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
};

struct WorkingModeState(Mutex<Option<String>>);

#[tauri::command]
fn set_working_mode(state: tauri::State<WorkingModeState>, mode: String) {
    *state.0.lock().unwrap_or_else(|e| e.into_inner()) = Some(mode);
}

#[tauri::command]
fn get_working_mode(state: tauri::State<WorkingModeState>) -> Option<String> {
    state.0.lock().unwrap_or_else(|e| e.into_inner()).clone()
}

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
    if let Some(splashscreen_window) = window.get_webview_window("splashscreen") {
        splashscreen_window.close().unwrap();
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

    let settings_builder = WebviewWindowBuilder::new(
        &app,
        "settings",
        WebviewUrl::App(url.into()),
    )
    .title("Settings")
    .inner_size(600.0, 450.0)
    .min_inner_size(400.0, 300.0)
    .resizable(true)
    .center();

    #[cfg(target_os = "macos")]
    let settings_builder = settings_builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);

    #[cfg(not(target_os = "macos"))]
    let settings_builder = settings_builder.decorations(false).transparent(true);

    settings_builder.build().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn open_edit_window(app: tauri::AppHandle, image_path: Option<String>) -> Result<(), String> {
    if let Some(edit_window) = app.get_webview_window("edit") {
        edit_window.set_focus().map_err(|e| e.to_string())?;
        if let Some(path) = image_path {
            edit_window.emit("image-path-changed", path).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    let mut url = "index.html?window=edit".to_string();
    if let Some(path) = &image_path {
        let mut encoded = String::new();
        for c in path.chars() {
            match c {
                '\\' => encoded.push('/'),
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

    let edit_builder = WebviewWindowBuilder::new(
        &app,
        "edit",
        WebviewUrl::App(url.into()),
    )
    .title("Edit Image")
    .inner_size(800.0, 600.0)
    .min_inner_size(400.0, 300.0)
    .resizable(true)
    .center();

    #[cfg(target_os = "macos")]
    let edit_builder = edit_builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);

    #[cfg(not(target_os = "macos"))]
    let edit_builder = edit_builder.decorations(false).transparent(true);

    let _window = edit_builder.build().map_err(|e| e.to_string())?;

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

#[cfg(target_os = "macos")]
fn install_macos_menu(app: &tauri::AppHandle) -> tauri::Result<()> {
    let app_name = "Forensic Biometrics Studio";
    let about_metadata = AboutMetadataBuilder::new()
        .name(Some(app_name.to_string()))
        .version(Some(env!("CARGO_PKG_VERSION").to_string()))
        .build();

    let app_submenu = SubmenuBuilder::new(app, app_name)
        .item(&PredefinedMenuItem::about(
            app,
            Some(&format!("About {}", app_name)),
            Some(about_metadata),
        )?)
        .separator()
        .item(
            &MenuItemBuilder::with_id("settings", "Settings…")
                .accelerator("CmdOrCtrl+,")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::services(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    let mode_submenu = SubmenuBuilder::new(app, "Mode")
        .item(&MenuItemBuilder::with_id("mode-FINGERPRINT", "Fingerprints").build(app)?)
        .item(&MenuItemBuilder::with_id("mode-EAR", "Ears").build(app)?)
        .item(&MenuItemBuilder::with_id("mode-SHOEPRINT", "Shoeprints").build(app)?)
        .build()?;

    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .build()?;

    let window_submenu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&app_submenu, &edit_submenu, &mode_submenu, &window_submenu])
        .build()?;

    app.set_menu(menu)?;
    Ok(())
}

fn main() {
    let builder = tauri::Builder::default()
        .manage(WorkingModeState(Mutex::new(None)))
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            println!("{}, {argv:?}, {cwd}", app.package_info().name);
            let _ = app
                .get_webview_window("main")
                .expect("no main window")
                .set_focus();
        }))
        .setup(|app| {
            #[cfg(target_os = "macos")]
            install_macos_menu(app.handle())?;
            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "settings" => {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = open_settings_window(app_handle, None).await;
                });
            }
            id if id.starts_with("mode-") => {
                let mode = id.trim_start_matches("mode-").to_string();
                if let Some(main) = app.get_webview_window("main") {
                    let _ = main.emit("native-menu-mode-change", mode);
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            show_main_window_if_hidden,
            close_splashscreen_if_exists,
            open_settings_window,
            open_edit_window,
            get_machine_id,
            set_working_mode,
            get_working_mode,
        ]);

    #[cfg(target_os = "windows")]
    let builder = {
        use tauri_plugin_window_state::{Builder as WindowStateBuilder, StateFlags};
        builder.plugin(
            WindowStateBuilder::default()
                .with_state_flags(
                    StateFlags::all() & !StateFlags::VISIBLE & !StateFlags::DECORATIONS,
                )
                .build(),
        )
    };

    builder
        .run(tauri::generate_context!())
        .expect("error while running Biometrics Studio");
}


