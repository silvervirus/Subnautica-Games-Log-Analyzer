/**
 * Subnautica Log Analyzer - Final Build
 * Features: Environment detection, Nested path source-code protection, 
 * Legacy-aware version checking, and UE4SS mod/enabled.txt support.
 */

const EXCLUDED_PRELOADERS = ["BepInEx.Preloader", "BepInEx.SplashScreen.Patcher.BepInEx5", "Tobey.UnityAudio.Patcher", "Tobey.BepInEx.Timestamp", "Tobey.BZMacProcessFix", "Tobey.Subnautica.ConfigHandler.Patcher", "MirrorInternalLogs", "OpenBoarders", "CC2SkipHelpFilesPatcher", "GamePathLogger", "QModManager.QModPluginGenerator", "QModManager.UnityAudioFixer"];
const EXCLUDED_MODS = ["Keybinds","KismetDebuggerMod", "EventViewerMod", "LineTraceMod", "jsbLuaProfilerMod", "BPModLoaderMod", "ConsoleEnabler", "CheatManagerEnabler", "AdjustableLights", "Inspect Tools", "ConsoleCommandsMod", "ConsoleEnablerMod", "BPML_GenericFunctions", "CheatManagerEnablerMod", "QModManager.LogFilter"];
const SOURCE_EXT = ['.cs', '.csproj', '.sln', '.h', '.inl', '.ubt', '.ubf', '.ush', '.cpp', '.hpp'];

// Event Listener
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
        versions: { bep: null, naut: null }, 
        sourceWarnings: [] 
    };

    // 1. Environment Detection
    if (content.includes("UE4SS")) {
        data.env = "Subnautica 2 (UE4SS)";
    } else if (content.includes("QModManager") || content.includes("SMLHelper")) {
        data.env = "Subnautica 1 (Legacy QMod/SML)";
        data.isLegacy = true;
    } else if (content.includes("BepInEx")) {
        data.env = content.includes("SubnauticaZero") ? "Below Zero (Stable)" : "Subnautica 1 (Stable)";
    }

    // 2. Line-by-Line Parsing
    lines.forEach(line => {
        const lower = line.toLowerCase();
        
        // Errors/Warnings
        if (lower.includes("error")) data.errors.push(line);
        if (lower.includes("warning")) data.warnings.push(line);

        // SN2 Mod Detection
        if (data.env.includes("Subnautica 2")) {
            if (line.includes("Starting C++ mod") || line.includes("Starting Lua mod")) {
                let m = line.split("'")[1];
                if (m && !EXCLUDED_MODS.includes(m)) data.mods.set(m, line.includes("Lua") ? "Lua" : "C++");
            }
            // Catch enabled.txt triggers
            if (line.includes("has enabled.txt, starting mod")) {
                let m = line.split("Mod '")[1]?.split("'")[0];
                if (m && !EXCLUDED_MODS.includes(m)) data.mods.set(m, "Enabled.txt");
            }
        } 
        // BepInEx / Legacy Detection
        else {
            if (line.includes("Loading [")) {
                let m = line.split("Loading [")[1]?.split("]")[0].split(" ")[0];
                if (m && !EXCLUDED_MODS.includes(m)) data.mods.set(m, "Active");
            }
            if (line.includes("BepInEx v")) data.versions.bep = line.split("v")[1].split(" ")[0].trim();
            if (line.includes("Nautilus")) data.versions.naut = line.match(/Nautilus\s*v?([0-9.]+)/i)?.[1];
        }

        // Nested Path Security Check
        const pathMatch = line.match(/[a-zA-Z0-9_\-\\]+\\[a-zA-Z0-9_\-\\]+\.[a-z0-9]+/i);
        if (pathMatch && SOURCE_EXT.some(ext => pathMatch[0].toLowerCase().endsWith(ext))) {
            if (lower.includes('\\mods\\') || lower.includes('\\plugins\\')) {
                data.sourceWarnings.push(`Source code incorrectly placed: ${pathMatch[0]}`);
            }
        }
    });

    // 3. Automated Version Compliance (Legacy Bypassed)
    if (!data.isLegacy && data.env !== "Subnautica 2 (UE4SS)") {
        if (data.versions.bep && data.versions.bep < "5.4.23.5") 
            data.updates.push(`BepInEx engine is outdated (${data.versions.bep}). Upgrade to 5.4.23.5.`);
        if (data.versions.naut && data.versions.naut < "1.0.0.51") 
            data.updates.push(`Nautilus framework is outdated (${data.versions.naut}). Upgrade to 1.0.0.51.`);
    }

    render(data);
}

function render(data) {
    document.getElementById('dashboard').style.display = 'block';
    
    // Versions Output
    let vList = `<li>Environment: ${data.env}</li>`;
    if (data.versions.bep) vList += `<li>BepInEx: v${data.versions.bep}</li>`;
    if (data.versions.naut) vList += `<li>Nautilus: v${data.versions.naut}</li>`;
    document.getElementById('versionList').innerHTML = vList;

    // Mod List Output
    document.getElementById('modList').innerHTML = Array.from(data.mods.entries()).map(([m, t]) => `<li>${m} <strong>[${t}]</strong></li>`).join('');
    
    // Error/Warning/Update Lists
    document.getElementById('errorList').innerHTML = data.errors.slice(-10).map(e => `<li>${e}</li>`).join('');
    document.getElementById('warnList').innerHTML = [...data.warnings, ...data.sourceWarnings].map(w => `<li>${w}</li>`).join('');
    document.getElementById('updateList').innerHTML = data.updates.map(u => `<li>${u}</li>`).join('');

    // Toggle Box Visibility
    document.getElementById('errorBox').style.display = data.errors.length ? 'block' : 'none';
    document.getElementById('warnBox').style.display = (data.warnings.length || data.sourceWarnings.length) ? 'block' : 'none';
    document.getElementById('updateBox').style.display = data.updates.length ? 'block' : 'none';
}