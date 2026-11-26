use std::{
    fs::{self, File, Metadata, OpenOptions},
    io::{self, Read, Seek},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::contracts::{ApplicationState, Fault, MonitorId};

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Approval {
    pub path: PathBuf,
    fingerprint: Fingerprint,
    pub monitor: Option<MonitorId>,
}

#[derive(Clone, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
struct Fingerprint {
    bytes: u64,
    modified: std::time::SystemTime,
    sha256: [u8; 32],
}

pub struct Executable {
    pub path: PathBuf,
    file: File,
}

impl Executable {
    pub fn select(path: &Path) -> Result<Self, Fault> {
        if !local_path(path) {
            return Err(Fault::InvalidExecutable);
        }
        let path = path.canonicalize().map_err(|_| Fault::InvalidExecutable)?;
        let mut executable = Self::read(&path).map_err(|_| Fault::InvalidExecutable)?;
        if !valid_binary(&mut executable.file)
            || std::env::current_exe()
                .and_then(|current| same_file::is_same_file(current, &path))
                .unwrap_or(true)
        {
            return Err(Fault::InvalidExecutable);
        }
        Ok(executable)
    }

    pub fn approval(&mut self) -> Result<Approval, Fault> {
        Ok(Approval {
            path: self.path.clone(),
            fingerprint: self.fingerprint()?,
            monitor: None,
        })
    }

    fn read(path: &Path) -> io::Result<Self> {
        if !local_path(path) || !fs::metadata(path)?.is_file() {
            return Err(io::ErrorKind::InvalidInput.into());
        }
        let mut options = OpenOptions::new();
        options.read(true);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            use windows_sys::Win32::Storage::FileSystem::FILE_SHARE_READ;
            // Hold the approved image against writes and deletion until spawn.
            options.share_mode(FILE_SHARE_READ);
        }
        #[cfg(target_os = "linux")]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK);
        }
        let file = options.open(path)?;
        if !file.metadata()?.is_file() || file_path_changed(path)? {
            return Err(io::ErrorKind::InvalidInput.into());
        }
        Ok(Self {
            path: path.into(),
            file,
        })
    }

    fn fingerprint(&mut self) -> Result<Fingerprint, Fault> {
        fn details(file: &File) -> io::Result<(u64, std::time::SystemTime)> {
            let metadata = file.metadata()?;
            Ok((metadata.len(), metadata.modified()?))
        }
        let (bytes, modified) = details(&self.file).map_err(|_| Fault::InvalidExecutable)?;
        self.file.rewind().map_err(|_| Fault::InvalidExecutable)?;
        let mut digest = Sha256::new();
        let read = io::copy(&mut (&self.file).take(bytes.saturating_add(1)), &mut digest)
            .map_err(|_| Fault::InvalidExecutable)?;
        if read != bytes || details(&self.file).ok() != Some((bytes, modified)) {
            return Err(Fault::ApprovalChanged);
        }
        Ok(Fingerprint {
            bytes,
            modified,
            sha256: digest.finalize().into(),
        })
    }

    pub fn authorize(approval: &Approval) -> Result<Self, ApplicationState> {
        let mut executable = Self::read(&approval.path).map_err(path_failure)?;
        if !valid_binary(&mut executable.file) {
            return Err(error(Fault::InvalidExecutable));
        }
        if executable.fingerprint().map_err(error)? != approval.fingerprint {
            return Err(error(Fault::ApprovalChanged));
        }
        Ok(executable)
    }

    pub fn spawn(&self, arguments: &[&str]) -> io::Result<Child> {
        let directory = self.path.parent().ok_or(io::ErrorKind::InvalidInput)?;
        #[cfg(target_os = "linux")]
        let mut command = {
            use std::os::{fd::AsRawFd, unix::process::CommandExt};
            // Execute the verified ELF through its open descriptor. CLOEXEC
            // closes it after exec, and arg0 retains the installed name.
            let mut command = Command::new(format!("/proc/self/fd/{}", self.file.as_raw_fd()));
            command.arg0(&self.path);
            // SAFETY: The pre-exec closure only uses prctl and reads errno on
            // failure. This prevents file capabilities from raising privileges.
            unsafe {
                command.pre_exec(|| {
                    if libc::prctl(libc::PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0 {
                        return Err(io::Error::last_os_error());
                    }
                    Ok(())
                });
            }
            command
        };
        #[cfg(not(target_os = "linux"))]
        let mut command = Command::new(&self.path);

        command
            .args(arguments)
            .current_dir(directory)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
    }
}

