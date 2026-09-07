//! Bridge to the bundled R runtime that runs the CSAFE `shoeprintr` comparison.
//!
//! The frontend extracts edge point clouds from the two loaded images and writes
//! them as CSV. This module locates the bundled R installation, runs
//! `r/shoeprint_compare.R` against those files, streams progress back to the UI
//! and returns the JSON the script produced.

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const PROGRESS_EVENT: &str = "shoeprint-comparison-progress";

/// Holds the running R process so a comparison can be cancelled from the UI.
#[derive(Default)]
pub struct ShoeprintState {
    child: Arc<Mutex<Option<Child>>>,
    cancelled: Arc<AtomicBool>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub available: bool,
    pub rscript_path: Option<String>,
    pub library_path: Option<String>,
    pub script_path: Option<String>,
    pub detail: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonRequest {
    pub input_path: String,
    pub reference_path: String,
    pub output_path: String,
    pub plot_path: Option<String>,
    pub max_rotation_angle: Option<f64>,
    pub circle_radius: Option<f64>,
    pub seed: Option<i64>,
    pub cores: Option<i64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    stage: String,
    percent: u8,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonOutcome {
    pub json: String,
    pub plot_path: Option<String>,
    pub duration_ms: u128,
}

/// Directories that may contain the bundled runtime, most specific first.
fn runtime_candidates(app: &AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(dir) = std::env::var("FBS_R_RUNTIME") {
        candidates.push(PathBuf::from(dir));
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("r-runtime"));
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("r-runtime"));
        }
    }

    // Repository layout, for `tauri dev`.
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("src-tauri").join("r-runtime"));
        candidates.push(cwd.join("r-runtime"));
        if let Some(parent) = cwd.parent() {
            candidates.push(parent.join("src-tauri").join("r-runtime"));
        }
    }

    candidates
}

fn rscript_relative_paths() -> &'static [&'static str] {
    if cfg!(target_os = "windows") {
        &["bin/x64/Rscript.exe", "bin/Rscript.exe"]
    } else {
        &["bin/Rscript"]
    }
}

fn find_runtime(app: &AppHandle) -> Option<(PathBuf, PathBuf)> {
    for root in runtime_candidates(app) {
        for relative in rscript_relative_paths() {
            let candidate = root.join(relative);
            if candidate.is_file() {
                return Some((root.clone(), candidate));
            }
        }
    }
    None
}

/// macOS and Linux builds fall back to a system R
fn find_system_rscript() -> Option<PathBuf> {
    let output = Command::new("Rscript").arg("--version").output().ok()?;
    if output.status.success() {
        Some(PathBuf::from("Rscript"))
    } else {
        None
    }
}

fn find_runner_script(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("r").join("shoeprint_compare.R"));
    }
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("r").join("shoeprint_compare.R"));
        if let Some(parent) = cwd.parent() {
            candidates.push(parent.join("r").join("shoeprint_compare.R"));
        }
    }

    candidates.into_iter().find(|path| path.is_file())
}

struct ResolvedEngine {
    rscript: PathBuf,
    library: Option<PathBuf>,
    script: PathBuf,
}

fn resolve_engine(app: &AppHandle) -> Result<ResolvedEngine, String> {
    let script = find_runner_script(app)
        .ok_or_else(|| "shoeprint_compare.R was not found next to the application".to_string())?;

    if let Some((root, rscript)) = find_runtime(app) {
        let library = root.join("library");
        return Ok(ResolvedEngine {
            rscript,
            library: library.is_dir().then_some(library),
            script,
        });
    }

    // No bundled R: fall back to a system install
    let rscript = find_system_rscript().ok_or_else(|| {
        "no bundled R runtime was found and R is not installed on this system".to_string()
    })?;

    let library = runtime_candidates(app)
        .into_iter()
        .map(|root| root.join("library"))
        .find(|path| path.is_dir());

    Ok(ResolvedEngine {
        rscript,
        library,
        script,
    })
}

fn configure_command(engine: &ResolvedEngine) -> Command {
    let mut command = Command::new(&engine.rscript);
    command.arg("--vanilla").arg(&engine.script);

    if let Some(library) = &engine.library {
        // Both are set because R consults them at different points depending on
        // whether the runtime is bundled or a system install.
        command.env("R_LIBS_USER", library);
        command.env("R_LIBS_SITE", library);
        command.env("R_LIBS", library);
    }

    // Keep the R session from picking up a developer's personal profile.
    command.env("R_ENVIRON_USER", "");
    command.env("R_PROFILE_USER", "");

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    command
}

