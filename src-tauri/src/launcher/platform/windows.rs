use std::{
    ffi::{OsStr, OsString},
    io,
    mem::size_of,
    os::windows::{
        ffi::{OsStrExt, OsStringExt},
        io::{AsRawHandle, FromRawHandle, OwnedHandle},
    },
    path::{Path, PathBuf},
    ptr::null_mut,
};

use windows_sys::Win32::{
    Foundation::{HANDLE, HWND, INVALID_HANDLE_VALUE, RECT, WAIT_TIMEOUT},
    Globalization::{CompareStringOrdinal, CSTR_EQUAL},
    Graphics::{
        Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED},
        Gdi::{
            EnumDisplayDevicesW, EnumDisplayMonitors, GetMonitorInfoW, MonitorFromWindow,
            DISPLAY_DEVICEW, DISPLAY_DEVICE_ACTIVE, HDC, HMONITOR, MONITORINFO, MONITORINFOEXW,
            MONITOR_DEFAULTTONULL,
        },
    },
    System::{
        Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
            TH32CS_SNAPPROCESS,
        },
        RemoteDesktop::ProcessIdToSessionId,
        Threading::{
            OpenProcess, QueryFullProcessImageNameW, WaitForSingleObject,
            PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SYNCHRONIZE,
        },
    },
    UI::{
        HiDpi::{
            GetDpiForMonitor, SetThreadDpiAwarenessContext, DPI_AWARENESS_CONTEXT,
            DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2, MDT_EFFECTIVE_DPI,
        },
        WindowsAndMessaging::{
            EnumWindows, GetForegroundWindow, GetWindow, GetWindowLongPtrW, GetWindowRect,
            GetWindowThreadProcessId, IsIconic, IsWindowVisible, IsZoomed, SetForegroundWindow,
            SetWindowPos, ShowWindowAsync, EDD_GET_DEVICE_INTERFACE_NAME, GWL_EXSTYLE, GW_OWNER,
            MONITORINFOF_PRIMARY, SWP_ASYNCWINDOWPOS, SWP_NOACTIVATE, SWP_NOSIZE, SWP_NOZORDER,
            SW_RESTORE, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
        },
    },
};

use super::super::contracts::{
    Environment, Focus, Monitor, MonitorId, Placement, WindowObservation,
};
use super::preferred_display;

pub fn environment() -> Environment {
    Environment::Windows
}

pub struct Processes {
    candidates: Vec<(u32, OsString)>,
    session: u32,
}

pub struct Process {
    id: u32,
    handle: OwnedHandle,
}

pub struct Window<'a> {
    handle: HWND,
    process: &'a Process,
}

impl Processes {
    pub fn discover() -> io::Result<Self> {
        let session = session_id(std::process::id()).ok_or_else(io::Error::last_os_error)?;
        // SAFETY: Toolhelp returns an owned snapshot and fills a sized entry.
        unsafe {
            let handle = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if handle == INVALID_HANDLE_VALUE {
                return Err(io::Error::last_os_error());
            }
            let snapshot = OwnedHandle::from_raw_handle(handle);
            let mut item = PROCESSENTRY32W {
                dwSize: size_of::<PROCESSENTRY32W>() as u32,
                ..Default::default()
            };
            if Process32FirstW(snapshot.as_raw_handle(), &mut item) == 0 {
                return Err(io::Error::last_os_error());
            }
            let mut candidates = Vec::new();
            loop {
                candidates.push((
                    item.th32ProcessID,
                    OsString::from_wide(wide_text(&item.szExeFile)),
                ));
                if Process32NextW(snapshot.as_raw_handle(), &mut item) == 0 {
                    break;
                }
            }
            Ok(Self {
                candidates,
                session,
            })
        }
    }

    pub fn matching(&self, path: &Path) -> Vec<Process> {
        self.candidates
            .iter()
            // The Toolhelp basename alone never authorizes an action or suppresses a launch.
            .filter(|(pid, name)| {
                path.file_name()
                    .is_some_and(|expected| equal(expected, name))
                    && session_id(*pid) == Some(self.session)
            })
            .filter_map(|(pid, _)| {
                let process = Process::open(*pid)?;
                let image = process.image()?.canonicalize().ok()?;
                (equal(image.as_os_str(), path.as_os_str())
                    && same_file::is_same_file(image, path).ok()?
                    && process.alive())
                .then_some(process)
            })
            .collect()
    }
}

