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
* **HEOS models:** receivers with HEOS (models from 2016) do not report the network display content, cover and favorites via
  telnet. These states and the playback buttons are not created there.
* **Standby:** to get answers in standby and to switch the receiver on, set "Network Control" to "Always On" (see above).

## Upgrading from 1.x

Version 2.0 comes with a new object tree: states are grouped by function (main zone, sound, video, remote control ...)
and have new, consistent names. On the first start the adapter deletes the old channels `settings`, `zoneMain`, `zone2`,
`zone3`, `display` and `tuner` and creates the new states as soon as the receiver answers.

**Before updating:**

* Scripts, Blockly, VIS widgets and aliases using states of this adapter have to be changed to the new names (table below).
* Settings of the old states (e.g. history/SQL logging) are lost and have to be set again on the new states.
* Read values are always the code of the receiver, e.g. `display.brightness` = `BRI` instead of `Bright`. Writing accepts the code or the label.

Main changes (zone 2 and 3 the same with `zone2.` / `zone3.` instead of `main.`):

| Up to 1.x | From 2.0 |
|---|---|
| `zoneMain.powerZone` | `main.power` |
| `zoneMain.volume` / `zoneMain.volumeDB` | `main.volume` / `main.volumeDb` |
| `zoneMain.volumeUp` / `zoneMain.volumeDown` | `main.volumeUp` / `main.volumeDown` |
| `zoneMain.muteIndicator` | `main.mute` |
| `zoneMain.selectInput` | `main.input` |
| `zoneMain.quickSelect`, `zoneMain.sleepTimer` | `main.quickSelect`, `main.sleepTimer` |
| `zoneMain.maximumVolume` / `zoneMain.maximumVolumeDB` | `main.maxVolume` / `main.maxVolumeDb` |
| `zoneMain.equalizerBass` / `equalizerTreble` (+ `Up`/`Down`) | `main.audio.bass` / `main.audio.treble` (+ `Up`/`Down`) |
| `zoneMain.channelVolumeFrontLeft` ... | `main.channelVolume.frontLeft` ... |
| `zoneMain.iconURL` | `main.cover` |
| `zoneMain.play`, `pause`, `playPause`, `skipPlus`, `skipMinus` | `remote.play`, `pause`, `playPause`, `next`, `previous` |
| `settings.powerSystem` | `system.power` |
| `settings.ecoMode`, `settings.speakerPreset` | `system.ecoMode`, `system.speakerPreset` |
| `settings.surroundMode`, `settings.soundModeMovie` ... | `main.surroundMode`, `main.soundModeMovie` ... |
| `settings.autoStandby` | `main.autoStandby` |
| `settings.cursorUp` ... `settings.return`, `settings.setupMenu` | `remote.up` ... `remote.back`, `remote.menu` |
| `settings.multEq`, `dynamicEq`, `dynamicVolume`, `referenceLevelOffset` | `main.audio.multEq`, `dynamicEq`, `dynamicVolume`, `referenceLevel` |
| `settings.subwooferLevel`, `subwooferLevelState`, `subwooferTwoLevel` | `main.audio.subwooferLevel`, `subwooferLevelAdjust`, `subwoofer2Level` |
| `settings.lfeAmount`, `audysseyLfc`, `containmentAmount` | `main.audio.lfe` (now 0 to -10 dB), `lfc`, `containment` |
| `settings.dialogLevel`, `dialogLevelAdjust`, `dialogControl` | `main.audio.dialogLevel`, `dialogLevelAdjust`, `dialogControl` |
| `settings.toneControl`, `centerSpread`, `dynamicCompression`, `audioRestorer`, `inputMode`, `digitalInputMode` | `main.audio.` + same name |
| `settings.outputMonitor`, `videoProcessingMode`, `pictureMode`, `hdmiResolution`, `analogResolution`, `aspectRatio` | `main.video.monitor`, `processingMode`, `pictureMode`, `hdmiResolution`, `analogResolution`, `aspectRatio` |
| `settings.soundModeGroup` | `info.soundModeGroup` |
| `settings.loadPreset`, `savePreset`, `info.onlinePresets` | `netAudio.loadPreset`, `savePreset`, `presets` |
| `display.displayContent0` ... | `display.line0` ... |
| `info.friendlyName` | `info.name` |
| `settings.expertCommand`, `expertReadingPattern`, `expertReadingResult` | `expert.command`, `readingPattern`, `readingResult` |

List index values of 1.x (e.g. `selectInput` = `'5'` for TV) are not accepted anymore.

## States

A state is only created once the receiver answers the related query, so every model only gets the states it supports.
Buttons (role `button`) are created together with the value they belong to.

### info – device and current signal (read only)