#[tauri::command]
pub async fn shoeprint_engine_status(app: AppHandle) -> Result<EngineStatus, String> {
    tauri::async_runtime::spawn_blocking(move || engine_status_blocking(&app))
        .await
        .map_err(|e| e.to_string())
}

fn engine_status_blocking(app: &AppHandle) -> EngineStatus {
    match resolve_engine(app) {
        Ok(engine) => {
            let mut command = configure_command(&engine);
            command.arg("--check");
            command.stdout(Stdio::piped()).stderr(Stdio::piped());

            match command.output() {
                Ok(output) if output.status.success() => EngineStatus {
                    available: true,
                    rscript_path: Some(engine.rscript.to_string_lossy().into_owned()),
                    library_path: engine
                        .library
                        .as_ref()
                        .map(|p| p.to_string_lossy().into_owned()),
                    script_path: Some(engine.script.to_string_lossy().into_owned()),
                    detail: "ready".to_string(),
                },
                Ok(output) => EngineStatus {
                    available: false,
                    rscript_path: Some(engine.rscript.to_string_lossy().into_owned()),
                    library_path: engine
                        .library
                        .as_ref()
                        .map(|p| p.to_string_lossy().into_owned()),
                    script_path: Some(engine.script.to_string_lossy().into_owned()),
                    detail: String::from_utf8_lossy(&output.stderr).trim().to_string(),
                },
                Err(err) => EngineStatus {
                    available: false,
                    rscript_path: Some(engine.rscript.to_string_lossy().into_owned()),
                    library_path: None,
                    script_path: Some(engine.script.to_string_lossy().into_owned()),
                    detail: err.to_string(),
                },
            }
        }
        Err(detail) => EngineStatus {
            available: false,
            rscript_path: None,
            library_path: None,
            script_path: None,
            detail,
        },
    }
}

fn emit_progress(app: &AppHandle, stage: &str, percent: u8, message: &str) {
    let _ = app.emit(
        PROGRESS_EVENT,
        ProgressPayload {
            stage: stage.to_string(),
            percent,
            message: message.to_string(),
        },
    );
}

/// The runner emits `PROGRESS|stage|percent|message` and `LOG|...` on stderr.
/// shoeprintr itself prints `[1] "circle N matching"` on stdout, which is the
/// only signal available for the long matching phase, so it is mapped onto the
/// 10-90% band.
fn handle_stream_line(app: &AppHandle, line: &str, log: &Arc<Mutex<Vec<String>>>) {
    if let Some(rest) = line.strip_prefix("PROGRESS|") {
        let mut parts = rest.splitn(3, '|');
        let stage = parts.next().unwrap_or("").to_string();
        let percent = parts
            .next()
            .and_then(|value| value.parse::<u8>().ok())
            .unwrap_or(0);
        let message = parts.next().unwrap_or("").to_string();
        emit_progress(app, &stage, percent.min(100), &message);
        return;
    }

    if let Some(rest) = line.strip_prefix("LOG|") {
        if let Ok(mut buffer) = log.lock() {
            buffer.push(rest.to_string());
        }
        return;
    }

    if let Some(index) = line.find("circle ") {
        let tail = &line[index + "circle ".len()..];
        if let Some(number) = tail
            .split_whitespace()
            .next()
            .and_then(|value| value.parse::<u8>().ok())
        {
            if (1..=3).contains(&number) {
                let percent = 10 + (number - 1) * 27;
                emit_progress(
                    app,
                    "matching",
                    percent,
                    &format!("matching region {number} of 3"),
                );
            }
        }
    }

    if let Ok(mut buffer) = log.lock() {
        if !line.trim().is_empty() {
            buffer.push(line.to_string());
        }
    }
}

