import os
import re
import json
import time
import argparse
import hashlib
import requests
from pathlib import Path
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

BASE_DIR = Path(__file__).resolve().parent
REPO_DIR = BASE_DIR.parent
CONTENT_DIR = REPO_DIR / "content" / "post"
STATE_FILE = BASE_DIR / "data" / "posted.json"
CONFIG_TOML = REPO_DIR / "config.toml"

DEFAULT_BASE_URL = "https://donghuabatch.com/"

def get_base_url():
    if CONFIG_TOML.exists():
        content = CONFIG_TOML.read_text(encoding="utf-8")
        m = re.search(r"baseURL\s*=\s*['\"]([^'\"]+)['\"]", content)
        if m:
            return m.group(1)
    return os.getenv("BASE_URL", DEFAULT_BASE_URL)

def load_env_config():
    token = os.getenv("BOT_TOKEN", "").strip()
    channel = os.getenv("CHANNEL_ID", "").strip()
    base_url = get_base_url().strip()
    if not base_url.endswith("/"):
        base_url = base_url + "/"
    return token, channel, base_url

def parse_frontmatter_simple(text):
    data = {}
    lines = text.splitlines()
    current_key = None
    current_list = None
    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("- "):
            if current_list is not None:
                current_list.append(line[2:].strip().strip("'\""))
            continue
        if ":" in line:
            key, val = line.split(":", 1)
            key = key.strip()
            val = val.strip().strip("'\"")
            if val == "":
                data[key] = []
                current_key = key
                current_list = data[key]
            else:
                data[key] = val
                current_key = key
                current_list = None
    return data

def parse_markdown_file(path):
    if path.name == "_index.md":
        return None
    text = path.read_text(encoding="utf-8").lstrip("\ufeff")
    m = re.match(r"^---\s*\n(.*?)\n---\s*", text, re.DOTALL)
    if not m:
        return None
    front = m.group(1)
    if HAS_YAML:
        try:
            data = yaml.safe_load(front)
            if not isinstance(data, dict):
                data = parse_frontmatter_simple(front)
        except Exception:
            data = parse_frontmatter_simple(front)
    else:
        data = parse_frontmatter_simple(front)
    return data

def load_state():
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}

def save_state(state):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")

