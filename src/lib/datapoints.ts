/**
 * Declarative table of all telnet datapoints of Denon/Marantz AV receivers (object tree 2.0).
 *
 * Every entry links a state id to a protocol prefix and a value kind. The adapter uses the table in both directions:
 * - incoming line -> {@link matchLine} -> state id + converted value
 * - user write -> {@link formatCommand} -> protocol command
 *
 * States are created when the AVR answers for the first time, so every model only gets the states it supports.
 * Entries without an answer of their own (buttons, volume in dB) are created together with the entry named in `with`.
 *
 * @KI_HINWEIS: Roles only from https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/stateroles.md
 * Prefixes include the separator of the protocol ("PSBAS " vs. "STBY"). Value lists are keyed by the protocol value.
 */
import {
    CHANNEL_VOLUME_MAPPINGS,
    dbToLevel,
    formatSleepTimer,
    formatVolume,
    formatZoneVolume,
    levelToDb,
    parseVolume,
} from './protocol';
import { resolveStateKey } from './utils';

/** How the value part of a line is converted */
export type DatapointKind =
    'onoff' | 'enum' | 'db' | 'int' | 'sleep' | 'volume' | 'volumeDb' | 'quick' | 'frequency' | 'text' | 'button';

/** Common attributes of the state object, type and defaults are derived from the kind */
export interface DatapointCommon {
    /** Object name (English) */
    name: string;
    /** Role from the official role list, derived from the kind if missing */
    role?: string;
    /** Unit, e.g. "dB" */
    unit?: string;
    /** Minimum */
    min?: number;
    /** Maximum */
    max?: number;
    /** Step width */
    step?: number;
    /** Value list, key = protocol value */
    states?: Record<string, string>;
    /** false for values the AVR only reports */
    write?: boolean;
    /** Description */
    desc?: string;
}

/** One datapoint */
export interface Datapoint {
    /** State id relative to the instance, e.g. "main.audio.bass" */
    id: string;
    /** Protocol prefix of answers and commands incl. separator, e.g. "PSBAS " */
    prefix: string;
    /** Value conversion */
    kind: DatapointKind;
    /** Common attributes of the object */
    common: DatapointCommon;
    /** onoff: protocol value for true (default "ON") */
    on?: string;
    /** onoff: protocol value for false (default "OFF") */
    off?: string;
    /** int: number of digits of the protocol value (0 = no padding) */
    digits?: number;
    /** int: multiplier between protocol value and state value (LFE: "10" = -10 dB) */
    factor?: number;
    /** Restricts the accepted values, needed if several entries share a prefix */
    pattern?: RegExp;
    /** button: command to send */
    command?: string;
    /** Entry is created together with this state id (buttons, write-only states) */
    with?: string;
    /** volume: id of the companion state in dB */
    dbId?: string;
    /** volume: zones 2/3 only accept whole steps */
    wholeSteps?: boolean;
    /** false = never matched against incoming lines (buttons, dB companion, write-only) */
    parse?: false;
}

/** Result of a matched line */
export interface LineMatch {
    /** Matched datapoint */
    dp: Datapoint;
    /** Converted state value */
    value: ioBroker.StateValue;
    /** Raw protocol value, e.g. "AUTO" */
    raw: string;
}

// ---------------------------------------------------------------------------------------------------------------
// Value lists
// ---------------------------------------------------------------------------------------------------------------

/** Inputs known before the AVR reports its own list (SSSOD), key = protocol code */
export const DEFAULT_INPUTS: Readonly<Record<string, string>> = {
    PHONO: 'Phono',
    CD: 'CD',
    TUNER: 'Tuner',
    DVD: 'DVD',
    BD: 'Blu-ray',
    TV: 'TV Audio',
    'SAT/CBL': 'CBL/SAT',
    MPLAY: 'Media Player',
    GAME: 'Game',
    NET: 'HEOS Music / Network',
    SPOTIFY: 'Spotify',
    IRADIO: 'Internet Radio',
    SERVER: 'Media Server',
    FAVORITES: 'Favorites',
    AUX1: 'AUX1',
    AUX2: 'AUX2',
    BT: 'Bluetooth',
    'USB/IPOD': 'USB/iPod',
    USB: 'USB',
};

/** Extra input of zones 2/3: follow the input of the main zone */
export const ZONE_SOURCE_INPUT: Readonly<Record<string, string>> = { SOURCE: 'Same as main zone' };

const SURROUND_MODES: Record<string, string> = {
    DIRECT: 'Direct',
    'PURE DIRECT': 'Pure Direct',
    STEREO: 'Stereo',
    AUTO: 'Auto',
    'DOLBY DIGITAL': 'Dolby Digital',
    'DTS SURROUND': 'DTS Surround',
    'MCH STEREO': 'Multi Channel Stereo',
    VIRTUAL: 'Virtual',
    MOVIE: 'Movie',
    MUSIC: 'Music',
    GAME: 'Game',
};

