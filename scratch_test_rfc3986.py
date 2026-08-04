import hashlib
import hmac
import urllib.parse

data = {
    'notification_type': 'card-incoming', 'zip': '', 'bill_id': '', 'amount': '48.50',
    'firstname': '', 'codepro': 'false', 'withdraw_amount': '50.00', 'city': '',
    'unaccepted': 'false', 'sign': 'ddf2853c895f58e7ec128ce689bbfda417e3dd23f7c94aa2b58b1ff6a92b1d79',
    'label': '5VJM7X', 'building': '', 'lastname': '', 'datetime': '2026-08-04T18:44:12Z',
    'suite': '', 'sender': '', 'phone': '', 'street': '', 'flat': '', 'fathersname': '',
    'operation_label': '3204469a-0011-5001-8000-10aeebcb7e62', 'operation_id': '839184252057214128',
    'currency': '643', 'email': ''
}

target = data['sign']

# Let's test with the secret if we can find what format matches.
# Secret is from user's env. Let's test different secrets or keys.
# Let's test URL-encoding key=val
clean_params = {k: v for k, v in data.items() if k != 'sign'}

# 1. key=quote(val)
str1 = "&".join([f"{k}={urllib.parse.quote(str(clean_params[k]))}" for k in sorted(clean_params.keys())])
print("str1:", str1)

# What if empty values are excluded?
str2 = "&".join([f"{k}={urllib.parse.quote(str(clean_params[k]))}" for k in sorted(clean_params.keys()) if clean_params[k] != ''])
print("str2:", str2)

# What if secret is in .env?
from config import settings
secret = settings.YOOMONEY_SECRET or "M8N2zIv6FvAfCAgJcmjNv9qN"

hmac1 = hmac.new(secret.encode(), str1.encode(), hashlib.sha256).hexdigest()
hmac2 = hmac.new(secret.encode(), str2.encode(), hashlib.sha256).hexdigest()

print("hmac1:", hmac1, hmac1 == target)
print("hmac2:", hmac2, hmac2 == target)
