use std::{
    collections::BTreeMap,
    fs::File,
    path::Path,
    process::Child,
    time::{Duration, Instant},
};

use crate::{
    settings::{Opening, Settings, SettingsError, SettingsManager, Snapshot as SettingsSnapshot},
    storage,
};

use super::{
    contracts::{
        AppId, Application, ApplicationState, Environment, Fault, MonitorId, OpeningStrategy,
        Placement, Snapshot, WindowObservation,
    },
    executable::{error, Approval, Executable},
    platform::{self, Display, Process, Processes},
    store::Store,
};

const STARTUP: Duration = Duration::from_secs(8);
const SELF_POSITIONED_STARTUP: Duration = Duration::from_secs(2);
const PLACEMENT: Duration = Duration::from_secs(20);

struct Started {
    child: Child,
    at: Instant,
    preferred: Option<MonitorId>,
    placement: Placement,
    strategy: OpeningStrategy,
}

#[derive(Default)]
struct Lifecycle {
    started: Option<Started>,
    fault: Option<Fault>,
}

pub struct Launcher {
    store: Option<Store>,
    settings: SettingsManager,
    apps: BTreeMap<AppId, Lifecycle>,
    detached: Vec<Child>,
    _profile_lock: Option<File>,
}

impl Launcher {
    pub fn load(path: Option<&Path>) -> Self {
        // Keep the original lock name so a concurrent older Central also respects ownership.
        let profile_lock = path.and_then(|path| storage::lock(path, "launcher.lock").ok());
        let path = path.filter(|_| profile_lock.is_some());
        let store = path.and_then(|path| Store::load(path).ok());
        let settings = SettingsManager::load(path, |id| store.as_ref()?.get(id)?.monitor.clone());
        Self {
            store,
            settings,
            apps: BTreeMap::new(),
            detached: Vec::new(),
            _profile_lock: profile_lock,
        }
    }

    pub fn settings(&self) -> SettingsSnapshot {
        self.settings.snapshot()
    }

    pub fn save_settings(
        &mut self,
        settings: Settings,
        revision: u32,
        displays: &[Display],
    ) -> Result<SettingsSnapshot, SettingsError> {
        self.settings.save(settings, revision, |preferred| {
            displays
                .iter()
                .any(|display| display.info.id.as_ref() == Some(preferred))
        })
    }

    pub fn can_configure(&self) -> Result<(), Fault> {
        if self.store.is_none() {
            return Err(Fault::Storage);
        }
        if platform::environment() == Environment::Unsupported {
            return Err(Fault::Platform);
        }
        Ok(())
    }

    pub fn set_executable(&mut self, id: AppId, mut approval: Approval) -> Result<(), Fault> {
        let store = self.store.as_mut().ok_or(Fault::Storage)?;
        if AppId::ALL
            .into_iter()
            .filter(|other| *other != id)
            .any(|other| {
                store.get(other).is_some_and(|entry| {
                    entry.path == approval.path
                        || same_file::is_same_file(&entry.path, &approval.path).unwrap_or(false)
                })
            })
        {
            return Err(Fault::AlreadyRegistered);
        }
        approval.monitor = store.get(id).and_then(|old| old.monitor.clone());
        store.save(id, Some(approval))?;
        self.reset(id);
        Ok(())
    }

    pub fn remove(&mut self, id: AppId) -> Result<(), Fault> {
        self.store.as_mut().ok_or(Fault::Storage)?.save(id, None)?;
        self.reset(id);
        Ok(())
    }

    fn reset(&mut self, id: AppId) {
        if let Some(started) = self.apps.remove(&id).and_then(|entry| entry.started) {
            // Continue reaping a child of Central even after its approval is removed.
            self.detached.push(started.child);
        }
    }

    pub fn choose_monitor(
        &mut self,
        id: AppId,
        preferred: Option<MonitorId>,
        monitors: &[Display],
    ) -> Result<(), Fault> {
        if preferred.as_ref().is_some_and(|preferred| {
            id.integration().strategy != OpeningStrategy::ExternalWindow
                || !monitors
                    .iter()
                    .any(|monitor| monitor.info.id.as_ref() == Some(preferred))
        }) {
            return Err(Fault::InvalidMonitor);
        }
        self.store
            .as_ref()
            .ok_or(Fault::Storage)?
            .get(id)
            .ok_or(Fault::InvalidExecutable)?;
        let SettingsSnapshot {
            mut settings,
            revision,
            ..
        } = self.settings();
        settings.modules.get_mut(&id).unwrap().preferred_monitor = preferred;
        self.save_settings(settings, revision, monitors)
            .map(|_| ())
            .map_err(|error| match error {
                SettingsError::Invalid | SettingsError::InvalidMonitor => Fault::InvalidMonitor,
                _ => Fault::Storage,
            })
    }

    pub fn snapshot(&mut self, monitors: &[Display]) -> Snapshot {
        self.detached
            .retain_mut(|child| !matches!(child.try_wait(), Ok(Some(_))));
        let environment = platform::environment();
        let mut processes = None;
        let applications = AppId::ALL
            .into_iter()
            .map(|id| {
                let integration = id.integration();
                let approval = self.store.as_ref().and_then(|store| store.get(id));
                let state = if environment == Environment::Unsupported {
                    ApplicationState::Unavailable
                } else if let Some(approval) = approval {
                    let runtime = self.apps.entry(id).or_default();
                    runtime.poll_exit();
                    let of_path = approval.availability();
                    if of_path == ApplicationState::Available {
                        match processes.get_or_insert_with(Processes::discover) {
                            Ok(processes) => runtime.observe(
                                &processes.matching(&approval.path),
                                monitors,
                                environment,
                            ),
                            Err(_) => error(Fault::ProcessDiscovery),
                        }
                    } else {
                        of_path
                    }
                } else if self.store.is_some() {
                    ApplicationState::NotConfigured
                } else {
                    error(Fault::Storage)
                };
                Application {
                    id,
                    executable: approval.map(|entry| display_path(&entry.path)),
                    preferred_monitor: self.settings.module(id).preferred_monitor.clone(),
                    strategy: integration.strategy,
                    capabilities: integration.capabilities(environment),
                    state,
                }
            })
            .collect();
        Snapshot {
            environment,
            applications,
            monitors: monitors
                .iter()
                .map(|monitor| monitor.info.clone())
                .collect(),
        }
    }

