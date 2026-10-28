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
* **HEOS-Modelle:** Receiver mit HEOS (Modelle ab 2016) melden Displayinhalt und Cover der Netzwerkquellen nicht über Telnet.

## Update von 1.x

Version 2.0.0 meldet in einigen States die Protokoll-Codes. Skripte und Visualisierungen, die die **gelesenen** Werte
vergleichen, müssen angepasst werden:

| State | Werte bis 1.x | Werte ab 2.0.0 |
|---|---|---|
| `display.brightness` | `Off`, `Dark`, `Dimmed`, `Bright` | `OFF`, `DAR`, `DIM`, `BRI` |
| `settings.videoProcessingMode` | `AUTO`, `GAME`, `MOVIE` (tatsächlich gemeldet als `MAUTO` usw.) | `AUTO`, `GAME`, `MOVI`, `BYP` |
| `settings.pictureMode` | wurde nie gefüllt | `OFF`, `STD`, `MOV`, `VVD`, `STM`, `CTM`, `DAY`, `NGT` |

Schreiben funktioniert weiterhin mit den alten Werten: Der Anzeigename (z. B. `Bright`, `Movie`) und der Listenindex aus 1.x
(z. B. `selectInput` = `'5'` für TV, `surroundMode` = `'3'` für MCH STEREO) werden in den Protokoll-Code umgesetzt.
Eingänge, Surround-Modi, MultEQ und Dynamic Volume behalten ihre Werte; nur die Wertelisten nutzen jetzt den Wert als Schlüssel.
Bestehende Objekte werden beim ersten Start automatisch umgestellt.

## States

Mit *(bei Bedarf)* gekennzeichnete States werden nur angelegt, wenn der Receiver auf die zugehörige Abfrage antwortet.

### Kanal: info

| State | Typ | R/W | Beschreibung |
|---|---|---|---|
| `info.connection` | boolean | R | `true`, solange die Telnet-Verbindung besteht |
| `info.friendlyName` | string | R | Gerätename des Receivers |
| `info.model` | string | R | Modell, z. B. `AVR-X2200W` (HTTP-Erkennung) |
| `info.brand` | string | R | `Denon` oder `Marantz` (HTTP-Erkennung) |
| `info.zones` | number | R | Anzahl Zonen inkl. Hauptzone (HTTP-Erkennung) |
| `info.audioSignalCode` | string | R | *(bei Bedarf)* Code des Audio-Eingangssignals, siehe Tabelle unten |
| `info.audioSampleRate` | string | R | *(bei Bedarf)* Abtastrate des Audio-Eingangssignals, z. B. `48K` |
| `info.videoResolutionCode` | string | R | *(bei Bedarf)* Rohcode der Videoauflösung (Modelle bis etwa 2016) |
| `info.videoInputResolution` / `info.videoOutputResolution` | string | R | *(bei Bedarf)* Auflösung am HDMI-Eingang / -Ausgang, z. B. `1080p`, `1080p 24Hz`, `2160p 24/25Hz`, `2160p 50/60Hz`, `no signal` |
| `info.firmware` / `info.firmwareDts` | string | R | *(bei Bedarf)* Firmware-Version des Receivers und des DTS-Decoders |
| `info.onlinePresets` | string | R | JSON-Array der gespeicherten Netzwerk-Favoriten (ID und Sender) |

Gemessene Signal-Codes eines AVR-X2200W. Die Codes hängen von der Modellgeneration ab, neuere Modelle können andere Werte nutzen:

| `audioSignalCode` | Signal | | Ziffer `videoResolutionCode` | Auflösung |
|---|---|---|---|---|
| `01` | Standby / analog | | `0` | kein Signal |
| `02` | PCM (Stereo und Mehrkanal) | | `2` | 480p/576p |
| `03` | Dolby Digital | | `6` | 720p |
| `04` | Dolby Digital Plus | | `7` | 1080p 50/60 Hz |
| `05` | Dolby TrueHD (auch mit Atmos) | | `8` | 1080p 24 Hz |
| `06` | DTS | | `9` | 2160p 24/25 Hz |
| `08` | DTS-HD High Resolution | | | |
| `09` | DTS-HD Master Audio | | `A` | 2160p 50/60 Hz |
| `12` | Umschaltung, noch kein Signal | | | |

