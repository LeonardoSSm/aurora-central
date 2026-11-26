mod contracts;
mod executable;
mod platform;
mod service;
mod store;
#[cfg(test)]
mod tests;

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};

use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

use contracts::{AppRequest, ApplicationState, Fault, MonitorRequest, Snapshot};
use executable::Executable;
use service::{display_path, Launcher};

struct Desktop {
    launcher: Mutex<Launcher>,
    selecting: AtomicBool,
}

pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let directory = app.path().app_config_dir().ok();
    app.manage(Desktop {
        launcher: Mutex::new(Launcher::load(directory.as_deref())),
        selecting: AtomicBool::new(false),
    });
    Ok(())
}

async fn native<T: Send + 'static>(
    action: impl FnOnce() -> Result<T, Fault> + Send + 'static,
) -> Result<T, Fault> {
    tauri::async_runtime::spawn_blocking(action)
        .await
        .map_err(|_| Fault::Platform)?
}

#[tauri::command]
pub async fn launcher_snapshot(app: AppHandle) -> Result<Snapshot, Fault> {
    native(move || {
        let monitors = platform::displays(&app);
        let desktop = app.state::<Desktop>();
        let mut launcher = desktop.launcher.lock().map_err(|_| Fault::Platform)?;
        Ok(launcher.snapshot(&monitors))
    })
    .await
}

#[tauri::command]
pub async fn launcher_open(app: AppHandle, request: AppRequest) -> Result<ApplicationState, Fault> {
    native(move || {
        let monitors = platform::displays(&app);
        let desktop = app.state::<Desktop>();
        let mut launcher = desktop.launcher.lock().map_err(|_| Fault::Platform)?;
        Ok(launcher.open(request.id, &monitors))
    })
    .await
}

#[tauri::command]
pub async fn launcher_remove_executable(app: AppHandle, request: AppRequest) -> Result<(), Fault> {
    native(move || {
        let desktop = app.state::<Desktop>();
        let mut launcher = desktop.launcher.lock().map_err(|_| Fault::Platform)?;
        launcher.remove(request.id)
    })
    .await
}

#[tauri::command]
pub async fn launcher_choose_monitor(app: AppHandle, request: MonitorRequest) -> Result<(), Fault> {
    native(move || {
        let monitors = platform::displays(&app);
        let desktop = app.state::<Desktop>();
        let mut launcher = desktop.launcher.lock().map_err(|_| Fault::Platform)?;
        launcher.choose_monitor(request.id, request.monitor, &monitors)
    })
    .await
}

#[tauri::command]
pub async fn launcher_choose_executable(
    window: WebviewWindow,
    request: AppRequest,
) -> Result<bool, Fault> {
    native(move || {
        let desktop = window.state::<Desktop>();
        desktop
            .launcher
            .lock()
            .map_err(|_| Fault::Platform)?
            .can_configure()?;
        desktop
            .selecting
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| Fault::DialogBusy)?;
        struct Selection<'a>(&'a AtomicBool);
        impl Drop for Selection<'_> {
            fn drop(&mut self) {
                self.0.store(false, Ordering::Release);
            }
        }
        let _selection = Selection(&desktop.selecting);

        let name = request.id.name();
        let dialog = window
            .dialog()
            .file()
            .set_parent(&window)
            .set_title(format!("Executável de {name}"));
        #[cfg(windows)]
        let dialog = dialog.add_filter("Executáveis do Windows", &["exe"]);
        let Some(selected) = dialog.blocking_pick_file() else {
            return Ok(false);
        };
        let path = selected.into_path().map_err(|_| Fault::Dialog)?;
        let mut executable = Executable::select(&path)?;
        let approval = executable.approval()?;
        let prompt = format!(
            "Autorizar este executável para {name}?\n\n{}",
            display_path(&executable.path)
        );
        if !confirm_executable(&window, &prompt)? {
            return Ok(false);
        }
        let mut launcher = desktop.launcher.lock().map_err(|_| Fault::Platform)?;
        launcher.set_executable(request.id, approval)?;
        Ok(true)
    })
    .await
}

#[cfg(windows)]
fn confirm_executable(window: &WebviewWindow, prompt: &str) -> Result<bool, Fault> {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, IDYES, MB_DEFBUTTON2, MB_ICONWARNING, MB_YESNO,
    };
    let parent = window.hwnd().map_err(|_| Fault::Dialog)?;
    let title: Vec<_> = "Autorizar executável"
        .encode_utf16()
        .chain(Some(0))
        .collect();
    let prompt: Vec<_> = prompt.encode_utf16().chain(Some(0)).collect();
    // SAFETY: Both strings are NUL-terminated and the owner is the local WebView window.
    let choice = unsafe {
        MessageBoxW(
            parent.0,
            prompt.as_ptr(),
            title.as_ptr(),
            MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2,
        )
    };
    if choice == 0 {
        return Err(Fault::Dialog);
    }
    Ok(choice == IDYES)
}

#[cfg(not(windows))]
fn confirm_executable(window: &WebviewWindow, prompt: &str) -> Result<bool, Fault> {
    use tauri_plugin_dialog::{MessageDialogButtons, MessageDialogKind};
    Ok(window
        .dialog()
        .message(prompt)
        .parent(window)
        .title("Autorizar executável")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::YesNo)
        .blocking_show())
}
