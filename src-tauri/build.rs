fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "launcher_snapshot",
            "launcher_open",
            "launcher_choose_executable",
            "launcher_remove_executable",
            "launcher_choose_monitor",
        ]),
    ))
    .expect("failed to configure application permissions");
}
