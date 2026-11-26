use std::{fs, path::Path};

use serde_json::json;

use super::{
    contracts::{AppId, AppRequest, ApplicationState, Fault, MonitorRequest},
    executable::Executable,
    platform::Processes,
    service::Launcher,
    store::Store,
};

#[test]
fn ipc_payloads_only_accept_registered_ids_and_typed_monitor_ids() {
    assert!(serde_json::from_value::<AppRequest>(json!({ "id": "board" })).is_ok());
    for payload in [
        json!({ "id": "arbitrary" }),
        json!({ "id": ["board"] }),
        json!({ "id": "board", "arguments": ["--unexpected"] }),
        json!({ "id": "board", "path": "anything.exe" }),
        json!({ "id": "board", "workingDirectory": "elsewhere" }),
    ] {
        assert!(serde_json::from_value::<AppRequest>(payload).is_err());
    }
    assert!(
        serde_json::from_value::<MonitorRequest>(json!({ "id": "lens", "monitor": "0" })).is_err()
    );
    assert!(
        serde_json::from_value::<MonitorRequest>(json!({ "id": "lens", "monitor": null })).is_ok()
    );
}

#[test]
fn unconfigured_apps_cannot_launch() {
    let directory = tempfile::tempdir().unwrap();
    let mut launcher = Launcher::load(Some(directory.path()));
    #[cfg(any(windows, target_os = "linux"))]
    assert_eq!(
        launcher.open(AppId::Board, &[]),
        ApplicationState::NotConfigured
    );
    #[cfg(not(any(windows, target_os = "linux")))]
    assert_eq!(
        launcher.open(AppId::Board, &[]),
        ApplicationState::Unavailable
    );
    assert!(!directory.path().join("launcher-v1.json").exists());
}

#[cfg(any(windows, target_os = "linux"))]
fn copy_test_binary(directory: &Path, name: &str) -> std::path::PathBuf {
    let path = directory.join(format!("{name}{}", std::env::consts::EXE_SUFFIX));
    fs::copy(std::env::current_exe().unwrap(), &path).unwrap();
    path
}

#[cfg(any(windows, target_os = "linux"))]
#[test]
fn persists_a_native_approval_rejects_duplicate_registration_and_detects_removal() {
    let directory = tempfile::tempdir().unwrap();
    let valid = copy_test_binary(directory.path(), "Aplicativo [de teste & ação]");
    let mut launcher = Launcher::load(Some(directory.path()));
    let mut executable = Executable::select(&valid).unwrap();
    let approval = executable.approval().unwrap();
    assert!(matches!(Store::load(directory.path()), Err(Fault::Storage)));
    launcher
        .set_executable(AppId::Lens, approval.clone())
        .unwrap();
    assert_eq!(
        launcher.set_executable(AppId::Board, approval),
        Err(Fault::AlreadyRegistered)
    );
    drop(executable);
    drop(launcher);

    let mut restarted = Launcher::load(Some(directory.path()));
    let state = |launcher: &mut Launcher| {
        launcher
            .snapshot(&[])
            .applications
            .into_iter()
            .find(|app| app.id == AppId::Lens)
            .unwrap()
            .state
    };
    assert_eq!(state(&mut restarted), ApplicationState::Available);
    fs::remove_file(&valid).unwrap();
    assert_eq!(
        restarted.open(AppId::Lens, &[]),
        ApplicationState::NotInstalled
    );
    restarted.remove(AppId::Lens).unwrap();
    assert_eq!(state(&mut restarted), ApplicationState::NotConfigured);
}

#[cfg(any(windows, target_os = "linux"))]
#[test]
fn refuses_non_native_files_and_reauthorization_after_file_changes() {
    use std::io::Write;

    let directory = tempfile::tempdir().unwrap();
    let bad = directory
        .path()
        .join(format!("inválido{}", std::env::consts::EXE_SUFFIX));
    fs::write(&bad, "texto de teste").unwrap();
    assert!(matches!(
        Executable::select(&bad),
        Err(Fault::InvalidExecutable)
    ));
    assert!(matches!(
        Executable::select(&std::env::current_exe().unwrap()),
        Err(Fault::InvalidExecutable)
    ));
    let valid = copy_test_binary(directory.path(), "válido");
    let approval = Executable::select(&valid).unwrap().approval().unwrap();
    fs::OpenOptions::new()
        .append(true)
        .open(valid)
        .unwrap()
        .write_all(b"updated")
        .unwrap();
    assert!(matches!(
        Executable::authorize(&approval),
        Err(ApplicationState::Error {
            reason: Fault::ApprovalChanged
        })
    ));
}

#[cfg(any(windows, target_os = "linux"))]
#[test]
fn process_discovery_distinguishes_identical_basenames_in_different_directories() {
    let own = std::env::current_exe().unwrap().canonicalize().unwrap();
    let directory = tempfile::tempdir().unwrap();
    let other = directory.path().join(own.file_name().unwrap());
    fs::copy(&own, &other).unwrap();
    let processes = Processes::discover().unwrap();
    assert!(processes
        .matching(&own)
        .iter()
        .any(|process| process.id() == std::process::id()));
    assert!(processes
        .matching(&other.canonicalize().unwrap())
        .is_empty());
}

#[cfg(target_os = "linux")]
#[test]
fn executes_the_verified_elf_via_its_descriptor() {
    let system_executable = ["/usr/bin/true", "/bin/true"]
        .map(Path::new)
        .into_iter()
        .find(|path| path.is_file())
        .expect("a system true executable");
    let executable = Executable::select(system_executable).unwrap();
    assert!(executable.spawn(&[]).unwrap().wait().unwrap().success());
}
