![Logo](admin/denon.png)

# ioBroker.denon

[![NPM version](https://img.shields.io/npm/v/iobroker.denon.svg)](https://www.npmjs.com/package/iobroker.denon)
[![Downloads](https://img.shields.io/npm/dm/iobroker.denon.svg)](https://www.npmjs.com/package/iobroker.denon)
![Number of Installations](https://iobroker.live/badges/denon-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/denon-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.denon.png?downloads=true)](https://nodei.co/npm/iobroker.denon/)

**Tests:** ![Test and Release](https://github.com/foxriver76/ioBroker.denon/workflows/Test%20and%20Release/badge.svg)

## Denon/Marantz AVR adapter for ioBroker

Control your Denon or Marantz AV receiver from ioBroker. The adapter connects to the receiver via the official
telnet control protocol (port 23), receives all changes in real time and creates states for power, volume, inputs,
surround modes, zones, tuner, display and many audio/video settings.

[🇩🇪 Deutsche Dokumentation](docs/de/README.md)

## Disclaimer

DENON and Marantz are trademarks of D&M Holdings Inc.
The developers of this module are in no way endorsed by or affiliated with D&M Holdings Inc.,
or any associated subsidiaries, logos or trademarks.

## Table of contents

* [Requirements](#requirements)
* [Installation](#installation)
* [Configuration](#configuration)
* [Network setup of the AV receiver](#network-setup-of-the-av-receiver)
* [Usage notes](#usage-notes)
* [Upgrading from 1.x](#upgrading-from-1x)
* [States](#states)
* [Multi zone amplifiers (DENON POA-3012CI)](#multi-zone-amplifiers-denon-poa-3012ci)
* [Missing functions & bugs](#missing-functions--bugs)
* [Changelog](#changelog)
* [License](#license)

## Requirements

* Denon or Marantz AV receiver with network connection (LAN or WLAN) and network control enabled
* Node.js >= 22
* js-controller >= 6.0.11
* Admin >= 7.6.20

## Installation

Install the adapter via the ioBroker admin interface: open the tab "Adapters", search for "denon" and click on the "+" symbol.

## Configuration

| Setting | Description |
|---|---|
| IP address or hostname of the AVR | IPv4 address, IPv6 address or hostname of the receiver. While the instance is running, receivers found in the network via UPnP/SSDP are offered as suggestions. The search only finds devices in the same subnet as ioBroker, otherwise enter the address manually. |
| Poll interval (ms) | Interval for values the receiver does not report by itself (display, sleep timer, quick select, signal information). Default: 7000 ms |
| Interval between commands (ms) | Minimum gap between two commands. The protocol requires at least 50 ms. Default: 100 ms |
| Telnet port | 23 on all receivers. Only change it if a serial-to-IP bridge is used. |
| Identify device via HTTP | Reads `Deviceinfo.xml` once at startup to detect brand (Denon/Marantz), model and number of zones. Queries for zones which do not exist are skipped. Control and all state updates always use telnet. Default: on |

## Network setup of the AV receiver

1. Press the SETUP button on the remote, the menu appears on the front display and the TV
2. Select "Network" → "Settings" and configure
    * DHCP: "On" if a DHCP server (e.g. router) is available, otherwise set IP address, subnet mask and gateway manually
    * Proxy: "Off"
3. Select "Network" → "Network Control" (on some models "IP Control") and set it to **"Always On"**.
   With "Off In Standby" the receiver ignores network commands in standby and cannot be switched on by ioBroker.

## Usage notes

* **Only one telnet connection:** the receiver accepts a single telnet connection. If another application is connected
  (e.g. Home Assistant, the Denon/Marantz app, a script), the connection of the adapter is refused. A refused connection
  is reported as warning if it lasts longer than 30 seconds, because a booting receiver also refuses connections for a few seconds.
* **Reconnect:** the adapter reconnects automatically after a connection loss (1 s, 2 s, 4 s ... up to 60 s).
  If the receiver does not send anything for 30 seconds, a keepalive query is sent; without an answer the connection is re-established.
  Scripts which restart the instance on connection loss are not needed.
* **Command pacing:** commands are queued and sent with the configured interval. Commands of the user are sent before
  pending polls. After switching on the receiver or a zone, the next command is delayed by 1 second as required by the protocol.
* **Features depending on the model:** many states are only created once the receiver answers the related query,
  so a model without the feature gets no state. Surround modes and inputs reported by the receiver which are missing in the
  value list are added automatically.
* **Denon and Marantz:** quick select uses `QUICK` on Denon and `SMART` on Marantz receivers. The adapter detects the brand
  and only sends the matching command.
* **HEOS models:** receivers with HEOS (models from 2016) do not report the network display content and cover via telnet.

## Upgrading from 1.x

Version 2.0.0 changes the values reported in some states to the protocol codes. Scripts and visualizations which compare
the **read** values have to be adapted:

| State | Values up to 1.x | Values from 2.0.0 |
|---|---|---|
| `display.brightness` | `Off`, `Dark`, `Dimmed`, `Bright` | `OFF`, `DAR`, `DIM`, `BRI` |
| `settings.videoProcessingMode` | `AUTO`, `GAME`, `MOVIE` (in fact reported as `MAUTO` etc.) | `AUTO`, `GAME`, `MOVI`, `BYP` |
| `settings.pictureMode` | never filled | `OFF`, `STD`, `MOV`, `VVD`, `STM`, `CTM`, `DAY`, `NGT` |

Writing still works with the old values: the label (e.g. `Bright`, `Movie`) as well as the list index of 1.x
(e.g. `selectInput` = `'5'` for TV, `surroundMode` = `'3'` for MCH STEREO) are converted to the protocol code.
Inputs, surround modes, MultEQ and dynamic volume keep their values; only the value lists now use the value as key.
Existing objects are migrated automatically at the first start.

## States

Values marked with *(on demand)* are only created if the receiver answers the related query.

### Channel: info

| State | Type | R/W | Description |
|---|---|---|---|
| `info.connection` | boolean | R | `true` while the telnet connection is established |
| `info.friendlyName` | string | R | Friendly name of the receiver |
| `info.model` | string | R | Model, e.g. `AVR-X2200W` (HTTP identification) |
| `info.brand` | string | R | `Denon` or `Marantz` (HTTP identification) |
| `info.zones` | number | R | Number of zones incl. main zone (HTTP identification) |
| `info.audioSignalCode` | string | R | *(on demand)* Code of the audio input signal, see table below |
| `info.audioSampleRate` | string | R | *(on demand)* Sample rate of the audio input signal, e.g. `48K` |
| `info.videoResolutionCode` | string | R | *(on demand)* Raw code of the video resolution (models up to about 2016) |
| `info.videoInputResolution` / `info.videoOutputResolution` | string | R | *(on demand)* Resolution of the HDMI input / output, e.g. `1080p`, `1080p 24Hz`, `2160p`, `no signal` |
| `info.firmware` / `info.firmwareDts` | string | R | *(on demand)* Firmware version of the receiver and of the DTS decoder |
| `info.onlinePresets` | string | R | JSON array of the saved network audio favorites (id and channel) |

Signal codes measured on an AVR-X2200W. The codes depend on the model generation, newer models may use other values:

| `audioSignalCode` | Signal | | `videoResolutionCode` digit | Resolution |
|---|---|---|---|---|
| `01` | standby / analog | | `0` | no signal |
| `02` | PCM | | `2` | 480p/576p |
| `03` | Dolby Digital | | `6` | 720p |
| `04` | Dolby Digital Plus | | `7` | 1080p 50/60 Hz |
| `05` | Dolby TrueHD | | `8` | 1080p 24 Hz |
| `06` | DTS | | `9` | 2160p (4K) |
| `09` | DTS-HD | | | |
| `12` | switching, no signal yet | | | |

The video code consists of `0`, the digit of the input and the digit of the output, e.g. `088` = 1080p 24 Hz in and out, `009` = no input (TV via ARC), 4K output.
Other digits are reported as `unknown (n)` until they are verified.

### Channel: zoneMain / zone2 / zone3

Zone 2 and zone 3 are created once the receiver reports them. All states exist per zone unless noted otherwise.

| State | Type | R/W | Description |
|---|---|---|---|
| `powerZone` | boolean | R/W | Power of the zone |
| `volume` | number | R/W | Volume 0 ... 98, 80 = 0 dB. Main zone in steps of 0.5, zone 2/3 in whole steps only (values are rounded) |
| `volumeDB` | number | R/W | Volume in dB, -80 ... +18 |
| `volumeUp` / `volumeDown` | button | W | Increase / decrease volume |
| `maximumVolume` / `maximumVolumeDB` | number | R | Maximum volume (main zone only) |
| `muteIndicator` | boolean | R/W | Mute |
| `selectInput` | string | R/W | Input source, e.g. `TV`, `SAT/CBL`, `BD`, `GAME`, `MPLAY`, `NET`, `BT`, `TUNER`, `AUX1`. Zone 2/3: `SOURCE` = follows the input of the main zone. Inputs reported by the receiver are added to the value list. |
| `quickSelect` | number | R/W | Quick select / smart select 1 ... 5, `0` = none active |
| `sleepTimer` | number | R/W | Sleep timer in minutes 0 ... 120, `0` = off |
| `equalizerBass` / `equalizerTreble` | number | R/W | Bass / treble -6 ... +6 dB (Dynamic EQ off and tone control on required) |
| `equalizerBassUp` / `equalizerBassDown` / `equalizerTrebleUp` / `equalizerTrebleDown` | button | W | Step bass / treble |
| `channelVolume<Speaker>` | number | R/W | Channel level -12 ... +12 dB per speaker, e.g. `channelVolumeFrontLeft`, `channelVolumeCenter`, `channelVolumeSubwooferTwo`. The main zone has all speakers of the protocol, zone 2/3 front left and right |
| `playPause` / `play` / `pause` / `skipPlus` / `skipMinus` | button | W | Playback control for network, Bluetooth and USB sources (main zone only) |
| `iconURL` | string | R | URL of the cover of the network source (main zone only, not for HEOS models) |

```javascript
setState('denon.0.zoneMain.volume', 45.5); // volume 45.5 (-34.5 dB)
setState('denon.0.zoneMain.selectInput', 'TV'); // select input TV
```

### Channel: settings

| State | Type | R/W | Description |
|---|---|---|---|
| `powerSystem` | boolean | R/W | System power (on / standby) |
| `surroundMode` | string | R/W | Surround mode as reported by the receiver, e.g. `STEREO`, `DOLBY SURROUND`, `DTS HD+NEURAL:X`. New modes are added to the value list automatically |
| `soundModeMovie` / `soundModeMusic` / `soundModeGame` / `soundModeDirect` / `soundModePureDirect` / `soundModeStereo` / `soundModeAuto` | button | W | Select a surround mode group; the receiver picks the best mode of the group for the current signal |
| `soundModeGroup` | string | R | *(on demand)* Active surround mode group: `MOV` (movie), `MUS` (music), `GAM` (game), `PUR` (pure) |
| `dynamicEq` | boolean | R/W | Audyssey Dynamic EQ |
| `multEq` | string | R/W | MultEQ: `OFF`, `AUDYSSEY`, `BYP.LR`, `FLAT`, `MANUAL` |
| `dynamicVolume` | string | R/W | Dynamic volume: `OFF`, `LIT`, `MED`, `HEV` |
| `referenceLevelOffset` | string | R/W | Reference level offset: `0`, `5`, `10`, `15` dB |
| `audysseyLfc` | boolean | R/W | *(on demand)* Audyssey Low Frequency Containment |
| `containmentAmount` | number | R/W | *(on demand)* LFC amount 1 ... 7, buttons `containmentAmountUp` / `containmentAmountDown` |
| `toneControl` | boolean | R/W | Tone control (only possible with Dynamic EQ off) |
| `subwooferLevelState` | boolean | R/W | Enables the subwoofer level adjustment |
| `subwooferLevel` / `subwooferTwoLevel` | number | R/W | Subwoofer level -12 ... +12 dB (`subwooferTwoLevel` on demand), buttons `subwooferLevelUp/Down`, `subwooferTwoLevelUp/Down` |
| `lfeAmount` | number | R/W | LFE level 0 ... 10, 10 = -10 dB |
| `centerSpread` | boolean | R/W | Center spread |
| `dialogLevelAdjust` / `dialogLevel` | boolean / number | R/W | Dialog level adjustment for DTS content, -12 ... +12 dB |
| `dialogControl` | number | R/W | DTS:X dialog control 0 ... 6 dB |
| `dynamicCompression` | string | R/W | *(on demand)* Dynamic range compression: `AUTO`, `LOW`, `MID`, `HI`, `OFF` |
| `audioRestorer` | string | R/W | *(on demand)* Audio restorer: `OFF`, `LOW`, `MED`, `HI` |
| `ecoMode` | string | R/W | *(on demand)* ECO mode: `ON`, `AUTO`, `OFF` |
| `autoStandby` | string | R/W | *(on demand)* Auto standby of the main zone: `15M`, `30M`, `60M`, `OFF` |
| `inputMode` | string | R/W | *(on demand)* Audio input mode: `AUTO`, `HDMI`, `DIGITAL`, `ANALOG`, `EXT.IN`, `7.1IN`, `ARC`; `NO` = no input signal |
| `digitalInputMode` | string | R/W | *(on demand)* Digital input mode: `AUTO`, `PCM`, `DTS` |
| `outputMonitor` | number | R/W | *(on demand)* HDMI output for receivers with two outputs: `0` auto, `1`, `2` |
| `videoProcessingMode` | string | R/W | *(on demand)* Video processing: `AUTO`, `GAME`, `MOVI`, `BYP` |
| `hdmiResolution` / `analogResolution` | string | R/W | *(on demand)* Output resolution of the video conversion (HDMI / analog): `48P`, `10I`, `72P`, `10P`, `10P24`, `4K`, `4KF`, `AUTO` |
| `aspectRatio` | string | R/W | *(on demand)* Aspect ratio: `NRM` (4:3), `FUL` (16:9) |
| `pictureMode` | string | R/W | *(on demand)* Picture mode: `OFF`, `STD`, `MOV`, `VVD`, `STM`, `CTM`, `DAY`, `NGT` |
| `speakerPreset` | number | R/W | *(on demand)* Speaker preset `1` or `2` |
| `setupMenu` | boolean | R/W | Opens / closes the setup menu |
| `cursorUp` / `cursorDown` / `cursorLeft` / `cursorRight` / `enter` / `return` / `option` / `info` | button | W | Remote control buttons for menu navigation |
| `savePreset` / `loadPreset` | string | R/W | Saves the current network audio channel to / loads it from the given id of `info.onlinePresets`. These states are not acknowledged |
| `expertCommand` | string | R/W | Sends any protocol command, e.g. `ECOON`. See [AVR-Control-Protocol.pdf](docs/AVR-Control-Protocol.pdf) |
| `expertReadingPattern` | string | R/W | Regular expression (without leading/trailing `/`); matching lines received from the receiver are written to `expertReadingResult` |
| `expertReadingResult` | string | R | Last received line which matches `expertReadingPattern` |

Writing a value list state accepts the protocol code or the label, e.g. both `MOVI` and `Movie` for `videoProcessingMode`.

```javascript
setState('denon.0.settings.surroundMode', 'MCH STEREO');
setState('denon.0.settings.soundModeMovie', true); // best movie mode for the current signal
setState('denon.0.settings.expertReadingPattern', '(MV.+)|(SSINFAISFSV.+)');
setState('denon.0.settings.expertCommand', 'ECOON');
```

### Channel: display

| State | Type | R/W | Description |
|---|---|---|---|
| `displayContent0` ... `displayContent8` | string | R | Content of the network menu / now playing display, line 0 is the title, line 8 the page indicator (not for HEOS models) |
| `cursorLine` | number | R | *(on demand)* Line 1 ... 7 which carries the cursor |
| `brightness` | string | R/W | Front display: `OFF`, `DAR` (dark), `DIM` (dimmed), `BRI` (bright) |

### Channel: tuner

| State | Type | R/W | Description |
|---|---|---|---|
| `frequency` | number | R/W | Tuner frequency, below 500 FM in MHz (e.g. `106.9`), above 500 AM in kHz |
| `frequencyUp` / `frequencyDown` | button | W | Step the frequency |
| `stationName` | string | R | RDS station name if available |

## Multi zone amplifiers (DENON POA-3012CI)

Multi zone amplifiers like the DENON POA-3012CI use a different protocol. The states `info.connection`, `settings.powerSystem`,
`settings.expertCommand` and `display.brightness` are equal to the ones above. Additionally the following states are created
for each zone 2 ... 12 (even numbers):

| State | Type | R/W | Description |
|---|---|---|---|
| `zoneX.speakerOneVolume` / `zoneX.speakerTwoVolume` | number | R/W | Volume of the speaker 0 ... 99. In operation mode `BRIDGED` both speakers are controlled together |
| `zoneX.selectInputOne` / `zoneX.selectInputTwo` | string | R/W | Input of the speaker: `0` BUS L, `1` BUS R, `2` BUS M, `3` AUX |
| `zoneX.operationMode` | string | R/W | `0` NORMAL, `1` BRIDGED |
| `zoneX.lowCutFilterSpeakerOne` / `zoneX.lowCutFilterSpeakerTwo` | boolean | R/W | Low cut filter of the speaker |
| `zoneX.zoneTurnOnModeChange` | string | R/W | `0` constant, `1` trigger in, `2` audio signal, `3` off |
| `zoneX.triggerInput` | boolean | R/W | Trigger input |
| `zoneX.audioSignalInput` | boolean | R/W | Audio signal input |
| `settings.powerConfigurationChange` | string | R/W | Power configuration |
| `settings.masterTriggerInput` | boolean | R/W | Master trigger input |

## Missing functions & bugs

If you are missing any functions or detected a bug, please open an [issue](https://github.com/foxriver76/ioBroker.denon/issues).
Please add a debug log and the model of your receiver.

The adapter is tested with a DENON AVR-X1200W, a DENON AVR-X2200W and a Marantz SR5009.

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
* (Schimi1983) **Breaking:** the read values of `display.brightness`, `settings.videoProcessingMode` and `settings.pictureMode` are protocol codes now (e.g. `BRI`, `MOVI`, `MOV`), see [Upgrading from 1.x](#upgrading-from-1x). Writing labels and the index values of 1.x still works
* (Schimi1983) value lists of surround mode, inputs, MultEQ and dynamic volume use the reported value as key, unknown values reported by the receiver are added automatically (fixes #316, #330, #403)
* (Schimi1983) new telnet transport: line buffer (CR only), prioritized send queue with protocol pacing (>= 50 ms, 1 s after power on), keepalive and reconnect with backoff
* (Schimi1983) fixed display lines (control characters, cursor line was cut), picture mode (#317), video processing mode, channel volumes SW2-SW4, CVEND, sleep timer formatting
* (Schimi1983) connection errors are logged once, a refused connection (telnet in use by another app) is reported as warning only after 30 s (#240)
* (Schimi1983) queries of multi zone amplifiers (POA-3012CI) are only sent to such devices, the initial update of AV receivers is about twice as fast
* (Schimi1983) brand (Denon/Marantz), model and number of zones are read once via HTTP (`Deviceinfo.xml`, port 80 or 8080, IPv6 supported); queries for missing zones and for the quick select variant of the other brand are skipped
* (Schimi1983) new states: `settings.ecoMode`, `settings.autoStandby`, `settings.dynamicCompression`, `settings.audioRestorer`, `settings.inputMode`, `settings.digitalInputMode`, `info.audioSignalCode`, `info.audioSampleRate`, `info.videoResolutionCode`, `info.model`, `info.brand`, `info.zones`, `display.cursorLine`; they are only created if the receiver answers
* (Schimi1983) new states `info.videoInputResolution`, `info.videoOutputResolution` (decoded from the resolution code), `info.firmware`, `info.firmwareDts`, `settings.soundModeGroup`, `settings.hdmiResolution`, `settings.analogResolution`, `settings.aspectRatio`
* (Schimi1983) buttons are acknowledged after the command was sent
* (Schimi1983) zone 2/3: input `SOURCE` (follows main zone) is recognized, volumes are sent in whole steps because half steps are ignored by the receiver
* (Schimi1983) settings are read again when the main zone is switched on
* (Schimi1983) new buttons for surround mode groups (`settings.soundModeMovie`, `Music`, `Game`, `Direct`, `PureDirect`, `Stereo`, `Auto`) (#271)
* (Schimi1983) admin UI migrated to jsonConfig, dependencies and tooling updated (Node.js >= 22, js-controller >= 6.0.11, admin >= 7.6.20)

### 1.15.12 (2024-07-23)
* (foxriver76) updated dependencies
* (foxriver76) added tier and license information
* (foxriver76) fixed invalid object `denon.0`

### 1.15.5 (2024-01-06)
* (foxriver76) fixed issue on setting tuner frequency (closes #328)

### 1.15.4 (2023-08-19)
* (foxriver76) fixed detection of display content if content does not contain `NULL` (closes #323)

### 1.15.3 (2023-07-13)
* (foxriver76) fixed log entry when setting channel volume states (closes #321)

### 1.15.2 (2023-06-12)
* (foxriver76) fixed crash case with controller v5

Older changes can be found in [CHANGELOG_OLD.md](CHANGELOG_OLD.md)

## License

The MIT License (MIT)

Copyright (c) 2018-2026 Moritz Heusinger <moritz.heusinger@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
