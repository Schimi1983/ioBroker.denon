const path = require('path');
const net = require('net');
const { expect } = require('chai');
const { tests } = require('@iobroker/testing');

/**
 * Responses recorded live on an AVR-X2200W (2026-10-27). Lines are sent with CR as terminator.
 * The NSE1 line contains 0x0A (LF) as attribute byte (cursor + folder), which used to break the line framing.
 */
const RESPONSES = {
    'SV?': ['SVOFF'],
    'PW?': ['PWON'],
    'ZM?': ['ZMON'],
    'MU?': ['MUOFF'],
    'MV?': ['MV455', 'MVMAX 98'],
    'SI?': ['SITV', 'SVOFF'],
    'MS?': ['MSDOLBY HD+DS', 'PSDRC AUTO', 'PSLFE 00', 'PSBAS 50', 'PSTRE 50', 'PSTONE CTRL OFF'],
    'DIM ?': ['DIM OFF'],
    'VSVPM ?': ['VSVPMAUTO'],
    'CV?': ['CVFL 50', 'CVFR 50', 'CVC 50', 'CVSW 50', 'CVSW2 455', 'CVSL 50', 'CVSR 50', 'CVEND'],
    'Z2?': ['Z2OFF'],
    'NSFRN ?': ['NSFRN Denon AVR-X2200W'],
    'MSQUICK ?': ['MSQUICK0'],
    'Z2QUICK ?': ['Z2QUICK0'],
    'SLP?': ['SLPOFF'],
    'Z2SLP?': ['Z2SLPOFF'],
    'STBY?': ['STBY30M'],
    'ECO?': ['ECOAUTO'],
    'PSDRC ?': ['PSDRC OFF'],
    'PSRSTR ?': ['PSRSTR OFF'],
    'SD?': ['SDNO'],
    'DC?': ['DCAUTO'],
    'SSINFAISSIG ?': ['SSINFAISSIG 02'],
    'SSINFAISFSV ?': ['SSINFAISFSV 48K'],
    'SSINFSIGRES ?': ['SSINFSIGRES 009'],
    MSMOVIE: ['MSDOLBY SURROUND'],
    NSE: [
        `NSE0Online Music${' '.repeat(84)}`,
        `NSE1\nFavorites${' '.repeat(86)}`,
        `NSE2\u0002Internet Radio${' '.repeat(81)}`,
        `NSE3\u0002Media Server${' '.repeat(83)}`,
        `NSE4\u0000${' '.repeat(95)}`,
        `NSE5\u0000${' '.repeat(95)}`,
        `NSE6\u0000${' '.repeat(95)}`,
        `NSE7\u0000${' '.repeat(95)}`,
        `NSE8   [    0/3    ]${' '.repeat(80)}`,
    ],
};

/**
 * Starts a fake AVR on a random local port.
 * Responses are written in small chunks to verify that lines split across TCP packets are reassembled.
 */
