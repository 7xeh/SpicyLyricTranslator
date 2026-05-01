export const styles = `
@keyframes spicy-translate-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

#TranslateToggle.loading svg {
    animation: spicy-translate-spin 1s linear infinite;
}

#TranslateToggle.active svg {
    color: var(--spice-button-active, #1db954);
}

#TranslateToggle.error svg {
    color: #e74c3c;
}

#TranslateToggle.error {
    animation: spicy-translate-shake 0.5s ease-in-out;
}

@keyframes spicy-translate-shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-3px); }
    40%, 80% { transform: translateX(3px); }
}

.spicy-translate-settings {
    padding: 16px;
}

.spicy-translate-settings .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--spice-misc, #535353);
}

.spicy-translate-settings .setting-item:last-child {
    border-bottom: none;
}

.spicy-translate-settings .setting-label {
    font-weight: 500;
}

.spicy-translate-settings .setting-description {
    font-size: 12px;
    color: var(--spice-subtext, #b3b3b3);
    margin-top: 4px;
}

.spicy-translate-settings select,
.spicy-translate-settings input[type="text"],
.spicy-translate-settings button {
    padding: 8px 16px;
    border-radius: 4px;
    border: none;
    background: var(--spice-button, #535353);
    color: var(--spice-text, #fff);
    cursor: pointer;
    font-size: 14px;
}

.spicy-translate-settings input[type="text"] {
    min-width: 200px;
}

.spicy-translate-settings select:hover,
.spicy-translate-settings button:hover {
    background: var(--spice-button-active, #1db954);
    color: #000;
}

.spicy-translate-settings .toggle-switch {
    position: relative;
    width: 48px;
    height: 24px;
    background: var(--spice-button, #535353);
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.2s;
    flex-shrink: 0;
}

.spicy-translate-settings .toggle-switch.active {
    background: var(--spice-button-active, #1db954);
}

.spicy-translate-settings .toggle-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
}

.spicy-translate-settings .toggle-switch.active::after {
    transform: translateX(24px);
}




.line.slt-replace-hidden {
    visibility: hidden !important;
    pointer-events: none !important;
    max-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
}


.slt-replace-line {
    display: block;
    font-size: inherit;
    font-weight: 900;
    padding: 12px 0;
    line-height: 1.1818181818;
    pointer-events: auto;
    cursor: pointer;
    text-align: left;
    white-space: normal;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    word-break: break-word;
    letter-spacing: 0;
    box-sizing: border-box;
    padding-inline-end: 0.25em;
    opacity: var(--Vocal-NotSung-opacity, 0.51);
    filter: blur(var(--BlurAmount, 0px));
    transform-origin: left center;
    transition: all 0.3s cubic-bezier(0.37, 0, 0.63, 1);
    --Vocal-NotSung-opacity: 0.51;
    --Vocal-Active-opacity: 1;
    --Vocal-Sung-opacity: 0.497;
    --DefaultLineScale: 1;
    scale: var(--DefaultLineScale);
    
    --text-shadow-blur-radius: 4px;
    --text-shadow-opacity: 0%;
    text-shadow: 0 0 var(--text-shadow-blur-radius) rgba(255, 255, 255, var(--text-shadow-opacity));
    
    --gradient-degrees: 180deg;
    --gradient-alpha: 0.85;
    --gradient-alpha-end: 0.5;
    --gradient-position: -20%;
    --gradient-offset: 0%;
    color: transparent !important;
    -webkit-text-fill-color: transparent !important;
    background-clip: text !important;
    -webkit-background-clip: text !important;
    background-image: linear-gradient(
        var(--gradient-degrees),
        rgba(255, 255, 255, var(--gradient-alpha)) var(--gradient-position),
        rgba(255, 255, 255, var(--gradient-alpha-end)) calc(var(--gradient-position) + 20% + var(--gradient-offset))
    ) !important;
    background-size: 100% 1.1818181818em;
    background-repeat: repeat-y;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
}

.slt-replace-line.OppositeAligned,
.slt-replace-line.rtl {
    transform-origin: right center;
    text-align: end;
}


.slt-replace-line:has(.slt-replace-word) {
    background-image: none !important;
    color: inherit !important;
    -webkit-text-fill-color: inherit !important;
    background-clip: border-box !important;
    -webkit-background-clip: border-box !important;
    text-shadow: none;
}

.slt-replace-line.slt-vocab-line {
    background-image: none !important;
    color: inherit !important;
    -webkit-text-fill-color: inherit !important;
    background-clip: border-box !important;
    -webkit-background-clip: border-box !important;
    text-shadow: none;
    font-weight: inherit;
}

.slt-sync-translation.slt-interleaved-translation:has(.slt-sync-word),
.slt-interleaved-translation.slt-vocab-line {
    background-image: none !important;
    color: inherit !important;
    -webkit-text-fill-color: inherit !important;
    background-clip: border-box !important;
    -webkit-background-clip: border-box !important;
    text-shadow: none;
}


.slt-replace-word {
    display: inline;
    transform-origin: center center;
    will-change: transform;
    transition: opacity 180ms linear, text-shadow 180ms linear;
    
    --text-shadow-blur-radius: 4px;
    --text-shadow-opacity: 0%;
    text-shadow: 0 0 var(--text-shadow-blur-radius) rgba(255, 255, 255, var(--text-shadow-opacity));
    
    --gradient-degrees: 180deg;
    --gradient-alpha: 0.85;
    --gradient-alpha-end: 0.5;
    --gradient-position: -20%;
    --gradient-offset: 0%;
    color: transparent !important;
    -webkit-text-fill-color: transparent !important;
    background-clip: text !important;
    -webkit-background-clip: text !important;
    background-image: linear-gradient(
        var(--gradient-degrees),
        rgba(255, 255, 255, var(--gradient-alpha)) var(--gradient-position),
        rgba(255, 255, 255, var(--gradient-alpha-end)) calc(var(--gradient-position) + 20% + var(--gradient-offset))
    ) !important;
}


.slt-replace-word.word-notsng {
    opacity: 0.51;
}
.slt-replace-word.word-sung {
    opacity: 0.5;
}
.slt-replace-word.word-active {
    opacity: 1;
}

.slt-replace-line.Active,
.slt-replace-line.active,
.line.Active + .slt-replace-line {
    filter: none !important;
    opacity: var(--Vocal-Active-opacity, 1) !important;
    scale: 1;
    text-shadow: var(--ActiveTextGlowDef) !important;
}

.slt-replace-line.Sung,
.line.Sung + .slt-replace-line {
    --gradient-position: 100% !important;
    opacity: var(--Vocal-Sung-opacity, 0.497);
    scale: var(--DefaultLineScale, 1);
}

.slt-replace-line.NotSung,
.line.NotSung + .slt-replace-line {
    --gradient-position: -20% !important;
    opacity: var(--Vocal-NotSung-opacity, 0.51);
    scale: var(--DefaultLineScale, 1);
}


.slt-replace-line.active .slt-replace-word.word-notsng {
    opacity: 0.51;
}
.slt-replace-line.active .slt-replace-word.word-sung {
    opacity: 1;
}


.slt-replace-line.NotSung:hover,
.slt-replace-line.Sung:hover {
    --gradient-alpha: 0.8;
    --gradient-alpha-end: 0.8;
    opacity: 0.8 !important;
    filter: none;
}


.slt-replace-line.slt-replace-instrumental {
    color: rgba(255, 255, 255, 0.35) !important;
    -webkit-text-fill-color: rgba(255, 255, 255, 0.35) !important;
    background: none !important;
    background-image: none !important;
    font-size: calc(0.35em);
    letter-spacing: 0.3em;
    padding: 8px 0 16px 0;
    cursor: default;
    pointer-events: none;
}


.spicy-pip-wrapper .slt-replace-line {
    padding: 8px 0;
}


.Cinema--Container .slt-replace-line,
#SpicyLyricsPage.ForcedCompactMode .slt-replace-line {
    padding: 14px 0;
}


#SpicyLyricsPage.SidebarMode .slt-replace-line {
    padding: 6px 0;
    font-size: 0.9em;
}

body.SpicySidebarLyrics__Active #SpicyLyricsPage .slt-replace-line {
    padding: 4px 0;
    font-size: 0.8em;
}

.line.spicy-translated {}

.cache-item:hover {
    background: rgba(255, 255, 255, 0.05);
}

.cache-delete-btn {
    opacity: 0.6;
    transition: opacity 0.2s, background 0.2s;
}

.cache-delete-btn:hover {
    opacity: 1;
    background: #e74c3c !important;
}


body.SpicySidebarLyrics__Active #SpicyLyricsPage .slt-interleaved-translation {
    font-size: calc(0.65em * var(--slt-overlay-font-scale, 1));
    margin-top: 2px;
    margin-bottom: 4px;
}

@keyframes slt-ci-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.slt-ci-spinner {
    animation: slt-ci-spin 1s linear infinite;
}

.SLT_ConnectionIndicator {
    display: flex;
    align-items: center;
    margin-right: 8px;
    position: relative;
    z-index: 100;
}

.slt-ci-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 20px;
    background: transparent;
    cursor: pointer;
    transition: background 0.25s ease;
    overflow: visible;
    white-space: nowrap;
}

.slt-ci-button:hover {
    background: rgba(255, 255, 255, 0.07);
}

.slt-ci-dot {
    width: 8px;
    height: 8px;
    min-width: 8px;
    border-radius: 50%;
    background: #555;
    transition: background 0.3s ease, box-shadow 0.3s ease;
    flex-shrink: 0;
}

.slt-ci-dot.slt-ci-connecting {
    background: #888;
    animation: slt-ci-pulse 1.5s ease-in-out infinite;
}

.slt-ci-dot.slt-ci-connected {
    background: #1db954;
    box-shadow: 0 0 6px rgba(29, 185, 84, 0.4);
}

.slt-ci-dot.slt-ci-error {
    background: #e74c3c;
    box-shadow: 0 0 6px rgba(231, 76, 60, 0.4);
}

.slt-ci-dot.slt-ci-great {
    background: #1db954;
    box-shadow: 0 0 6px rgba(29, 185, 84, 0.4);
}

.slt-ci-dot.slt-ci-ok {
    background: #ffe666;
    box-shadow: 0 0 6px rgba(255, 230, 102, 0.35);
}

.slt-ci-dot.slt-ci-bad {
    background: #ff944d;
    box-shadow: 0 0 6px rgba(255, 148, 77, 0.35);
}

.slt-ci-dot.slt-ci-horrible {
    background: #e74c3c;
    box-shadow: 0 0 6px rgba(231, 76, 60, 0.4);
}

@keyframes slt-ci-pulse {
    0%, 100% { opacity: 0.4; transform: scale(0.9); }
    50% { opacity: 1; transform: scale(1.1); }
}

.slt-ci-expanded {
    display: flex;
    align-items: center;
    opacity: 1;
    white-space: nowrap;
}

.slt-ci-stats-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.65rem;
    color: var(--spice-subtext, #b3b3b3);
}

.slt-ci-ping {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 0.62rem;
    font-weight: 600;
    color: var(--spice-text, #fff);
    letter-spacing: -0.01em;
    transition: color 0.3s ease;
}

.slt-ci-ping.slt-ci-great { color: #1db954; }
.slt-ci-ping.slt-ci-ok { color: #ffe666; }
.slt-ci-ping.slt-ci-bad { color: #ff944d; }
.slt-ci-ping.slt-ci-horrible { color: #e74c3c; }

.slt-ci-sep {
    width: 1px;
    height: 10px;
    background: rgba(255, 255, 255, 0.12);
    flex-shrink: 0;
}

.slt-ci-users-count {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--spice-subtext, #b3b3b3);
    font-size: 0.62rem;
    font-weight: 500;
}

.slt-ci-users-count svg {
    opacity: 0.55;
}

body.slt-overlay-active .LyricsContent {}

.spicy-translate-overlay {
    pointer-events: none;
    user-select: none;
    z-index: 10;
}


.slt-interleaved-translation {
    display: block;
    font-size: calc(0.45em * var(--slt-overlay-font-scale, 1));
    font-weight: 900;
    padding: 4px 0 12px 0;
    line-height: 1.1818181818;
    pointer-events: none;
    text-align: left;
    white-space: normal;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    word-break: break-word;
    letter-spacing: 0;
    box-sizing: border-box;
    padding-inline-end: 0.25em;
    opacity: var(--Vocal-NotSung-opacity, 0.51);
    filter: blur(var(--BlurAmount, 0px));
    transform-origin: left center;
    transition: all 0.3s cubic-bezier(0.37, 0, 0.63, 1);
    --Vocal-NotSung-opacity: 0.51;
    --Vocal-Active-opacity: 1;
    --Vocal-Sung-opacity: 0.497;
    --DefaultLineScale: 1;
    scale: var(--DefaultLineScale);
    
    color: rgba(255, 255, 255, 0.85);
}

.slt-interleaved-translation.OppositeAligned,
.slt-interleaved-translation.rtl {
    transform-origin: right center;
    text-align: end;
}


.line.Active + .slt-interleaved-translation,
.slt-interleaved-translation.active,
.slt-interleaved-translation.Active {
    filter: none !important;
    opacity: var(--Vocal-Active-opacity, 1) !important;
    scale: 1;
    text-shadow: var(--ActiveTextGlowDef) !important;
}

  
.line.Sung + .slt-interleaved-translation {
    opacity: var(--Vocal-Sung-opacity, 0.497);
}


.line.NotSung + .slt-interleaved-translation {
    opacity: var(--Vocal-NotSung-opacity, 0.51);
}


.slt-sync-translation.slt-interleaved-translation {
    
    --gradient-degrees: 180deg;
    --gradient-alpha: 0.85;
    --gradient-alpha-end: 0.5;
    --gradient-position: -20%;
    --gradient-offset: 0%;
    
    color: transparent !important;
    -webkit-text-fill-color: transparent !important;
    background-clip: text !important;
    -webkit-background-clip: text !important;
    background-image: linear-gradient(
        var(--gradient-degrees),
        rgba(255, 255, 255, var(--gradient-alpha)) var(--gradient-position),
        rgba(255, 255, 255, var(--gradient-alpha-end)) calc(var(--gradient-position) + 20% + var(--gradient-offset))
    ) !important;
    background-size: 100% 100%;
    background-repeat: no-repeat;
    -webkit-box-decoration-break: slice;
    box-decoration-break: slice;
}


.slt-sync-translation.slt-interleaved-translation.active {
    --gradient-alpha: 0.85;
    --gradient-alpha-end: 0.5;
    filter: none !important;
}

.slt-sync-translation.slt-interleaved-translation.Sung {
    --gradient-position: 100% !important;
    opacity: var(--Vocal-Sung-opacity, 0.497);
}

.slt-sync-translation.slt-interleaved-translation.NotSung {
    --gradient-position: -20% !important;
    opacity: var(--Vocal-NotSung-opacity, 0.51);
}


.line.Sung + .slt-sync-translation.slt-interleaved-translation {
    --gradient-position: 100%;
}


.line.NotSung + .slt-sync-translation.slt-interleaved-translation {
    --gradient-position: -20%;
}


.line.NotSung + .slt-sync-translation.slt-interleaved-translation.active,
.line.Sung + .slt-sync-translation.slt-interleaved-translation.active,
.line.Active + .slt-sync-translation.slt-interleaved-translation {
    filter: blur(0px) !important;
}

.spicy-pip-wrapper .slt-interleaved-overlay .slt-interleaved-translation,
.spicy-pip-wrapper .slt-interleaved-translation {
    font-size: calc(0.82em * var(--slt-overlay-font-scale, 1));
}

.Cinema--Container .slt-interleaved-overlay .slt-interleaved-translation,
.Cinema--Container .slt-interleaved-translation,
#SpicyLyricsPage.ForcedCompactMode .slt-interleaved-overlay .slt-interleaved-translation,
#SpicyLyricsPage.ForcedCompactMode .slt-interleaved-translation {
    font-size: calc(0.88em * var(--slt-overlay-font-scale, 1));
}

#SpicyLyricsPage.SidebarMode .slt-interleaved-overlay .slt-interleaved-translation,
#SpicyLyricsPage.SidebarMode .slt-interleaved-translation {
    font-size: calc(0.78em * var(--slt-overlay-font-scale, 1));
}

body.SpicySidebarLyrics__Active .slt-interleaved-overlay .slt-interleaved-translation,
body.SpicySidebarLyrics__Active .slt-interleaved-translation {
    font-size: calc(0.65em * var(--slt-overlay-font-scale, 1));
    margin-top: 1px;
    margin-bottom: 3px;
}




.slt-sync-line {
    position: relative;
    display: block;
    margin: 8px 0;
    transition: opacity 0.3s ease, filter 0.3s ease;
}


.slt-sync-original {
    display: block;
    line-height: 1.4;
}


.slt-sync-translation {
    display: block;
    font-size: 0.75em;
    margin-top: 4px;
    line-height: 1.3;
}


.slt-sync-word {
    display: inline;
    transform-origin: center center;
    will-change: transform;
    transition: opacity 180ms linear, text-shadow 180ms linear;
    --text-shadow-blur-radius: 4px;
    --text-shadow-opacity: 0%;
    text-shadow: 0 0 var(--text-shadow-blur-radius) rgba(255, 255, 255, var(--text-shadow-opacity));
    --gradient-degrees: 180deg;
    --gradient-alpha: 0.85;
    --gradient-alpha-end: 0.5;
    --gradient-position: -20%;
    --gradient-offset: 0%;
    color: transparent !important;
    -webkit-text-fill-color: transparent !important;
    background-clip: text !important;
    -webkit-background-clip: text !important;
    background-image: linear-gradient(
        var(--gradient-degrees),
        rgba(255, 255, 255, var(--gradient-alpha)) var(--gradient-position),
        rgba(255, 255, 255, var(--gradient-alpha-end)) calc(var(--gradient-position) + 20% + var(--gradient-offset))
    ) !important;
}


.slt-sync-word.slt-word-past,
.slt-sync-word.slt-word-active,
.slt-sync-word.slt-word-future {
    
}

.slt-sync-word.slt-word-future {
    opacity: 0.51;
}

.slt-sync-word.slt-word-past {
    opacity: 0.6;
}

.slt-sync-word.slt-word-active {
    opacity: 1;
}




.slt-sync-line.slt-line-sung {
    filter: blur(calc(var(--BlurAmount, 0px) * 0.8));
}


.slt-sync-line.slt-line-active {
    filter: none;
}


.slt-sync-line.slt-line-notsung {
    filter: blur(calc(var(--BlurAmount, 0px) * 0.8));
}


.slt-lyrics-scroll-container {
    overflow-y: scroll;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none; 
    -ms-overflow-style: none; 
}

.slt-lyrics-scroll-container::-webkit-scrollbar {
    display: none; 
}


#SpicyLyricsPage .SpicyLyricsScrollContainer,
#SpicyLyricsPage .LyricsContent,
.LyricsContainer .LyricsContent {
    scroll-behavior: smooth;
}




.line.Active + .slt-sync-translation {
    opacity: 1 !important;
    filter: none !important;
}

.line.Active + .slt-sync-translation .slt-sync-word.slt-word-active {
    text-shadow: 0 0 var(--text-shadow-blur-radius, 10px) rgba(255, 255, 255, var(--text-shadow-opacity-decimal, 0.5));
}

.line.Active + .slt-sync-translation .slt-sync-word.slt-word-past,
.slt-sync-translation.active .slt-sync-word.slt-word-past,
.slt-sync-translation.Active .slt-sync-word.slt-word-past {
    opacity: 1;
}


.line.Sung + .slt-sync-translation .slt-sync-word {
    --gradient-alpha: 0.5;
    --gradient-alpha-end: 0.35;
}


.line.NotSung + .slt-sync-translation .slt-sync-word {
    --gradient-alpha: 0.85;
    --gradient-alpha-end: 0.5;
}








body.SpicySidebarLyrics__Active .slt-sync-line {
    margin: 4px 0;
}

body.SpicySidebarLyrics__Active .slt-sync-translation {
    font-size: 0.65em;
    margin-top: 2px;
}

body.SpicySidebarLyrics__Active .slt-sync-word.slt-word-active {
    text-shadow: 0 0 6px rgba(255, 255, 255, 0.4);
}


.spicy-pip-wrapper .slt-sync-line {
    margin: 6px 0;
}

.spicy-pip-wrapper .slt-sync-translation {
    font-size: 0.8em;
}


.Cinema--Container .slt-sync-line,
#SpicyLyricsPage.ForcedCompactMode .slt-sync-line {
    margin: 12px 0;
}

.Cinema--Container .slt-sync-translation,
#SpicyLyricsPage.ForcedCompactMode .slt-sync-translation {
    font-size: 0.85em;
    margin-top: 6px;
}

.Cinema--Container .slt-sync-word.slt-word-active,
#SpicyLyricsPage.ForcedCompactMode .slt-sync-word.slt-word-active {
    text-shadow: 
        0 0 15px rgba(255, 255, 255, 0.6),
        0 0 30px rgba(255, 255, 255, 0.4),
        0 0 45px rgba(255, 255, 255, 0.2);
}


body.slt-hide-quality-indicator .slt-quality-indicator {
    display: none !important;
}

body.slt-hide-connection-indicator .SLT_ConnectionIndicator {
    display: none !important;
}

.slt-replace-line,
.slt-interleaved-translation,
.slt-sync-translation {
    position: relative;
}

.slt-quality-indicator {
    position: absolute;
    right: 0;
    bottom: -2px;
    display: inline-flex;
    align-items: center;
    gap: 0;
    padding: 2px 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(6px);
    font-size: 8px;
    font-weight: 500;
    letter-spacing: 0.02em;
    line-height: 1;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease, gap 0.25s ease, padding 0.25s ease, background 0.25s ease;
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.45) !important;
    -webkit-text-fill-color: rgba(255, 255, 255, 0.45) !important;
    background-image: none !important;
    background-clip: border-box !important;
    -webkit-background-clip: border-box !important;
    z-index: 5;
    cursor: default;
}

.slt-replace-line:hover .slt-quality-indicator,
.slt-interleaved-translation:hover .slt-quality-indicator,
.slt-sync-translation:hover .slt-quality-indicator,
.slt-replace-line.active .slt-quality-indicator,
.slt-replace-line.Active .slt-quality-indicator,
.slt-interleaved-translation.active .slt-quality-indicator,
.slt-interleaved-translation.Active .slt-quality-indicator,
.slt-sync-translation.active .slt-quality-indicator,
.slt-sync-translation.Active .slt-quality-indicator {
    opacity: 0.5;
    pointer-events: auto;
}

.slt-quality-indicator:hover {
    opacity: 0.85 !important;
    gap: 4px;
    padding: 2px 7px;
    background: rgba(255, 255, 255, 0.1);
}

.slt-quality-indicator:hover .slt-qi-label {
    max-width: 120px;
    opacity: 1;
}

.slt-qi-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
}

.slt-qi-dot.slt-qi-cached {
    background: #ffe666;
    box-shadow: 0 0 4px rgba(255, 230, 102, 0.35);
}

.slt-qi-dot.slt-qi-fresh {
    background: #1db954;
    box-shadow: 0 0 4px rgba(29, 185, 84, 0.35);
}

.slt-qi-label {
    max-width: 0;
    overflow: hidden;
    opacity: 0;
    transition: max-width 0.3s ease, opacity 0.25s ease;
    color: rgba(255, 255, 255, 0.55) !important;
    -webkit-text-fill-color: rgba(255, 255, 255, 0.55) !important;
    background-image: none !important;
    background-clip: border-box !important;
    -webkit-background-clip: border-box !important;
}

body.SpicySidebarLyrics__Active .slt-quality-indicator {
    font-size: 7px;
    padding: 1px 3px;
    bottom: -1px;
}

body.SpicySidebarLyrics__Active .slt-qi-dot {
    width: 4px;
    height: 4px;
}

.spicy-pip-wrapper .slt-quality-indicator {
    font-size: 7px;
    padding: 1px 4px;
}

.slt-vocab-line {
    display: flex;
    flex-wrap: wrap;
    gap: 3px 5px;
    align-items: flex-end;
    font-size: 0.55em;
}

.slt-vocab-pair {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    padding: 2px 5px 3px;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1.5px solid rgba(30, 215, 96, 0.25);
    transition: background 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
    cursor: default;
    max-width: 100%;
}

.slt-vocab-pair:hover {
    background: rgba(255, 255, 255, 0.12);
    transform: translateY(-1px);
    border-bottom-color: rgba(30, 215, 96, 0.6);
}

.slt-vocab-translated {
    font-size: 1em;
    font-weight: 700;
    line-height: 1.25;
    white-space: normal;
    word-break: break-word;
    display: inline;
    transform-origin: center center;
    will-change: transform;
    transition: opacity 180ms linear, text-shadow 180ms linear;

    --text-shadow-blur-radius: 4px;
    --text-shadow-opacity: 0%;
    text-shadow: 0 0 var(--text-shadow-blur-radius) rgba(255, 255, 255, var(--text-shadow-opacity));

    --gradient-degrees: 90deg;
    --gradient-alpha: 0.85;
    --gradient-alpha-end: 0.5;
    --gradient-position: -20%;
    --gradient-offset: 0%;
    color: transparent !important;
    -webkit-text-fill-color: transparent !important;
    background-clip: text !important;
    -webkit-background-clip: text !important;
    background-image: linear-gradient(
        var(--gradient-degrees),
        rgba(255, 255, 255, var(--gradient-alpha)) var(--gradient-position),
        rgba(255, 255, 255, var(--gradient-alpha-end)) calc(var(--gradient-position) + 20% + var(--gradient-offset))
    ) !important;
}

.slt-vocab-translated.word-notsng,
.slt-vocab-translated.slt-word-future {
    opacity: 0.51;
}

.slt-vocab-translated.word-sung,
.slt-vocab-translated.slt-word-past {
    opacity: 0.5;
    --gradient-position: 100%;
}

.slt-vocab-translated.word-active,
.slt-vocab-translated.slt-word-active {
    opacity: 1;
}

.slt-vocab-original {
    font-size: 0.65em;
    line-height: 1.15;
    color: rgba(255, 255, 255, 0.3);
    letter-spacing: 0.01em;
    filter: blur(3px);
    transition: filter 0.25s ease, color 0.25s ease;
    user-select: none;
    white-space: normal;
    word-break: break-word;
    margin-top: 1px;
}

.slt-vocab-pair:hover .slt-vocab-original {
    filter: blur(0px);
    color: rgba(255, 255, 255, 0.65);
}

.active .slt-vocab-original,
.Active .slt-vocab-original,
.slt-interleaved-translation.active .slt-vocab-original {
    filter: blur(0px);
    color: rgba(255, 255, 255, 0.5);
}

.spicy-pip-wrapper .slt-vocab-pair {
    padding: 1px 3px 2px;
    border-bottom-width: 1px;
}

.spicy-pip-wrapper .slt-vocab-line {
    font-size: 0.5em;
}

.spicy-pip-wrapper .slt-vocab-original {
    font-size: 0.55em;
}

@media (prefers-reduced-motion: reduce) {
    .slt-vocab-original {
        filter: none !important;
    }
}
`;

import { getOverlayStyles } from '../utils/translationOverlay';

export function injectStyles(): void {
    const existingStyle = document.getElementById('spicy-lyric-translator-styles');
    if (existingStyle) {
        return;
    }

    const styleElement = document.createElement('style');
    styleElement.id = 'spicy-lyric-translator-styles';
    styleElement.textContent = styles + getOverlayStyles();
    document.head.appendChild(styleElement);
}

export function removeStyles(): void {
    const styleElement = document.getElementById('spicy-lyric-translator-styles');
    if (styleElement) {
        styleElement.remove();
    }
}

export default { styles, injectStyles, removeStyles };
