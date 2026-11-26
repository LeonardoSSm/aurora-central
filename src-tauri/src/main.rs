#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod launcher;
mod settings;
mod storage;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(launcher::setup)
        .invoke_handler(tauri::generate_handler![
            launcher::launcher_snapshot,
            launcher::launcher_open,
            launcher::launcher_choose_executable,
            launcher::launcher_remove_executable,
            launcher::launcher_choose_monitor,
            launcher::settings_snapshot,
            launcher::settings_save,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start Aurora Central");
}

#[cfg(test)]
mod tests {
    use serde_json::Value;

    #[test]
    fn production_window_only_allows_specific_local_ipc() {
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let security = &config["app"]["security"];
        let capability: Value =
            serde_json::from_str(include_str!("../capabilities/main.json")).unwrap();

        assert_eq!(security["capabilities"], serde_json::json!(["main-local"]));
        assert_eq!(capability["identifier"], "main-local");
        assert_eq!(capability["windows"], serde_json::json!(["main"]));
        assert_eq!(
            capability["permissions"],
            serde_json::json!([
                "core:window:allow-set-fullscreen",
                "allow-launcher-snapshot",
                "allow-launcher-open",
                "allow-launcher-choose-executable",
                "allow-launcher-remove-executable",
                "allow-launcher-choose-monitor",
                "allow-settings-snapshot",
                "allow-settings-save"
            ])
        );
        assert!(capability.get("remote").is_none());
        assert_eq!(config["app"]["withGlobalTauri"], false);
    }

    #[test]
    fn production_policy_disallows_network_and_embeds() {
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let policy = config["app"]["security"]["csp"].as_object().unwrap();

        for directive in ["object-src", "frame-src", "form-action"] {
            assert_eq!(policy[directive], "'none'");
        }
        assert_eq!(policy["connect-src"], "ipc: http://ipc.localhost");
        assert_eq!(policy["script-src"], "'self'");
    }

    #[test]
    fn production_acl_rejects_unlisted_windows_remote_pages_and_plugin_operations() {
        use tauri::{
            ipc::{CallbackFn, InvokeBody},
            test::{get_ipc_response, mock_builder, INVOKE_KEY},
            webview::InvokeRequest,
            WebviewUrl, WebviewWindowBuilder,
        };

        let app = mock_builder()
            .invoke_handler(|invoke| {
                invoke.resolver.resolve("allowed");
                true
            })
            .build(tauri::generate_context!(test = true))
            .unwrap();
        let main = WebviewWindowBuilder::new(&app, "main", WebviewUrl::App("index.html".into()))
            .build()
            .unwrap();
        let other =
            WebviewWindowBuilder::new(&app, "auxiliary", WebviewUrl::App("index.html".into()))
                .build()
                .unwrap();
        let local = if cfg!(windows) {
            "http://tauri.localhost"
        } else {
            "tauri://localhost"
        };
        let allowed =
            |window: &tauri::WebviewWindow<tauri::test::MockRuntime>, command: &str, url: &str| {
                get_ipc_response(
                    window,
                    InvokeRequest {
                        cmd: command.into(),
                        callback: CallbackFn(0),
                        error: CallbackFn(1),
                        url: url.parse().unwrap(),
                        body: InvokeBody::default(),
                        headers: Default::default(),
                        invoke_key: INVOKE_KEY.into(),
                    },
                )
                .is_ok()
            };
        assert!(allowed(&main, "launcher_open", local));
        assert!(allowed(&main, "settings_snapshot", local));
        assert!(allowed(&main, "settings_save", local));
        assert!(!allowed(&other, "settings_save", local));
        assert!(!allowed(&main, "settings_save", "https://example.invalid"));
        assert!(!allowed(&other, "launcher_open", local));
        assert!(!allowed(
            &main,
            "launcher_choose_executable",
            "https://example.invalid"
        ));
        assert!(!allowed(&main, "plugin:dialog|open", local));
        assert!(!allowed(&main, "plugin:fs|read_file", local));
        assert!(!allowed(&main, "plugin:shell|execute", local));
    }
}
