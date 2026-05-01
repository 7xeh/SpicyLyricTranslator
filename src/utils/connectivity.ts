import { storage } from './storage';

const API_BASE = 'https://7xeh.dev/apps/spicylyrictranslate/api/connectivity.php';
const CLIENT_ID_KEY = 'client-id';

function getOrCreateClientId(): string {
    let clientId = storage.get(CLIENT_ID_KEY);
    if (!clientId) {
        clientId = crypto.randomUUID?.() ?? 
            (Array.from(crypto.getRandomValues(new Uint8Array(16)))
                .map(b => b.toString(16).padStart(2, '0')).join(''));
        storage.set(CLIENT_ID_KEY, clientId);
    }
    return clientId;
}
const HEARTBEAT_INTERVAL = 30000;
const LATENCY_CHECK_INTERVAL = 15000;
const CONNECTION_TIMEOUT = 5000;
const INITIAL_DELAY = 3000;
const LATENCY_SAMPLES = 3;
const SAMPLE_DELAY = 500;

const LATENCY_THRESHOLDS = {
    GREAT: 150,
    OK: 300,
    BAD: 500,
} as const;

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

interface ConnectionIndicatorState {
    state: ConnectionState;
    sessionId: string | null;
    latencyMs: number | null;
    totalUsers: number;
    region: string;
    lastHeartbeat: number;
    isInitialized: boolean;
}

const indicatorState: ConnectionIndicatorState = {
    state: 'disconnected',
    sessionId: null,
    latencyMs: null,
    totalUsers: 0,
    region: '',
    lastHeartbeat: 0,
    isInitialized: false
};

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let latencyInterval: ReturnType<typeof setInterval> | null = null;

let containerElement: HTMLElement | null = null;

function getLatencyClass(latencyMs: number): string {
    if (latencyMs <= LATENCY_THRESHOLDS.GREAT) return 'slt-ci-great';
    if (latencyMs <= LATENCY_THRESHOLDS.OK) return 'slt-ci-ok';
    if (latencyMs <= LATENCY_THRESHOLDS.BAD) return 'slt-ci-bad';
    return 'slt-ci-horrible';
}

function createIndicatorElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'SLT_ConnectionIndicator';
    container.innerHTML = `
        <div class="slt-ci-button" aria-label="Connection Status">
            <div class="slt-ci-dot"></div>
            <div class="slt-ci-expanded">
                <div class="slt-ci-stats-row">
                    <span class="slt-ci-ping" aria-label="Round-trip latency to SLT server">--ms</span>
                    <span class="slt-ci-sep"></span>
                    <span class="slt-ci-users-count slt-ci-total" aria-label="Total users with extension installed">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        <span class="slt-ci-total-count">0</span>
                    </span>
                </div>
            </div>
        </div>
    `;
    return container;
}

function updateUI(): void {
    if (!containerElement) return;
    
    const button = containerElement.querySelector('.slt-ci-button');
    const dot = containerElement.querySelector('.slt-ci-dot');
    const pingEl = containerElement.querySelector('.slt-ci-ping');
    const totalCountEl = containerElement.querySelector('.slt-ci-total-count');
    
    if (!button || !dot) return;

    dot.classList.remove('slt-ci-connecting', 'slt-ci-connected', 'slt-ci-error', 'slt-ci-great', 'slt-ci-ok', 'slt-ci-bad', 'slt-ci-horrible');

    switch (indicatorState.state) {
        case 'connected':
            dot.classList.add('slt-ci-connected');
            if (indicatorState.latencyMs !== null) {
                dot.classList.add(getLatencyClass(indicatorState.latencyMs));
                if (pingEl) {
                    pingEl.textContent = `${indicatorState.latencyMs}ms`;
                    pingEl.className = `slt-ci-ping ${getLatencyClass(indicatorState.latencyMs)}`;
                }
            }
            if (totalCountEl) totalCountEl.textContent = `${indicatorState.totalUsers}`;
            button.setAttribute('aria-label', `Connected · ${indicatorState.latencyMs}ms · ${indicatorState.totalUsers} installed`);
            break;

        case 'connecting':
        case 'reconnecting':
            dot.classList.add('slt-ci-connecting');
            if (pingEl) { pingEl.textContent = '--ms'; pingEl.className = 'slt-ci-ping'; }
            button.setAttribute('aria-label', 'Connecting...');
            break;

        case 'error':
            dot.classList.add('slt-ci-error');
            if (pingEl) { pingEl.textContent = 'ERR'; pingEl.className = 'slt-ci-ping slt-ci-horrible'; }
            button.setAttribute('aria-label', 'Connection error — retrying...');
            break;

        case 'disconnected':
        default:
            if (pingEl) { pingEl.textContent = '--ms'; pingEl.className = 'slt-ci-ping'; }
            button.setAttribute('aria-label', 'Disconnected');
            break;
    }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = CONNECTION_TIMEOUT): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function measureLatency(): Promise<number | null> {
    try {
        const startTime = performance.now();
        const response = await fetchWithTimeout(`${API_BASE}?action=ping&_=${Date.now()}`);
        if (!response.ok) return null;
        await response.json();
        return Math.round(performance.now() - startTime);
    } catch (error) {
        return null;
    }
}

