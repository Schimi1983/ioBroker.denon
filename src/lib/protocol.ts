/**
 * Pure helpers to parse Denon/Marantz telnet protocol lines.
 * No ioBroker dependencies, so everything here is unit testable.
 */

/** Mapping state id suffix -> protocol channel code */
export const CHANNEL_VOLUME_MAPPINGS = {
    FrontLeft: 'FL',
    FrontRight: 'FR',
    Center: 'C',
    SurroundRight: 'SR',
    SurroundLeft: 'SL',
    SurroundDolbyRight: 'SDR',
    SurroundDolbyLeft: 'SDL',
    FrontDolbyLeft: 'FDL',
    FrontDolbyRight: 'FDR',
    FrontHeightLeft: 'FHL',
    FrontHeightRight: 'FHR',
    RearHeightLeft: 'RHL',
    RearHeightRight: 'RHR',
    SurroundHeightRight: 'SHR',
    SurroundHeightLeft: 'SHL',
    Subwoofer: 'SW',
    SubwooferTwo: 'SW2',
    SubwooferThree: 'SW3',
    SubwooferFour: 'SW4',
    SurroundBackLeft: 'SBL',
    SurroundBackRight: 'SBR',
    SurroundBack: 'SB',
    FrontWideLeft: 'FWL',
    FrontWideRight: 'FWR',
    TopFrontLeft: 'TFL',
    TopFrontRight: 'TFR',
    TopMiddleLeft: 'TML',
    TopMiddleRight: 'TMR',
    TopRearLeft: 'TRL',
    TopRearRight: 'TRR',
    BackDolbyLeft: 'BDL',
    BackDolbyRight: 'BDR',
    TopSurround: 'TS',
    CenterHeight: 'CH',
    TactileTransducer: 'TTR',
} as const satisfies Record<string, string>;

/** Protocol channel code -> state id suffix */
export const CHANNEL_VOLUME_REMAPPING: Readonly<Record<string, string>> = Object.fromEntries(
    Object.entries(CHANNEL_VOLUME_MAPPINGS).map(([id, code]) => [code, id]),
);

/**
 * Parses a volume parameter of the MV/Zx commands.
 * Whole dB steps use two digits, half dB steps three digits: "80" -> 80, "805" -> 80.5, "005" -> 0.5.
 *
 * @param param parameter part of the response, e.g. "455"
 * @returns the volume on the 0..98 scale or undefined if the parameter is not numeric
 */
export function parseVolume(param: string): number | undefined {
    const p = param.trim();
    if (!/^\d{2,3}$/.test(p)) {
        return undefined;
    }
    return p.length === 3 ? parseInt(p, 10) / 10 : parseInt(p, 10);
}

/**
 * Formats a volume on the 0..98 scale as protocol parameter, rounded to 0.5 steps
 *
 * @param volume volume, e.g. 45.5
 * @param max upper bound (MV allows up to 98)
 */
export function formatVolume(volume: number, max = 98): string {
    let v = Math.round(Math.min(Math.max(volume, 0), max) * 2) / 2;
    if (Number.isNaN(v)) {
        v = 0;
    }
    const whole = Math.floor(v);
    const half = v - whole === 0.5;
    return `${whole.toString().padStart(2, '0')}${half ? '5' : ''}`;
}

/**
 * Converts a level parameter (50 = 0 dB, half steps with three digits) to dB, e.g. "505" -> 0.5, "38" -> -12
 *
 * @param param level parameter
 */
export function levelToDb(param: string): number | undefined {
    const v = parseVolume(param);
    return v === undefined ? undefined : v - 50;
}

/**
 * Converts dB to a level parameter (50 = 0 dB), e.g. 0.5 -> "505", -12 -> "38"
 *
 * @param db level in dB
 */
export function dbToLevel(db: number): string {
    return formatVolume(db + 50, 99);
}

/** Result of parsing a channel volume line */
export type ChannelVolumeResult =
    { type: 'end' } | { type: 'level'; channelCode: string; stateSuffix: string | undefined; db: number };

