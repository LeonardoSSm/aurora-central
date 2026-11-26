use std::{
    collections::BTreeMap,
    fs::{self, File, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
};

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
    _lock: File,
}

impl Store {
    pub fn load(directory: &Path) -> Result<Self, Fault> {
        Self::read(directory).map_err(|_| Fault::Storage)
    }

    fn read(directory: &Path) -> io::Result<Self> {
        fs::create_dir_all(directory)?;
        let lock = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(directory.join("launcher.lock"))?;
        lock.try_lock().map_err(io::Error::from)?;

        let path = directory.join("launcher-v1.json");
        let registry = match File::open(&path) {
            Ok(file) if file.metadata()?.is_file() && file.metadata()?.len() <= 128 * 1024 => {
                serde_json::from_reader(file)?
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => Registry {
                version: 1,
                platforms: BTreeMap::new(),
            },
            _ => return Err(io::ErrorKind::InvalidData.into()),
        };
        if registry.version != 1 {
            return Err(io::ErrorKind::InvalidData.into());
        }
        Ok(Self {
            registry,
            path,
            _lock: lock,
        })
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
        self.replace(&next).map_err(|_| Fault::Storage)?;
        self.registry = next;
        Ok(())
    }

    fn replace(&self, registry: &Registry) -> io::Result<()> {
        let directory = self.path.parent().ok_or(io::ErrorKind::InvalidInput)?;
        let mut file = tempfile::NamedTempFile::new_in(directory)?;
        serde_json::to_writer(&mut file, registry)?;
        file.flush()?;
        file.as_file().sync_all()?;
        file.persist(&self.path)?;
        #[cfg(unix)]
        let _ = File::open(directory).and_then(|dir| dir.sync_all());
        Ok(())
    }
}
