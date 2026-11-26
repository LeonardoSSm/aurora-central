use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AppId {
    Board,
    Control,
    Nexus,
    Lens,
}

impl AppId {
    pub const ALL: [Self; 4] = [Self::Board, Self::Control, Self::Nexus, Self::Lens];

    pub fn name(self) -> &'static str {
        match self {
            Self::Board => "Aurora Board",
            Self::Control => "Aurora Control",
            Self::Nexus => "Aurora Nexus",
            Self::Lens => "Aurora Lens",
        }
    }

    pub fn integration(self) -> Integration {
        Integration {
            // No published native argument or IPC contract for these modules.
            arguments: &[],
            strategy: if self == Self::Control {
                OpeningStrategy::SelfPositioned
            } else {
                OpeningStrategy::ExternalWindow
            },
        }
    }
}

// A future adapter may supply reviewed arguments and a supported integration
// channel. The registry owns this policy, independently of user approvals.
pub struct Integration {
    pub arguments: &'static [&'static str],
    pub strategy: OpeningStrategy,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationCapabilities {
    pub external_launch: bool,
    pub window_focus: bool,
    pub initial_placement: bool,
}

impl Integration {
    pub fn capabilities(&self, environment: Environment) -> IntegrationCapabilities {
        IntegrationCapabilities {
            external_launch: environment != Environment::Unsupported,
            window_focus: environment == Environment::Windows,
            initial_placement: environment == Environment::Windows
                && self.strategy == OpeningStrategy::ExternalWindow,
        }
    }
}

#[derive(Clone, Copy, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum OpeningStrategy {
    ExternalWindow,
    SelfPositioned,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Environment {
    Windows,
    #[cfg(target_os = "linux")]
    X11,
    #[cfg(target_os = "linux")]
    Wayland,
    #[cfg(target_os = "linux")]
    LinuxUnknown,
    Unsupported,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Fault {
    InvalidExecutable,
    ApprovalChanged,
    AlreadyRegistered,
    InvalidMonitor,
    Storage,
    Spawn,
    ExitedEarly,
    ProcessDiscovery,
    DialogBusy,
    Dialog,
    Platform,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(tag = "status", rename_all = "kebab-case")]
pub enum ApplicationState {
    NotConfigured,
    NotInstalled,
    Available,
    Starting,
    Running {
        window: WindowObservation,
        placement: Placement,
    },
    FocusRequested {
        focus: Focus,
    },
    Unavailable,
    Error {
        reason: Fault,
    },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum WindowObservation {
    Detected,
    NotDetected,
    Unsupported,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Focus {
    Confirmed,
    Requested,
    Denied,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Placement {
    #[default]
    NotRequested,
    Requested,
    Confirmed,
    FallbackRequested,
    FallbackConfirmed,
    Unavailable,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(try_from = "String", into = "String")]
pub struct MonitorId(String);

impl MonitorId {
    #[cfg(windows)]
    pub fn from_device(device: &[u16]) -> Self {
        use sha2::{Digest, Sha256};
        let bytes: Vec<_> = device.iter().flat_map(|unit| unit.to_le_bytes()).collect();
        Self(format!("{:x}", Sha256::digest(bytes)))
    }
}

impl TryFrom<String> for MonitorId {
    type Error = &'static str;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        if value.len() == 64
            && value
                .bytes()
                .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
        {
            Ok(Self(value))
        } else {
            Err("invalid monitor identifier")
        }
    }
}

impl From<MonitorId> for String {
    fn from(value: MonitorId) -> Self {
        value.0
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Monitor {
    pub id: Option<MonitorId>,
    pub name: String,
    pub primary: bool,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Application {
    pub id: AppId,
    pub executable: Option<String>,
    pub preferred_monitor: Option<MonitorId>,
    pub strategy: OpeningStrategy,
    pub capabilities: IntegrationCapabilities,
    pub state: ApplicationState,
}

#[derive(Serialize)]
pub struct Snapshot {
    pub environment: Environment,
    pub applications: Vec<Application>,
    pub monitors: Vec<Monitor>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AppRequest {
    pub id: AppId,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MonitorRequest {
    pub id: AppId,
    pub monitor: Option<MonitorId>,
}
