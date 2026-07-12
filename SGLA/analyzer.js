const EXCLUDED_PRELOADERS = ["BepInEx.Preloader", "BepInEx.SplashScreen.Patcher.BepInEx5", "Tobey.UnityAudio.Patcher", "Tobey.BepInEx.Timestamp", "Tobey.BZMacProcessFix", "Tobey.Subnautica.ConfigHandler.Patcher", "MirrorInternalLogs", "OpenBoarders", "CC2SkipHelpFilesPatcher", "GamePathLogger", "QModManager.QModPluginGenerator", "QModManager.UnityAudioFixer"];
const EXCLUDED_MODS = ["Keybinds", "KismetDebuggerMod", "EventViewerMod", "LineTraceMod", "jsbLuaProfilerMod", "BPModLoaderMod", "ConsoleEnabler", "CheatManagerEnabler", "AdjustableLights", "Inspect Tools", "ConsoleCommandsMod", "ConsoleEnablerMod", "BPML_GenericFunctions", "CheatManagerEnablerMod", "QModManager.LogFilter"];
const SOURCE_EXT = ['.cs', '.csproj', '.sln', '.h', '.inl', '.ubt', '.ubf', '.ush', '.cpp', '.hpp'];

window.onload = () => {
    const params = new URLSearchParams(window.location.search);
    const logUrl = params.get('log');
    if (logUrl) {
        fetch(logUrl)
            .then(res => res.text())
            .then(data => processLog(data))
            .catch(err => console.error("Auto-fetch failed:", err));
    }
};

document.getElementById('logInput').addEventListener('change', (e) => {
    if (!e.target.files.length) return;
    const reader = new FileReader();
    reader.onload = (e) => processLog(e.target.result);
    reader.readAsText(e.target.files[0]);
});

function processLog(content) {
    const lines = content.split(/\r?\n/);
    let data = { 
        env: "Unknown", 
        isLegacy: false, 
        mods: new Map(), 
        errors: [], 
        warnings: [], 
        updates: [], 
        versions: { bep: null, naut: null, ue4ss: null }, 
        sourceWarnings: [] 
    };

    // Detection Tree
    if (content.includes("UE4SS")) {
        data.env = "Subnautica 2 (UE4SS)";
        parseUE4SS(lines, data);
    } else if (content.includes("QModManager") || content.includes("SMLHelper")) {
        data.env = "Subnautica 1 (Legacy)";
        data.isLegacy = true;
        parseLegacy(lines, data);
    } else if (content.includes("BepInEx")) {
        data.env = content.includes("SubnauticaZero") ? "Below Zero (Stable)" : "Subnautica 1 (Stable)";
        parseBepInEx(lines, data);
    }

    // Common Error/Warning detection across all environments
    lines.forEach(line => {
        const lower = line.toLowerCase();
        if (lower.includes("error")) data.errors.push(line);
        if (lower.includes("warning")) data.warnings.push(line);
    });

    render(data);
}

// --- Parsing Trees ---

function parseUE4SS(lines, data) {
    lines.forEach(line => {
        if (line.includes("Starting C++ mod")) {
            let m = line.split("'")[1];
            if (m && !EXCLUDED_MODS.includes(m)) data.mods.set(m, "C++ Mod");
        } else if (line.includes("[Lua]")) {
            let m = line.split("[Lua]")[1]?.split("]")[0].trim();
            if (m && !EXCLUDED_MODS.includes(m) && !m.includes("Status")) data.mods.set(m, "Lua Mod");
        } else if (line.includes("SDF folder found in mod")) {
            let m = line.split("mod ")[1]?.trim();
            if (m && !EXCLUDED_MODS.includes(m)) data.mods.set(m, "SDF Mod");
        }
    });
}

function parseLegacy(lines, data) {
    lines.forEach(line => {
        // Pattern 1: Standard load
        if (line.includes("Loaded mod:")) {
            let m = line.split("Loaded mod:")[1]?.trim();
            if (m && !EXCLUDED_MODS.includes(m)) data.mods.set(m, "Enabled (QMod)");
        }
        // Pattern 2: SMLHelper/QMod Debug load
        else if (line.includes("[QModManager:DEBUG]") && line.includes("ready to load")) {
            // This captures the mod name if it follows the "ready to load" string
            let m = line.split("ready to load")[0].split("]").pop().trim();
            if (m && !EXCLUDED_MODS.includes(m)) data.mods.set(m, "Debug (QMod)");
        }
    });
}
function parseBepInEx(lines, data) {
    lines.forEach(line => {
        // This looks for "Loading [" and captures everything until the closing "]"
        // It handles names like "Propulsion Cannon Plugin 1.0.0" and "Hydra 1.1.0"
        const match = line.match(/Loading\s+\[(.*?)\]/i);
        
        if (match && match[1]) {
            let modName = match[1].trim();
            
            // Filter out internal BepInEx noise
            if (modName && !EXCLUDED_MODS.includes(modName) && !EXCLUDED_PRELOADERS.includes(modName)) {
                data.mods.set(modName, "Active (BepInEx)");
            }
        }
        
        // Version extractors
        if (line.includes("BepInEx v")) {
            data.versions.bep = line.split("BepInEx v")[1].split(" ")[0].trim();
        }
        if (line.includes("Nautilus")) {
            // Updated to be more flexible with version number formats
            const nautMatch = line.match(/Nautilus\s*v?([0-9.]+)/i);
            if (nautMatch) data.versions.naut = nautMatch[1];
        }
    });
}
function render(data) {
    document.getElementById('dashboard').style.display = 'block';
    
    let versionHTML = `<li>Environment: ${data.env}</li>`;
    if (data.versions.ue4ss) versionHTML += `<li>UE4SS: ${data.versions.ue4ss}</li>`;
    if (data.versions.bep) versionHTML += `<li>BepInEx: v${data.versions.bep}</li>`;
    if (data.versions.naut) versionHTML += `<li>Nautilus: v${data.versions.naut}</li>`;
    
    document.getElementById('versionList').innerHTML = versionHTML;
    document.getElementById('modList').innerHTML = Array.from(data.mods.entries()).map(([m, t]) => `<li>${m} <strong>[${t}]</strong></li>`).join('');
    document.getElementById('errorList').innerHTML = data.errors.slice(-10).map(e => `<li>${e}</li>`).join('');
    document.getElementById('warnList').innerHTML = [...data.warnings, ...data.sourceWarnings].map(w => `<li>${w}</li>`).join('');
    
    document.getElementById('errorBox').style.display = data.errors.length ? 'block' : 'none';
    document.getElementById('warnBox').style.display = (data.warnings.length || data.sourceWarnings.length) ? 'block' : 'none';
}
