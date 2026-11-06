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
    'ZM?': ['ZMOFF'],
    ZMON: ['ZMON'],
    'MU?': ['MUOFF'],
    'MV?': ['MV455', 'MVMAX 98'],
    'SI?': ['SITV', 'SVOFF'],
    'MS?': ['MSDOLBY HD+DS', 'PSDRC AUTO', 'PSLFE 00', 'PSBAS 50', 'PSTRE 50', 'PSTONE CTRL OFF'],
    'DIM ?': ['DIM OFF'],
    'VSVPM ?': ['VSVPMAUTO'],
    'CV?': ['CVFL 50', 'CVFR 50', 'CVC 50', 'CVSW 50', 'CVSW2 455', 'CVSL 50', 'CVSR 50', 'CVEND'],
    'Z2?': ['Z2OFF', 'Z2SOURCE', 'Z240'],
    Z236: ['Z236'],
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
    MSMOVIE: ['MSDOLBY SURROUND', 'SSSMG MOV'],
    'VSSCH ?': ['VSSCH4K'],
    'VSSC ?': ['VSSCAUTO'],
    'VSASP ?': ['VSASPFUL'],
    'SSSMG ?': ['SSSMG MUS'],
    'SSINFFRM ?': ['SSINFFRMAVR 4700-0591-4030', 'SSINFFRMDTS 3.90.50.00'],
    'SSFUN ?': ['SSFUNTV TV Audio', 'SSFUNBD Blu-ray', 'SSFUNSAT/CBL CBL/SAT', 'SSFUNMPLAY Shield', 'SSFUNEND'],
    'SSSOD ?': ['SSSODTV USE', 'SSSODBD USE', 'SSSODSAT/CBL USE', 'SSSODMPLAY USE', 'SSSODSIRIUSXM DEL', 'SSSODEND'],
    'SSQSNZMA ?': ['SSQSNZMAQS1 Movie', 'SSQSNZMAQS2 Music', 'SSQSNZMAEND'],
    'PSNEURAL ?': ['PSNEURAL ON'],
    'PSCINEMA EQ. ?': ['PSCINEMA EQ.OFF'],
    'PSLOM ?': ['PSLOM ON'],
    'PSSWR ?': ['PSSWR ON'],
    'PSDELAY ?': ['PSDELAY 000'],
    'MNZST?': ['MNZST OFF'],
    'Z2STBY?': ['Z2STBY2H'],
    'Z2HDA?': ['Z2HDA THR'],
    'VSAUDIO ?': ['VSAUDIO AMP'],
    'TMAN?': ['TMANFM'],
    'TPAN?': ['TPAN01'],
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
                expect(await val('info.name')).to.equal('Denon AVR-X2200W');
            }).timeout(10_000);

            it('parses half dB master volume', async () => {
                expect(await val('main.volume')).to.equal(45.5);
                expect(await val('main.volumeDb')).to.equal(-34.5);
                expect(await val('main.maxVolume')).to.equal(98);
            }).timeout(10_000);

            it('accepts surround modes missing in the default list and adds them', async () => {
                expect(await val('main.surroundMode')).to.equal('DOLBY HD+DS');
                const obj = await harness.objects.getObjectAsync('denon.0.main.surroundMode');
                expect(obj.common.states).to.have.property('DOLBY HD+DS', 'DOLBY HD+DS');
            }).timeout(10_000);

            it('stores protocol codes for brightness and video processing mode', async () => {
                expect(await val('display.brightness')).to.equal('OFF');
                expect(await val('main.video.processingMode')).to.equal('AUTO');
            }).timeout(10_000);

            it('creates channel levels only for existing speakers', async () => {
                expect(await val('main.channelVolume.frontLeft')).to.equal(0);
                expect(await val('main.channelVolume.subwooferTwo')).to.equal(-4.5);
                const missing = await harness.objects.getObjectAsync('denon.0.main.channelVolume.topFrontLeft');
                expect(missing).to.not.be.ok;
            }).timeout(10_000);

            it('writes clean display lines incl. the cursor line and creates the play buttons', async () => {
                expect(await val('display.line0')).to.equal('Online Music');
                expect(await val('display.line1')).to.equal('Favorites');
                expect(await val('display.line2')).to.equal('Internet Radio');
                expect(await val('display.line4')).to.equal('');
                expect(await val('display.cursorLine')).to.equal(1);
                const play = await harness.objects.getObjectAsync('denon.0.remote.play');
                expect(play.common.role).to.equal('button.play');
            }).timeout(10_000);

            it('creates only existing zones and polls the detected quick select flavor', async () => {
                const z2 = await harness.objects.getObjectAsync('denon.0.zone2.power');
                const z3 = await harness.objects.getObjectAsync('denon.0.zone3.power');
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

            it('uses input and quick select names of the AVR and lists only used inputs', async () => {
                const obj = await harness.objects.getObjectAsync('denon.0.main.input');
                expect(obj.common.states).to.deep.equal({
                    TV: 'TV Audio',
                    BD: 'Blu-ray',
                    'SAT/CBL': 'CBL/SAT',
                    MPLAY: 'Shield',
                });
                const z2 = await harness.objects.getObjectAsync('denon.0.zone2.input');
                expect(z2.common.states).to.have.property('SOURCE');
                expect(z2.common.states).to.have.property('MPLAY', 'Shield');
                const quick = await harness.objects.getObjectAsync('denon.0.main.quickSelect');
                expect(quick.common.states).to.deep.equal({ 1: 'Movie', 2: 'Music' });
            }).timeout(10_000);

            it('creates settings only after the AVR answered', async () => {
                expect(await val('main.autoStandby')).to.equal('30M');
                expect(await val('system.ecoMode')).to.equal('AUTO');
                expect(await val('main.audio.dynamicCompression')).to.equal('OFF');
                expect(await val('main.audio.audioRestorer')).to.equal('OFF');
                expect(await val('main.audio.inputMode')).to.equal('NO');
                expect(await val('main.audio.digitalInputMode')).to.equal('AUTO');
                expect(await val('main.audio.neuralX')).to.equal(true);
                expect(await val('main.audio.cinemaEq')).to.equal(false);
                expect(await val('main.audio.loudness')).to.equal(true);
                expect(await val('main.audio.subwoofer')).to.equal(true);
                expect(await val('main.audio.audioDelay')).to.equal(0);
                expect(await val('system.allZoneStereo')).to.equal(false);
                expect(await val('zone2.autoStandby')).to.equal('2H');
                expect(await val('zone2.hdmiAudio')).to.equal('THR');
                expect(await val('main.video.hdmiAudioOutput')).to.equal('AMP');
                expect(await val('tuner.band')).to.equal('FM');
                expect(await val('tuner.preset')).to.equal(1);
                const geq = await harness.objects.getObjectAsync('denon.0.main.audio.graphicEq');
                expect(geq, 'no answer, no state').to.not.be.ok;
            }).timeout(10_000);

            it('reads firmware, video settings and the sound mode group', async () => {
                expect(await val('info.firmware')).to.equal('4700-0591-4030');
                expect(await val('info.firmwareDts')).to.equal('3.90.50.00');
                expect(await val('main.video.hdmiResolution')).to.equal('4K');
                expect(await val('main.video.analogResolution')).to.equal('AUTO');
                expect(await val('main.video.aspectRatio')).to.equal('FUL');
                expect(await val('info.soundModeGroup')).to.equal('MUS');
            }).timeout(10_000);

            it('stores signal information as code and plain text', async () => {
                expect(await val('info.audioSignalCode')).to.equal('02');
                expect(await val('info.audioSignal')).to.equal('PCM');
                expect(await val('info.audioSampleRate')).to.equal('48K');
                expect(await val('info.videoResolutionCode')).to.equal('009');
                expect(await val('info.videoInputResolution')).to.equal('no signal');
                expect(await val('info.videoOutputResolution')).to.equal('2160p 24/25Hz');
            }).timeout(10_000);

            it('sends settings and sound mode group buttons', async () => {
                const before = avr.received.length;
                await harness.states.setStateAsync('denon.0.system.ecoMode', 'Off');
                await harness.states.setStateAsync('denon.0.main.autoStandby', '60M');
                await harness.states.setStateAsync('denon.0.main.audio.dynamicCompression', 'AUTO');
                await harness.states.setStateAsync('denon.0.main.video.hdmiResolution', '1080p 24 Hz');
                await harness.states.setStateAsync('denon.0.main.audio.neuralX', false);
                await harness.states.setStateAsync('denon.0.main.soundModeMovie', true);
                await wait(1_500);
                const sent = avr.received.slice(before);
                expect(sent).to.include('ECOOFF');
                expect(sent).to.include('STBY60M');
                expect(sent).to.include('PSDRC AUTO');
                expect(sent).to.include('VSSCH10P24');
                expect(sent).to.include('PSNEURAL OFF');
                expect(sent).to.include('MSMOVIE');
                expect(await val('info.soundModeGroup')).to.equal('MOV');
                expect(await val('main.surroundMode')).to.equal('DOLBY SURROUND');
                const button = await harness.states.getStateAsync('denon.0.main.soundModeMovie');
                expect(button.ack, 'button is acknowledged').to.equal(true);
            }).timeout(10_000);

            it('selects inputs by code or by name of the AVR', async () => {
                const before = avr.received.length;
                await harness.states.setStateAsync('denon.0.main.input', 'Shield');
                await harness.states.setStateAsync('denon.0.main.input', 'BD');
                await harness.states.setStateAsync('denon.0.main.quickSelect', 2);
                await wait(1_500);
                const sent = avr.received.slice(before);
                expect(sent).to.include('SIMPLAY');
                expect(sent).to.include('SIBD');
                expect(sent).to.include('MSQUICK2');
            }).timeout(10_000);

            it('handles zone 2 input SOURCE and whole step zone volumes (live AVR-X2200W)', async () => {
                expect(await val('zone2.input')).to.equal('SOURCE');
                expect(await val('zone2.volume')).to.equal(40);
                expect(await val('zone2.volumeDb')).to.equal(-40);
                const before = avr.received.length;
                await harness.states.setStateAsync('denon.0.zone2.volume', 35.5);
                await wait(1_500);
                const sent = avr.received.slice(before);
                expect(sent).to.include('Z236');
                expect(sent).to.not.include('Z2355');
                expect(await val('zone2.volume')).to.equal(36);
            }).timeout(10_000);

            it('reads the settings again when the main zone is switched on', async () => {
                const before = avr.received.length;
                await harness.states.setStateAsync('denon.0.main.power', true);
                await wait(5_000);
                const sent = avr.received.slice(before);
                expect(sent).to.include('ZMON');
                expect(sent).to.include('VSSCH ?');
                expect(await val('main.power')).to.equal(true);
            }).timeout(15_000);

            it('sends user commands with protocol formatting', async () => {
                const before = avr.received.length;
                await harness.states.setStateAsync('denon.0.main.volume', 40.3);
                await harness.states.setStateAsync('denon.0.main.sleepTimer', 5);
                await harness.states.setStateAsync('denon.0.main.video.processingMode', 'Movie');
                await harness.states.setStateAsync('denon.0.display.brightness', 'BRI');
                await harness.states.setStateAsync('denon.0.main.audio.bass', -2);
                await wait(1_500);
                const sent = avr.received.slice(before);
                expect(sent).to.include('MV405');
                expect(sent).to.include('SLP005');
                expect(sent).to.include('VSVPMMOVI');
                expect(sent).to.include('DIM BRI');
                expect(sent).to.include('PSBAS 48');
            }).timeout(10_000);
        });
    },
});