def get_batch_fingerprint(data):
    batches = data.get("downloadGroups") or []
    serialized = json.dumps(batches, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

def get_post_status(post, state):
    entry = state.get(post["slug"])
    if not isinstance(entry, dict):
        return "new"
    fingerprint = entry.get("batch_fingerprint")
    if not fingerprint:
        return "baseline"
    if fingerprint != get_batch_fingerprint(post["data"]):
        return "batch_update"
    return "sent"

def escape_html(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

USE_ANIMATED = os.getenv("USE_ANIMATED_EMOJI", "false").lower() in ("true", "1", "yes")
DONASI_URL = os.getenv("DONASI_URL", "https://saweria.co/DonghuaBatch").strip()
DONASI_TEXT = os.getenv("DONASI_TEXT", "💖 Donasi Untuk DonghuaBatch")

EMOJI_IDS = {
    "🎬": "5258477770735885832",
    "✨": "5874948844935974490",
    "🎭": "5807465992363710697",
    "📺": "5877536313623711363",
    "🎞️": "5875206779196935950",
    "📅": "5258474669769497337",
    "🏢": "5807868868886009920",
    "⭐": "5874948844935974490",
    "⏱️": "5843553939672274145",
    "📆": "5258474669769497337",
    "🎥": "5258477770735885832",
    "💬": "5920052658743283381",
    "🔗": "5258336354642697821",
    "🔥": "5843553939672274145",
    "📥": "5258336354642697821",
    "🎉": "5920052658743283381",
    "🚀": "5843553939672274145",
    "💖": "5807465992363710697"
}

def ae(fallback):
    if USE_ANIMATED and fallback in EMOJI_IDS:
        return f'<tg-emoji emoji-id="{EMOJI_IDS[fallback]}">{fallback}</tg-emoji>'
    return fallback

def build_caption(data, post_url):
    title = data.get("title", "Tanpa Judul")
    alt = data.get("alt", "")
    genre_list = data.get("genre", [])
    if isinstance(genre_list, str):
        genre_list = [genre_list]
    genre = ", ".join(genre_list) if genre_list else "-"
    status = data.get("status", "-")
    rating = data.get("rating", "-")
    episode = data.get("episode", "-")
    season = data.get("season", "-")
    studio = data.get("studio", [])
    if isinstance(studio, list):
        studio = ", ".join(studio)
    release = data.get("release", "-")
    durasi = data.get("durasi", "-")
    tipe = data.get("type", "Donghua")
    sub = data.get("sub", "-")
    caption = f"{ae('🎬')} <b>{escape_html(title)}</b>\n"
    caption += f"━━━━━━━━━━━━━━━━━━━━\n"
    if alt and alt != title and alt.strip() != "":
        caption += f"{ae('✨')} <b>{escape_html(alt)}</b>\n"
        caption += f"━━━━━━━━━━━━━━━━━━━━\n"
    caption += f"{ae('🎭')} Genre: {escape_html(str(genre))}\n"
    caption += f"{ae('📺')} Status: {escape_html(str(status))} | {ae('🎞️')} Episode: {escape_html(str(episode))}\n"
    caption += f"{ae('📅')} Season: {escape_html(str(season))} | {ae('🏢')} Studio: {escape_html(str(studio))}\n"
    caption += f"{ae('⭐')} Rating: {escape_html(str(rating))} | {ae('⏱️')} Durasi: {escape_html(str(durasi))}\n"
    caption += f"{ae('📆')} Rilis: {escape_html(str(release))} | {ae('🎥')} Tipe: {escape_html(str(tipe))}\n"
    caption += f"{ae('💬')} Sub: {escape_html(str(sub))}\n"
    caption += f"━━━━━━━━━━━━━━━━━━━━\n"
    caption += f"{ae('🔗')} <b>Link Download:</b>\n{post_url}\n"
    caption += f"━━━━━━━━━━━━━━━━━━━━\n"
    caption += f"{ae('🎉')} <b>Batch Sudah Tersedia!</b>\n"
    caption += f"{ae('🚀')} Silahkan Download Sekarang dan Nikmati Maraton Tanpa Batas!\n\n"
    caption += f"{ae('🔥')} Update batch hanya di DonghuaBatch | {ae('💖')} Support kami agar tetap update setiap hari"
    visible = re.sub(r"<[^>]+>", "", caption)
    if len(visible) > 1024:
        caption = re.sub(r"<[^>]+>", "", caption)[:1018] + "..."
    return caption

def send_photo(token, channel, photo_url, caption, post_url):
    api_url = f"https://api.telegram.org/bot{token}/sendPhoto"
    button_dl = {"text": "📥 Download Batch Sekarang", "url": post_url}
    if USE_ANIMATED:
        button_dl["icon_custom_emoji_id"] = EMOJI_IDS["📥"]
    keyboard = [[button_dl]]
    if DONASI_URL:
        button_donasi = {"text": DONASI_TEXT, "url": DONASI_URL}
        if USE_ANIMATED:
            button_donasi["icon_custom_emoji_id"] = EMOJI_IDS["💖"]
        keyboard.append([button_donasi])
    payload = {
        "chat_id": channel,
        "photo": photo_url,
        "caption": caption,
        "parse_mode": "HTML",
        "reply_markup": json.dumps({
            "inline_keyboard": keyboard
        })
    }
    resp = requests.post(api_url, data=payload, timeout=30)
    return resp

def send_message_fallback(token, channel, caption, post_url):
    api_url = f"https://api.telegram.org/bot{token}/sendMessage"
    button_dl = {"text": "📥 Download Batch Sekarang", "url": post_url}
    if USE_ANIMATED:
        button_dl["icon_custom_emoji_id"] = EMOJI_IDS["📥"]
    keyboard = [[button_dl]]
    if DONASI_URL:
        button_donasi = {"text": DONASI_TEXT, "url": DONASI_URL}
        if USE_ANIMATED:
            button_donasi["icon_custom_emoji_id"] = EMOJI_IDS["💖"]
        keyboard.append([button_donasi])
    payload = {
        "chat_id": channel,
        "text": caption,
        "parse_mode": "HTML",
        "reply_markup": json.dumps({
            "inline_keyboard": keyboard
        })
    }
    resp = requests.post(api_url, data=payload, timeout=30)
    return resp

def collect_posts(base_url):
    posts = []
    if not CONTENT_DIR.exists():
        return posts
    for md_file in sorted(CONTENT_DIR.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True):
        data = parse_markdown_file(md_file)
        if not data:
            continue
        if str(data.get("draft", "false")).lower() == "true":
            continue
        url_slug = data.get("url", md_file.stem)
        post_url = base_url.rstrip("/") + "/" + str(url_slug).strip("/") + "/"
        thumb = data.get("thumbnail") or data.get("image") or ""
        if thumb and thumb.startswith("/"):
            thumb_url = base_url.rstrip("/") + thumb
        elif thumb and thumb.startswith("http"):
            thumb_url = thumb
        else:
            thumb_url = ""
        posts.append({
            "file": md_file.name,
            "slug": str(url_slug),
            "data": data,
            "post_url": post_url,
            "thumb_url": thumb_url,
            "mtime": md_file.stat().st_mtime
        })
    return posts

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--slug", type=str, default="")
    args = parser.parse_args()

    token, channel, base_url = load_env_config()

    if args.check:
        print(f"Base URL: {base_url}")
        print(f"Channel: {channel}")
        print(f"Token: {'***' + token[-6:] if token else 'KOSONG'}")
        print(f"Content dir exists: {CONTENT_DIR.exists()}")
        posts = collect_posts(base_url)
        print(f"Total post ditemukan: {len(posts)}")
        state = load_state()
        statuses = {"new": [], "batch_update": [], "baseline": [], "sent": []}
        for post in posts:
            statuses[get_post_status(post, state)].append(post)
        print(f"Sudah terkirim: {len(state)}")
        print(f"Belum terkirim: {len(statuses['new'])}")
        print(f"Batch berubah: {len(statuses['batch_update'])}")
        print(f"Perlu baseline state lama: {len(statuses['baseline'])}")
        for post in (statuses["new"] + statuses["batch_update"])[:5]:
            print(f" - {post['slug']} | {post['data'].get('title','')}")
        return

    if not token or not channel:
        print("ERROR: BOT_TOKEN dan CHANNEL_ID wajib diisi di file .env")
        print("Contoh: BOT_TOKEN=123456:ABC-xxx dan CHANNEL_ID=@donghuabatch atau -100xxxx")
        return

    posts = collect_posts(base_url)
    if args.slug:
        posts = [p for p in posts if p["slug"] == args.slug]
        if not posts:
            print(f"Slug tidak ditemukan: {args.slug}")
            return

    state = load_state()
    to_send = []
    baseline_changed = False
    for post in posts:
        status = get_post_status(post, state)
        if not args.force and status == "sent":
            continue
        if not args.force and status == "baseline":
            state[post["slug"]]["batch_fingerprint"] = get_batch_fingerprint(post["data"])
            baseline_changed = True
            continue
        to_send.append(post)

    if baseline_changed and not args.dry_run:
        save_state(state)

    if args.limit and args.limit > 0:
        to_send = to_send[:args.limit]

    if not to_send:
        print("Tidak ada post baru untuk dikirim. Gunakan --force untuk kirim ulang atau --check untuk cek status.")
        return

    print(f"Menyiapkan {len(to_send)} post untuk dikirim ke {channel}")

    success = 0
    failed = 0
    for idx, post in enumerate(to_send, 1):
        caption = build_caption(post["data"], post["post_url"])
        thumb_url = post["thumb_url"]
        print(f"[{idx}/{len(to_send)}] {post['slug']} -> {post['post_url']}")

        if args.dry_run:
            print(f"  DRY RUN caption preview: {caption[:120]}...")
            if thumb_url:
                print(f"  Photo: {thumb_url}")
            success += 1
            continue

        try:
            if thumb_url:
                resp = send_photo(token, channel, thumb_url, caption, post["post_url"])
                if resp.status_code != 200 or not resp.json().get("ok"):
                    if "failed to get HTTP URL content" in resp.text or "wrong string length" in resp.text:
                        resp = send_message_fallback(token, channel, caption, post["post_url"])
            else:
                resp = send_message_fallback(token, channel, caption, post["post_url"])

            result = resp.json()
            if result.get("ok"):
                print(f"  Terkirim message_id={result['result']['message_id']}")
                state[post["slug"]] = {
                    "title": post["data"].get("title", ""),
                    "url": post["post_url"],
                    "sent_at": datetime.now().isoformat(),
                    "file": post["file"],
                    "batch_fingerprint": get_batch_fingerprint(post["data"])
                }
                save_state(state)
                success += 1
            else:
                print(f"  GAGAL: {result}")
                failed += 1
                if result.get("error_code") == 429:
                    retry = result.get("parameters", {}).get("retry_after", 5)
                    print(f"  Rate limit, tunggu {retry} detik")
                    time.sleep(int(retry) + 1)

        except Exception as e:
            print(f"  ERROR exception: {e}")
            failed += 1

        if idx < len(to_send):
            time.sleep(2)

    print(f"Selesai. Sukses: {success}, Gagal: {failed}, Total state: {len(load_state())}")

if __name__ == "__main__":
    main()
