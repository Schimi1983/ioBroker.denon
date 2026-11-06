/**
 * Objects of DENON POA-3012CI multi zone amplifiers (receiver type "US"). AV receivers use the table in datapoints.ts.
 */

/** Objects of every amplifier zone (zone2, zone4 ... zone12) */
export const usCommandsZone: ioBroker.StateObject[] = [
    {
        _id: 'speakerOneVolume',
        type: 'state',
        common: {
            name: 'Speaker One Volume',
            role: 'level.volume',
            type: 'number',
            write: true,
            read: true,
            min: 0,
            max: 99,
        },
        native: {},
    },
    {
        _id: 'speakerTwoVolume',
        type: 'state',
        common: {
            name: 'Speaker Two Volume',
            role: 'level.volume',
            type: 'number',
            write: true,
            read: true,
            min: 0,
            max: 99,
        },
        native: {},
    },
    {
        _id: 'selectInputOne',
        type: 'state',
        common: {
            name: 'Speaker One Select Input',
            role: 'media.input',
            type: 'string',
            write: true,
            read: true,
            states: {
                0: 'BUS L',
                1: 'BUS R',
                2: 'BUS M',
                3: 'AUX',
            },
        },
        native: {},
    },
    {
        _id: 'selectInputTwo',
        type: 'state',
        common: {
            name: 'Speaker Two Select Input',
            role: 'media.input',
            type: 'string',
            write: true,
            read: true,
            states: {
                0: 'BUS L',
                1: 'BUS R',
                2: 'BUS M',
                3: 'AUX',
            },
        },
        native: {},
    },
    {
        _id: 'operationMode',
        type: 'state',
        common: {
            name: 'Operation Mode',
            role: 'state',
            type: 'string',
            write: true,
            read: true,
            states: {
                0: 'NORMAL',
                1: 'BRIDGED',
            },
        },
        native: {},
    },
    {
        _id: 'lowCutFilterSpeakerOne',
        type: 'state',
        common: {
            name: 'Speaker One Channel Low Cut Filter',
            role: 'switch',
            type: 'boolean',
            write: true,
            read: true,
        },
        native: {},
    },
    {
        _id: 'lowCutFilterSpeakerTwo',
        type: 'state',
        common: {
            name: 'Speaker Two Channel Low Cut Filter',
            role: 'switch',
            type: 'boolean',
            write: true,
            read: true,
        },
        native: {},
    },
    {
        _id: 'zoneTurnOnModeChange',
        type: 'state',
        common: {
            name: 'Zone Turn On Mode Change',
            role: 'state',
            type: 'string',
            write: true,
            read: true,
            states: {
                0: 'Constant',
                1: 'Trigger in',
                2: 'Audio signal',
                3: 'Off',
            },
        },
        native: {},
    },
    {
        _id: 'triggerInput',
        type: 'state',
        common: {
            name: 'Zone Trigger Input',
            role: 'switch',
            type: 'boolean',
            write: true,
            read: true,
        },
        native: {},
    },
    {
        _id: 'audioSignalInput',
        type: 'state',
        common: {
            name: 'Channel Audio Signal Input',
            role: 'switch',
            type: 'boolean',
            write: true,
            read: true,
        },
        native: {},
    },
];

export const usCommands: ioBroker.StateObject[] = [
    {
        _id: 'system.powerConfigurationChange',
        type: 'state',
        common: {
            name: 'Power Configuration Change',
            role: 'state',
            type: 'string',
            write: true,
            read: true,
            states: {
                0: 'Power Button',
                1: 'Master Trigger',
                2: 'On Line',
            },
        },
        native: {},
    },
    {
        _id: 'system.masterTriggerInput',
        type: 'state',
        common: {
            name: 'Master Trigger Input',
            role: 'switch',
            type: 'boolean',
            write: true,
            read: true,
        },
        native: {},
    },
];