impl Approval {
    pub fn availability(&self) -> ApplicationState {
        let result = (|| -> io::Result<Metadata> {
            if !local_path(&self.path) || file_path_changed(&self.path)? {
                return Err(io::ErrorKind::InvalidInput.into());
            }
            fs::metadata(&self.path)
        })();
        match result {
            Ok(meta) if !meta.is_file() || !executable_permissions(&meta) => {
                error(Fault::InvalidExecutable)
            }
            Ok(meta)
                if meta.len() == self.fingerprint.bytes
                    && meta.modified().ok() == Some(self.fingerprint.modified) =>
            {
                ApplicationState::Available
            }
            Ok(_) => error(Fault::ApprovalChanged),
            Err(failure) => path_failure(failure),
        }
    }
}

pub fn error(reason: Fault) -> ApplicationState {
    ApplicationState::Error { reason }
}

fn path_failure(failure: io::Error) -> ApplicationState {
    match failure.kind() {
        io::ErrorKind::NotFound => ApplicationState::NotInstalled,
        io::ErrorKind::PermissionDenied => ApplicationState::Unavailable,
        _ => error(Fault::InvalidExecutable),
    }
}

fn file_path_changed(path: &Path) -> io::Result<bool> {
    Ok(path.canonicalize()? != path)
}

#[cfg(windows)]
fn local_path(path: &Path) -> bool {
    use std::path::{Component, Prefix};
    let mut components = path.components();
    path.is_absolute()
        && matches!(components.next(), Some(Component::Prefix(prefix))
            if matches!(prefix.kind(), Prefix::Disk(_) | Prefix::VerbatimDisk(_)))
        && components.all(|part| match part {
            Component::RootDir => true,
            Component::Normal(name) => name
                .to_str()
                .is_some_and(|name| !name.contains([':', '\0'])),
            _ => false,
        })
        && path
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("exe"))
}

#[cfg(target_os = "linux")]
fn local_path(path: &Path) -> bool {
    path.is_absolute() && path.to_str().is_some_and(|path| !path.contains('\0'))
}

#[cfg(not(any(windows, target_os = "linux")))]
fn local_path(_path: &Path) -> bool {
    false
}

#[cfg(target_os = "linux")]
fn executable_permissions(meta: &Metadata) -> bool {
    use std::os::unix::fs::PermissionsExt;
    let mode = meta.permissions().mode();
    // No set-ID binaries or scripts/interpreters selected via a shebang.
    mode & 0o6000 == 0 && mode & 0o111 != 0
}

#[cfg(not(target_os = "linux"))]
fn executable_permissions(_meta: &Metadata) -> bool {
    true
}

#[cfg(windows)]
fn valid_binary(file: &mut File) -> bool {
    use std::io::SeekFrom;
    // Read the DOS header and PE signature/COFF flags. Windows validates the
    // executable architecture and remaining headers when creating the process.
    let mut dos = [0; 64];
    if file.read_exact(&mut dos).is_err() || &dos[..2] != b"MZ" {
        return false;
    }
    let offset = u32::from_le_bytes(dos[60..64].try_into().unwrap());
    let mut coff = [0; 24];
    if offset < 64
        || file.seek(SeekFrom::Start(offset.into())).is_err()
        || file.read_exact(&mut coff).is_err()
        || &coff[..4] != b"PE\0\0"
    {
        return false;
    }
    let flags = u16::from_le_bytes([coff[22], coff[23]]);
    flags & 0x0002 != 0 && flags & 0x2000 == 0
}

#[cfg(target_os = "linux")]
fn valid_binary(file: &mut File) -> bool {
    let mut header = [0; 18];
    if !file
        .metadata()
        .is_ok_and(|meta| executable_permissions(&meta))
        || file.read_exact(&mut header).is_err()
        || &header[..4] != b"\x7fELF"
    {
        return false;
    }
    let kind = [header[16], header[17]];
    match header[5] {
        1 => matches!(u16::from_le_bytes(kind), 2 | 3),
        2 => matches!(u16::from_be_bytes(kind), 2 | 3),
        _ => false,
    }
}

#[cfg(not(any(windows, target_os = "linux")))]
fn valid_binary(_file: &mut File) -> bool {
    false
}
