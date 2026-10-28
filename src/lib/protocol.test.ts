import { expect } from 'chai';
import {
    cleanDisplayText,
    DISPLAY_ATTR_CURSOR,
    DISPLAY_ATTR_FOLDER,
    dbToLevel,
    formatSleepTimer,
    formatVolume,
    formatZoneVolume,
    levelToDb,
    paramOf,
    parseChannelVolume,
    parseDisplayLine,
    parseSignalInfo,
    parseVideoResolution,
    parseVolume,
} from './protocol';

describe('protocol', () => {
    describe('parseVolume / formatVolume', () => {
        it('parses whole and half dB steps (spec rule I)', () => {
            expect(parseVolume('80')).to.equal(80);
            expect(parseVolume('805')).to.equal(80.5);
            expect(parseVolume('455')).to.equal(45.5);
            expect(parseVolume('005')).to.equal(0.5);
            expect(parseVolume('00')).to.equal(0);
            expect(parseVolume('98')).to.equal(98);
        });

        it('rejects non numeric parameters', () => {
            expect(parseVolume('MAX 98')).to.equal(undefined);
            expect(parseVolume('')).to.equal(undefined);
            expect(parseVolume('UP')).to.equal(undefined);
        });

        it('formats volumes with 0.5 rounding and leading zero', () => {
            expect(formatVolume(45.5)).to.equal('455');
            expect(formatVolume(45.4)).to.equal('455');
            expect(formatVolume(45.2)).to.equal('45');
            expect(formatVolume(5)).to.equal('05');
            expect(formatVolume(0.5)).to.equal('005');
            expect(formatVolume(0)).to.equal('00');
        });

        it('formats zone volumes in whole steps (Z2355 is ignored by the AVR-X2200W)', () => {
            expect(formatZoneVolume(35.5)).to.equal('36');
            expect(formatZoneVolume(35.4)).to.equal('35');
            expect(formatZoneVolume(5)).to.equal('05');
            expect(formatZoneVolume(120)).to.equal('98');
        });

        it('clamps out of range volumes', () => {
            expect(formatVolume(-3)).to.equal('00');
            expect(formatVolume(120)).to.equal('98');
            expect(formatVolume(Number.NaN)).to.equal('00');
        });

        it('roundtrips every 0.5 step', () => {
            for (let v = 0; v <= 98; v += 0.5) {
                expect(parseVolume(formatVolume(v))).to.equal(v);
            }
        });
    });

    describe('levels (50 = 0 dB)', () => {
        it('converts levels to dB', () => {
            expect(levelToDb('50')).to.equal(0);
            expect(levelToDb('38')).to.equal(-12);
            expect(levelToDb('62')).to.equal(12);
            expect(levelToDb('505')).to.equal(0.5);
            expect(levelToDb('495')).to.equal(-0.5);
        });

        it('converts dB to levels', () => {
            expect(dbToLevel(0)).to.equal('50');
            expect(dbToLevel(-12)).to.equal('38');
            expect(dbToLevel(0.5)).to.equal('505');
            expect(dbToLevel(-0.5)).to.equal('495');
        });
    });

    describe('parseChannelVolume', () => {
        it('parses channel levels incl. channels with digits', () => {
            expect(parseChannelVolume('CVFL 50')).to.deep.equal({
                type: 'level',
                channelCode: 'FL',
                stateSuffix: 'FrontLeft',
                db: 0,
            });
            expect(parseChannelVolume('CVSW2 455')).to.deep.include({
                channelCode: 'SW2',
                stateSuffix: 'SubwooferTwo',
                db: -4.5,
            });
            expect(parseChannelVolume('CVC 50')).to.deep.include({ stateSuffix: 'Center' });
        });

        it('recognizes the list terminator CVEND (was logged as unknown channel before)', () => {
            expect(parseChannelVolume('CVEND')).to.deep.equal({ type: 'end' });
        });

        it('reports unknown channels without suffix', () => {
            expect(parseChannelVolume('CVXYZ 50')).to.deep.include({ channelCode: 'XYZ', stateSuffix: undefined });
        });
    });

    describe('display lines (live data AVR-X2200W)', () => {
        it('parses the title line without attribute byte', () => {
            const line = parseDisplayLine(`NSE0Online Music${' '.repeat(84)}`);
            expect(line).to.deep.equal({ index: 0, text: 'Online Music', attributes: undefined });
        });

        it('parses list lines with attribute byte', () => {
            const line = parseDisplayLine(`NSE2\u0002Internet Radio${' '.repeat(81)}`);
            expect(line?.text).to.equal('Internet Radio');
            expect(line?.attributes).to.equal(DISPLAY_ATTR_FOLDER);
        });

        it('parses the cursor line whose attribute byte is LF (0x0A)', () => {
            const line = parseDisplayLine(`NSE1\nFavorites${' '.repeat(86)}`);
            expect(line?.text).to.equal('Favorites');
            expect(line?.attributes).to.equal(DISPLAY_ATTR_CURSOR | DISPLAY_ATTR_FOLDER);
        });

        it('removes NUL padding and control characters', () => {
            expect(parseDisplayLine(`NSE4\u0000${' '.repeat(95)}`)?.text).to.equal('');
            expect(parseDisplayLine(`NSE1\u0004Keine Verbindung${' '.repeat(79)}`)?.text).to.equal('Keine Verbindung');
            expect(parseDisplayLine(`NSE0\u0000${' '.repeat(95)}`)?.text).to.equal('');
        });

        it('keeps the page indicator line', () => {
            expect(parseDisplayLine('NSE8$  [    1/1    ]      ')?.text).to.equal('$  [    1/1    ]');
        });

        it('ignores a bare NSE', () => {
            expect(parseDisplayLine('NSE')).to.equal(undefined);
        });

        it('cleanDisplayText cuts at the first NUL', () => {
            expect(cleanDisplayText('Song\u0000garbage')).to.equal('Song');
        });
    });

    describe('paramOf / signal info', () => {
        it('splits prefix and parameter', () => {
            expect(paramOf('STBY30M', 'STBY')).to.equal('30M');
            expect(paramOf('PSDRC AUTO', 'PSDRC')).to.equal('AUTO');
            expect(paramOf('ECOAUTO', 'ECO')).to.equal('AUTO');
            expect(paramOf('DIM BRI', 'DIM')).to.equal('BRI');
            expect(paramOf('VSVPMAUTO', 'VSVPM')).to.equal('AUTO');
            expect(paramOf('MVMAX 98', 'ECO')).to.equal(undefined);
        });

        it('parses SSINF responses', () => {
            expect(parseSignalInfo('SSINFAISFSV 48K')).to.deep.equal({ key: 'AISFSV', value: '48K' });
            expect(parseSignalInfo('SSINFAISSIG 09')).to.deep.equal({ key: 'AISSIG', value: '09' });
            expect(parseSignalInfo('SSINFSIGRES 099')).to.deep.equal({ key: 'SIGRES', value: '099' });
            expect(parseSignalInfo('SSINFAISFSV NON')).to.deep.equal({ key: 'AISFSV', value: 'NON' });
        });
    });

    describe('formatSleepTimer', () => {
        it('formats minutes with 3 digits', () => {
            expect(formatSleepTimer(0)).to.equal('OFF');
            expect(formatSleepTimer(5)).to.equal('005');
            expect(formatSleepTimer(30)).to.equal('030');
            expect(formatSleepTimer(120)).to.equal('120');
            expect(formatSleepTimer(121)).to.equal(undefined);
        });
    });
});

