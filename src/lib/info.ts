/**
 * Objects which are not part of the generic datapoint table: signal information, firmware, device identification,
 * display lines and network presets. They need their own parsing (SSINF, NSE, NSH, Deviceinfo.xml).
 */

/**
 * Plain text of the SSINFAISSIG codes.
 *
 * @KI_HINWEIS: Measured on an AVR-X2200W (2026-10-28, NVIDIA Shield with passthrough). Codes are model specific and
 * not part of the official protocol, unknown codes are shown as "unknown (code)".
 */
export const AUDIO_SIGNAL_TEXT: Readonly<Record<string, string>> = {
    '01': 'No signal / analog',
    '02': 'PCM',
    '03': 'Dolby Digital',
    '04': 'Dolby Digital Plus',
    '05': 'Dolby TrueHD / Atmos',
    '06': 'DTS',
    '08': 'DTS-HD High Resolution',
    '09': 'DTS-HD Master Audio',
    12: 'Switching',
};

/**
 * Plain text of an audio signal code
 *
 * @param code raw SSINFAISSIG value, e.g. "05"
 */
export function audioSignalText(code: string): string {
    return AUDIO_SIGNAL_TEXT[code] ?? `unknown (${code})`;
}

/** Plain text audio signal, filled from the code */
export const AUDIO_SIGNAL_OBJECT: ioBroker.SettableStateObject = {
    type: 'state',
    common: { name: 'Audio input signal', role: 'text', type: 'string', read: true, write: false },
    native: {},
};

/** Queries for signal information (2015+ models) */
export const SIGNAL_INFO_QUERIES = ['SSINFAISSIG ?', 'SSINFAISFSV ?', 'SSINFSIGRES ?'] as const;

/** SSINF key -> state id and object */
export const SIGNAL_INFO_STATES: Record<string, { id: string; obj: ioBroker.SettableStateObject }> = {
    AISSIG: {
        id: 'info.audioSignalCode',
        obj: {
            type: 'state',
            common: {
                name: 'Audio input signal (raw code, model specific)',
                desc: 'AVR-X2200W: 02 PCM, 03 Dolby Digital, 04 Dolby Digital Plus, 05 Dolby TrueHD, 06 DTS, 08 DTS-HD HRA, 09 DTS-HD MA, 12 switching',
                role: 'text',
                type: 'string',
                read: true,
                write: false,
            },
            native: {},
        },
    },
    AISFSV: {
        id: 'info.audioSampleRate',
        obj: {
            type: 'state',
            common: {
                name: 'Audio sample rate',
                role: 'text',
                type: 'string',
                read: true,
                write: false,
            },
            native: {},
        },
    },
    SIGRES: {
        id: 'info.videoResolutionCode',
        obj: {
            type: 'state',
            common: {
                name: 'Video resolution (raw code, model specific)',
                role: 'text',
                type: 'string',
                read: true,
                write: false,
            },
            native: {},
        },
    },
};

/** Decoded video resolution of the HDMI input and output (from SSINFSIGRES) */
export const VIDEO_RESOLUTION_STATES: Record<'input' | 'output', { id: string; obj: ioBroker.SettableStateObject }> = {
    input: {
        id: 'info.videoInputResolution',
        obj: {
            type: 'state',
            common: { name: 'Video input resolution', role: 'text', type: 'string', read: true, write: false },
            native: {},
        },
    },
    output: {
        id: 'info.videoOutputResolution',
        obj: {
            type: 'state',
            common: { name: 'Video output resolution', role: 'text', type: 'string', read: true, write: false },
            native: {},
        },
    },
};

/** Query for the firmware versions, only sent once at startup */
export const FIRMWARE_QUERY = 'SSINFFRM ?';

/** SSINFFRM key -> state id and object (answer e.g. "SSINFFRMAVR 4700-0591-4030") */
export const FIRMWARE_STATES: Record<string, { id: string; obj: ioBroker.SettableStateObject }> = {
    FRMAVR: {
        id: 'info.firmware',
        obj: {
            type: 'state',
            common: { name: 'Firmware version', role: 'info.firmware', type: 'string', read: true, write: false },
            native: {},
        },
    },
    FRMDTS: {
        id: 'info.firmwareDts',
        obj: {
            type: 'state',
            common: { name: 'DTS decoder version', role: 'info.firmware', type: 'string', read: true, write: false },
            native: {},
        },
    },
};

/** Objects filled from Deviceinfo.xml */
export const DEVICE_INFO_STATES: Record<string, ioBroker.SettableStateObject> = {
    'info.model': {
        type: 'state',
        common: { name: 'Model', role: 'info.model', type: 'string', read: true, write: false },
        native: {},
    },
    'info.brand': {
        type: 'state',
        common: {
            name: 'Brand',
            role: 'text',
            type: 'string',
            read: true,
            write: false,
            states: { Denon: 'Denon', Marantz: 'Marantz', unknown: 'unknown' },
        },
        native: {},
    },
    'info.zones': {
        type: 'state',
        common: { name: 'Number of zones incl. main zone', role: 'value', type: 'number', read: true, write: false },
        native: {},
    },
};

/** Line of the display which carries the cursor */
export const CURSOR_LINE_OBJECT: ioBroker.SettableStateObject = {
    type: 'state',
    common: {
        name: 'Display line with cursor (1-7, 0 = none)',
        role: 'value',
        type: 'number',
        min: 0,
        max: 7,
        read: true,
        write: false,
    },
    native: {},
};

/**
 * Objects of the display lines (network audio GUI, models without HEOS)
 */
export function displayObjects(): Record<string, ioBroker.SettableStateObject> {
    const res: Record<string, ioBroker.SettableStateObject> = {};
    for (let i = 0; i <= 8; i++) {
        res[`display.line${i}`] = {
            type: 'state',
            common: { name: `Display line ${i}`, role: 'info.display', type: 'string', read: true, write: false },
            native: {},
        };
    }
    res['display.cursorLine'] = CURSOR_LINE_OBJECT;
    res['main.cover'] = {
        type: 'state',
        common: {
            name: 'Cover of the current network title',
            role: 'media.cover',
            type: 'string',
            read: true,
            write: false,
        },
        native: {},
    };
    res['netAudio.presets'] = {
        type: 'state',
        common: { name: 'Network audio presets', role: 'json', type: 'string', read: true, write: false },
        native: {},
    };
    return res;
}
