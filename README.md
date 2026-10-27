![Logo](/admin/denon.png)
# ioBroker.denon
===========================

![Build Status](https://github.com/foxriver76/ioBroker.denon/workflows/Test%20and%20Release/badge.svg)
![Number of Installations](http://iobroker.live/badges/denon-installed.svg) ![Number of Installations](http://iobroker.live/badges/denon-stable.svg) [![NPM version](http://img.shields.io/npm/v/iobroker.denon.svg)](https://www.npmjs.com/package/iobroker.denon)
[![Downloads](https://img.shields.io/npm/dm/iobroker.denon.svg)](https://www.npmjs.com/package/iobroker.denon)

[![NPM](https://nodei.co/npm/iobroker.denon.png?downloads=true)](https://nodei.co/npm/iobroker.denon/)

## Disclaimer
DENON and Marantz are trademarks of D&M Holdings Inc.
The developers of this module are in no way endorsed by or affiliated with D&M Holdings Inc.,
or any associated subsidiaries, logos or trademarks.

## Installation
Install the adapter via the ioBroker admin interface: open the tab "Adapters", search for "denon" and click on "+".
![Add Adapter](/docs/en/media/plusAddAdapter.png)

## Setup
Additional to the adapter installation you have to make sure that your AVR is correctly configured (see below).

### ioBroker
1. Open the instance settings of the adapter
2. Enter the IP address (IPv4 or IPv6) or the hostname of your AVR. While the instance is running, AVRs found in the
   network via UPnP/SSDP are offered as suggestions. The search only finds devices in the same subnet as ioBroker.
3. Optional settings:
    * **Poll interval:** interval for states the AVR does not push by itself (display, sleep timer, quick select, signal information)
    * **Interval between commands:** minimum gap between two commands. The protocol requires at least 50 ms, the default of 100 ms fits most users
    * **Telnet port:** 23 on all AVRs, only change it behind a serial-to-IP bridge
    * **Identify device via HTTP:** reads `Deviceinfo.xml` once at startup to detect brand (Denon/Marantz), model and number of zones. Control and all state updates always use telnet
4. Save and close

### Upgrading from 1.x
Version 2.0.0 changes the value lists of some states to the protocol codes. Adapt scripts and visualizations which use these values:

| State | old value | new value |
|---|---|---|
| `display.brightness` | `Off`, `Dark`, `Dimmed`, `Bright` | `OFF`, `DAR`, `DIM`, `BRI` |
| `settings.videoProcessingMode` | `AUTO`, `GAME`, `MOVIE` (reported as e.g. `MAUTO`) | `AUTO`, `GAME`, `MOVI`, `BYP` |
| `settings.pictureMode` | never filled before | `OFF`, `STD`, `MOV`, `VVD`, `STM`, `CTM`, `DAY`, `NGT` |

Writing the label (e.g. `Bright` or `Movie`) is still accepted. Inputs, surround modes, MultEQ and dynamic volume keep their values,
only the value lists now use the value as key. Surround modes and inputs reported by the AVR which are missing in the list are added automatically.

### Network Setup of AV Receiver

1. Press SETUP button, then Menu appears on FL-display(and GUI)
2. Select "Network" --> "Settings"
3. Set parameters described below

   *DHCP: "ON" (Use this setting when DHCP server is on the local network.)*
  
   *IP Address: When <DHCP> sets "Off”, please set IP address.*
  
   *Subnet Mask: When <DHCP> sets "Off", please set Subnet Mask.*
  
   *Gateway: Set the address of Gateway when Gateway is on the local network.*
  
   *Primary DNS: Do not set this parameter.*
  
   *Second DNS: Do not set this parameter.*
  
   *Proxy: Set this parameter "Off".*
  
4. Press SETUP button, then Menu appears on FL-display (and GUI)
5. Select “Network" --> Network Control/IP Control"
6. Set this parameter to "Always On".

## Usage
Take note, that the AVRs can only manage a single telnet connection. If you are having an active telnet connection e. g. with Home Assistant, the Denon/Marantz app or the javascript adapter, the AVR will refuse the connection of this adapter.
A refused connection is reported as warning if it lasts longer than 30 seconds (a booting AVR also refuses connections for a few seconds).

The adapter reconnects automatically (1 s, 2 s, 4 s ... up to 60 s). If the AVR does not send anything for 30 seconds, a keepalive query is sent; without an answer the connection is re-established.
Scripts which restart the instance on connection loss are not needed anymore.
Here you can find a description of the states and how to use them.

### Buttons
The adapter creates the following buttons:

* info.model / info.brand / info.zones

    |Data type|Permission|
    |:---:|:---:|
    |string / string / number|R|

   *Only filled if "Identify device via HTTP" is active and the AVR serves `Deviceinfo.xml`. Brand is `Denon` or `Marantz`, zones include the main zone.*

* info.audioSignalCode / info.audioSampleRate / info.videoResolutionCode

    |Data type|Permission|
    |:---:|:---:|
    |string|R|

   *Signal information of the current input (models from 2015, created once the AVR answers). The codes are model specific,
   on an AVR-X2200W `audioSignalCode` 02 = PCM, 05 = Dolby TrueHD, 06 = DTS, 09 = DTS-HD; `audioSampleRate` e.g. `48K`.*

#### Channel: zoneMain / zone2 / zone3

* zoneMain.playPause

   *Play and pause music from Bluetooth, Online, USB/iPod sources.*
   
* zoneMain.play

   *Play music from Bluetooth, Online, USB/iPod sources.*
   
* zoneMain.pause

   *Pause music from Bluetooth, Online, USB/iPod sources.*

* zoneMain.skipMinus

   *Skip to previous title.*
   
   *NOT FULLY SUPPORTED FOR HEOS AVR'S*

* zoneMain.skipPlus

   *Skip to next title.*
   
   *NOT FULLY SUPPORTED FOR HEOS AVR'S*

* zoneMain.volumeDown / zone2.volumeDown / zone3.volumeDown

   *Decrease volume of Main Zone / Zone2 / Zone3.*
   
* zoneMain.volumeUp / zone2.volumeUp / zone3.volumeUp

   *Increase volume of Main Zone / Zone2 / Zone3.*
   
* zoneMain.equalizerBassUp / zone2.equalizerBassUp / zone3.equalizerBassUp

   *Button which increases bass level of the Zone.*
   
   *Bass and treble settings can be adjusted when Dyn EQ is set to OFF and Tone Control is on*
   
* zoneMain.equalizerBassDown / zone2.equalizerBassDown / zone3.equalizerBassDown

   *Button which decreases bass level of the Zone.*
   
   *Bass and treble settings can be adjusted when Dyn EQ is set to OFF and Tone Control is on*
   
* zoneMain.equalizerTrebleUp / zone2.equalizerTrebleUp / zone3.equalizerTrebleUp

   *Button which increases treble level of the Zone.*
   
   *Bass and treble settings can be adjusted when Dyn EQ is set to OFF and Tone Control is on*
   
* zoneMain.equalizerTrebleDown / zone2.equalizerTrebleDown / zone3.equalizerTrebleDown

   *Button which decreases treble level of the Zone.*
   
   *Bass and treble settings can be adjusted when Dyn EQ is set to OFF and Tone Control is on*
   
#### Channel: settings
   
* settings.subwooferLevelDown / settings.subwooferTwoLevelDown

   *Reduce subwoofer level by pressing the button.*
   
* settings.subwooferLevelUp / settings.subwooferTwoLevelUp

   *Increase subwoofer level by pressing the button.*
   
* settings.containmentAmountDown

   *Decrease Audyssey LFC amount. The button will only be created, if it is supported by your AVR.*

* settings.containmentAmountUp

   *Increase Audyssey LFC amount. The button will only be created, if it is supported by your AVR.*
   
* settings.cursorUp / settings.cursorDown / settings.cursorLeft / settings.cursorRight

   *Simulates the cursor buttons of your remote control*
   
* settings.enter

   *Simulates the enter button of your remote control*
	
* settings.return

   *Simulates the return/back button of your remote control*
   
* settings.option

   *Simulates the option button of your remote control*
   
* settings.info

   *Simulates the info button of your remote control*

### Channel: tuner

* tuner.frequencyUp

    *Increases tuner frequency.*

* tuner.frequencyDown

  *Decreases tuner frequency.*

### States
Following states will be created by the adapter:

#### Channel: info

* info.connection

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |boolean|R|

   *Read-only boolean indicator. If your broker is connected to your DENON AVR, the state is true otherwise false.*
   
* info.friendlyName

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |string|R|

   *Read only string. Contains the friendly name of the connected AVR.*

* info.onlinePresets

    |Data type|Permission|
    |:---:|:---:|
    |string|R|

    *String in JSON array format, which represents the current saved
    favorites by its id and channel.
    The names of each channel are limited by 20 digits. You can save the
    current channel to an id by setting settings.savePreset and load one
    by setting settings.loadPreset to the related id.*

#### Channel: zoneMain / zone2 / zone3
   
* zoneMain.volume / zone2.volume / zone3.volume

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |number|R/W|

   *Number value which represents the current Main Zone / Zone2 / Zone 3 volume of your AVR. You can also set the volume here. 
   The volume is represented in dB too in separate states, e. g. mainVolumeDB*
   
   *Range is from 0 to 98 (maybe lower due to maximumVolume), where 80 = 0 dB*
   
   *Example:*
   
    ```javascript
    setState('denon.0.zoneMain.volume', 45.5); // Sets volume of Main Zone to 45.5
    ```
   
* zoneMain.maximumVolume

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |number|R|

   *Read-only number which represents the maximum possible volume, where 80 = 0 dB. The volume is also set in dB in the maximumVolumeDB state.*
   
* zoneMain.muteIndicator / zone2.muteIndicator / zone3.muteIndicator

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |boolean|R/W|

   *Boolean value, which is true if the Main Zone / Zone2 / Zone3 is muted, otherwise false. You can mute your AVR with this state.*
   
   *Example:*
   
    ```javascript
    setState('denon.0.zoneMain.muteIndicator', true); // Mutes the Main Zone of your AVR
    ```
   
* zoneMain.powerZone / zone2.powerZone / zone3.powerZone

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |boolean|R/W|

   *Boolean value, which is true if the Zone is turned on, otherwise false. You can turn your AVR / Zone on and off with this state.*
   
* zoneMain.selectInput / zone2.selectInput / zone3.selectInput

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |string|R/W|

   *The string value contains the current input source. You can also set the input source with the following encoding:*
   
   *0: 	PHONO*
   
   *1: 	CD*
   
   *2: 	TUNER*
   
   *3: 	DVD*
   
   *4: 	BD*
   
   *5: 	TV*
   
   *6: 	SAT/CBL*
   
   *7: 	MPLAY*
   
   *8: 	GAME*
   
   *9: 	NET*
   
   *10:	SPOTIFY*
   
   *11:	LASTFM*
   
   *12:	IRADIO*
   
   *13:	SERVER*
   
   *14:	FAVORITES*
   
   *15:	AUX1*
   
   *16:	AUX2*
   
   *17:	AUX3*
   
   *18:	AUX4*
   
   *19:	AUX5*
   
   *20:	AUX6*
   
   *21:	AUX7*

   *22: BT*

   *23: USB*
   
   *Please note, that not every input source is available on every AVR model. If your AVR has additional inputs,
    they will be appended to the list, once they have been detected.*
   
   *Example:*
   
   ```javascript
    setState('denon.0.zoneMain.selectInput', '5'); // Selects TV as input for Main Zone
   ```
   
* zoneMain.quickSelect / zone2.quickSelect / zone3.quickSelect

   |Data type|Permission|                                                                       
   |:---:|:---:|
   |number|R/W|
   
   *Emulates the quick select buttons of your remote, with numbers from 1 to 5 for Main Zone / Zone2 / Zone3.*
   
* zoneMain.sleepTimer / zone2.sleepTimer / zone3.sleepTimer

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |number|R/W|

   *Number-value to read and set the sleep timer for the selected zone. The value will be updated in less than 10 seconds.*
   
* zoneMain.iconURL

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |string|R|

   *Contains a link where you can find the cover of the channel/song which is currently played.*
   
   *NOT SUPPORTED FOR HEOS AVR'S*
   
* zoneMain.equalizerBass / zone2.equalizerBass / zone3.equalizerBass
    
    |Data type|Permission|                                                                       
    |:---:|:---:|
    |number|R/W|

   *Number value which represents the bass level of the Zone. Value range is from -6 to +6 dB.*
   
   *Bass and treble settings can be adjusted when Dyn EQ is set to OFF and Tone Control is on*
   
* zoneMain.equalizerTreble / zone2.equalizerTreble / zone3.equalizerTreble

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |number|R/W|

   *Number value which represents the treble level of the Zone. Value range is from -6 to +6 dB.*
   
   *Bass and treble settings can be adjusted when Dyn EQ is set to OFF and Tone Control is on*
   
* zoneMain.channelVolumeFrontLeft / zone2.channelVolumeFrontLeft / zone3.channelVolumeFrontLeft / ...

   |Data type|Permission|                                                                       
   |:---:|:---:|
   |number|R/W|
   
   *Number value which represents the current channel volume for each speaker. Each speaker has a separate state. The 
   settings affect the current Select Input Mode. The state can be adjusted from -12 dB to +12 dB.*

#### Channel: tuner

* tuner.stationName

  |Data type|Permission|                                                                       
  |:---:|:---:|
  |string|R|

  *Read-only string which contains the current station name if available.*

* tuner.frequency

  |Data type|Permission|                                                                       
  |:---:|:---:|
  |number|R/W|

  *Number value which represents the current frequency. You can also set a frequency with this state. 
  Values below 500 are on FM frequency and above 500 on AM frequency.*


   ```javascript
   setState('denon.0.tuner.frequency', 106.9); // Set frequency to 106.9 MHz (FM)
   ```

#### Channel: display

* display.displayContent

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |string|R|
   
   *Read-only string which contains the content of your AVR display. It has nine states 0 - 9.*
   
   *DISPLAY CONTENT IS NOT SUPPORTED FOR HEOS AVR'S*
   
* display.cursorLine

    |Data type|Permission|
    |:---:|:---:|
    |number|R|

   *Line (1-7) of the display content which carries the cursor of the network menu. Created with the first cursor line.*

* display.brightness

    |Data type|Permission|
    |:---:|:---:|
    |string|R/W|

   *Display brightness as protocol code: `OFF`, `DAR` (dark), `DIM` (dimmed), `BRI` (bright). Writing the label (e.g. `Bright`) works too.*

   *Example:*

   ```javascript
   setState('denon.0.display.brightness', 'BRI'); // Sets display brightness to "Bright"
   ```

#### Channel: settings

* settings.ecoMode / settings.autoStandby / settings.dynamicCompression / settings.audioRestorer / settings.inputMode / settings.digitalInputMode

    |Data type|Permission|
    |:---:|:---:|
    |string|R/W|

   *Created once the AVR answers the related query, so models without the feature get no state. Values are protocol codes:*

   |State|Command|Values|
   |---|---|---|
   |`ecoMode`|`ECO`|`ON`, `AUTO`, `OFF`|
   |`autoStandby`|`STBY`|`15M`, `30M`, `60M`, `OFF`|
   |`dynamicCompression`|`PSDRC`|`AUTO`, `LOW`, `MID`, `HI`, `OFF`|
   |`audioRestorer`|`PSRSTR`|`OFF`, `LOW`, `MED`, `HI`|
   |`inputMode`|`SD`|`AUTO`, `HDMI`, `DIGITAL`, `ANALOG`, `EXT.IN`, `7.1IN`, `ARC`, `NO` (read only: no input)|
   |`digitalInputMode`|`DC`|`AUTO`, `PCM`, `DTS`|

* settings.soundModeMovie / Music / Game / Direct / PureDirect / Stereo / Auto

    |Data type|Permission|
    |:---:|:---:|
    |boolean|W|

   *Buttons to select a surround mode group. The AVR picks the best mode of the group for the current signal, the result is reported in `settings.surroundMode`.*


* settings.powerSystem

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |boolean|R/W|
   
   *Boolean value which is true, if the AVR is turned on, otherwise false. You can also turn your AVR on and off with this state.*
   
* settings.surroundMode

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |string|R/W|

   *The string value contains the current Surround mode. You can also change the source with the following encoding:*
   
   *0:	STEREO*
   
   *1:	VIRTUAL*
   
   *2:	VIDEO GAME*
   
   *3:	MCH STEREO*
   
   *4:	DTS SURROUND*
   
   *5:	DOLBY DIGITAL*
   
   *6:	MOVIE*
   
   *7:	MUSIC*
   
   *8:	DIRECT*
   
   *9:	PURE DIRECT*
   
   *10:	AUTO*
   
   *11:	GAME*
   
   *12:	AURO3D*
   
   *13:	AURO2DSURR*
   
   *14:	WIDE SCREEN*
   
   *15:	SUPER STADIUM*
   
   *16:	ROCK ARENA*
   
   *17:	JAZZ CLUB*
   
   *18:	CLASSIC CONCERT*
   
   *19:	MONO MOVIE*
   
   *20:	MATRIX*
   
   *Please note, that not every Surround mode is available on every AVR model.*
   
   *Example:*
   
   ```javascript
   setState('denon.0.settings.surroundMode', '3'); // Sets Multi Channel Stereo as surround mode
   ```
   
* settings.lfeAmount

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |number|R/W|

    *Amount of subwoofer signal additional directed to speakers in dB. 
    Range is from 0 dB to -10 dB. Where 10 = -10 dB.*
    
* settings.expertCommand

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |string|R/W|

   *You can send your own custom commands with this state. You can find an overview about the existing commands in the [AVR-Control-Protocol.pdf](docs/AVR-Control-Protocol.pdf)*
   
   *Example:*
   
    ```javascript
    setState('denon.0.settings.expertCommand', 'ECOON'); // Turns Main Zone ECO mode on
    ```
  
* settings.expertReadingPattern

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |string|R/W|
    
    *If you want to get specific answers stored in `settings.expertReadingResult` you have to set a RegEx to this state.
    RegEx has to be set, so that a RegEx Constructor can use it. It is recommended to use a [RegEx tester](https://regexr.com/).
    Do not set `/` at the beginning or end of the RegEx.*
    
    *Example:*
    
    ```javascript
    setState('denon.0.settings.expertReadingPattern', '(MV.+)|(SSINFAISFSV.+)');

* settings.expertReadingResult

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |string|R|
    
    *Incoming data, which matches the RegEx of `settings.expertReadingPattern` will be set to this state.*


* settings.dialogControl

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |number|R/W|

    *The dialog control, which can be operated from 0 dB to 6 dB.*

* settings.dialogLevelAdjust

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |boolean|R/W|

    *Turns the dialog level adjustment on, which allows to modify the dialog volume of DTS content.*

* settings.dialogLevel

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |boolean|R/W|

    *If dialog level adjustment is turned on you can modify the dialog volume of DTS content between -12 dB and +12 dB.*

* settings.outputMonitor

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |string|R/W|

   *Select the output monitor of your AVR. This state will only be created if your AVR supports two HDMI outputs. You can switch the state between:*
   
   *0: AUTO --> Auto detection of monitor*
   
   *1: 1 --> Outputs signal to monitor 1*
   
   *2: 2 --> Outputs signal to monitor 2*
   
   *Example:*
     
   ```javascript
   setState('denon.0.settings.outputMonitor', '2'); // Sets monitor 2 as active monitor
   ```
   
* settings.videoProcessingMode

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |string|R/W|

   *Select the video processing mode of your AVR. This state will only be created if your AVR supports it. You can switch the state between:*
   
   *0: AUTO*
   
   *1: GAME*
   
   *2: MOVIE*
       
   *Example:*
 
    ```javascript
    setState('denon.0.settings.videoProcessingMode', '2'); // Sets Video Processing Mode to "MOVIE"
    ```
   
* settings.centerSpread

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |boolean|R/W|

   *Boolean-value which is true if center spread is truned on, else false. You can also turn on/off center spread with this state.*
   
* settings.dynamicEq

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |boolean|R/W|

   *Boolean value which represents the state of Dynamic EQ. You can also set Dynamic EQ on and off with this state.*

* settings.subwooferLevelState

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |boolean|R/W|

   *Boolean value, if it's true, you are able to make changes on the subwoofer level.*

* settings.subwooferLevel / settings.subwooferTwoLevel

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |number|R/W|

   *Number value which indicates the current subwoofer level. The value has a range from -12 to 12 (-12 dB to +12 dB).
   The SubwooferTwoLevel state will only be created if it is supported by your AVR.*
   
* settings.audysseyLfc

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |boolean|R/W|

   *Boolean value, which contains and is able to control Audyssey Low Frequency Containment status (on/off).
   The state will only be created, if it is supported by your AVR.*
   
* settings.containmentAmount

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |number|R/W|
	
   *Number value to set the Low Frequency Containment Amount. The value can be between 1 and 7. The state will only be
   created, if it is supported by your AVR.*
   
* settings.multEq

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |string|R/W|

   *String value, to set the MultEQ function of your AVR with the following encoding:*
   
   *0: OFF*
              
   *1: AUDYSSEY*
                	
   *2: BYP.LR*
   
   *3: FLAT*
      
   *4: MANUAL*
   
* settings.dynamicVolume

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |string|R/W|

   *String value to select the Dynamic Volume by following encoding:*
   
   *0: OFF --> turns Dynamic Volume off*
   
   *1: LIT --> turns Dynamic Volume to light*
   
   *2: MED --> turns Dynamic Volume to medium*
   
   *3: HEV --> turns Dynamic Volume to heavy*
   
* settings.referenceLevelOffset

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |string|R/W|

   *String value to select the Reference Level Offset by the following encoding:*
   
   *0: 	0 dB*
   
   *5:	5 dB*
   
   *10:	10 dB*
   
   *15: 15 dB*
   
   *Example:*
   
    ```javascript
    setState('denon.0.settings.referenceLevelOffset', '5'); // Sets Reference Level Offset to 5 dB
    ```
    
* settings.pictureMode

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |string|R/W|

   *String value to set the Picture Mode Direct Change. This state will only be created when your AVR supports it*
   
   *You can set the following values as string:*
   
   *'Off'* 
   
   *'Standard'*
   
   *'Movie'*
   
   *'Vivid'*
   
   *'Stream'*
    
   *'Custom'*
   
   *'ISF Day'*
   
   *'ISF Night'*
   
   *Example:*
   
   ```javascript
   setState('denon.0.settings.pictureMode', 'Standard'); // Set Picture Mode Direct Change to Standard
   ```
   
* settings.toneControl

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |boolean|R/W|
    
   *Boolean value, which indicates Tone Control status. You can turn it off/on with this state.*
   
   *Tone Control can only be turned on when Dyn EQ is set to OFF*
   
* settings.setupMenu

    |Data type|Permission|                                                                       
    |:---:|:---:|
    |boolean|R/W|

   *Boolean indicator, which indicates if setup menu is currently open or closed. You can open and close it with this state.*

* settings.savePreset

    |Data type|Permission|
    |:---:|:---:|
    |number|R/W|

   *Number value, which can be set to a value of info.onlinePresets. Then the current channel will be saved as a preset to the given number.
   Only numbers which are contained in info.onlinePresets can be used. The state will not get an acknowledge, no matter the command was successful
   or not. You can check info.onlinePresets to check if the command has worked as aspected.*

* settings.loadPreset

    |Data type|Permission|
    |:---:|:---:|
    |number|R/W|

   *Number value, which can be set to a value of info.onlinePresets. This will load the related channel.
   This state will not get an acknowledge, no matter the command has been successful or not.*

* settings.speakerPreset

  |Data type|Permission|                                                                       
  |:---:|:---:|
  |number|R/W|

  *Set the speaker preset if supported by the AVR. Speaker preset can be `1` or `2`.*

### Other States
Due to the fact that some AVRs like the DENON POA-3012CI use another logic there are some differences in the states.
The states which are equal to the ones listed above are: settings.powerSystem, settings.expertCommand, display.brightness
and info.connection. Additional the following states are created for each zone 2-12 (even):

* zoneX.speakerOneVolume / zoneX.speakerTwoVolume

    |Data type|Permission|
    |:---:|:---:|
    |number|R/W|
    
    *Number value, which represents the volume of the AVR's speaker. If operationMode is set to 'BRIDGED' 
    the speakers cannot independently controlled and the control of one also controls the other ones volume.*
    
* zoneX.selectInputOne / zoneX.selectInputTwo

    |Data type|Permission|
    |:---:|:---:|
    |string|R/W|
    
    *Key value pair, which represents the selected input of the AVR's speaker. If operationMode is set to 'BRIDGED' 
    the speakers cannot independently controlled and the control of one also controls the other ones input.*
    
    *The following values are possible:*
    
    *'0': 'BUS L'*
    
    *'1': 'BUS R'*
    
    *'2': 'BUS M'*
    
    *'3': 'AUX'*
    
* zoneX.operationMode

    |Data type|Permission|
    |:---:|:---:|
    |string|R/W|
    
    *Key value pair, which represents the operationMode of the AVR. If operationMode is set to 'BRIDGED' 
    the speakers cannot independently controlled and controlling speaker one also controls speaker two.*
    
    *The following values are possible:*
        
    *'0': 'NORMAL'*
        
    *'1': 'BRIDGED'*
    
* zoneX.lowCutFilterSpeakerOne / zoneX.lowCutFilterSpeakerTwo

    |Data type|Permission|
    |:---:|:---:|
    |boolean|R/W|
    
    *Boolean value, which indicates if the low cut filter for the speaker is enabled or disabled. In bridged mode
    both speakers will depend on each other.*
    
* zoneX.zoneTurnOnModeChange

    |Data type|Permission|
    |:---:|:---:|
    |string|R/W|
    
    *Key value pair, which represents the zone turn on mode change of the zone. You can also control your 
    AVR with this state.*
    
    *The following values are possible:*
    
    *'0': 'Constant'*
    
    *'1': 'Trigger in'*
    
    *'2': 'Audio signal'*
    
    *'3': 'Off'*
    
* zoneX.triggerInput
    
    |Data type|Permission|
    |:---:|:---:|
    |boolean|R/W|
    
    *Turn trigger input on or off with this boolean value.*
    
* zoneX.audioSignalInput

    |Data type|Permission|
    |:---:|:---:|
    |boolean|R/W|
    
    *Boolean value which indicates and controls the audio signal input of your AVR.*  
   
## Missing functions & bugs
If you are missing any functions or detected a bug, please open an [issue](https://github.com/foxriver76/ioBroker.denon/issues).

The adapter is tested with an DENON AVR-X1200W and a Marantz SR5009.

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
* (Schimi1983) **Breaking:** value lists of `display.brightness`, `settings.videoProcessingMode` and `settings.pictureMode` now use the protocol codes as values (e.g. `BRI`, `MOVI`, `MOV`). Scripts and visualizations using the old values have to be adapted
* (Schimi1983) value lists of surround mode, inputs, MultEQ and dynamic volume use the reported value as key, unknown values reported by the AVR are added automatically (fixes #316, #403)
* (Schimi1983) new telnet transport: line buffer (CR only), prioritized send queue with protocol pacing (>= 50 ms, 1 s after power on), keepalive and reconnect with backoff
* (Schimi1983) fixed display lines (control characters, cursor line was cut), picture mode (#317), video processing mode, channel volumes SW2-SW4, CVEND, sleep timer formatting
* (Schimi1983) zones and quick/smart select flavor (Denon/Marantz) are only polled if present
* (Schimi1983) connection errors are logged once, a refused connection (telnet in use by another app) is reported as warning only after 30 s (#240)
* (Schimi1983) brand (Denon/Marantz), model and number of zones are read once via HTTP (`Deviceinfo.xml`, port 80 or 8080, IPv6 supported), queries for missing zones are skipped
* (Schimi1983) new states: `settings.ecoMode`, `settings.autoStandby`, `settings.dynamicCompression`, `settings.audioRestorer`, `settings.inputMode`, `settings.digitalInputMode`, `info.audioSignalCode`, `info.audioSampleRate`, `info.videoResolutionCode`, `info.model`, `info.brand`, `info.zones`, `display.cursorLine`; they are only created if the AVR answers
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
