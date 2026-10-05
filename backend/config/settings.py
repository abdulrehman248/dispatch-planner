import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
SECRET_KEY = os.getenv("SECRET_KEY", "local-development-only-do-not-deploy")
if not DEBUG and SECRET_KEY == "local-development-only-do-not-deploy":
    from django.core.exceptions import ImproperlyConfigured

    raise ImproperlyConfigured("Set SECRET_KEY in production or DEBUG=true locally.")
ALLOWED_HOSTS=["*"]

CORS_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173", "https://dispatch-planner-bxgwluol8-abd-s-team1.vercel.app/"]
).split(",")
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "planner",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "UNAUTHENTICATED_USER": None,
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"anon": "30/min"},
}
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "trip-planner",
        "OPTIONS": {"MAX_ENTRIES": 1000},
    }
}
USE_TZ = True
TIME_ZONE = "UTC"
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
DATA_UPLOAD_MAX_MEMORY_SIZE = 32_768
PHOTON_URL = os.getenv("PHOTON_URL", "https://photon.komoot.io")
OSRM_URL = os.getenv("OSRM_URL", "https://router.project-osrm.org")
PROVIDER_USER_AGENT = os.getenv("PROVIDER_USER_AGENT", "DispatchTripPlanner/1.0")
