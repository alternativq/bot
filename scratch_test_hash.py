import hashlib
import urllib.parse

secret = 'lmXekNfociMcuFtoLLGIoLrP'
notification_type = "p2p-incoming"
operation_id = "test-notification"
amount = "50.00"
currency = "643"
datetime_val = "2026-08-04T18:09:38Z"
sender = "41001000000"
codeproto = "false"
label = ""

check_str = f"{notification_type}&{operation_id}&{amount}&{currency}&{datetime_val}&{sender}&{codeproto}&{secret}&{label}"
expected_hash = hashlib.sha1(check_str.encode("utf-8")).hexdigest()
print(f"Generated hash: {expected_hash}")
