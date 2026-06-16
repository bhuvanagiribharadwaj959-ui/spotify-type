#!/usr/bin/env python3

from __future__ import annotations

import json
import os
import re
import secrets  # Used to generate 32-character unique keys
from collections.abc import Iterable
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus
from urllib.request import Request, urlopen


ROOT_DIR = Path(__file__).resolve().parent
APP_DIR = ROOT_DIR / "app"
OUTPUT_PATH = APP_DIR / "final_song_list.json"
DATASET_FILES = [
    APP_DIR / "dali_v1_metadata.json",
    APP_DIR / "era_1.json",
    APP_DIR / "era_2.json",
    APP_DIR / "era_3.json",
]


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    cleaned = re.sub(r"[^a-z0-9]+", " ", value.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def extract_tracks(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, dict):
        results = value.get("results")
        if isinstance(results, list):
            return [track for track in results if isinstance(track, dict)]
        return []

    if isinstance(value, Iterable) and not isinstance(value, (str, bytes, dict)):
        return [track for track in value if isinstance(track, dict)]

    return []


def get_genius_token() -> str:
    token = "mu1t8HVYDIux21hanFInD8IOm0waWpabFPugeJYwUj4mTIDvdGKAN1MqyZ7KAZTY"
    if token:
        return token

    load_env_file(ROOT_DIR / ".env")
    token = os.getenv("GENIUS_API") or os.getenv("GENIUS_API_KEY")
    if token:
        return token

    raise SystemExit("GENIUS_API or GENIUS_API_KEY is required to fetch era artwork from Genius.")


def fetch_json(url: str, token: str) -> dict[str, Any]:
    separator = "&" if "?" in url else "?"
    request = Request(f"{url}{separator}access_token={quote_plus(token)}")
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def score_genius_result(result: dict[str, Any], artist: str, title: str) -> float:
    artist_norm = normalize_text(artist)
    title_norm = normalize_text(title)
    result_artist = normalize_text(result.get("primary_artist", {}).get("name"))
    result_artists = normalize_text(result.get("artist_names"))
    result_title = normalize_text(result.get("title"))

    score = 0.0
    if artist_norm and (artist_norm == result_artist or artist_norm in result_artists):
        score += 2.0
    if title_norm and title_norm == result_title:
        score += 2.0
    if title_norm and (title_norm in result_title or result_title in title_norm):
        score += 1.0

    ratio = SequenceMatcher(None, f"{artist_norm} {title_norm}".strip(), f"{result_artist} {result_title}".strip()).ratio()
    return score + ratio


def fetch_genius_song_image(artist: str, title: str, token: str, cache: dict[tuple[str, str], str | None]) -> str | None:
    cache_key = (normalize_text(artist), normalize_text(title))
    if cache_key in cache:
        return cache[cache_key]

    query = quote_plus(f"{artist} {title}")
    try:
        payload = fetch_json(f"https://api.genius.com/search?q={query}", token)
        hits = payload.get("response", {}).get("hits", [])
    except HTTPError as e:
        if e.code in (401, 403):
            print(f"[WARNING] Genius API Key is invalid or unauthorized (HTTP {e.code}). Falling back to Apple image.")
        cache[cache_key] = None
        return None
    except (URLError, TimeoutError, json.JSONDecodeError):
        cache[cache_key] = None
        return None

    best_image: str | None = None
    best_score = -1.0

    for hit in hits:
        result = hit.get("result", {})
        image_url = result.get("song_art_image_url")
        if not image_url:
            continue
        score = score_genius_result(result, artist, title)
        if score > best_score:
            best_score = score
            best_image = image_url

    cache[cache_key] = best_image
    return best_image


def fetch_youtube_id(artist: str, title: str, cache: dict[tuple[str, str], str | None]) -> str | None:
    cache_key = (normalize_text(artist), normalize_text(title))
    if cache_key in cache:
        return cache[cache_key]

    query = quote_plus(f"{artist} {title} official audio")
    request = Request(
        f"https://www.youtube.com/results?search_query={query}",
        headers={"User-Agent": "Mozilla/5.0"},
    )

    try:
        html = urlopen(request, timeout=30).read().decode("utf-8", errors="ignore")
    except (HTTPError, URLError, TimeoutError):
        cache[cache_key] = None
        return None

    matches = re.findall(r'"videoId":"([A-Za-z0-9_-]{11})"', html)
    youtube_id = matches[0] if matches else None
    cache[cache_key] = youtube_id
    return youtube_id


def generate_unique_32_hex_id(used_keys: set[str]) -> str:
    """Generates a unique 32-character hex ID matching DALI dataset format."""
    while True:
        key = secrets.token_hex(16)  # 16 bytes = 32 hex characters
        if key not in used_keys:
            used_keys.add(key)
            return key


def make_era_record(track: dict[str, Any], key: str, genius_image: str | None, youtube_id: str | None) -> dict[str, Any]:
    release_date = str(track.get("releaseDate", ""))
    release_year = release_date[:4] if release_date else ""
    
    # Clean up Apple covers to a crisp high resolution if Genius fails
    apple_cover = track.get("artworkUrl100") or track.get("artworkUrl60") or track.get("artworkUrl30") or ""
    if apple_cover and not genius_image:
        apple_cover = apple_cover.replace("100x100bb", "1000x1000bb").replace("60x60bb", "1000x1000bb")

    metadata: dict[str, Any] = {
        "album": track.get("collectionName", ""),
        "release_date": release_year,
        "cover": genius_image or apple_cover,
        "genres": [track["primaryGenreName"]] if track.get("primaryGenreName") else [],
        "language": "english",  # Matched target schema structure
    }

    preview_url = track.get("previewUrl") or ""
    final_audio_url = youtube_id if youtube_id else preview_url

    return {
        "dataset_version": 1,
        "ground-truth": False,
        "artist": track.get("artistName", ""),
        "title": track.get("trackName", ""),
        "scores": {"NCC": 0.85, "manual": 0},  # Set a standard baseline matching sample
        "audio": {
            "url": final_audio_url,
            "path": "None",
            "working": bool(final_audio_url),
        },
        "id": key,
        "metadata": metadata,
    }


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    token = get_genius_token()
    genius_cache: dict[tuple[str, str], str | None] = {}
    youtube_cache: dict[tuple[str, str], str | None] = {}
    merged: dict[str, Any] = {}
    used_keys: set[str] = set()

    # 1. Inject existing DALI records perfectly
    dali_data = load_json(DATASET_FILES[0])
    if isinstance(dali_data, dict):
        for key, record in dali_data.items():
            merged[key] = record
            used_keys.add(key)

    # 2. Parse Eras, look up content, and append matching targets
    for era_path in DATASET_FILES[1:]:
        if not era_path.exists():
            print(f"[INFO] Skipping missing file: {era_path.name}")
            continue

        print(f"Parsing {era_path.name}...")
        era_data = load_json(era_path)
        for track in extract_tracks(era_data):
            
            # Generate a clean 32-character ID string matching DALI
            key = generate_unique_32_hex_id(used_keys)
            
            artist_name = str(track.get("artistName", ""))
            track_title = str(track.get("trackName", ""))

            # Process Genius Image Lookup
            genius_image = fetch_genius_song_image(
                artist_name,
                track_title,
                token,
                genius_cache,
            )
            
            # Process HTML YouTube search extraction
            youtube_id = fetch_youtube_id(
                artist_name,
                track_title,
                youtube_cache,
            )
            
            # Build and commit the clean structured dictionary object
            merged[key] = make_era_record(track, key, genius_image, youtube_id)

    # Ensure output folder configuration
    APP_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nSuccess! Wrote {len(merged)} uniform records to {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())