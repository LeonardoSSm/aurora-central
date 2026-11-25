#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("failed to start Aurora Central");
}

#[cfg(test)]
mod tests {
    use serde_json::Value;

    #[test]
    fn production_window_has_no_ipc_capabilities() {
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let security = &config["app"]["security"];
        let capability: Value =
            serde_json::from_str(include_str!("../capabilities/main.json")).unwrap();

        assert_eq!(security["capabilities"], serde_json::json!(["main-local"]));
        assert_eq!(capability["identifier"], "main-local");
        assert_eq!(capability["windows"], serde_json::json!(["main"]));
        assert_eq!(capability["permissions"], serde_json::json!([]));
        assert!(capability.get("remote").is_none());
        assert_eq!(config["app"]["withGlobalTauri"], false);
    }

    #[test]
    fn production_policy_disallows_network_and_embeds() {
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let policy = config["app"]["security"]["csp"].as_object().unwrap();

        for directive in ["connect-src", "object-src", "frame-src", "form-action"] {
            assert_eq!(policy[directive], "'none'");
        }
        assert_eq!(policy["script-src"], "'self'");
    }
}