| State | Description |
|---|---|
| `connection` | `true` while connected to the receiver |
| `name` | device name as set in the receiver |
| `model`, `brand`, `zones` | model (e.g. `AVR-X2200W`), brand (`Denon`/`Marantz`), number of zones incl. main zone |
| `firmware`, `firmwareDts` | firmware version of the receiver and of the DTS decoder |
| `audioSignal` | audio signal as text, e.g. `Dolby TrueHD / Atmos` |
| `audioSignalCode`, `audioSampleRate` | code of the audio signal (table below) and sample rate, e.g. `48K` |
| `videoInputResolution`, `videoOutputResolution` | resolution at the HDMI input and output, e.g. `1080p 24Hz`, `2160p 50/60Hz`, `no signal` |
| `videoResolutionCode` | raw code of the video resolution (models up to about 2016) |
| `soundModeGroup` | active sound mode group: `MOV` movie, `MUS` music, `GAM` game, `PUR` pure |

Signal codes measured on an AVR-X2200W. The codes depend on the model generation, newer models may use other values:

| `audioSignalCode` | Signal | | Digit `videoResolutionCode` | Resolution |
|---|---|---|---|---|
| `01` | standby / analog | | `0` | no signal |
| `02` | PCM (stereo and multichannel) | | `2` | 480p/576p |
| `03` | Dolby Digital | | `6` | 720p |
| `04` | Dolby Digital Plus | | `7` | 1080p 50/60 Hz |
| `05` | Dolby TrueHD (also with Atmos) | | `8` | 1080p 24 Hz |
| `06` | DTS | | `9` | 2160p 24/25 Hz |
| `08` | DTS-HD High Resolution | | `A` | 2160p 50/60 Hz |
| `09` | DTS-HD Master Audio | | | |
| `12` | switching, no signal yet | | | |

The video code consists of `0`, the digit of the input and the digit of the output, e.g. `088` = 1080p 24 Hz in and out.

### system – whole device

| State | Description |
|---|---|
| `power` | receiver on (`true`) or standby (`false`), all zones |
| `ecoMode` | ECO mode: `ON`, `AUTO`, `OFF` |
| `allZoneStereo` | All Zone Stereo: play the main zone in all zones |
| `speakerPreset` | speaker preset 1 or 2 |

### main – main zone (zone2, zone3 the same)

| State | Description |
|---|---|
| `power` | zone on/off |
| `volume` | volume 0 ... 98 (main zone in steps of 0.5, zone 2/3 in whole steps) |
| `volumeDb` | the same volume in dB (-80 ... +18) |
| `volumeUp`, `volumeDown` | buttons: volume up / down |
| `mute` | mute |
| `input` | input. The list shows the names of the receiver menu and only the inputs used there. The stored value is the code (e.g. `MPLAY`), which stays the same when an input is renamed. Zone 2/3 additionally `SOURCE` = same as main zone |
| `quickSelect` | quick select (Marantz: smart select) 1 ... 5, newer models 1 ... 6, with the names of the receiver. `0` = none active |
| `sleepTimer` | sleep timer in minutes, `0` = off |
| `autoStandby` | auto standby (main zone 15/30/60 min, zone 2/3 2/4/8 h) |
| `maxVolume`, `maxVolumeDb` | volume limit (main zone only, read only) |
| `surroundMode` | surround mode, e.g. `STEREO`, `DOLBY SURROUND`. Unknown modes are added automatically |
| `soundModeMovie`, `soundModeMusic`, `soundModeGame`, `soundModeDirect`, `soundModePureDirect`, `soundModeStereo`, `soundModeAuto` | buttons: select a sound mode group, the receiver picks the matching mode for the signal |
| `cover` | URL of the cover of the current network source (not on HEOS models) |
| `zone2.hdmiAudio` | HDMI audio in zone 2: `THR` pass through, `PCM` convert |

### main.audio – sound

| State | Description |
|---|---|
| `bass`, `treble` (+ `Up`/`Down`) | bass and treble in dB (-6 ... +6), only with tone control (`toneControl`) on. Also in zone 2/3 |
| `toneControl` | tone control on/off |
| `multEq`, `dynamicEq`, `dynamicVolume`, `referenceLevel` | Audyssey: MultEQ curve, Dynamic EQ, Dynamic Volume, reference level offset (0/5/10/15 dB) |
| `lfc`, `containment` (+ `Up`/`Down`) | Audyssey LFC (bass limit for neighbours) and its amount 1 ... 7 |
| `dynamicCompression` | dynamic range compression |
| `subwoofer` | subwoofer on/off |
| `subwooferLevelAdjust`, `subwooferLevel`, `subwoofer2Level` (+ `Up`/`Down`) | subwoofer level on/off and in dB |
| `lfe` | LFE level (effects channel) 0 ... -10 dB |
| `dialogLevelAdjust`, `dialogLevel`, `dialogControl` | dialog level on/off and in dB, dialog enhancement 0 ... 6 (DTS:X) |
| `cinemaEq`, `neuralX`, `graphicEq`, `headphoneEq`, `loudness` | Cinema EQ, DTS Neural:X, graphic EQ, headphone EQ, loudness management |
| `audioDelay` | audio delay (lip sync) 0 ... 300 ms |
| `audioRestorer` | audio restorer for compressed music |
| `centerSpread` | center spread |
| `inputMode`, `digitalInputMode` | audio input mode (`AUTO`, `HDMI`, `DIGITAL`, `ANALOG` ...) and digital mode (`AUTO`, `PCM`, `DTS`) |

