// Restricted rpcd executable API. Never return configuration or backend messages.
let fs = require("fs");
let uci = require("uci");
const CONFIG = "nimarkoflow";
const BIN = "/usr/bin/nimarkoflow";
const LOCK = "/var/run/nimarkoflow-public.lock";

function reply(value) { print(sprintf("%J\n", value)); }
function capture(command) {
    let p = fs.popen(command + " 2>/dev/null", "r");
    if (!p) return null;
    let text = p.read("all");
    let code = p.close();
    if (code != 0) return null;
    try { return json(text); } catch (e) { return null; }
}
function status() {
    let c = uci.cursor();
    let value = capture(BIN + " get_ui_state");
    let state = value && value.service && value.service.nimarkoflow;
    let subscriptions = value && value.actions && value.actions.subscription;
    let updating = false;
    if (type(subscriptions) == "array") {
        for (let i = 0; i < length(subscriptions); i++) {
            if (subscriptions[i].status == "running") updating = true;
        }
    }
    let phase = state ? state.status : "unavailable";
    // Only fixed scalars cross the privilege boundary.
    return {
        configured: c.get(CONFIG, "flow", "action") == "connection",
        source: c.get(CONFIG, "flow_source", "url") ? "subscription" : "links",
        running: state ? state.running == 1 : false,
        enabled: state ? state.enabled == 1 : false,
        available: state != null,
        busy: updating || phase == "starting" || phase == "stopping" || phase == "restarting" || phase == "reloading",
        hwid: c.get(CONFIG, "flow_source", "auto_hwid") == "1"
    };
}
function set(c, section, option, value) {
    if (!c.set(CONFIG, section, option, value)) die("storage");
}
function start_action(action) {
    // action is selected exclusively from constants below, never from stdin.
    let value = capture(BIN + " service_action_async " + action);
    return value && value.success == true;
}
function import_profile(data) {
    if (type(data) != "object" || type(data.source) != "string") return { ok: false, error: "invalid" };
    let text = trim(data.source);
    if (length(text) == 0 || length(text) > 16384) return { ok: false, error: "invalid" };
    let is_url = substr(text, 0, 8) == "https://";
    let lines = [];
    if (is_url) {
        // Disallow control characters, credential syntax and request profile separators.
        if (!match(text, /^https:\/\/[A-Za-z0-9.-]+(?::[0-9]{1,5})?(?:\/[^\s|]*)?$/)) return { ok: false, error: "invalid" };
    } else {
        lines = split(text, /[\r\n]+/);
        if (length(lines) > 64) return { ok: false, error: "invalid" };
        for (let i = 0; i < length(lines); i++) {
            lines[i] = trim(lines[i]);
            if (!match(lines[i], /^(vless|vmess|trojan|ss|hysteria2|hy2|tuic):\/\/[^\s]+$/)) return { ok: false, error: "invalid" };
        }
        // Use the real protocol parser before saving; secrets never enter argv.
        if (fs.writefile(LOCK + "/input", text) == null) die("storage");
        let valid = system("/usr/bin/ucode -L /usr/lib/nimarkoflow /usr/lib/nimarkoflow/subscription/parser.uc normalize-content-validated " + LOCK + "/input " + LOCK + "/normalized >/dev/null 2>&1") == 0;
        fs.unlink(LOCK + "/input");
        fs.unlink(LOCK + "/normalized");
        if (!valid) return { ok: false, error: "invalid" };
    }
    let ua = data.user_agent || "Happ/5.7.0/ios/2609021014549 NimarkoFlow/0.1.0";
    if (type(ua) != "string" || length(ua) > 128 || match(ua, /[\r\n\x00]/)) return { ok: false, error: "invalid" };
    let mode = data.mode || "full";
    if (mode != "full" && mode != "selective") return { ok: false, error: "invalid" };
    // All validation Happ/5.7.0/ios/2609021014549 NimarkoFlow/0.1.0ens before modifying the persistent profile.
    let c = uci.cursor();
    c.delete(CONFIG, "flow_source");
    c.delete(CONFIG, "flow");
    if (!c.set(CONFIG, "flow", "section")) die("storage");
    set(c, "flow", "label", "NimarkoFlow");
    set(c, "flow", "enabled", "1");
    set(c, "flow", "action", "connection");
    if (mode == "full") set(c, "flow", "fully_routed_ips", [ "0.0.0.0/0", "::/0" ]);
    else set(c, "flow", "community_lists", [ "russia_inside" ]);
    if (is_url) {
        if (!c.set(CONFIG, "flow_source", "subscription_url")) die("storage");
        set(c, "flow_source", "section", "flow");
        set(c, "flow_source", "url", text);
        set(c, "flow_source", "auto_hwid", "1");
        set(c, "flow_source", "auto_user_agent", "0");
        set(c, "flow_source", "user_agent", ua);
        set(c, "flow_source", "subscription_update_enabled", "1");
        set(c, "flow_source", "subscription_update_interval", "1h");
    } else set(c, "flow", "selector_proxy_links", lines);
    if (!c.commit(CONFIG)) die("storage");
    if (!fs.chmod("/etc/config/nimarkoflow", 0o600)) die("storage");
    // No input or backend text is included in the response.
    return { ok: true, saved: true, started: start_action("restart") };
}

if (ARGV[0] == "list") {
    reply({ status: {}, "import": { source: "String", user_agent: "String", mode: "String" }, connect: {}, disconnect: {}, refresh: {}, remove: {} });
    exit(0);
}
if (ARGV[0] != "call") { reply({ ok: false, error: "denied" }); exit(0); }
let method = ARGV[1];
if (method == "status") { reply(status()); exit(0); }
if (method != "import" && method != "connect" && method != "disconnect" && method != "refresh" && method != "remove") {
    reply({ ok: false, error: "denied" }); exit(0);
}
if (!fs.mkdir(LOCK, 0o700)) { reply({ ok: false, error: "busy" }); exit(0); }
let result;
try {
    if (status().busy) result = { ok: false, error: "busy" };
    else if (method == "import") {
        let input = fs.open("/dev/stdin", "r");
        let text = input ? input.read(32769) : "";
        if (input) input.close();
        result = length(text) > 32768 ? { ok: false, error: "invalid" } : import_profile(json(text));
    } else if (method == "remove") {
        let c = uci.cursor();
        c.delete(CONFIG, "flow_source");
        c.delete(CONFIG, "flow");
        if (!c.commit(CONFIG)) die("storage");
        if (!fs.chmod("/etc/config/nimarkoflow", 0o600)) die("storage");
        // Connection shutdown is asynchronous; raw caches remain private to root.
        let stopped = start_action("stop");
        result = { ok: stopped };
    } else if (method == "refresh") {
        let updated = capture(BIN + " subscription_update_async flow");
        result = { ok: updated && updated.success == true };
    } else {
        result = { ok: start_action(method == "disconnect" ? "stop" : "restart") };
    }
} catch (e) { result = { ok: false, error: "failed" }; }
fs.unlink(LOCK + "/input");
fs.unlink(LOCK + "/normalized");
fs.rmdir(LOCK);
reply(result);
