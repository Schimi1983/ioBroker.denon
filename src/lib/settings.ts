/**
 * Table driven definitions of settings which map 1:1 to a protocol prefix with a fixed value list.
 * States are only created once the AVR answers the query, so models without the feature get no dead states.
 */

/** A setting with a fixed list of protocol values */
export interface EnumSetting {
    /** State id relative to the instance */
    id: string;
    /** Protocol prefix used in responses and commands, e.g. "ECO" or "PSDRC" */
    prefix: string;
    /** Separator between prefix and value in commands ("" -> "ECOAUTO", " " -> "PSDRC AUTO") */
    separator: '' | ' ';
    /** Query command */
    query: string;
    /** Object name */
    name: string;
    /** Value list, key = protocol value */
    states: Record<string, string>;
    /** false for values the AVR only reports (default: writable) */
    write?: boolean;
}

/**
 * Settings handled generically.
 *
 * @KI_HINWEIS: Order matters, a prefix which is the beginning of another prefix (VSSC / VSSCH) must come after it.
 */
export const ENUM_SETTINGS: readonly EnumSetting[] = [
    {
        id: 'settings.hdmiResolution',
        prefix: 'VSSCH',
        separator: '',
        query: 'VSSCH ?',
        name: 'HDMI output resolution (video conversion)',
        states: {
            '48P': '480p/576p',
            '10I': '1080i',
            '72P': '720p',
            '10P': '1080p',
            '10P24': '1080p 24 Hz',
            '4K': '4K',
            '4KF': '4K 60/50 Hz',
            AUTO: 'Auto',
        },
    },
    {
        id: 'settings.analogResolution',
        prefix: 'VSSC',
        separator: '',
        query: 'VSSC ?',
        name: 'Analog video output resolution',
        states: {
            '48P': '480p/576p',
            '10I': '1080i',
            '72P': '720p',
            '10P': '1080p',
            '10P24': '1080p 24 Hz',
            '4K': '4K',
            '4KF': '4K 60/50 Hz',
            AUTO: 'Auto',
        },
    },
    {
        id: 'settings.aspectRatio',
        prefix: 'VSASP',
        separator: '',
        query: 'VSASP ?',
        name: 'Aspect ratio',
        states: { NRM: '4:3', FUL: '16:9' },
    },
    {
        id: 'settings.soundModeGroup',
        prefix: 'SSSMG',
        separator: ' ',
        query: 'SSSMG ?',
        name: 'Active sound mode group',
        states: { MOV: 'Movie', MUS: 'Music', GAM: 'Game', PUR: 'Pure' },
        write: false,
    },
    {
        id: 'settings.dynamicCompression',
        prefix: 'PSDRC',
        separator: ' ',
        query: 'PSDRC ?',
        name: 'Dynamic range compression',
        states: { AUTO: 'Auto', LOW: 'Low', MID: 'Middle', HI: 'High', OFF: 'Off' },
    },
    {
        id: 'settings.audioRestorer',
        prefix: 'PSRSTR',
        separator: ' ',
        query: 'PSRSTR ?',
        name: 'Audio restorer',
        states: { OFF: 'Off', LOW: 'Low', MED: 'Medium', HI: 'High' },
    },
    {
        id: 'settings.autoStandby',
        prefix: 'STBY',
        separator: '',
        query: 'STBY?',
        name: 'Auto standby main zone',
        states: { '15M': '15 min', '30M': '30 min', '60M': '60 min', OFF: 'Off' },
    },
    {
        id: 'settings.ecoMode',
        prefix: 'ECO',
        separator: '',
        query: 'ECO?',
        name: 'ECO mode',
        states: { ON: 'On', AUTO: 'Auto', OFF: 'Off' },
    },
    {
        id: 'settings.inputMode',
        prefix: 'SD',
        separator: '',
        query: 'SD?',
        name: 'Audio input mode',
        states: {
            AUTO: 'Auto',
            HDMI: 'HDMI',
            DIGITAL: 'Digital',
            ANALOG: 'Analog',
            'EXT.IN': 'External in',
            '7.1IN': '7.1 in',
            ARC: 'ARC',
            NO: 'No input',
        },
    },
    {
        id: 'settings.digitalInputMode',
        prefix: 'DC',
        separator: '',
        query: 'DC?',
        name: 'Digital input mode',
        states: { AUTO: 'Auto', PCM: 'PCM', DTS: 'DTS' },
    },
];

/** Lookup: state id -> setting */
export const ENUM_SETTINGS_BY_ID: ReadonlyMap<string, EnumSetting> = new Map(ENUM_SETTINGS.map(s => [s.id, s]));

/**
 * Finds the setting matching a response line
 *
 * @param line protocol line
 */
export function findEnumSetting(line: string): { setting: EnumSetting; value: string } | undefined {
    for (const setting of ENUM_SETTINGS) {
        if (line.startsWith(setting.prefix)) {
            const value = line.substring(setting.prefix.length).trim();
            if (value) {
                return { setting, value };
            }
        }
    }
    return undefined;
}

/**
 * Builds the state object for an enum setting
 *
 * @param setting the setting
 */
export function enumSettingObject(setting: EnumSetting): ioBroker.SettableStateObject {
    return {
        type: 'state',
        common: {
            name: setting.name,
            role: 'level.mode',
            type: 'string',
            read: true,
            write: setting.write !== false,
            states: { ...setting.states },
        },
        native: { command: setting.prefix },
    };
}

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
                desc: 'AVR-X2200W: 02 PCM, 03 Dolby Digital, 04 Dolby Digital Plus, 05 Dolby TrueHD, 06 DTS, 09 DTS-HD, 12 switching',
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
            role: 'info.manufacturer',
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

/** Buttons to select surround mode groups, the AVR picks the best mode of the group for the signal */
export const SOUND_MODE_BUTTONS: Record<string, { command: string; name: string }> = {
    'settings.soundModeMovie': { command: 'MSMOVIE', name: 'Sound mode group Movie' },
    'settings.soundModeMusic': { command: 'MSMUSIC', name: 'Sound mode group Music' },
    'settings.soundModeGame': { command: 'MSGAME', name: 'Sound mode group Game' },
    'settings.soundModeDirect': { command: 'MSDIRECT', name: 'Sound mode Direct' },
    'settings.soundModePureDirect': { command: 'MSPURE DIRECT', name: 'Sound mode Pure Direct' },
    'settings.soundModeStereo': { command: 'MSSTEREO', name: 'Sound mode Stereo' },
    'settings.soundModeAuto': { command: 'MSAUTO', name: 'Sound mode Auto' },
};

/**
 * Builds the button objects for the surround mode groups
 */
export function soundModeButtonObjects(): Record<string, ioBroker.SettableStateObject> {
    const res: Record<string, ioBroker.SettableStateObject> = {};
    for (const [id, def] of Object.entries(SOUND_MODE_BUTTONS)) {
        res[id] = {
            type: 'state',
            common: { name: def.name, role: 'button', type: 'boolean', read: false, write: true, def: false },
            native: { command: def.command },
        };
    }
    return res;
}
