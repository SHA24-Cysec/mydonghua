import os
import re
import html
import json
import time
import hashlib
import argparse
import tempfile
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse, quote
import requests

BASE_DIR = Path(__file__).resolve().parent
REPO_DIR = BASE_DIR.parent
CONTENT_DIR = REPO_DIR / "content" / "post"
CONFIG_TOML = REPO_DIR / "config.toml"
CONFIG_JSON = BASE_DIR / "telegram_config.json"

DEFAULT_BASE_URL = "https://donghuabatch.com/"
REQUEST_TIMEOUT = (10, 30)

try:
    from dotenv import load_dotenv
    for candidate_env in (REPO_DIR / ".env", BASE_DIR / ".env"):
        if candidate_env.exists() and not candidate_env.is_symlink():
            load_dotenv(dotenv_path=candidate_env, encoding="utf-8")
            break
except ImportError:
    pass

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False


def load_app_config():
    if CONFIG_JSON.exists() and not CONFIG_JSON.is_symlink():
        try:
            parsed = json.loads(CONFIG_JSON.read_text(encoding="utf-8"))
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return {}


def resolve_state_file(raw_path):
    base_resolved = BASE_DIR.resolve()
    candidate = (BASE_DIR / str(raw_path or "data/posted.json")).resolve()
    try:
        candidate.relative_to(base_resolved)
        return candidate
    except ValueError:
        return (BASE_DIR / "data" / "posted.json").resolve()


APP_CONFIG = load_app_config()
STATE_FILE = resolve_state_file(APP_CONFIG.get("state_file", "data/posted.json"))


def is_safe_http_url(url_value):
    if not url_value or not isinstance(url_value, str):
        return False
    try:
        parsed = urlparse(url_value.strip())
        return parsed.scheme in ("http", "https") and bool(parsed.netloc)
    except Exception:
        return False


def mask_token(token):
    if not token:
        return "KOSONG"
    if ":" in token:
        bot_id = token.split(":", 1)[0].strip()
        if bot_id.isdigit():
            return f"{bot_id}:***"
    return "***"


def redact_secret(message, token):
    text = str(message)
    if not token:
        return text
    text = text.replace(token, "[REDACTED]")
    encoded = quote(token, safe="")
    if encoded and encoded != token:
        text = text.replace(encoded, "[REDACTED]")
    return text


def create_http_session():
    session = requests.Session()
    session.trust_env = False
    session.headers.update({"User-Agent": "DonghuaBatch-Autopost/1.0"})
    return session


def get_base_url():
    env_base = os.getenv("BASE_URL", "").strip()
    if is_safe_http_url(env_base):
        return env_base
    if CONFIG_TOML.exists() and not CONFIG_TOML.is_symlink():
        content = CONFIG_TOML.read_text(encoding="utf-8")
        m = re.search(r"baseURL\s*=\s*['\"]([^'\"]+)['\"]", content)
        if m and is_safe_http_url(m.group(1)):
            return m.group(1).strip()
    cfg_base = str(APP_CONFIG.get("base_url", DEFAULT_BASE_URL)).strip()
    if is_safe_http_url(cfg_base):
        return cfg_base
    return DEFAULT_BASE_URL


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
                current_list = data[key]
            else:
                data[key] = val
                current_list = None
    return data


def parse_markdown_file(path):
    if path.name == "_index.md" or path.is_symlink():
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
    if STATE_FILE.exists() and not STATE_FILE.is_symlink():
        try:
            parsed = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return {}
    return {}


