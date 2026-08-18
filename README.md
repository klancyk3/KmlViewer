# KmlViewer

Lekka aplikacja do przeglądania i analizy tras GPS oraz danych mapowych. Projekt zawiera frontend do podglądu danych, serwer Node.js oraz skrypty do importu i przetwarzania plików GPX i FIT.

## Funkcje

- wczytywanie i wizualizacja danych geograficznych
- import tras GPX do bazy danych
- import tras użytkownika do osobnej kategorii
- konwersja plików FIT do GPX
- backfill powiązań tras z kaflami `Tile17`

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

## Paski postępu w PowerShell

Skrypty uruchamiane z terminala pokazują procentowy postęp bieżącego zadania:

- `npm run import:gpx`
- `npm run import:user-gpx`
- `npm run convert:fit`
- `npm run backfill:tile17`
- `npm run refresh:all`

W przypadku importów i konwersji procent liczony jest względem liczby plików, a przy backfillu względem liczby tras do przetworzenia.

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
