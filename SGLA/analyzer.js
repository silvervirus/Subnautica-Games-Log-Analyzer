const EXCLUDED_PRELOADERS = ["BepInEx.Preloader", "BepInEx.SplashScreen.Patcher.BepInEx5", "Tobey.UnityAudio.Patcher", "Tobey.BepInEx.Timestamp", "Tobey.BZMacProcessFix", "Tobey.Subnautica.ConfigHandler.Patcher", "MirrorInternalLogs", "OpenBoarders", "CC2SkipHelpFilesPatcher", "GamePathLogger", "QModManager.QModPluginGenerator", "QModManager.UnityAudioFixer"];
const EXCLUDED_MODS = ["Keybinds", "KismetDebuggerMod", "EventViewerMod", "LineTraceMod", "jsbLuaProfilerMod", "BPModLoaderMod", "ConsoleEnabler", "CheatManagerEnabler", "AdjustableLights", "Inspect Tools", "ConsoleCommandsMod", "ConsoleEnablerMod", "BPML_GenericFunctions", "CheatManagerEnablerMod", "QModManager.LogFilter"];
const SOURCE_EXT = ['.cs', '.csproj', '.sln', '.h', '.inl', '.ubt', '.ubf', '.ush', '.cpp', '.hpp'];

document.addEventListener('DOMContentLoaded', () => {
    // Handle File Upload
    const logInput = document.getElementById('logInput');
    logInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const reader = new FileReader();
            reader.onload = (event) => processLog(event.target.result);
            reader.readAsText(e.target.files[0]);
        }
    });

    // Handle URL Params
    const params = new URLSearchParams(window.location.search);
    const logUrl = params.get('log');
    if (logUrl) {
        fetch(logUrl)
            .then(res => res.text())
            .then(data => processLog(data))
            .catch(err => console.error("Auto-fetch failed:", err));
    }
});

function processLog(content) {
    try {
        const lowerContent = content.toLowerCase();
        const lines = content.split(/\r?\n/);
        let data = { 
            env: "Unknown", 
            isLegacy: false,
            mods: new Map(), 
            errors: [], 
            warnings: [], 
            versions: { bep: null, naut: null, ue4ss: null }, 
            sourceWarnings: [] 
        };

        if (lowerContent.includes("bepinex") || lowerContent.includes("nautilus")) {
            data.env = (lowerContent.includes("subnauticazero") || lowerContent.includes("belowzero")) 
                ? "Below Zero (Stable)" 
                : "Subnautica 1 (Stable)";
               data.isLegacy = false;
            parseBepInEx(lines, data);
        } else if (lowerContent.includes("ue4ss")) {
            data.env = "Subnautica 2 (UE4SS)";
            parseUE4SS(lines, data);
        }  else if (lowerContent.includes("qmodmanager") || lowerContent.includes("smlhelper")) {
            data.env = "Subnautica 1 (Legacy)";
           data.isLegacy = true;
            parseLegacy(lines, data);
        } 

        lines.forEach(line => {
            const lower = line.toLowerCase();
            if (lower.includes("error")) data.errors.push(line);
            if (lower.includes("warning")) data.warnings.push(line);
        });

        render(data);
    } catch (err) {
        console.error("Critical Processing Error:", err);
    }
}

function parseUE4SS(lines, data) {
    lines.forEach(line => {
        if (line.includes("Starting C++ mod")) {
            let m = line.split("'")[1];
            if (m && !EXCLUDED_MODS.includes(m)) data.mods.set(m, "C++ Mod");
        } else if (line.includes("[Lua]")) {
            let m = line.split("[Lua]")[1]?.split("]")[0].trim();
            if (m && !EXCLUDED_MODS.includes(m) && !m.includes("Status")) data.mods.set(m, "Lua Mod");
        }
    });
}

function parseLegacy(lines, data) {
    lines.forEach(line => {
        if (line.includes("Loaded mod:")) {
            let m = line.split("Loaded mod:")[1]?.trim();
            if (m && !EXCLUDED_MODS.includes(m)) data.mods.set(m, "Enabled (QMod)");
        }
    });
}

function parseBepInEx(lines, data) {
    lines.forEach(line => {
        const match = line.match(/Loading\s+\[([^\]]+)\]/i);
        if (match && match[1] && !EXCLUDED_MODS.includes(match[1]) && !EXCLUDED_PRELOADERS.includes(match[1])) {
            data.mods.set(match[1].trim(), "Active (BepInEx)");
        }
        if (line.includes("BepInEx v")) {
            const bepMatch = line.match(/BepInEx\s+v([0-9.]+)/i);
            if (bepMatch) data.versions.bep = bepMatch[1];
        }
        if (line.includes("Nautilus")) {
            const nautMatch = line.match(/Nautilus\s+v?([0-9.]+)/i);
            if (nautMatch) data.versions.naut = nautMatch[1];
        }
    });
}

function render(data) {
    document.getElementById('dashboard').style.display = 'block';
    
    // Versions
    let versionHTML = `<li>Environment: ${data.env}</li>`;
    if (data.versions.bep) versionHTML += `<li>BepInEx: v${data.versions.bep}</li>`;
    if (data.versions.naut) versionHTML += `<li>Nautilus: v${data.versions.naut}</li>`;
    document.getElementById('versionList').innerHTML = versionHTML;

    // Mods
    document.getElementById('modList').innerHTML = Array.from(data.mods.entries())
        .map(([m, t]) => `<li>${m} <strong>[${t}]</strong></li>`).join('');
    
    // Errors/Warnings
    const errorList = document.getElementById('errorList');
    errorList.innerHTML = data.errors.slice(-10).map(e => `<li>${e}</li>`).join('');
    document.getElementById('errorBox').style.display = data.errors.length ? 'block' : 'none';

    const warnList = document.getElementById('warnList');
    warnList.innerHTML = data.warnings.slice(-20).map(w => `<li>${w}</li>`).join('');
    document.getElementById('warnBox').style.display = data.warnings.length ? 'block' : 'none';
}