### main.video – video and HDMI

| State | Description |
|---|---|
| `monitor` | HDMI output: `AUTO`, `1`, `2` |
| `hdmiResolution`, `analogResolution` | output resolution (scaler). Newer models only know `AUTO` and `OFF` |
| `aspectRatio` | aspect ratio `NRM` (4:3) or `FUL` (16:9) |
| `processingMode` | video processing `AUTO`, `GAME`, `MOVI`, `BYP` |
| `pictureMode` | picture mode `OFF`, `STD`, `MOV`, `VVD`, `STM`, `CTM`, `DAY`, `NGT` |
| `hdmiAudioOutput` | HDMI audio via `AMP` (receiver) or `TV` |

### main.channelVolume – channel levels

Level of every speaker in dB (-12 ... +12), e.g. `frontLeft`, `center`, `subwoofer`. Only the channels set up in the
receiver are created. Zone 2/3: `frontLeft` and `frontRight`.

### remote – remote control

| State | Description |
|---|---|
| `menu` | setup menu on the TV on/off |
| `up`, `down`, `left`, `right`, `enter`, `back`, `option`, `info` | buttons to operate the menu |
| `play`, `pause`, `playPause`, `next`, `previous` | playback of network sources (models without HEOS only) |

### display – front display and network menu

| State | Description |
|---|---|
| `brightness` | brightness: `BRI` bright, `DIM` dimmed, `DAR` dark, `OFF` off |
| `line0` ... `line8` | content of the network menu or the playback screen, line 0 is the title (not on HEOS models) |
| `cursorLine` | line 1 ... 7 with the cursor |

### tuner

| State | Description |
|---|---|
| `frequency` (+ `frequencyUp`/`Down`) | frequency, FM in MHz (e.g. `106.9`), AM in kHz |
| `stationName` | RDS station name |
| `band`, `tuningMode` | band `FM`/`AM`, tuning `AUTO`/`MANUAL` |
| `preset` (+ `presetUp`/`Down`) | station preset |

### netAudio – network favorites (models without HEOS)

| State | Description |
|---|---|
| `presets` | stored favorites as JSON (`{"1":"Station"}`) |
| `loadPreset`, `savePreset` | recall a favorite / store the current station (number) |

### expert – raw commands

| State | Description |
|---|---|
| `command` | send any protocol command, e.g. `PSDYNEQ ON` |
| `readingPattern` | regular expression, e.g. `^PSDYNEQ` |
| `readingResult` | last answer of the receiver matching the pattern |

## Multi zone amplifiers (DENON POA-3012CI)

Multi zone amplifiers like the DENON POA-3012CI use a different protocol. The states `info.connection`, `system.power`,
`expert.*` and `display.brightness` are equal to the ones above. Additionally the following states are created
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
| `system.powerConfigurationChange` | string | R/W | Power configuration |
| `system.masterTriggerInput` | boolean | R/W | Master trigger input |

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
* (Schimi1983) **Breaking:** new object tree, all states renamed and grouped by function (`main`, `main.audio`, `main.video`, `system`, `remote` ...), old objects are removed on the first start, see [Upgrading from 1.x](#upgrading-from-1x)
* (Schimi1983) **Breaking:** read values of value lists are the protocol codes of the receiver (e.g. `display.brightness` = `BRI`); writing accepts code or label (fixes #316, #330, #403)
* (Schimi1983) input list with the names of the receiver menu and only the inputs used there, quick select names of the receiver
* (Schimi1983) new states (only created if the receiver answers): Neural:X, Cinema EQ, graphic/headphone EQ, loudness management, subwoofer on/off, audio delay, All Zone Stereo, auto standby of zones 2/3, HDMI audio of zone 2, HDMI audio output, tuner band/tuning mode/preset, audio signal as text, ECO mode, dynamic compression, audio restorer, input modes, video resolution, signal info, firmware, model/brand/zones, sound mode group buttons (#271)
* (Schimi1983) channel levels are only created for the speakers set up in the receiver; play buttons, display lines and presets only on models without HEOS
* (Schimi1983) new telnet transport: line buffer (CR only), prioritized send queue with protocol pacing (>= 50 ms, 1 s after power on), keepalive and reconnect with backoff
* (Schimi1983) fixed display lines, picture mode (#317), video processing mode, channel volumes SW2-SW4, sleep timer formatting
* (Schimi1983) connection errors are logged once, a refused connection (telnet in use by another app) is reported as warning only after 30 s (#240)
* (Schimi1983) brand, model and number of zones are read once via HTTP (`Deviceinfo.xml`); queries for missing zones and for the quick select variant of the other brand are skipped, queries of POA multi zone amplifiers only go to such devices
* (Schimi1983) zone 2/3: input `SOURCE` (follows main zone) is recognized, volumes are sent in whole steps
* (Schimi1983) settings are read again when the main zone is switched on; buttons are acknowledged after the command was sent
* (Schimi1983) all states use roles of the official ioBroker role list
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