Der Video-Code besteht aus `0`, der Ziffer für den Eingang und der Ziffer für den Ausgang, z. B. `088` = 1080p 24 Hz ein und aus, `009` = kein Eingang (TV über ARC), Ausgang 4K.
Andere Ziffern werden als `unknown (n)` gemeldet, bis sie bestätigt sind.

### Kanal: zoneMain / zone2 / zone3

Zone 2 und Zone 3 werden angelegt, sobald der Receiver sie meldet. Alle States gibt es je Zone, sofern nicht anders angegeben.

| State | Typ | R/W | Beschreibung |
|---|---|---|---|
| `powerZone` | boolean | R/W | Power der Zone |
| `volume` | number | R/W | Lautstärke 0 ... 98, 80 = 0 dB. Hauptzone in 0,5er-Schritten, Zone 2/3 nur ganze Schritte (Werte werden gerundet) |
| `volumeDB` | number | R/W | Lautstärke in dB, -80 ... +18 |
| `volumeUp` / `volumeDown` | Taste | W | Lautstärke erhöhen / verringern |
| `maximumVolume` / `maximumVolumeDB` | number | R | Maximale Lautstärke (nur Hauptzone) |
| `muteIndicator` | boolean | R/W | Stummschaltung |
| `selectInput` | string | R/W | Eingangsquelle, z. B. `TV`, `SAT/CBL`, `BD`, `GAME`, `MPLAY`, `NET`, `BT`, `TUNER`, `AUX1`. Zone 2/3: `SOURCE` = folgt der Quelle der Hauptzone. Vom Receiver gemeldete Eingänge werden der Werteliste hinzugefügt. |
| `quickSelect` | number | R/W | Quick Select / Smart Select 1 ... 5, `0` = keine aktiv |
| `sleepTimer` | number | R/W | Sleep-Timer in Minuten 0 ... 120, `0` = aus |
| `equalizerBass` / `equalizerTreble` | number | R/W | Bass / Höhen -6 ... +6 dB (Dynamic EQ aus und Klangregelung an erforderlich) |
| `equalizerBassUp` / `equalizerBassDown` / `equalizerTrebleUp` / `equalizerTrebleDown` | Taste | W | Bass / Höhen schrittweise ändern |
| `channelVolume<Lautsprecher>` | number | R/W | Kanalpegel -12 ... +12 dB je Lautsprecher, z. B. `channelVolumeFrontLeft`, `channelVolumeCenter`, `channelVolumeSubwooferTwo`. Die Hauptzone hat alle Lautsprecher des Protokolls, Zone 2/3 vorne links und rechts |
| `playPause` / `play` / `pause` / `skipPlus` / `skipMinus` | Taste | W | Wiedergabesteuerung für Netzwerk-, Bluetooth- und USB-Quellen (nur Hauptzone) |
| `iconURL` | string | R | URL des Covers der Netzwerkquelle (nur Hauptzone, nicht bei HEOS-Modellen) |

```javascript
setState('denon.0.zoneMain.volume', 45.5); // Lautstärke 45,5 (-34,5 dB)
setState('denon.0.zoneMain.selectInput', 'TV'); // Eingang TV wählen
```

### Kanal: settings

