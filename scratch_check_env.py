from config import settings
s = settings.YOOMONEY_SECRET
print("Length:", len(s))
print("Starts with space:", s.startswith(' '))
print("Ends with space:", s.endswith(' '))