fn session_id(pid: u32) -> Option<u32> {
    let mut session = 0;
    // SAFETY: The output points to a writable u32.
    (unsafe { ProcessIdToSessionId(pid, &mut session) } != 0).then_some(session)
}

fn equal(left: &OsStr, right: &OsStr) -> bool {
    let left: Vec<_> = left.encode_wide().collect();
    let right: Vec<_> = right.encode_wide().collect();
    // SAFETY: Both arrays have the lengths provided to the API.
    unsafe {
        CompareStringOrdinal(
            left.as_ptr(),
            left.len() as i32,
            right.as_ptr(),
            right.len() as i32,
            1,
        ) == CSTR_EQUAL
    }
}

fn wide_text(buffer: &[u16]) -> &[u16] {
    &buffer[..buffer
        .iter()
        .position(|unit| *unit == 0)
        .unwrap_or(buffer.len())]
}

impl Process {
    fn open(id: u32) -> Option<Self> {
        // SAFETY: OpenProcess returns an owned handle on success.
        let handle = unsafe {
            OpenProcess(
                PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SYNCHRONIZE,
                0,
                id,
            )
        };
        if handle.is_null() {
            return None;
        }
        Some(Self {
            id,
            handle: unsafe { OwnedHandle::from_raw_handle(handle) },
        })
    }

    fn image(&self) -> Option<PathBuf> {
        let mut buffer = vec![0; 32768];
        let mut length = buffer.len() as u32;
        // SAFETY: The owned process handle and writable image buffer remain live.
        let result = unsafe {
            QueryFullProcessImageNameW(
                self.handle.as_raw_handle() as HANDLE,
                0,
                buffer.as_mut_ptr(),
                &mut length,
            )
        };
        (result != 0).then(|| PathBuf::from(OsString::from_wide(&buffer[..length as usize])))
    }

    fn alive(&self) -> bool {
        // SAFETY: The owned handle has SYNCHRONIZE access. A zero timeout never waits.
        unsafe { WaitForSingleObject(self.handle.as_raw_handle(), 0) == WAIT_TIMEOUT }
    }

    pub fn id(&self) -> u32 {
        self.id
    }

    pub fn window(&self) -> Option<Window<'_>> {
        struct Search {
            id: u32,
            handle: HWND,
        }
        unsafe extern "system" fn visit(window: HWND, context: isize) -> i32 {
            // SAFETY: EnumWindows invokes this synchronously with the live Search.
            let search = unsafe { &mut *(context as *mut Search) };
            if eligible(window, search.id) {
                search.handle = window;
                return 0;
            }
            1
        }

        let mut search = Search {
            id: self.id,
            handle: null_mut(),
        };
        // SAFETY: The callback does not retain the stack pointer.
        unsafe { EnumWindows(Some(visit), (&mut search as *mut Search) as isize) };
        let window = Window {
            handle: search.handle,
            process: self,
        };
        window.valid().then_some(window)
    }

    pub fn observation(&self) -> WindowObservation {
        if self.window().is_some() {
            WindowObservation::Detected
        } else {
            WindowObservation::NotDetected
        }
    }
}

fn eligible(window: HWND, expected: u32) -> bool {
    let mut owner = 0;
    // SAFETY: Win32 checks the HWND, and both output values are writable.
    unsafe {
        if window.is_null()
            || GetWindowThreadProcessId(window, &mut owner) == 0
            || owner != expected
            || IsWindowVisible(window) == 0
            || !GetWindow(window, GW_OWNER).is_null()
            || GetWindowLongPtrW(window, GWL_EXSTYLE)
                & (WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW) as isize
                != 0
        {
            return false;
        }
        let mut cloaked: u32 = 0;
        DwmGetWindowAttribute(
            window,
            DWMWA_CLOAKED as u32,
            (&mut cloaked as *mut u32).cast(),
            size_of::<u32>() as u32,
        ) >= 0
            && cloaked == 0
    }
}

