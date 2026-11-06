import { expect } from 'chai';
import { DATAPOINTS, DATAPOINTS_BY_ID, datapointObject, formatCommand, formatFrequency, matchLine } from './datapoints';

/**
 * Shortcut: state id and value of a line
 *
 * @param line protocol line
 */
function m(line: string): [string, ioBroker.StateValue] | undefined {
    const res = matchLine(line);
    return res ? [res.dp.id, res.value] : undefined;
}

/**
 * Shortcut: commands for a write
 *
 * @param id state id
 * @param val written value
 * @param flavor quick select flavor
 */
function cmd(id: string, val: ioBroker.StateValue, flavor?: 'QUICK' | 'SMART'): string[] | string {
    const dp = DATAPOINTS_BY_ID.get(id);
    expect(dp, id).to.be.ok;
    const res = formatCommand(dp!, val, undefined, flavor);
    return 'error' in res ? res.error : res.commands;
}

describe('datapoints', () => {
    describe('matchLine (lines recorded live on an AVR-X2200W)', () => {
        it('maps the core of the main zone', () => {
            expect(m('PWON')).to.deep.equal(['system.power', true]);
            expect(m('PWSTANDBY')).to.deep.equal(['system.power', false]);
            expect(m('ZMON')).to.deep.equal(['main.power', true]);
            expect(m('MV455')).to.deep.equal(['main.volume', 45.5]);
            expect(m('MVMAX 98')).to.deep.equal(['main.maxVolume', 98]);
            expect(m('MUOFF')).to.deep.equal(['main.mute', false]);
            expect(m('SITV')).to.deep.equal(['main.input', 'TV']);
            expect(m('SISAT/CBL')).to.deep.equal(['main.input', 'SAT/CBL']);
            expect(m('MSQUICK0')).to.deep.equal(['main.quickSelect', 0]);
            expect(m('MSSMART3')).to.deep.equal(['main.quickSelect', 3]);
            expect(m('SLPOFF')).to.deep.equal(['main.sleepTimer', 0]);
            expect(m('SLP030')).to.deep.equal(['main.sleepTimer', 30]);
            expect(m('STBY30M')).to.deep.equal(['main.autoStandby', '30M']);
            expect(m('MSDOLBY HD+DS')).to.deep.equal(['main.surroundMode', 'DOLBY HD+DS']);
            expect(m('MSDTS HD+NEURAL:X')).to.deep.equal(['main.surroundMode', 'DTS HD+NEURAL:X']);
        });

        it('maps zone 2 lines which share the prefix "Z2"', () => {
            expect(m('Z2ON')).to.deep.equal(['zone2.power', true]);
            expect(m('Z2OFF')).to.deep.equal(['zone2.power', false]);
            expect(m('Z240')).to.deep.equal(['zone2.volume', 40]);
            expect(m('Z2SOURCE')).to.deep.equal(['zone2.input', 'SOURCE']);
            expect(m('Z2TV')).to.deep.equal(['zone2.input', 'TV']);
            expect(m('Z2MUON')).to.deep.equal(['zone2.mute', true]);
            expect(m('Z2QUICK0')).to.deep.equal(['zone2.quickSelect', 0]);
            expect(m('Z2SLPOFF')).to.deep.equal(['zone2.sleepTimer', 0]);
            expect(m('Z2STBY2H')).to.deep.equal(['zone2.autoStandby', '2H']);
            expect(m('Z2HDA THR')).to.deep.equal(['zone2.hdmiAudio', 'THR']);
            expect(m('Z2CVFL 50')).to.deep.equal(['zone2.channelVolume.frontLeft', 0]);
            expect(m('Z2PSBAS 52')).to.deep.equal(['zone2.audio.bass', 2]);
            // unknown zone settings must not end up as input
            expect(m('Z2CVC 50')).to.equal(undefined);
        });

        it('maps audio settings incl. the ones new in 2.0', () => {
            expect(m('PSBAS 50')).to.deep.equal(['main.audio.bass', 0]);
            expect(m('PSTONE CTRL OFF')).to.deep.equal(['main.audio.toneControl', false]);
            expect(m('PSMULTEQ:AUDYSSEY')).to.deep.equal(['main.audio.multEq', 'AUDYSSEY']);
            expect(m('PSREFLEV 5')).to.deep.equal(['main.audio.referenceLevel', 5]);
            expect(m('PSLFE 10')).to.deep.equal(['main.audio.lfe', -10]);
            expect(m('PSLFE 00')).to.deep.equal(['main.audio.lfe', 0]);
            expect(m('PSSWL ON')).to.deep.equal(['main.audio.subwooferLevelAdjust', true]);
            expect(m('PSSWL 455')).to.deep.equal(['main.audio.subwooferLevel', -4.5]);
            expect(m('PSSWL2 50')).to.deep.equal(['main.audio.subwoofer2Level', 0]);
            expect(m('PSDIL OFF')).to.deep.equal(['main.audio.dialogLevelAdjust', false]);
            expect(m('PSDIL 505')).to.deep.equal(['main.audio.dialogLevel', 0.5]);
            expect(m('PSNEURAL ON')).to.deep.equal(['main.audio.neuralX', true]);
            expect(m('PSCINEMA EQ.OFF')).to.deep.equal(['main.audio.cinemaEq', false]);
            expect(m('PSGEQ OFF')).to.deep.equal(['main.audio.graphicEq', false]);
            expect(m('PSHEQ OFF')).to.deep.equal(['main.audio.headphoneEq', false]);
            expect(m('PSLOM ON')).to.deep.equal(['main.audio.loudness', true]);
            expect(m('PSSWR ON')).to.deep.equal(['main.audio.subwoofer', true]);
            expect(m('PSDELAY 000')).to.deep.equal(['main.audio.audioDelay', 0]);
            expect(m('SDARC')).to.deep.equal(['main.audio.inputMode', 'ARC']);
            expect(m('DCAUTO')).to.deep.equal(['main.audio.digitalInputMode', 'AUTO']);
        });

        it('maps channel levels, video, system, tuner', () => {
            expect(m('CVFL 50')).to.deep.equal(['main.channelVolume.frontLeft', 0]);
            expect(m('CVSW2 455')).to.deep.equal(['main.channelVolume.subwooferTwo', -4.5]);
            expect(m('CVEND')).to.equal(undefined);
            expect(m('VSSCH4K')).to.deep.equal(['main.video.hdmiResolution', '4K']);
            expect(m('VSSCAUTO')).to.deep.equal(['main.video.analogResolution', 'AUTO']);
            expect(m('VSMONIAUTO')).to.deep.equal(['main.video.monitor', 'AUTO']);
            expect(m('VSVPMAUTO')).to.deep.equal(['main.video.processingMode', 'AUTO']);
            expect(m('VSAUDIO AMP')).to.deep.equal(['main.video.hdmiAudioOutput', 'AMP']);
            expect(m('PVOFF')).to.deep.equal(['main.video.pictureMode', 'OFF']);
            expect(m('PVCN 050')).to.equal(undefined);
            expect(m('ECOAUTO')).to.deep.equal(['system.ecoMode', 'AUTO']);
            expect(m('MNZST OFF')).to.deep.equal(['system.allZoneStereo', false]);
            expect(m('MNMEN OFF')).to.deep.equal(['remote.menu', false]);
            expect(m('DIM DIM')).to.deep.equal(['display.brightness', 'DIM']);
            expect(m('SSSMG MOV')).to.deep.equal(['info.soundModeGroup', 'MOV']);
            expect(m('NSFRN Denon AVR-X2200W')).to.deep.equal(['info.name', 'Denon AVR-X2200W']);
            expect(m('TFAN008750')).to.deep.equal(['tuner.frequency', 87.5]);
            expect(m('TFANNAMEWDR 2')).to.deep.equal(['tuner.stationName', 'WDR 2']);
            expect(m('TMANFM')).to.deep.equal(['tuner.band', 'FM']);
            expect(m('TMANAUTO')).to.deep.equal(['tuner.tuningMode', 'AUTO']);
            expect(m('TPAN01')).to.deep.equal(['tuner.preset', 1]);
        });

        it('does not map answers which are no surround mode', () => {
            expect(m('MSQUICK1 MEMORY')).to.equal(undefined);
        });
    });

    describe('formatCommand', () => {
        it('formats the core commands', () => {
            expect(cmd('main.power', true)).to.deep.equal(['ZMON']);
            expect(cmd('system.power', false)).to.deep.equal(['PWSTANDBY']);
            expect(cmd('main.volume', 40.3)).to.deep.equal(['MV405']);
            expect(cmd('main.volumeDb', -40)).to.deep.equal(['MV40']);
            expect(cmd('zone2.volume', 35.5)).to.deep.equal(['Z236']);
            expect(cmd('zone2.volumeDb', -45)).to.deep.equal(['Z235']);
            expect(cmd('main.mute', true)).to.deep.equal(['MUON']);
            expect(cmd('zone2.mute', false)).to.deep.equal(['Z2MUOFF']);
            expect(cmd('main.input', 'TV')).to.deep.equal(['SITV']);
            expect(cmd('main.input', 'Blu-ray')).to.deep.equal(['SIBD']);
            expect(cmd('zone2.input', 'SOURCE')).to.deep.equal(['Z2SOURCE']);
            expect(cmd('main.sleepTimer', 5)).to.deep.equal(['SLP005']);
            expect(cmd('zone2.sleepTimer', 0)).to.deep.equal(['Z2SLPOFF']);
            expect(cmd('main.volumeUp', true)).to.deep.equal(['MVUP']);
            expect(cmd('main.volumeUp', false)).to.deep.equal([]);
        });

        it('sends quick select for the detected brand', () => {
            expect(cmd('main.quickSelect', 2, 'QUICK')).to.deep.equal(['MSQUICK2']);
            expect(cmd('zone2.quickSelect', 1, 'SMART')).to.deep.equal(['Z2SMART1']);
            expect(cmd('main.quickSelect', 3)).to.deep.equal(['MSQUICK3', 'MSSMART3']);
            expect(cmd('main.quickSelect', 9)).to.be.a('string');
        });

        it('formats settings', () => {
            expect(cmd('main.audio.bass', -2)).to.deep.equal(['PSBAS 48']);
            expect(cmd('zone2.audio.treble', 1.5)).to.deep.equal(['Z2PSTRE 515']);
            expect(cmd('main.audio.lfe', -10)).to.deep.equal(['PSLFE 10']);
            expect(cmd('main.audio.lfe', 0)).to.deep.equal(['PSLFE 00']);
            expect(cmd('main.audio.referenceLevel', 10)).to.deep.equal(['PSREFLEV 10']);
            expect(cmd('main.audio.containment', 3)).to.deep.equal(['PSCNTAMT 03']);
            expect(cmd('main.audio.audioDelay', 40)).to.deep.equal(['PSDELAY 040']);
            expect(cmd('main.audio.cinemaEq', true)).to.deep.equal(['PSCINEMA EQ.ON']);
            expect(cmd('main.audio.multEq', 'Flat')).to.deep.equal(['PSMULTEQ:FLAT']);
            expect(cmd('main.video.hdmiResolution', '1080p 24 Hz')).to.deep.equal(['VSSCH10P24']);
            expect(cmd('main.video.processingMode', 'Movie')).to.deep.equal(['VSVPMMOVI']);
            expect(cmd('display.brightness', 'BRI')).to.deep.equal(['DIM BRI']);
            expect(cmd('main.channelVolume.frontLeft', -1.5)).to.deep.equal(['CVFL 485']);
            expect(cmd('tuner.frequency', 106.9)).to.deep.equal(['TFAN010690']);
            expect(cmd('netAudio.loadPreset', 3)).to.deep.equal(['NSB03']);
            expect(cmd('main.surroundMode', 'invalid mode')).to.be.a('string');
            expect(cmd('info.soundModeGroup', 'MOV')).to.be.a('string');
        });

        it('formats tuner frequencies', () => {
            expect(formatFrequency(87.5)).to.equal('008750');
            expect(formatFrequency(522)).to.equal('052200');
            expect(formatFrequency(0)).to.equal(undefined);
        });
    });

    describe('objects', () => {
        it('uses roles of the official ioBroker role list only', () => {
            const official = new Set([
                'state',
                'text',
                'json',
                'value',
                'value.volume',
                'level',
                'level.volume',
                'level.bass',
                'level.treble',
                'level.frequency',
                'level.timer.sleep',
                'switch',
                'switch.power',
                'switch.power.zone',
                'indicator',
                'button',
                'button.volume.up',
                'button.volume.down',
                'button.play',
                'button.pause',
                'button.next',
                'button.prev',
                'media.mute',
                'media.input',
                'info.name',
            ]);
            for (const dp of DATAPOINTS) {
                const role = datapointObject(dp).common.role;
                expect(official.has(role), `${dp.id}: ${role}`).to.equal(true);
            }
        });

        it('creates buttons as write only and read only states without write', () => {
            const btn = datapointObject(DATAPOINTS_BY_ID.get('remote.up')!).common;
            expect(btn).to.include({ type: 'boolean', read: false, write: true, role: 'button' });
            const max = datapointObject(DATAPOINTS_BY_ID.get('main.maxVolume')!).common;
            expect(max).to.include({ write: false, role: 'value.volume' });
        });

        it('links every dependent state to an existing one', () => {
            for (const dp of DATAPOINTS) {
                if (dp.with && dp.with !== 'display.line0') {
                    expect(DATAPOINTS_BY_ID.has(dp.with), `${dp.id} -> ${dp.with}`).to.equal(true);
                }
            }
        });
    });
});