| State | Typ | R/W | Beschreibung |
|---|---|---|---|
| `powerSystem` | boolean | R/W | Systemstrom (an / Standby) |
| `surroundMode` | string | R/W | Surround-Modus wie vom Receiver gemeldet, z. B. `STEREO`, `DOLBY SURROUND`, `DTS HD+NEURAL:X`. Neue Modi werden automatisch der Werteliste hinzugefügt |
| `soundModeMovie` / `soundModeMusic` / `soundModeGame` / `soundModeDirect` / `soundModePureDirect` / `soundModeStereo` / `soundModeAuto` | Taste | W | Wählt eine Gruppe von Surround-Modi; der Receiver nimmt den besten Modus der Gruppe für das aktuelle Signal |
| `soundModeGroup` | string | R | *(bei Bedarf)* Aktive Gruppe der Surround-Modi: `MOV` (Film), `MUS` (Musik), `GAM` (Spiel), `PUR` (Pure) |
| `dynamicEq` | boolean | R/W | Audyssey Dynamic EQ |
| `multEq` | string | R/W | MultEQ: `OFF`, `AUDYSSEY`, `BYP.LR`, `FLAT`, `MANUAL` |
| `dynamicVolume` | string | R/W | Dynamic Volume: `OFF`, `LIT`, `MED`, `HEV` |
| `referenceLevelOffset` | string | R/W | Reference Level Offset: `0`, `5`, `10`, `15` dB |
| `audysseyLfc` | boolean | R/W | *(bei Bedarf)* Audyssey Low Frequency Containment |
| `containmentAmount` | number | R/W | *(bei Bedarf)* LFC-Stärke 1 ... 7, Tasten `containmentAmountUp` / `containmentAmountDown` |
| `toneControl` | boolean | R/W | Klangregelung (nur bei ausgeschaltetem Dynamic EQ möglich) |
| `subwooferLevelState` | boolean | R/W | Aktiviert die Einstellung des Subwoofer-Pegels |
| `subwooferLevel` / `subwooferTwoLevel` | number | R/W | Subwoofer-Pegel -12 ... +12 dB (`subwooferTwoLevel` bei Bedarf), Tasten `subwooferLevelUp/Down`, `subwooferTwoLevelUp/Down` |
| `lfeAmount` | number | R/W | LFE-Pegel 0 ... 10, 10 = -10 dB |
| `centerSpread` | boolean | R/W | Center Spread |
| `dialogLevelAdjust` / `dialogLevel` | boolean / number | R/W | Dialogpegel für DTS-Inhalte, -12 ... +12 dB |
| `dialogControl` | number | R/W | DTS:X Dialog Control 0 ... 6 dB |
| `dynamicCompression` | string | R/W | *(bei Bedarf)* Dynamikkompression: `AUTO`, `LOW`, `MID`, `HI`, `OFF` |
| `audioRestorer` | string | R/W | *(bei Bedarf)* Audio Restorer: `OFF`, `LOW`, `MED`, `HI` |
| `ecoMode` | string | R/W | *(bei Bedarf)* ECO-Modus: `ON`, `AUTO`, `OFF` |
| `autoStandby` | string | R/W | *(bei Bedarf)* Auto-Standby der Hauptzone: `15M`, `30M`, `60M`, `OFF` |
| `inputMode` | string | R/W | *(bei Bedarf)* Audio-Eingangsmodus: `AUTO`, `HDMI`, `DIGITAL`, `ANALOG`, `EXT.IN`, `7.1IN`, `ARC`; `NO` = kein Eingangssignal |
| `digitalInputMode` | string | R/W | *(bei Bedarf)* Digital-Eingangsmodus: `AUTO`, `PCM`, `DTS` |
| `outputMonitor` | number | R/W | *(bei Bedarf)* HDMI-Ausgang bei Receivern mit zwei Ausgängen: `0` automatisch, `1`, `2` |
| `videoProcessingMode` | string | R/W | *(bei Bedarf)* Videoverarbeitung: `AUTO`, `GAME`, `MOVI`, `BYP` |
| `hdmiResolution` / `analogResolution` | string | R/W | *(bei Bedarf)* Ausgangsauflösung der Videoumwandlung (HDMI / analog): `48P`, `10I`, `72P`, `10P`, `10P24`, `4K`, `4KF`, `AUTO` |
| `aspectRatio` | string | R/W | *(bei Bedarf)* Seitenverhältnis: `NRM` (4:3), `FUL` (16:9) |
| `pictureMode` | string | R/W | *(bei Bedarf)* Bildmodus: `OFF`, `STD`, `MOV`, `VVD`, `STM`, `CTM`, `DAY`, `NGT` |
| `speakerPreset` | number | R/W | *(bei Bedarf)* Lautsprecher-Preset `1` oder `2` |
| `setupMenu` | boolean | R/W | Öffnet / schließt das Setup-Menü |
| `cursorUp` / `cursorDown` / `cursorLeft` / `cursorRight` / `enter` / `return` / `option` / `info` | Taste | W | Tasten der Fernbedienung für die Menüsteuerung |
| `savePreset` / `loadPreset` | string | R/W | Speichert den aktuellen Netzwerksender unter der angegebenen ID aus `info.onlinePresets` bzw. lädt ihn. Diese States werden nicht bestätigt |
| `expertCommand` | string | R/W | Sendet einen beliebigen Protokollbefehl, z. B. `ECOON`. Siehe [AVR-Control-Protocol.pdf](../AVR-Control-Protocol.pdf) |
| `expertReadingPattern` | string | R/W | Regulärer Ausdruck (ohne `/` am Anfang und Ende); passende Zeilen vom Receiver werden in `expertReadingResult` geschrieben |
| `expertReadingResult` | string | R | Zuletzt empfangene Zeile, die zu `expertReadingPattern` passt |