    pub fn open(&mut self, id: AppId, monitors: &[Display]) -> ApplicationState {
        let environment = platform::environment();
        if environment == Environment::Unsupported {
            return ApplicationState::Unavailable;
        }
        let Some(store) = &self.store else {
            return error(Fault::Storage);
        };
        let Some(approval) = store.get(id) else {
            return ApplicationState::NotConfigured;
        };
        let settings = self.settings.module(id);
        let runtime = self.apps.entry(id).or_default();
        runtime.poll_exit();
        let executable = match Executable::authorize(approval) {
            Ok(executable) => executable,
            Err(state) => {
                if let ApplicationState::Error { reason } = state {
                    runtime.fault = Some(reason);
                }
                return state;
            }
        };
        let Ok(processes) = Processes::discover() else {
            return error(Fault::ProcessDiscovery);
        };
        let matching = processes.matching(&approval.path);
        if !matching.is_empty() || runtime.started.is_some() {
            let state = runtime.observe(&matching, monitors, environment);
            if !settings.focus_existing {
                return state;
            }
            let focus = matching
                .iter()
                .find_map(|process| process.window()?.request_focus());
            return focus.map_or(state, |focus| ApplicationState::FocusRequested { focus });
        }
        if settings.opening == Opening::RunningOnly {
            return ApplicationState::NotRunning;
        }

        let integration = id.integration();
        runtime.fault = None;
        match executable.spawn(integration.arguments) {
            Ok(child) => {
                runtime.started = Some(Started {
                    child,
                    at: Instant::now(),
                    preferred: settings.preferred_monitor.clone(),
                    placement: Placement::NotRequested,
                    strategy: integration.strategy,
                });
                ApplicationState::Starting
            }
            Err(_) => {
                runtime.fault = Some(Fault::Spawn);
                error(Fault::Spawn)
            }
        }
    }
}

pub fn display_path(path: &Path) -> String {
    let text = path.to_string_lossy();
    #[cfg(windows)]
    if let Some(normal) = text.strip_prefix(r"\\?\") {
        return normal.to_owned();
    }
    text.into_owned()
}

impl Lifecycle {
    fn poll_exit(&mut self) {
        let Some(started) = &mut self.started else {
            return;
        };
        match started.child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() && started.at.elapsed() < STARTUP {
                    self.fault = Some(Fault::ExitedEarly);
                }
                self.started = None;
            }
            Ok(None) => {}
            Err(_) => self.fault = Some(Fault::ProcessDiscovery),
        }
    }

    fn observe(
        &mut self,
        matching: &[Process],
        monitors: &[Display],
        environment: Environment,
    ) -> ApplicationState {
        if let Some(started) = &mut self.started {
            let verified = matching
                .iter()
                .find(|process| process.id() == started.child.id());
            let elapsed = started.at.elapsed();
            if verified.is_none() && matching.is_empty() {
                return if elapsed < STARTUP {
                    ApplicationState::Starting
                } else {
                    error(Fault::ProcessDiscovery)
                };
            }
            if let Some(process) = verified {
                return started.observe(process, monitors, environment, elapsed);
            }
        }

        if let Some(process) = matching.first() {
            let observation = matching
                .iter()
                .map(Process::observation)
                .find(|window| *window == WindowObservation::Detected)
                .unwrap_or_else(|| process.observation());
            return ApplicationState::Running {
                window: observation,
                placement: Placement::NotRequested,
            };
        }
        self.fault.map_or(ApplicationState::Available, error)
    }
}

impl Started {
    fn observe(
        &mut self,
        process: &Process,
        monitors: &[Display],
        environment: Environment,
        elapsed: Duration,
    ) -> ApplicationState {
        let window = process.window();
        if let (Some(window), Some(preferred)) = (&window, &self.preferred) {
            if elapsed < PLACEMENT {
                self.placement = match self.placement {
                    Placement::NotRequested => window.place(monitors, preferred),
                    Placement::Requested | Placement::FallbackRequested => {
                        window.confirm_placement(monitors, preferred, self.placement)
                    }
                    placement => placement,
                };
            }
        }
        if elapsed >= PLACEMENT
            && self.preferred.is_some()
            && matches!(
                self.placement,
                Placement::NotRequested | Placement::Requested | Placement::FallbackRequested
            )
        {
            self.placement = Placement::Unavailable;
        }
        let window = if environment != Environment::Windows {
            WindowObservation::Unsupported
        } else if window.is_some() {
            WindowObservation::Detected
        } else if elapsed < STARTUP
            && (self.strategy == OpeningStrategy::ExternalWindow
                || elapsed < SELF_POSITIONED_STARTUP)
        {
            return ApplicationState::Starting;
        } else {
            WindowObservation::NotDetected
        };
        ApplicationState::Running {
            window,
            placement: self.placement,
        }
    }
}
