const EXCLUDED_PRELOADERS = ["BepInEx.Preloader", "BepInEx.SplashScreen.Patcher.BepInEx5", "Tobey.UnityAudio.Patcher", "Tobey.BepInEx.Timestamp", "Tobey.BZMacProcessFix", "Tobey.Subnautica.ConfigHandler.Patcher", "MirrorInternalLogs", "OpenBoarders", "CC2SkipHelpFilesPatcher", "GamePathLogger", "QModManager.QModPluginGenerator", "QModManager.UnityAudioFixer"];
const EXCLUDED_MODS = ["Keybinds", "KismetDebuggerMod", "EventViewerMod", "LineTraceMod", "jsbLuaProfilerMod", "BPModLoaderMod", "ConsoleEnabler", "CheatManagerEnabler", "AdjustableLights", "Inspect Tools", "ConsoleCommandsMod", "ConsoleEnablerMod", "BPML_GenericFunctions", "CheatManagerEnablerMod", "QModManager.LogFilter"];
const SOURCE_EXT = ['.cs', '.csproj', '.sln', '.h', '.inl', '.ubt', '.ubf', '.ush', '.cpp', '.hpp'];

document.addEventListener('DOMContentLoaded', () => {
    const logInput = document.getElementById('logInput');
    const logTypeSelect = document.getElementById('logType'); // Assuming ID "logType"

    logInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const reader = new FileReader();
            // Pass the user's selected log type as an argument
            reader.onload = (event) => processLog(event.target.result, logTypeSelect.value);
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

function processLog(content, mode = "auto") {
    try {
        const lowerContent = content.toLowerCase();
        const lines = content.split(/\r?\n/);
        
        // Ensure this object is defined correctly
        let data = { 
            isLegacy: false,
            isSub2: false,
            isSub: false,
            isSubBZ: false,
            env: "Unknown",
            mods: new Map(), 
            errors: [], 
            warnings: [], 
            versions: { bep: null, naut: null, ue4ss: null }, 
            sourceWarnings: [] 
        };

       // ADDED: Logic Gate
if (mode === "stable") {
    data.env = "Subnautica Stable";
    data.isSub = true;
    parseBepInEx(lines, data);
} else if (mode === "stableBZ") { // Changed to else if
    data.env = "Subnautica Below Zero Stable";
    data.isSubBZ = true;
    parseBepInEx(lines, data);
} else if (mode === "ue4ss") {
    data.env = "Subnautica 2 (UE4SS)";
    data.isSub2 = true;
    parseUE4SS(lines, data);
} else if (mode === "legacy") {
    data.env = "Subnautica 1 (Legacy)";
    data.isLegacy = true;
    parseLegacy(lines, data);
} else {
    // Original Auto-detection logic
    if ((lowerContent.includes("qmodmanager") || lowerContent.includes("smlhelper")) && !lowerContent.includes("bepinex")) {
        data.env = "Subnautica 1 (Legacy)";
        data.isLegacy = true;
        parseLegacy(lines, data);
    } else if (lowerContent.includes("ue4ss")) {
        data.env = "Subnautica 2 (UE4SS)";
        data.isSub2 = true;
        parseUE4SS(lines, data);
    } else if (lowerContent.includes("bepinex") || lowerContent.includes("nautilus")) {
        if (lowerContent.includes("subnauticazero") || lowerContent.includes("belowzero")) {
            data.env = "Subnautica BelowZero (Stable)";
            data.isSubBZ = true;
        } else {
            data.env = "Subnautica 1 (Stable)";
            data.isSub = true;
        }
        parseBepInEx(lines, data);
    }
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
        // Existing C++ mod detection
        if (line.includes("Starting C++ mod")) {
            let m = line.split("'")[1];
            if (m && !EXCLUDED_MODS.includes(m)) data.mods.set(m, "C++ Mod");
        } 
        // Existing Lua mod detection
        else if (line.includes("[Lua]")) {
            let m = line.split("[Lua]")[1]?.split("]")[0].trim();
            if (m && !EXCLUDED_MODS.includes(m) && !m.includes("Status")) data.mods.set(m, "Lua Mod");
        }
        // ADDED: SDF Mod detection
        else if (line.includes("[SDF]")) {
            // Extracts the mod name, e.g., "MoreIngots" from "[SDF]: SDF folder found in mod Moreingots"
            // This assumes the format: [timestamp] [SDF]: ... in mod [Name]
            if (line.toLowerCase().includes("in mod")) {
                let m = line.split("in mod")[1].trim().split(" ")[0]; // Gets the word after "in mod"
                if (m) data.mods.set(`${m} [SDF]`, "SDF Mod");
            }
        }
    });
}

function parseLegacy(lines, data) {
       lines.forEach(line => {
        const match = line.match(/Loading\s+\[([^\]]+)\]/i);
        if (match && match[1] && !EXCLUDED_MODS.includes(match[1]) && !EXCLUDED_PRELOADERS.includes(match[1])) {
            data.mods.set(match[1].trim(), "Active (Qmods)");
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