impl Window<'_> {
    fn valid(&self) -> bool {
        self.process.alive() && eligible(self.handle, self.process.id)
    }

    pub fn request_focus(&self) -> Option<Focus> {
        if !self.valid() {
            return None;
        }
        // SAFETY: The HWND was rechecked against the live process. Win32 decides
        // whether the request can take foreground; no input queues are attached.
        unsafe {
            if IsIconic(self.handle) != 0 {
                ShowWindowAsync(self.handle, SW_RESTORE);
            }
            if !self.valid() {
                return None;
            }
            let accepted = SetForegroundWindow(self.handle) != 0;
            if GetForegroundWindow() == self.handle && self.valid() {
                return Some(Focus::Confirmed);
            }
            if !accepted {
                return Some(Focus::Denied);
            }
            // Foreground activation can be delivered asynchronously. Observe it
            // briefly on the worker thread without repeating the request.
            for _ in 0..3 {
                std::thread::sleep(std::time::Duration::from_millis(25));
                if GetForegroundWindow() == self.handle && self.valid() {
                    return Some(Focus::Confirmed);
                }
            }
            Some(Focus::Requested)
        }
    }

    pub fn place(&self, monitors: &[Display], preferred: &MonitorId) -> Placement {
        let Some((target, fallback)) = preferred_display(monitors, preferred) else {
            return Placement::Unavailable;
        };
        let _dpi = ThreadDpi::physical();
        if !self.valid() {
            return Placement::Unavailable;
        }
        // SAFETY: The HWND was rechecked and all Win32 output storage is initialized.
        unsafe {
            if MonitorFromWindow(self.handle, MONITOR_DEFAULTTONULL) == target.handle {
                return if fallback {
                    Placement::FallbackConfirmed
                } else {
                    Placement::Confirmed
                };
            }
            let mut area = RECT::default();
            if IsZoomed(self.handle) != 0
                || IsIconic(self.handle) != 0
                || GetWindowRect(self.handle, &mut area) == 0
                || !self.valid()
            {
                return Placement::Unavailable;
            }
            let (x, y) = centered(target.work, area);
            let accepted = SetWindowPos(
                self.handle,
                null_mut(),
                x,
                y,
                0,
                0,
                SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS,
            ) != 0;
            if !accepted {
                Placement::Unavailable
            } else if fallback {
                Placement::FallbackRequested
            } else {
                Placement::Requested
            }
        }
    }

    pub fn confirm_placement(
        &self,
        monitors: &[Display],
        preferred: &MonitorId,
        previous: Placement,
    ) -> Placement {
        let Some((target, fallback)) = preferred_display(monitors, preferred) else {
            return previous;
        };
        // SAFETY: MonitorFromWindow handles a stale HWND, and valid checks ownership.
        if self.valid()
            && unsafe { MonitorFromWindow(self.handle, MONITOR_DEFAULTTONULL) } == target.handle
        {
            if fallback {
                Placement::FallbackConfirmed
            } else {
                Placement::Confirmed
            }
        } else {
            previous
        }
    }
}

pub struct Display {
    pub info: Monitor,
    handle: HMONITOR,
    work: RECT,
}

struct ThreadDpi(DPI_AWARENESS_CONTEXT);

impl ThreadDpi {
    fn physical() -> Self {
        // SAFETY: The override is scoped to the calling thread and restored by Drop.
        Self(unsafe { SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2) })
    }
}

impl Drop for ThreadDpi {
    fn drop(&mut self) {
        if !self.0.is_null() {
            // SAFETY: This context was returned by Windows on the same thread.
            unsafe { SetThreadDpiAwarenessContext(self.0) };
        }
    }
}

pub fn displays(_app: &tauri::AppHandle) -> Vec<Display> {
    unsafe extern "system" fn visit(handle: HMONITOR, _: HDC, _: *mut RECT, data: isize) -> i32 {
        // SAFETY: The enclosing enumeration keeps this Vec alive synchronously.
        let outputs = unsafe { &mut *(data as *mut Vec<Display>) };
        if let Some(display) = display_info(handle) {
            outputs.push(display);
        }
        1
    }
    let _dpi = ThreadDpi::physical();
    let mut outputs: Vec<Display> = Vec::new();
    // SAFETY: Callback and context stay valid for the entire enumeration.
    unsafe {
        EnumDisplayMonitors(
            null_mut(),
            std::ptr::null(),
            Some(visit),
            (&mut outputs as *mut Vec<Display>) as isize,
        )
    };
    // Mirrored outputs can be ambiguous. Offer only uniquely identified targets.
    for index in 0..outputs.len() {
        if let Some(id) = outputs[index].info.id.clone() {
            if outputs
                .iter()
                .skip(index + 1)
                .any(|output| output.info.id.as_ref() == Some(&id))
            {
                for output in outputs
                    .iter_mut()
                    .filter(|output| output.info.id.as_ref() == Some(&id))
                {
                    output.info.id = None;
                }
            }
        }
    }
    outputs
}

