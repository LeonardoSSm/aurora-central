#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub use windows::*;

#[cfg(not(windows))]
mod portable;
#[cfg(not(windows))]
pub use portable::*;

// This is the same selection rule for any future placement adapter.
#[cfg(windows)]
fn preferred_display<'a>(
    displays: &'a [Display],
    preferred: &super::contracts::MonitorId,
) -> Option<(&'a Display, bool)> {
    displays
        .iter()
        .find(|display| display.info.id.as_ref() == Some(preferred))
        .map(|display| (display, false))
        .or_else(|| {
            displays
                .iter()
                .find(|display| display.info.primary)
                .or_else(|| displays.first())
                .map(|display| (display, true))
        })
}