function startFakeAvr() {
    const received = [];
    const sockets = new Set();
    const server = net.createServer(socket => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
        let buf = '';
        socket.on('error', () => {});
        socket.on('data', data => {
            buf += data.toString('latin1');
            let idx;
            while ((idx = buf.indexOf('\r')) !== -1) {
                const cmd = buf.substring(0, idx);
                buf = buf.substring(idx + 1);
                received.push(cmd);
                const answer = RESPONSES[cmd];
                if (answer) {
                    const payload = Buffer.from(answer.map(l => `${l}\r`).join(''), 'latin1');
                    for (let i = 0; i < payload.length; i += 7) {
                        socket.write(payload.subarray(i, i + 7));
                    }
                }
            }
        });
    });
    return new Promise(resolve => {
        server.listen(0, '127.0.0.1', () => resolve({ server, sockets, port: server.address().port, received }));
    });
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Telnet communication with a simulated AVR-X2200W', getHarness => {
            let harness;
            let avr;

            before(async function () {
                this.timeout(60_000);
                avr = await startFakeAvr();
                harness = getHarness();
                await harness.changeAdapterConfig('denon', {
                    native: {
                        ip: '127.0.0.1',
                        pollInterval: 2_000,
                        requestInterval: 50,
                        telnetPort: avr.port,
                        // no HTTP server in the test environment
                        useHttpInfo: false,
                    },
                });
                await harness.startAdapterAndWait();
                // initial update sends ~150 queries with 50 ms pacing
                await wait(12_000);
            });

            after(async () => {
                for (const socket of avr.sockets) {
                    socket.destroy();
                }
                await new Promise(resolve => avr.server.close(() => resolve()));
            });

            async function val(id) {
                const state = await harness.states.getStateAsync(`denon.0.${id}`);
                return state ? state.val : undefined;
            }

            it('connects and detects the receiver', async () => {
                expect(await val('info.connection')).to.equal(true);
                expect(await val('info.friendlyName')).to.equal('Denon AVR-X2200W');
            }).timeout(10_000);

            it('parses half dB master volume', async () => {
                expect(await val('zoneMain.volume')).to.equal(45.5);
                expect(await val('zoneMain.volumeDB')).to.equal(-34.5);
            }).timeout(10_000);

            it('accepts surround modes missing in the default list and adds them', async () => {
                expect(await val('settings.surroundMode')).to.equal('DOLBY HD+DS');
                const obj = await harness.objects.getObjectAsync('denon.0.settings.surroundMode');
                expect(obj.common.states).to.have.property('DOLBY HD+DS', 'DOLBY HD+DS');
            }).timeout(10_000);

            it('stores protocol codes for brightness and video processing mode', async () => {
                expect(await val('display.brightness')).to.equal('OFF');
                expect(await val('settings.videoProcessingMode')).to.equal('AUTO');
            }).timeout(10_000);

            it('maps channel volumes incl. SW2 and ignores CVEND', async () => {
                expect(await val('zoneMain.channelVolumeFrontLeft')).to.equal(0);
                expect(await val('zoneMain.channelVolumeSubwooferTwo')).to.equal(-4.5);
                expect(await val('zoneMain.channelVolumeSubwoofer')).to.equal(0);
            }).timeout(10_000);

            it('writes clean display lines incl. the cursor line', async () => {
                expect(await val('display.displayContent0')).to.equal('Online Music');
                expect(await val('display.displayContent1')).to.equal('Favorites');
                expect(await val('display.displayContent2')).to.equal('Internet Radio');
                expect(await val('display.displayContent4')).to.equal('');
            }).timeout(10_000);

            it('creates only existing zones and polls the detected quick select flavor', async () => {
                const z2 = await harness.objects.getObjectAsync('denon.0.zone2.powerZone');
                const z3 = await harness.objects.getObjectAsync('denon.0.zone3.powerZone');
                expect(z2).to.be.ok;
                expect(z3).to.not.be.ok;
                // after detection polls must not ask for zone 3 or for Marantz SMART select anymore
                const before = avr.received.length;
                await wait(5_000);
                const polled = avr.received.slice(before);
                expect(polled).to.include('MSQUICK ?');
                expect(polled).to.not.include('MSSMART ?');
                expect(polled).to.not.include('Z3SLP?');
            }).timeout(15_000);

            it('creates settings with fixed value lists only after the AVR answered', async () => {
                expect(await val('settings.autoStandby')).to.equal('30M');
                expect(await val('settings.ecoMode')).to.equal('AUTO');
                expect(await val('settings.dynamicCompression')).to.equal('OFF');
                expect(await val('settings.audioRestorer')).to.equal('OFF');
                expect(await val('settings.inputMode')).to.equal('NO');
                expect(await val('settings.digitalInputMode')).to.equal('AUTO');
            }).timeout(10_000);

            it('stores signal information and the display cursor line', async () => {
                expect(await val('info.audioSignalCode')).to.equal('02');
                expect(await val('info.audioSampleRate')).to.equal('48K');
                expect(await val('info.videoResolutionCode')).to.equal('009');
                expect(await val('display.cursorLine')).to.equal(1);
            }).timeout(10_000);

            it('sends settings and sound mode group buttons', async () => {
                const before = avr.received.length;
                await harness.states.setStateAsync('denon.0.settings.ecoMode', 'Off');
                await harness.states.setStateAsync('denon.0.settings.autoStandby', '60M');
                await harness.states.setStateAsync('denon.0.settings.dynamicCompression', 'AUTO');
                await harness.states.setStateAsync('denon.0.settings.soundModeMovie', true);
                await wait(1_500);
                const sent = avr.received.slice(before);
                expect(sent).to.include('ECOOFF');
                expect(sent).to.include('STBY60M');
                expect(sent).to.include('PSDRC AUTO');
                expect(sent).to.include('MSMOVIE');
                expect(await val('settings.surroundMode')).to.equal('DOLBY SURROUND');
                const button = await harness.states.getStateAsync('denon.0.settings.soundModeMovie');
                expect(button.ack, 'button is acknowledged').to.equal(true);
            }).timeout(10_000);

            it('accepts index values written by scripts for version 1.x', async () => {
                const before = avr.received.length;
                await harness.states.setStateAsync('denon.0.zoneMain.selectInput', '5');
                await harness.states.setStateAsync('denon.0.settings.surroundMode', '3');
                await harness.states.setStateAsync('denon.0.display.brightness', '3');
                await harness.states.setStateAsync('denon.0.settings.videoProcessingMode', '2');
                await wait(1_500);
                const sent = avr.received.slice(before);
                expect(sent).to.include('SITV');
                expect(sent).to.include('MSMCH STEREO');
                expect(sent).to.include('DIM BRI');
                expect(sent).to.include('VSVPMMOVI');
            }).timeout(10_000);

            it('sends user commands with protocol formatting', async () => {
                const before = avr.received.length;
                await harness.states.setStateAsync('denon.0.zoneMain.volume', 40.3);
                await harness.states.setStateAsync('denon.0.zoneMain.sleepTimer', 5);
                await harness.states.setStateAsync('denon.0.settings.videoProcessingMode', 'Movie');
                await harness.states.setStateAsync('denon.0.display.brightness', 'BRI');
                await wait(1_500);
                const sent = avr.received.slice(before);
                expect(sent).to.include('MV405');
                expect(sent).to.include('SLP005');
                expect(sent).to.include('VSVPMMOVI');
                expect(sent).to.include('DIM BRI');
            }).timeout(10_000);
        });
    },
});