const VIDEO_RESOLUTIONS: Record<string, string> = {
    '48P': '480p/576p',
    '10I': '1080i',
    '72P': '720p',
    '10P': '1080p',
    '10P24': '1080p 24 Hz',
    '4K': '4K',
    '4KF': '4K 60/50 Hz',
    '8K': '8K',
    AUTO: 'Auto',
    OFF: 'Off',
};

const ON_OFF = /^(ON|OFF)$/;

// ---------------------------------------------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------------------------------------------

/**
 * On/off datapoint
 *
 * @param id state id
 * @param prefix protocol prefix
 * @param name object name
 * @param role state role
 * @param extra further attributes (on/off values, pattern)
 */
function onoff(id: string, prefix: string, name: string, role = 'switch', extra: Partial<Datapoint> = {}): Datapoint {
    return { id, prefix, kind: 'onoff', common: { name, role }, ...extra };
}

/**
 * Datapoint with a value list, key = protocol value
 *
 * @param id state id
 * @param prefix protocol prefix
 * @param name object name
 * @param states value list
 * @param extra further attributes, role and write go into common
 */
function enumeration(
    id: string,
    prefix: string,
    name: string,
    states: Record<string, string>,
    extra: Partial<Datapoint> & { role?: string; write?: boolean } = {},
): Datapoint {
    const { role, write, ...rest } = extra;
    return { id, prefix, kind: 'enum', common: { name, states: { ...states }, role, write }, ...rest };
}

/**
 * Level in dB (protocol 50 = 0 dB, three digits for half steps)
 *
 * @param id state id
 * @param prefix protocol prefix
 * @param name object name
 * @param min minimum in dB
 * @param max maximum in dB
 * @param role state role
 */
function db(id: string, prefix: string, name: string, min: number, max: number, role = 'level'): Datapoint {
    return { id, prefix, kind: 'db', common: { name, role, unit: 'dB', min, max, step: 0.5 } };
}

/**
 * Integer datapoint, two digits by default
 *
 * @param id state id
 * @param prefix protocol prefix
 * @param name object name
 * @param common further common attributes
 * @param extra further attributes (digits, factor, pattern)
 */
function int(
    id: string,
    prefix: string,
    name: string,
    common: Partial<DatapointCommon>,
    extra: Partial<Datapoint>,
): Datapoint {
    return { id, prefix, kind: 'int', digits: 2, common: { name, role: 'level', ...common }, ...extra };
}

/**
 * Button, created together with another state
 *
 * @param id state id
 * @param command protocol command
 * @param name object name
 * @param withId id of the state the button belongs to
 * @param role button role
 */
function button(id: string, command: string, name: string, withId: string, role = 'button'): Datapoint {
    return { id, prefix: '', kind: 'button', command, with: withId, parse: false, common: { name, role } };
}

/**
 * Lower camel case id from the channel volume mapping key, "FrontLeft" -> "frontLeft"
 *
 * @param key key of CHANNEL_VOLUME_MAPPINGS
 */
function camel(key: string): string {
    return key.charAt(0).toLowerCase() + key.slice(1);
}

/**
 * Datapoints of the core of a zone (power, volume, mute, input, quick select, sleep timer, tone)
 *
 * @param zone 1 = main zone, 2/3 = zone 2/3
 */
