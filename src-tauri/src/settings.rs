use std::{
    collections::BTreeMap,
    io,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

use crate::{
    launcher::contracts::{AppId, MonitorId},
    storage,
};

#[cfg(test)]
mod tests;

const VERSION: u64 = 1;
const FILE: &str = "settings.json";

macro_rules! choice {
    ($name:ident { $default:ident $(, $variant:ident)+ }) => {
        #[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Serialize)]
        #[serde(rename_all = "kebab-case")]
        pub enum $name {
            #[default]
            $default,
            $($variant),+
        }
    };
}

choice!(Profile {
    Medium,
    Low,
    High,
    Ultra
});
choice!(Palette {
    Aurora,
    Nebula,
    Ember,
    Glacier
});
choice!(Quality { Standard, Economy });
choice!(Background {
    Adaptive,
    Pause,
    Continue
});
choice!(View {
    Central,
    Immersive,
    Ambiental
});
choice!(Motion { System, Reduced });
choice!(Opening {
    LaunchOrReuse,
    RunningOnly
});

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Graphics {
    profile: Profile,
    quality: Quality,
    palette: Palette,
    particle_count: Option<u32>,
    brightness: u16,
    speed: u16,
    fps: u8,
    dpr: f32,
    resolution: u8,
    background: Background,
}

impl Default for Graphics {
    fn default() -> Self {
        Self {
            profile: Profile::Medium,
            quality: Quality::Standard,
            palette: Palette::Aurora,
            particle_count: None,
            brightness: 100,
            speed: 100,
            fps: 60,
            dpr: 1.5,
            resolution: 100,
            background: Background::Adaptive,
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModuleSettings {
    pub preferred_monitor: Option<MonitorId>,
    pub opening: Opening,
    pub focus_existing: bool,
}

impl Default for ModuleSettings {
    fn default() -> Self {
        Self {
            preferred_monitor: None,
            opening: Opening::LaunchOrReuse,
            focus_existing: true,
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Settings {
    version: u64,
    graphics: Graphics,
    initial_view: View,
    motion: Motion,
    pub modules: BTreeMap<AppId, ModuleSettings>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            version: VERSION,
            graphics: Graphics::default(),
            initial_view: View::Central,
            motion: Motion::System,
            modules: AppId::ALL
                .into_iter()
                .map(|id| (id, ModuleSettings::default()))
                .collect(),
        }
    }
}

impl Settings {
    fn valid(&self) -> bool {
        let graphics = &self.graphics;
        self.version == VERSION
            && self.modules.len() == AppId::ALL.len()
            && self.modules[&AppId::Control].preferred_monitor.is_none()
            && graphics
                .particle_count
                .is_none_or(|count| (5_000..=100_000).contains(&count))
            && (25..=150).contains(&graphics.brightness)
            && (25..=175).contains(&graphics.speed)
            && [30, 45, 60, 90, 120].contains(&graphics.fps)
            && [1.0, 1.25, 1.5, 2.0].contains(&graphics.dpr)
            && [50, 75, 100].contains(&graphics.resolution)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
enum Status {
    Ready,
    Recovered,
    Unavailable,
    NewerVersion,
}

#[derive(Clone, Debug, Serialize)]
pub struct Snapshot {
    pub settings: Settings,
    pub revision: u32,
    status: Status,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum SettingsError {
    Invalid,
    InvalidMonitor,
    Storage,
    Conflict,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SaveRequest {
    pub settings: Settings,
    pub revision: u32,
}

pub struct SettingsManager {
    snapshot: Snapshot,
    path: Option<PathBuf>,
}

impl SettingsManager {
    pub fn load(
        directory: Option<&Path>,
        legacy_monitor: impl Fn(AppId) -> Option<MonitorId>,
    ) -> Self {
        let mut manager = Self {
            snapshot: Snapshot {
                settings: Settings::default(),
                revision: 0,
                status: Status::Unavailable,
            },
            path: None,
        };
        let Some(directory) = directory else {
            return manager;
        };
        let path = directory.join(FILE);
        let status = match storage::read(&path) {
            Ok(bytes) => match decode(&bytes) {
                Ok(settings) => {
                    manager.snapshot.settings = settings;
                    Status::Ready
                }
                Err(status) => status,
            },
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                // The launcher v1 registry held monitors inside the platform-specific approvals.
                for (id, module) in &mut manager.snapshot.settings.modules {
                    if *id != AppId::Control {
                        module.preferred_monitor = legacy_monitor(*id);
                    }
                }
                if manager.snapshot.settings != Settings::default()
                    && storage::replace(&path, &manager.snapshot.settings).is_err()
                {
                    manager.snapshot.settings = Settings::default();
                    return manager;
                }
                Status::Ready
            }
            Err(error) if error.kind() == io::ErrorKind::InvalidData => Status::Recovered,
            Err(_) => return manager,
        };
        if status == Status::NewerVersion {
            manager.snapshot.status = status;
            return manager;
        }
        if status == Status::Recovered
            && storage::replace(&path, &manager.snapshot.settings).is_err()
        {
            return manager;
        }
        manager.snapshot.status = status;
        manager.path = Some(path);
        manager
    }

    pub fn snapshot(&self) -> Snapshot {
        self.snapshot.clone()
    }

    pub fn module(&self, id: AppId) -> &ModuleSettings {
        &self.snapshot.settings.modules[&id]
    }

    pub fn save(
        &mut self,
        settings: Settings,
        revision: u32,
        monitor_available: impl Fn(&MonitorId) -> bool,
    ) -> Result<Snapshot, SettingsError> {
        if revision != self.snapshot.revision {
            return Err(SettingsError::Conflict);
        }
        if !settings.valid() {
            return Err(SettingsError::Invalid);
        }
        for (&id, module) in &settings.modules {
            if let Some(monitor) = &module.preferred_monitor {
                if self.module(id).preferred_monitor.as_ref() != Some(monitor)
                    && !monitor_available(monitor)
                {
                    return Err(SettingsError::InvalidMonitor);
                }
            }
        }
        let path = self.path.as_ref().ok_or(SettingsError::Storage)?;
        storage::replace(path, &settings).map_err(|_| SettingsError::Storage)?;
        self.snapshot = Snapshot {
            settings,
            revision: revision.wrapping_add(1),
            status: Status::Ready,
        };
        Ok(self.snapshot())
    }
}

fn decode(bytes: &[u8]) -> Result<Settings, Status> {
    #[derive(Deserialize)]
    struct Header {
        version: u64,
    }
    let header = serde_json::from_slice::<Header>(bytes).map_err(|_| Status::Recovered)?;
    if header.version > VERSION {
        return Err(Status::NewerVersion);
    }
    let settings = serde_json::from_slice::<Settings>(bytes).map_err(|_| Status::Recovered)?;
    settings
        .valid()
        .then_some(settings)
        .ok_or(Status::Recovered)
}
