# KmlViewer

Lekka aplikacja do przeglądania i analizy tras GPS oraz danych mapowych. Projekt zawiera frontend do podglądu danych, serwer Node.js oraz skrypty do importu i przetwarzania plików GPX i FIT.

## Zaimplementowane funkcjonalności

### Frontend i mapa

- renderowanie mapy w `HTML5 Canvas` z obsługą kafli mapowych
- przełączanie źródła mapy między `OpenStreetMap`, `OpenCycleMap` i warstwą satelitarną `Esri`
- płynne przesuwanie, zoom myszą i gestami dotykowymi oraz reset widoku
- drag and drop plików `KML` i `GPX` bezpośrednio na mapę
- wczytywanie przykładowego pliku `sample.kml` przy starcie aplikacji
- statystyki obiektów na mapie: liczba polygonów, linii i punktów
- podgląd współrzędnych kursora na mapie

### Warstwy i analiza przestrzenna

- włączanie i wyłączanie warstw siatki `Ubersquadrat`, `Squadrats`, `Squadrathinos` i `Tile17`
- dynamiczne dociąganie z backendu rekordów `Tile17` tylko dla aktualnie widocznego obszaru
- podgląd wybranego kafla dla poziomów `Z11`, `Z14`, `Z17`, `Z18`, `Z19`, `Z20`, `Z21` i `Z22`
- szczegóły kafla `Tile17`: lista szlaków i tras użytkownika przecinających wybrany kafel
- podświetlanie kafli `Tile17` należących do wybranej trasy lub szlaku
- proste liczenie odległości w linii prostej pomiędzy dwoma wskazanymi punktami

### Szlaki i trasy użytkownika

- osobna warstwa szlaków GPX ładowana z bazy dla aktualnego widoku mapy
- filtrowanie szlaków po województwach oraz typach `foot` i `hiking`
- osobna warstwa tras użytkownika ładowana z bazy dla aktualnego widoku mapy
- liczenie łącznej długości aktualnie wyświetlonych szlaków i tras użytkownika
- wyróżnianie klikniętej trasy na mapie

### Rejestrowanie i zapisywanie śladu

- śledzenie bieżącej lokalizacji z użyciem `Geolocation API`
- rysowanie na żywo śladu podczas nagrywania trasy
- generowanie pliku `GPX` z nagranego śladu
- zapis śladu do backendu przez endpoint `POST /save-gpx`
- awaryjne pobranie pliku lokalnie, jeżeli zapis po stronie serwera jest niedostępny

### Backend i API

- serwer `Express` serwujący frontend oraz endpointy mapowe
- endpoint zdrowia aplikacji
- endpointy do listy zapisanych plików GPX i zapisu nowych śladów
- endpointy do pobierania regionów szlaków, szlaków w obrębie bounding boxa i tras użytkownika
- endpointy do pobierania danych `Tile17`, szczegółów pojedynczego kafla i kafli przypisanych do trasy
- middleware kontekstu użytkownika i logowanie zdarzeń zapisu GPX

### Import i przetwarzanie danych

- import tras GPX do bazy danych
- import tras użytkownika do osobnej kategorii
- konwersja plików `FIT` do `GPX`
- backfill powiązań tras z kaflami `Tile17`
- zbiorczy pipeline `refresh:all` uruchamiający importy i backfill
- paski postępu w skryptach uruchamianych z terminala

## Wymagania

- Node.js
- npm
- PostgreSQL z PostGIS, jeśli chcesz używać importów do bazy

## Instalacja

```bash
git clone https://github.com/klancyk3/KmlViewer.git
cd KmlViewer
npm install
```

## Konfiguracja

Skrypty i serwer korzystają z poniższych zmiennych środowiskowych:

- `PORT` - port serwera HTTP, domyślnie `5174`
- `DATABASE_URL` - wymagane dla importów GPX i backfillu `Tile17`
- `EXTERNAL_GPX_DIR` - katalog z zewnętrznymi plikami GPX, domyślnie `D:\Maps\Gpx`
- `USER_GPX_DIR` - katalog z trasami użytkownika GPX, domyślnie `D:\Maps\UserGpx`

Przykład w PowerShell dla uruchamiania lokalnie z Windows:

```powershell
$env:DATABASE_URL="postgres://kmlviewer:kmlviewer@localhost:15433/kmlviewer"
$env:EXTERNAL_GPX_DIR="D:\Maps\Gpx"
$env:USER_GPX_DIR="D:\Maps\UserGpx"
```

