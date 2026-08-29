"""
Damascus Emergency Inventory — License Key Generator (android)  v4.0.0-P
=====================================================================
  Generates activation licenses for the Damascus Emergency Inventory
  PROTECTED desktop application (v4.0.0, Ed25519-signed).
  Usage: python KeyGenerator-v4.0.0-P-android.py
  Requires: Python 3.6+  |  No external packages needed.

  *** CONFIDENTIAL — Vendor use only — never share with customers ***
=====================================================================
"""

import sys
import base64
import datetime
import hashlib
import json
import os

# The release private key lives in release-secrets/<platform>/ - the finder
# below locates it whether the script runs from the secrets folder or from a
# tracked copy elsewhere in the project.
PLATFORM_LOWER = "android"


def _find_key_file():
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(here, "license-private-key.pem"),
        os.path.join(here, PLATFORM_LOWER, "license-private-key.pem"),
    ]
    d = here
    for _i in range(6):
        candidates.append(os.path.join(d, "release-secrets", PLATFORM_LOWER, "license-private-key.pem"))
        candidates.append(os.path.join(d, PLATFORM_LOWER, "license-private-key.pem"))
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    for candidate in candidates:
        if os.path.isfile(candidate):
            return candidate
    return None


_KEY_FILE = _find_key_file()
_SEED = None

LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "issued-licenses-android.log")

android = "android"
APP_VERSION = "4.0.0"

# ---------------------------------------------------------------------------
# Pure-Python Ed25519 (RFC 8032) — public-domain reference implementation
# ---------------------------------------------------------------------------
b = 256
q = 2 ** 255 - 19
l = 2 ** 252 + 27742317777372353535851937790883648493


def _H(m):
    return hashlib.sha512(m).digest()


def _inv(x):
    return pow(x, q - 2, q)


