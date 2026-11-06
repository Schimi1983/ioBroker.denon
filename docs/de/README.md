![Logo](media/denon.png)

# ioBroker.denon – Denon/Marantz AV-Receiver

Mit diesem Adapter steuerst du deinen Denon- oder Marantz-AV-Receiver aus ioBroker: ein- und ausschalten, Lautstärke,
Eingang, Surround-Modus, Zone 2/3, Tuner und viele Klang- und Bildeinstellungen. Änderungen am Receiver (z. B. über die
Fernbedienung) erscheinen sofort in ioBroker.

## Haftungsausschluss

DENON und Marantz sind Marken der D&M Holdings Inc.
Die Entwickler dieses Moduls stehen in keiner Verbindung zur D&M Holdings Inc. oder zu deren Tochtergesellschaften,
Logos oder Marken und werden von diesen nicht unterstützt.

## Inhalt

* [Schnellstart](#schnellstart)
* [Die wichtigsten Datenpunkte](#die-wichtigsten-datenpunkte)
* [Konfiguration](#konfiguration)
* [Netzwerkeinstellungen am AV-Receiver](#netzwerkeinstellungen-am-av-receiver)
* [Häufige Fragen](#häufige-fragen)
* [Update von 1.x](#update-von-1x)
* [Alle Datenpunkte](#alle-datenpunkte)
* [Mehrzonen-Verstärker (DENON POA-3012CI)](#mehrzonen-verstärker-denon-poa-3012ci)
* [Technische Details](#technische-details)
* [Fehlende Funktionen & Fehler](#fehlende-funktionen--fehler)

## Schnellstart

1. Am Receiver im Menü „Netzwerk“ → „Netzwerk-Strg.“ auf **„Immer ein“** stellen (Details [unten](#netzwerkeinstellungen-am-av-receiver)).
2. In ioBroker im Reiter „Adapter“ nach **denon** suchen und auf „+“ klicken.
3. In der Instanz die IP-Adresse des Receivers eintragen (oder aus der Liste der gefundenen Geräte wählen) und speichern.
4. Nach wenigen Sekunden ist `info.connection` grün und unter `denon.0` erscheinen die Datenpunkte deines Receivers.

Mehr ist nicht nötig. Welche Datenpunkte angelegt werden, hängt vom Modell ab: Der Adapter legt nur an, was dein Receiver auch kann.

Voraussetzungen: Denon- oder Marantz-AV-Receiver im Netzwerk (LAN oder WLAN), Node.js >= 22, js-controller >= 6.0.11, Admin >= 7.6.20.

## Die wichtigsten Datenpunkte

Für VIS, Blockly oder Skripte reichen meistens diese (statt `main` gibt es `zone2` und `zone3` genauso):

| Datenpunkt | Wozu | Beispiel |
|---|---|---|
| `denon.0.system.power` | ganzen Receiver ein / Standby | `true` = an, `false` = alles aus |
| `denon.0.main.power` | nur die Hauptzone ein/aus | `true` |
| `denon.0.main.volume` | Lautstärke (0 ... 98, wie im Display) | `40` |
| `denon.0.main.mute` | stumm | `true` |
| `denon.0.main.input` | Eingang wählen | `TV` oder der Name aus dem Receiver-Menü, z. B. `TV Audio` |
| `denon.0.main.quickSelect` | Quick Select (Marantz: Smart Select) abrufen | `1` |
| `denon.0.main.surroundMode` | Surround-Modus | `STEREO` |
| `denon.0.info.connection` | Verbindung zum Receiver steht | `true` |

Tasten wie `main.volumeUp` oder `remote.up` werden mit `true` ausgelöst.

## Konfiguration

Normalerweise muss nur die IP-Adresse eingetragen werden.

| Einstellung | Bedeutung |
|---|---|
| IP-Adresse des Receivers | z. B. `192.168.1.50` (IPv6 und Hostname gehen auch). Solange die Instanz läuft, werden gefundene Receiver vorgeschlagen. Die Suche findet nur Geräte im selben Netz wie ioBroker, sonst die Adresse von Hand eintragen. |
| Aktualisierungsintervall (ms) | Wie oft Werte gelesen werden, die der Receiver nicht selbst meldet (z. B. Sleep-Timer). Standard 7000 = alle 7 Sekunden |
| Pause zwischen Befehlen (ms) | Nur erhöhen, wenn der Receiver Befehle verpasst. Standard 100, mindestens 50 |
| Port | Immer 23. Nur für einen Seriell-Netzwerk-Wandler ändern |
| Marke, Modell und Zonen automatisch erkennen | Empfohlen. Liest beim Start Marke, Modell und Anzahl der Zonen aus dem Receiver. Gesteuert wird trotzdem immer über Port 23 |

## Netzwerkeinstellungen am AV-Receiver

1. Taste SETUP auf der Fernbedienung drücken, das Menü erscheint im Gerätedisplay und auf dem Fernseher
2. „Netzwerk“ → „Einstellungen“ wählen und einstellen
    * DHCP: „Ein“, wenn ein DHCP-Server (z. B. Router) vorhanden ist, sonst IP-Adresse, Subnetzmaske und Gateway manuell setzen
    * Proxy: „Aus“
3. „Netzwerk“ → „Netzwerk-Strg.“ (bei manchen Modellen „IP-Steuerung“) auf **„Immer ein“** stellen.
   Mit „Aus im Standby“ ignoriert der Receiver im Standby alle Netzwerkbefehle und lässt sich von ioBroker nicht einschalten.

Tipp: Im Router dem Receiver eine feste IP-Adresse geben, damit sich die Adresse nicht ändert.

## Häufige Fragen

**`info.connection` wird nicht grün**
* Stimmt die IP-Adresse? Sie steht im Receiver-Menü unter „Netzwerk“ → „Information“ oder in der Geräteliste des Routers.
* Der Receiver erlaubt nur **eine** Steuerverbindung. Läuft eine andere App, die ihn steuert (Home Assistant, ein zweiter ioBroker, ein Skript), bekommt der Adapter keine Verbindung.
* Steht „Netzwerk-Strg.“ auf „Immer ein“?

**Der Receiver lässt sich nicht einschalten**
* „Netzwerk-Strg.“ steht wahrscheinlich auf „Aus im Standby“. Auf „Immer ein“ stellen.

**Ein Datenpunkt fehlt**
* Der Adapter legt nur Datenpunkte an, auf die der Receiver antwortet. Fehlt einer, kann dein Modell diese Funktion nicht (z. B. Bass/Höhen in Zone 2 beim AVR-X2200W).
* Manche Werte meldet der Receiver erst, wenn die Zone eingeschaltet ist.

**Ein Eingang fehlt in der Auswahl oder hat einen anderen Namen**
* Die Liste kommt aus dem Receiver: Eingänge, die im Menü unter „Eingänge“ ausgeblendet sind, fehlen auch hier. Umbenannte Eingänge erscheinen mit dem neuen Namen. Nach einer Änderung im Receiver die Instanz einmal neu starten.

**Display, Cover oder Wiedergabetasten fehlen**
* Modelle mit HEOS (ab etwa 2016) geben diese Infos nicht über die Steuerverbindung heraus.

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

## Alle Datenpunkte

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

## Technische Details

* **Verbindung:** Der Adapter nutzt das offizielle Telnet-Steuerprotokoll auf Port 23. Nach einem Verbindungsverlust verbindet er sich selbst neu (1 s, 2 s, 4 s ... bis 60 s). Sendet der Receiver 30 Sekunden lang nichts, wird eine Abfrage geschickt; ohne Antwort wird neu verbunden. Eine abgelehnte Verbindung wird erst nach 30 Sekunden als Warnung gemeldet, weil auch ein hochfahrender Receiver einige Sekunden ablehnt.
* **Befehlstakt:** Befehle werden in eine Warteschlange gestellt und im eingestellten Abstand gesendet. Befehle des Nutzers kommen vor ausstehenden Abfragen. Nach dem Einschalten wird der nächste Befehl wie im Protokoll gefordert um 1 Sekunde verzögert.
* **Werte:** Gelesene Werte von Auswahllisten sind die Codes des Receivers (z. B. `BRI`). Geschrieben werden kann der Code oder der angezeigte Name. Vom Receiver gemeldete Surround-Modi, die in der Liste fehlen, werden automatisch ergänzt.
* **Denon und Marantz:** Quick Select heißt bei Denon `QUICK`, bei Marantz `SMART`. Der Adapter erkennt die Marke und sendet nur den passenden Befehl.
* **Einstellungen im Standby geändert:** Beim Einschalten der Hauptzone liest der Adapter alle Einstellungen neu.

## Fehlende Funktionen & Fehler

Fehlende Funktionen oder Fehler bitte als [Issue](https://github.com/foxriver76/ioBroker.denon/issues) melden,
mit Debug-Log und Modell des Receivers.