function zoneDatapoints(zone: number): Datapoint[] {
    const main = zone === 1;
    const ch = main ? 'main' : `zone${zone}`;
    const z = `Z${zone}`;
    const label = main ? 'Main zone' : `Zone ${zone}`;
    const quickCommon: DatapointCommon = {
        name: `${label} quick select (0 = none)`,
        role: 'level',
        min: 0,
        max: 6,
        states: { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' },
    };
    const res: Datapoint[] = [
        onoff(`${ch}.power`, main ? 'ZM' : z, `${label} power`, 'switch.power.zone'),
        {
            id: `${ch}.volume`,
            prefix: main ? 'MV' : z,
            kind: 'volume',
            dbId: `${ch}.volumeDb`,
            wholeSteps: !main,
            common: { name: `${label} volume`, role: 'level.volume', min: 0, max: 98, step: main ? 0.5 : 1 },
        },
        {
            id: `${ch}.volumeDb`,
            prefix: main ? 'MV' : z,
            kind: 'volumeDb',
            with: `${ch}.volume`,
            wholeSteps: !main,
            parse: false,
            common: {
                name: `${label} volume in dB`,
                role: 'level',
                unit: 'dB',
                min: -80,
                max: 18,
                step: main ? 0.5 : 1,
            },
        },
        button(`${ch}.volumeUp`, main ? 'MVUP' : `${z}UP`, `${label} volume up`, `${ch}.volume`, 'button.volume.up'),
        button(
            `${ch}.volumeDown`,
            main ? 'MVDOWN' : `${z}DOWN`,
            `${label} volume down`,
            `${ch}.volume`,
            'button.volume.down',
        ),
        onoff(`${ch}.mute`, main ? 'MU' : `${z}MU`, `${label} mute`, 'media.mute'),
        enumeration(
            `${ch}.input`,
            main ? 'SI' : z,
            `${label} input`,
            main ? DEFAULT_INPUTS : { ...DEFAULT_INPUTS, ...ZONE_SOURCE_INPUT },
            {
                role: 'media.input',
                // @KI_HINWEIS: Zone lines share the prefix "Z2" with power and volume, inputs never contain spaces
                pattern: /^[A-Z0-9/.]+$/,
            },
        ),
        {
            id: `${ch}.quickSelect`,
            prefix: main ? 'MSQUICK' : `${z}QUICK`,
            kind: 'quick',
            pattern: /^\d$/,
            common: quickCommon,
        },
        {
            id: `${ch}.quickSelect`,
            prefix: main ? 'MSSMART' : `${z}SMART`,
            kind: 'quick',
            pattern: /^\d$/,
            common: quickCommon,
        },
        {
            id: `${ch}.sleepTimer`,
            prefix: main ? 'SLP' : `${z}SLP`,
            kind: 'sleep',
            common: {
                name: `${label} sleep timer (0 = off)`,
                role: 'level.timer.sleep',
                unit: 'min',
                min: 0,
                max: 120,
            },
        },
        enumeration(
            `${ch}.autoStandby`,
            main ? 'STBY' : `${z}STBY`,
            `${label} auto standby`,
            main
                ? { '15M': '15 min', '30M': '30 min', '60M': '60 min', OFF: 'Off' }
                : { '2H': '2 h', '4H': '4 h', '8H': '8 h', OFF: 'Off' },
        ),
        db(`${ch}.audio.bass`, main ? 'PSBAS ' : `${z}PSBAS `, `${label} bass`, -6, 6, 'level.bass'),
        db(`${ch}.audio.treble`, main ? 'PSTRE ' : `${z}PSTRE `, `${label} treble`, -6, 6, 'level.treble'),
        button(`${ch}.audio.bassUp`, main ? 'PSBAS UP' : `${z}PSBAS UP`, `${label} bass up`, `${ch}.audio.bass`),
        button(
            `${ch}.audio.bassDown`,
            main ? 'PSBAS DOWN' : `${z}PSBAS DOWN`,
            `${label} bass down`,
            `${ch}.audio.bass`,
        ),
        button(`${ch}.audio.trebleUp`, main ? 'PSTRE UP' : `${z}PSTRE UP`, `${label} treble up`, `${ch}.audio.treble`),
        button(
            `${ch}.audio.trebleDown`,
            main ? 'PSTRE DOWN' : `${z}PSTRE DOWN`,
            `${label} treble down`,
            `${ch}.audio.treble`,
        ),
    ];
    if (main) {
        res.push(
            {
                id: 'main.maxVolume',
                prefix: 'MVMAX ',
                kind: 'volume',
                dbId: 'main.maxVolumeDb',
                common: { name: 'Maximum volume', role: 'value.volume', min: 0, max: 98, write: false },
            },
            {
                id: 'main.maxVolumeDb',
                prefix: 'MVMAX ',
                kind: 'volumeDb',
                with: 'main.maxVolume',
                parse: false,
                common: { name: 'Maximum volume in dB', role: 'value', unit: 'dB', write: false },
            },
        );
        for (const [key, code] of Object.entries(CHANNEL_VOLUME_MAPPINGS)) {
            res.push(
                db(
                    `main.channelVolume.${camel(key)}`,
                    `CV${code} `,
                    `Channel level ${key.replace(/([a-z])([A-Z])/g, '$1 $2')}`,
                    -12,
                    12,
                ),
            );
        }
    } else {
        res.push(
            db(`${ch}.channelVolume.frontLeft`, `${z}CVFL `, `${label} channel level front left`, -12, 12),
            db(`${ch}.channelVolume.frontRight`, `${z}CVFR `, `${label} channel level front right`, -12, 12),
        );
        if (zone === 2) {
            res.push(
                enumeration('zone2.hdmiAudio', 'Z2HDA ', 'Zone 2 HDMI audio', { THR: 'Pass through', PCM: 'PCM' }),
            );
        }
    }
    return res;
}

// ---------------------------------------------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------------------------------------------

/** All datapoints of AV receivers (not POA multi zone amplifiers) */
export const DATAPOINTS: readonly Datapoint[] = [
    // info
    {
        id: 'info.name',
        prefix: 'NSFRN ',
        kind: 'text',
        common: { name: 'Device name', role: 'info.name', write: false },
    },
    enumeration(
        'info.soundModeGroup',
        'SSSMG ',
        'Active sound mode group',
        { MOV: 'Movie', MUS: 'Music', GAM: 'Game', PUR: 'Pure' },
        { write: false },
    ),

    // system
    onoff('system.power', 'PW', 'Power (whole device)', 'switch.power', {
        on: 'ON',
        off: 'STANDBY',
        pattern: /^(ON|STANDBY)$/,
    }),
    enumeration('system.ecoMode', 'ECO', 'ECO mode', { ON: 'On', AUTO: 'Auto', OFF: 'Off' }),
    onoff('system.allZoneStereo', 'MNZST ', 'All zone stereo'),
    int(
        'system.speakerPreset',
        'SPPR ',
        'Speaker preset',
        { states: { 1: 'Preset 1', 2: 'Preset 2' }, min: 1, max: 2 },
        { digits: 0 },
    ),

    // display
    enumeration('display.brightness', 'DIM ', 'Display brightness', {
        BRI: 'Bright',
        DIM: 'Dimmed',
        DAR: 'Dark',
        OFF: 'Off',
    }),

    // remote control
    onoff('remote.menu', 'MNMEN ', 'Setup menu on screen'),
    button('remote.up', 'MNCUP', 'Cursor up', 'remote.menu'),
    button('remote.down', 'MNCDN', 'Cursor down', 'remote.menu'),
    button('remote.left', 'MNCLT', 'Cursor left', 'remote.menu'),
    button('remote.right', 'MNCRT', 'Cursor right', 'remote.menu'),
    button('remote.enter', 'MNENT', 'Enter', 'remote.menu'),
    button('remote.back', 'MNRTN', 'Back', 'remote.menu'),
    button('remote.option', 'MNOPT', 'Option', 'remote.menu'),
    button('remote.info', 'MNINF', 'Info', 'remote.menu'),
    // @KI_HINWEIS: NS9x play controls only exist on models with network audio but without HEOS. They are created
    // together with the display lines (NSE answer), which HEOS models do not send.
    button('remote.play', 'NS9A', 'Play', 'display.line0', 'button.play'),
    button('remote.pause', 'NS9B', 'Pause', 'display.line0', 'button.pause'),
    button('remote.playPause', 'NS94', 'Play/Pause', 'display.line0'),
    button('remote.next', 'NS9D', 'Next track', 'display.line0', 'button.next'),
    button('remote.previous', 'NS9E', 'Previous track', 'display.line0', 'button.prev'),

    // zones
    ...zoneDatapoints(1),
    ...zoneDatapoints(2),
    ...zoneDatapoints(3),

    // main zone: sound modes
    enumeration('main.surroundMode', 'MS', 'Surround mode', SURROUND_MODES, {
        // "MSQUICK1 MEMORY" and similar answers are no surround modes
        pattern: /^(?!QUICK|SMART)[A-Z0-9 :+.\-/]+$/,
    }),
    button('main.soundModeMovie', 'MSMOVIE', 'Sound mode group Movie', 'main.surroundMode'),
    button('main.soundModeMusic', 'MSMUSIC', 'Sound mode group Music', 'main.surroundMode'),
    button('main.soundModeGame', 'MSGAME', 'Sound mode group Game', 'main.surroundMode'),
    button('main.soundModeDirect', 'MSDIRECT', 'Sound mode Direct', 'main.surroundMode'),
    button('main.soundModePureDirect', 'MSPURE DIRECT', 'Sound mode Pure Direct', 'main.surroundMode'),
    button('main.soundModeStereo', 'MSSTEREO', 'Sound mode Stereo', 'main.surroundMode'),
    button('main.soundModeAuto', 'MSAUTO', 'Sound mode Auto', 'main.surroundMode'),

    // main zone: audio
    onoff('main.audio.toneControl', 'PSTONE CTRL ', 'Tone control'),
    enumeration('main.audio.multEq', 'PSMULTEQ:', 'Audyssey MultEQ', {
        AUDYSSEY: 'Reference',
        'BYP.LR': 'L/R Bypass',
        FLAT: 'Flat',
        MANUAL: 'Manual',
        OFF: 'Off',
    }),
    onoff('main.audio.dynamicEq', 'PSDYNEQ ', 'Audyssey Dynamic EQ'),
    int(
        'main.audio.referenceLevel',
        'PSREFLEV ',
        'Reference level offset',
        { unit: 'dB', states: { 0: '0 dB', 5: '5 dB', 10: '10 dB', 15: '15 dB' } },
        { digits: 0 },
    ),
    enumeration('main.audio.dynamicVolume', 'PSDYNVOL ', 'Audyssey Dynamic Volume', {
        HEV: 'Heavy',
        MED: 'Medium',
        LIT: 'Light',
        OFF: 'Off',
    }),
    enumeration('main.audio.dynamicCompression', 'PSDRC ', 'Dynamic range compression', {
        AUTO: 'Auto',
        LOW: 'Low',
        MID: 'Middle',
        HI: 'High',
        OFF: 'Off',
    }),
    int('main.audio.lfe', 'PSLFE ', 'LFE level', { unit: 'dB', min: -10, max: 0 }, { factor: -1, pattern: /^\d{2}$/ }),
    onoff('main.audio.lfc', 'PSLFC ', 'Audyssey LFC'),
    int(
        'main.audio.containment',
        'PSCNTAMT ',
        'Audyssey LFC containment amount',
        { min: 1, max: 7 },
        { pattern: /^\d{2}$/ },
    ),
    button('main.audio.containmentUp', 'PSCNTAMT UP', 'Containment amount up', 'main.audio.containment'),
    button('main.audio.containmentDown', 'PSCNTAMT DOWN', 'Containment amount down', 'main.audio.containment'),
    onoff('main.audio.subwoofer', 'PSSWR ', 'Subwoofer on'),
    onoff('main.audio.subwooferLevelAdjust', 'PSSWL ', 'Subwoofer level adjustment', 'switch', { pattern: ON_OFF }),
    db('main.audio.subwooferLevel', 'PSSWL ', 'Subwoofer level', -12, 12),
    button('main.audio.subwooferLevelUp', 'PSSWL UP', 'Subwoofer level up', 'main.audio.subwooferLevel'),
    button('main.audio.subwooferLevelDown', 'PSSWL DOWN', 'Subwoofer level down', 'main.audio.subwooferLevel'),
    db('main.audio.subwoofer2Level', 'PSSWL2 ', 'Subwoofer 2 level', -12, 12),
    button('main.audio.subwoofer2LevelUp', 'PSSWL2 UP', 'Subwoofer 2 level up', 'main.audio.subwoofer2Level'),
    button('main.audio.subwoofer2LevelDown', 'PSSWL2 DOWN', 'Subwoofer 2 level down', 'main.audio.subwoofer2Level'),
    onoff('main.audio.dialogLevelAdjust', 'PSDIL ', 'Dialog level adjustment', 'switch', { pattern: ON_OFF }),
    db('main.audio.dialogLevel', 'PSDIL ', 'Dialog level', -12, 12),
    int('main.audio.dialogControl', 'PSDIC ', 'Dialog control', { min: 0, max: 6 }, { pattern: /^\d{2}$/ }),
    onoff('main.audio.cinemaEq', 'PSCINEMA EQ.', 'Cinema EQ'),
    onoff('main.audio.neuralX', 'PSNEURAL ', 'DTS Neural:X'),
    onoff('main.audio.graphicEq', 'PSGEQ ', 'Graphic EQ'),
    onoff('main.audio.headphoneEq', 'PSHEQ ', 'Headphone EQ'),
    onoff('main.audio.loudness', 'PSLOM ', 'Loudness management'),
    int(
        'main.audio.audioDelay',
        'PSDELAY ',
        'Audio delay (lip sync)',
        { unit: 'ms', min: 0, max: 300 },
        { digits: 3, pattern: /^\d{3}$/ },
    ),
    enumeration('main.audio.audioRestorer', 'PSRSTR ', 'Audio restorer', {
        OFF: 'Off',
        LOW: 'Low',
        MED: 'Medium',
        HI: 'High',
    }),
    onoff('main.audio.centerSpread', 'PSCES ', 'Center spread'),
    enumeration('main.audio.inputMode', 'SD', 'Audio input mode', {
        AUTO: 'Auto',
        HDMI: 'HDMI',
        DIGITAL: 'Digital',
        ANALOG: 'Analog',
        'EXT.IN': 'External in',
        '7.1IN': '7.1 in',
        ARC: 'ARC',
        NO: 'No input',
    }),
    enumeration('main.audio.digitalInputMode', 'DC', 'Digital input mode', { AUTO: 'Auto', PCM: 'PCM', DTS: 'DTS' }),

    // main zone: video
    enumeration('main.video.monitor', 'VSMONI', 'HDMI monitor output', {
        AUTO: 'Auto',
        1: 'Monitor 1',
        2: 'Monitor 2',
    }),
    enumeration('main.video.hdmiResolution', 'VSSCH', 'HDMI output resolution', VIDEO_RESOLUTIONS),
    enumeration('main.video.analogResolution', 'VSSC', 'Analog video output resolution', VIDEO_RESOLUTIONS),
    enumeration('main.video.aspectRatio', 'VSASP', 'Aspect ratio', { NRM: '4:3', FUL: '16:9' }),
    enumeration('main.video.processingMode', 'VSVPM', 'Video processing mode', {
        AUTO: 'Auto',
        GAME: 'Game',
        MOVI: 'Movie',
        BYP: 'Bypass',
    }),
    enumeration(
        'main.video.pictureMode',
        'PV',
        'Picture mode',
        {
            OFF: 'Off',
            STD: 'Standard',
            MOV: 'Movie',
            VVD: 'Vivid',
            STM: 'Stream',
            CTM: 'Custom',
            DAY: 'ISF Day',
            NGT: 'ISF Night',
        },
        // picture adjustments like "PVCN 050" are not mapped
        { pattern: /^[A-Z]{3}$/ },
    ),
    enumeration('main.video.hdmiAudioOutput', 'VSAUDIO ', 'HDMI audio output', { AMP: 'AV receiver', TV: 'TV' }),

    // tuner
    {
        id: 'tuner.frequency',
        prefix: 'TFAN',
        kind: 'frequency',
        pattern: /^\d{6}$/,
        common: { name: 'Tuner frequency', role: 'level.frequency' },
    },
    {
        id: 'tuner.stationName',
        prefix: 'TFANNAME',
        kind: 'text',
        common: { name: 'Station name (RDS)', role: 'text', write: false },
    },
    button('tuner.frequencyUp', 'TFANUP', 'Frequency up', 'tuner.frequency'),
    button('tuner.frequencyDown', 'TFANDOWN', 'Frequency down', 'tuner.frequency'),
    enumeration('tuner.band', 'TMAN', 'Tuner band', { FM: 'FM', AM: 'AM' }, { pattern: /^(AM|FM)$/ }),
    enumeration(
        'tuner.tuningMode',
        'TMAN',
        'Tuning mode',
        { AUTO: 'Auto', MANUAL: 'Manual' },
        { pattern: /^(AUTO|MANUAL)$/ },
    ),
    int('tuner.preset', 'TPAN', 'Tuner preset', { min: 1, max: 56 }, { pattern: /^\d{2}$/ }),
    button('tuner.presetUp', 'TPANUP', 'Next preset', 'tuner.preset'),
    button('tuner.presetDown', 'TPANDOWN', 'Previous preset', 'tuner.preset'),

    // network audio (models without HEOS)
    int(
        'netAudio.loadPreset',
        'NSB',
        'Load favorite/preset',
        { min: 1, max: 56 },
        { parse: false, with: 'display.line0' },
    ),
    int(
        'netAudio.savePreset',
        'NSC',
        'Save current station as preset',
        { min: 1, max: 56 },
        { parse: false, with: 'display.line0' },
    ),
];

/** Datapoints by id (first entry wins, e.g. quick select QUICK before SMART) */
export const DATAPOINTS_BY_ID: ReadonlyMap<string, Datapoint> = (() => {
    const map = new Map<string, Datapoint>();
    for (const dp of DATAPOINTS) {
        if (!map.has(dp.id)) {
            map.set(dp.id, dp);
        }
    }
    return map;
})();

/** Datapoints created together with another one, key = id of the other one */
export const DEPENDENT_DATAPOINTS: ReadonlyMap<string, Datapoint[]> = (() => {
    const map = new Map<string, Datapoint[]>();
    for (const dp of DATAPOINTS) {
        if (dp.with) {
            map.set(dp.with, [...(map.get(dp.with) ?? []), dp]);
        }
    }
    return map;
})();

/** Parsed entries, longest prefix first. Entries with the same prefix keep their order. */
const PARSE_ORDER: readonly Datapoint[] = DATAPOINTS.filter(dp => dp.parse !== false && dp.prefix).sort(
    (a, b) => b.prefix.length - a.prefix.length,
);

// ---------------------------------------------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------------------------------------------

/**
 * Converts the value part of a line according to the kind of the datapoint
 *
 * @param dp datapoint
 * @param raw value part, already trimmed
 * @returns converted value or undefined if the value does not fit the datapoint
 */
export function parseValue(dp: Datapoint, raw: string): ioBroker.StateValue | undefined {
    if (dp.pattern && !dp.pattern.test(raw)) {
        return undefined;
    }
    switch (dp.kind) {
        case 'onoff': {
            const on = dp.on ?? 'ON';
            const off = dp.off ?? 'OFF';
            return raw === on ? true : raw === off ? false : undefined;
        }
        case 'enum':
        case 'text':
            return raw || undefined;
        case 'db':
            return /^\d{2,3}$/.test(raw) ? levelToDb(raw) : undefined;
        case 'int':
            return /^\d+$/.test(raw) ? parseInt(raw, 10) * (dp.factor ?? 1) || 0 : undefined;
        case 'sleep':
            return raw === 'OFF' ? 0 : /^\d{3}$/.test(raw) ? parseInt(raw, 10) : undefined;
        case 'volume':
            return parseVolume(raw);
        case 'quick':
            return parseInt(raw, 10);
        case 'frequency':
            // "010690" -> 106.90 (FM, MHz), "052200" -> 522.00 (AM, kHz)
            return parseInt(raw, 10) / 100;
        default:
            return undefined;
    }
}

/**
 * Finds the datapoint of an incoming line (longest matching prefix whose value fits)
 *
 * @param line protocol line without CR
 */
export function matchLine(line: string): LineMatch | undefined {
    for (const dp of PARSE_ORDER) {
        if (!line.startsWith(dp.prefix)) {
            continue;
        }
        const raw = line.substring(dp.prefix.length).trim();
        if (!raw) {
            continue;
        }
        const value = parseValue(dp, raw);
        if (value !== undefined) {
            return { dp, value, raw };
        }
    }
    return undefined;
}

// ---------------------------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------------------------

/** Result of formatting a user write */
export type CommandResult = { commands: string[] } | { error: string };

/**
 * Formats the frequency of the tuner, 106.9 -> "010690", 522 -> "052200"
 *
 * @param freq frequency in MHz (FM) or kHz (AM)
 */
export function formatFrequency(freq: number): string | undefined {
    if (!Number.isFinite(freq) || freq <= 0 || freq >= 10_000) {
        return undefined;
    }
    return Math.round(freq * 100)
        .toString()
        .padStart(6, '0');
}

/**
 * Builds the protocol command(s) for a value written by the user
 *
 * @param dp datapoint
 * @param val written value
 * @param states current value list of the object (inputs and quick select names are filled at runtime)
 * @param quickFlavor detected quick select flavor, undefined = send both
 */
export function formatCommand(
    dp: Datapoint,
    val: ioBroker.StateValue,
    states?: Record<string, string>,
    quickFlavor?: 'QUICK' | 'SMART',
): CommandResult {
    if (dp.common.write === false) {
        return { error: `${dp.id} is read only` };
    }
    switch (dp.kind) {
        case 'button':
            return { commands: val ? [dp.command!] : [] };
        case 'onoff': {
            const on = val === true || val === 'true' || val === 1 || val === '1' || val === 'ON';
            return { commands: [`${dp.prefix}${on ? (dp.on ?? 'ON') : (dp.off ?? 'OFF')}`] };
        }
        case 'enum': {
            const key = resolveStateKey(states ?? dp.common.states, val);
            return key
                ? { commands: [`${dp.prefix}${key}`] }
                : { error: `"${String(val)}" is not a valid value for ${dp.id}` };
        }
        case 'db': {
            const n = Number(val);
            return Number.isFinite(n)
                ? { commands: [`${dp.prefix}${dbToLevel(n)}`] }
                : { error: `${dp.id} needs a number` };
        }
        case 'int': {
            const n = Math.round(Number(val) / (dp.factor ?? 1));
            if (!Number.isFinite(n) || n < 0) {
                return { error: `${dp.id} needs a number in the allowed range` };
            }
            return { commands: [`${dp.prefix}${dp.digits ? n.toString().padStart(dp.digits, '0') : n.toString()}`] };
        }
        case 'sleep': {
            const slp = formatSleepTimer(Number(val));
            return slp
                ? { commands: [`${dp.prefix}${slp}`] }
                : { error: 'Sleep timer must be between 0 and 120 minutes' };
        }
        case 'volume':
        case 'volumeDb': {
            let n = Number(val);
            if (!Number.isFinite(n)) {
                return { error: `${dp.id} needs a number` };
            }
            if (dp.kind === 'volumeDb') {
                n += 80;
            }
            return { commands: [`${dp.prefix}${dp.wholeSteps ? formatZoneVolume(n) : formatVolume(n)}`] };
        }
        case 'quick': {
            const nr = Number(val);
            const max = Math.max(5, ...Object.keys(states ?? {}).map(k => parseInt(k, 10) || 0));
            if (!Number.isInteger(nr) || nr < 1 || nr > max) {
                return { error: `Quick select must be 1..${max}` };
            }
            // prefix is "MSQUICK" or "Z2QUICK", the base is the part before the flavor
            const base = dp.prefix.replace(/(QUICK|SMART)$/, '');
            const flavors = quickFlavor ? [quickFlavor] : ['QUICK', 'SMART'];
            return { commands: flavors.map(f => `${base}${f}${nr}`) };
        }
        case 'frequency': {
            const f = formatFrequency(Number(val));
            return f ? { commands: [`${dp.prefix}${f}`] } : { error: 'Invalid frequency' };
        }
        default:
            return { error: `${dp.id} is read only` };
    }
}

/**
 * Builds the state object of a datapoint
 *
 * @param dp datapoint
 */
export function datapointObject(dp: Datapoint): ioBroker.SettableStateObject {
    const c = dp.common;
    const writable = c.write !== false;
    let type: ioBroker.CommonType;
    let role = c.role;
    switch (dp.kind) {
        case 'onoff':
        case 'button':
            type = 'boolean';
            role ??= writable ? 'switch' : 'indicator';
            break;
        case 'enum':
        case 'text':
            type = 'string';
            role ??= writable ? 'state' : 'text';
            break;
        default:
            type = 'number';
            role ??= writable ? 'level' : 'value';
    }
    const common: ioBroker.StateCommon = {
        name: c.name,
        type,
        role,
        read: dp.kind !== 'button',
        write: writable,
    };
    for (const key of ['unit', 'min', 'max', 'step', 'desc'] as const) {
        if (c[key] !== undefined) {
            (common as unknown as Record<string, unknown>)[key] = c[key];
        }
    }
    if (c.states) {
        common.states = { ...c.states };
    }
    if (dp.kind === 'button') {
        common.def = false;
    }
    return { type: 'state', common, native: {} };
}

/** Names of the channels of the object tree */
export const CHANNELS: Readonly<Record<string, string>> = {
    info: 'Device and current signal',
    system: 'Whole device',
    display: 'Front display and on screen menu',
    remote: 'Remote control',
    main: 'Main zone',
    'main.audio': 'Main zone sound',
    'main.video': 'Main zone video and HDMI',
    'main.channelVolume': 'Main zone channel levels',
    zone2: 'Zone 2',
    'zone2.audio': 'Zone 2 sound',
    'zone2.channelVolume': 'Zone 2 channel levels',
    zone3: 'Zone 3',
    'zone3.audio': 'Zone 3 sound',
    'zone3.channelVolume': 'Zone 3 channel levels',
    tuner: 'Tuner',
    netAudio: 'Network audio',
    expert: 'Expert: raw protocol commands',
};

/**
 * Query commands sent at start. Settings queries are sent again when the main zone is switched on.
 *
 * @KI_HINWEIS: Zone queries (Z2/Z3) are filtered by the zone count, QUICK/SMART by the brand.
 */
export const CORE_QUERIES: readonly string[] = [
    'PW?',
    'ZM?',
    'MV?',
    'MU?',
    'SI?',
    'MS?',
    'SLP?',
    'NSFRN ?',
    'Z2?',
    'Z2MU?',
    'Z2SLP?',
    'Z3?',
    'Z3MU?',
    'Z3SLP?',
    'MSQUICK ?',
    'Z2QUICK ?',
    'Z3QUICK ?',
    'MSSMART ?',
    'Z2SMART ?',
    'Z3SMART ?',
    'NSE',
    'NSH',
    'TFAN?',
    'TFANNAME?',
    'TMAN?',
    'TPAN?',
    'BDSTATUS?',
];

/** Setting queries, sent at start and again when the main zone is switched on */
export const SETTING_QUERIES: readonly string[] = [
    'ECO?',
    'STBY?',
    'Z2STBY?',
    'Z3STBY?',
    'MNZST?',
    'SPPR ?',
    'DIM ?',
    'MNMEN?',
    'CV?',
    'Z2CV?',
    'Z3CV?',
    'PSBAS ?',
    'PSTRE ?',
    'Z2PSBAS ?',
    'Z2PSTRE ?',
    'Z3PSBAS ?',
    'Z3PSTRE ?',
    'PSTONE CTRL ?',
    'PSMULTEQ: ?',
    'PSDYNEQ ?',
    'PSREFLEV ?',
    'PSDYNVOL ?',
    'PSDRC ?',
    'PSLFE ?',
    'PSLFC ?',
    'PSCNTAMT ?',
    'PSSWR ?',
    'PSSWL ?',
    'PSDIL ?',
    'PSDIC ?',
    'PSCINEMA EQ. ?',
    'PSNEURAL ?',
    'PSGEQ ?',
    'PSHEQ ?',
    'PSLOM ?',
    'PSDELAY ?',
    'PSRSTR ?',
    'PSCES ?',
    'SD?',
    'DC?',
    'VSMONI ?',
    'VSSCH ?',
    'VSSC ?',
    'VSASP ?',
    'VSVPM ?',
    'PV?',
    'VSAUDIO ?',
    'Z2HDA?',
    'SSSMG ?',
];

/** Queries of names and lists stored in the AVR (input names, used inputs, quick select names) */
export const NAME_QUERIES: readonly string[] = ['SSFUN ?', 'SSSOD ?', 'SSQSNZMA ?'];

/** Lines which are known but have no state */
export const IGNORED_LINES =
    /^(CVEND|OPV|SY|TR|SV|NSET|SSVCT|SSSPC|SSLEV|SSLAN|SSHOS|SSTPN|PSEFF|PSRSZ|PSDEL |PSFRONT|SSINFINS)/;
