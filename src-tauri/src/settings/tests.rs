use std::fs;

use serde_json::{json, Value};

use super::*;

#[test]
fn preferences_survive_reload_and_reset_without_requiring_an_approval_registry() {
    let directory = tempfile::tempdir().unwrap();
    let load = || SettingsManager::load(Some(directory.path()), |_| None);
    let mut manager = load();
    let mut expected = Settings::default();
    expected.graphics.palette = Palette::Ember;
    expected.graphics.particle_count = Some(37_000);
    expected.initial_view = View::Immersive;
    expected.motion = Motion::Reduced;
    expected.modules.get_mut(&AppId::Board).unwrap().opening = Opening::RunningOnly;
    assert_eq!(
        manager
            .save(expected.clone(), 0, |_| false)
            .unwrap()
            .revision,
        1
    );
    drop(manager);

    let mut restarted = load();
    assert_eq!(restarted.snapshot().settings, expected);
    restarted.save(Settings::default(), 0, |_| false).unwrap();
    drop(restarted);
    assert_eq!(load().snapshot().settings, Settings::default());
}

#[test]
fn invalid_graphics_are_rejected_without_mutating_memory_or_disk() {
    let directory = tempfile::tempdir().unwrap();
    let mut manager = SettingsManager::load(Some(directory.path()), |_| None);
    manager.save(Settings::default(), 0, |_| false).unwrap();
    let path = directory.path().join(FILE);
    let original = fs::read(&path).unwrap();
    for (field, value) in [
        ("particleCount", json!(100_001)),
        ("brightness", json!(151)),
        ("speed", json!(24)),
        ("fps", json!(240)),
        ("dpr", json!(4)),
        ("resolution", json!(200)),
    ] {
        let mut settings: Value = serde_json::from_slice(&original).unwrap();
        settings["graphics"][field] = value;
        assert_eq!(
            manager
                .save(serde_json::from_value(settings).unwrap(), 1, |_| false)
                .unwrap_err(),
            SettingsError::Invalid,
            "{field}"
        );
    }
    assert_eq!(manager.snapshot().revision, 1);
    assert_eq!(fs::read(&path).unwrap(), original);
}

#[test]
fn stale_updates_are_rejected() {
    let directory = tempfile::tempdir().unwrap();
    let mut first = SettingsManager::load(Some(directory.path()), |_| None);
    let mut update = Settings::default();
    update.graphics.fps = 30;
    first.save(update.clone(), 0, |_| false).unwrap();
    assert_eq!(
        first.save(Settings::default(), 0, |_| false).unwrap_err(),
        SettingsError::Conflict
    );
    assert_eq!(first.snapshot().settings, update);
}

#[test]
fn an_io_failure_keeps_the_last_committed_snapshot() {
    let directory = tempfile::tempdir().unwrap();
    fs::create_dir(directory.path().join(FILE)).unwrap();
    let mut manager = SettingsManager::load(Some(directory.path()), |_| None);
    assert_eq!(manager.snapshot().status, Status::Unavailable);
    assert_eq!(
        manager.save(Settings::default(), 0, |_| false).unwrap_err(),
        SettingsError::Storage
    );
    drop(manager);
    fs::remove_dir(directory.path().join(FILE)).unwrap();

    let mut manager = SettingsManager::load(Some(directory.path()), |_| None);
    fs::create_dir(directory.path().join(FILE)).unwrap();
    let mut next = Settings::default();
    next.graphics.fps = 30;
    assert_eq!(
        manager.save(next, 0, |_| false).unwrap_err(),
        SettingsError::Storage
    );
    assert_eq!(manager.snapshot().settings, Settings::default());
    assert_eq!(manager.snapshot().revision, 0);
}

#[test]
fn corruption_recovers_defaults_but_future_versions_are_preserved() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join(FILE);
    let load = || SettingsManager::load(Some(directory.path()), |_| None);
    for bytes in [b"{ truncated".to_vec(), vec![b'x'; 131_073]] {
        fs::write(&path, bytes).unwrap();
        let recovered = load();
        assert_eq!(recovered.snapshot().status, Status::Recovered);
        assert_eq!(recovered.snapshot().settings, Settings::default());
        drop(recovered);
        assert_eq!(load().snapshot().status, Status::Ready);
    }
    let future = br#"{"version":2,"future":"keep this"}"#;
    fs::write(&path, future).unwrap();
    let mut manager = load();
    assert_eq!(manager.snapshot().status, Status::NewerVersion);
    assert_eq!(
        manager.save(Settings::default(), 0, |_| false).unwrap_err(),
        SettingsError::Storage
    );
    assert_eq!(fs::read(&path).unwrap(), future);
}

#[test]
fn schema_rejects_app_paths_and_monitor_validation_preserves_disconnected_choices() {
    let directory = tempfile::tempdir().unwrap();
    let mut manager = SettingsManager::load(Some(directory.path()), |_| None);
    let mut json = serde_json::to_value(Settings::default()).unwrap();
    json["modules"]["board"]["executable"] = json!("another.exe");
    assert!(serde_json::from_value::<Settings>(json).is_err());

    let mut settings = Settings::default();
    let monitor = MonitorId::try_from("a".repeat(64)).unwrap();
    settings
        .modules
        .get_mut(&AppId::Board)
        .unwrap()
        .preferred_monitor = Some(monitor.clone());
    assert_eq!(
        manager.save(settings.clone(), 0, |_| false).unwrap_err(),
        SettingsError::InvalidMonitor
    );
    manager
        .save(settings.clone(), 0, |id| id == &monitor)
        .unwrap();
    settings.graphics.speed = 125;
    manager.save(settings.clone(), 1, |_| false).unwrap();
    settings
        .modules
        .get_mut(&AppId::Control)
        .unwrap()
        .preferred_monitor = Some(monitor);
    assert_eq!(
        manager.save(settings, 2, |_| true).unwrap_err(),
        SettingsError::Invalid
    );
}