Jeśli uruchamiasz aplikację wewnątrz `docker compose`, wtedy host `postgres` jest poprawny:

```text
postgres://kmlviewer:kmlviewer@postgres:5432/kmlviewer
```

## Uruchomienie aplikacji

Start serwera:

```bash
npm start
```

Serwer domyślnie startuje na porcie `5174`, chyba że ustawisz `PORT`.

## Skrypty npm

Wszystkie dostępne skrypty z `package.json`:

### `npm start`

Uruchamia serwer aplikacji:

```bash
npm start
```

### `npm run import:gpx`

Importuje pliki GPX z katalogu `EXTERNAL_GPX_DIR` do bazy danych. Wymaga ustawionego `DATABASE_URL`.

```bash
npm run import:gpx
```

### `npm run import:user-gpx`

Importuje pliki GPX z katalogu `USER_GPX_DIR` jako trasy użytkownika. Wymaga ustawionego `DATABASE_URL`.

```bash
npm run import:user-gpx
```

### `npm run convert:fit -- <input-path> [output-dir] [--overwrite]`

Konwertuje pojedynczy plik `.fit` albo cały katalog plików `.fit` do formatu `.gpx`.

Przykłady:

```bash
npm run convert:fit -- "D:\Tracks\activity.fit"
npm run convert:fit -- "D:\Tracks\Fit" "D:\Tracks\Gpx"
npm run convert:fit -- "D:\Tracks\Fit" "D:\Tracks\Gpx" --overwrite
```
npm run convert:fit -- "D:\Maps\UserGpx\garmin\DI_CONNECT\DI-Connect-Uploaded-Files\UploadedFiles_0-_Part1" "D:\Maps\UserGpx\garmin\DI_CONNECT\DI-Connect-Uploaded-Files"


Zasady działania:

- jeśli wejściem jest pojedynczy plik `.fit`, powstanie jeden plik `.gpx`
- jeśli wejściem jest katalog, skrypt przetworzy wszystkie pliki `.fit` z tego katalogu
- jeśli nie podasz `output-dir`, pliki GPX zostaną zapisane do podkatalogu `gpx` wewnątrz katalogu wejściowego
- `--overwrite` pozwala nadpisać istniejące pliki wynikowe

### `npm run backfill:tile17`

Uzupełnia powiązania tras z rekordami `Tile17`. Wymaga ustawionego `DATABASE_URL`.

```bash
npm run backfill:tile17
```

### `npm run refresh:all`

Uruchamia pełny pipeline odświeżenia danych:

1. import GPX z `EXTERNAL_GPX_DIR`
2. import GPX użytkownika z `USER_GPX_DIR`
3. backfill `Tile17`

```bash
npm run refresh:all
```

Przy uruchamianiu z terminala skrypt pokazuje pasek postępu dla całego pipeline'u oraz dla poszczególnych etapów.

### `npm test`

Uruchamia testy jednostkowe w Jest:

```bash
npm test
```

### `npm run test:watch`

Uruchamia testy w trybie obserwacji zmian:

```bash
npm run test:watch
```

### `npm run test:coverage`

Uruchamia testy i generuje raport pokrycia:

```bash
npm run test:coverage
```

## Skrypty w katalogu `scripts/`

Poniższe pliki są wywoływane przez skrypty npm:

- `scripts/import-gpx-directory.js` - import GPX z `EXTERNAL_GPX_DIR`
- `scripts/import-user-gpx-directory.js` - import GPX użytkownika z `USER_GPX_DIR`
- `scripts/convert-fit-to-gpx.js` - konwersja `FIT -> GPX`
- `scripts/backfill-trail-tile17.js` - backfill relacji tras do `Tile17`

Można je uruchamiać także bezpośrednio przez `node`, na przykład:

```bash
node scripts/convert-fit-to-gpx.js "D:\Tracks\Fit" "D:\Tracks\Gpx" --overwrite
```

## Status

Projekt jest w trakcie rozwoju.

## Autor

`klancyk3`
todo: Aplikacja ma służyć do łapania kwadratów na portalu: Squadrats.com
todo:
na komórce,
odznaczanie przebytych własnie kwadratów
wyszukiwanie optymalnej drogi na dane rodzaje tras (rowerowa, biegowa, hardkorowa)
- połączenie kwadratów i szlaków turystycznych
- 
- mapa turystyczna, 
- maps google
- mapy.cz

apka kliencka :
- notować trasy 
- zaciagac treningi gpx