/**
 * Parses CV responses like "CVFL 50", "CVSW2 455" or the terminator "CVEND"
 *
 * @param line full protocol line
 */
export function parseChannelVolume(line: string): ChannelVolumeResult | undefined {
    if (line === 'CVEND') {
        return { type: 'end' };
    }
    const match = /^CV([A-Z]+\d?)\s+(\d{2,3})$/.exec(line);
    if (!match) {
        return undefined;
    }
    const db = levelToDb(match[2]);
    if (db === undefined) {
        return undefined;
    }
    return { type: 'level', channelCode: match[1], stateSuffix: CHANNEL_VOLUME_REMAPPING[match[1]], db };
}

/** One parsed line of the on screen display (NSE/NSA/NSH) */
export interface DisplayLine {
    /** Line index 0..8 */
    index: number;
    /** Clean text without control characters and padding */
    text: string;
    /** Attribute byte of list lines (1..7), undefined if not present */
    attributes?: number;
}

/** Bit of the attribute byte which marks the line under the cursor */
export const DISPLAY_ATTR_CURSOR = 0x08;
/** Bit of the attribute byte which marks a folder */
export const DISPLAY_ATTR_FOLDER = 0x02;
/** Bit of the attribute byte which marks a playable item */
export const DISPLAY_ATTR_PLAYABLE = 0x01;

/**
 * Removes padding and control characters from display text. Text after the first NUL is padding.
 *
 * @param raw raw text
 */
export function cleanDisplayText(raw: string): string {
    const nul = raw.indexOf('\0');
    const cut = nul === -1 ? raw : raw.substring(0, nul);
    // eslint-disable-next-line no-control-regex
    return cut.replace(/[\x00-\x1f\x7f]/g, '').trimEnd();
}

/**
 * Parses an NSE display line, e.g. "NSE2\u0002Internet Radio      ".
 * Lines 1..7 carry an attribute byte (< 0x20) directly after the index.
 *
 * @param line full protocol line
 */
export function parseDisplayLine(line: string): DisplayLine | undefined {
    const match = /^NS[EA](\d)([\s\S]*)$/.exec(line);
    if (!match) {
        return undefined;
    }
    const index = parseInt(match[1], 10);
    let payload = match[2];
    let attributes: number | undefined;
    if (index >= 1 && index <= 7 && payload.length && payload.charCodeAt(0) < 0x20) {
        attributes = payload.charCodeAt(0);
        payload = payload.substring(1);
    }
    return { index, text: cleanDisplayText(payload), attributes };
}

/**
 * Splits a line of the form PREFIX + parameter, e.g. ("STBY30M", "STBY") -> "30M", ("PSDRC AUTO", "PSDRC") -> "AUTO"
 *
 * @param line full protocol line
 * @param prefix command prefix
 * @returns the trimmed parameter or undefined if the prefix does not match
 */
export function paramOf(line: string, prefix: string): string | undefined {
    if (!line.startsWith(prefix)) {
        return undefined;
    }
    return line.substring(prefix.length).trim();
}

/** Parsed SSINF (signal information) response */
export interface SignalInfo {
    /** Info key, e.g. "AISFSV" (sampling frequency), "AISSIG" (signal type), "SIGRES" (resolution) */
    key: string;
    /** Raw value, e.g. "48K" */
    value: string;
}

/**
 * Parses signal information responses like "SSINFAISFSV 48K"
 *
 * @param line full protocol line
 */
export function parseSignalInfo(line: string): SignalInfo | undefined {
    const match = /^SSINF([A-Z0-9]+)\s+(.*)$/.exec(line);
    return match ? { key: match[1], value: match[2].trim() } : undefined;
}

/**
 * Formats the sleep timer parameter (3 digits, 1..120 minutes or OFF)
 *
 * @param minutes 0 = off
 */
export function formatSleepTimer(minutes: number): string | undefined {
    if (!minutes) {
        return 'OFF';
    }
    if (minutes < 0 || minutes > 120) {
        return undefined;
    }
    return Math.round(minutes).toString().padStart(3, '0');
}