States mit Werteliste akzeptieren beim Schreiben den Protokoll-Code oder den Anzeigenamen, z. B. `MOVI` und `Movie` für `videoProcessingMode`.

```javascript
setState('denon.0.settings.surroundMode', 'MCH STEREO');
setState('denon.0.settings.soundModeMovie', true); // bester Film-Modus für das aktuelle Signal
setState('denon.0.settings.expertReadingPattern', '(MV.+)|(SSINFAISFSV.+)');
setState('denon.0.settings.expertCommand', 'ECOON');
```

### Kanal: display

| State | Typ | R/W | Beschreibung |
|---|---|---|---|
| `displayContent0` ... `displayContent8` | string | R | Inhalt des Netzwerkmenüs bzw. der Wiedergabeanzeige, Zeile 0 ist der Titel, Zeile 8 die Seitenanzeige (nicht bei HEOS-Modellen) |
| `cursorLine` | number | R | *(bei Bedarf)* Zeile 1 ... 7, in der der Cursor steht |
| `brightness` | string | R/W | Gerätedisplay: `OFF`, `DAR` (dunkel), `DIM` (gedimmt), `BRI` (hell) |

### Kanal: tuner

| State | Typ | R/W | Beschreibung |
|---|---|---|---|
| `frequency` | number | R/W | Tunerfrequenz, unter 500 UKW in MHz (z. B. `106.9`), über 500 MW in kHz |
| `frequencyUp` / `frequencyDown` | Taste | W | Frequenz schrittweise ändern |
| `stationName` | string | R | RDS-Sendername, falls verfügbar |

## Mehrzonen-Verstärker (DENON POA-3012CI)

Mehrzonen-Verstärker wie der DENON POA-3012CI nutzen ein anderes Protokoll. Die States `info.connection`, `settings.powerSystem`,
`settings.expertCommand` und `display.brightness` entsprechen den oben beschriebenen. Zusätzlich werden für jede Zone
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
| `settings.powerConfigurationChange` | string | R/W | Power-Konfiguration |
| `settings.masterTriggerInput` | boolean | R/W | Master-Trigger-Eingang |

## Fehlende Funktionen & Fehler

Fehlende Funktionen oder Fehler bitte als [Issue](https://github.com/foxriver76/ioBroker.denon/issues) melden,
mit Debug-Log und Modell des Receivers.
