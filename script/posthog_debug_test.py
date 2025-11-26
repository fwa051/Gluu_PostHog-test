import os
from posthog import Posthog

api_key = os.getenv("POSTHOG_KEY", "phc_qqnC2GxyAyGUtGYrpKLKYn2ChAXAJE5YpLpljkAILFK")
host = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com")

if not api_key:
    raise SystemExit("POSTHOG_API_KEY is not set")

posthog = Posthog(api_key, host=host, debug=True)  # debug logs to console

# Send ONE simple event
posthog.capture(
    "debug_test_event",
    distinct_id="debug_user_001",
    properties={"source": "python_debug_test"}
)

posthog.flush()
print("Sent debug_test_event to PostHog")