def save_state(state):
    parent = STATE_FILE.parent
    if parent.exists() and parent.is_symlink():
        raise RuntimeError("Direktori state tidak boleh berupa symlink")
    parent.mkdir(parents=True, exist_ok=True)
    if STATE_FILE.exists() and STATE_FILE.is_symlink():
        raise RuntimeError("File state tidak boleh berupa symlink")
    payload = json.dumps(state, indent=2, ensure_ascii=False)
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=parent, delete=False) as tmp_file:
            tmp_path = Path(tmp_file.name)
            tmp_file.write(payload)
            tmp_file.flush()
            os.fsync(tmp_file.fileno())
        os.replace(tmp_path, STATE_FILE)
    except Exception:
        if tmp_path is not None and tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass
        raise


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
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def resolve_runtime_settings():
    raw_anim = os.getenv("USE_ANIMATED_EMOJI")
    if raw_anim is None:
        use_animated = bool(APP_CONFIG.get("use_animated_emoji", False))
    else:
        use_animated = raw_anim.strip().lower() in ("true", "1", "yes")

    raw_donasi_url = os.getenv("DONASI_URL")
    if raw_donasi_url is None:
        donasi_url = str(APP_CONFIG.get("donasi_url", "https://saweria.co/DonghuaBatch")).strip()
    else:
        donasi_url = raw_donasi_url.strip()
    if donasi_url and not is_safe_http_url(donasi_url):
        donasi_url = ""

    raw_donasi_text = os.getenv("DONASI_TEXT")
    if raw_donasi_text is None:
        donasi_text = str(APP_CONFIG.get("donasi_text", "💖 Donasi Untuk DonghuaBatch")).strip()
    else:
        donasi_text = raw_donasi_text.strip()

    try:
        send_delay = max(0, int(APP_CONFIG.get("send_delay_seconds", 2)))
    except (TypeError, ValueError):
        send_delay = 2

    try:
        caption_limit = max(64, int(APP_CONFIG.get("caption_max_length_visible", 1024)))
    except (TypeError, ValueError):
        caption_limit = 1024

    parse_mode = str(APP_CONFIG.get("parse_mode", "HTML")).strip() or "HTML"
    btn_dl_text = str(APP_CONFIG.get("button_text_download", "📥 Download Batch Sekarang")).strip()
    btn_dl_icon = str(APP_CONFIG.get("button_icon_download", "5258336354642697821")).strip()
    btn_donasi_icon = str(APP_CONFIG.get("donasi_icon", "5807465992363710697")).strip()

    return (
        use_animated,
        donasi_url,
        donasi_text,
        send_delay,
        caption_limit,
        parse_mode,
        btn_dl_text,
        btn_dl_icon,
        btn_donasi_icon,
    )


(
    USE_ANIMATED,
    DONASI_URL,
    DONASI_TEXT,
    SEND_DELAY_SECONDS,
    CAPTION_MAX_LENGTH,
    PARSE_MODE,
    BUTTON_TEXT_DOWNLOAD,
    BUTTON_ICON_DOWNLOAD,
    DONASI_ICON_ID,
) = resolve_runtime_settings()

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
    "🔗": BUTTON_ICON_DOWNLOAD or "5258336354642697821",
    "🔥": "5843553939672274145",
    "📥": BUTTON_ICON_DOWNLOAD or "5258336354642697821",
    "🎉": "5920052658743283381",
    "🚀": "5843553939672274145",
    "💖": DONASI_ICON_ID or "5807465992363710697",
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
    genre = ", ".join(str(g) for g in genre_list) if genre_list else "-"
    status = data.get("status", "-")
    rating = data.get("rating", "-")
    episode = data.get("episode", "-")
    season = data.get("season", "-")
    studio = data.get("studio", [])
    if isinstance(studio, list):
        studio = ", ".join(str(s) for s in studio)
    release = data.get("release", "-")
    durasi = data.get("durasi", "-")
    tipe = data.get("type", "Donghua")
    sub = data.get("sub", "-")
    caption = f"{ae('🎬')} <b>{escape_html(title)}</b>\n"
    caption += "━━━━━━━━━━━━━━━━━━━━\n"
    if alt and alt != title and str(alt).strip() != "":
        caption += f"{ae('✨')} <b>{escape_html(alt)}</b>\n"
        caption += "━━━━━━━━━━━━━━━━━━━━\n"
    caption += f"{ae('🎭')} Genre: {escape_html(genre)}\n"
    caption += f"{ae('📺')} Status: {escape_html(status)} | {ae('🎞️')} Episode: {escape_html(episode)}\n"
    caption += f"{ae('📅')} Season: {escape_html(season)} | {ae('🏢')} Studio: {escape_html(studio)}\n"
    caption += f"{ae('⭐')} Rating: {escape_html(rating)} | {ae('⏱️')} Durasi: {escape_html(durasi)}\n"
    caption += f"{ae('📆')} Rilis: {escape_html(release)} | {ae('🎥')} Tipe: {escape_html(tipe)}\n"
    caption += f"{ae('💬')} Sub: {escape_html(sub)}\n"
    caption += "━━━━━━━━━━━━━━━━━━━━\n"
    caption += f"{ae('🔗')} <b>Link Download:</b>\n{escape_html(post_url)}\n"
    caption += "━━━━━━━━━━━━━━━━━━━━\n"
    caption += f"{ae('🎉')} <b>Batch Sudah Tersedia!</b>\n"
    caption += f"{ae('🚀')} Silahkan Download Sekarang dan Nikmati Maraton Tanpa Batas!\n\n"
    caption += f"{ae('🔥')} Update batch hanya di DonghuaBatch | {ae('💖')} Support kami agar tetap update setiap hari"
    visible_plain = html.unescape(re.sub(r"<[^>]+>", "", caption))
    if len(visible_plain) > CAPTION_MAX_LENGTH:
        truncated_plain = visible_plain[: CAPTION_MAX_LENGTH - 3] + "..."
        caption = escape_html(truncated_plain)
    return caption


