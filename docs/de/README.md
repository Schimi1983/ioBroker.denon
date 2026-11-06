![Logo](media/denon.png)

# ioBroker.denon – Denon/Marantz AV-Receiver

Der Adapter bindet AV-Receiver von Denon und Marantz in ioBroker ein. Er verbindet sich über das offizielle
Telnet-Steuerprotokoll (Port 23), empfängt alle Änderungen in Echtzeit und legt States für Power, Lautstärke, Eingänge,
Surround-Modi, Zonen, Tuner, Display und viele Audio-/Video-Einstellungen an.

## Haftungsausschluss

DENON und Marantz sind Marken der D&M Holdings Inc.
Die Entwickler dieses Moduls stehen in keiner Verbindung zur D&M Holdings Inc. oder zu deren Tochtergesellschaften,
Logos oder Marken und werden von diesen nicht unterstützt.

## Inhalt

* [Voraussetzungen](#voraussetzungen)
* [Installation](#installation)
* [Konfiguration](#konfiguration)
* [Netzwerkeinstellungen am AV-Receiver](#netzwerkeinstellungen-am-av-receiver)
* [Hinweise zum Betrieb](#hinweise-zum-betrieb)
* [Update von 1.x](#update-von-1x)
* [States](#states)
* [Mehrzonen-Verstärker (DENON POA-3012CI)](#mehrzonen-verstärker-denon-poa-3012ci)
* [Fehlende Funktionen & Fehler](#fehlende-funktionen--fehler)

## Voraussetzungen

* Denon- oder Marantz-AV-Receiver mit Netzwerkverbindung (LAN oder WLAN) und aktivierter Netzwerksteuerung
* Node.js >= 22
* js-controller >= 6.0.11
* Admin >= 7.6.20

## Installation

Der Adapter wird über die ioBroker-Admin-Oberfläche installiert: Reiter „Adapter“ öffnen, nach „denon“ suchen und auf „+“ klicken.

## Konfiguration

| Einstellung | Beschreibung |
|---|---|
| IP-Adresse oder Hostname des AVR | IPv4-, IPv6-Adresse oder Hostname des Receivers. Solange die Instanz läuft, werden per UPnP/SSDP gefundene Receiver als Vorschlag angeboten. Die Suche findet nur Geräte im selben Subnetz wie ioBroker, sonst die Adresse manuell eingeben. |
| Abfrageintervall (ms) | Intervall für Werte, die der Receiver nicht selbst meldet (Display, Sleep-Timer, Quick Select, Signal-Info). Standard: 7000 ms |
| Abstand zwischen Befehlen (ms) | Minimaler Abstand zwischen zwei Befehlen. Das Protokoll verlangt mindestens 50 ms. Standard: 100 ms |
| Telnet-Port | 23 bei allen Receivern. Nur ändern, wenn eine Seriell-zu-IP-Bridge genutzt wird. |
| Gerät per HTTP erkennen | Liest beim Start einmal `Deviceinfo.xml` (Marke Denon/Marantz, Modell, Anzahl Zonen). Abfragen für nicht vorhandene Zonen entfallen. Gesteuert wird immer per Telnet. Standard: an |

## Netzwerkeinstellungen am AV-Receiver

1. Taste SETUP auf der Fernbedienung drücken, das Menü erscheint im Gerätedisplay und auf dem Fernseher
2. „Netzwerk“ → „Einstellungen“ wählen und einstellen
    * DHCP: „Ein“, wenn ein DHCP-Server (z. B. Router) vorhanden ist, sonst IP-Adresse, Subnetzmaske und Gateway manuell setzen
    * Proxy: „Aus“
3. „Netzwerk“ → „Netzwerk-Strg.“ (bei manchen Modellen „IP-Steuerung“) auf **„Immer ein“** stellen.
   Mit „Aus im Standby“ ignoriert der Receiver im Standby alle Netzwerkbefehle und lässt sich von ioBroker nicht einschalten.

## Hinweise zum Betrieb

* **Nur eine Telnet-Verbindung:** Der Receiver akzeptiert nur eine Telnet-Verbindung. Ist eine andere Anwendung verbunden
  (z. B. Home Assistant, die Denon/Marantz-App, ein Skript), wird die Verbindung des Adapters abgelehnt. Eine Ablehnung wird
  erst als Warnung gemeldet, wenn sie länger als 30 Sekunden anhält, weil auch ein hochfahrender Receiver einige Sekunden ablehnt.
* **Wiederverbindung:** Nach einem Verbindungsverlust verbindet sich der Adapter selbst neu (1 s, 2 s, 4 s ... bis 60 s).
  Sendet der Receiver 30 Sekunden lang nichts, wird eine Keepalive-Abfrage geschickt; ohne Antwort wird die Verbindung neu aufgebaut.
  Skripte, die die Instanz bei Verbindungsverlust neu starten, werden nicht benötigt.
* **Befehlstakt:** Befehle werden in eine Warteschlange gestellt und im eingestellten Abstand gesendet. Befehle des Nutzers
  werden vor ausstehenden Abfragen gesendet. Nach dem Einschalten des Receivers oder einer Zone wird der nächste Befehl
  wie im Protokoll gefordert um 1 Sekunde verzögert.
* **Modellabhängige Funktionen:** Viele States werden erst angelegt, wenn der Receiver auf die zugehörige Abfrage antwortet.
  Ein Modell ohne die Funktion bekommt also keinen State. Vom Receiver gemeldete Surround-Modi und Eingänge, die in der
  Werteliste fehlen, werden automatisch ergänzt.
* **Denon und Marantz:** Quick Select heißt bei Denon `QUICK`, bei Marantz `SMART`. Der Adapter erkennt die Marke und sendet
  nur den passenden Befehl.
* **HEOS-Modelle:** Receiver mit HEOS (Modelle ab 2016) melden Displayinhalt, Cover und Favoriten der Netzwerkquellen nicht
  über Telnet. Diese Datenpunkte und die Wiedergabetasten entstehen dort nicht.
* **Standby:** Damit der Receiver im Standby antwortet und eingeschaltet werden kann, muss „Netzwerk-Strg.“ auf „Immer ein“ stehen
  (siehe oben).

## Update von 1.x

Mit Version 2.0 ist der Objektbaum neu aufgebaut: Die Datenpunkte sind nach Funktion sortiert (Hauptzone, Klang, Bild,
Fernbedienung ...) und haben neue, einheitliche Namen. Beim ersten Start löscht der Adapter die alten Kanäle `settings`,
`zoneMain`, `zone2`, `zone3`, `display` und `tuner` und legt die neuen an, sobald der Receiver antwortet.

**Vor dem Update beachten:**

* Skripte, Blockly, VIS-Widgets und Aliase, die Datenpunkte des Adapters nutzen, müssen auf die neuen Namen umgestellt werden (Tabelle unten).
* Einstellungen an den alten Datenpunkten (z. B. History/SQL-Aufzeichnung) gehen verloren und müssen an den neuen Datenpunkten neu gesetzt werden.
* Gelesene Werte sind jetzt immer der Code des Receivers, z. B. `display.brightness` = `BRI` statt `Bright`. Schreiben geht mit dem Code oder dem Anzeigenamen.

Die wichtigsten Änderungen (Zone 2 und 3 genauso, nur mit `zone2.` bzw. `zone3.` statt `main.`):

| Bis 1.x | Ab 2.0 |
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
| `settings.lfeAmount`, `audysseyLfc`, `containmentAmount` | `main.audio.lfe` (jetzt 0 bis -10 dB), `lfc`, `containment` |
| `settings.dialogLevel`, `dialogLevelAdjust`, `dialogControl` | `main.audio.dialogLevel`, `dialogLevelAdjust`, `dialogControl` |
| `settings.toneControl`, `centerSpread`, `dynamicCompression`, `audioRestorer`, `inputMode`, `digitalInputMode` | `main.audio.` + gleicher Name |
| `settings.outputMonitor`, `videoProcessingMode`, `pictureMode`, `hdmiResolution`, `analogResolution`, `aspectRatio` | `main.video.monitor`, `processingMode`, `pictureMode`, `hdmiResolution`, `analogResolution`, `aspectRatio` |
| `settings.soundModeGroup` | `info.soundModeGroup` |
| `settings.loadPreset`, `savePreset`, `info.onlinePresets` | `netAudio.loadPreset`, `savePreset`, `presets` |
| `display.displayContent0` ... | `display.line0` ... |
| `info.friendlyName` | `info.name` |
| `settings.expertCommand`, `expertReadingPattern`, `expertReadingResult` | `expert.command`, `readingPattern`, `readingResult` |

Die Listenindizes aus 1.x (z. B. `selectInput` = `'5'` für TV) werden nicht mehr angenommen.

## States

Ein Datenpunkt entsteht erst, wenn der Receiver auf die zugehörige Abfrage antwortet. Jedes Modell bekommt also nur die
Datenpunkte, die es kann. Tasten (Rolle `button`) entstehen zusammen mit dem Wert, zu dem sie gehören.

### info – Gerät und laufendes Signal (nur lesen)

| State | Beschreibung |
|---|---|
| `connection` | `true`, solange die Verbindung zum Receiver steht |
| `name` | Gerätename, wie im Receiver eingestellt |
| `model`, `brand`, `zones` | Modell (z. B. `AVR-X2200W`), Marke (`Denon`/`Marantz`), Anzahl Zonen inkl. Hauptzone |
| `firmware`, `firmwareDts` | Firmware-Version des Receivers und des DTS-Decoders |
| `audioSignal` | Audiosignal im Klartext, z. B. `Dolby TrueHD / Atmos` |
| `audioSignalCode`, `audioSampleRate` | Code des Audiosignals (Tabelle unten) und Abtastrate, z. B. `48K` |
| `videoInputResolution`, `videoOutputResolution` | Auflösung am HDMI-Eingang und -Ausgang, z. B. `1080p 24Hz`, `2160p 50/60Hz`, `no signal` |
| `videoResolutionCode` | Rohcode der Videoauflösung (Modelle bis etwa 2016) |
| `soundModeGroup` | aktive Klanggruppe: `MOV` Film, `MUS` Musik, `GAM` Spiel, `PUR` Pure |

Gemessene Signal-Codes eines AVR-X2200W. Die Codes hängen von der Modellgeneration ab, neuere Modelle können andere Werte nutzen:

| `audioSignalCode` | Signal | | Ziffer `videoResolutionCode` | Auflösung |
|---|---|---|---|---|
| `01` | Standby / analog | | `0` | kein Signal |
| `02` | PCM (Stereo und Mehrkanal) | | `2` | 480p/576p |
| `03` | Dolby Digital | | `6` | 720p |
| `04` | Dolby Digital Plus | | `7` | 1080p 50/60 Hz |
| `05` | Dolby TrueHD (auch mit Atmos) | | `8` | 1080p 24 Hz |
| `06` | DTS | | `9` | 2160p 24/25 Hz |
| `08` | DTS-HD High Resolution | | `A` | 2160p 50/60 Hz |
| `09` | DTS-HD Master Audio | | | |
| `12` | Umschaltung, noch kein Signal | | | |

Der Video-Code besteht aus `0`, der Ziffer für den Eingang und der Ziffer für den Ausgang, z. B. `088` = 1080p 24 Hz ein und aus.

### system – ganzes Gerät

| State | Beschreibung |
|---|---|
| `power` | Receiver ein (`true`) oder Standby (`false`), alle Zonen |
| `ecoMode` | ECO-Modus: `ON`, `AUTO`, `OFF` |
| `allZoneStereo` | All Zone Stereo: Hauptzone in allen Zonen abspielen |
| `speakerPreset` | Lautsprecher-Preset 1 oder 2 |

### main – Hauptzone (zone2, zone3 genauso)

| State | Beschreibung |
|---|---|
| `power` | Zone ein/aus |
| `volume` | Lautstärke 0 ... 98 (Hauptzone in 0,5er-Schritten, Zone 2/3 in ganzen Schritten) |
| `volumeDb` | dieselbe Lautstärke in dB (-80 ... +18) |
| `volumeUp`, `volumeDown` | Tasten: lauter / leiser |
| `mute` | Stummschaltung |
| `input` | Eingang. Die Liste zeigt die Namen aus dem Menü des Receivers und nur die dort benutzten Eingänge. Gespeichert wird der Code (z. B. `MPLAY`), der auch beim Umbenennen gleich bleibt. Zone 2/3 zusätzlich `SOURCE` = wie Hauptzone |
| `quickSelect` | Quick Select (Marantz: Smart Select) 1 ... 5, bei neueren Modellen 1 ... 6, mit den Namen aus dem Receiver. `0` = keiner aktiv |
| `sleepTimer` | Ausschalt-Timer in Minuten, `0` = aus |
| `autoStandby` | automatischer Standby (Hauptzone 15/30/60 min, Zone 2/3 2/4/8 h) |
| `maxVolume`, `maxVolumeDb` | eingestellte Höchstlautstärke (nur Hauptzone, nur lesen) |
| `surroundMode` | Surround-Modus, z. B. `STEREO`, `DOLBY SURROUND`. Unbekannte Modi werden automatisch ergänzt |
| `soundModeMovie`, `soundModeMusic`, `soundModeGame`, `soundModeDirect`, `soundModePureDirect`, `soundModeStereo`, `soundModeAuto` | Tasten: Klanggruppe wählen, der Receiver wählt den passenden Modus zum Signal |
| `cover` | Adresse des Covers der laufenden Netzwerkquelle (nicht bei HEOS-Modellen) |
| `zone2.hdmiAudio` | Ton über HDMI in Zone 2: `THR` durchleiten, `PCM` umwandeln |

### main.audio – Klang

| State | Beschreibung |
|---|---|
| `bass`, `treble` (+ `Up`/`Down`) | Bass und Höhen in dB (-6 ... +6), nur bei eingeschalteter Klangregelung (`toneControl`). Auch in Zone 2/3 |
| `toneControl` | Klangregelung ein/aus |
| `multEq`, `dynamicEq`, `dynamicVolume`, `referenceLevel` | Audyssey-Einmessung: MultEQ-Kurve, Dynamic EQ, Dynamic Volume, Referenzpegel-Offset (0/5/10/15 dB) |
| `lfc`, `containment` (+ `Up`/`Down`) | Audyssey LFC (Bassbegrenzung für Nachbarn) und dessen Stärke 1 ... 7 |
| `dynamicCompression` | Dynamikkompression (leise Stellen lauter, laute leiser) |
| `subwoofer` | Subwoofer ein/aus |
| `subwooferLevelAdjust`, `subwooferLevel`, `subwoofer2Level` (+ `Up`/`Down`) | Subwoofer-Pegel ein/aus und in dB |
| `lfe` | LFE-Pegel (Effektkanal) 0 ... -10 dB |
| `dialogLevelAdjust`, `dialogLevel`, `dialogControl` | Dialogpegel ein/aus und in dB, Dialog-Verstärkung 0 ... 6 (DTS:X) |
| `cinemaEq`, `neuralX`, `graphicEq`, `headphoneEq`, `loudness` | Cinema EQ, DTS Neural:X, Grafik-EQ, Kopfhörer-EQ, Loudness Management |
| `audioDelay` | Audio-Verzögerung (Lippensynchronität) 0 ... 300 ms |
| `audioRestorer` | Klangverbesserung für komprimierte Musik |
| `centerSpread` | Center Spread |
| `inputMode`, `digitalInputMode` | Audio-Eingangsmodus (`AUTO`, `HDMI`, `DIGITAL`, `ANALOG` ...) und Digitalmodus (`AUTO`, `PCM`, `DTS`) |

### main.video – Bild und HDMI

| State | Beschreibung |
|---|---|
| `monitor` | HDMI-Ausgang: `AUTO`, `1`, `2` |
| `hdmiResolution`, `analogResolution` | Ausgabeauflösung (Skalierung). Neuere Modelle kennen nur `AUTO` und `OFF` |
| `aspectRatio` | Seitenverhältnis `NRM` (4:3) oder `FUL` (16:9) |
| `processingMode` | Videoverarbeitung `AUTO`, `GAME`, `MOVI`, `BYP` |
| `pictureMode` | Bildmodus `OFF`, `STD`, `MOV`, `VVD`, `STM`, `CTM`, `DAY`, `NGT` |
| `hdmiAudioOutput` | HDMI-Ton über `AMP` (Receiver) oder `TV` |

### main.channelVolume – Kanalpegel

Pegel jedes Lautsprechers in dB (-12 ... +12), z. B. `frontLeft`, `center`, `subwoofer`. Es entstehen nur die Kanäle,
die im Receiver eingerichtet sind. Zone 2/3: `frontLeft` und `frontRight`.

### remote – Fernbedienung

| State | Beschreibung |
|---|---|
| `menu` | Einstellungsmenü auf dem Fernseher ein/aus |
| `up`, `down`, `left`, `right`, `enter`, `back`, `option`, `info` | Tasten zur Menübedienung |
| `play`, `pause`, `playPause`, `next`, `previous` | Wiedergabe der Netzwerkquellen (nur Modelle ohne HEOS) |

### display – Gerätedisplay und Netzwerkmenü

| State | Beschreibung |
|---|---|
| `brightness` | Helligkeit: `BRI` hell, `DIM` gedimmt, `DAR` dunkel, `OFF` aus |
| `line0` ... `line8` | Inhalt des Netzwerkmenüs bzw. der Wiedergabeanzeige, Zeile 0 ist der Titel (nicht bei HEOS-Modellen) |
| `cursorLine` | Zeile 1 ... 7, in der der Cursor steht |

### tuner

| State | Beschreibung |
|---|---|
| `frequency` (+ `frequencyUp`/`Down`) | Frequenz, UKW in MHz (z. B. `106.9`), MW in kHz |
| `stationName` | RDS-Sendername |
| `band`, `tuningMode` | Band `FM`/`AM`, Sendersuche `AUTO`/`MANUAL` |
| `preset` (+ `presetUp`/`Down`) | Senderspeicher |

### netAudio – Netzwerk-Favoriten (Modelle ohne HEOS)

| State | Beschreibung |
|---|---|
| `presets` | gespeicherte Favoriten als JSON (`{"1":"Sender"}`) |
| `loadPreset`, `savePreset` | Favorit abrufen / aktuellen Sender speichern (Nummer) |

### expert – Rohbefehle

| State | Beschreibung |
|---|---|
| `command` | beliebigen Protokollbefehl senden, z. B. `PSDYNEQ ON` |
| `readingPattern` | regulärer Ausdruck, z. B. `^PSDYNEQ` |
| `readingResult` | letzte Antwort des Receivers, die zum Muster passt |

## Mehrzonen-Verstärker (DENON POA-3012CI)

Mehrzonen-Verstärker wie der DENON POA-3012CI nutzen ein anderes Protokoll. Die States `info.connection`, `system.power`,
`expert.*` und `display.brightness` entsprechen den oben beschriebenen. Zusätzlich werden für jede Zone
2 ... 12 (gerade Zahlen) folgende States angelegt:

| State | Typ | R/W | Beschreibung |
|---|---|---|---|
| `zoneX.speakerOneVolume` / `zoneX.speakerTwoVolume` | number | R/W | Lautstärke des Lautsprechers 0 ... 99. Im Betriebsmodus `BRIDGED` werden beide gemeinsam gesteuert |
| `zoneX.selectInputOne` / `zoneX.selectInputTwo` | string | R/W | Eingang des Lautsprechers: `0` BUS L, `1` BUS R, `2` BUS M, `3` AUX |
| `zoneX.operationMode` | string | R/W | `0` NORMAL, `1` BRIDGED |
| `zoneX.lowCutFilterSpeakerOne` / `zoneX.lowCutFilterSpeakerTwo` | boolean | R/W | Low-Cut-Filter des Lautsprechers |
| `zoneX.zoneTurnOnModeChange` | string | R/W | `0` dauerhaft, `1` Trigger-Eingang, `2` Audiosignal, `3` aus |
| `zoneX.triggerInput` | boolean | R/W | Trigger-Eingang |
| `zoneX.audioSignalInput` | boolean | R/W | Audiosignal-Eingang |
| `system.powerConfigurationChange` | string | R/W | Power-Konfiguration |
| `system.masterTriggerInput` | boolean | R/W | Master-Trigger-Eingang |

## Fehlende Funktionen & Fehler

Fehlende Funktionen oder Fehler bitte als [Issue](https://github.com/foxriver76/ioBroker.denon/issues) melden,
mit Debug-Log und Modell des Receivers.