async function measureLatencyAccurate(): Promise<number | null> {
    const samples: number[] = [];
    
    for (let i = 0; i < LATENCY_SAMPLES; i++) {
        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, SAMPLE_DELAY));
        }
        const latency = await measureLatency();
        if (latency !== null) {
            samples.push(latency);
        }
    }
    
    if (samples.length === 0) return null;
    if (samples.length === 1) return samples[0];
    
    samples.sort((a, b) => a - b);
    const trimmed = samples.slice(0, -1);
    
    const avg = trimmed.reduce((sum, val) => sum + val, 0) / trimmed.length;
    return Math.round(avg);
}

async function sendHeartbeat(): Promise<boolean> {
    try {
        const params = new URLSearchParams({
            action: 'heartbeat',
            session: indicatorState.sessionId || '',
            version: storage.get('extension-version') || '1.0.0',
            clientId: getOrCreateClientId()
        });

        const response = await fetchWithTimeout(`${API_BASE}?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        if (data.success) {
            indicatorState.sessionId = data.sessionId || indicatorState.sessionId;
            indicatorState.totalUsers = data.totalUsers || 0;
            indicatorState.region = data.region || '';
            indicatorState.lastHeartbeat = Date.now();
            
            if (indicatorState.state !== 'connected') {
                indicatorState.state = 'connected';
                updateUI();
            }
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

async function connect(): Promise<boolean> {
    indicatorState.state = 'connecting';
    updateUI();

    try {
        const params = new URLSearchParams({
            action: 'connect',
            version: storage.get('extension-version') || '1.0.0',
            clientId: getOrCreateClientId()
        });

        const response = await fetchWithTimeout(`${API_BASE}?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (data.success) {
            indicatorState.sessionId = data.sessionId;
            indicatorState.totalUsers = data.totalUsers || 0;
            indicatorState.region = data.region || '';
            indicatorState.state = 'connected';
            indicatorState.lastHeartbeat = Date.now();
            
            setTimeout(async () => {
                const latency = await measureLatencyAccurate();
                if (latency !== null) {
                    indicatorState.latencyMs = latency;
                    updateUI();
                }
            }, 1000);
            
            updateUI();
            return true;
        }
        throw new Error('Connection failed');
    } catch (error) {
        const isAbortError = error instanceof Error && error.name === 'AbortError';
        if (!isAbortError) {
        }
        indicatorState.state = 'error';
        updateUI();
        
        setTimeout(() => {
            if (indicatorState.state === 'error') {
                indicatorState.state = 'reconnecting';
                updateUI();
                connect();
            }
        }, 5000);
        
        return false;
    }
}

async function disconnect(): Promise<void> {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    if (latencyInterval) {
        clearInterval(latencyInterval);
        latencyInterval = null;
    }

    if (indicatorState.sessionId) {
        try {
            const params = new URLSearchParams({
                action: 'disconnect',
                session: indicatorState.sessionId
            });
            await fetch(`${API_BASE}?${params}`);
        } catch (e) {}
    }

    indicatorState.state = 'disconnected';
    indicatorState.sessionId = null;
    indicatorState.latencyMs = null;
    updateUI();
}

function startPeriodicChecks(): void {
    heartbeatInterval = setInterval(async () => {
        const success = await sendHeartbeat();
        if (!success && indicatorState.state === 'connected') {
            indicatorState.state = 'reconnecting';
            updateUI();
            connect();
        }
    }, HEARTBEAT_INTERVAL);

    latencyInterval = setInterval(async () => {
        const latency = await measureLatency();
        if (latency !== null) {
            indicatorState.latencyMs = latency;
            updateUI();
        }
    }, LATENCY_CHECK_INTERVAL);
}

function getIndicatorContainer(): HTMLElement | null {
    const topBarContentRight = document.querySelector('.main-topBar-topbarContentRight');
    if (topBarContentRight) return topBarContentRight as HTMLElement;

    const userWidget = document.querySelector('.main-userWidget-box');
    if (userWidget && userWidget.parentNode) return userWidget.parentNode as HTMLElement;
    
    const historyButtons = document.querySelector('.main-topBar-historyButtons');
    if (historyButtons && historyButtons.parentNode) return historyButtons.parentNode as HTMLElement;

    return null;
}

function waitForElement(selector: string, timeout: number = 10000): Promise<Element | null> {
    return new Promise((resolve) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }
        const observer = new MutationObserver((mutations, obs) => {
            const el = document.querySelector(selector);
            if (el) {
                obs.disconnect();
                resolve(el);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            observer.disconnect();
            resolve(document.querySelector(selector));
        }, timeout);
    });
}