def build_inline_keyboard(post_url):
    button_dl = {"text": BUTTON_TEXT_DOWNLOAD, "url": post_url}
    if USE_ANIMATED:
        button_dl["icon_custom_emoji_id"] = EMOJI_IDS["📥"]
    keyboard = [[button_dl]]
    if DONASI_URL and DONASI_TEXT:
        button_donasi = {"text": DONASI_TEXT, "url": DONASI_URL}
        if USE_ANIMATED:
            button_donasi["icon_custom_emoji_id"] = EMOJI_IDS["💖"]
        keyboard.append([button_donasi])
    return keyboard


def parse_api_response(resp, token):
    try:
        parsed = resp.json()
        if isinstance(parsed, dict):
            return parsed
    except ValueError:
        pass
    return {
        "ok": False,
        "error_code": resp.status_code,
        "description": redact_secret(resp.text[:200], token),
    }


def send_photo(token, channel, photo_url, caption, post_url, session=None):
    http = session or create_http_session()
    api_url = f"https://api.telegram.org/bot{token}/sendPhoto"
    payload = {
        "chat_id": channel,
        "photo": photo_url,
        "caption": caption,
        "parse_mode": PARSE_MODE,
        "reply_markup": json.dumps({"inline_keyboard": build_inline_keyboard(post_url)}),
    }
    return http.post(api_url, data=payload, timeout=REQUEST_TIMEOUT)


def send_message_fallback(token, channel, caption, post_url, session=None):
    http = session or create_http_session()
    api_url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": channel,
        "text": caption,
        "parse_mode": PARSE_MODE,
        "reply_markup": json.dumps({"inline_keyboard": build_inline_keyboard(post_url)}),
    }
    return http.post(api_url, data=payload, timeout=REQUEST_TIMEOUT)


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
        if not is_safe_http_url(post_url):
            continue
        thumb = str(data.get("thumbnail") or data.get("image") or "").strip()
        if thumb and thumb.startswith("/"):
            candidate_thumb = base_url.rstrip("/") + thumb
            thumb_url = candidate_thumb if is_safe_http_url(candidate_thumb) else ""
        elif is_safe_http_url(thumb):
            thumb_url = thumb
        else:
            thumb_url = ""
        posts.append({
            "file": md_file.name,
            "slug": str(url_slug),
            "data": data,
            "post_url": post_url,
            "thumb_url": thumb_url,
            "mtime": md_file.stat().st_mtime,
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
        print(f"Token: {mask_token(token)}")
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
            print(f" - {post['slug']} | {post['data'].get('title', '')}")
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
    session = create_http_session()
    try:
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
                    resp = send_photo(token, channel, thumb_url, caption, post["post_url"], session=session)
                    result = parse_api_response(resp, token)
                    if resp.status_code != 200 or not result.get("ok"):
                        err_text = str(result.get("description", "")) + " " + redact_secret(resp.text[:200], token)
                        if "failed to get HTTP URL content" in err_text or "wrong string length" in err_text:
                            resp = send_message_fallback(token, channel, caption, post["post_url"], session=session)
                            result = parse_api_response(resp, token)
                else:
                    resp = send_message_fallback(token, channel, caption, post["post_url"], session=session)
                    result = parse_api_response(resp, token)

                if result.get("ok"):
                    msg_id = result.get("result", {}).get("message_id", "-")
                    print(f"  Terkirim message_id={msg_id}")
                    state[post["slug"]] = {
                        "title": post["data"].get("title", ""),
                        "url": post["post_url"],
                        "sent_at": datetime.now().isoformat(),
                        "file": post["file"],
                        "batch_fingerprint": get_batch_fingerprint(post["data"]),
                    }
                    save_state(state)
                    success += 1
                else:
                    safe_result = redact_secret(result, token)
                    print(f"  GAGAL: {safe_result}")
                    failed += 1
                    if result.get("error_code") == 429:
                        raw_retry = result.get("parameters", {}).get("retry_after", 5)
                        try:
                            retry = min(max(int(raw_retry), 1), 300)
                        except (TypeError, ValueError):
                            retry = 5
                        print(f"  Rate limit, tunggu {retry} detik")
                        time.sleep(retry + 1)

            except Exception as e:
                print(f"  ERROR exception: {redact_secret(e, token)}")
                failed += 1

            if idx < len(to_send) and SEND_DELAY_SECONDS > 0:
                time.sleep(SEND_DELAY_SECONDS)
    finally:
        session.close()

    print(f"Selesai. Sukses: {success}, Gagal: {failed}, Total state: {len(load_state())}")


if __name__ == "__main__":
    main()