fn display_info(handle: HMONITOR) -> Option<Display> {
    let mut monitor = MONITORINFOEXW::default();
    monitor.monitorInfo.cbSize = size_of::<MONITORINFOEXW>() as u32;
    let (mut dpi_x, mut dpi_y) = (96, 96);
    // SAFETY: Both APIs receive correctly sized output storage for the enumerated monitor.
    unsafe {
        if GetMonitorInfoW(
            handle,
            (&mut monitor as *mut MONITORINFOEXW).cast::<MONITORINFO>(),
        ) == 0
        {
            return None;
        }
        let _ = GetDpiForMonitor(handle, MDT_EFFECTIVE_DPI, &mut dpi_x, &mut dpi_y);
    }
    let (id, name) = display_identity(&monitor.szDevice);
    let bounds = monitor.monitorInfo.rcMonitor;
    Some(Display {
        info: Monitor {
            id,
            name,
            primary: monitor.monitorInfo.dwFlags & MONITORINFOF_PRIMARY != 0,
            x: bounds.left,
            y: bounds.top,
            width: bounds.right.abs_diff(bounds.left),
            height: bounds.bottom.abs_diff(bounds.top),
            scale: f64::from(dpi_x) / 96.0,
        },
        handle,
        work: monitor.monitorInfo.rcWork,
    })
}

fn display_identity(device: &[u16; 32]) -> (Option<MonitorId>, String) {
    let mut active = Vec::new();
    for index in 0.. {
        let mut display = DISPLAY_DEVICEW {
            cb: size_of::<DISPLAY_DEVICEW>() as u32,
            ..Default::default()
        };
        // SAFETY: The display name is NUL-terminated and the destination is correctly sized.
        if unsafe {
            EnumDisplayDevicesW(
                device.as_ptr(),
                index,
                &mut display,
                EDD_GET_DEVICE_INTERFACE_NAME,
            )
        } == 0
        {
            break;
        }
        if display.StateFlags & DISPLAY_DEVICE_ACTIVE != 0 {
            active.push(display);
        }
    }
    if let [display] = active.as_slice() {
        let identity = wide_text(&display.DeviceID);
        let name = wide_text(&display.DeviceString);
        return (
            (!identity.is_empty()).then(|| MonitorId::from_device(identity)),
            if name.is_empty() {
                "Monitor".into()
            } else {
                String::from_utf16_lossy(name)
            },
        );
    }
    (None, "Monitor".into())
}

fn centered(work: RECT, area: RECT) -> (i32, i32) {
    fn axis(start: i32, end: i32, near: i32, far: i32) -> i32 {
        let space = i64::from(end) - i64::from(start);
        let size = i64::from(far) - i64::from(near);
        (i64::from(start) + (space - size.max(0)).max(0) / 2) as i32
    }
    (
        axis(work.left, work.right, area.left, area.right),
        axis(work.top, work.bottom, area.top, area.bottom),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn centers_on_a_negative_vertical_work_area_and_keeps_oversized_windows_reachable() {
        let display = RECT {
            left: -900,
            top: -320,
            right: 0,
            bottom: 1200,
        };
        assert_eq!(
            centered(
                display,
                RECT {
                    left: 0,
                    top: 0,
                    right: 540,
                    bottom: 720
                }
            ),
            (-720, 80)
        );
        assert_eq!(
            centered(
                display,
                RECT {
                    left: 0,
                    top: 0,
                    right: 1800,
                    bottom: 1800
                }
            ),
            (-900, -320)
        );
    }

    #[test]
    fn prefers_device_identity_then_primary_then_an_available_monitor() {
        fn monitor(code: u16, primary: bool) -> Display {
            Display {
                info: Monitor {
                    id: Some(MonitorId::from_device(&[code])),
                    name: String::new(),
                    primary,
                    x: 0,
                    y: 0,
                    width: 1920,
                    height: 1080,
                    scale: 1.0,
                },
                handle: null_mut(),
                work: RECT::default(),
            }
        }
        let preferred = MonitorId::from_device(&[11]);
        let displays = [monitor(11, false), monitor(22, true)];
        let (display, fallback) = preferred_display(&displays, &preferred).unwrap();
        assert_eq!(display.info.id.as_ref(), Some(&preferred));
        assert!(!fallback);

        let missing = MonitorId::from_device(&[33]);
        let (display, fallback) = preferred_display(&displays, &missing).unwrap();
        assert!(display.info.primary && fallback);
        assert!(preferred_display(&displays[..1], &missing).unwrap().1);
        assert!(preferred_display(&[], &missing).is_none());
    }
}
