use std::{io, path::Path};

use super::super::contracts::{
    Environment, Focus, Monitor, MonitorId, Placement, WindowObservation,
};

pub fn environment() -> Environment {
    #[cfg(target_os = "linux")]
    {
        let session = std::env::var("XDG_SESSION_TYPE").unwrap_or_default();
        if session == "wayland"
            || std::env::var_os("WAYLAND_DISPLAY").is_some_and(|value| !value.is_empty())
        {
            Environment::Wayland
        } else if session == "x11"
            || std::env::var_os("DISPLAY").is_some_and(|value| !value.is_empty())
        {
            Environment::X11
        } else {
            Environment::LinuxUnknown
        }
    }
    #[cfg(not(target_os = "linux"))]
    Environment::Unsupported
}

pub struct Processes {
    #[cfg(target_os = "linux")]
    candidates: Vec<u32>,
}

pub struct Process(u32);
pub struct Window;

impl Processes {
    pub fn discover() -> io::Result<Self> {
        #[cfg(target_os = "linux")]
        {
            let candidates = std::fs::read_dir("/proc")?
                .filter_map(Result::ok)
                .filter_map(|entry| entry.file_name().to_str()?.parse().ok())
                .collect();
            Ok(Self { candidates })
        }
        #[cfg(not(target_os = "linux"))]
        Err(io::ErrorKind::Unsupported.into())
    }

    pub fn matching(&self, _path: &Path) -> Vec<Process> {
        #[cfg(target_os = "linux")]
        {
            use std::os::unix::fs::MetadataExt;
            // SAFETY: geteuid has no arguments and changes no state.
            let uid = unsafe { libc::geteuid() };
            self.candidates
                .iter()
                .filter_map(|&pid| {
                    let directory = format!("/proc/{pid}");
                    if std::fs::metadata(&directory).ok()?.uid() != uid {
                        return None;
                    }
                    let exe = Path::new(&directory).join("exe");
                    (std::fs::read_link(&exe).ok()?.as_path() == _path
                        && same_file::is_same_file(exe, _path).ok()?)
                    .then_some(Process(pid))
                })
                .collect()
        }
        #[cfg(not(target_os = "linux"))]
        Vec::new()
    }
}

impl Process {
    pub fn id(&self) -> u32 {
        self.0
    }

    pub fn window(&self) -> Option<Window> {
        None
    }

    pub fn observation(&self) -> WindowObservation {
        WindowObservation::Unsupported
    }
}

impl Window {
    pub fn request_focus(&self) -> Option<Focus> {
        None
    }

    pub fn place(&self, _monitors: &[Display], _preferred: &MonitorId) -> Placement {
        Placement::Unavailable
    }

    pub fn confirm_placement(
        &self,
        _monitors: &[Display],
        _preferred: &MonitorId,
        previous: Placement,
    ) -> Placement {
        previous
    }
}

pub struct Display {
    pub info: Monitor,
}

pub fn displays(app: &tauri::AppHandle) -> Vec<Display> {
    let primary = app.primary_monitor().ok().flatten();
    app.available_monitors()
        .unwrap_or_default()
        .into_iter()
        .map(|monitor| Display {
            info: Monitor {
                id: None,
                name: monitor.name().cloned().unwrap_or_else(|| "Monitor".into()),
                primary: primary.as_ref().is_some_and(|main| {
                    main.position() == monitor.position()
                        && main.size() == monitor.size()
                        && main.name() == monitor.name()
                }),
                x: monitor.position().x,
                y: monitor.position().y,
                width: monitor.size().width,
                height: monitor.size().height,
                scale: monitor.scale_factor(),
            },
        })
        .collect()
}