describe('parseVideoResolution', () => {
    it('decodes the 3 digit code of the AVR-X2200W (verified live 2026-10-28)', () => {
        expect(parseVideoResolution('077')).to.deep.equal({ input: '1080p', output: '1080p' });
        expect(parseVideoResolution('088')).to.deep.equal({ input: '1080p 24Hz', output: '1080p 24Hz' });
        expect(parseVideoResolution('099')).to.deep.equal({ input: '2160p 24/25Hz', output: '2160p 24/25Hz' });
        expect(parseVideoResolution('009')).to.deep.equal({ input: 'no signal', output: '2160p 24/25Hz' });
        expect(parseVideoResolution('000')).to.deep.equal({ input: 'no signal', output: 'no signal' });
        expect(parseVideoResolution('066')).to.deep.equal({ input: '720p', output: '720p' });
        expect(parseVideoResolution('022')).to.deep.equal({ input: '480p/576p', output: '480p/576p' });
    });

    it('decodes A as 2160p 50/60 Hz (NVIDIA Shield at 4K 59.94 Hz)', () => {
        expect(parseVideoResolution('0AA')).to.deep.equal({ input: '2160p 50/60Hz', output: '2160p 50/60Hz' });
    });

    it('reports digits which are not verified yet with the raw digit', () => {
        expect(parseVideoResolution('033')).to.deep.equal({ input: 'unknown (3)', output: 'unknown (3)' });
    });

    it('decodes the I/O format of newer models', () => {
        expect(parseVideoResolution('I1080p60')).to.deep.equal({ input: '1080p60' });
        expect(parseVideoResolution('O2160p60')).to.deep.equal({ output: '2160p60' });
        expect(parseVideoResolution('I---')).to.deep.equal({ input: 'no signal' });
    });

    it('rejects other values', () => {
        expect(parseVideoResolution('NON')).to.equal(undefined);
        expect(parseVideoResolution('')).to.equal(undefined);
    });
});