async function appendToDOM(): Promise<boolean> {
    if (containerElement && containerElement.parentNode) return true;

    const container = getIndicatorContainer();
    
    if (container) {
        containerElement = createIndicatorElement();
        container.insertBefore(containerElement, container.firstChild);
        return true;
    }

    const topBarContentRight = await waitForElement('.main-topBar-topbarContentRight');
    if (topBarContentRight) {
        containerElement = createIndicatorElement();
        topBarContentRight.insertBefore(containerElement, topBarContentRight.firstChild);
        return true;
    }
    
    return false;
}

function removeFromDOM(): void {
    if (containerElement && containerElement.parentNode) {
        containerElement.parentNode.removeChild(containerElement);
    }
    containerElement = null;
}

export async function initConnectionIndicator(): Promise<void> {
    if (indicatorState.isInitialized) return;
    
    const appended = await appendToDOM();
    if (!appended) return;

    indicatorState.isInitialized = true;
    
    await new Promise(resolve => setTimeout(resolve, INITIAL_DELAY));
    
    const connected = await connect();
    
    if (connected) {
        startPeriodicChecks();
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (latencyInterval) { clearInterval(latencyInterval); latencyInterval = null; }
        } else {
            if (indicatorState.state === 'connected') {
                latencyInterval = setInterval(async () => {
                    const latency = await measureLatency();
                    if (latency !== null) {
                        indicatorState.latencyMs = latency;
                        updateUI();
                    }
                }, LATENCY_CHECK_INTERVAL);
                
                setTimeout(async () => {
                    const latency = await measureLatencyAccurate();
                    if (latency !== null) {
                        indicatorState.latencyMs = latency;
                        updateUI();
                    }
                }, 500);
            }
        }
    });

    window.addEventListener('beforeunload', () => {
        disconnect();
    });
}

export function cleanupConnectionIndicator(): void {
    disconnect();
    removeFromDOM();
    indicatorState.isInitialized = false;
}

export function getConnectionState(): ConnectionIndicatorState {
    return { ...indicatorState };
}

export async function refreshConnection(): Promise<void> {
    await disconnect();
    await connect();
    if (indicatorState.state === 'connected') {
        startPeriodicChecks();
    }
}

export default {
    init: initConnectionIndicator,
    cleanup: cleanupConnectionIndicator,
    getState: getConnectionState,
    refresh: refreshConnection
};