_d = -121665 * _inv(121666) % q
_I = pow(2, (q - 1) // 4, q)


def _xrecover(y):
    xx = (y * y - 1) * _inv(_d * y * y + 1)
    x = pow(xx, (q + 3) // 8, q)
    if (x * x - xx) % q != 0:
        x = (x * _I) % q
    if x % 2 != 0:
        x = q - x
    return x


_By = 4 * _inv(5) % q
_Bx = _xrecover(_By)
_B = [_Bx % q, _By % q]


def _edwards_add(P, Q):
    x1, y1 = P
    x2, y2 = Q
    x3 = (x1 * y2 + x2 * y1) * _inv(1 + _d * x1 * x2 * y1 * y2)
    y3 = (y1 * y2 + x2 * x1) * _inv(1 - _d * x1 * x2 * y1 * y2)
    return [x3 % q, y3 % q]


def _scalarmult(P, e):
    if e == 0:
        return [0, 1]
    Q = _scalarmult(P, e // 2)
    Q = _edwards_add(Q, Q)
    if e & 1:
        Q = _edwards_add(Q, P)
    return Q


def _point_compress(P):
    x, y = P
    return int.to_bytes(y | ((x & 1) << 255), 32, "little")


def _secret_expand(seed):
    if len(seed) != 32:
        raise Exception("Ed25519 seed must be 32 bytes")
    h = _H(seed)
    a = int.from_bytes(h[:32], "little")
    a &= (1 << 254) - 8
    a |= (1 << 254)
    return a


def _sign(seed, msg):
    a = _secret_expand(seed)
    A = _point_compress(_scalarmult(_B, a))
    r = int.from_bytes(_H(A + msg), "little") % l
    R = _point_compress(_scalarmult(_B, r))
    h = int.from_bytes(_H(R + A + msg), "little") % l
    s = (r + h * a) % l
    return R + s.to_bytes(32, "little")


def _seed_from_pkcs8_pem(pem_text):
    b64 = "".join(line for line in pem_text.splitlines() if "-----" not in line)
    der = base64.b64decode(b64)
    idx = der.rfind(b"\x04\x20")
    if idx == -1 or len(der) - idx - 2 < 32:
        raise Exception("Unsupported private key format (expected PKCS#8 Ed25519)")
    return der[idx + 2:idx + 34]


if _KEY_FILE:
    with open(_KEY_FILE, "r", encoding="utf-8") as _f:
        _SEED = _seed_from_pkcs8_pem(_f.read())

# ---------------------------------------------------------------------------
# License construction (identical to lib/license-core canonicalJson)
# ---------------------------------------------------------------------------


def _canonical(payload):
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def issue_license(device_id, expires_at=None, features=("all",)):
    import uuid
    payload = {
        "format": "dme-license",
        "version": 1,
        "keyId": "da2fb74422708bcb",
        "product": "damascus-emergency-inventory",
        "platform": android,
        "deviceId": device_id,
        "licenseId": str(uuid.uuid4()),
        "issuedAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
        "expiresAt": expires_at,
        "appVersion": APP_VERSION,
        "features": list(features),
    }
    canonical = _canonical(payload)
    signature = base64.b64encode(_sign(_SEED, canonical.encode("utf-8"))).decode("ascii")
    payload_b64 = base64.b64encode(canonical.encode("utf-8")).decode("ascii")
    return payload_b64 + "." + signature, payload


def parse_device_id(raw):
    s = raw.strip().upper()
    if s.startswith("DME-"):
        s = s[4:]
    parts = s.split("-")
    if len(parts) == 5 and len(parts[0]) == 8 and all(len(p) == 4 for p in parts[1:4]) and len(parts[4]) == 12:
        if all(c in "0123456789ABCDEF" for p in parts for c in p):
            hexed = "".join(parts)
            return "DME-" + "-".join([hexed[0:8], hexed[8:12], hexed[12:16], hexed[16:20], hexed[20:32]])
    return None


def log_issued(device_id, license_id, expires_at):
    log_path = LOG_FILE
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{now}]  android  |  Device: {device_id:<40}  License: {license_id}  Expires: {expires_at or 'never'}\n"
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(line)


def print_header():
    w = 67
    print("=" * w)
    print("  Damascus Emergency Inventory  —  License Key Generator  v4.0.0-P  (android)")
    print("  Signer keyId: da2fb74422708bcb")
    print("=" * w)
    print("  Admin tool — generates activation licenses for android devices")
    print("  *** CONFIDENTIAL — Vendor use only — never share with customers ***")
    print("=" * w)
    print()


def main():
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    print_header()
    if _SEED is None:
        print("  [!] لم يتم العثور على مفتاح التوقيع الخاص (license-private-key.pem)")
        print("      شغّل المولد من مجلد release-secrets/PLATFORM أو ضع ملف المفتاح")
        print("      بجانب السكربت ثم أعد المحاولة.")
        print()
        print("  Press Enter to exit...")
        try:
            input()
        except Exception:
            pass
        return
    print(f"  Issued licenses are appended to: {os.path.basename(LOG_FILE)}")
    print()

    while True:
        try:
            raw = input("Enter Device ID (DME-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX) or [q] to quit: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n  Exiting...")
            break
        if raw.lower() == "q":
            print("\n  Goodbye.\n")
            break

        device_id = parse_device_id(raw)
        if device_id is None:
            print("  [!] Invalid format. Copy the Device ID exactly from the activation screen.")
            print("      Expected: DME-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX")
            print()
            continue

        expires = input("Expiry date YYYY-MM-DD (Enter = never expires): ").strip()
        if expires and not (len(expires) == 10 and expires[4] == "-" and expires[7] == "-"):
            print("  [!] Invalid date format. Use YYYY-MM-DD or press Enter.\n")
            continue
        expires_iso = expires + "T23:59:59.000Z" if expires else None

        license_str, payload = issue_license(device_id, expires_iso)

        out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"license-{device_id}.txt")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(license_str + "\n")

        print()
        print("  Generated activation license:")
        print()
        print(f"    {license_str}")
        print()
        print(f"  [OK] Saved to: {out_path}")
        print("  [!] Send the FILE to the client - do not retype the string.")
        print("      (console wrapping can corrupt a manual copy)")
        print()
        log_issued(device_id, payload["licenseId"], expires_iso)


if __name__ == "__main__":
    main()