#[tauri::command]
pub async fn cancel_shoeprint_comparison(
    state: tauri::State<'_, ShoeprintState>,
) -> Result<bool, String> {
    state.cancelled.store(true, Ordering::SeqCst);
    let mut guard = state.child.lock().map_err(|e| e.to_string())?;
    if let Some(child) = guard.as_mut() {
        child.kill().map_err(|e| e.to_string())?;
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
pub async fn run_shoeprint_comparison(
    app: AppHandle,
    state: tauri::State<'_, ShoeprintState>,
    request: ComparisonRequest,
) -> Result<ComparisonOutcome, String> {
    {
        let guard = state.child.lock().map_err(|e| e.to_string())?;
        if guard.is_some() {
            return Err("a shoeprint comparison is already running".to_string());
        }
    }

    let engine = resolve_engine(&app)?;

    for (label, path) in [
        ("questioned", &request.input_path),
        ("known", &request.reference_path),
    ] {
        if !Path::new(path).is_file() {
            return Err(format!("{label} point file is missing: {path}"));
        }
    }

    let mut command = configure_command(&engine);
    command
        .arg("--input")
        .arg(&request.input_path)
        .arg("--reference")
        .arg(&request.reference_path)
        .arg("--output")
        .arg(&request.output_path);

    if let Some(plot) = &request.plot_path {
        command.arg("--plot").arg(plot);
    }
    if let Some(value) = request.max_rotation_angle {
        command.arg("--max-rotation").arg(value.to_string());
    }
    if let Some(value) = request.circle_radius {
        command.arg("--radius").arg(value.to_string());
    }
    if let Some(value) = request.seed {
        command.arg("--seed").arg(value.to_string());
    }
    if let Some(value) = request.cores {
        command.arg("--cores").arg(value.to_string());
    }

    command.stdout(Stdio::piped()).stderr(Stdio::piped());

    state.cancelled.store(false, Ordering::SeqCst);
    let started = std::time::Instant::now();

    let mut child = command
        .spawn()
        .map_err(|e| format!("could not start the R runtime: {e}"))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    {
        let mut guard = state.child.lock().map_err(|e| e.to_string())?;
        *guard = Some(child);
    }

    let log = Arc::new(Mutex::new(Vec::<String>::new()));

    let mut readers = Vec::new();
    for stream in [
        stdout.map(|s| Box::new(s) as Box<dyn std::io::Read + Send>),
        stderr.map(|s| Box::new(s) as Box<dyn std::io::Read + Send>),
    ]
    .into_iter()
    .flatten()
    {
        let app = app.clone();
        let log = Arc::clone(&log);
        readers.push(std::thread::spawn(move || {
            let reader = BufReader::new(stream);
            for line in reader.lines().map_while(Result::ok) {
                handle_stream_line(&app, &line, &log);
            }
        }));
    }

    // A comparison runs for minutes, so the wait happens on a blocking worker
    // rather than on an async runtime thread. The mutex is released between
    // polls so a cancel request can still reach the child while it runs.
    let child_handle = Arc::clone(&state.child);
    let joined = tauri::async_runtime::spawn_blocking(
        move || -> Result<std::process::ExitStatus, String> {
            let status = loop {
                {
                    let mut guard = child_handle.lock().map_err(|e| e.to_string())?;
                    match guard.as_mut() {
                        Some(child) => {
                            if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
                                break status;
                            }
                        }
                        None => return Err("the comparison process disappeared".to_string()),
                    }
                }
                std::thread::sleep(Duration::from_millis(120));
            };

            for reader in readers {
                let _ = reader.join();
            }

            Ok(status)
        },
    )
    .await;

    let wait_failed = !matches!(joined, Ok(Ok(_)));
    {
        let mut guard = state.child.lock().map_err(|e| e.to_string())?;
        if let Some(mut child) = guard.take() {
            if wait_failed {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }

    let status = joined.map_err(|e| e.to_string())??;

    if state.cancelled.swap(false, Ordering::SeqCst) {
        return Err("cancelled".to_string());
    }

    let details = log
        .lock()
        .map(|buffer| buffer.join("\n"))
        .unwrap_or_default();

    if !status.success() {
        // The script writes a structured error document before exiting
        if let Ok(contents) = std::fs::read_to_string(&request.output_path) {
            if contents.contains("\"status\"") {
                return Ok(ComparisonOutcome {
                    json: contents,
                    plot_path: None,
                    duration_ms: started.elapsed().as_millis(),
                });
            }
        }
        let code = status.code().unwrap_or(-1);
        return Err(format!(
            "the comparison failed (exit {code}).{}",
            if details.is_empty() {
                String::new()
            } else {
                format!("\n{details}")
            }
        ));
    }

    let json = std::fs::read_to_string(&request.output_path)
        .map_err(|e| format!("could not read the comparison result: {e}"))?;

    let plot_path = request
        .plot_path
        .filter(|path| Path::new(path).is_file());

    Ok(ComparisonOutcome {
        json,
        plot_path,
        duration_ms: started.elapsed().as_millis(),
    })
}
