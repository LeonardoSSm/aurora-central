use std::{
    collections::BTreeMap,
    io,
    path::{Path, PathBuf},
};

use crate::storage;
use serde::{Deserialize, Serialize};

use super::{
    contracts::{AppId, Fault},
    executable::Approval,
};

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Registry {
    version: u8,
    platforms: BTreeMap<Platform, BTreeMap<AppId, Approval>>,
}

#[derive(Clone, Copy, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "kebab-case")]
enum Platform {
    Windows,
    Linux,
    MacOs,
    Other,
}

fn platform() -> Platform {
    match std::env::consts::OS {
        "windows" => Platform::Windows,
        "linux" => Platform::Linux,
        "macos" => Platform::MacOs,
        _ => Platform::Other,
    }
}

pub struct Store {
    registry: Registry,
    path: PathBuf,
}

impl Store {
    pub fn load(directory: &Path) -> Result<Self, Fault> {
        Self::read(directory).map_err(|_| Fault::Storage)
    }

    fn read(directory: &Path) -> io::Result<Self> {
        let path = directory.join("launcher-v1.json");
        let registry = match storage::read(&path) {
            Ok(bytes) => serde_json::from_slice(&bytes)?,
            Err(error) if error.kind() == io::ErrorKind::NotFound => Registry {
                version: 1,
                platforms: BTreeMap::new(),
            },
            _ => return Err(io::ErrorKind::InvalidData.into()),
        };
        if registry.version != 1 {
            return Err(io::ErrorKind::InvalidData.into());
        }
        Ok(Self { registry, path })
    }

    pub fn get(&self, id: AppId) -> Option<&Approval> {
        self.registry.platforms.get(&platform())?.get(&id)
    }

    pub fn save(&mut self, id: AppId, approval: Option<Approval>) -> Result<(), Fault> {
        let mut next = self.registry.clone();
        let entries = next.platforms.entry(platform()).or_default();
        if let Some(approval) = approval {
            entries.insert(id, approval);
        } else {
            entries.remove(&id);
        }
        storage::replace(&self.path, &next).map_err(|_| Fault::Storage)?;
        self.registry = next;
        Ok(())
    }
}
